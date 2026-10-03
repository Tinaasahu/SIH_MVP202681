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
      {label && (
        <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary, #566075)' }}>
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 text-left',
          'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/10 dark:border-white/15',
          'focus:outline-none focus:ring-2 focus:ring-sky-600/30 dark:focus:ring-sky-400/30 focus:border-sky-600/60 dark:focus:border-sky-400/60',
          isOpen && 'border-sky-600/60 dark:border-sky-400/60 ring-2 ring-sky-600/20 dark:ring-sky-400/20'
        )}
      >
        <span
          className="truncate font-medium"
          style={{ color: value ? 'var(--text-primary, #14213d)' : 'var(--text-muted, #747F9C)' }}
        >
          {value || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-200 shrink-0 ml-2', isOpen && 'rotate-180 text-sky-600 dark:text-sky-400')}
          style={{ color: 'var(--text-secondary, #566075)' }}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl py-1.5',
            'border shadow-2xl',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          style={{
            background: 'var(--glass-bg, rgba(8, 13, 32, 0.94))',
            backdropFilter: 'blur(26px)',
            WebkitBackdropFilter: 'blur(26px)',
            border: 'var(--glass-border, 1px solid rgba(220, 225, 255, 0.16))',
            boxShadow: 'var(--glass-shadow, 0 20px 45px rgba(0,0,0,0.8))',
            color: 'var(--text-primary, #14213d)',
          }}
        >
          {options.length === 0 ? (
            <div className="px-3.5 py-2 text-xs" style={{ color: 'var(--text-muted, #747F9C)' }}>No options</div>
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
                      ? 'bg-sky-500/20 text-sky-800 dark:text-sky-300 font-semibold'
                      : 'hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                  )}
                  style={{
                    color: isSelected ? undefined : 'var(--text-primary, #14213d)'
                  }}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check size={14} className="text-sky-600 dark:text-sky-300 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
