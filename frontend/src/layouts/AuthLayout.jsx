import { Navigate, Outlet } from 'react-router-dom';
import { Bot, Bug, FileText, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const points = [
  { icon: Sparkles, text: 'AI-generated test cases from your requirements' },
  { icon: Bug, text: 'Bug explanations, severity and suggested fixes' },
  { icon: FileText, text: 'One-click PDF reports for stakeholders' },
];

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth();

  // Already logged in? Skip the auth pages.
  if (!loading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-screen bg-page lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-white/15">
            <Bot className="size-6" />
          </div>
          <p className="text-xl font-bold">AI Testing Engineer</p>
        </div>

        <div>
          <h2 className="text-3xl font-bold leading-tight">
            From requirements to a fully tested, reported build.
          </h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15">
                  <Icon className="size-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-white/70">Open-source AI QA co-pilot</p>
      </div>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-white">
              <Bot className="size-5" />
            </div>
            <p className="text-lg font-bold text-ink">AI Testing Engineer</p>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}