import Card, { CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { Table, THead, TBody, Tr, Th, Td } from '../ui/Table';
import { formatPercent } from '../../utils/formatters';

const statusTone = { Completed: 'success', Failed: 'danger', Running: 'info' };

function coverageTone(v) {
  if (v >= 85) return 'success';
  if (v >= 80) return 'warning';
  return 'danger';
}

export default function RecentRunsTable({ runs }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Test Runs</CardTitle>
        <a href="/execution" className="text-xs font-medium text-brand hover:underline">
          View All
        </a>
      </CardHeader>

      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th>Test Run ID</Th>
            <Th>Project</Th>
            <Th>Started At</Th>
            <Th>Status</Th>
            <Th>Passed</Th>
            <Th>Failed</Th>
            <Th className="w-32">Coverage</Th>
          </Tr>
        </THead>
        <TBody>
          {runs.map((r) => (
            <Tr key={r.id}>
              <Td className="whitespace-nowrap font-medium">{r.id}</Td>
              <Td className="whitespace-nowrap">{r.project}</Td>
              <Td className="whitespace-nowrap text-muted">{r.at}</Td>
              <Td>
                <Badge tone={statusTone[r.status]}>{r.status}</Badge>
              </Td>
              <Td>{r.passed ?? '—'}</Td>
              <Td>{r.failed ?? '—'}</Td>
              <Td>
                {r.coverage == null ? (
                  '—'
                ) : (
                  <div>
                    <ProgressBar value={r.coverage} tone={coverageTone(r.coverage)} />
                    <p className="mt-0.5 text-center text-[10px] text-muted">
                      {formatPercent(r.coverage)}
                    </p>
                  </div>
                )}
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}