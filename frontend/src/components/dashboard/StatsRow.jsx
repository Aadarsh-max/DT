import { Bug, CheckCircle2, ClipboardCheck, Play, XCircle } from 'lucide-react';
import StatCard from './StatCard';
import { formatNumber, formatPercent } from '../../utils/formatters';

export default function StatsRow({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <StatCard
        icon={ClipboardCheck}
        label="Total Test Cases"
        value={formatNumber(stats.totalCases)}
        note="in this project"
      />
      <StatCard
        icon={Play}
        tone="info"
        label="Executed"
        value={formatNumber(stats.executed)}
        sub={formatPercent(stats.executedPct)}
        subTone="success"
        note="of total"
      />
      <StatCard
        icon={CheckCircle2}
        tone="success"
        label="Passed"
        value={formatNumber(stats.passed)}
        sub={formatPercent(stats.passedPct)}
        subTone="success"
      />
      <StatCard
        icon={XCircle}
        tone="danger"
        label="Failed"
        value={formatNumber(stats.failed)}
        sub={formatPercent(stats.failedPct)}
        subTone="danger"
      />
      <StatCard icon={Bug} tone="danger" label="Bugs Found" value={formatNumber(stats.bugs)} note="This run" />
    </div>
  );
}