import { useState } from 'react';
import { FolderKanban, Globe } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import { getErrorMessage } from '../../services/api';
import { PLATFORM_OPTIONS } from '../../utils/constants';

export default function ProjectForm({ initial, submitLabel = 'Save', onSubmit, onCancel }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    baseUrl: initial?.baseUrl ?? '',
    platform: initial?.platform ?? 'WEB',
  });
  const [saving, setSaving] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save the project'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Project name"
        name="name"
        icon={FolderKanban}
        placeholder="E-Commerce Web App"
        value={form.name}
        onChange={onChange}
        required
      />

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-ink">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={form.description}
          onChange={onChange}
          placeholder="What does this application do?"
          className="w-full resize-y rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-2 focus:outline-primary/20"
        />
      </div>

      <Input
        label="Base URL (optional)"
        name="baseUrl"
        icon={Globe}
        placeholder="https://staging.example.com"
        value={form.baseUrl}
        onChange={onChange}
      />

      <div>
        <label htmlFor="platform" className="mb-1.5 block text-sm font-medium text-ink">
          Platform
        </label>
        <Select
          id="platform"
          name="platform"
          className="h-10"
          options={PLATFORM_OPTIONS}
          value={form.platform}
          onChange={onChange}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}