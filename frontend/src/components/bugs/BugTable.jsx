import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import SeverityBadge from './SeverityBadge';
import { Table, THead, TBody, Tr, Th, Td } from '../ui/Table';
import { BUG_STATUS_LABEL, BUG_STATUS_TONE } from '../../utils/constants';
import { formatDate } from '../../utils/formatters';

export default function BugTable({ items, onOpen }) {
  return (
    <Table className="min-w-[820px]">
      <THead>
        <Tr className="hover:bg-transparent">
          <Th>Bug</Th>
          <Th>Severity</Th>
          <Th>Status</Th>
          <Th className="w-32">AI confidence</Th>
          <Th>Run</Th>
          <Th>Found</Th>
        </Tr>
      </THead>
      <TBody>
        {items.map((b) => (
          <Tr key={b.id} className="cursor-pointer" onClick={() => onOpen(b)}>
            <Td className="max-w-md">
              <p className="truncate font-medium text-ink" title={b.title}>
                <span className="mr-2 text-xs font-semibold text-brand">{b.code}</span>
                {b.title}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                {b.module && <span>{b.module}</span>}
                {b.possibleDuplicate && <Badge tone="warning">Possible duplicate</Badge>}
              </div>
            </Td>
            <Td>
              {b.analyzed ? (
                <SeverityBadge severity={b.severity} />
              ) : (
                <Badge tone="neutral">Not analyzed</Badge>
              )}
            </Td>
            <Td>
              <Badge tone={BUG_STATUS_TONE[b.status]}>{BUG_STATUS_LABEL[b.status]}</Badge>
            </Td>
            <Td>
              {b.confidence != null ? (
                <div>
                  <ProgressBar value={b.confidence} />
                  <p className="mt-0.5 text-center text-[10px] text-muted">{Math.round(b.confidence)}%</p>
                </div>
              ) : (
                '—'
              )}
            </Td>
            <Td className="whitespace-nowrap text-muted">{b.runCode ?? '—'}</Td>
            <Td className="whitespace-nowrap text-muted">{formatDate(b.createdAt)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}