import { useEffect } from 'react';
import { StickyNote, ArrowLeft, Trash2, Tag, Clock } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import type { Note } from '../../store/appStore';
import { fetchNotes, deleteNote } from '../../utils/api';
import toast from 'react-hot-toast';

export default function NotesPanel() {
  const { activePaper, notes, setNotes, removeNote, toggleNotes } = useAppStore();

  useEffect(() => {
    if (activePaper) {
      fetchNotes(activePaper.paper_id)
        .then((d) => setNotes(d.notes ?? []))
        .catch(() => {});
    }
  }, [activePaper]);

  const handleDelete = async (noteId: string) => {
    if (!activePaper) return;
    try {
      await deleteNote(activePaper.paper_id, noteId);
      removeNote(noteId);
      toast.success('Note deleted');
    } catch {
      toast.error('Failed to delete note');
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-0 border-l border-white/5">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-surface-1 shrink-0">
        <button onClick={toggleNotes} className="btn-icon p-1.5">
          <ArrowLeft size={14} />
        </button>
        <StickyNote size={15} className="text-accent-light" />
        <span className="text-sm font-medium text-white flex-1">My Notes</span>
        <span className="tag">{notes.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollable p-4 space-y-3">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <StickyNote size={32} className="text-gray-800" />
            <p className="text-sm text-gray-600">No notes yet</p>
            <p className="text-xs text-gray-700">
              Select text in the PDF and click "Save to Notes", <br />
              or use the bookmark icon on any AI response
            </p>
          </div>
        ) : (
          notes.map((note) => <NoteCard key={note.id} note={note} onDelete={handleDelete} />)
        )}
      </div>
    </div>
  );
}

function NoteCard({ note, onDelete }: { note: Note; onDelete: (id: string) => void }) {
  const date = new Date(note.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="group relative p-3.5 rounded-xl bg-surface-2 border border-white/5
                    hover:border-white/10 transition-all animate-fade-in">
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-6">
        {note.content}
      </p>
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/5">
        <div className="flex items-center gap-2">
          {note.source && (
            <span className="tag text-[10px]">
              <Tag size={8} />{note.source}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-gray-700">
            <Clock size={8} />{date}
          </span>
        </div>
        <button
          onClick={() => onDelete(note.id)}
          className="opacity-0 group-hover:opacity-100 btn-icon p-1 text-gray-700 hover:text-red-400"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
