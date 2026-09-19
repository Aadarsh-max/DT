import { Link } from 'react-router-dom';
import { Copy } from 'lucide-react';
import Button from '../ui/Button';

export default function DuplicateBanner({ bug, canWrite, busy, onConfirm, onDismiss }) {
  if (!bug.duplicateOf) return null;
  const original = bug.duplicateOf;
  const confirmed = bug.status === 'DUPLICATE';
  const score = bug.duplicateScore != null ? Math.round(bug.duplicateScore * 100) : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Copy className="mt-0.5 size-5 shrink-0 text-warning" />
        <p className="text-sm text-ink">
          <span className="font-semibold">
            {confirmed ? 'Marked as a duplicate of ' : 'Possible duplicate of '}
          </span>
          <Link to={`/bugs/${original.id}`} className="font-semibold text-brand hover:underline">
            {original.code}
          </Link>
          <span className="text-muted">
            {' '}
            · {original.title}
            {score != null && ` · ${score}% similar`}
          </span>
        </p>
      </div>
      {canWrite && (
        <div className="flex shrink-0 gap-2">
          {!confirmed && (
            <Button size="sm" loading={busy} onClick={onConfirm}>
              Mark as duplicate
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={busy} onClick={onDismiss}>
            {confirmed ? 'Reopen' : 'Not a duplicate'}
          </Button>
        </div>
      )}
    </div>
  );
}