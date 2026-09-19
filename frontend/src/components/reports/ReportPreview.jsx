import { AlertTriangle, ArrowLeft, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import SeverityBadge from '../bugs/SeverityBadge';
import ModuleHealthChart from '../analytics/ModuleHealthChart';
import {
  HEALTH_TONE,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  RESULT_STATUS_LABEL,
  RESULT_STATUS_TONE,
  TEST_TYPE_LABEL,
} from '../../utils/constants';
import { formatDateTime, formatPercent } from '../../utils/formatters';

const pct = (v) => (v == null ? '—' : formatPercent(v));

function Tile({ label, value, note }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold leading-tight text-ink">{value}</p>
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </div>
  );
}

function Bullets({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink marker:text-muted">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

export default function ReportPreview({ report, canWrite, busy, onDownload, onDelete, onRetry, onBack }) {
  const c = report.content;
  const facts = c?.facts;
  const run = facts?.run;
  const bugs = facts?.bugs;
  const failures = facts?.failures ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand xl:hidden"
        >
          <ArrowLeft className="size-4" /> All reports
        </button>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-ink sm:text-xl">{report.title}</h2>
              <Badge tone={REPORT_STATUS_TONE[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Badge>
              {c?.health && <Badge tone={HEALTH_TONE[c.health.level]}>{c.health.label}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted">
              {[report.run?.runCode, formatDateTime(report.createdAt)].filter(Boolean).join(' · ')}
            </p>
            {c?.health?.reasons?.length > 0 && <p className="mt-1 text-sm text-muted">{c.health.reasons.join(' ')}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {report.status === 'READY' && (
              <Button icon={Download} loading={busy === 'download'} onClick={onDownload}>
                Download PDF
              </Button>
            )}
            {canWrite && report.status === 'FAILED' && (
              <Button variant="secondary" icon={RefreshCw} loading={busy === 'retry'} onClick={onRetry}>
                Try again
              </Button>
            )}
            {canWrite && report.status !== 'GENERATING' && (
              <Button variant="secondary" icon={Trash2} className="text-danger" loading={busy === 'delete'} onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>
      </Card>

      {report.status === 'GENERATING' && (
        <Card>
          <p className="flex items-center gap-2.5 text-sm text-ink">
            <Loader2 className="size-4 animate-spin text-primary" />
            Writing the report and building the PDF. This usually takes under a minute, and the page updates on its own.
          </p>
        </Card>
      )}

      {report.status === 'FAILED' && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span>{report.errorMsg || 'The report could not be generated.'}</span>
        </div>
      )}

      {report.status === 'READY' && c && run && (
        <>
          {c.caveats?.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning-soft p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
                <AlertTriangle className="size-4 text-warning" /> Read this first
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
                {c.caveats.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {c.warnings?.length > 0 && (
            <p className="rounded-xl bg-primary-soft p-3 text-xs text-muted">{c.warnings.join(' ')}</p>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Pass rate" value={pct(run.passRate)} note={facts.previous ? `previous ${pct(facts.previous.passRate)}` : null} />
            <Tile label="Executed" value={run.executed} note={`of ${run.total} planned`} />
            <Tile label="Passed" value={run.passed} />
            <Tile label="Failed" value={run.failed} />
            <Tile label="Errors" value={run.errors} note="could not run" />
            <Tile label="Skipped" value={run.skipped} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Executive summary</CardTitle>
              <Badge>{c.aiWritten ? 'AI-written' : 'Rule-based'}</Badge>
            </CardHeader>
            <p className="text-sm text-ink">{c.sections.executiveSummary}</p>
            <div className="mt-5 space-y-5">
              <Bullets title="Key findings" items={c.sections.keyFindings} />
              <Bullets title="Risks" items={c.sections.risks} />
              <Bullets title="Recommendations" items={c.sections.recommendations} />
            </div>
            {c.aiWritten && (
              <p className="mt-4 text-xs text-muted">
                Written by {c.model} from the figures in this report. Review it before sharing.
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By test type</CardTitle>
              </CardHeader>
              <ModuleHealthChart
                rows={(facts.byType ?? []).map((t) => ({ ...t, name: TEST_TYPE_LABEL[t.name] ?? t.name }))}
              />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Feature area health</CardTitle>
              </CardHeader>
              <ModuleHealthChart rows={facts.byModule ?? []} />
            </Card>
          </div>

          {bugs?.total > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Bugs found ({bugs.total})</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-line">
                {bugs.items.map((b) => (
                  <li key={b.code} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-sm text-ink" title={b.title}>
                      <span className="mr-2 text-xs font-semibold text-brand">{b.code}</span>
                      {b.title}
                    </span>
                    <SeverityBadge severity={b.severity} />
                  </li>
                ))}
              </ul>
              {bugs.total > bugs.items.length && (
                <p className="mt-2 text-xs text-muted">and {bugs.total - bugs.items.length} more in Bug Reports.</p>
              )}
            </Card>
          )}

          {failures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Failed and errored tests</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-line">
                {failures.map((f, i) => (
                  <li key={i} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-ink" title={f.title}>
                        {f.title}
                      </span>
                      <Badge tone={RESULT_STATUS_TONE[f.status]}>{RESULT_STATUS_LABEL[f.status]}</Badge>
                    </div>
                    {f.message && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{f.message}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}