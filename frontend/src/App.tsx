import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/appStore';
import { fetchPapers, fetchModels } from './utils/api';
import Sidebar from './components/Sidebar/Sidebar';
import PDFViewer from './components/PDFViewer/PDFViewer';
import ChatPanel from './components/Chat/ChatPanel';
import ThreadPanel from './components/Threads/ThreadPanel';
import { Group, Panel, Separator } from 'react-resizable-panels';

export default function App() {
  const { setPapers, setAvailableModels, activePaper, activeThreadId } = useAppStore();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [papersData, modelsData] = await Promise.all([fetchPapers(), fetchModels()]);
        setPapers(papersData.papers ?? []);
        setAvailableModels(modelsData.models ?? []);
      } catch (err) {
        console.error('Bootstrap failed:', err);
      }
    };
    bootstrap();
  }, []);

  // Global keyboard shortcut: Alt+/ → focus chat input (Ctrl+K conflicts with browser)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '/') {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        if (input) (input as HTMLInputElement).focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#f5f5f5',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            fontSize: '14px',
          },
        }}
      />

      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {activePaper ? (
          <Group
            orientation="horizontal"
            style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
          >
            {/* PDF Panel */}
            <Panel defaultSize={65} minSize={30}>
              <PDFViewer />
            </Panel>

            <Separator
              className="w-px bg-white/5 hover:bg-violet-500/50 transition-colors cursor-col-resize"
            />

            {/* Right Panel: Chat or Thread */}
            <Panel defaultSize={35} minSize={25}>
              {activeThreadId ? <ThreadPanel /> : <ChatPanel />}
            </Panel>
          </Group>
        ) : (
          <LandingPlaceholder />
        )}
      </div>
    </div>
  );
}

function LandingPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 animate-fade-in">
      {/* Logo mark */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent to-blue-accent flex items-center justify-center shadow-accent">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent to-blue-accent opacity-30 blur-xl -z-10" />
      </div>

      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-white tracking-tight">AI Research Co-Pilot</h1>
        <p className="text-gray-500 text-base max-w-md leading-relaxed">
          Upload a research paper from the sidebar to start chatting, exploring math, and diving deep into concepts — all locally.
        </p>
      </div>

      {/* Feature chips */}
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {[
          '📄 PDF Viewer',
          '🤖 RAG Chat',
          '∑ Math Explanations',
          '🔀 Deep Dive Threads',
          '📝 Notes',
          '🎓 Exam Mode',
          '🧠 ELI5 Mode',
          '🔒 100% Local',
        ].map((f) => (
          <span key={f} className="tag text-sm px-3 py-1">{f}</span>
        ))}
      </div>

      <p className="text-gray-700 text-sm">
        Press{' '}
        <kbd className="px-2 py-0.5 rounded bg-surface-3 border border-white/10 text-gray-400 text-xs font-mono">
          Alt+/
        </kbd>{' '}
        to focus the chat at any time
      </p>
    </div>
  );
}
