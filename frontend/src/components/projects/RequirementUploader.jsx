import { useState } from 'react';
import { FileUp, Link2, UploadCloud } from 'lucide-react';
import Tabs from '../ui/Tabs';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import { projectService } from '../../services/project.service';
import { getErrorMessage } from '../../services/api';
import { MAX_UPLOAD_MB, REQUIREMENT_TYPE_OPTIONS, UPLOAD_ACCEPT } from '../../utils/constants';
import { cn } from '../../utils/cn';

const TABS = [
  { value: 'file', label: 'Upload file' },
  { value: 'url', label: 'Add URL' },
];

export default function RequirementUploader({ projectId, onAdded }) {
  const toast = useToast();
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [type, setType] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  function pick(f) {
    if (!f) return;
    const ext = `.${f.name.split('.').pop().toLowerCase()}`;
    if (!UPLOAD_ACCEPT.split(',').includes(ext)) return toast.error(`Unsupported file type "${ext}"`);
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) return toast.error(`File is larger than ${MAX_UPLOAD_MB} MB`);
    setFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function submitFile() {
    if (!file) return toast.error('Choose a file first');
    setBusy(true);
    try {
      const requirement = await projectService.uploadFile(projectId, { file, type });
      onAdded(requirement);
      setFile(null);
      setType('');
      toast.success('Uploaded. Indexing has started.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  }

  async function submitUrl() {
    if (!url.trim()) return toast.error('Enter a URL first');
    setBusy(true);
    try {
      const requirement = await projectService.addUrl(projectId, { url });
      onAdded(requirement);
      setUrl('');
      toast.success('URL added. Indexing has started.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add the URL'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Tabs tabs={TABS} value={mode} onChange={setMode} />

      {mode === 'file' ? (
        <>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line px-4 py-8 text-center transition-colors',
              'focus-within:outline-2 focus-within:outline-primary hover:bg-primary-soft/50',
              dragging && 'border-primary bg-primary-soft'
            )}
          >
            {file ? (
              <FileUp className="size-8 text-brand" />
            ) : (
              <UploadCloud className="size-8 text-brand" />
            )}
            <p className="mt-2 max-w-full truncate text-sm font-medium text-ink">
              {file ? file.name : 'Drop a file here or click to browse'}
            </p>
            <p className="mt-1 text-xs text-muted">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB`
                : `SRS, API spec or source code. PDF, DOCX, TXT, MD, JSON, YAML, code. Max ${MAX_UPLOAD_MB} MB.`}
            </p>
            <input
              type="file"
              accept={UPLOAD_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Content type</label>
            <Select
              className="h-10"
              options={REQUIREMENT_TYPE_OPTIONS}
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </div>

          <Button className="w-full" loading={busy} onClick={submitFile} disabled={!file}>
            Upload and index
          </Button>
        </>
      ) : (
        <>
          <Input
            label="Page or spec URL"
            icon={Link2}
            placeholder="https://example.com/docs/requirements"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-xs text-muted">
            Works for public pages, JSON/YAML specs and PDFs. Pages that need JavaScript to show
            their content can&apos;t be read; upload them as a file instead.
          </p>
          <Button className="w-full" loading={busy} onClick={submitUrl}>
            Add and index
          </Button>
        </>
      )}
    </div>
  );
}