import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Cloud, Layers, MonitorSmartphone, PlayCircle, ShieldCheck } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import EmptyState from '../ui/EmptyState';
import RunStepper from '../execution/RunStepper';
import { RUN_STAGES } from '../../utils/constants';
import { formatDuration, runSeconds } from '../../utils/formatters';
import { cn } from '../../utils/cn';

const ACTIVE = ['QUEUED', 'RUNNING'];
const DOT = { success: 'bg-success', info: 'bg-info', warning: 'bg-warning', danger: 'bg-danger' };

function MiniStat({ icon: Icon, label, value, status, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-page/60 p-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-brand">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="text-lg font-bold leading-tight text-ink">{value}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <span className={cn('size-1.5 rounded-full', DOT[tone])} />
          {status}
        </p>
      </div>
    </div>
  );
}

function coverageLabel(v) {
  if (v == null) return { text: '—', tone: 'info' };
  if (v >= 80) return { text: 'High', tone: 'success' };
  if (v >= 50) return { text: 'Medium', tone: 'warning' };
  return { text: 'Low', tone: 'danger' };
}

export default function ExecutionProgress({ run }) {
  const active = !!run && ACTIVE.includes(run.status);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!run) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Test Execution Progress</CardTitle>
        </CardHeader>
        <EmptyState
          icon={PlayCircle}
          title="No test runs yet"
          description="Start a run to see live progress here."
          className="border-0 py-8"
        />
      </Card>
    );
  }

  const done = run.status === 'COMPLETED';
  const bad = run.status === 'FAILED' || run.status === 'CANCELLED';
  const percent = done ? 100 : run.progress;
  const cov = coverageLabel(run.coverage);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Test Execution Progress</CardTitle>
          {active && (
            <Badge tone="success" dot>
              Live
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/execution/${run.id}`} className="text-xs font-medium text-brand hover:underline">
            {run.runCode}
          </Link>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3.5" />
            Elapsed Time:{' '}
            <span className="font-semibold text-brand">
              {run.startedAt ? formatDuration(runSeconds(run, now)) : '00:00:00'}
            </span>
          </p>
        </div>
      </CardHeader>

      <RunStepper stageIndex={done ? RUN_STAGES.length : 2} tone={bad ? 'danger' : 'primary'} />

      <div className="mt-5 flex items-center gap-3">
        <ProgressBar
          value={percent}
          tone={run.status === 'FAILED' ? 'danger' : done ? 'success' : 'primary'}
          className="flex-1"
          trackClassName="h-2.5 flex-1"
        />
        <span className="text-sm font-semibold text-ink">{percent}%</span>
      </div>
      {run.errorMsg && !active && <p className="mt-2 text-xs text-danger">{run.errorMsg}</p>}

      <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <MiniStat icon={MonitorSmartphone} label="UI Tests" value={run.ui.total} status={`${run.ui.passed} passed`} tone="success" />
        <MiniStat icon={Cloud} label="API Tests" value={run.api.total} status={`${run.api.passed} passed`} tone="info" />
        <MiniStat icon={Layers} label="Feature areas" value={run.scenarios} status="Covered" tone="warning" />
        <MiniStat
          icon={ShieldCheck}
          label="Coverage"
          value={run.coverage != null ? `${run.coverage}%` : '—'}
          status={cov.text}
          tone={cov.tone}
        />
      </div>
    </Card>
  );
}