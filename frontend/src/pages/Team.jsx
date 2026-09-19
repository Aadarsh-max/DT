import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, LogOut, Trash2, UserPlus, Users } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { Table, THead, TBody, Tr, Th, Td } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { collabService } from '../services/collab.service';
import { getErrorMessage } from '../services/api';
import { formatDate, formatRole, getInitials } from '../utils/formatters';

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'QA_ENGINEER', label: 'QA Engineer' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'VIEWER', label: 'Viewer' },
];

export default function Team() {
  const toast = useToast();
  const { user } = useAuth();
  const { projects, current, setCurrent, refresh: refreshProjects } = useProject();
  const projectId = current?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setData(await collabService.team.list(projectId));
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load the team'));
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    load();
  }, [load]);

  async function onAdd(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      setData(await collabService.team.add(projectId, email.trim()));
      setEmail('');
      toast.success('Added to the team');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add that person'));
    } finally {
      setAdding(false);
    }
  }

  async function onRemove(person, leaving) {
    const question = leaving
      ? `Leave "${current.name}"? You will lose access to it.`
      : `Remove ${person.name} from "${current.name}"? Their bugs become unassigned.`;
    if (!window.confirm(question)) return;
    try {
      await collabService.team.remove(projectId, person.id);
      toast.success(leaving ? 'You left the project' : 'Removed from the team');
      if (leaving) {
        setData(null);
        await refreshProjects();
      } else {
        await load();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function onRole(person, role) {
    try {
      await collabService.team.setRole(person.id, role);
      toast.success(`${person.name} is now ${formatRole(role)}`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={Users}
          title="No project selected"
          description="Create a project first, then add your teammates to it."
          action={
            <Link to="/projects">
              <Button>Go to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const people = data ? [{ ...data.owner, isOwner: true }, ...data.members] : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Team</h1>
          <p className="text-sm text-muted">Who works on this project. Assign bugs and discuss them together.</p>
        </div>
        <Select
          icon={FolderOpen}
          options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
          value={current.id}
          onChange={(e) => setCurrent(e.target.value)}
          wrapperClassName="sm:w-72"
        />
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : !data ? (
        <EmptyState icon={Users} title="Could not load the team" description="You may no longer have access to this project." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Members ({people.length})</CardTitle>
            </CardHeader>
            <Table className="min-w-[560px]">
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>Person</Th>
                  <Th>Account role</Th>
                  <Th>Joined</Th>
                  <Th className="text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {people.map((p) => {
                  const me = p.id === user.id;
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-brand">
                            {getInitials(p.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-medium text-ink">
                              {p.name}
                              {p.isOwner && <Badge>Owner</Badge>}
                              {me && <Badge tone="info">You</Badge>}
                            </p>
                            <p className="truncate text-xs text-muted">{p.email}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {data.isAdmin && !me ? (
                          <Select
                            className="h-9"
                            options={ROLE_OPTIONS}
                            value={p.role}
                            onChange={(e) => onRole(p, e.target.value)}
                            wrapperClassName="w-40"
                          />
                        ) : (
                          <Badge tone="neutral">{formatRole(p.role)}</Badge>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-muted">{p.joinedAt ? formatDate(p.joinedAt) : '—'}</Td>
                      <Td>
                        <div className="flex justify-end">
                          {!p.isOwner && me && (
                            <Button size="sm" variant="secondary" icon={LogOut} onClick={() => onRemove(p, true)}>
                              Leave
                            </Button>
                          )}
                          {!p.isOwner && !me && data.canManage && (
                            <button
                              onClick={() => onRemove(p, false)}
                              aria-label={`Remove ${p.name}`}
                              title="Remove"
                              className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
            <p className="mt-3 text-xs text-muted">
              What someone can do comes from their account role: Viewers can read and comment, everyone else can
              also run tests and edit. Only admins can change roles.
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add a teammate</CardTitle>
            </CardHeader>
            {data.canManage ? (
              <form onSubmit={onAdd} className="space-y-3">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="submit" icon={UserPlus} loading={adding} disabled={!email.trim()} className="w-full">
                  Add to project
                </Button>
                <p className="text-xs text-muted">
                  They need an account already. Ask them to register first, then add them here.
                </p>
              </form>
            ) : (
              <p className="text-sm text-muted">Only the project owner or an admin can add people.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}