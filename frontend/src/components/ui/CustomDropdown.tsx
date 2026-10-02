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
      {label && <label className="block text-xs font-semibold text-[#AAB7D4] mb-1.5">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 text-left',
          'bg-white/[0.05] hover:bg-white/[0.08] border border-white/15 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-md',
          'focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400/60',
          isOpen && 'border-sky-400/60 ring-2 ring-sky-400/20 shadow-[0_0_12px_rgba(56,189,248,0.2)]'
        )}
      >
        <span className={cn('truncate font-medium', value ? 'text-[#F5F7FF]' : 'text-[#7180A5]')}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn('text-[#AAB7D4] transition-transform duration-200 shrink-0 ml-2', isOpen && 'rotate-180 text-sky-400')}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl py-1.5',
            'border border-white/20 shadow-2xl',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          style={{
            background: 'rgba(11, 22, 56, 0.96)',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            boxShadow: '0 20px 45px rgba(0,0,0,0.8), 0 0 20px rgba(56,189,248,0.12)',
          }}
        >
          {options.length === 0 ? (
            <div className="px-3.5 py-2 text-xs text-[#7180A5]">No options</div>
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
                      ? 'bg-sky-500/25 text-sky-300 font-semibold'
                      : 'text-[#AAB7D4] hover:bg-white/[0.08] hover:text-[#F5F7FF]'
                  )}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check size={14} className="text-sky-300 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
