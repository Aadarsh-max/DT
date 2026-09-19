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