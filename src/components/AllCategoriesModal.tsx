import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Compass } from 'lucide-react';
import { CATEGORIES, Category } from '../constants/taxonomy';
import * as Icons from 'lucide-react';

interface AllCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (categoryId: number) => void;
}

// Icon renderer supporting our icons
const IconRenderer = ({ name, color, className }: { name: string; color?: string; className?: string }) => {
  const IconComponent = (Icons as Record<string, any>)[name] || Compass;
  return <IconComponent className={className} style={color ? { color } : {}} />;
};

export const AllCategoriesModal: React.FC<AllCategoriesModalProps> = ({
  isOpen,
  onClose,
  onSelectCategory
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] relative z-10"
          >
            {/* Header */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00897b] flex items-center justify-center text-white shadow-sm">
                  <Icons.Grid className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">Todas as Categorias</h2>
                  <p className="text-[10px] text-zinc-500 font-medium">Explore todos os setores disponíveis na cidade</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors focus:outline-none"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                {CATEGORIES.map((cat: Category) => {
                  const displayName = cat.name === "Mobilidade Urbana" ? "Mobilidade" : cat.name;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onSelectCategory(cat.id);
                        onClose();
                      }}
                      className="flex items-center gap-4 p-4 border border-zinc-100 rounded-2xl bg-zinc-50/10 hover:border-zinc-200 hover:bg-zinc-50/60 hover:shadow-xs transition-all text-left group"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 shadow-sm"
                        style={{ backgroundColor: cat.color + '15' }}
                      >
                        <IconRenderer name={cat.icon} color={cat.color} className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-zinc-900 truncate">
                          {displayName}
                        </h4>
                        {cat.description && (
                          <p className="text-[10px] sm:text-xs text-zinc-400 truncate mt-0.5 font-medium">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-600 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
