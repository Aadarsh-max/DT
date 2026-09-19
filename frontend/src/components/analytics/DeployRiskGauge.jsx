const LEN = Math.PI * 80;
const COLOR = {
  low: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  veryhigh: '#ef4444',
  nodata: '#9ca3af',
};
const ARC = 'M20 100 A80 80 0 0 1 180 100';

export default function DeployRiskGauge({ value, level, label }) {
  const v = Math.max(0, Math.min(100, value ?? 0));

  return (
    <div className="relative mx-auto w-full max-w-[220px]">
      <svg viewBox="0 0 200 115" className="w-full" role="img" aria-label={`Deployment failure risk ${v} percent`}>
        <path d={ARC} fill="none" stroke="var(--line)" strokeWidth="18" strokeLinecap="round" />
        {value != null && v > 0 && (
          <path
            d={ARC}
            fill="none"
            stroke={COLOR[level] ?? COLOR.nodata}
            strokeWidth="18"
            strokeLinecap="round"
            strokeDasharray={`${(v / 100) * LEN} ${LEN}`}
          />
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <p className="text-3xl font-bold leading-none text-ink">{value == null ? '—' : `${v}%`}</p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}