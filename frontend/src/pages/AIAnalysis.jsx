import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug, Copy, FolderOpen, Gauge, Sparkles, Timer } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import StatCard from '../components/dashboard/StatCard';
import SeverityBadge from '../components/bugs/SeverityBadge';
import { useProject } from '../hooks/useProject';
import { bugService } from '../services/bug.service';
import {
  BUG_STATUS_LABEL,
  SEVERITY_LABEL,
} from '../utils/constants';

const SEV_BAR = { CRITICAL: 'bg-danger', HIGH: 'bg-danger/70', MEDIUM: 'bg-warning', LOW: 'bg-info' };

function Bars({ rows, colorFor }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-ink">{r.label}</span>
            <span className="font-semibold text-ink">{r.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-primary-soft">
            <div
              className={`h-full rounded-full ${colorFor?.(r.key) ?? 'bg-primary'}`}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AIAnalysis() {
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    bugService
      .insights(projectId)
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={Sparkles}
          title="No project selected"
          description="Create a project and run tests to see AI analysis here."
          action={
            <Link to="/projects">
              <Button>Go to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const engine = data?.engine;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">AI Analysis</h1>
          <p className="text-sm text-muted">Where your bugs are, how severe they are, and what to fix first.</p>
        </div>
        <Select
          icon={FolderOpen}
          options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
          value={current.id}
          onChange={(e) => setCurrent(e.target.value)}
          wrapperClassName="sm:w-72"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : !data || data.total === 0 ? (
        <EmptyState
          icon={Bug}
          title="No bugs to analyze yet"
          description="Run your tests. Each failed test becomes a bug that is analyzed here."
          action={
            <Link to="/bugs">
              <Button variant="secondary">Go to bug reports</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Bug} tone="danger" label="Total bugs" value={data.total} note={`${data.analyzed} analyzed`} />
            <StatCard
              icon={Gauge}
              label="Avg. AI confidence"
              value={data.avgConfidence != null ? `${data.avgConfidence}%` : '—'}
              note="model self-estimate"
            />
            <StatCard
              icon={Copy}
              tone="info"
              label="Duplicates"
              value={data.duplicates.possible + data.duplicates.confirmed}
              note={`${data.duplicates.possible} to review`}
            />
            <StatCard icon={Timer} tone="success" label="Waiting for analysis" value={data.pending} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Severity</CardTitle>
                {engine && <Badge>{engine.severity_source === 'xgboost' ? 'XGBoost model' : 'Rule-based'}</Badge>}
              </CardHeader>
              <Bars
                rows={['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((k) => ({
                  key: k,
                  label: SEVERITY_LABEL[k],
                  value: data.bySeverity[k] ?? 0,
                }))}
                colorFor={(k) => SEV_BAR[k]}
              />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <Bars
                rows={Object.keys(BUG_STATUS_LABEL).map((k) => ({
                  key: k,
                  label: BUG_STATUS_LABEL[k],
                  value: data.byStatus[k] ?? 0,
                }))}
              />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature area hotspots</CardTitle>
              </CardHeader>
              {data.byModule.length === 0 ? (
                <p className="text-sm text-muted">No feature areas recorded.</p>
              ) : (
                <Bars rows={data.byModule.map((m) => ({ key: m.module, label: m.module, value: m.count }))} />
              )}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fix these first</CardTitle>
              <Link to="/bugs" className="text-xs font-medium text-brand hover:underline">
                View all bugs
              </Link>
            </CardHeader>
            {data.topRisk.length === 0 ? (
              <p className="text-sm text-muted">No open bugs.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.topRisk.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`/bugs/${b.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:text-brand"
                    >
                      <span className="min-w-0 truncate text-sm font-medium text-ink">
                        <span className="mr-2 text-xs font-semibold text-brand">{b.code}</span>
                        {b.title}
                      </span>
                      <SeverityBadge severity={b.severity} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}