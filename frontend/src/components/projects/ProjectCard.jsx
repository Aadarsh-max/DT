import { Link } from 'react-router-dom';
import { Bug, ClipboardList, FileText, Globe, PlayCircle } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { PLATFORM_LABEL } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';

const platformTone = { WEB: 'info', API: 'neutral', MOBILE: 'warning' };

function Count({ icon: Icon, value, label }) {
  return (
    <span className="flex items-center gap-1.5" title={label}>
      <Icon className="size-4 text-muted" />
      <span className="font-semibold text-ink">{value}</span>
    </span>
  );
}

export default function ProjectCard({ project }) {
  const c = project.counts;
  return (
    <Link to={`/projects/${project.id}`} className="block">
      <Card className="h-full transition-shadow hover:border-primary/40 hover:shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-semibold text-ink">{project.name}</h3>
          <Badge tone={platformTone[project.platform]}>{PLATFORM_LABEL[project.platform]}</Badge>
        </div>

        <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted">
          {project.description || 'No description'}
        </p>

        {project.baseUrl && (
          <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted">
            <Globe className="size-3.5 shrink-0" />
            <span className="truncate">{project.baseUrl}</span>
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
          <div className="flex items-center gap-4">
            <Count icon={FileText} value={c.requirements} label="Requirements" />
            <Count icon={ClipboardList} value={c.testCases} label="Test cases" />
            <Count icon={PlayCircle} value={c.runs} label="Runs" />
            <Count icon={Bug} value={c.bugs} label="Bugs" />
          </div>
          <span className="hidden text-xs text-muted min-[400px]:block">
            {formatDate(project.createdAt)}
          </span>
        </div>
      </Card>
    </Link>
  );
}