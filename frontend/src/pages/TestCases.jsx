import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderOpen,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Tabs from "../components/ui/Tabs";
import Spinner from "../components/ui/Spinner";
import EmptyState from "../components/ui/EmptyState";
import ProgressBar from "../components/ui/ProgressBar";
import { useToast } from "../components/ui/Toast";
import TestCaseTable from "../components/testcases/TestCaseTable";
import TestCaseDrawer from "../components/testcases/TestCaseDrawer";
import GenerateTestsModal from "../components/testcases/GenerateTestsModal";
import { useAuth } from "../hooks/useAuth";
import { useDebounce } from "../hooks/useDebounce";
import { useProject } from "../hooks/useProject";
import { useRunProgress } from "../hooks/useRunProgress";
import { testcaseService } from "../services/testcase.service";
import { getErrorMessage } from "../services/api";
import {
  PRIORITY_OPTIONS,
  TEST_TYPES,
  TEST_TYPE_LABEL,
} from "../utils/constants";

const LIMIT = 15;
const EMPTY_FILTERS = { type: "", priority: "", module: "", search: "" };

function snapshotFinished(snapshot) {
  return ["completed", "failed", "unknown"].includes(snapshot?.state);
}

function GenerationBanner({ snapshot, onDismiss }) {
  const state = snapshot?.state ?? "queued";
  const progress = snapshot?.progress ?? {};
  const finished = ["completed", "failed", "unknown"].includes(state);
  const percent = state === "completed" ? 100 : (progress.percent ?? 0);
  const warnings = progress.warnings ?? [];

  let message = progress.message || "Starting...";
  if (state === "queued") message = "Waiting for the AI worker...";
  if (state === "completed")
    message = `Done. ${snapshot.result?.created ?? 0} new test cases added.`;
  if (state === "failed") message = snapshot.error || "Generation failed";
  if (state === "unknown")
    message = snapshot?.error || "This job is no longer available.";

  const bad = state === "failed" || state === "unknown";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {finished ? (
            <Sparkles
              className={bad ? "size-5 text-danger" : "size-5 text-success"}
            />
          ) : (
            <Spinner className="size-4 text-primary" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">AI test generation</p>
            <p className={`text-sm ${bad ? "text-danger" : "text-muted"}`}>
              {message}
            </p>
          </div>
        </div>
        {finished && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-primary-soft hover:text-brand"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <ProgressBar
          value={percent}
          tone={bad ? "danger" : state === "completed" ? "success" : "primary"}
          className="flex-1"
          trackClassName="flex-1"
        />
        <span className="w-10 text-right text-xs font-semibold text-ink">
          {percent}%
        </span>
      </div>

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-warning">
          {warnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function TestCases() {
  const toast = useToast();
  const { user } = useAuth();
  const {
    projects,
    current,
    setCurrent,
    refresh: refreshProjects,
  } = useProject();
  const projectId = current?.id;
  const canWrite = user?.role !== "VIEWER";

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(filters.search, 350);
  const { type, priority, module: moduleFilter } = filters;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [active, setActive] = useState(null);
  const [genOpen, setGenOpen] = useState(false);
  const [jobId, setJobId] = useState(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setData(
        await testcaseService.list(projectId, {
          type,
          priority,
          module: moduleFilter,
          search: debouncedSearch,
          page,
          limit: LIMIT,
        }),
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not load test cases"));
    } finally {
      setLoading(false);
    }
  }, [projectId, type, priority, moduleFilter, debouncedSearch, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset everything when the project changes, then resume any running generation
  useEffect(() => {
    setData(null);
    setLoading(true);
    setPage(1);
    setSelected([]);
    setActive(null);
    setJobId(null);
    setFilters(EMPTY_FILTERS);
    if (!projectId) return;

    let cancelled = false;
    testcaseService
      .activeGeneration(projectId)
      .then((job) => {
        if (!cancelled && job) setJobId(job.jobId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const { snapshot } = useRunProgress({
    enabled: !!jobId && !!projectId,
    streamPath: jobId
      ? `/projects/${projectId}/testcases/generate/${jobId}/events`
      : null,
    statusPath: jobId
      ? `/projects/${projectId}/testcases/generate/${jobId}`
      : null,
    onFinish: (snap) => {
      if (snap.state === "completed")
        toast.success(`Generated ${snap.result?.created ?? 0} new test cases`);
      else if (snap.state === "failed")
        toast.error(snap.error || "Generation failed");
      else toast.info("The generation job is no longer available");
      setPage(1);
      load();
      refreshProjects();
    },
  });

  function updateFilter(name, value) {
    setFilters((f) => ({ ...f, [name]: value }));
    setPage(1);
    setSelected([]);
  }

  async function onSave(id, payload) {
    const updated = await testcaseService.update(id, payload);
    setActive(updated);
    setData(
      (d) =>
        d && { ...d, items: d.items.map((t) => (t.id === id ? updated : t)) },
    );
    toast.success("Test case updated");
  }

  async function onDeleteOne(t) {
    if (!window.confirm(`Delete "${t.title}"?`)) return;
    try {
      await testcaseService.remove(t.id);
      setActive(null);
      toast.success("Test case deleted");
      load();
      refreshProjects();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onBulkDelete() {
    if (!window.confirm(`Delete ${selected.length} selected test case(s)?`))
      return;
    try {
      const { deleted } = await testcaseService.bulkRemove(projectId, selected);
      setSelected([]);
      toast.success(`Deleted ${deleted} test case(s)`);
      load();
      refreshProjects();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  // ───────── render ─────────

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={ClipboardList}
          title="No project selected"
          description="Create a project and upload its requirements to start generating test cases."
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
  const hasFilters = !!(type || priority || moduleFilter || filters.search);
  const generateBtn = canWrite && (
    <Button
      icon={Sparkles}
      onClick={() => setGenOpen(true)}
      disabled={!!jobId && !snapshotFinished(snapshot)}
    >
      Generate test cases
    </Button>
  );

  const tabs = [
    { value: "", label: `All (${stats?.total ?? 0})` },
    ...[...TEST_TYPES, "MOBILE"].map((t) => ({
      value: t,
      label: `${TEST_TYPE_LABEL[t]} (${stats?.byType?.[t] ?? 0})`,
    })),
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Test Cases</h1>
          <p className="text-sm text-muted">
            Generated from your requirements. Review, edit and keep what you
            need.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            icon={FolderOpen}
            options={projects.map((p) => ({
              value: p.id,
              label: `Project: ${p.name}`,
            }))}
            value={current.id}
            onChange={(e) => setCurrent(e.target.value)}
            wrapperClassName="sm:w-72"
          />
          {generateBtn}
        </div>
      </div>

      {jobId && (
        <GenerationBanner
          snapshot={snapshot}
          onDismiss={() => setJobId(null)}
        />
      )}

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : stats?.total === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No test cases yet"
          description="Generate functional, boundary, negative, security and API test cases from the requirements you indexed."
          action={generateBtn || undefined}
        />
      ) : (
        <Card className="space-y-4">
          <Tabs
            tabs={tabs}
            value={type}
            onChange={(v) => updateFilter("type", v)}
          />

          <div className="flex flex-col gap-3 lg:flex-row">
            <Input
              icon={Search}
              placeholder="Search test cases..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              aria-label="Search test cases"
            />
            <Select
              className="h-10"
              options={[
                { value: "", label: "All priorities" },
                ...PRIORITY_OPTIONS,
              ]}
              value={priority}
              onChange={(e) => updateFilter("priority", e.target.value)}
              wrapperClassName="lg:w-48"
            />
            <Select
              className="h-10"
              options={[
                { value: "", label: "All feature areas" },
                ...(data?.modules ?? []).map((m) => ({ value: m, label: m })),
              ]}
              value={moduleFilter}
              onChange={(e) => updateFilter("module", e.target.value)}
              wrapperClassName="lg:w-56"
            />
          </div>

          {selected.length > 0 && canWrite && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm">
              <span className="font-medium text-brand">
                {selected.length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelected([])}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={Trash2}
                  onClick={onBulkDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {hasFilters
                ? "No test cases match these filters."
                : "Nothing on this page."}
            </p>
          ) : (
            <TestCaseTable
              items={items}
              selectedIds={selected}
              onToggle={(id) =>
                setSelected((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
                )
              }
              onToggleAll={() => {
                const ids = items.map((t) => t.id);
                const all = ids.every((id) => selected.includes(id));
                setSelected((prev) =>
                  all
                    ? prev.filter((id) => !ids.includes(id))
                    : [...new Set([...prev, ...ids])],
                );
              }}
              onOpen={setActive}
            />
          )}

          <div className="flex items-center justify-between gap-2 text-sm text-muted">
            <span>
              {data?.total ?? 0} test case{data?.total === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={ChevronLeft}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <span className="text-xs">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {active && (
        <TestCaseDrawer
          key={active.id}
          testCase={active}
          canEdit={canWrite}
          onClose={() => setActive(null)}
          onSave={onSave}
          onDelete={onDeleteOne}
        />
      )}

      <GenerateTestsModal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        projectId={projectId}
        onStarted={setJobId}
      />
    </div>
  );
}
