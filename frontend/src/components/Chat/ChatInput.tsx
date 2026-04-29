import { useState, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="px-4 py-3 border-t border-white/5 shrink-0 bg-surface-1">
      <div className="flex items-end gap-2 bg-surface-2 border border-white/5 rounded-xl px-3 py-2
                      focus-within:border-accent/40 transition-all duration-200">
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={disabled}
          placeholder={disabled ? 'Waiting for indexing...' : (placeholder ?? 'Ask about this paper... (Enter to send)')}
          rows={1}
          className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-700 resize-none
                     outline-none min-h-[24px] max-h-[120px] leading-6 py-0.5 scrollable"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={`shrink-0 p-2 rounded-lg transition-all duration-150 mb-0.5
            ${value.trim() && !disabled
              ? 'bg-accent text-white hover:bg-violet-500 active:scale-95 shadow-accent-sm'
              : 'text-gray-700 cursor-not-allowed'}`}
        >
          <Send size={15} />
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5 px-1">
        <span className="text-[10px] text-gray-700">
          <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for newline
        </span>
        <span className="text-[10px] text-gray-700">
          <kbd className="font-mono">Alt+/</kbd> to focus
        </span>
      </div>
    </div>
  );
}
