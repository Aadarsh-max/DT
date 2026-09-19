const SEGMENTS = [
  ['passed', 'bg-success', 'Passed'],
  ['failed', 'bg-danger', 'Failed'],
  ['errors', 'bg-warning', 'Error'],
  ['skipped', 'bg-muted/40', 'Skipped'],
];

// rows: [{ name, total, passed, failed, errors, skipped, passRate }]
export default function ModuleHealthChart({ rows }) {
  if (!rows?.length) return <p className="text-sm text-muted">No results yet.</p>;

  return (
    <div>
      <ul className="space-y-3.5">
        {rows.map((r) => {
          const total = r.total || 1;
          return (
            <li key={r.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink" title={r.name}>
                  {r.name}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {r.total} test{r.total === 1 ? '' : 's'} ·{' '}
                  <span className="font-semibold text-ink">{r.passRate == null ? '—' : `${r.passRate}%`}</span>
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-primary-soft">
                {SEGMENTS.map(([key, cls, label]) =>
                  r[key] > 0 ? (
                    <div
                      key={key}
                      className={cls}
                      style={{ width: `${(r[key] / total) * 100}%` }}
                      title={`${label}: ${r[key]}`}
                    />
                  ) : null
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {SEGMENTS.map(([key, cls, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}