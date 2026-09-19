import { useEffect, useRef, useState } from 'react';
import api, { TOKEN_KEY } from '../services/api';

const FINISHED = ['completed', 'failed', 'unknown'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Splits an SSE text buffer into events and returns the unfinished remainder
function parseSse(buffer, onEvent) {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop();
  for (const block of blocks) {
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) continue;
    try {
      onEvent(event, JSON.parse(data));
    } catch {
      /* ignore malformed event */
    }
  }
  return rest;
}

/**
 * Live progress for a background job.
 * Streams over SSE using fetch (EventSource cannot send the auth header),
 * and falls back to polling statusPath if the stream fails.
 */
export function useRunProgress({ streamPath, statusPath, enabled = true, onFinish }) {
  const [snapshot, setSnapshot] = useState(null);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  });

  useEffect(() => {
    setSnapshot(null);
    if (!enabled || !streamPath) return;

    const controller = new AbortController();
    let stopped = false;
    let finished = false;

    const handle = (snap) => {
      if (stopped) return;
      setSnapshot(snap);
      if (FINISHED.includes(snap.state) && !finished) {
        finished = true;
        finishRef.current?.(snap);
      }
    };

    const gone = (message) =>
      handle({ state: 'unknown', progress: { percent: 0 }, result: null, error: message });

    async function stream() {
      const res = await fetch(`${api.defaults.baseURL}${streamPath}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`,
          Accept: 'text/event-stream',
        },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSse(buffer, (event, data) => {
          if (event === 'progress' || event === 'done') handle(data);
          else if (event === 'error') gone(data.message);
        });
      }
    }

    async function poll() {
      while (!stopped && !finished) {
        try {
          const { data } = await api.get(statusPath);
          handle(data.data.job);
        } catch (err) {
          if (err.response?.status === 404) gone('This job is no longer available.');
        }
        if (stopped || finished) break;
        await sleep(2000);
      }
    }

    (async () => {
      try {
        await stream();
      } catch {
        /* fall back to polling below */
      }
      if (!stopped && !finished) await poll();
    })();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [enabled, streamPath, statusPath]);

  return { snapshot };
}