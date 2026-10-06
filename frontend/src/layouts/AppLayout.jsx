import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import MobileDrawer from '../components/layout/MobileDrawer';
import ChatPanel from '../components/chat/ChatPanel';

const COLLAPSE_KEY = 'sidebar_collapsed';

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true');

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-page">
      <Sidebar
        onOpenChat={() => setChatOpen(true)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenChat={() => setChatOpen(true)}
      />
      <div className={collapsed ? 'lg:pl-20' : 'lg:pl-64'} style={{ transition: 'padding-left 200ms' }}>
        <Topbar onMenu={() => setDrawerOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}