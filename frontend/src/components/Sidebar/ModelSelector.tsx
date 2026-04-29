import { useState } from 'react';
import { Cpu, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { selectModel } from '../../utils/api';
import toast from 'react-hot-toast';

export default function ModelSelector() {
  const { availableModels, selectedModel, setSelectedModel } = useAppStore();
  const [open, setOpen] = useState(false);

  const handleSelect = async (model: string) => {
    setOpen(false);
    try {
      await selectModel(model);
      setSelectedModel(model);
      toast.success(`Switched to ${model}`);
    } catch {
      toast.error('Failed to switch model');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-white/5
                   text-xs text-gray-400 hover:text-gray-200 hover:border-white/10 transition-all"
      >
        <Cpu size={12} className="text-accent-light shrink-0" />
        <span className="flex-1 text-left truncate">{selectedModel}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-2 border border-white/10
                        rounded-xl shadow-glass overflow-hidden z-50 animate-fade-in">
          {availableModels.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-600">No models found</div>
          ) : (
            availableModels.map((m) => (
              <button
                key={m}
                onClick={() => handleSelect(m)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors
                  ${m === selectedModel
                    ? 'bg-accent/10 text-accent-light'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
              >
                {m}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
