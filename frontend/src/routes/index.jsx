import { Routes, Route } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import AppLayout from '../layouts/AppLayout';
import AuthLayout from '../layouts/AuthLayout';
import ProtectedRoute from './ProtectedRoute';
import Dashboard from '../pages/Dashboard';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Settings from '../pages/Settings';
import NotFound from '../pages/NotFound';
import EmptyState from '../components/ui/EmptyState';
import { NAV_ITEMS } from '../utils/constants';

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

const REAL_PAGES = ['/', '/settings'];

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
          {NAV_ITEMS.filter((n) => !REAL_PAGES.includes(n.path)).map((n) => (
            <Route
              key={n.path}
              path={n.path.slice(1)}
              element={<ComingSoon title={n.label} phase={n.phase} />}
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}