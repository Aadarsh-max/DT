import { NavLink } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constants';
import { cn } from '../../utils/cn';
import AIAssistantCard from './AIAssistantCard';

export function SidebarContent({ onNavigate, onOpenChat }) {
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

      <AIAssistantCard
        onOpen={() => {
          onNavigate?.();
          onOpenChat?.();
        }}
      />
    </div>
  );
}

export default function Sidebar({ onOpenChat }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-card lg:block">
      <SidebarContent onOpenChat={onOpenChat} />
    </aside>
  );
}