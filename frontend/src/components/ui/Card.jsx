import { cn } from '../../utils/cn';

export default function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-2', className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }) {
  return <h3 className={cn('text-base font-semibold text-ink', className)}>{children}</h3>;
}