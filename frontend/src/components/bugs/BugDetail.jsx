import { Link } from 'react-router-dom';
import { Code2, Lightbulb, Loader2, Sparkles, Wand2 } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import AuthImage from '../ui/AuthImage';
import ApiResultPanel from '../api-testing/ApiResultPanel';
import FixDiffViewer from './FixDiffViewer';
import { runService } from '../../services/run.service';

function Sub({ icon: Icon, tone = 'text-brand', children }) {
  return (
    <p className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${tone}`}>
      <Icon className="size-3.5" /> {children}
    </p>
  );
}

export default function BugDetail({ bug, canWrite, fixBusy, onSuggestFix }) {
  const job = bug.activeJob;
  const fixing = job?.kind === 'fix';
  const result = bug.result;
  const isApi = !!result?.response?.request;
  const steps = Array.isArray(bug.testCase?.steps) ? bug.testCase.steps : [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <CardTitle>AI analysis</CardTitle>
          </div>
        </CardHeader>

        {!bug.aiExplanation ? (
          <p className="text-sm text-muted">
            {job?.kind === 'analyze'
              ? 'The analysis is running. This page updates on its own.'
              : 'This bug has not been analyzed yet. Use Re-analyze at the top of the page.'}
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Sub icon={Wand2}>What happened</Sub>
              <p className="whitespace-pre-line text-sm text-ink">{bug.aiExplanation}</p>
            </div>
            {bug.recommendedFix && (
              <div>
                <Sub icon={Lightbulb} tone="text-success">
                  Recommended fix
                </Sub>
                <p className="whitespace-pre-line text-sm text-ink">{bug.recommendedFix}</p>
              </div>
            )}
            {bug.confidence != null && (
              <div>
                <p className="mb-1.5 text-xs text-muted">Confidence score</p>
                <div className="flex items-center gap-3">
                  <ProgressBar value={bug.confidence} className="flex-1" trackClassName="flex-1" />
                  <span className="text-xs font-semibold text-ink">{Math.round(bug.confidence)}%</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  The model&apos;s own estimate of how well the evidence supports this explanation. It is
                  not a measured accuracy.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="size-5 text-primary" />
            <CardTitle>Suggested code fix</CardTitle>
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant={bug.fixPatch ? 'secondary' : 'primary'}
              loading={fixBusy}
              disabled={!bug.hasCode || !!job}
              onClick={onSuggestFix}
            >
              {bug.fixPatch ? 'Suggest again' : 'Suggest a code fix'}
            </Button>
          )}
        </CardHeader>

        {fixing && (
          <p className="mb-3 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            {job.state === 'queued' ? 'Waiting for the code model...' : 'The code model is working. On a laptop this can take a few minutes.'}
          </p>
        )}

        {bug.fixPatch ? (
          <FixDiffViewer patch={bug.fixPatch} filename={`${bug.code}.patch`} />
        ) : (
          !fixing && (
            <p className="text-sm text-muted">
              {bug.hasCode
                ? 'The AI reads your indexed source code and proposes a change as a diff you can review.'
                : 'Upload your source code on the project page as a requirement of type "Source code" to enable code fixes.'}
            </p>
          )
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          {bug.run && (
            <Link to={`/execution/${bug.run.id}`} className="text-xs font-medium text-brand hover:underline">
              Open run {bug.run.runCode}
            </Link>
          )}
        </CardHeader>

        {!result ? (
          <p className="text-sm text-muted">The test result for this bug was deleted, so there is no evidence to show.</p>
        ) : (
          <div className="space-y-4">
            {result.errorMessage && (
              <p className="rounded-xl bg-danger-soft p-3 text-sm text-ink">{result.errorMessage}</p>
            )}
            {result.screenshotPath && (
              <AuthImage
                cacheKey={result.id}
                load={() => runService.screenshot(result.id)}
                alt="Screenshot of the page when the test failed"
                className="w-full rounded-xl border border-line"
              />
            )}
            {isApi ? (
              <ApiResultPanel
                showVerdict={false}
                result={{
                  status: result.status,
                  durationMs: result.durationMs,
                  errorMessage: null,
                  logs: result.logs ? result.logs.split('\n') : [],
                  response: result.response,
                }}
              />
            ) : (
              result.logs && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#0f0e1f] p-3 font-mono text-xs text-[#e5e7ff]">
                  {result.logs}
                </pre>
              )
            )}
          </div>
        )}
      </Card>

      {bug.testCase && (
        <Card>
          <CardHeader>
            <CardTitle>Test case</CardTitle>
          </CardHeader>
          <p className="mb-2 text-sm font-medium text-ink">{bug.testCase.title}</p>
          {steps.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink marker:text-muted">
              {steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          {bug.testCase.expectedResult && (
            <p className="mt-3 rounded-xl bg-success-soft p-3 text-sm text-ink">
              <span className="font-semibold">Expected: </span>
              {bug.testCase.expectedResult}
            </p>
          )}
        </Card>
      )}
    </>
  );
}