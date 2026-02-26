'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';

interface Option {
  value: string;
  label: string;
}

interface CreatableComboboxProps {
  options: Option[];
  value?: string;
  onChange: (value: string, label: string) => void;
  onCreate: (label: string) => Promise<void>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  isLoading?: boolean;
}

export function CreatableCombobox({
  options,
  value,
  onChange,
  onCreate,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No se encontraron resultados.',
  disabled = false,
  className,
  isLoading = false,
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find((option) => option.value === value);

  const handleCreate = async () => {
    if (!searchQuery.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      await onCreate(searchQuery);
      setSearchQuery('');
      setOpen(false);
    } catch (error) {
      console.error('Error creating option:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={cn('relative w-full', className)} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled || isLoading}
        className={cn(
          'w-full flex items-center justify-between p-3 text-left bg-base/50 border border-theme rounded-lg transition-all outline-none',
          'focus:ring-2 focus:ring-primary focus:bg-surface',
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed bg-base/30',
          open && 'ring-2 ring-primary bg-surface'
        )}
      >
        <span className={cn('block truncate text-sm', !selectedOption ? 'text-muted/50' : 'text-primary')}>
          {isLoading ? 'Cargando...' : (selectedOption ? selectedOption.label : placeholder)}
        </span>
        <ChevronsUpDown className="w-4 h-4 text-muted/50 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-theme rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-theme">
            <input
              type="text"
              className="w-full px-2 py-1.5 text-sm bg-base rounded-md border-none focus:ring-0 focus:outline-none text-primary placeholder:text-muted/50"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              searchQuery ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-primary hover:bg-base"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Creando...' : `Crear "${searchQuery}"`}</span>
                </button>
              ) : (
                <div className="py-6 text-center text-sm text-muted">{emptyMessage}</div>
              )
            ) : (
              <>
                {filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value, option.label);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors text-primary',
                      'hover:bg-base',
                      value === option.value && 'bg-base font-medium'
                    )}
                  >
                    {option.label}
                    {value === option.value && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
                
                {searchQuery && !filteredOptions.some(o => o.label.toLowerCase() === searchQuery.toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isCreating}
                    className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-sm rounded-md transition-colors text-primary hover:bg-base border-t border-theme pt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isCreating ? 'Creando...' : `Crear "${searchQuery}"`}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
