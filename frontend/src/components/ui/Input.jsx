import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

const Input = forwardRef(function Input(
  { label, icon: Icon, error, className, wrapperClassName, id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink',
            'placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20',
            Icon && 'pl-9',
            error && 'border-danger',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});

export default Input;