import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Select({ options = [], icon: Icon, className, wrapperClassName, ...props }) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand" />
      )}
      <select
        className={cn(
          'h-11 w-full cursor-pointer appearance-none rounded-xl border border-line bg-card pr-9 text-sm font-medium text-ink',
          'focus:border-primary focus:outline-2 focus:outline-primary/20',
          Icon ? 'pl-9' : 'pl-3',
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}