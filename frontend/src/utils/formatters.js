export const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n ?? 0);

export const formatPercent = (n, digits = 1) => `${Number(n ?? 0).toFixed(digits)}%`;

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds ?? 0));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export function formatRole(role) {
  const map = { ADMIN: 'Admin', QA_ENGINEER: 'QA Engineer', DEVELOPER: 'Developer', VIEWER: 'Viewer' };
  return map[role] || role;
}

export function getInitials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';