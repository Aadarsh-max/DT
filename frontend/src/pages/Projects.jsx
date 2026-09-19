import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';
import ProjectCard from '../components/projects/ProjectCard';
import ProjectForm from '../components/projects/ProjectForm';
import { useProject } from '../hooks/useProject';
import { projectService } from '../services/project.service';

export default function Projects() {
  const { projects, loading, refresh, setCurrent } = useProject();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function create(values) {
    const project = await projectService.create(values);
    await refresh();
    setCurrent(project.id);
    setOpen(false);
    toast.success('Project created');
    navigate(`/projects/${project.id}`);
  }

  const newButton = (
    <Button icon={Plus} onClick={() => setOpen(true)}>
      New Project
    </Button>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Projects</h1>
          <p className="text-sm text-muted">Each project holds its own requirements, tests and bugs.</p>
        </div>
        {projects.length > 0 && newButton}
      </div>

      {loading && projects.length === 0 ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project, then upload its requirements so the AI can start generating tests."
          action={newButton}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <ProjectForm submitLabel="Create project" onSubmit={create} onCancel={() => setOpen(false)} />
      </Modal>
    </div>
  );
}