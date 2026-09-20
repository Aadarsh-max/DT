import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, FolderOpen, Play, RefreshCw, Smartphone, Sparkles, Trash2, UploadCloud, XCircle } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Spinner from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { useProject } from '../hooks/useProject';
import { useRunProgress } from '../hooks/useRunProgress';
import { mobileService } from '../services/mobile.service';
import { testcaseService } from '../services/testcase.service';
import { getErrorMessage } from '../services/api';
import { formatDate } from '../utils/formatters';

const GEN_OPTIONS = [3, 4, 5, 6, 8].map((n) => ({ value: String(n), label: `${n} test cases` }));
const RUN_OPTIONS = [3, 5, 10, 20].map((n) => ({ value: String(n), label: `Up to ${n} test cases` }));
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function Row({ ok, label, detail }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2.5 py-2">
      <Icon className={`mt-0.5 size-4 shrink-0 ${ok ? 'text-success' : 'text-danger'}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {detail && <p className="break-words text-xs text-muted">{detail}</p>}
      </div>
    </li>
  );
}

function Check({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function StatusCard({ status, loading, onRefresh }) {
  const ready = (status?.devices ?? []).filter((d) => d.state === 'device');
  const allOk = status?.appium.up && status?.adb.found && status?.client && ready.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment</CardTitle>
        <div className="flex items-center gap-2">
          {status && <Badge tone={allOk ? 'success' : 'warning'}>{allOk ? 'Ready' : 'Setup needed'}</Badge>}
          <Button size="sm" variant="secondary" icon={RefreshCw} loading={loading} onClick={onRefresh}>
            Check
          </Button>
        </div>
      </CardHeader>

      {!status ? (
        <div className="grid place-items-center py-6 text-brand">
          <Spinner className="size-6" />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line">
            <Row
              ok={status.appium.up}
              label="Appium server"
              detail={status.appium.up ? `Running${status.appium.version ? ` (v${status.appium.version})` : ''} at ${status.appium.url}` : `Not running at ${status.appium.url}. Start it with: appium`}
            />
            <Row ok={status.adb.found} label="Android platform-tools (adb)" detail={status.adb.error || undefined} />
            <Row ok={status.client} label="Appium Python client" detail={status.client ? undefined : 'Run: pip install Appium-Python-Client'} />
            <Row
              ok={ready.length > 0}
              label={`Devices (${ready.length} ready)`}
              detail={
                status.devices.length === 0
                  ? 'None found. Connect a phone with USB debugging, or start an emulator.'
                  : status.devices.map((d) => `${d.model || d.serial} · ${d.state}`).join(', ')
              }
            />
          </ul>
          {!allOk && <p className="mt-3 text-xs text-muted">Setup steps are in the README under Mobile testing.</p>}
        </>
      )}
    </Card>
  );
}

function AppCard({ projectId, config, devices, canWrite, onChanged }) {
  const toast = useToast();
  const [f, setF] = useState({ appPackage: config.appPackage, appActivity: config.appActivity, udid: config.udid });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setF({ appPackage: config.appPackage, appActivity: config.appActivity, udid: config.udid });
  }, [config]);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const options = [
    { value: '', label: 'Automatic (first ready device)' },
    ...devices.filter((d) => d.state === 'device').map((d) => ({ value: d.serial, label: `${d.model || 'Device'} (${d.serial})` })),
  ];
  if (f.udid && !options.some((o) => o.value === f.udid)) options.push({ value: f.udid, label: f.udid });

  async function run(name, fn, ok) {
    setBusy(name);
    try {
      onChanged(await fn());
      toast.success(ok);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  }

  function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) return toast.error('Choose a .apk file');
    run('apk', () => mobileService.uploadApk(projectId, file), 'APK uploaded');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>App under test</CardTitle>
        {config.hasApk || config.appPackage ? <Badge tone="success">Configured</Badge> : <Badge tone="neutral">Not set</Badge>}
      </CardHeader>

      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">APK file</p>
          {config.hasApk ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{config.apkName}</p>
                <p className="text-xs text-muted">
                  {config.apkSize ? mb(config.apkSize) : ''} · uploaded {formatDate(config.uploadedAt)}
                </p>
              </div>
              {canWrite && (
                <button
                  onClick={() => run('remove', () => mobileService.removeApk(projectId), 'APK removed')}
                  aria-label="Remove APK"
                  className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                >
                  {busy === 'remove' ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">No APK uploaded. You can also test an app that is already installed by entering its package name below.</p>
          )}
          {canWrite && (
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-medium text-brand hover:bg-primary-soft">
              {busy === 'apk' ? <Spinner className="size-4" /> : <UploadCloud className="size-4" />}
              {config.hasApk ? 'Replace APK' : 'Upload APK'}
              <input type="file" accept=".apk" className="sr-only" disabled={busy === 'apk'} onChange={pick} />
            </label>
          )}
        </div>

        <Input
          label="Package name"
          placeholder="com.example.app  (or com.android.settings to try it out)"
          value={f.appPackage}
          disabled={!canWrite}
          onChange={set('appPackage')}
        />
        <Input label="Start activity (optional)" placeholder="Only if the app does not start on its own" value={f.appActivity} disabled={!canWrite} onChange={set('appActivity')} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink">Device</label>
          <Select className="h-10" options={options} value={f.udid} disabled={!canWrite} onChange={set('udid')} />
        </div>

        {canWrite && (
          <Button
            loading={busy === 'save'}
            onClick={() =>
              run(
                'save',
                () =>
                  mobileService.save(projectId, {
                    appPackage: f.appPackage.trim() || undefined,
                    appActivity: f.appActivity.trim() || undefined,
                    udid: f.udid || undefined,
                  }),
                'Saved'
              )
            }
          >
            Save
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function MobileTesting() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const canWrite = user?.role !== 'VIEWER';

  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [caseCount, setCaseCount] = useState(null);
  const [perType, setPerType] = useState('4');
  const [genJob, setGenJob] = useState(null);
  const [genBusy, setGenBusy] = useState(false);
  const [maxCases, setMaxCases] = useState('5');
  const [smart, setSmart] = useState(true);
  const [grant, setGrant] = useState(false);
  const [starting, setStarting] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      setStatus(await mobileService.status());
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not check the environment'));
    } finally {
      setStatusLoading(false);
    }
  }, [toast]);

  const loadCount = useCallback(async () => {
    if (!projectId) return;
    try {
      const d = await testcaseService.list(projectId, { type: 'MOBILE', limit: 1 });
      setCaseCount(d.total);
    } catch {
      setCaseCount(0);
    }
  }, [projectId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    setConfig(null);
    setCaseCount(null);
    setGenJob(null);
    if (!projectId) return;
    let cancelled = false;
    mobileService
      .get(projectId)
      .then((c) => !cancelled && setConfig(c))
      .catch((err) => toast.error(getErrorMessage(err, 'Could not load the app settings')));
    loadCount();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadCount, toast]);

  const { snapshot } = useRunProgress({
    enabled: !!genJob && !!projectId,
    streamPath: genJob ? `/projects/${projectId}/testcases/generate/${genJob}/events` : null,
    statusPath: genJob ? `/projects/${projectId}/testcases/generate/${genJob}` : null,
    onFinish: (snap) => {
      if (snap.state === 'completed') toast.success(`Generated ${snap.result?.created ?? 0} mobile test cases`);
      else toast.error(snap.error || 'Generation failed');
      setGenJob(null);
      loadCount();
    },
  });

  async function onGenerate() {
    setGenBusy(true);
    try {
      const { jobId } = await testcaseService.generate(projectId, { types: ['MOBILE'], perType: Number(perType) });
      setGenJob(jobId);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not start generation'));
    } finally {
      setGenBusy(false);
    }
  }

  async function onStart() {
    setStarting(true);
    try {
      const run = await mobileService.run(projectId, {
        maxCases: Number(maxCases),
        smartOrder: smart,
        autoGrantPermissions: grant,
      });
      toast.info(`Run ${run.runCode} started`);
      navigate(`/execution/${run.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not start the run'));
    } finally {
      setStarting(false);
    }
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={Smartphone}
          title="No project selected"
          description="Create a project first, then set up its Android app here."
          action={
            <Link to="/projects">
              <Button>Go to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const configured = !!(config?.hasApk || config?.appPackage);
  const generating = !!genJob;
  const percent = snapshot?.progress?.percent ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Mobile Testing</h1>
          <p className="text-sm text-muted">Run AI-generated tests on an Android device or emulator. Android only.</p>
        </div>
        <Select
          icon={FolderOpen}
          options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
          value={current.id}
          onChange={(e) => setCurrent(e.target.value)}
          wrapperClassName="sm:w-72"
        />
      </div>

      <StatusCard status={status} loading={statusLoading} onRefresh={loadStatus} />

      {!config ? (
        <div className="grid place-items-center py-16 text-brand">
          <Spinner className="size-8" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
          <AppCard projectId={projectId} config={config} devices={status?.devices ?? []} canWrite={canWrite} onChanged={setConfig} />

          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mobile test cases</CardTitle>
                <Badge>{caseCount == null ? '...' : `${caseCount} total`}</Badge>
              </CardHeader>
              <p className="mb-4 text-sm text-muted">
                Generated from your indexed requirements: taps, swipes, permissions, rotation, notifications and deep links,
                as far as the requirements describe them.{' '}
                {caseCount > 0 && (
                  <Link to="/test-cases" className="font-medium text-brand hover:underline">
                    Review them on Test Cases (Mobile tab).
                  </Link>
                )}
              </p>
              {canWrite && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Select className="h-10" options={GEN_OPTIONS} value={perType} onChange={(e) => setPerType(e.target.value)} wrapperClassName="sm:w-48" />
                  <Button icon={Sparkles} loading={genBusy} disabled={generating} onClick={onGenerate}>
                    Generate mobile tests
                  </Button>
                </div>
              )}
              {generating && (
                <div className="mt-4">
                  <p className="mb-1.5 flex items-center gap-2 text-sm text-muted">
                    <Spinner className="size-3.5" /> {snapshot?.progress?.message || 'Starting...'}
                  </p>
                  <ProgressBar value={percent} />
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Run on the device</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <Select className="h-10" options={RUN_OPTIONS} value={maxCases} onChange={(e) => setMaxCases(e.target.value)} />
                <Check label="Smart order (recommended)" hint="Runs the tests most likely to catch a bug first." checked={smart} onChange={setSmart} />
                <Check
                  label="Grant permissions automatically"
                  hint="Off by default, so permission dialogs can be tested. Turn it on if dialogs block your tests."
                  checked={grant}
                  onChange={setGrant}
                />
                {canWrite && (
                  <Button icon={Play} loading={starting} disabled={!configured || !caseCount} onClick={onStart}>
                    Start mobile run
                  </Button>
                )}
                {!configured && <p className="text-xs text-muted">Set the app first (upload an APK or enter a package name).</p>}
                {configured && caseCount === 0 && <p className="text-xs text-muted">Generate mobile test cases first.</p>}
                <p className="text-xs text-muted">
                  Each test starts the app fresh and takes roughly 1 to 3 minutes on a laptop. Results, screenshots and bugs
                  appear on the run page like any other run.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}