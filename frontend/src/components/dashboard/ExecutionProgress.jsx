import { Check, Clock, Cloud, Layers, MonitorSmartphone, Play, ShieldCheck } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { cn } from '../../utils/cn';

function Step({ label, state }) {
  return (
    <div className="flex min-w-[84px] flex-1 flex-col items-center gap-2 text-center">
      <div
        className={cn(
          'grid size-8 place-items-center rounded-full border-2',
          state === 'done' && 'border-success bg-success text-white',
          state === 'active' && 'border-primary bg-primary text-white',
          state === 'pending' && 'border-dashed border-muted/50 bg-card text-muted'
        )}
      >
        {state === 'done' ? <Check className="size-4" /> : <Play className="size-3.5" />}
      </div>
      <span className="text-xs font-medium leading-tight text-ink">{label}</span>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, status, tone }) {
  const dot = { success: 'bg-success', info: 'bg-info', warning: 'bg-warning' }[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-page/60 p-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-brand">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="text-lg font-bold leading-tight text-ink">{value}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className={cn('size-1.5 rounded-full', dot)} />
          {status}
        </p>
      </div>
    </div>
  );
}

export default function ExecutionProgress({ run }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Test Execution Progress</CardTitle>
          <Badge tone="success" dot>
            Live
          </Badge>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Clock className="size-3.5" />
          Elapsed Time: <span className="font-semibold text-brand">{run.elapsed}</span>
        </p>
      </CardHeader>

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[460px] items-start">
          {run.stages.map((label, i) => (
            <Step
              key={label}
              label={label}
              state={i < run.stageIndex ? 'done' : i === run.stageIndex ? 'active' : 'pending'}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <ProgressBar value={run.progress} className="flex-1" trackClassName="h-2.5 flex-1" />
        <span className="text-sm font-semibold text-ink">{run.progress}%</span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <MiniStat icon={MonitorSmartphone} label="UI Tests" value={run.ui} status="Passed" tone="success" />
        <MiniStat icon={Cloud} label="API Tests" value={run.api} status="Executed" tone="info" />
        <MiniStat icon={Layers} label="Scenarios" value={run.scenarios} status="Running" tone="warning" />
        <MiniStat icon={ShieldCheck} label="Coverage" value={`${run.coverage}%`} status="High" tone="success" />
      </div>
    </Card>
  );
}