import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, FolderOpen, Mail, MessageSquare, Puzzle, Ticket } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { useProject } from '../hooks/useProject';
import { collabService } from '../services/collab.service';
import { getErrorMessage } from '../services/api';

function Check({ label, hint, checked, onChange, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Shell({ icon: Icon, title, description, view, children }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="mb-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-brand">
            <Icon className="size-5" />
          </span>
          <CardTitle>{title}</CardTitle>
        </div>
        {view ? (
          <Badge tone={view.enabled ? 'success' : 'neutral'}>{view.enabled ? 'Active' : 'Paused'}</Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )}
      </CardHeader>
      <p className="mb-4 text-sm text-muted">{description}</p>
      <div className="flex-1 space-y-4">{children}</div>
    </Card>
  );
}

// Save, test and remove for one integration
function useActions(projectId, type, onChanged) {
  const toast = useToast();
  const [busy, setBusy] = useState('');

  async function run(name, fn, ok, reload = true) {
    setBusy(name);
    try {
      const result = await fn();
      toast.success(typeof ok === 'function' ? ok(result) : ok);
      if (reload) await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  return {
    busy,
    save: (payload) => run('save', () => collabService.integrations.save(projectId, type, payload), 'Saved'),
    test: () => run('test', () => collabService.integrations.test(projectId, type), (r) => r.message, false),
    remove: () => {
      if (!window.confirm('Remove this integration? Its saved settings are deleted.')) return;
      run('remove', () => collabService.integrations.remove(projectId, type), 'Removed');
    },
  };
}

function Buttons({ actions, view, canManage }) {
  if (!canManage) return <p className="text-xs text-muted">Only the project owner or an admin can change these settings.</p>;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button loading={actions.busy === 'save'} onClick={actions.onSave}>
        Save
      </Button>
      <Button variant="secondary" loading={actions.busy === 'test'} disabled={!view} onClick={actions.test}>
        Send test
      </Button>
      {view && (
        <Button variant="secondary" className="text-danger" loading={actions.busy === 'remove'} onClick={actions.remove}>
          Remove
        </Button>
      )}
    </div>
  );
}

function SlackCard({ projectId, view, canManage, onChanged }) {
  const actions = useActions(projectId, 'SLACK', onChanged);
  const [f, setF] = useState({
    webhookUrl: '',
    enabled: view?.enabled ?? true,
    onRunFailed: view?.onRunFailed ?? true,
    onCriticalBug: view?.onCriticalBug ?? true,
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const placeholder = view?.secretSet
    ? `Saved (${view.secretHint}). Leave empty to keep it.`
    : 'https://hooks.slack.com/services/...';

  return (
    <Shell
      icon={MessageSquare}
      title="Slack"
      view={view}
      description="Post alerts to a Slack channel through an incoming webhook (free to create in your Slack workspace)."
    >
      <Input
        label="Webhook URL"
        type="password"
        autoComplete="off"
        placeholder={placeholder}
        value={f.webhookUrl}
        disabled={!canManage}
        onChange={(e) => set('webhookUrl')(e.target.value)}
      />
      {view && !view.secretSet && (
        <p className="text-xs text-warning">The saved webhook can no longer be read. Enter it again.</p>
      )}
      <div className="space-y-3">
        <Check label="Failed runs" hint="When a run has failed or errored tests, or cannot finish" checked={f.onRunFailed} onChange={set('onRunFailed')} disabled={!canManage} />
        <Check label="Critical bugs" hint="When a bug is analyzed as Critical" checked={f.onCriticalBug} onChange={set('onCriticalBug')} disabled={!canManage} />
        <Check label="Enabled" checked={f.enabled} onChange={set('enabled')} disabled={!canManage} />
      </div>
      <Buttons
        canManage={canManage}
        view={view}
        actions={{
          ...actions,
          onSave: () =>
            actions.save({
              webhookUrl: f.webhookUrl.trim() || undefined,
              enabled: f.enabled,
              onRunFailed: f.onRunFailed,
              onCriticalBug: f.onCriticalBug,
            }),
        }}
      />
    </Shell>
  );
}

function JiraCard({ projectId, view, canManage, onChanged }) {
  const actions = useActions(projectId, 'JIRA', onChanged);
  const [f, setF] = useState({
    baseUrl: view?.baseUrl ?? '',
    email: view?.email ?? '',
    apiToken: '',
    projectKey: view?.projectKey ?? '',
    issueType: view?.issueType ?? 'Bug',
    enabled: view?.enabled ?? true,
    onCriticalBug: view?.onCriticalBug ?? true,
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const on = (k) => (e) => set(k)(e.target.value);

  return (
    <Shell
      icon={Ticket}
      title="Jira"
      view={view}
      description="Create Jira issues from bugs. Jira Cloud only (your-site.atlassian.net). Use an API token from your Atlassian account."
    >
      <Input label="Jira address" placeholder="https://your-site.atlassian.net" value={f.baseUrl} disabled={!canManage} onChange={on('baseUrl')} />
      <Input label="Atlassian account email" type="email" value={f.email} disabled={!canManage} onChange={on('email')} />
      <Input
        label="API token"
        type="password"
        autoComplete="off"
        placeholder={view?.secretSet ? `Saved (${view.secretHint}). Leave empty to keep it.` : 'Paste your API token'}
        value={f.apiToken}
        disabled={!canManage}
        onChange={on('apiToken')}
      />
      {view && !view.secretSet && <p className="text-xs text-warning">The saved token can no longer be read. Enter it again.</p>}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Project key" placeholder="QA" value={f.projectKey} disabled={!canManage} onChange={on('projectKey')} />
        <Input label="Issue type" placeholder="Bug" value={f.issueType} disabled={!canManage} onChange={on('issueType')} />
      </div>
      <div className="space-y-3">
        <Check
          label="Create an issue for each critical bug"
          hint="Automatic. Any bug can also be sent with the button on its page."
          checked={f.onCriticalBug}
          onChange={set('onCriticalBug')}
          disabled={!canManage}
        />
        <Check label="Enabled" checked={f.enabled} onChange={set('enabled')} disabled={!canManage} />
      </div>
      <Buttons
        canManage={canManage}
        view={view}
        actions={{
          ...actions,
          onSave: () =>
            actions.save({
              baseUrl: f.baseUrl.trim(),
              email: f.email.trim(),
              apiToken: f.apiToken.trim() || undefined,
              projectKey: f.projectKey.trim(),
              issueType: f.issueType.trim() || 'Bug',
              enabled: f.enabled,
              onCriticalBug: f.onCriticalBug,
            }),
        }}
      />
    </Shell>
  );
}

function EmailCard({ projectId, view, canManage, emailAvailable, onChanged }) {
  const actions = useActions(projectId, 'EMAIL', onChanged);
  const [f, setF] = useState({
    recipients: (view?.recipients ?? []).join(', '),
    enabled: view?.enabled ?? true,
    onRunFailed: view?.onRunFailed ?? true,
    onCriticalBug: view?.onCriticalBug ?? true,
  });
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Shell
      icon={Mail}
      title="Email"
      view={view}
      description="Send alerts to one or more email addresses. Uses the mail account configured on the server."
    >
      {!emailAvailable && (
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-xs text-ink">
          Email is not set up on the server. Add <code>SMTP_HOST</code> and <code>SMTP_FROM</code> (and usually{' '}
          <code>SMTP_USER</code> and <code>SMTP_PASS</code>) to <code>backend/.env</code> and restart the backend.
        </div>
      )}
      <Input
        label="Recipients"
        placeholder="lead@company.com, qa@company.com"
        value={f.recipients}
        disabled={!canManage}
        onChange={(e) => set('recipients')(e.target.value)}
      />
      <div className="space-y-3">
        <Check label="Failed runs" checked={f.onRunFailed} onChange={set('onRunFailed')} disabled={!canManage} />
        <Check label="Critical bugs" checked={f.onCriticalBug} onChange={set('onCriticalBug')} disabled={!canManage} />
        <Check label="Enabled" checked={f.enabled} onChange={set('enabled')} disabled={!canManage} />
      </div>
      <Buttons
        canManage={canManage}
        view={view}
        actions={{
          ...actions,
          onSave: () =>
            actions.save({
              recipients: f.recipients.split(/[,;\s]+/).filter(Boolean),
              enabled: f.enabled,
              onRunFailed: f.onRunFailed,
              onCriticalBug: f.onCriticalBug,
            }),
        }}
      />
    </Shell>
  );
}

export default function Integrations() {
  const toast = useToast();
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0); // remounts the forms after a save

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setData(await collabService.integrations.list(projectId));
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load integrations'));
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    load();
  }, [load]);

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={Puzzle}
          title="No project selected"
          description="Create a project first, then connect Slack, Jira or email to it."
          action={
            <Link to="/projects">
              <Button>Go to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const shared = { projectId, canManage: data?.canManage, onChanged: load };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Integrations</h1>
          <p className="text-sm text-muted">Get alerts in Slack or email, and turn bugs into Jira issues. Settings are per project.</p>
        </div>
        <Select
          icon={FolderOpen}
          options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
          value={current.id}
          onChange={(e) => setCurrent(e.target.value)}
          wrapperClassName="sm:w-72"
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-primary-soft/60 p-3 text-sm text-ink">
        <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          Everyone on the project always gets in-app notifications (the bell). Slack and email add to that. Tokens and
          webhooks are stored encrypted and are never shown again. To avoid floods, a project sends at most 8 external
          alerts every 10 minutes.
        </span>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : !data ? (
        <EmptyState icon={Puzzle} title="Could not load integrations" description="Check that the backend is running." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <SlackCard key={`s-${version}`} view={data.integrations.SLACK} {...shared} />
          <JiraCard key={`j-${version}`} view={data.integrations.JIRA} {...shared} />
          <EmailCard key={`e-${version}`} view={data.integrations.EMAIL} emailAvailable={data.emailAvailable} {...shared} />
        </div>
      )}
    </div>
  );
}