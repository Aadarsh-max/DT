import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Trash2, X } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { useToast } from '../ui/Toast';
import { getErrorMessage } from '../../services/api';
import {
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  PRIORITY_TONE,
  TEST_TYPE_LABEL,
  TEST_TYPE_OPTIONS,
  TEST_TYPE_TONE,
} from '../../utils/constants';
import { formatDate } from '../../utils/formatters';

const areaCls =
  'w-full resize-y rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20';

function Section({ title, children }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}

function View({ t }) {
  const steps = Array.isArray(t.steps) ? t.steps : [];
  const hasData = t.testData && Object.keys(t.testData).length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TEST_TYPE_TONE[t.type]}>{TEST_TYPE_LABEL[t.type]}</Badge>
        <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
        {t.module && <Badge>{t.module}</Badge>}
        <Badge>{t.generatedByAI ? 'AI generated' : 'Manual'}</Badge>
      </div>

      {t.description && (
        <Section title="Description">
          <p className="text-sm text-ink">{t.description}</p>
        </Section>
      )}
      {t.preconditions && (
        <Section title="Preconditions">
          <p className="text-sm text-ink">{t.preconditions}</p>
        </Section>
      )}
      <Section title="Steps">
        {steps.length === 0 ? (
          <p className="text-sm text-muted">No steps</p>
        ) : (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink marker:text-muted">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </Section>
      {t.expectedResult && (
        <Section title="Expected result">
          <p className="rounded-xl bg-success-soft p-3 text-sm text-ink">{t.expectedResult}</p>
        </Section>
      )}
      {hasData && (
        <Section title="Test data">
          <pre className="overflow-x-auto rounded-xl bg-page p-3 text-xs text-ink">
            {JSON.stringify(t.testData, null, 2)}
          </pre>
        </Section>
      )}
      <p className="text-xs text-muted">Created {formatDate(t.createdAt)}</p>
    </div>
  );
}

function EditForm({ t, onCancel, onSave }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: t.title,
    description: t.description ?? '',
    module: t.module ?? '',
    type: t.type,
    priority: t.priority,
    preconditions: t.preconditions ?? '',
    steps: (Array.isArray(t.steps) ? t.steps : []).join('\n'),
    expectedResult: t.expectedResult ?? '',
    testData: t.testData ? JSON.stringify(t.testData, null, 2) : '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();

    let testData = null;
    if (form.testData.trim()) {
      try {
        testData = JSON.parse(form.testData);
        if (typeof testData !== 'object' || Array.isArray(testData) || testData === null) {
          throw new Error();
        }
      } catch {
        return setError('Test data must be a valid JSON object, for example {"email": "a@b.com"}');
      }
    }
    setError('');

    setSaving(true);
    try {
      await onSave({
        title: form.title,
        description: form.description,
        module: form.module,
        type: form.type,
        priority: form.priority,
        preconditions: form.preconditions,
        steps: form.steps.split('\n').map((s) => s.trim()).filter(Boolean),
        expectedResult: form.expectedResult,
        testData,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save'));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Title" name="title" value={form.title} onChange={set} required />
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
        <Field label="Type">
          <Select className="h-10" name="type" options={TEST_TYPE_OPTIONS} value={form.type} onChange={set} />
        </Field>
        <Field label="Priority">
          <Select className="h-10" name="priority" options={PRIORITY_OPTIONS} value={form.priority} onChange={set} />
        </Field>
      </div>
      <Input label="Feature area" name="module" value={form.module} onChange={set} />
      <Field label="Description">
        <textarea name="description" rows={2} className={areaCls} value={form.description} onChange={set} />
      </Field>
      <Field label="Preconditions">
        <textarea name="preconditions" rows={2} className={areaCls} value={form.preconditions} onChange={set} />
      </Field>
      <Field label="Steps (one per line)">
        <textarea name="steps" rows={5} className={areaCls} value={form.steps} onChange={set} />
      </Field>
      <Field label="Expected result">
        <textarea name="expectedResult" rows={3} className={areaCls} value={form.expectedResult} onChange={set} />
      </Field>
      <Field label="Test data (JSON)">
        <textarea
          name="testData"
          rows={4}
          className={`${areaCls} font-mono text-xs`}
          value={form.testData}
          onChange={set}
        />
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </Field>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

export default function TestCaseDrawer({ testCase, onClose, onSave, onDelete, canEdit = true }) {
  const [editing, setEditing] = useState(false);

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

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-card shadow-card sm:max-w-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
          <h2 className="min-w-0 text-lg font-semibold text-ink">
            {editing ? 'Edit test case' : testCase.title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-primary-soft hover:text-brand"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {editing ? (
            <EditForm
              t={testCase}
              onCancel={() => setEditing(false)}
              onSave={async (payload) => {
                await onSave(testCase.id, payload);
                setEditing(false);
              }}
            />
          ) : (
            <View t={testCase} />
          )}
        </div>

        {!editing && canEdit && (
          <footer className="flex gap-2 border-t border-line p-4 sm:p-5">
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="secondary" icon={Trash2} className="text-danger" onClick={() => onDelete(testCase)}>
              Delete
            </Button>
          </footer>
        )}
      </aside>
    </div>,
    document.body
  );
}