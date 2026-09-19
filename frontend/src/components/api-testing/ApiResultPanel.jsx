import Badge from '../ui/Badge';
import { RESULT_STATUS_LABEL, RESULT_STATUS_TONE } from '../../utils/constants';
import { formatMs } from '../../utils/formatters';

function pretty(text) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function Block({ title, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

const Pre = ({ children }) => (
  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-page p-3 text-xs text-ink">
    {children}
  </pre>
);

// result: { status, durationMs, errorMessage, logs, response: { request, response } }
export default function ApiResultPanel({ result, showVerdict = true }) {
  const req = result.response?.request;
  const res = result.response?.response;
  const httpTone = res ? (res.status < 400 ? 'success' : 'danger') : 'neutral';

  return (
    <div className="space-y-4">
      {showVerdict && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={RESULT_STATUS_TONE[result.status]}>{RESULT_STATUS_LABEL[result.status]}</Badge>
          {res && <Badge tone={httpTone}>HTTP {res.status}</Badge>}
          <span className="text-xs text-muted">{formatMs(res?.elapsed_ms ?? result.durationMs)}</span>
        </div>
      )}

      {result.errorMessage && (
        <p className="rounded-xl bg-danger-soft p-3 text-sm text-ink">{result.errorMessage}</p>
      )}

      {result.logs?.length > 0 && (
        <Block title="Checks">
          <Pre>{result.logs.join('\n')}</Pre>
        </Block>
      )}

      {req && (
        <Block title="Request">
          <Pre>
            {`${req.method} ${req.url}`}
            {req.headers && Object.keys(req.headers).length > 0 && `\n${JSON.stringify(req.headers, null, 2)}`}
            {req.body != null && `\n\n${typeof req.body === 'string' ? req.body : JSON.stringify(req.body, null, 2)}`}
          </Pre>
        </Block>
      )}

      {res && (
        <Block title="Response">
          <Pre>
            {res.headers && Object.keys(res.headers).length > 0 && `${JSON.stringify(res.headers, null, 2)}\n\n`}
            {res.body ? pretty(res.body) : '(empty body)'}
            {res.truncated && '\n... (truncated)'}
          </Pre>
        </Block>
      )}
    </div>
  );
}