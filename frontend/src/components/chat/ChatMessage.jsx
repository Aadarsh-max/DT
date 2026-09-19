import { Fragment } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '../../utils/cn';

// **bold** and `code` only. Everything is rendered as React elements, never as raw HTML.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-page px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function toBlocks(text) {
  const out = [];
  let list = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const item = line.match(/^\s*(?:[-*\u2022]|\d+[.)])\s+(.*)$/);
    if (item) {
      const ordered = /^\s*\d/.test(line);
      if (!list || list.ordered !== ordered) {
        list = { ordered, items: [] };
        out.push(list);
      }
      list.items.push(item[1]);
      continue;
    }
    list = null;
    if (line.trim()) out.push({ text: line.replace(/^#{1,6}\s+/, '') });
  }
  return out;
}

export default function ChatMessage({ message }) {
  const mine = message.role === 'USER';

  if (mine) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-white">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-brand">
        <Bot className="size-4" />
      </span>
      <div className="min-w-0 max-w-[88%]">
        <div className={cn('space-y-2 break-words rounded-2xl rounded-tl-md border border-line bg-page px-3.5 py-2.5 text-sm text-ink')}>
          {toBlocks(message.content).map((b, i) =>
            b.items ? (
              b.ordered ? (
                <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-muted">
                  {b.items.map((t, j) => (
                    <li key={j}>{inline(t)}</li>
                  ))}
                </ol>
              ) : (
                <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted">
                  {b.items.map((t, j) => (
                    <li key={j}>{inline(t)}</li>
                  ))}
                </ul>
              )
            ) : (
              <p key={i}>{inline(b.text)}</p>
            )
          )}
        </div>
        {message.sources?.length > 0 && (
          <p className="mt-1 px-1 text-[11px] text-muted">Requirements used: {message.sources.join(', ')}</p>
        )}
      </div>
    </div>
  );
}