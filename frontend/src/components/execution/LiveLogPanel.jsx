import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { formatMs } from '../../utils/formatters';

const ICON = { PASSED: '\u2713', FAILED: '\u2717', ERROR: '!', SKIPPED: '-' };
const COLOR = {
  PASSED: 'text-success',
  FAILED: 'text-danger',
  ERROR: 'text-warning',
  SKIPPED: 'text-[#9ca3c0]',
};

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour12: false });

// Terminal-style view of the latest finished cases plus the one running now
export default function LiveLogPanel({ snapshot }) {
  const box = useRef(null);
  const lines = [...(snapshot?.recent ?? [])].reverse();
  const running = snapshot?.state === 'running' ? snapshot.progress?.message : null;

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines.length, running]);

  return (
    <div
      ref={box}
      className="h-64 overflow-y-auto rounded-xl bg-[#0f0e1f] p-3 font-mono text-xs leading-relaxed text-[#e5e7ff]"
      role="log"
      aria-live="polite"
    >
      {lines.length === 0 && !running && <p className="text-[#9ca3c0]">Waiting for the first result...</p>}

      {lines.map((l) => (
        <div key={l.id} className="mb-1">
          <p>
            <span className="text-[#9ca3c0]">[{time(l.at)}]</span>{' '}
            <span className={COLOR[l.status]}>{ICON[l.status]}</span> {l.title}{' '}
            <span className="text-[#9ca3c0]">({formatMs(l.durationMs)})</span>
          </p>
          {l.errorMessage && l.status !== 'PASSED' && (
            <p className="pl-6 text-[#9ca3c0]">{l.errorMessage}</p>
          )}
        </div>
      ))}

      {running && (
        <p className="flex items-center gap-2 text-[#a5a0ff]">
          <Loader2 className="size-3 animate-spin" /> {running}
        </p>
      )}
    </div>
  );
}