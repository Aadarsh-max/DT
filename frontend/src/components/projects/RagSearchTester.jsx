import { useState } from 'react';
import { Search } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useToast } from '../ui/Toast';
import { projectService } from '../../services/project.service';
import { getErrorMessage } from '../../services/api';

function ResultItem({ r }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-line p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-brand">
          {r.source} · part {r.chunkIndex + 1}
        </p>
        <Badge tone={r.score >= 0.5 ? 'success' : 'warning'}>
          {(r.score * 100).toFixed(0)}% match
        </Badge>
      </div>
      <p className={`whitespace-pre-line text-sm text-muted ${open ? '' : 'line-clamp-4'}`}>
        {r.text}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1.5 text-xs font-medium text-brand hover:underline"
      >
        {open ? 'Show less' : 'Show full text'}
      </button>
    </div>
  );
}

export default function RagSearchTester({ projectId, readyCount }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    try {
      setData(await projectService.search(projectId, { query }));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Search failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test retrieval</CardTitle>
        {data?.engine && <Badge>{data.engine}</Badge>}
      </CardHeader>
      <p className="mb-4 text-sm text-muted">
        See what the AI will read from your requirements. Ask something like &quot;what are the
        login rules?&quot;
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          icon={Search}
          placeholder="Search your indexed requirements..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={readyCount === 0}
          aria-label="Search query"
        />
        <Button type="submit" loading={busy} disabled={readyCount === 0} className="sm:w-28">
          Search
        </Button>
      </form>

      {readyCount === 0 && (
        <p className="mt-3 text-xs text-muted">Index at least one requirement first.</p>
      )}

      {data && (
        <div className="mt-4 space-y-3">
          {data.results.length === 0 ? (
            <p className="text-sm text-muted">No matching content found.</p>
          ) : (
            data.results.map((r) => (
              <ResultItem key={`${r.requirementId}-${r.chunkIndex}`} r={r} />
            ))
          )}
        </div>
      )}
    </Card>
  );
}