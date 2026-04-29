import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare, Calculator, ListOrdered, Lightbulb, Link2, X, GitBranch, Bookmark
} from 'lucide-react';
import { streamExplain, createThread, saveNote } from '../../utils/api';
import { useAppStore } from '../../store/appStore';
import toast from 'react-hot-toast';

interface Props {
  x: number;
  y: number;
  text: string;
  onDismiss: () => void;
}

const ACTIONS = [
  { id: 'explain_simple', label: 'Explain Simply', icon: MessageSquare, color: 'text-blue-400' },
  { id: 'explain_math', label: 'Explain Mathematically', icon: Calculator, color: 'text-purple-400' },
  { id: 'derive_steps', label: 'Derive Step-by-Step', icon: ListOrdered, color: 'text-green-400' },
  { id: 'give_intuition', label: 'Give Intuition', icon: Lightbulb, color: 'text-yellow-400' },
  { id: 'give_analogy', label: 'Give Analogy', icon: Link2, color: 'text-orange-400' },
  { id: 'deep_dive', label: 'Open Deep Dive Thread', icon: GitBranch, color: 'text-accent-light' },
  { id: 'save_note', label: 'Save to Notes', icon: Bookmark, color: 'text-gray-400' },
];

export default function SelectionPopup({ x, y, text, onDismiss }: Props) {
  const popupRef = useRef<HTMLDivElement>(null);
  const { activePaper, explainMode, addMessage, createThread: storeCreateThread } = useAppStore();
  const [loading, setLocalLoading] = useState(false);

  // Position the popup above the mouse, avoiding screen edges
  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.max(8, y - 300),
    left: Math.min(x - 100, window.innerWidth - 220),
    zIndex: 9999,
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [onDismiss]);

  const handleAction = async (actionId: string) => {
    if (!activePaper) return;

    if (actionId === 'deep_dive') {
      // Create a deep dive thread for this text
      try {
        const topic = text.slice(0, 80) + (text.length > 80 ? '...' : '');
        const result = await createThread(activePaper.paper_id, topic, explainMode);
        storeCreateThread({
          thread_id: result.thread_id,
          paper_id: activePaper.paper_id,
          topic: topic,
          mode: explainMode,
        });
        toast.success('Deep Dive thread created!');
        onDismiss();
      } catch (err) {
        toast.error('Failed to create thread');
      }
      return;
    }

    if (actionId === 'save_note') {
      try {
        await saveNote(activePaper.paper_id, text, 'PDF selection');
        const note = { id: Date.now().toString(), content: text, source: 'PDF selection', created_at: new Date().toISOString() };
        useAppStore.getState().addNote(note);
        toast.success('Saved to notes!');
        onDismiss();
      } catch {
        toast.error('Failed to save note');
      }
      return;
    }

    setLocalLoading(true);

    // Add user message
    const userMsg = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: `**[${ACTIONS.find(a => a.id === actionId)?.label}]**\n\n> ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    // Add placeholder assistant message
    const assistantMsg = {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };
    addMessage(assistantMsg);

    // Switch to chat panel
    useAppStore.getState().setActiveThread(null);

    let content = '';
    try {
      await streamExplain(
        actionId,
        text,
        (token) => {
          content += token;
          useAppStore.getState().updateLastMessage(content);
        },
        () => {
          useAppStore.getState().setLastMessageStreaming(false);
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      useAppStore.getState().updateLastMessage(`Error: ${msg}`);
      useAppStore.getState().setLastMessageStreaming(false);
    }

    setLocalLoading(false);
    onDismiss();
  };

  return (
    <div ref={popupRef} className="selection-popup" style={style}>
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] text-gray-600 truncate max-w-[140px]">
          "{text.slice(0, 40)}{text.length > 40 ? '...' : ''}"
        </span>
        <button onClick={onDismiss} className="text-gray-700 hover:text-gray-400 transition-colors ml-2">
          <X size={12} />
        </button>
      </div>

      {ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => handleAction(action.id)}
          disabled={loading}
          className="selection-popup-btn"
        >
          <action.icon size={14} className={action.color} />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
