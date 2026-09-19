import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, SearchX, Trash2 } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import SeverityBadge from '../components/bugs/SeverityBadge';
import DuplicateBanner from '../components/bugs/DuplicateBanner';
import BugDetail from '../components/bugs/BugDetail';
import { useAuth } from '../hooks/useAuth';
import { bugService } from '../services/bug.service';
import { getErrorMessage } from '../services/api';
import {
  BUG_STATUS_LABEL,
  BUG_STATUS_OPTIONS,
  BUG_STATUS_TONE,
  SEVERITY_OPTIONS,
} from '../utils/constants';
import { formatDateTime } from '../utils/formatters';

export default function BugDetailPage() {
  const { bugId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = user?.role !== 'VIEWER';

  const [bug, setBug] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setBug(await bugService.get(bugId));
    } catch (err) {
      if ([403, 404].includes(err.response?.status)) setNotFound(true);
    }
  }, [bugId]);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    load().finally(() => setLoading(false));
  }, [load]);

  // Poll while an AI job is queued or running
  const running = !!bug?.activeJob;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [running, load]);

  async function run(name, fn, okMessage) {
    setBusy(name);
    try {
      await fn();
      if (okMessage) toast.info(okMessage);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function patch(payload) {
    setBusy('patch');
    try {
      setBug(await bugService.update(bugId, payload));
      toast.success('Bug updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function duplicateAction(fn) {
    setBusy('dup');
    try {
      setBug(await fn(bugId));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete ${bug.code}?`)) return;
    setBusy('delete');
    try {
      await bugService.remove(bugId);
      toast.success('Bug deleted');
      navigate('/bugs', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-brand">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (notFound || !bug) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={SearchX}
          title="Bug not found"
          description="It may have been deleted, or you don't have access to it."
          action={
            <Link to="/bugs">
              <Button>Back to bugs</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const job = bug.activeJob;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link to="/bugs" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand">
        <ArrowLeft className="size-4" /> All bugs
      </Link>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-brand">{bug.code}</span>
              {bug.aiExplanation && <SeverityBadge severity={bug.severity} />}
              <Badge tone={BUG_STATUS_TONE[bug.status]}>{BUG_STATUS_LABEL[bug.status]}</Badge>
            </div>
            <h1 className="mt-1.5 text-xl font-bold text-ink sm:text-2xl">{bug.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {[bug.module, bug.run?.runCode, formatDateTime(bug.createdAt)].filter(Boolean).join(' · ')}
            </p>
          </div>
          {canWrite && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                icon={RefreshCw}
                loading={busy === 'analyze'}
                disabled={!!job}
                onClick={() => run('analyze', () => bugService.analyze(bugId), 'Analysis queued')}
              >
                Re-analyze
              </Button>
              <Button variant="secondary" icon={Trash2} className="text-danger" loading={busy === 'delete'} onClick={onDelete}>
                Delete
              </Button>
            </div>
          )}
        </div>
      </Card>

      {job && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-primary-soft/60 p-3 text-sm text-ink">
          <Loader2 className="size-4 animate-spin text-primary" />
          {job.kind === 'fix' ? 'Generating a code fix...' : 'Analyzing this bug...'}
          <span className="text-muted">This page updates on its own.</span>
        </div>
      )}

      {bug.jobError && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span>
            {bug.jobError.kind === 'fix' ? 'The code fix failed: ' : 'The analysis had a problem: '}
            {bug.jobError.message}
          </span>
        </div>
      )}

      <DuplicateBanner
        bug={bug}
        canWrite={canWrite}
        busy={busy === 'dup'}
        onConfirm={() => duplicateAction(bugService.confirmDuplicate)}
        onDismiss={() => duplicateAction(bugService.dismissDuplicate)}
      />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <BugDetail
            bug={bug}
            canWrite={canWrite}
            fixBusy={busy === 'fix'}
            onSuggestFix={() => run('fix', () => bugService.suggestFix(bugId), 'Code fix queued')}
          />
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Triage</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Status</label>
                <Select
                  className="h-10"
                  options={BUG_STATUS_OPTIONS}
                  value={bug.status}
                  disabled={!canWrite || busy === 'patch'}
                  onChange={(e) => patch({ status: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink">Severity</label>
                <Select
                  className="h-10"
                  options={SEVERITY_OPTIONS}
                  value={bug.severity}
                  disabled={!canWrite || busy === 'patch'}
                  onChange={(e) => patch({ severity: e.target.value })}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Predicted from the failure pattern
                  {bug.severityScore != null && ` (risk score ${Math.round(bug.severityScore * 100)} of 100)`}.
                  Change it if it looks wrong.
                </p>
              </div>
            </div>
          </Card>

          {bug.description && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <p className="whitespace-pre-line text-sm text-ink">{bug.description}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}