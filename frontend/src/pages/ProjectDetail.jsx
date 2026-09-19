import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  ClipboardList,
  ExternalLink,
  FileText,
  Pencil,
  PlayCircle,
  RefreshCw,
  SearchX,
  Trash2,
} from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { Table, THead, TBody, Tr, Th, Td } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import ProjectForm from '../components/projects/ProjectForm';
import RequirementUploader from '../components/projects/RequirementUploader';
import RagSearchTester from '../components/projects/RagSearchTester';
import { useProject } from '../hooks/useProject';
import { projectService } from '../services/project.service';
import { getErrorMessage } from '../services/api';
import { PLATFORM_LABEL, REQUIREMENT_TYPE_LABEL } from '../utils/constants';
import { formatDate } from '../utils/formatters';

const ACTIVE = ['PENDING', 'INDEXING'];
const statusTone = { READY: 'success', INDEXING: 'info', PENDING: 'neutral', FAILED: 'danger' };
const statusLabel = { READY: 'Ready', INDEXING: 'Indexing', PENDING: 'Queued', FAILED: 'Failed' };

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-brand">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-bold leading-tight text-ink">{value}</p>
      </div>
    </Card>
  );
}

export default function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshProjects } = useProject();

  const [project, setProject] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadRequirements = useCallback(async () => {
    try {
      setRequirements(await projectService.listRequirements(projectId));
    } catch {
      /* keep the previous list */
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    try {
      setProject(await projectService.get(projectId));
    } catch {
      /* keep the previous data */
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    Promise.all([projectService.get(projectId), projectService.listRequirements(projectId)])
      .then(([p, r]) => {
        if (cancelled) return;
        setProject(p);
        setRequirements(r);
      })
      .catch((err) => {
        if (cancelled) return;
        if ([403, 404].includes(err.response?.status)) setNotFound(true);
        else toast.error(getErrorMessage(err, 'Could not load the project'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  // Poll while anything is still being indexed
  const hasActive = requirements.some((r) => ACTIVE.includes(r.status));
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(loadRequirements, 3000);
    return () => clearInterval(id);
  }, [hasActive, loadRequirements]);

  function onAdded(requirement) {
    setRequirements((prev) => [requirement, ...prev]);
    loadProject();
  }

  async function onReindex(r) {
    try {
      await projectService.reindex(r.id);
      toast.info('Re-indexing started');
      loadRequirements();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onDeleteRequirement(r) {
    if (!window.confirm(`Delete "${r.title}"? Its indexed content will be removed.`)) return;
    try {
      await projectService.removeRequirement(r.id);
      setRequirements((prev) => prev.filter((x) => x.id !== r.id));
      loadProject();
      toast.success('Requirement deleted');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onUpdate(values) {
    const updated = await projectService.update(projectId, values);
    setProject(updated);
    refreshProjects();
    setEditOpen(false);
    toast.success('Project updated');
  }

  async function onDeleteProject() {
    setDeleting(true);
    try {
      await projectService.remove(projectId);
      await refreshProjects();
      toast.success('Project deleted');
      navigate('/projects', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-brand">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={SearchX}
          title="Project not found"
          description="It may have been deleted, or you don't have access to it."
          action={
            <Link to="/projects">
              <Button>Back to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const readyCount = requirements.filter((r) => r.status === 'READY').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-brand">
        <ArrowLeft className="size-4" /> All projects
      </Link>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink sm:text-2xl">{project.name}</h1>
              <Badge>{PLATFORM_LABEL[project.platform]}</Badge>
            </div>
            {project.description && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted">{project.description}</p>
            )}
            {project.baseUrl && (
              <a
                href={project.baseUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 break-all text-sm text-brand hover:underline"
              >
                {project.baseUrl} <ExternalLink className="size-3.5 shrink-0" />
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="secondary" icon={Trash2} className="text-danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={FileText} label="Requirements" value={project.counts.requirements} />
        <Stat icon={ClipboardList} label="Test cases" value={project.counts.testCases} />
        <Stat icon={PlayCircle} label="Runs" value={project.counts.runs} />
        <Stat icon={Bug} label="Bugs" value={project.counts.bugs} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:order-2">
          <CardHeader>
            <CardTitle>Add requirements</CardTitle>
          </CardHeader>
          <RequirementUploader projectId={projectId} onAdded={onAdded} />
        </Card>

        <div className="space-y-4 sm:space-y-6 xl:order-1 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              {hasActive && (
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Spinner className="size-3" /> Indexing...
                </span>
              )}
            </CardHeader>

            {requirements.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No requirements yet"
                description="Upload an SRS, API spec or source file, or add a URL. It is split into chunks and indexed so the AI can generate test cases from it."
                className="border-0 py-10"
              />
            ) : (
              <Table>
                <THead>
                  <Tr className="hover:bg-transparent">
                    <Th>Title</Th>
                    <Th>Type</Th>
                    <Th>Status</Th>
                    <Th>Chunks</Th>
                    <Th>Added</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {requirements.map((r) => (
                    <Tr key={r.id}>
                      <Td className="max-w-64">
                        <p className="truncate font-medium" title={r.title}>
                          {r.title}
                        </p>
                        {r.status === 'FAILED' && r.errorMsg && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-danger">{r.errorMsg}</p>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-muted">{REQUIREMENT_TYPE_LABEL[r.type]}</Td>
                      <Td>
                        <Badge tone={statusTone[r.status]}>
                          {r.status === 'INDEXING' && <Spinner className="size-3" />}
                          {statusLabel[r.status]}
                        </Badge>
                      </Td>
                      <Td>{r.status === 'READY' ? r.chunkCount : '—'}</Td>
                      <Td className="whitespace-nowrap text-muted">{formatDate(r.createdAt)}</Td>
                      <Td>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => onReindex(r)}
                            disabled={ACTIVE.includes(r.status)}
                            aria-label="Re-index"
                            title="Re-index"
                            className="rounded-lg p-1.5 text-muted hover:bg-primary-soft hover:text-brand disabled:opacity-40"
                          >
                            <RefreshCw className="size-4" />
                          </button>
                          <button
                            onClick={() => onDeleteRequirement(r)}
                            disabled={ACTIVE.includes(r.status)}
                            aria-label="Delete"
                            title="Delete"
                            className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>

          <RagSearchTester projectId={projectId} readyCount={readyCount} />
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit project">
        <ProjectForm
          initial={project}
          submitLabel="Save changes"
          onSubmit={onUpdate}
          onCancel={() => setEditOpen(false)}
        />
      </Modal>

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Delete project?">
        <p className="text-sm text-muted">
          This permanently deletes <span className="font-semibold text-ink">{project.name}</span> with
          all of its requirements, test cases, runs and bugs. This can&apos;t be undone.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={onDeleteProject}>
            Delete project
          </Button>
        </div>
      </Modal>
    </div>
  );
}