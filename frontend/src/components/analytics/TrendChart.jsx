const W = 640;
const H = 260;
const L = 42;
const R = 16;
const T = 16;
const B = 38;

export default function TrendChart({ points }) {
  const n = points.length;
  if (n === 0) return <p className="text-sm text-muted">No runs in this period.</p>;

  const iw = W - L - R;
  const ih = H - T - B;
  const x = (i) => (n === 1 ? L + iw / 2 : L + (i / (n - 1)) * iw);
  const y = (v) => T + ih - (Math.max(0, Math.min(100, v)) / 100) * ih;

  const known = points.map((p, i) => ({ ...p, i })).filter((p) => p.passRate != null);
  const line = known
    .map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.passRate).toFixed(1)}`)
    .join(' ');
  const area =
    known.length > 1
      ? `${line} L${x(known.at(-1).i).toFixed(1)},${y(0)} L${x(known[0].i).toFixed(1)},${y(0)} Z`
      : null;
  const step = Math.max(1, Math.ceil(n / 7));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[520px]" role="img" aria-label="Pass rate per run">
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {v}%
            </text>
          </g>
        ))}

        {area && <path d={area} fill="var(--brand)" opacity="0.12" />}
        {known.length > 1 && (
          <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {known.map((p) => (
          <circle key={p.runId} cx={x(p.i)} cy={y(p.passRate)} r="4.5" fill="var(--brand)" stroke="var(--card)" strokeWidth="2">
            <title>{`${p.runCode}: ${p.passRate}% (${p.passed} passed, ${p.failed} failed)`}</title>
          </circle>
        ))}

        {points.map(
          (p, i) =>
            (i % step === 0 || i === n - 1) && (
              <text key={p.runId} x={x(i)} y={H - 14} textAnchor="middle" fontSize="12" fill="var(--muted)">
                #{p.runCode.split('-').pop()}
              </text>
            )
        )}
      </svg>
      {n < 2 && <p className="mt-2 text-xs text-muted">Run your tests a few more times to see a trend.</p>}
    </div>
  );
}