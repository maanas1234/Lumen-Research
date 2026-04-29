import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { Message, Source } from '../../store/appStore';
import { useAppStore } from '../../store/appStore';
import { saveNote } from '../../utils/api';
import { ChevronDown, ChevronUp, Copy, Bookmark, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface Props {
  message: Message;
}

export default function ChatMessage({ message }: Props) {
  const [showSources, setShowSources] = useState(false);
  const { activePaper, addNote } = useAppStore();

  const isUser = message.role === 'user';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied!');
  };

  const saveToNotes = async () => {
    if (!activePaper) return;
    try {
      const note = await saveNote(activePaper.paper_id, message.content, 'chat', 'insight');
      addNote(note);
      toast.success('Saved to notes!');
    } catch {
      toast.error('Failed to save');
    }
  };

  return (
    <div className={`flex flex-col gap-1 animate-slide-up ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Role label */}
      <div className={`text-[10px] font-medium px-1 ${isUser ? 'text-gray-600' : 'text-accent-light'}`}>
        {isUser ? 'You' : 'Lumen Research'}
      </div>

      {/* Message bubble */}
      <div className={`max-w-full w-full ${isUser ? 'chat-user' : 'chat-assistant'}`}>
        {isUser ? (
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className={`prose-dark text-sm ${message.isStreaming ? 'typing-cursor' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = !!(props as Record<string, unknown>).node;
                  if (isBlock && className) {
                    return (
                      <div className="relative my-3">
                        {match && (
                          <div className="text-[10px] text-gray-600 px-4 pt-2 pb-0 font-mono">
                            {match[1]}
                          </div>
                        )}
                        <pre>
                          <code className="text-gray-200">{children}</code>
                        </pre>
                      </div>
                    );
                  }
                  return (
                    <code className="px-1.5 py-0.5 rounded text-xs bg-white/5 text-accent-light font-mono">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content || (message.isStreaming ? '' : '_Empty response_')}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Assistant actions + sources */}
      {!isUser && !message.isStreaming && message.content && (
        <div className="flex items-center gap-1 mt-0.5 ml-1">
          <button onClick={copyToClipboard} className="btn-icon p-1.5" title="Copy">
            <Copy size={12} />
          </button>
          <button onClick={saveToNotes} className="btn-icon p-1.5" title="Save to notes">
            <Bookmark size={12} />
          </button>
          {message.sources && message.sources.length > 0 && (
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px]
                         bg-accent/10 text-accent-light border border-accent/20
                         hover:bg-accent/20 transition-all ml-1"
            >
              <ExternalLink size={10} />
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
              {showSources ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
      )}

      {/* Expanded sources */}
      {showSources && message.sources && (
        <div className="w-full mt-1 space-y-1.5 animate-fade-in">
          {message.sources.map((src, i) => (
            <SourceCard key={i} source={src} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceCard({ source, index }: { source: Source; index: number }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-surface-2 border border-white/5 text-xs">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-accent-light font-medium">Source {index}</span>
        <span className="tag">Page {source.page}</span>
      </div>
      <p className="text-gray-500 leading-relaxed line-clamp-3">{source.text}</p>
    </div>
  );
}
