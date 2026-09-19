import { Bell, ChevronDown, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

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

        <button
          aria-label="Notifications"
          className="relative rounded-xl p-2.5 text-ink hover:bg-primary-soft"
        >
          <Bell className="size-5" />
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-danger text-[10px] font-semibold text-white">
            3
          </span>
        </button>

        {/* Wired to the logged-in user in Phase 3 */}
        <button className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-primary-soft sm:pr-2">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-white">
            NS
          </span>
          <span className="hidden text-left leading-tight md:block">
            <span className="block text-sm font-semibold text-ink">Nihar Sawant</span>
            <span className="block text-xs text-muted">QA Engineer</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted md:block" />
        </button>
      </div>
    </header>
  );
}