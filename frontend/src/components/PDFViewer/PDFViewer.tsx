import { useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2, FileText } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import SelectionPopup from './SelectionPopup';

export default function PDFViewer() {
  const { activePaper } = useAppStore();
  const [scale, setScale] = useState(1.0);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const pdfUrl = activePaper
    ? `/api/papers/${activePaper.paper_id}/pdf`
    : null;

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 5) {
      setSelectedText(text);
      setPopupPos({ x: e.clientX, y: e.clientY });
      useAppStore.getState().setSelectedText(text);
    } else {
      setPopupPos(null);
      setSelectedText('');
    }
  }, []);

  const dismissPopup = useCallback(() => {
    setPopupPos(null);
    setSelectedText('');
  }, []);

  const zoom = useCallback((delta: number) => {
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 3.0));
  }, []);

  if (!activePaper || !pdfUrl) return null;

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-surface-1 shrink-0">
        <FileText size={14} className="text-gray-600 shrink-0" />
        <span className="text-xs text-gray-400 truncate max-w-[200px]" title={activePaper.title}>
          {activePaper.title}
        </span>
        <span className="text-[10px] text-gray-700 ml-1">• {activePaper.total_pages}pp</span>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => zoom(-0.1)} className="btn-icon" title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-gray-600 w-12 text-center font-mono">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => zoom(0.1)} className="btn-icon" title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => setScale(1)} className="btn-icon ml-1" title="Reset zoom">
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      {/* PDF embed */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto scrollable relative bg-[#1a1a1a]"
        onMouseUp={handleMouseUp}
      >
        <iframe
          src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
          className="w-full border-0"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            height: `${100 / scale}%`,
            minHeight: '100%',
          }}
          title={activePaper.title}
        />

        {/* Text Selection Popup */}
        {popupPos && selectedText && (
          <SelectionPopup
            x={popupPos.x}
            y={popupPos.y}
            text={selectedText}
            onDismiss={dismissPopup}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-white/5 bg-surface-1 shrink-0">
        <span className="text-[10px] text-gray-700">
          {activePaper.indexed ? '✓ Indexed & Ready' : '⏳ Indexing...'}
        </span>
        <span className="text-[10px] text-gray-700">
          Select text to get AI explanations
        </span>
      </div>
    </div>
  );
}
