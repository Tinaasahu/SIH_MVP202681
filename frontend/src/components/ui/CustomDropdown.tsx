'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomDropdownProps {
  label?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  badge?: string;
}

export function CustomDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className,
  badge,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && options.length > 5 && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, options.length]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, searchQuery]);

  return (
    <div className={cn('relative w-full', className, isOpen && '!z-[100]')} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary, #A9B2C8)' }}>
            {label}
          </label>
          {badge && (
            <span className="text-[10px] text-sky-400/80 font-medium">{badge}</span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (isOpen) setSearchQuery('');
        }}
        className={cn(
          'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 text-left cursor-pointer',
          'bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] border border-black/10 dark:border-white/15',
          'focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/60',
          isOpen && 'border-sky-500/70 ring-2 ring-sky-500/20'
        )}
      >
        <span
          className="truncate font-semibold tracking-wide"
          style={{ color: value ? 'var(--text-primary, #F3F5FA)' : 'var(--text-muted, #747F9C)' }}
        >
          {value || placeholder}
        </span>
        <ChevronDown
          size={15}
          className={cn('transition-transform duration-200 shrink-0 ml-2', isOpen && 'rotate-180 text-sky-400')}
          style={{ color: 'var(--text-secondary, #A9B2C8)' }}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl py-1.5 shadow-2xl',
            'border animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          style={{
            background: 'var(--dropdown-bg, #0c142e)',
            border: '1px solid var(--dropdown-border, rgba(220, 225, 255, 0.20))',
            boxShadow: '0 24px 50px -6px rgba(0, 0, 0, 0.9), 0 10px 20px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          {options.length > 5 && (
            <div
              className="px-2.5 py-1.5 mb-1 sticky top-0 z-10 border-b backdrop-blur-md"
              style={{
                background: 'var(--dropdown-bg, #0c142e)',
                borderColor: 'var(--dropdown-border, rgba(220, 225, 255, 0.15))',
              }}
            >
              <div
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(220, 225, 255, 0.12)',
                }}
              >
                <Search size={13} className="text-sky-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search ${label || 'options'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs"
                  style={{ color: 'var(--dropdown-text, #F3F5FA)' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-white p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-center" style={{ color: 'var(--text-muted, #747F9C)' }}>
              No matches found
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium transition-colors text-left cursor-pointer'
                  )}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--dropdown-selected-bg, rgba(56, 189, 248, 0.16))'
                      : undefined,
                    color: isSelected
                      ? 'var(--dropdown-selected-text, #38bdf8)'
                      : 'var(--dropdown-text, #F3F5FA)',
                    fontWeight: isSelected ? 700 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--dropdown-hover, rgba(255, 255, 255, 0.08))';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check size={14} className="text-sky-400 shrink-0 ml-2" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
