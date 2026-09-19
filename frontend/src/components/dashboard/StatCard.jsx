import Card from '../ui/Card';
import { cn } from '../../utils/cn';

const tones = {
  primary: 'bg-primary-soft text-brand',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
};

const subTones = {
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-muted',
};

export default function StatCard({ icon: Icon, label, value, sub, subTone = 'muted', note, tone = 'primary' }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', tones[tone])}>
        <Icon className="size-6" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted">{label}</p>
        <p className="text-2xl font-bold leading-tight text-ink">{value}</p>
        {sub && <p className={cn('text-xs font-semibold', subTones[subTone])}>{sub}</p>}
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
    </Card>
  );
}