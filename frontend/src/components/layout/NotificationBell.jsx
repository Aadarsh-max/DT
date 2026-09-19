import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { collabService } from '../../services/collab.service';
import { cn } from '../../utils/cn';

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], unread: 0 });

  const load = useCallback(async () => {
    try {
      setData(await collabService.notifications.list());
    } catch {
      /* keep what is shown */
    }
  }, []);

  // Checked every 30 seconds while the tab is visible
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) load();
    setOpen((o) => !o);
  }

  async function onOpenItem(n) {
    setOpen(false);
    if (!n.read) {
      setData((d) => ({
        items: d.items.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
        unread: Math.max(0, d.unread - 1),
      }));
      collabService.notifications.read(n.id).catch(() => {});
    }
    if (n.link?.startsWith('/')) navigate(n.link);
  }

  async function onReadAll() {
    setData((d) => ({ items: d.items.map((x) => ({ ...x, read: true })), unread: 0 }));
    collabService.notifications.readAll().catch(() => {});
  }

  const { items, unread } = data;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative rounded-xl p-2.5 text-ink hover:bg-primary-soft"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-40 rounded-xl border border-line bg-card shadow-card sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button onClick={onReadAll} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Nothing yet. Alerts about runs, bugs and comments show up here.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onOpenItem(n)}
                    className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-primary-soft/50', !n.read && 'bg-primary-soft/30')}
                  >
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{n.title}</span>
                      {n.message && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.message}</span>}
                      <span className="mt-1 block text-[11px] text-muted">{ago(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}