import { useState, useRef, useCallback } from 'react';
import {
  FileText, Upload, Trash2, ChevronLeft, ChevronRight,
  Sparkles, BookOpen, StickyNote, CheckCircle2, Clock,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { uploadPDF, fetchPapers, deletePaper, fetchPaperStatus } from '../../utils/api';
import toast from 'react-hot-toast';
import ModelSelector from './ModelSelector';

export default function Sidebar() {
  const {
    papers, activePaper, setActivePaper, setPapers, addPaper, updatePaperIndexed,
    sidebarOpen, setSidebarOpen, toggleSummary, toggleNotes,
    showSummary, showNotes,
  } = useAppStore();

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      toast.error('Only PDF files are supported');
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const result = await uploadPDF(file, setUploadProgress);
      const newPaper = {
        paper_id: result.paper_id,
        filename: file.name,
        title: result.title || file.name,
        author: result.author || 'Unknown',
        total_pages: result.total_pages || 0,
        indexed: false,
      };
      addPaper(newPaper);
      setActivePaper(newPaper);
      toast.success(`"${result.title}" uploaded! Indexing in background...`);

      // Poll for indexing completion
      pollIndexing(result.paper_id);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [addPaper, setActivePaper]);

  const pollIndexing = async (paperId: string) => {
    let attempts = 0;
    const poll = async () => {
      try {
        const status = await fetchPaperStatus(paperId);
        if (status.indexed) {
          updatePaperIndexed(paperId, true);
          toast.success('Paper indexed! Ready to chat 🎉');
        } else if (attempts < 60) {
          attempts++;
          setTimeout(poll, 3000);
        }
      } catch (_) {}
    };
    setTimeout(poll, 4000);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const handleDelete = async (paperId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePaper(paperId);
      const updated = await fetchPapers();
      setPapers(updated.papers ?? []);
      if (activePaper?.paper_id === paperId) setActivePaper(null);
      toast.success('Paper removed');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center py-4 px-2 gap-3 border-r border-white/5 bg-surface-1">
        <button
          onClick={() => setSidebarOpen(true)}
          className="btn-icon"
          title="Open sidebar"
        >
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-full bg-white/5" />
      </div>
    );
  }

  return (
    <aside className="w-64 flex flex-col bg-surface-1 border-r border-white/5 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-blue-accent flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-white">Co-Pilot</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="btn-icon">
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Upload zone */}
      <div className="p-3">
        <div
          className={`
            relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200
            ${dragging ? 'border-accent bg-accent/10' : 'border-white/10 hover:border-accent/40 hover:bg-white/2'}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          {uploading ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-400">Uploading... {uploadProgress}%</div>
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent to-blue-accent transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <Upload size={18} className="mx-auto mb-2 text-gray-600" />
              <div className="text-xs text-gray-500">
                Drop PDF here or <span className="text-accent-light">browse</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Model selector */}
      <div className="px-3 pb-2">
        <ModelSelector />
      </div>

      {/* Papers list */}
      <div className="flex-1 overflow-y-auto scrollable px-3 py-1">
        <div className="text-xs text-gray-600 uppercase tracking-wider px-1 mb-2 font-medium">
          Papers ({papers.length})
        </div>
        {papers.length === 0 ? (
          <div className="text-xs text-gray-700 text-center py-6">No papers yet</div>
        ) : (
          <div className="space-y-1">
            {papers.map((paper) => (
              <div
                key={paper.paper_id}
                onClick={() => setActivePaper(paper)}
                className={`
                  group relative flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer
                  transition-all duration-150 border
                  ${activePaper?.paper_id === paper.paper_id
                    ? 'bg-accent/10 border-accent/20 text-accent-light'
                    : 'border-transparent hover:bg-white/5 text-gray-400 hover:text-gray-200'}
                `}
              >
                <div className="relative mt-0.5">
                  <FileText size={15} className="shrink-0" />
                  {paper.indexed
                    ? <CheckCircle2 size={8} className="absolute -bottom-0.5 -right-0.5 text-green-400" />
                    : <Clock size={8} className="absolute -bottom-0.5 -right-0.5 text-yellow-400 animate-pulse" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate leading-tight">
                    {paper.title || paper.filename}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {paper.total_pages} pages
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(paper.paper_id, e)}
                  className="opacity-0 group-hover:opacity-100 btn-icon p-1 text-gray-600 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      {activePaper && (
        <div className="px-3 py-3 border-t border-white/5 space-y-1">
          <button
            onClick={toggleSummary}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
              ${showSummary ? 'bg-accent/10 text-accent-light' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
          >
            <BookOpen size={14} />
            Paper Summary
          </button>
          <button
            onClick={toggleNotes}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150
              ${showNotes ? 'bg-accent/10 text-accent-light' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
          >
            <StickyNote size={14} />
            My Notes
          </button>
        </div>
      )}
    </aside>
  );
}
