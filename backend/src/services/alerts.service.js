import { prisma } from '../config/db.js';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { createJiraIssueForBug, getActiveIntegrations } from './integration.service.js';
import { sendMail } from './mail.service.js';
import { notifyProject } from './notification.service.js';
import { sendSlack, slackEsc as esc } from './slack.service.js';

const MAX_EXTERNAL = 8; // external alert batches per project
const WINDOW_SECONDS = 600;

const clip = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const url = (path) => `${env.CLIENT_URL.replace(/\/$/, '')}${path}`;
const bugCode = (n) => `BUG-${String(n).padStart(4, '0')}`;

// Stops a burst of alerts (for example 10 critical bugs in one run) from flooding Slack or a mailbox
async function externalAllowed(projectId) {
  try {
    const key = `alerts:${projectId}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, WINDOW_SECONDS);
    return n <= MAX_EXTERNAL;
  } catch {
    return true;
  }
}

async function deliver(cfg, event, { slack, subject, text }) {
  const jobs = [];
  if (cfg.SLACK && cfg.SLACK[event] !== false) jobs.push(['Slack', sendSlack(cfg.SLACK.webhookUrl, slack)]);
  if (cfg.EMAIL && cfg.EMAIL[event] !== false && cfg.EMAIL.recipients?.length) {
    jobs.push(['Email', sendMail({ to: cfg.EMAIL.recipients, subject, text })]);
  }
  const results = await Promise.allSettled(jobs.map(([, p]) => p));
  results.forEach((r, i) => {
    if (r.status === 'rejected') logger.warn(`${jobs[i][0]} alert failed: ${r.reason?.message}`);
  });
}

// Called when a run ends. Never throws.
export async function notifyRunFinished(runId) {
  try {
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: { project: { select: { name: true } } },
    });
    if (!run) return;

    const crashed = run.status === 'FAILED';
    if (!crashed && !(run.status === 'COMPLETED' && run.failed > 0)) return;

    const groups = await prisma.testResult.groupBy({
      by: ['status'],
      where: { runId },
      _count: { _all: true },
    });
    const n = Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
    const counts = `${n.PASSED ?? 0} passed, ${n.FAILED ?? 0} failed, ${n.ERROR ?? 0} error, ${n.SKIPPED ?? 0} skipped`;
    const detail = crashed && run.errorMsg ? `${clip(run.errorMsg, 140)} ` : '';
    const title = crashed ? `Run ${run.runCode} failed to finish` : `Run ${run.runCode} finished with failures`;
    const path = `/execution/${runId}`;

    await notifyProject(run.projectId, { title, message: `${run.project.name}: ${detail}(${counts})`, link: path });

    if (!(await externalAllowed(run.projectId))) return;
    const cfg = await getActiveIntegrations(run.projectId);
    await deliver(cfg, 'onRunFailed', {
      slack: [
        `:x: *${esc(title)}* in *${esc(run.project.name)}*`,
        esc(`${detail}${counts}`),
        `<${url(path)}|Open the run>`,
      ].join('\n'),
      subject: `[AI Testing Engineer] ${title} (${run.project.name})`,
      text: [`${title}`, `Project: ${run.project.name}`, `${detail}${counts}`, `Open: ${url(path)}`].join('\n'),
    });
  } catch (e) {
    logger.warn(`Run alert skipped: ${e.message}`);
  }
}

// Called when an analysis makes a bug Critical. Never throws.
export async function notifyCriticalBug(bugId) {
  try {
    const bug = await prisma.bug.findUnique({
      where: { id: bugId },
      include: { project: { select: { name: true } } },
    });
    if (!bug || bug.severity !== 'CRITICAL') return;

    const code = bugCode(bug.number);
    const path = `/bugs/${bug.id}`;
    await notifyProject(bug.projectId, {
      title: `Critical bug ${code}`,
      message: `${bug.project.name}: ${clip(bug.title, 150)}`,
      link: path,
    });

    if (!(await externalAllowed(bug.projectId))) return;
    const cfg = await getActiveIntegrations(bug.projectId);

    // Jira first, so the Slack message and the email can link to the issue
    let jira = bug.jiraKey ? { key: bug.jiraKey, url: bug.jiraUrl } : null;
    if (!jira && cfg.JIRA && cfg.JIRA.onCriticalBug !== false) {
      try {
        jira = await createJiraIssueForBug(bug.id, null);
      } catch (e) {
        logger.warn(`Automatic Jira issue failed: ${e.message}`);
      }
    }

    await deliver(cfg, 'onCriticalBug', {
      slack: [
        `:rotating_light: *Critical bug ${code}* in *${esc(bug.project.name)}*`,
        esc(clip(bug.title, 150)),
        bug.aiExplanation ? esc(clip(bug.aiExplanation, 250)) : null,
        jira ? `Jira: <${jira.url}|${esc(jira.key)}>` : null,
        `<${url(path)}|Open the bug>`,
      ]
        .filter(Boolean)
        .join('\n'),
      subject: `[AI Testing Engineer] Critical bug ${code} in ${bug.project.name}`,
      text: [
        `Critical bug ${code} in ${bug.project.name}`,
        clip(bug.title, 200),
        bug.aiExplanation ? clip(bug.aiExplanation, 400) : null,
        jira ? `Jira: ${jira.key} ${jira.url}` : null,
        `Open: ${url(path)}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  } catch (e) {
    logger.warn(`Critical bug alert skipped: ${e.message}`);
  }
}