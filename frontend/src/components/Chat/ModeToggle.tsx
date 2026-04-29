import { useAppStore } from '../../store/appStore';
import type { ExplainMode } from '../../store/appStore';

const MODES: { id: ExplainMode; label: string; emoji: string; desc: string }[] = [
  { id: 'eli5', label: 'ELI5', emoji: '🧸', desc: 'Simple, analogies first' },
  { id: 'exam', label: 'Exam', emoji: '📝', desc: 'Structured + derivations' },
  { id: 'research', label: 'Research', emoji: '🔬', desc: 'Technical depth' },
];

export default function ModeToggle() {
  const { explainMode, setExplainMode } = useAppStore();

  return (
    <div className="flex gap-1">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => setExplainMode(m.id)}
          title={m.desc}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs
                      font-medium transition-all duration-150
                      ${explainMode === m.id
                        ? 'bg-accent/15 text-accent-light border border-accent/30'
                        : 'text-gray-600 hover:bg-white/5 hover:text-gray-400 border border-transparent'}`}
        >
          <span>{m.emoji}</span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}
