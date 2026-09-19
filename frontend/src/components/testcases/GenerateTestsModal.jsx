import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { useToast } from '../ui/Toast';
import { projectService } from '../../services/project.service';
import { testcaseService } from '../../services/testcase.service';
import { getErrorMessage } from '../../services/api';
import { TEST_TYPES, TEST_TYPE_HINT, TEST_TYPE_LABEL } from '../../utils/constants';
import { cn } from '../../utils/cn';

const COUNT_OPTIONS = [2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} per type` }));

const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export default function GenerateTestsModal({ open, onClose, projectId, onStarted }) {
  const toast = useToast();
  const [types, setTypes] = useState(TEST_TYPES);
  const [perType, setPerType] = useState('3');
  const [moduleName, setModuleName] = useState('');
  const [requirements, setRequirements] = useState(null); // null = loading
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRequirements(null);
    projectService
      .listRequirements(projectId)
      .then((list) => {
        if (cancelled) return;
        const ready = list.filter((r) => r.status === 'READY');
        setRequirements(ready);
        setSelected(ready.map((r) => r.id));
      })
      .catch((err) => {
        if (cancelled) return;
        setRequirements([]);
        toast.error(getErrorMessage(err, 'Could not load requirements'));
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, toast]);

  const noRequirements = requirements !== null && requirements.length === 0;
  const canSubmit = types.length > 0 && selected.length > 0 && !busy;
  const total = types.length * Number(perType);

  async function submit() {
    setBusy(true);
    try {
      const payload = {
        types,
        perType: Number(perType),
        module: moduleName.trim() || undefined,
        // omit when everything is selected: the backend then uses all indexed requirements
        requirementIds: selected.length === requirements.length ? undefined : selected,
      };
      const { jobId } = await testcaseService.generate(projectId, payload);
      toast.info('Generation started');
      onStarted(jobId);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not start generation'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Generate test cases" className="sm:max-w-xl">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Test types</p>
          <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
            {TEST_TYPES.map((t) => {
              const on = types.includes(t);
              return (
                <label
                  key={t}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
                    on ? 'border-primary bg-primary-soft' : 'border-line hover:bg-primary-soft/50'
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={on}
                    onChange={() => setTypes((prev) => toggle(prev, t))}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{TEST_TYPE_LABEL[t]}</span>
                    <span className="block text-xs text-muted">{TEST_TYPE_HINT[t]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">How many</label>
            <Select className="h-10" options={COUNT_OPTIONS} value={perType} onChange={(e) => setPerType(e.target.value)} />
          </div>
          <Input
            label="Feature area (optional)"
            placeholder="e.g. Login"
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Requirements to use</p>
          {requirements === null ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-3.5" /> Loading...
            </div>
          ) : noRequirements ? (
            <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
              No indexed requirements yet. Upload one on the project page first.
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {requirements.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-primary-soft/50">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.includes(r.id)}
                      onChange={() => setSelected((prev) => toggle(prev, r.id))}
                    />
                    <span className="min-w-0 truncate text-sm text-ink">{r.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-muted">
          Up to {total} test cases. Local models take about a minute or two per type, and you can keep
          using the app while it runs.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button icon={Sparkles} loading={busy} disabled={!canSubmit || noRequirements} onClick={submit}>
            Generate
          </Button>
        </div>
      </div>
    </Modal>
  );
}