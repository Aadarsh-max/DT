import { Link } from 'react-router-dom';
import { Bug, Lightbulb, Sparkles, Wand2 } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import AuthImage from '../ui/AuthImage';
import SeverityBadge from '../bugs/SeverityBadge';
import { runService } from '../../services/run.service';

export default function AIBugAnalysisCard({ bug }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <CardTitle>AI Bug Analysis</CardTitle>
        </div>
        <Link to="/bugs" className="text-xs font-medium text-brand hover:underline">
          View All
        </Link>
      </CardHeader>

      {!bug ? (
        <p className="py-8 text-center text-sm text-muted">
          No analyzed bugs yet. Failed tests are analyzed automatically after a run.
        </p>
      ) : (
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-center gap-2">
            <Bug className="size-4 text-danger" />
            <span className="text-xs font-semibold text-ink">{bug.code}</span>
            <SeverityBadge severity={bug.severity} />
          </div>
          <Link to={`/bugs/${bug.id}`} className="mt-2 block text-base font-semibold text-ink hover:text-brand">
            {bug.title}
          </Link>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-3 text-xs">
              <div>
                <p className="flex items-center gap-1.5 font-semibold text-brand">
                  <Wand2 className="size-3.5" /> AI Explanation:
                </p>
                <p className="mt-1 line-clamp-4 text-muted">{bug.explanation}</p>
              </div>
              {bug.recommendedFix && (
                <div>
                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                    <Lightbulb className="size-3.5 text-success" /> Recommended Fix:
                  </p>
                  <p className="mt-1 line-clamp-3 text-muted">{bug.recommendedFix}</p>
                </div>
              )}
            </div>

            {bug.hasScreenshot && bug.testResultId && (
              <div className="hidden w-32 shrink-0 min-[480px]:block">
                <AuthImage
                  cacheKey={bug.testResultId}
                  load={() => runService.screenshot(bug.testResultId)}
                  alt="Screenshot of the failure"
                  className="w-full rounded-lg border border-line"
                />
              </div>
            )}
          </div>

          {bug.confidence != null && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs text-muted">Confidence Score</p>
              <div className="flex items-center gap-3">
                <ProgressBar value={bug.confidence} className="flex-1" trackClassName="flex-1" />
                <span className="text-xs font-semibold text-ink">{Math.round(bug.confidence)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}