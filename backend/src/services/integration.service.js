import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { seal, tryUnseal, unseal } from '../utils/secrets.js';
import { createIssue, verifyJira } from './jira.service.js';
import { mailConfigured, sendMail } from './mail.service.js';
import { assertProjectAccess } from './project.service.js';
import { sendSlack, slackEsc } from './slack.service.js';

export const TYPES = ['SLACK', 'JIRA', 'EMAIL'];
const bugCode = (n) => `BUG-${String(n).padStart(4, '0')}`;
const hint = (s) => (s ? `••••${s.slice(-4)}` : null);

const isManager = (project, user) => user.role === 'ADMIN' || project.ownerId === user.id;

// External failures become 502 with the provider's message
async function external(fn) {
  try {
    return await fn();
  } catch (e) {
    throw new ApiError(502, e.message);
  }
}

// What the browser may see. Secrets are never included, only a hint of the last 4 characters.
function publicView(type, row) {
  if (!row) return null;
  const c = row.config ?? {};
  if (type === 'SLACK') {
    const s = tryUnseal(c.webhookUrl);
    return {
      enabled: row.enabled,
      onRunFailed: c.onRunFailed !== false,
      onCriticalBug: c.onCriticalBug !== false,
      secretSet: !!s,
      secretHint: hint(s),
    };
  }
  if (type === 'JIRA') {
    const s = tryUnseal(c.apiToken);
    return {
      enabled: row.enabled,
      baseUrl: c.baseUrl ?? '',
      email: c.email ?? '',
      projectKey: c.projectKey ?? '',
      issueType: c.issueType ?? 'Bug',
      onCriticalBug: c.onCriticalBug !== false,
      secretSet: !!s,
      secretHint: hint(s),
    };
  }
  return {
    enabled: row.enabled,
    recipients: c.recipients ?? [],
    onRunFailed: c.onRunFailed !== false,
    onCriticalBug: c.onCriticalBug !== false,
  };
}

export async function listIntegrations(projectId, user) {
  const project = await assertProjectAccess(projectId, user);
  const rows = await prisma.integration.findMany({ where: { projectId } });
  const byType = Object.fromEntries(rows.map((r) => [r.type, r]));
  return {
    integrations: Object.fromEntries(TYPES.map((t) => [t, publicView(t, byType[t])])),
    emailAvailable: mailConfigured(),
    canManage: isManager(project, user),
  };
}

export async function saveIntegration(projectId, user, type, input) {
  await assertProjectAccess(projectId, user, { manage: true });
  const existing = await prisma.integration.findUnique({
    where: { projectId_type: { projectId, type } },
  });
  const prev = existing?.config ?? {};

  let config;
  if (type === 'SLACK') {
    if (!input.webhookUrl && !tryUnseal(prev.webhookUrl)) throw ApiError.badRequest('Enter the Slack webhook URL');
    config = {
      webhookUrl: input.webhookUrl ? seal(input.webhookUrl) : prev.webhookUrl,
      onRunFailed: input.onRunFailed,
      onCriticalBug: input.onCriticalBug,
    };
  } else if (type === 'JIRA') {
    if (!input.apiToken && !tryUnseal(prev.apiToken)) throw ApiError.badRequest('Enter the Jira API token');
    config = {
      baseUrl: new URL(input.baseUrl).origin,
      email: input.email,
      apiToken: input.apiToken ? seal(input.apiToken) : prev.apiToken,
      projectKey: input.projectKey,
      issueType: input.issueType,
      onCriticalBug: input.onCriticalBug,
    };
  } else {
    config = {
      recipients: [...new Set(input.recipients)],
      onRunFailed: input.onRunFailed,
      onCriticalBug: input.onCriticalBug,
    };
  }

  const row = await prisma.integration.upsert({
    where: { projectId_type: { projectId, type } },
    update: { config, enabled: input.enabled },
    create: { projectId, type, config, enabled: input.enabled },
  });
  return publicView(type, row);
}

export async function removeIntegration(projectId, user, type) {
  await assertProjectAccess(projectId, user, { manage: true });
  await prisma.integration.deleteMany({ where: { projectId, type } });
}

