import { Search } from 'lucide-react';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import Spinner from '../ui/Spinner';
import { METHOD_TONE } from '../../utils/constants';
import { cn } from '../../utils/cn';

const pick = (d, ...keys) => keys.map((k) => d?.[k]).find((v) => v != null && v !== '');

// Reads method and endpoint from the flexible test data the AI produces
export function readApiCase(tc) {
  const d = tc.testData ?? {};
  return {
    method: String(pick(d, 'method', 'http_method') ?? 'GET').toUpperCase(),
    endpoint: String(pick(d, 'endpoint', 'url', 'path') ?? ''),
    expectedStatus: pick(d, 'expected_status', 'expected_status_code', 'status', 'status_code'),
    headers: pick(d, 'headers') ?? null,
    body: pick(d, 'body', 'payload', 'json', 'request_body') ?? null,
  };
}

export default function EndpointList({ items, loading, activeId, onSelect, search, onSearch }) {
  return (
    <div className="space-y-3">
      <Input
        icon={Search}
        placeholder="Filter API test cases..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Filter API test cases"
      />

      {loading ? (
        <div className="grid place-items-center py-10 text-brand">
          <Spinner className="size-6" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">
          No API test cases yet. Generate some on the Test Cases page, or type a request by hand.
        </p>
      ) : (
        <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
          {items.map((tc) => {
            const c = readApiCase(tc);
            return (
              <li key={tc.id}>
                <button
                  type="button"
                  onClick={() => onSelect(tc)}
                  className={cn(
                    'w-full rounded-xl border p-2.5 text-left transition-colors',
                    activeId === tc.id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-primary-soft/50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={METHOD_TONE[c.method] ?? 'neutral'}>{c.method}</Badge>
                    <span className="min-w-0 truncate font-mono text-xs text-ink">{c.endpoint || '(no endpoint)'}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted" title={tc.title}>
                    {tc.title}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}