import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bug, ChevronLeft, ChevronRight, FolderOpen, RefreshCw, Search } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Tabs from '../components/ui/Tabs';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import BugTable from '../components/bugs/BugTable';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { useProject } from '../hooks/useProject';
import { bugService } from '../services/bug.service';
import { getErrorMessage } from '../services/api';
import { BUG_STATUS_LABEL, SEVERITY_OPTIONS } from '../utils/constants';

const LIMIT = 15;
const EMPTY = { status: '', severity: '', search: '' };
const TEN_MIN = 10 * 60 * 1000;

export default function BugReports() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const canWrite = user?.role !== 'VIEWER';

  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(filters.search, 350);
  const { status, severity } = filters;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setData(await bugService.list(projectId, { status, severity, search: debouncedSearch, page, limit: LIMIT }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load bugs'));
    } finally {
      setLoading(false);
    }
  }, [projectId, status, severity, debouncedSearch, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    setPage(1);
    setFilters(EMPTY);
  }, [projectId]);

  // Keep refreshing while recent bugs are still waiting for their analysis
  const waiting = data?.items.some((b) => !b.analyzed && Date.now() - new Date(b.createdAt).getTime() < TEN_MIN);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [waiting, load]);

  function updateFilter(name, value) {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
  }

  async function onSync() {
    setSyncing(true);
    try {
      const { created } = await bugService.sync(projectId);
      if (created > 0) toast.success(`${created} new bug${created === 1 ? '' : 's'} found. Analysis has started.`);
      else toast.info('No new failures to turn into bugs');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not scan runs'));
    } finally {
      setSyncing(false);
    }
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={Bug}
          title="No project selected"
          description="Create a project and run tests to see bugs here."
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
  const stats = data?.stats;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / LIMIT));
  const hasFilters = !!(status || severity || filters.search);
  const syncBtn = canWrite && (
    <Button variant="secondary" icon={RefreshCw} loading={syncing} onClick={onSync}>
      Find bugs in runs
    </Button>
  );

  const tabs = [
    { value: '', label: `All (${stats?.total ?? 0})` },
    ...Object.keys(BUG_STATUS_LABEL).map((s) => ({
      value: s,
      label: `${BUG_STATUS_LABEL[s]} (${stats?.byStatus?.[s] ?? 0})`,
    })),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Bug Reports</h1>
          <p className="text-sm text-muted">Failed tests become bugs, analyzed by AI with a severity and a suggested fix.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            icon={FolderOpen}
            options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
            value={current.id}
            onChange={(e) => setCurrent(e.target.value)}
            wrapperClassName="sm:w-72"
          />
          {syncBtn}
        </div>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : stats?.total === 0 ? (
        <EmptyState
          icon={Bug}
          title="No bugs yet"
          description="After a test run, each failed test becomes a bug report. Error results are not counted, because they mean the test could not run."
          action={syncBtn || undefined}
        />
      ) : (
        <Card className="space-y-4">
          <Tabs tabs={tabs} value={status} onChange={(v) => updateFilter('status', v)} />

          <div className="flex flex-col gap-3 lg:flex-row">
            <Input
              icon={Search}
              placeholder="Search by title or number, e.g. BUG-12"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              aria-label="Search bugs"
            />
            <Select
              className="h-10"
              options={[{ value: '', label: 'All severities' }, ...SEVERITY_OPTIONS]}
              value={severity}
              onChange={(e) => updateFilter('severity', e.target.value)}
              wrapperClassName="lg:w-52"
            />
          </div>

          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {hasFilters ? 'No bugs match these filters.' : 'Nothing on this page.'}
            </p>
          ) : (
            <BugTable items={items} onOpen={(b) => navigate(`/bugs/${b.id}`)} />
          )}

          <div className="flex items-center justify-between gap-2 text-sm text-muted">
            <span>
              {data?.total ?? 0} bug{data?.total === 1 ? '' : 's'}
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
    </div>
  );
}