import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Share2 } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import { reportService } from '../../services/report.service';
import { getErrorMessage } from '../../services/api';
import { formatNumber, formatPercent } from '../../utils/formatters';

const R = 70;
const C = 2 * Math.PI * R;

export default function ReportSummaryDonut({ summary, runId, projectId }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');

  const total = summary.passed + summary.failed + summary.skipped;
  const passRate = total ? (summary.passed / total) * 100 : 0;

  const segments = [
    { key: 'passed', label: 'Passed', value: summary.passed, color: 'var(--color-success)' },
    { key: 'failed', label: 'Failed', value: summary.failed, color: 'var(--color-danger)' },
    { key: 'skipped', label: 'Skipped', value: summary.skipped, color: 'var(--color-warning)' },
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const len = total ? (s.value / total) * C : 0;
    const arc = { ...s, len, offset };
    offset += len;
    return arc;
  });

  async function latestReport() {
    const { items } = await reportService.list(projectId, { runId, limit: 1 });
    return items[0] ?? null;
  }

  async function onDownload() {
    if (!runId) return toast.info('Run your tests first');
    setBusy('download');
    try {
      const existing = await latestReport();
      if (existing?.status === 'READY') {
        await reportService.download(existing);
      } else if (existing?.status === 'GENERATING') {
        navigate(`/reports?id=${existing.id}`);
      } else {
        const report = await reportService.create(projectId, { runId });
        toast.info('Generating your report...');
        navigate(`/reports?id=${report.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create the report'));
    } finally {
      setBusy('');
    }
  }

  async function onShare() {
    if (!runId) return toast.info('Run your tests first');
    setBusy('share');
    try {
      const existing = await latestReport();
      if (!existing) {
        toast.info('Create the report first with Download PDF Report');
        return;
      }
      await navigator.clipboard.writeText(`${window.location.origin}/reports?id=${existing.id}`);
      toast.success('Link copied. Teammates need access to this project to open it.');
    } catch {
      toast.error('Could not copy the link');
    } finally {
      setBusy('');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Report Summary</CardTitle>
        <span className="rounded-lg border border-line px-2 py-1 text-xs text-muted">This Run</span>
      </CardHeader>

      <div className="flex flex-col items-center gap-4 min-[480px]:flex-row min-[480px]:justify-around">
        <div className="relative size-44 shrink-0">
          <svg viewBox="0 0 180 180" className="size-full -rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="var(--line)" strokeWidth="22" />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth="22"
                strokeDasharray={`${a.len} ${C - a.len}`}
                strokeDashoffset={-a.offset}
              />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-content-center text-center">
            <p className="text-2xl font-bold text-ink">{formatPercent(passRate)}</p>
            <p className="text-xs text-muted">Pass Rate</p>
          </div>
        </div>

        <ul className="w-full space-y-2.5 text-sm min-[480px]:w-auto">
          {arcs.map((a) => (
            <li key={a.key} className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-ink">
                <span className="size-2.5 rounded-full" style={{ background: a.color }} />
                {a.label}
              </span>
              <span className="text-muted">
                {formatNumber(a.value)} ({formatPercent(total ? (a.value / total) * 100 : 0)})
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
        <Button variant="secondary" icon={Download} loading={busy === 'download'} disabled={!runId} onClick={onDownload}>
          Download PDF Report
        </Button>
        <Button icon={Share2} loading={busy === 'share'} disabled={!runId} onClick={onShare}>
          Share Report
        </Button>
      </div>
    </Card>
  );
}