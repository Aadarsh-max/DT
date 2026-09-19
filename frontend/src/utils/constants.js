import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  PlayCircle,
  Bug,
  Cog,
  Sparkles,
  FileText,
  BarChart3,
  Settings,
  Users,
  Puzzle,
} from 'lucide-react';

// phase = the build phase where that page becomes real
export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, phase: 2 },
  { label: 'Projects', path: '/projects', icon: FolderKanban, phase: 4 },
  { label: 'Test Cases', path: '/test-cases', icon: ClipboardList, phase: 5 },
  { label: 'Test Execution', path: '/execution', icon: PlayCircle, phase: 6 },
  { label: 'Bug Reports', path: '/bugs', icon: Bug, phase: 7 },
  { label: 'API Testing', path: '/api-testing', icon: Cog, phase: 6 },
  { label: 'AI Analysis', path: '/ai-analysis', icon: Sparkles, phase: 7 },
  { label: 'Reports', path: '/reports', icon: FileText, phase: 8 },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, phase: 8 },
  { label: 'Settings', path: '/settings', icon: Settings, phase: 3 },
  { label: 'Team', path: '/team', icon: Users, phase: 10 },
  { label: 'Integrations', path: '/integrations', icon: Puzzle, phase: 10 },
];

export const PLATFORM_OPTIONS = [
  { value: 'WEB', label: 'Web application' },
  { value: 'API', label: 'API / backend service' },
  { value: 'MOBILE', label: 'Mobile app (Android)' },
];

export const PLATFORM_LABEL = { WEB: 'Web', API: 'API', MOBILE: 'Mobile' };

export const REQUIREMENT_TYPE_LABEL = {
  DOCUMENT: 'Document',
  URL: 'URL',
  CODE: 'Source code',
  API_SPEC: 'API spec',
};

export const REQUIREMENT_TYPE_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'DOCUMENT', label: 'Document (SRS, PRD)' },
  { value: 'API_SPEC', label: 'API spec' },
  { value: 'CODE', label: 'Source code' },
];

// Keep in sync with backend upload.middleware.js and ai-engine loader.py
export const UPLOAD_ACCEPT =
  '.pdf,.docx,.txt,.md,.csv,.json,.yaml,.yml,.xml,.html,.htm,.js,.jsx,.ts,.tsx,.py,.java,.go,.rb,.php,.cs';

export const MAX_UPLOAD_MB = 15;