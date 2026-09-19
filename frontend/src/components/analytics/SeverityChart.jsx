const ORDER = [
  ['CRITICAL', 'Critical', '#ef4444'],
  ['HIGH', 'High', '#f97316'],
  ['MEDIUM', 'Medium', '#f59e0b'],
  ['LOW', 'Low', '#3b82f6'],
];
const R = 50;
const C = 2 * Math.PI * R;

export default function SeverityChart({ counts = {}, unanalyzed = 0 }) {
  const total = ORDER.reduce((s, [k]) => s + (counts[k] ?? 0), 0);

  let offset = 0;
  const arcs = ORDER.map(([key, label, color]) => {
    const value = counts[key] ?? 0;
    const len = total ? (value / total) * C : 0;
    const arc = { key, label, color, value, len, offset };
    offset += len;
    return arc;
  });

  if (total === 0) {
    return (
      <p className="text-sm text-muted">
        {unanalyzed > 0
          ? `${unanalyzed} bug${unanalyzed === 1 ? ' is' : 's are'} still waiting for analysis.`
          : 'No analyzed bugs in this period.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 min-[480px]:flex-row min-[480px]:justify-around">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="20" />
          {arcs.map(
            (a) =>
              a.value > 0 && (
                <circle
                  key={a.key}
                  cx="70"
                  cy="70"
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="20"
                  strokeDasharray={`${a.len} ${C - a.len}`}
                  strokeDashoffset={-a.offset}
                />
              )
          )}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <p className="text-2xl font-bold text-ink">{total}</p>
          <p className="text-xs text-muted">bugs</p>
        </div>
      </div>

      <ul className="w-full space-y-2 text-sm min-[480px]:w-auto">
        {arcs.map((a) => (
          <li key={a.key} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2 text-ink">
              <span className="size-2.5 rounded-full" style={{ background: a.color }} />
              {a.label}
            </span>
            <span className="font-semibold text-ink">{a.value}</span>
          </li>
        ))}
        {unanalyzed > 0 && <li className="text-xs text-muted">+ {unanalyzed} not analyzed yet</li>}
      </ul>
    </div>
  );
}