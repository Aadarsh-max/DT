import { useMemo } from 'react';
import { Copy, Download } from 'lucide-react';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';

function lineClass(l) {
  if (l.startsWith('#')) return 'italic text-[#9ca3c0]';
  if (l.startsWith('+++') || l.startsWith('---')) return 'font-semibold text-[#e5e7ff]';
  if (l.startsWith('@@')) return 'text-[#a5a0ff]';
  if (l.startsWith('+')) return 'bg-success/15 text-[#86efac]';
  if (l.startsWith('-')) return 'bg-danger/15 text-[#fca5a5]';
  return 'text-[#e5e7ff]';
}

export default function FixDiffViewer({ patch, filename = 'suggested-fix.patch' }) {
  const toast = useToast();
  const lines = useMemo(() => patch.split('\n'), [patch]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(patch);
      toast.success('Patch copied');
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([patch], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="max-h-96 overflow-auto rounded-xl bg-[#0f0e1f] py-2 font-mono text-xs leading-relaxed">
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre px-3 ${lineClass(l)}`}>
            {l || ' '}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>
          Copy patch
        </Button>
        <Button size="sm" variant="secondary" icon={Download} onClick={download}>
          Download
        </Button>
      </div>
      <p className="text-xs text-muted">
        AI-suggested and not tested. Review it before you change any code. Nothing is applied for you.
      </p>
    </div>
  );
}