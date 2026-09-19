import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Bug, FolderOpen, Gauge, PlayCircle, TrendingUp } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import StatCard from '../components/dashboard/StatCard';
import TrendChart from '../components/analytics/TrendChart';
import SeverityChart from '../components/analytics/SeverityChart';
import ModuleHealthChart from '../components/analytics/ModuleHealthChart';
import { useProject } from '../hooks/useProject';
import { analyticsService } from '../services/analytics.service';
import { ANALYTICS_RANGES, TEST_TYPE_LABEL, TEST_TYPE_TONE } from '../utils/constants';
import { formatDuration } from '../utils/formatters';

const pct = (v) => (v == null ? '—' : `${v}%`);

export default function Analytics() {
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    analyticsService
      .get(projectId, { days })
      .then((d) => !cancelled && setData(d))
      .catch(() => {
        if (cancelled) return;
        setData(null);
        setFailed(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, days]);

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={BarChart3}
          title="No project selected"
          description="Create a project and run tests to see analytics."
          action={
            <Link to="/projects">
              <Button>Go to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const k = data?.kpis;
  const deltaText =
    k?.delta != null ? `${k.delta >= 0 ? '+' : ''}${k.delta} pts vs previous run` : undefined;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Analytics</h1>
          <p className="text-sm text-muted">Pass rate trends, bug severity and feature area health across your runs.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            icon={FolderOpen}
            options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
            value={current.id}
            onChange={(e) => setCurrent(e.target.value)}
            wrapperClassName="sm:w-72"
          />
          <Select
            className="h-11"
            options={ANALYTICS_RANGES}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            wrapperClassName="sm:w-44"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : failed ? (
        <EmptyState icon={BarChart3} title="Could not load analytics" description="Check that the backend is running, then try again." />
      ) : !data || k.runs === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No finished runs in this period"
          description="Run your tests, or choose a longer time range."
          action={
            <Link to="/execution">
              <Button variant="secondary">Go to test execution</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              tone="success"
              label="Latest pass rate"
              value={pct(k.latestPassRate)}
              sub={deltaText}
              subTone={k.delta != null && k.delta < 0 ? 'danger' : 'success'}
            />
            <StatCard icon={Gauge} label="Average pass rate" value={pct(k.avgPassRate)} note="across all runs shown" />
            <StatCard
              icon={PlayCircle}
              tone="info"
              label="Runs analysed"
              value={k.runs}
              note={k.avgDurationSec != null ? `avg ${formatDuration(k.avgDurationSec)}` : undefined}
            />
            <StatCard icon={Bug} tone="danger" label="Open bugs" value={k.openBugs} note={`${k.totalBugs} found in this period`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pass rate per run</CardTitle>
              {data.range.runs >= data.range.maxRuns && <Badge>Latest {data.range.maxRuns} runs</Badge>}
            </CardHeader>
            <TrendChart points={data.trend} />
            <p className="mt-2 text-xs text-muted">
              Pass rate = passed ÷ (passed + failed + error). Skipped tests are excluded. Hover a point for details.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Bug severity</CardTitle>
              </CardHeader>
              <SeverityChart counts={data.bugs.bySeverity} unanalyzed={data.bugs.unanalyzed} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By test type</CardTitle>
              </CardHeader>
              <ModuleHealthChart
                rows={data.byType.map((t) => ({ ...t, name: TEST_TYPE_LABEL[t.name] ?? t.name }))}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Feature area health</CardTitle>
              </CardHeader>
              <ModuleHealthChart rows={data.byModule} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Most failing tests</CardTitle>
              </CardHeader>
              {data.topFailing.length === 0 ? (
                <p className="text-sm text-muted">No test failed in this period.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.topFailing.map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink" title={t.title}>
                          {t.title}
                        </p>
                        <p className="text-xs text-muted">
                          failed or errored in {t.failures} of {t.runs} run{t.runs === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Badge tone={TEST_TYPE_TONE[t.type]}>{TEST_TYPE_LABEL[t.type]}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}