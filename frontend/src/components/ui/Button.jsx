import { cn } from '../../utils/cn';
import Spinner from './Spinner';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  secondary: 'bg-card text-brand border border-line hover:bg-primary-soft',
  ghost: 'text-muted hover:bg-primary-soft hover:text-brand',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : Icon ? <Icon className="size-4 shrink-0" /> : null}
      {children}
    </button>
  );
}