'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomDropdownProps {
  label?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CustomDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      {label && <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 text-left',
          'bg-white/70 hover:bg-white/90 border border-slate-200/80 shadow-xs backdrop-blur-md',
          'focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400',
          isOpen && 'border-blue-400 ring-2 ring-blue-400/20'
        )}
      >
        <span className={cn('truncate font-medium', value ? 'text-slate-800' : 'text-slate-400')}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn('text-slate-400 transition-transform duration-200 shrink-0 ml-2', isOpen && 'rotate-180 text-blue-500')}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl py-1.5',
            'bg-white/90 backdrop-blur-2xl border border-white/60 shadow-xl shadow-slate-900/10',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          style={{
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {options.length === 0 ? (
            <div className="px-3.5 py-2 text-xs text-slate-400">No options</div>
          ) : (
            options.map((opt) => {
              const isSelected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium transition-colors text-left',
                    isSelected
                      ? 'bg-blue-500/10 text-blue-600 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900'
                  )}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check size={14} className="text-blue-600 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
