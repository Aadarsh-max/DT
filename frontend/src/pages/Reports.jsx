import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, FolderOpen, Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import ReportList from '../components/reports/ReportList';
import ReportPreview from '../components/reports/ReportPreview';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { reportService } from '../services/report.service';
import { runService } from '../services/run.service';
import { getErrorMessage } from '../services/api';
import { formatDateTime } from '../utils/formatters';

function NewReportModal({ open, onClose, projectId, onCreate }) {
  const toast = useToast();
  const [runs, setRuns] = useState(null); // null = loading
  const [runId, setRunId] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRuns(null);
    setTitle('');
    runService
      .list(projectId, { limit: 50 })
      .then((d) => {
        if (cancelled) return;
        const done = d.items.filter(
          (r) => ['COMPLETED', 'CANCELLED'].includes(r.status) && r.passed + r.failed + r.skipped > 0
        );
        setRuns(done);
        setRunId(done[0]?.id ?? '');
      })
      .catch(() => !cancelled && setRuns([]));
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  async function submit() {
    setBusy(true);
    try {
      await onCreate(runId, title.trim());
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create the report'));
    } finally {
      setBusy(false);
    }
  }

  const options = (runs ?? []).map((r) => ({
    value: r.id,
    label: `${r.runCode} · ${formatDateTime(r.startedAt ?? r.createdAt)} · ${r.passed} passed, ${r.failed} failed`,
  }));

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="New report">
      <div className="space-y-4">
        {runs === null ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="size-3.5" /> Loading runs...
          </div>
        ) : runs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
            No finished runs with results yet. Run your tests first.
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Test run</label>
              <Select className="h-10" options={options} value={runId} onChange={(e) => setRunId(e.target.value)} />
            </div>
            <Input
              label="Title (optional)"
              placeholder="e.g. Sprint 12 regression report"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button icon={FileText} loading={busy} disabled={!runId} onClick={submit}>
            Generate report
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function Reports() {
  const toast = useToast();
  const { user } = useAuth();
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const canWrite = user?.role !== 'VIEWER';

  const [params, setParams] = useSearchParams();
  const activeId = params.get('id');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');

  const loadList = useCallback(async () => {
    if (!projectId) return;
    try {
      setData(await reportService.list(projectId, { limit: 50 }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load reports'));
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  const loadDetail = useCallback(async () => {
    if (!activeId) return;
    try {
      setDetail(await reportService.get(activeId));
      setMissing(false);
    } catch (err) {
      if ([403, 404].includes(err.response?.status)) setMissing(true);
    }
  }, [activeId]);

  useEffect(() => {
    setData(null);
    setLoading(true);
  }, [projectId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    setDetail(null);
    setMissing(false);
    if (!activeId) return;
    setDetailLoading(true);
    loadDetail().finally(() => setDetailLoading(false));
  }, [activeId, loadDetail]);

  // A shared link may point at a project that is not selected yet
  useEffect(() => {
    if (detail?.projectId && detail.projectId !== projectId) setCurrent(detail.projectId);
  }, [detail?.projectId, projectId, setCurrent]);

  const listGenerating = data?.items.some((r) => r.status === 'GENERATING');
  const detailGenerating = detail?.status === 'GENERATING';
  useEffect(() => {
    if (!listGenerating && !detailGenerating) return;
    const id = setInterval(() => {
      loadList();
      if (detailGenerating) loadDetail();
    }, 3000);
    return () => clearInterval(id);
  }, [listGenerating, detailGenerating, loadList, loadDetail]);

  async function createFor(runId, title) {
    const report = await reportService.create(projectId, { runId, title: title || undefined });
    setParams({ id: report.id });
    toast.info('Generating the report...');
    await loadList();
  }

  async function onDownload() {
    setBusy('download');
    try {
      await reportService.download(detail);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not download the PDF'));
    } finally {
      setBusy('');
    }
  }

  async function onRetry() {
    if (!detail.runId) return toast.error('The run for this report no longer exists.');
    setBusy('retry');
    try {
      await createFor(detail.runId, detail.title);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete "${detail.title}"?`)) return;
    setBusy('delete');
    try {
      await reportService.remove(detail.id);
      toast.success('Report deleted');
      setParams({}, { replace: true });
      await loadList();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={FileText}
          title="No project selected"
          description="Create a project and run tests to generate reports."
          action={
            <Link to="/projects">
              <Button>Go to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const items = data?.items ?? [];
  const showDetail = !!activeId;
  const newBtn = canWrite && (
    <Button icon={Plus} onClick={() => setOpen(true)}>
      New report
    </Button>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Reports</h1>
          <p className="text-sm text-muted">AI-written test reports you can download as PDF and share with stakeholders.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            icon={FolderOpen}
            options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
            value={current.id}
            onChange={(e) => {
              setCurrent(e.target.value);
              setParams({}, { replace: true });
            }}
            wrapperClassName="sm:w-72"
          />
          {newBtn}
        </div>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : items.length === 0 && !showDetail ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Pick a finished test run and generate a report with a summary, findings, risks and recommendations."
          action={newBtn || undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
          <Card className={showDetail ? 'hidden xl:block' : ''}>
            <ReportList
              items={items}
              activeId={activeId}
              onSelect={(r) => setParams({ id: r.id })}
            />
          </Card>

          <div className={`xl:col-span-2 ${showDetail ? '' : 'hidden xl:block'}`}>
            {!activeId ? (
              <EmptyState icon={FileText} title="Select a report" description="Choose a report on the left to preview it." />
            ) : detailLoading && !detail ? (
              <div className="grid place-items-center py-20 text-brand">
                <Spinner className="size-8" />
              </div>
            ) : missing || !detail ? (
              <EmptyState
                icon={FileText}
                title="Report not found"
                description="It may have been deleted, or you don't have access to it."
                action={
                  <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                    Back to reports
                  </Button>
                }
              />
            ) : (
              <ReportPreview
                report={detail}
                canWrite={canWrite}
                busy={busy}
                onDownload={onDownload}
                onDelete={onDelete}
                onRetry={onRetry}
                onBack={() => setParams({}, { replace: true })}
              />
            )}
          </div>
        </div>
      )}

      <NewReportModal open={open} onClose={() => setOpen(false)} projectId={projectId} onCreate={createFor} />
    </div>
  );
}