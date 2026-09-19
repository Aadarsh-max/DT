import { useState } from "react";
import { FolderOpen, Plus } from "lucide-react";
import Button from "../components/ui/Button";
import Select from "../components/ui/Select";
import { useToast } from "../components/ui/Toast";
import StatsRow from "../components/dashboard/StatsRow";
import ExecutionProgress from "../components/dashboard/ExecutionProgress";
import AIBugAnalysisCard from "../components/dashboard/AIBugAnalysisCard";
import RecentRunsTable from "../components/dashboard/RecentRunsTable";
import ReportSummaryDonut from "../components/dashboard/ReportSummaryDonut";
import {
  mockBug,
  mockProjects,
  mockRun,
  mockRuns,
  mockStats,
  mockSummary,
} from "../utils/mockData";
import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const [project, setProject] = useState(mockProjects[0].value);
  const toast = useToast();
  const { user } = useAuth();

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
          <Select
            icon={FolderOpen}
            options={mockProjects}
            value={project}
            onChange={(e) => setProject(e.target.value)}
            wrapperClassName="sm:w-72"
          />
          <Button
            size="lg"
            icon={Plus}
            className="h-11"
            onClick={() => toast.info("New Test Run arrives in Phase 6")}
          >
            New Test Run
          </Button>
        </div>
      </div>

      <StatsRow stats={mockStats} />

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <ExecutionProgress run={mockRun} />
          <RecentRunsTable runs={mockRuns} />
        </div>
        <div className="space-y-4 sm:space-y-6">
          <AIBugAnalysisCard bug={mockBug} />
          <ReportSummaryDonut summary={mockSummary} />
        </div>
      </div>
    </div>
  );
}
