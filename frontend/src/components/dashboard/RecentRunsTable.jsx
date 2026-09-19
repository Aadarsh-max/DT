import { Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle } from '../ui/Card';
import Badge from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { Table, THead, TBody, Tr, Th, Td } from '../ui/Table';
import { RUN_STATUS_LABEL, RUN_STATUS_TONE } from '../../utils/constants';
import { formatDateTime, formatPercent } from '../../utils/formatters';

function coverageTone(v) {
  if (v >= 80) return 'success';
  if (v >= 50) return 'warning';
  return 'danger';
}

export default function RecentRunsTable({ runs }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Test Runs</CardTitle>
        <Link to="/execution" className="text-xs font-medium text-brand hover:underline">
          View All
        </Link>
      </CardHeader>

      {runs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No runs yet. Start one with New Test Run.</p>
      ) : (
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
                <Td className="whitespace-nowrap font-medium">
                  <Link to={`/execution/${r.id}`} className="text-brand hover:underline">
                    {r.runCode}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{r.projectName}</Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(r.startedAt)}</Td>
                <Td>
                  <Badge tone={RUN_STATUS_TONE[r.status]}>{RUN_STATUS_LABEL[r.status]}</Badge>
                </Td>
                <Td>{r.passed}</Td>
                <Td>{r.failed}</Td>
                <Td>
                  {r.coverage == null ? (
                    '—'
                  ) : (
                    <div>
                      <ProgressBar value={r.coverage} tone={coverageTone(r.coverage)} />
                      <p className="mt-0.5 text-center text-[10px] text-muted">{formatPercent(r.coverage)}</p>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}