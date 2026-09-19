import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Bot, Eraser, Send, Sparkles, X } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { useProject } from '../../hooks/useProject';
import { chatService } from '../../services/chat.service';
import { getErrorMessage } from '../../services/api';
import ChatMessage from './ChatMessage';

const SUGGESTIONS = [
  'What failed in the latest run?',
  'Which bugs should I fix first?',
  'How is the pass rate trending?',
  'Summarize the main requirements',
];

export default function ChatPanel({ open, onClose }) {
  const toast = useToast();
  const { current } = useProject();
  const projectId = current?.id;

  const projectRef = useRef(projectId);
  const bottom = useRef(null);
  const field = useRef(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    projectRef.current = projectId;
  });

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    chatService
      .history(projectId)
      .then((m) => !cancelled && setMessages(m))
      .catch(() => !cancelled && setMessages([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, sending, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    field.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || sending || !projectId) return;

    const asked = projectId;
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'USER', content }]);
    setInput('');
    setSending(true);
    try {
      const { messages: saved, sources } = await chatService.ask(asked, content);
      if (projectRef.current !== asked) return; // the project changed while waiting
      setMessages((m) => [
        ...m.filter((x) => x.id !== tempId),
        ...saved.map((x) => (x.role === 'ASSISTANT' ? { ...x, sources } : x)),
      ]);
    } catch (err) {
      if (projectRef.current === asked) {
        setMessages((m) => m.filter((x) => x.id !== tempId));
        setInput(content);
      }
      toast.error(getErrorMessage(err, 'The assistant could not answer'));
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    if (!window.confirm('Clear this conversation?')) return;
    try {
      await chatService.clear(projectId);
      setMessages([]);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-card shadow-card sm:max-w-md"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-semibold text-ink">AI Assistant</p>
              <p className="truncate text-xs text-muted">{current ? current.name : 'No project selected'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clear}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-brand"
              >
                <Eraser className="size-4" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-muted hover:bg-primary-soft hover:text-brand"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!current ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <Bot className="mx-auto mb-3 size-10 text-brand" />
                <p className="text-sm text-muted">Create a project first, then ask about its tests and bugs.</p>
                <Link to="/projects" onClick={onClose} className="mt-2 inline-block text-sm font-medium text-brand hover:underline">
                  Go to projects
                </Link>
              </div>
            </div>
          ) : loading ? (
            <div className="grid place-items-center py-10 text-brand">
              <Spinner className="size-6" />
            </div>
          ) : messages.length === 0 && !sending ? (
            <div className="space-y-4 pt-4">
              <div className="text-center">
                <Bot className="mx-auto mb-2 size-10 text-brand" />
                <p className="text-sm font-semibold text-ink">Ask about {current.name}</p>
                <p className="mt-1 text-xs text-muted">
                  I can read your runs, bugs and requirements. I can&apos;t run tests or change anything.
                </p>
              </div>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-line px-3 py-2 text-left text-sm text-ink hover:bg-primary-soft"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          )}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-3.5" /> Thinking...
            </div>
          )}
          <div ref={bottom} />
        </div>

        <footer className="border-t border-line p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={field}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!current || sending}
              maxLength={2000}
              placeholder="Ask about your tests or bugs..."
              aria-label="Message"
              className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20 disabled:opacity-60"
            />
            <button
              onClick={() => send()}
              disabled={!current || sending || !input.trim()}
              aria-label="Send"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">
            AI can be wrong. It only sees this project&apos;s data. Enter to send, Shift+Enter for a new line.
          </p>
        </footer>
      </aside>
    </div>,
    document.body
  );
}