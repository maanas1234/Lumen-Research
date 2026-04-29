import { useRef, useEffect, useCallback, useState } from 'react';
import { MessageSquarePlus, Trash2, GitBranch, Plus, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { streamChat, createThread, fetchPaperChat } from '../../utils/api';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ModeToggle from './ModeToggle';
import SummaryPanel from '../Summary/SummaryPanel';
import NotesPanel from '../Notes/NotesPanel';
import toast from 'react-hot-toast';

export default function ChatPanel() {
  const {
    activePaper, messages, isLoading, explainMode,
    addMessage, setMessages, updateLastMessage, setLastMessageStreaming, setLoading,
    clearMessages, showSummary, showNotes, threads, setActiveThread,
    createThread: storeCreateThread,
  } = useAppStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [threadTopic, setThreadTopic] = useState('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activePaper) {
      fetchPaperChat(activePaper.paper_id)
        .then((data) => {
          if (data && data.messages) {
            setMessages(data.messages);
          } else {
            setMessages([]);
          }
        })
        .catch(() => {
          setMessages([]);
        });
    } else {
      setMessages([]);
    }
  }, [activePaper]);

  const handleSend = useCallback(async (question: string) => {
    if (!activePaper || !question.trim() || isLoading) return;
    if (!activePaper.indexed) {
      toast.error('Paper is still indexing, please wait...');
      return;
    }

    setLoading(true);

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: question,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const assistantMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };
    addMessage(assistantMsg);

    let content = '';
    try {
      const history = messages
        .filter((m) => !m.isStreaming)
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      await streamChat(
        activePaper.paper_id,
        question,
        history,
        explainMode,
        (token) => {
          content += token;
          updateLastMessage(content);
        },
        (sources) => {
          updateLastMessage(content, sources);
        },
        () => {
          setLastMessageStreaming(false);
          setLoading(false);
        },
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      updateLastMessage(`**Error:** ${errMsg}`);
      setLastMessageStreaming(false);
      setLoading(false);
      toast.error(errMsg);
    }
  }, [activePaper, messages, isLoading, explainMode]);

  const handleCreateThread = useCallback(async () => {
    if (!activePaper || !threadTopic.trim()) return;
    try {
      const result = await createThread(activePaper.paper_id, threadTopic.trim(), explainMode);
      storeCreateThread({
        thread_id: result.thread_id,
        paper_id: activePaper.paper_id,
        topic: threadTopic.trim(),
        mode: explainMode,
      });
      setShowNewThread(false);
      setThreadTopic('');
      toast.success(`Thread "${threadTopic.trim()}" created!`);
    } catch {
      toast.error('Failed to create thread');
    }
  }, [activePaper, threadTopic, explainMode]);

  if (showSummary && activePaper) return <SummaryPanel />;
  if (showNotes && activePaper) return <NotesPanel />;

  return (
    <div className="flex flex-col h-full bg-surface-0 border-l border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-1 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquarePlus size={15} className="text-accent-light" />
          <span className="text-sm font-medium text-white">Chat</span>
          {activePaper && (
            <span className="text-[10px] text-gray-600 ml-1">
              {activePaper.indexed ? '• ready' : '• indexing...'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* New Thread button — always visible when paper is loaded */}
          {activePaper && (
            <button
              onClick={() => setShowNewThread(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                         bg-accent/10 text-accent-light border border-accent/20
                         hover:bg-accent/20 transition-all duration-150"
              title="Start a deep dive thread on a specific concept"
            >
              <GitBranch size={12} />
              New Thread
            </button>
          )}
          {threads.length > 0 && (
            <button
              onClick={() => setActiveThread(threads[threads.length - 1].thread_id)}
              className="btn-icon ml-1"
              title={`View ${threads.length} thread${threads.length > 1 ? 's' : ''}`}
            >
              <span className="text-[10px] text-accent-light font-mono">{threads.length}</span>
            </button>
          )}
          <button
            onClick={clearMessages}
            className="btn-icon"
            title="Clear chat"
            disabled={messages.length === 0}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* New Thread modal */}
      {showNewThread && (
        <div className="px-4 py-3 bg-accent/5 border-b border-accent/20 shrink-0 animate-slide-up">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GitBranch size={13} className="text-accent-light" />
              <span className="text-xs font-medium text-accent-light">New Deep Dive Thread</span>
            </div>
            <button onClick={() => { setShowNewThread(false); setThreadTopic(''); }}
              className="text-gray-700 hover:text-gray-400">
              <X size={13} />
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mb-2">
            Enter a concept to explore in isolation — won't affect this main chat.
          </p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={threadTopic}
              onChange={(e) => setThreadTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateThread(); if (e.key === 'Escape') { setShowNewThread(false); setThreadTopic(''); } }}
              placeholder="e.g. Softmax gradient derivation, MoE routing mechanism..."
              className="flex-1 input-base text-xs py-2"
            />
            <button
              onClick={handleCreateThread}
              disabled={!threadTopic.trim()}
              className="btn-primary text-xs px-3 py-2 shrink-0"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="px-4 py-2 border-b border-white/5 shrink-0">
        <ModeToggle />
      </div>

      {/* Thread tabs (compact strip) */}
      {threads.length > 0 && (
        <div className="px-3 py-1.5 border-b border-white/5 flex gap-1.5 overflow-x-auto shrink-0 items-center">
          <span className="text-[10px] text-gray-700 shrink-0">Threads:</span>
          {threads.map((t) => (
            <button
              key={t.thread_id}
              onClick={() => setActiveThread(t.thread_id)}
              className="shrink-0 px-2.5 py-1 rounded-full bg-accent/10 text-accent-light text-[10px]
                         border border-accent/20 hover:bg-accent/20 transition-all whitespace-nowrap"
            >
              <GitBranch size={9} className="inline mr-1" />
              {t.topic.slice(0, 22)}{t.topic.length > 22 ? '…' : ''}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollable p-4 space-y-4">
        {messages.length === 0 && (
          <EmptyState onSend={handleSend} onNewThread={() => setShowNewThread(true)} />
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading || !activePaper?.indexed} />
    </div>
  );
}

function EmptyState({ onSend, onNewThread }: { onSend: (q: string) => void; onNewThread: () => void }) {
  const suggestions = [
    "What is the main contribution of this paper?",
    "Explain the core methodology simply",
    "What problem does this paper solve?",
    "List the key equations and their meaning",
    "How does this compare to prior work?",
  ];

  return (
    <div className="flex flex-col items-center gap-5 py-6 animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-blue-accent
                      flex items-center justify-center shadow-accent-sm">
        <MessageSquarePlus size={22} className="text-white" />
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-400 font-medium">Ask anything about this paper</p>
        <p className="text-xs text-gray-700 mt-1">
          Or select text in the PDF for smart actions
        </p>
      </div>

      {/* New Thread CTA */}
      <button
        onClick={onNewThread}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-accent/30
                   bg-accent/5 text-accent-light text-xs font-medium hover:bg-accent/10
                   transition-all duration-150 w-full justify-center"
      >
        <GitBranch size={13} />
        Start a Deep Dive Thread on a specific concept
      </button>

      <div className="w-full space-y-1">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            className="w-full text-left px-3 py-2.5 rounded-lg text-xs text-gray-500
                       hover:bg-white/5 hover:text-gray-300 border border-transparent
                       hover:border-white/5 transition-all duration-150"
          >
            <span className="text-accent-light mr-2">→</span>{s}
          </button>
        ))}
      </div>
    </div>
  );
}
