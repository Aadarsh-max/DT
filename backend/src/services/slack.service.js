// Slack treats & < > as control characters, and <!channel> would ping everyone
export const slackEsc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function assertSlackUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new Error('That is not a valid URL.');
  }
  if (u.protocol !== 'https:' || u.hostname !== 'hooks.slack.com') {
    throw new Error('Use a Slack incoming webhook URL (https://hooks.slack.com/...).');
  }
}

export async function sendSlack(webhookUrl, text) {
  assertSlackUrl(webhookUrl);

  let res;
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'Slack did not answer in time' : 'Could not reach Slack');
  }

  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 80);
    throw new Error(`Slack rejected the message (HTTP ${res.status}${body ? `: ${body}` : ''})`);
  }
}