// Decrypted configs of every ENABLED integration. Used by the alerts.
export async function getActiveIntegrations(projectId) {
  const rows = await prisma.integration.findMany({ where: { projectId, enabled: true } });
  const out = {};
  for (const r of rows) {
    const c = r.config ?? {};
    try {
      if (r.type === 'SLACK') out.SLACK = { ...c, webhookUrl: unseal(c.webhookUrl) };
      else if (r.type === 'JIRA') out.JIRA = { ...c, apiToken: unseal(c.apiToken) };
      else out.EMAIL = c;
    } catch {
      logger.warn(`Skipping ${r.type} for project ${projectId}: the saved secret cannot be read`);
    }
  }
  return out;
}

export async function testIntegration(projectId, user, type) {
  const project = await assertProjectAccess(projectId, user, { manage: true });
  const row = await prisma.integration.findUnique({ where: { projectId_type: { projectId, type } } });
  if (!row) throw ApiError.badRequest('Save the settings first. The test uses what is saved.');
  const c = row.config ?? {};

  if (type === 'SLACK') {
    const url = tryUnseal(c.webhookUrl);
    if (!url) throw ApiError.badRequest('The saved webhook cannot be read. Enter it again and save.');
    await external(() =>
      sendSlack(url, `:white_check_mark: Test message from *AI Testing Engineer* for *${slackEsc(project.name)}*. Alerts will appear here.`)
    );
    return { message: 'Test message sent to Slack' };
  }

  if (type === 'JIRA') {
    const token = tryUnseal(c.apiToken);
    if (!token) throw ApiError.badRequest('The saved API token cannot be read. Enter it again and save.');
    const r = await external(() => verifyJira({ ...c, apiToken: token }));
    return { message: `Connected as ${r.user}. Project "${r.project}" found.` };
  }

  await external(() =>
    sendMail({
      to: c.recipients ?? [],
      subject: `Test email from AI Testing Engineer (${project.name})`,
      text: `This is a test email for the project "${project.name}".\nAlerts will be sent to this address.`,
    })
  );
  return { message: `Test email sent to ${(c.recipients ?? []).join(', ')}` };
}

// user = null when called by an automatic alert
export async function createJiraIssueForBug(bugId, user) {
  const bug = await prisma.bug.findUnique({
    where: { id: bugId },
    include: {
      project: { select: { name: true } },
      run: { select: { runCode: true } },
      testResult: { select: { errorMessage: true, testCase: { select: { expectedResult: true } } } },
    },
  });
  if (!bug) throw ApiError.notFound('Bug not found');
  if (user) await assertProjectAccess(bug.projectId, user);
  if (bug.jiraKey) throw ApiError.conflict(`Already linked to ${bug.jiraKey}`);

  const cfg = (await getActiveIntegrations(bug.projectId)).JIRA;
  if (!cfg) throw ApiError.badRequest('Jira is not connected for this project. Set it up on the Integrations page.');

  const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const code = bugCode(bug.number);
  const issue = await external(() =>
    createIssue(cfg, {
      summary: `[${code}] ${bug.title}`,
      lines: [
        `Severity: ${bug.severity}`,
        bug.module ? `Feature area: ${bug.module}` : null,
        bug.run ? `Found in run: ${bug.run.runCode} (project ${bug.project.name})` : null,
        bug.testResult?.testCase?.expectedResult ? `Expected: ${bug.testResult.testCase.expectedResult}` : null,
        bug.testResult?.errorMessage ? `Actual: ${bug.testResult.errorMessage}` : null,
        bug.aiExplanation ? `AI explanation: ${bug.aiExplanation}` : null,
        bug.recommendedFix ? `Recommended fix: ${bug.recommendedFix}` : null,
        `Open in AI Testing Engineer: ${base}/bugs/${bug.id}`,
      ].filter(Boolean),
    })
  );

  await prisma.bug.update({ where: { id: bugId }, data: { jiraKey: issue.key, jiraUrl: issue.url } });
  return issue;
}