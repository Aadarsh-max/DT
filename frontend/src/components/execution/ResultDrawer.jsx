import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, X } from 'lucide-react';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import ApiResultPanel from '../api-testing/ApiResultPanel';
import { runService } from '../../services/run.service';
import {
  RESULT_STATUS_LABEL,
  RESULT_STATUS_TONE,
  TEST_TYPE_LABEL,
  TEST_TYPE_TONE,
} from '../../utils/constants';
import { formatMs } from '../../utils/formatters';

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

// The screenshot route needs the auth header, so the image is fetched as a blob
function Screenshot({ resultId }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    runService
      .screenshot(resultId)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [resultId]);

  if (failed) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <ImageOff className="size-4" /> Screenshot unavailable
      </p>
    );
  }
  if (!src) return <Spinner className="size-4 text-brand" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" title="Open full size">
      <img src={src} alt="Screenshot of the page when the test stopped" className="w-full rounded-xl border border-line" />
    </a>
  );
}

function actionText(a) {
  const t = a.target ? ` ${a.target.by}${a.target.role ? `/${a.target.role}` : ''} "${a.target.value}"` : '';
  const v = a.value ? ` = "${a.value}"` : '';
  return `${a.action}${t}${v}`;
}

export default function ResultDrawer({ resultId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(false);
    runService
      .result(resultId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const tc = detail?.testCase;
  const isApi = !!detail?.response?.request;
  const plan = detail?.response?.plan;
  const steps = Array.isArray(tc?.steps) ? tc.steps : [];

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-card shadow-card sm:max-w-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
          <h2 className="min-w-0 text-lg font-semibold text-ink">{tc?.title ?? 'Result'}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-primary-soft hover:text-brand"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {error && <p className="text-sm text-danger">Could not load this result.</p>}
          {!detail && !error && <Spinner className="size-6 text-brand" />}

          {detail && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={RESULT_STATUS_TONE[detail.status]}>{RESULT_STATUS_LABEL[detail.status]}</Badge>
                <Badge tone={TEST_TYPE_TONE[tc.type]}>{TEST_TYPE_LABEL[tc.type]}</Badge>
                {tc.module && <Badge>{tc.module}</Badge>}
                <span className="text-xs text-muted">{formatMs(detail.durationMs)}</span>
              </div>

              {detail.status === 'ERROR' && (
                <p className="rounded-xl bg-warning-soft p-3 text-xs text-ink">
                  Error means the test could not be carried out (for example an element was not found), so
                  it is not proof of a bug. Check the screenshot and the steps below.
                </p>
              )}
              {detail.errorMessage && !isApi && (
                <p className="rounded-xl bg-danger-soft p-3 text-sm text-ink">{detail.errorMessage}</p>
              )}

              {detail.screenshotPath && (
                <Section title="Screenshot">
                  <Screenshot resultId={detail.id} />
                </Section>
              )}

              {isApi ? (
                <ApiResultPanel
                  showVerdict={false}
                  result={{
                    status: detail.status,
                    durationMs: detail.durationMs,
                    errorMessage: detail.errorMessage,
                    logs: detail.logs ? detail.logs.split('\n') : [],
                    response: detail.response,
                  }}
                />
              ) : (
                detail.logs && (
                  <Section title="Execution log">
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#0f0e1f] p-3 font-mono text-xs text-[#e5e7ff]">
                      {detail.logs}
                    </pre>
                  </Section>
                )
              )}

              {Array.isArray(plan) && plan.length > 0 && (
                <Section title="Script the AI ran">
                  <ol className="list-decimal space-y-1 rounded-xl bg-page p-3 pl-8 font-mono text-xs text-ink marker:text-muted">
                    {plan.map((a, i) => (
                      <li key={i}>{actionText(a)}</li>
                    ))}
                  </ol>
                </Section>
              )}

              <Section title="Test case steps">
                {steps.length === 0 ? (
                  <p className="text-sm text-muted">No steps</p>
                ) : (
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-ink marker:text-muted">
                    {steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                )}
              </Section>
              {tc.expectedResult && (
                <Section title="Expected result">
                  <p className="rounded-xl bg-success-soft p-3 text-sm text-ink">{tc.expectedResult}</p>
                </Section>
              )}
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body
  );
}