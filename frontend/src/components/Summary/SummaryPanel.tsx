import { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useAppStore } from '../../store/appStore';
import { streamSummary } from '../../utils/api';
import toast from 'react-hot-toast';

export default function SummaryPanel() {
  const { activePaper, toggleSummary } = useAppStore();
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activePaper && !summary) {
      generateSummary();
    }
  }, [activePaper]);

  const generateSummary = async () => {
    if (!activePaper) return;
    setLoading(true);
    setSummary('');
    let content = '';
    try {
      await streamSummary(
        activePaper.paper_id,
        (token) => {
          content += token;
          setSummary(content);
        },
        () => setLoading(false),
      );
    } catch (err: any) {
      toast.error('Failed to generate summary');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-0 border-l border-white/5">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface-1 shrink-0">
        <button onClick={toggleSummary} className="btn-icon p-1.5">
          <ArrowLeft size={14} />
        </button>
        <BookOpen size={15} className="text-accent-light" />
        <span className="text-sm font-medium text-white flex-1">Paper Summary</span>
        <button
          onClick={generateSummary}
          disabled={loading}
          className="btn-icon p-1.5"
          title="Regenerate summary"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin text-accent-light' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollable p-5">
        {loading && !summary && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer h-4 rounded" style={{ width: `${60 + Math.random() * 35}%` }} />
            ))}
          </div>
        )}
        {summary && (
          <div className={`prose-dark text-sm ${loading ? 'typing-cursor' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {summary}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
