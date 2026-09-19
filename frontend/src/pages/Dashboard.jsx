import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderOpen, Plus } from "lucide-react";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import StatsRow from "../components/dashboard/StatsRow";
import ExecutionProgress from "../components/dashboard/ExecutionProgress";
import AIBugAnalysisCard from "../components/dashboard/AIBugAnalysisCard";
import RecentRunsTable from "../components/dashboard/RecentRunsTable";
import ReportSummaryDonut from "../components/dashboard/ReportSummaryDonut";
import NewRunModal from "../components/execution/NewRunModal";
import { useAuth } from "../hooks/useAuth";
import { useProject } from "../hooks/useProject";
import { runService } from "../services/run.service";
import { bugService } from "../services/bug.service";

const EMPTY = {
  stats: {
    totalCases: 0,
    executed: 0,
    executedPct: 0,
    passed: 0,
    passedPct: 0,
    failed: 0,
    failedPct: 0,
    bugs: 0,
  },
  latestRun: null,
  summary: { passed: 0, failed: 0, skipped: 0 },
  recentRuns: [],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const canWrite = user?.role !== "VIEWER";

  const [data, setData] = useState(EMPTY);
  const [bug, setBug] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) {
      setData(EMPTY);
      setBug(null);
      return;
    }
    try {
      setData(await runService.dashboard(projectId));
    } catch {
      /* keep what is on screen */
    }
    try {
      setBug(await bugService.featured(projectId));
    } catch {
      /* keep what is on screen */
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh while the latest run is still going
  const active = ["QUEUED", "RUNNING"].includes(data.latestRun?.status);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [active, load]);

  const options = projects.map((p) => ({
    value: p.id,
    label: `Project: ${p.name}`,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            Welcome back, {user?.name?.split(" ")[0]}! 👋
          </h1>
          <p className="text-sm text-muted">
            Here&apos;s an overview of your testing activity today.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {projects.length > 0 ? (
            <Select
              icon={FolderOpen}
              options={options}
              value={current?.id ?? ""}
              onChange={(e) => setCurrent(e.target.value)}
              wrapperClassName="sm:w-72"
            />
          ) : (
            <Link to="/projects">
              <Button
                variant="secondary"
                icon={FolderOpen}
                className="h-11 w-full sm:w-auto"
              >
                Create your first project
              </Button>
            </Link>
          )}
          {canWrite && (
            <Button
              size="lg"
              icon={Plus}
              className="h-11"
              disabled={!current || active}
              onClick={() => setOpen(true)}
            >
              New Test Run
            </Button>
          )}
        </div>
      </div>

      <StatsRow stats={data.stats} />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <ExecutionProgress run={data.latestRun} />
          <RecentRunsTable runs={data.recentRuns} />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <AIBugAnalysisCard bug={bug} />
          <ReportSummaryDonut
            summary={data.summary}
            runId={data.latestRun?.id}
            projectId={projectId}
          />
        </div>
      </div>

      <NewRunModal
        open={open}
        onClose={() => setOpen(false)}
        project={current}
        onStarted={(run) => navigate(`/execution/${run.id}`)}
      />
    </div>
  );
}
