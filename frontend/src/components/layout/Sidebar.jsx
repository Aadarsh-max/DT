import { NavLink } from 'react-router-dom';
import { Bot, MessageSquarePlus, Sparkles } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constants';
import { cn } from '../../utils/cn';

export function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid size-11 place-items-center rounded-xl bg-primary text-white">
          <Bot className="size-6" />
        </div>
        <div className="leading-tight">
          <p className="text-lg font-bold text-ink">AI Testing</p>
          <p className="text-lg font-bold text-ink">Engineer</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-soft text-brand'
                  : 'text-ink/80 hover:bg-primary-soft/60 hover:text-brand'
              )
            }
          >
            <Icon className="size-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Becomes components/layout/AIAssistantCard.jsx in Phase 9 */}
      <div className="p-3">
        <div className="rounded-2xl border border-line bg-primary-soft/60 p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-brand">AI Assistant</p>
            <Sparkles className="size-5 text-primary" />
          </div>
          <p className="mt-1 text-xs text-muted">Ask about your tests or bugs...</p>
          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card py-2 text-sm font-medium text-brand hover:bg-primary-soft">
            <MessageSquarePlus className="size-4" />
            New Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-card lg:block">
      <SidebarContent />
    </aside>
  );
}