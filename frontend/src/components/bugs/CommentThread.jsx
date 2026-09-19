import { useCallback, useEffect, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { collabService } from '../../services/collab.service';
import { getErrorMessage } from '../../services/api';
import { formatDateTime, getInitials } from '../../utils/formatters';

export default function CommentThread({ bugId }) {
  const toast = useToast();
  const [items, setItems] = useState(null); // null = loading
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await collabService.comments.list(bugId));
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, [bugId]);

  // Refreshed every 20 seconds while the tab is visible
  useEffect(() => {
    setItems(null);
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 20000);
    return () => clearInterval(id);
  }, [load]);

  async function post() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await collabService.comments.add(bugId, body);
      setText('');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not post the comment'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c) {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await collabService.comments.remove(c.id);
      setItems((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      post();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Discussion{items?.length ? ` (${items.length})` : ''}</CardTitle>
      </CardHeader>

      {items === null ? (
        <div className="grid place-items-center py-6 text-brand">
          <Spinner className="size-5" />
        </div>
      ) : items.length === 0 ? (
        <p className="mb-4 text-sm text-muted">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="mb-4 space-y-4">
          {items.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-brand">
                {getInitials(c.author.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-semibold text-ink">{c.author.name}</span>
                    <span className="ml-2 text-xs text-muted">{formatDateTime(c.createdAt)}</span>
                  </p>
                  {c.canDelete && (
                    <button
                      onClick={() => remove(c)}
                      aria-label="Delete comment"
                      className="rounded-lg p-1 text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={2000}
          placeholder="Write a comment..."
          aria-label="Comment"
          className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20"
        />
        <Button icon={Send} loading={busy} disabled={!text.trim()} onClick={post} className="h-11">
          Post
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted">Ctrl+Enter to post. The assignee and earlier commenters are notified.</p>
    </Card>
  );
}