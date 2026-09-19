import { cn } from '../../utils/cn';

export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl bg-primary-soft p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.value ? 'bg-card text-brand shadow-sm' : 'text-muted hover:text-ink'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}