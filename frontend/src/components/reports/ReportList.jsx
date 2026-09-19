import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import { REPORT_STATUS_LABEL, REPORT_STATUS_TONE } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';
import { cn } from '../../utils/cn';

export default function ReportList({ items, activeId, onSelect }) {
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r)}
            className={cn(
              'w-full rounded-xl border p-3 text-left transition-colors',
              activeId === r.id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-primary-soft/50'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-ink" title={r.title}>
                {r.title}
              </p>
              <Badge tone={REPORT_STATUS_TONE[r.status]}>
                {r.status === 'GENERATING' && <Spinner className="size-3" />}
                {REPORT_STATUS_LABEL[r.status]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              {[r.runCode, formatDateTime(r.createdAt)].filter(Boolean).join(' · ')}
            </p>
            {r.summary && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{r.summary}</p>}
          </button>
        </li>
      ))}
    </ul>
  );
}