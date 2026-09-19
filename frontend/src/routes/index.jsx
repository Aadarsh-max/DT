import { Routes, Route } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import Dashboard from '../pages/Dashboard';
import NotFound from '../pages/NotFound';
import EmptyState from '../components/ui/EmptyState';
import { NAV_ITEMS } from '../utils/constants';
import { Hammer } from 'lucide-react';

function ComingSoon({ title, phase }) {
  return (
    <div className="mx-auto max-w-2xl pt-10">
      <EmptyState
        icon={Hammer}
        title={`${title} is coming soon`}
        description={`This page is built in Phase ${phase}.`}
      />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        {NAV_ITEMS.filter((n) => n.path !== '/').map((n) => (
          <Route
            key={n.path}
            path={n.path.slice(1)}
            element={<ComingSoon title={n.label} phase={n.phase} />}
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}