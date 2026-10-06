import { NavLink } from 'react-router-dom';
import { Bot, ChevronLeft, ChevronRight } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constants';
import { cn } from '../../utils/cn';
import AIAssistantCard from './AIAssistantCard';

export function SidebarContent({ onNavigate, onOpenChat, collapsed = false }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center gap-3 px-5 py-5', collapsed && 'justify-center px-0')}>
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white">
          <Bot className="size-6" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-lg font-bold text-ink">AI Testing</p>
            <p className="text-lg font-bold text-ink">Engineer</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-primary-soft text-brand'
                  : 'text-ink/80 hover:bg-primary-soft/60 hover:text-brand'
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <AIAssistantCard
          onOpen={() => {
            onNavigate?.();
            onOpenChat?.();
          }}
        />
      )}
    </div>
  );
}

export default function Sidebar({ onOpenChat, collapsed, onToggleCollapse }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-card transition-[width] duration-200 lg:block',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <button
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-8 z-10 grid size-6 place-items-center rounded-full border border-line bg-card text-muted shadow-card hover:bg-primary-soft hover:text-brand"
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
      </button>
      <SidebarContent onOpenChat={onOpenChat} collapsed={collapsed} />
    </aside>
  );
}