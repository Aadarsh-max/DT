import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Moon, Search, Settings, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { formatRole, getInitials } from '../../utils/formatters';

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-primary-soft sm:pr-2"
      >
        <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-white">
          {getInitials(user?.name)}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-sm font-semibold text-ink">{user?.name}</span>
          <span className="block text-xs text-muted">{formatRole(user?.role)}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted md:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-card p-1.5 shadow-card"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-primary-soft"
          >
            <Settings className="size-4" /> Settings
          </Link>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ onMenu }) {
  const { isDark, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-line bg-card/90 px-3 backdrop-blur sm:gap-3 sm:px-6">
      <button
        onClick={onMenu}
        aria-label="Open menu"
        className="rounded-xl p-2 text-ink hover:bg-primary-soft lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          placeholder="Search tests, projects, bugs..."
          className="h-10 w-full rounded-xl border border-line bg-page pl-9 pr-3 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20 sm:pr-14"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-card px-1.5 py-0.5 text-[10px] text-muted sm:block">
          ⌘ K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="rounded-xl p-2.5 text-ink hover:bg-primary-soft"
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>

        {/* Wired to real notifications in Phase 10 */}
        <button
          aria-label="Notifications"
          className="relative rounded-xl p-2.5 text-ink hover:bg-primary-soft"
        >
          <Bell className="size-5" />
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-white">
            3
          </span>
        </button>

        <UserMenu />
      </div>
    </header>
  );
}