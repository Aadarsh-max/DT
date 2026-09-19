import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Globe, KeyRound, Send, Cog } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import EndpointList, { readApiCase } from '../components/api-testing/EndpointList';
import ApiResultPanel from '../components/api-testing/ApiResultPanel';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { useProject } from '../hooks/useProject';
import { runService } from '../services/run.service';
import { testcaseService } from '../services/testcase.service';
import { getErrorMessage } from '../services/api';
import { HTTP_METHODS } from '../utils/constants';

const areaCls =
  'w-full resize-y rounded-xl border border-line bg-card px-3 py-2 font-mono text-xs text-ink placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20';

const METHOD_OPTIONS = HTTP_METHODS.map((m) => ({ value: m, label: m }));
const asJson = (v) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 2));

export default function ApiTesting() {
  const toast = useToast();
  const { user } = useAuth();
  const { projects, current, setCurrent } = useProject();
  const projectId = current?.id;
  const canWrite = user?.role !== 'VIEWER';

  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [activeId, setActiveId] = useState(null);

  const [form, setForm] = useState({
    baseUrl: '',
    authToken: '',
    method: 'GET',
    endpoint: '',
    expectedStatus: '',
    headers: '',
    body: '',
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setForm((f) => ({ ...f, baseUrl: current?.baseUrl ?? '' }));
    setResult(null);
    setActiveId(null);
  }, [current?.id, current?.baseUrl]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoadingCases(true);
    testcaseService
      .list(projectId, { type: 'API', search: debounced, limit: 100 })
      .then((d) => !cancelled && setCases(d.items))
      .catch(() => !cancelled && setCases([]))
      .finally(() => !cancelled && setLoadingCases(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, debounced]);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  function select(tc) {
    const c = readApiCase(tc);
    setActiveId(tc.id);
    setResult(null);
    setForm((f) => ({
      ...f,
      method: HTTP_METHODS.includes(c.method) ? c.method : 'GET',
      endpoint: c.endpoint,
      expectedStatus: c.expectedStatus != null ? String(c.expectedStatus) : '',
      headers: asJson(c.headers),
      body: asJson(c.body),
    }));
  }

  async function send() {
    if (!form.endpoint.trim()) return toast.error('Enter an endpoint or a full URL');

    let headers;
    if (form.headers.trim()) {
      try {
        const parsed = JSON.parse(form.headers);
        if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) throw new Error();
        headers = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]));
      } catch {
        return toast.error('Headers must be a JSON object, for example {"Accept": "application/json"}');
      }
    }

    let body;
    if (form.body.trim()) {
      try {
        body = JSON.parse(form.body);
      } catch {
        body = form.body; // not JSON: sent as plain text
      }
    }

    setSending(true);
    try {
      setResult(
        await runService.apiTest(projectId, {
          baseUrl: form.baseUrl.trim() || undefined,
          authToken: form.authToken.trim() || undefined,
          method: form.method,
          endpoint: form.endpoint.trim(),
          headers,
          body,
          expectedStatus: form.expectedStatus.trim() ? Number(form.expectedStatus) : undefined,
        })
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Request failed'));
    } finally {
      setSending(false);
    }
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={Cog}
          title="No project selected"
          description="Create a project first, then try its API endpoints here."
          action={
            <Link to="/projects">
              <Button>Go to projects</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">API Testing</h1>
          <p className="text-sm text-muted">
            Send one request and check the response. Pick a generated API test case to fill the form.
          </p>
        </div>
        <Select
          icon={FolderOpen}
          options={projects.map((p) => ({ value: p.id, label: `Project: ${p.name}` }))}
          value={current.id}
          onChange={(e) => setCurrent(e.target.value)}
          wrapperClassName="sm:w-72"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>API test cases</CardTitle>
          </CardHeader>
          <EndpointList
            items={cases}
            loading={loadingCases}
            activeId={activeId}
            onSelect={select}
            search={search}
            onSearch={setSearch}
          />
        </Card>

        <div className="space-y-4 sm:space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label="Base URL" name="baseUrl" icon={Globe} placeholder="https://api.example.com" value={form.baseUrl} onChange={set} />
                <Input
                  label="Bearer token (optional)"
                  name="authToken"
                  type="password"
                  icon={KeyRound}
                  autoComplete="off"
                  value={form.authToken}
                  onChange={set}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-[9rem_1fr_8rem]">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Method</label>
                  <Select className="h-10" name="method" options={METHOD_OPTIONS} value={form.method} onChange={set} />
                </div>
                <Input label="Endpoint or full URL" name="endpoint" placeholder="/api/products" value={form.endpoint} onChange={set} />
                <Input label="Expected status" name="expectedStatus" inputMode="numeric" placeholder="200" value={form.expectedStatus} onChange={set} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Headers (JSON)</label>
                  <textarea name="headers" rows={4} className={areaCls} value={form.headers} onChange={set} placeholder='{"Accept": "application/json"}' />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Body</label>
                  <textarea name="body" rows={4} className={areaCls} value={form.body} onChange={set} placeholder='{"email": "a@b.com"}' />
                </div>
              </div>

              {canWrite && (
                <Button icon={Send} loading={sending} onClick={send}>
                  Send request
                </Button>
              )}
            </div>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Result</CardTitle>
              </CardHeader>
              <ApiResultPanel result={result} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}