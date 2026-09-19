// Temporary data for the Phase 2 dashboard. Replaced by real API data in later phases.
export const mockProjects = [
  { value: 'ecom', label: 'Project: E-Commerce Web App' },
  { value: 'users', label: 'Project: User Management API' },
  { value: 'pay', label: 'Project: Payment Gateway API' },
];

export const mockStats = {
  total: 1248,
  totalDelta: 12.5,
  executed: 987,
  executedPct: 85.4,
  passed: 843,
  passedPct: 85.4,
  failed: 144,
  failedPct: 14.6,
  bugs: 58,
};

export const mockRun = {
  progress: 72,
  elapsed: '00:12:45',
  stageIndex: 2,
  stages: [
    'Requirements Analysis',
    'Test Case Generation',
    'Test Execution',
    'Bug Analysis',
    'Report Generation',
  ],
  ui: 520,
  api: 312,
  scenarios: 28,
  coverage: 92,
};

export const mockBug = {
  code: 'BUG-1024',
  severity: 'High',
  title: 'Login Button Not Responding',
  explanation:
    'The login button element is not triggered because of an overlapping div (z-index issue) on the page.',
  fix: 'Remove overlapping element or adjust z-index of the button.',
  confidence: 92,
};

export const mockRuns = [
  { id: 'TR-2025-0012', project: 'E-Commerce Web App', at: 'May 24, 2025 • 11:30 AM', status: 'Completed', passed: 843, failed: 144, coverage: 85.4 },
  { id: 'TR-2025-0011', project: 'User Management API', at: 'May 24, 2025 • 09:20 AM', status: 'Completed', passed: 245, failed: 32, coverage: 90.2 },
  { id: 'TR-2025-0010', project: 'Payment Gateway API', at: 'May 23, 2025 • 05:10 PM', status: 'Failed', passed: 120, failed: 18, coverage: 78.6 },
  { id: 'TR-2025-0009', project: 'Mobile App Testing', at: 'May 23, 2025 • 02:45 PM', status: 'Running', passed: null, failed: null, coverage: null },
];

export const mockSummary = { passed: 843, failed: 144, skipped: 25 };