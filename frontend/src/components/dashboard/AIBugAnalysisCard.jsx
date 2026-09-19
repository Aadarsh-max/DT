import { Bug, Lightbulb, Sparkles, Wand2 } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';

const severityTone = { Critical: 'danger', High: 'danger', Medium: 'warning', Low: 'info' };

export default function AIBugAnalysisCard({ bug }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <CardTitle>AI Bug Analysis</CardTitle>
        </div>
        <a href="/bugs" className="text-xs font-medium text-brand hover:underline">
          View All
        </a>
      </CardHeader>

      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center gap-2">
          <Bug className="size-4 text-danger" />
          <span className="text-xs font-semibold text-ink">{bug.code}</span>
          <Badge tone={severityTone[bug.severity]}>{bug.severity}</Badge>
        </div>
        <p className="mt-2 text-base font-semibold text-ink">{bug.title}</p>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 space-y-3 text-xs">
            <div>
              <p className="flex items-center gap-1.5 font-semibold text-brand">
                <Wand2 className="size-3.5" /> AI Explanation:
              </p>
              <p className="mt-1 text-muted">{bug.explanation}</p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 font-semibold text-ink">
                <Lightbulb className="size-3.5 text-success" /> Recommended Fix:
              </p>
              <p className="mt-1 text-muted">{bug.fix}</p>
            </div>
          </div>

          {/* Mock screenshot thumbnail */}
          <div className="hidden w-32 shrink-0 rounded-lg border border-line bg-page p-2 min-[480px]:block">
            <div className="mb-1.5 flex gap-1">
              <span className="size-1.5 rounded-full bg-danger" />
              <span className="size-1.5 rounded-full bg-warning" />
              <span className="size-1.5 rounded-full bg-success" />
            </div>
            <div className="mb-1 h-1.5 w-3/4 rounded bg-line" />
            <div className="mb-2 h-1.5 w-1/2 rounded bg-line" />
            <div className="rounded border border-dashed border-danger p-0.5">
              <div className="h-3.5 rounded bg-primary" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs text-muted">Confidence Score</p>
          <div className="flex items-center gap-3">
            <ProgressBar value={bug.confidence} className="flex-1" trackClassName="flex-1" />
            <span className="text-xs font-semibold text-ink">{bug.confidence}%</span>
          </div>
        </div>
      </div>
    </Card>
  );
}