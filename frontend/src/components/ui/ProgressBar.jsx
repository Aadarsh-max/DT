import { cn } from '../../utils/cn';

const tones = {
  primary: 'bg-primary',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
};

export default function ProgressBar({ value = 0, tone = 'primary', className, trackClassName }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-primary-soft', trackClassName)}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500', tones[tone], className)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}