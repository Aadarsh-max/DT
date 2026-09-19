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

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

export const formatMs = (ms) => {
  const n = Number(ms ?? 0);
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n} ms`;
};

// Seconds a run has been going (or ran for)
export function runSeconds(run, now = Date.now()) {
  if (!run?.startedAt) return 0;
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : now;
  return Math.max(0, (end - new Date(run.startedAt).getTime()) / 1000);
}