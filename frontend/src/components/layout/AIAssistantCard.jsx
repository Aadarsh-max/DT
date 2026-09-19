import { MessageSquarePlus, Sparkles } from 'lucide-react';

export default function AIAssistantCard({ onOpen }) {
  return (
    <div className="p-3">
      <div className="rounded-2xl border border-line bg-primary-soft/60 p-4">
        <div className="flex items-start justify-between">
          <p className="text-sm font-semibold text-brand">AI Assistant</p>
          <Sparkles className="size-5 text-primary" />
        </div>
        <p className="mt-1 text-xs text-muted">Ask about your tests or bugs...</p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-card py-2 text-sm font-medium text-brand hover:bg-primary-soft"
        >
          <MessageSquarePlus className="size-4" />
          New Chat
        </button>
      </div>
    </div>
  );
}