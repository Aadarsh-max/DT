import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import MobileDrawer from '../components/layout/MobileDrawer';

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page">
      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}