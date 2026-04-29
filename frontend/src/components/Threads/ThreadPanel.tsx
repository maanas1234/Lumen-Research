import { useState, useCallback } from 'react';
import { GitBranch, Plus, X, ArrowLeft, Star } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { streamThreadChat, createThread, deleteThread, promoteInsight } from '../../utils/api';
import ChatMessage from '../Chat/ChatMessage';
import ChatInput from '../Chat/ChatInput';
import toast from 'react-hot-toast';

export default function ThreadPanel() {
  const {
    threads, activeThreadId, setActiveThread, deleteThread: storeDelete,
    addThreadMessage, updateLastThreadMessage, setThreadStreaming,
    activePaper, explainMode,
  } = useAppStore();

  const activeThread = threads.find((t) => t.thread_id === activeThreadId);
  const [bottomRef] = useState<{ current: HTMLDivElement | null }>({ current: null });

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = useCallback(async (question: string) => {
    if (!activeThread || !question.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: question,
      timestamp: Date.now(),
    };
    addThreadMessage(activeThread.thread_id, userMsg);

    const assistantMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };
    addThreadMessage(activeThread.thread_id, assistantMsg);
    setThreadStreaming(activeThread.thread_id, true);

    let content = '';
    try {
      await streamThreadChat(
        activeThread.thread_id,
        question,
        explainMode,
        (token) => {
          content += token;
          updateLastThreadMessage(activeThread.thread_id, content);
        },
        (sources) => {
          updateLastThreadMessage(activeThread.thread_id, content, sources);
        },
        () => {
          setThreadStreaming(activeThread.thread_id, false);
          scrollToBottom();
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      updateLastThreadMessage(activeThread.thread_id, `**Error:** ${msg}`);
      setThreadStreaming(activeThread.thread_id, false);
      toast.error(msg);
    }
  }, [activeThread, explainMode]);

  const handleDelete = async (threadId: string) => {
    try {
      await deleteThread(threadId);
      storeDelete(threadId);
      toast.success('Thread deleted');
    } catch {
      toast.error('Failed to delete thread');
    }
  };

  const handlePromote = async (content: string) => {
    if (!activeThread) return;
    try {
      const result = await promoteInsight(activeThread.thread_id, content);
      useAppStore.getState().addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: result.promoted_text,
        timestamp: Date.now(),
      });
      setActiveThread(null);
      toast.success('Insight promoted to main chat!');
    } catch {
      toast.error('Failed to promote insight');
    }
  };

  const handleNewThread = async () => {
    if (!activePaper) return;
    const topic = prompt('Enter the concept to explore:');
    if (!topic?.trim()) return;
    try {
      const result = await createThread(activePaper.paper_id, topic.trim(), explainMode);
      useAppStore.getState().createThread({
        thread_id: result.thread_id,
        paper_id: activePaper.paper_id,
        topic: topic.trim(),
        mode: explainMode,
      });
    } catch {
      toast.error('Failed to create thread');
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-0 border-l border-white/5">
      {/* Thread tabs header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5 bg-surface-1 shrink-0">
        <button
          onClick={() => setActiveThread(null)}
          className="btn-icon p-1.5"
          title="Back to main chat"
        >
          <ArrowLeft size={14} />
        </button>

        <div className="flex-1 flex gap-1 overflow-x-auto scrollable">
          {threads.map((t) => (
            <button
              key={t.thread_id}
              onClick={() => setActiveThread(t.thread_id)}
              className={`thread-tab shrink-0 text-xs ${t.thread_id === activeThreadId ? 'thread-tab-active' : ''}`}
            >
              <GitBranch size={11} />
              <span className="max-w-[80px] truncate">{t.topic}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); handleDelete(t.thread_id); }}
                className="ml-1 text-gray-700 hover:text-red-400 transition-colors cursor-pointer"
              >
                <X size={10} />
              </span>
            </button>
          ))}
        </div>

        <button onClick={handleNewThread} className="btn-icon p-1.5 shrink-0" title="New thread">
          <Plus size={14} />
        </button>
      </div>

      {/* Active thread content */}
      {activeThread ? (
        <>
          {/* Thread topic badge */}
          <div className="px-4 py-2.5 border-b border-white/5 bg-surface-1/50 shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch size={13} className="text-accent-light shrink-0" />
              <span className="text-xs text-gray-300 font-medium">{activeThread.topic}</span>
            </div>
            <p className="text-[10px] text-gray-700 mt-0.5">
              Isolated deep dive · responses don't affect main chat
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollable p-4 space-y-4">
            {activeThread.history.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-8 text-center animate-fade-in">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5
                                flex items-center justify-center border border-accent/20">
                  <GitBranch size={20} className="text-accent-light" />
                </div>
                <div>
                  <p className="text-sm text-gray-400 font-medium">Deep Dive: {activeThread.topic}</p>
                  <p className="text-xs text-gray-700 mt-1">
                    Ask anything about this concept — this thread is isolated
                  </p>
                </div>
                <div className="w-full space-y-1.5">
                  {[
                    `Explain ${activeThread.topic} simply`,
                    `What is the mathematical formulation?`,
                    `Derive step-by-step`,
                    `Give me an intuitive analogy`,
                  ].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-gray-600
                                 hover:bg-white/5 hover:text-gray-300 transition-all"
                    >
                      <span className="text-accent-light mr-2">→</span>{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeThread.history.map((msg) => (
              <div key={msg.id} className="relative group">
                <ChatMessage message={msg} />
                {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                  <button
                    onClick={() => handlePromote(msg.content)}
                    className="absolute top-0 right-0 opacity-0 group-hover:opacity-100
                               flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]
                               bg-surface-3 text-gray-500 hover:text-yellow-400
                               border border-white/5 transition-all"
                    title="Promote to main chat"
                  >
                    <Star size={9} />
                    Promote
                  </button>
                )}
              </div>
            ))}
            <div ref={(el) => { bottomRef.current = el; }} />
          </div>

          <ChatInput
            onSend={handleSend}
            disabled={activeThread.isLoading}
            placeholder="Explore this concept..."
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-700">Select a thread above</p>
        </div>
      )}
    </div>
  );
}
