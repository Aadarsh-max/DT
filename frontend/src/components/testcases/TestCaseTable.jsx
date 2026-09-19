import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { Table, THead, TBody, Tr, Th, Td } from '../ui/Table';
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  TEST_TYPE_LABEL,
  TEST_TYPE_TONE,
} from '../../utils/constants';

export default function TestCaseTable({ items, selectedIds, onToggle, onToggleAll, onOpen }) {
  const allSelected = items.length > 0 && items.every((t) => selectedIds.includes(t.id));

  return (
    <Table className="min-w-[820px]">
      <THead>
        <Tr className="hover:bg-transparent">
          <Th className="w-10">
            <input
              type="checkbox"
              aria-label="Select all on this page"
              className="size-4 accent-primary"
              checked={allSelected}
              onChange={onToggleAll}
            />
          </Th>
          <Th>Test case</Th>
          <Th>Type</Th>
          <Th>Priority</Th>
          <Th className="w-28" title="How likely this test is to catch a bug, from the last smart-ordered run">
            Run priority
          </Th>
          <Th>Steps</Th>
          <Th>Source</Th>
        </Tr>
      </THead>
      <TBody>
        {items.map((t) => (
          <Tr key={t.id} className="cursor-pointer" onClick={() => onOpen(t)}>
            <Td>
              <input
                type="checkbox"
                aria-label={`Select ${t.title}`}
                className="size-4 accent-primary"
                checked={selectedIds.includes(t.id)}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggle(t.id)}
              />
            </Td>
            <Td className="max-w-md">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(t);
                }}
                className="block max-w-full truncate text-left font-medium text-ink hover:text-brand"
                title={t.title}
              >
                {t.title}
              </button>
              {t.module && <p className="mt-0.5 text-xs text-muted">{t.module}</p>}
            </Td>
            <Td>
              <Badge tone={TEST_TYPE_TONE[t.type]}>{TEST_TYPE_LABEL[t.type]}</Badge>
            </Td>
            <Td>
              <Badge tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
            </Td>
            <Td>
              {t.priorityScore != null ? (
                <div>
                  <ProgressBar value={t.priorityScore * 100} />
                  <p className="mt-0.5 text-center text-[10px] text-muted">{Math.round(t.priorityScore * 100)}%</p>
                </div>
              ) : (
                <span className="text-muted">—</span>
              )}
            </Td>
            <Td className="text-muted">{Array.isArray(t.steps) ? t.steps.length : 0}</Td>
            <Td>
              <Badge>{t.generatedByAI ? 'AI' : 'Manual'}</Badge>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}