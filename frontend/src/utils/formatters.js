export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);

export const formatPercent = (n, digits = 1) => `${Number(n ?? 0).toFixed(digits)}%`;

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}