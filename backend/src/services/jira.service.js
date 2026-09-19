// Jira Cloud only. Restricting the host stops the server being pointed at internal addresses.
export function normalizeBase(baseUrl) {
  let u;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new Error('The Jira address is not a valid URL.');
  }
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.atlassian.net')) {
    throw new Error('Only Jira Cloud sites (https://your-site.atlassian.net) are supported.');
  }
  return u.origin;
}

const authHeader = (cfg) =>
  `Basic ${Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString('base64')}`;

function describeError(status, data) {
  if (status === 401) return 'Jira rejected the email or API token.';
  if (status === 403) return 'Jira denied access. The account may not have permission for this project.';
  if (status === 404) return 'Jira could not find that. Check the site address and project key.';
  const parts = [...(data?.errorMessages ?? []), ...Object.values(data?.errors ?? {})]
    .map(String)
    .filter(Boolean);
  return parts.length ? `Jira said: ${parts.join('; ').slice(0, 250)}` : `Jira returned HTTP ${status}.`;
}

async function jira(cfg, path, { method = 'GET', json } = {}) {
  const base = normalizeBase(cfg.baseUrl);
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: {
        Authorization: authHeader(cfg),
        Accept: 'application/json',
        ...(json ? { 'Content-Type': 'application/json' } : {}),
      },
      body: json ? JSON.stringify(json) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'Jira did not answer in time' : 'Could not reach Jira');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(describeError(res.status, data));
  return data;
}

// Checks the credentials and the project key without creating anything
export async function verifyJira(cfg) {
  const me = await jira(cfg, '/rest/api/3/myself');
  const project = await jira(cfg, `/rest/api/3/project/${encodeURIComponent(cfg.projectKey)}`);
  return { user: me?.displayName ?? cfg.email, project: project?.name ?? cfg.projectKey };
}

// Jira Cloud wants the description in Atlassian Document Format
const adf = (lines) => ({
  type: 'doc',
  version: 1,
  content: lines
    .filter((l) => typeof l === 'string' && l.trim())
    .map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l.slice(0, 3000) }] })),
});

export async function createIssue(cfg, { summary, lines }) {
  const data = await jira(cfg, '/rest/api/3/issue', {
    method: 'POST',
    json: {
      fields: {
        project: { key: cfg.projectKey },
        summary: summary.replace(/\s+/g, ' ').slice(0, 250),
        issuetype: { name: cfg.issueType || 'Bug' },
        description: adf(lines),
      },
    },
  });
  return { key: data.key, url: `${normalizeBase(cfg.baseUrl)}/browse/${data.key}` };
}