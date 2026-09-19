import { z } from 'zod';

export const ROLES = ['ADMIN', 'QA_ENGINEER', 'DEVELOPER', 'VIEWER'];

const blank = (schema, replacement = undefined) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? replacement : v), schema);

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

export const roleSchema = z.object({ role: z.enum(ROLES) });

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(2000, 'Keep it under 2000 characters'),
});

// ───────── integrations ─────────

const isSlackUrl = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && x.hostname === 'hooks.slack.com';
  } catch {
    return false;
  }
};

const isJiraCloud = (u) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && x.hostname.endsWith('.atlassian.net') && x.hostname.length > 14;
  } catch {
    return false;
  }
};

export const slackSchema = z.object({
  // Empty means "keep the saved one"
  webhookUrl: blank(
    z
      .string()
      .trim()
      .refine(isSlackUrl, 'Use a Slack incoming webhook URL (https://hooks.slack.com/...)')
      .optional()
  ),
  enabled: z.boolean().default(true),
  onRunFailed: z.boolean().default(true),
  onCriticalBug: z.boolean().default(true),
});

export const jiraSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .refine(isJiraCloud, 'Use your Jira Cloud address, for example https://your-site.atlassian.net'),
  email: z.string().trim().email('Enter the email of your Atlassian account'),
  apiToken: blank(z.string().trim().min(8, 'That API token looks too short').max(500).optional()),
  projectKey: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,19}$/, 'Project key looks like ABC (letters and numbers)'),
  issueType: z.string().trim().min(1, 'Enter an issue type').max(40).default('Bug'),
  enabled: z.boolean().default(true),
  onCriticalBug: z.boolean().default(true),
});

export const emailSchema = z.object({
  recipients: z
    .array(z.string().trim().toLowerCase().email('Enter valid email addresses'))
    .min(1, 'Add at least one recipient')
    .max(10, 'Up to 10 recipients'),
  enabled: z.boolean().default(true),
  onRunFailed: z.boolean().default(true),
  onCriticalBug: z.boolean().default(true),
});

export const INTEGRATION_SCHEMAS = { SLACK: slackSchema, JIRA: jiraSchema, EMAIL: emailSchema };