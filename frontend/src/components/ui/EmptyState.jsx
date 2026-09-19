import { cn } from '../../utils/cn';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card px-6 py-14 text-center',
        className
      )}
    >
      {Icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-brand">
          <Icon className="size-7" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}