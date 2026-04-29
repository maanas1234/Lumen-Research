import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ExplainMode = 'eli5' | 'exam' | 'research';

export interface Paper {
  paper_id: string;
  filename: string;
  title: string;
  author: string;
  total_pages: number;
  indexed: boolean;
  math_regions?: Array<{ page: number; text: string; bbox: number[] }>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  timestamp: number;
}

export interface Source {
  page: number | string;
  text: string;
  score: number;
}

export interface Thread {
  thread_id: string;
  paper_id: string;
  topic: string;
  mode: ExplainMode;
  history: Message[];
  isLoading?: boolean;
}

export interface Note {
  id: string;
  content: string;
  source?: string;
  tag?: string;
  created_at: string;
}

interface AppState {
  // Active paper
  activePaper: Paper | null;
  papers: Paper[];
  setActivePaper: (p: Paper | null) => void;
  setPapers: (papers: Paper[]) => void;
  addPaper: (p: Paper) => void;
  updatePaperIndexed: (paperId: string, indexed: boolean) => void;
  // ID only — restored after fresh fetch from backend
  _lastActivePaperId: string | null;

  // Main chat
  messages: Message[];
  isLoading: boolean;
  addMessage: (m: Message) => void;
  setMessages: (messages: Message[]) => void;
  updateLastMessage: (content: string, sources?: Source[]) => void;
  setLastMessageStreaming: (streaming: boolean) => void;
  setLoading: (v: boolean) => void;
  clearMessages: () => void;

  // Mode
  explainMode: ExplainMode;
  setExplainMode: (m: ExplainMode) => void;

  // Selected text
  selectedText: string;
  setSelectedText: (t: string) => void;

  // Threads
  threads: Thread[];
  activeThreadId: string | null;
  createThread: (t: Omit<Thread, 'history'>) => void;
  deleteThread: (id: string) => void;
  setActiveThread: (id: string | null) => void;
  addThreadMessage: (threadId: string, m: Message) => void;
  updateLastThreadMessage: (threadId: string, content: string, sources?: Source[]) => void;
  setThreadStreaming: (threadId: string, v: boolean) => void;

  // Panel state
  showSummary: boolean;
  showNotes: boolean;
  toggleSummary: () => void;
  toggleNotes: () => void;

  // Notes
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  addNote: (n: Note) => void;
  removeNote: (id: string) => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  
  // Ollama model
  availableModels: string[];
  selectedModel: string;
  setAvailableModels: (m: string[]) => void;
  setSelectedModel: (m: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activePaper: null,
      papers: [],
      _lastActivePaperId: null,
      setActivePaper: (p) => set({ activePaper: p, messages: [], threads: [], activeThreadId: null, _lastActivePaperId: p?.paper_id ?? null }),
      setPapers: (papers) => set((s) => ({
        papers,
        // Restore activePaper from last session using fresh data from backend
        activePaper: s._lastActivePaperId
          ? (papers.find((p) => p.paper_id === s._lastActivePaperId) ?? s.activePaper)
          : s.activePaper,
      })),
      addPaper: (p) => set((s) => ({ papers: [...s.papers, p] })),
      updatePaperIndexed: (paperId, indexed) => set((s) => ({
        papers: s.papers.map((p) => p.paper_id === paperId ? { ...p, indexed } : p),
        activePaper: s.activePaper?.paper_id === paperId ? { ...s.activePaper, indexed } : s.activePaper,
      })),

      messages: [],
      isLoading: false,
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      setMessages: (messages) => set({ messages }),
      updateLastMessage: (content, sources) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last) msgs[msgs.length - 1] = { ...last, content, sources: sources ?? last.sources };
          return { messages: msgs };
        }),
      setLastMessageStreaming: (streaming) =>
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last) msgs[msgs.length - 1] = { ...last, isStreaming: streaming };
          return { messages: msgs };
        }),
      setLoading: (v) => set({ isLoading: v }),
      clearMessages: () => set({ messages: [] }),

      explainMode: 'research',
      setExplainMode: (m) => set({ explainMode: m }),

      selectedText: '',
      setSelectedText: (t) => set({ selectedText: t }),

      threads: [],
      activeThreadId: null,
      createThread: (t) =>
        set((s) => ({ threads: [...s.threads, { ...t, history: [] }], activeThreadId: t.thread_id })),
      deleteThread: (id) =>
        set((s) => ({
          threads: s.threads.filter((t) => t.thread_id !== id),
          activeThreadId: s.activeThreadId === id ? null : s.activeThreadId,
        })),
      setActiveThread: (id) => set({ activeThreadId: id }),
      addThreadMessage: (threadId, m) =>
        set((s) => ({
          threads: s.threads.map((t) =>
            t.thread_id === threadId ? { ...t, history: [...t.history, m] } : t,
          ),
        })),
      updateLastThreadMessage: (threadId, content, sources) =>
        set((s) => ({
          threads: s.threads.map((t) => {
            if (t.thread_id !== threadId) return t;
            const history = [...t.history];
            const last = history[history.length - 1];
            if (last) history[history.length - 1] = { ...last, content, sources: sources ?? last.sources };
            return { ...t, history };
          }),
        })),
      setThreadStreaming: (threadId, v) =>
        set((s) => ({
          threads: s.threads.map((t) => (t.thread_id === threadId ? { ...t, isLoading: v } : t)),
        })),

      showSummary: false,
      showNotes: false,
      toggleSummary: () => set((s) => ({ showSummary: !s.showSummary })),
      toggleNotes: () => set((s) => ({ showNotes: !s.showNotes })),

      notes: [],
      setNotes: (notes) => set({ notes }),
      addNote: (n) => set((s) => ({ notes: [...s.notes, n] })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      sidebarOpen: true,
      setSidebarOpen: (v) => set({ sidebarOpen: v }),

      availableModels: [],
      selectedModel: 'llama3.2',
      setAvailableModels: (m) => set({ availableModels: m }),
      setSelectedModel: (m) => set({ selectedModel: m }),
    }),
    {
      name: 'copilot-store',
      partialize: (s) => ({
        explainMode: s.explainMode,
        selectedModel: s.selectedModel,
        notes: s.notes,
        sidebarOpen: s.sidebarOpen,
        _lastActivePaperId: s._lastActivePaperId,
      }),
    },
  ),
);
