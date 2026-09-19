import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FolderOpen, PlayCircle, Plus } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import { Table, THead, TBody, Tr, Th, Td } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import NewRunModal from '../components/execution/NewRunModal';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { runService } from '../services/run.service';
import { getErrorMessage } from '../services/api';
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from '../utils/constants';
import { formatDateTime, formatDuration, runSeconds } from '../utils/formatters';

const LIMIT = 10;
const ACTIVE = ['QUEUED', 'RUNNING'];

export default function TestExecution() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const canWrite = user?.role !== 'VIEWER';

  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setData(await runService.list(projectId, { page, limit: LIMIT }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load test runs'));
    } finally {
      setLoading(false);
    }
  }, [projectId, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    setPage(1);
  }, [projectId]);

  // Refresh while any run is still going
  const hasActive = data?.items.some((r) => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [hasActive, load]);

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={PlayCircle}
          title="No project selected"
          description="Create a project and generate test cases before running tests."
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
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT));
  const newBtn = canWrite && (
    <Button icon={Plus} onClick={() => setOpen(true)} disabled={!!hasActive}>
      New Test Run
    </Button>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Test Execution</h1>
          <p className="text-sm text-muted">Run your test cases in a real browser or against your API.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            icon={FolderOpen}
            options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
            value={current.id}
            onChange={(e) => setCurrent(e.target.value)}
            wrapperClassName="sm:w-72"
          />
          {newBtn}
        </div>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title="No test runs yet"
          description="Start a run to execute your generated test cases and see pass and fail results with screenshots."
          action={newBtn || undefined}
        />
      ) : (
        <Card className="space-y-4">
          <Table className="min-w-[760px]">
            <THead>
              <Tr className="hover:bg-transparent">
                <Th>Run</Th>
                <Th>Started</Th>
                <Th>Status</Th>
                <Th className="w-40">Progress</Th>
                <Th>Passed</Th>
                <Th>Failed</Th>
                <Th>Duration</Th>
              </Tr>
            </THead>
            <TBody>
              {items.map((r) => (
                <Tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/execution/${r.id}`)}>
                  <Td className="whitespace-nowrap font-medium">
                    <Link to={`/execution/${r.id}`} onClick={(e) => e.stopPropagation()} className="text-brand hover:underline">
                      {r.runCode}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(r.startedAt ?? r.createdAt)}</Td>
                  <Td>
                    <Badge tone={RUN_STATUS_TONE[r.status]}>{RUN_STATUS_LABEL[r.status]}</Badge>
                  </Td>
                  <Td>
                    <ProgressBar
                      value={r.status === 'COMPLETED' ? 100 : r.progress}
                      tone={r.status === 'FAILED' ? 'danger' : r.status === 'COMPLETED' ? 'success' : 'primary'}
                    />
                    <p className="mt-0.5 text-center text-[10px] text-muted">
                      {r.passed + r.failed + r.skipped}/{r.total}
                    </p>
                  </Td>
                  <Td className="text-success">{r.passed}</Td>
                  <Td className="text-danger">{r.failed}</Td>
                  <Td className="whitespace-nowrap text-muted">{r.startedAt ? formatDuration(runSeconds(r)) : '—'}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>

          <div className="flex items-center justify-between gap-2 text-sm text-muted">
            <span>
              {data.total} run{data.total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="text-xs">
                {page} / {totalPages}
              </span>
              <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <NewRunModal
        open={open}
        onClose={() => setOpen(false)}
        project={current}
        onStarted={(run) => navigate(`/execution/${run.id}`)}
      />
    </div>
  );
}