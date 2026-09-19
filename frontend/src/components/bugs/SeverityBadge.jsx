import Badge from '../ui/Badge';
import { SEVERITY_LABEL, SEVERITY_TONE } from '../../utils/constants';
import { cn } from '../../utils/cn';

export default function SeverityBadge({ severity, className }) {
  return (
    <Badge
      tone={SEVERITY_TONE[severity] ?? 'neutral'}
      className={cn(severity === 'CRITICAL' && 'bg-danger text-white', className)}
    >
      {SEVERITY_LABEL[severity] ?? severity}
    </Badge>
  );
}