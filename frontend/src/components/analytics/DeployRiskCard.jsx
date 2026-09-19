import { useEffect, useState } from 'react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import DeployRiskGauge from './DeployRiskGauge';
import { analyticsService } from '../../services/analytics.service';

const CONFIDENCE = {
  low: { label: 'Low confidence', tone: 'warning' },
  medium: { label: 'Medium confidence', tone: 'info' },
  high: { label: 'High confidence', tone: 'success' },
  none: { label: 'No data', tone: 'neutral' },
};

export default function DeployRiskCard({ runId }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setState('loading');
    analyticsService
      .risk(runId)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState('ok');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (!runId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deployment failure risk</CardTitle>
        <Badge>Heuristic estimate</Badge>
      </CardHeader>

      {state === 'loading' ? (
        <div className="grid place-items-center py-10 text-brand">
          <Spinner className="size-6" />
        </div>
      ) : state === 'error' ? (
        <p className="text-sm text-muted">Could not estimate the risk. Check that the AI engine is running.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[15rem_1fr]">
          <div className="space-y-3 text-center">
            <DeployRiskGauge value={data.probability} level={data.level} label={data.label} />
            <Badge tone={CONFIDENCE[data.confidence]?.tone}>{CONFIDENCE[data.confidence]?.label}</Badge>
            <p className="text-xs text-muted">Based on {data.runCode}</p>
          </div>

          <div className="space-y-4">
            {data.notes.length > 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-ink">
                {data.notes.map((n, i) => (
                  <p key={i}>{n}</p>
                ))}
              </div>
            )}

            {data.factors.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">What raises the risk</p>
                <ul className="divide-y divide-line">
                  {data.factors.map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{f.label}</p>
                        <p className="text-xs text-muted">{f.detail}</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-danger">+{f.points} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.positives.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">In your favour</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink marker:text-success">
                  {data.positives.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted">
              A rule-based estimate from this run&apos;s results and your open bugs. It has not been checked
              against real production outcomes, so use it to compare builds, not as a release decision.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}