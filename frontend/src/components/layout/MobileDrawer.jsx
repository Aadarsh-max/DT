import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { SidebarContent } from './Sidebar';

export default function MobileDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-card shadow-card">
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-4 rounded-lg p-1.5 text-muted hover:bg-primary-soft"
        >
          <X className="size-5" />
        </button>
        <SidebarContent onNavigate={onClose} />
      </div>
    </div>,
    document.body
  );
}