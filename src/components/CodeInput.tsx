'use client';

import { useEffect, useMemo, useRef } from 'react';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mode?: 'inline' | 'multiline';
  disabled?: boolean;
  placeholder?: string;
}

export function CodeInput({
  value,
  onChange,
  onSubmit,
  mode = 'inline',
  disabled = false,
  placeholder,
}: CodeInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled) {
      ref.current?.focus();
    }
  }, [disabled]);

  const lineNumbers = useMemo(() => {
    if (mode !== 'multiline') return null;
    const visibleLines = Math.max(value.split('\n').length, 8);
    return Array.from({ length: visibleLines }, (_, i) => i + 1);
  }, [value, mode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = value.slice(0, start) + '    ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      });
      return;
    }

    if (e.key === 'Enter') {
      if (mode === 'multiline') {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          onSubmit();
        }
        return;
      }
      if (!e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    }
  };

  const rows = mode === 'multiline' ? 8 : 2;

  return (
    <div
      className={[
        'rounded-md border bg-bg-inset transition-colors duration-150',
        disabled ? 'border-line opacity-60' : 'border-line focus-within:border-accent',
      ].join(' ')}
    >
      <div className="flex">
        {mode === 'multiline' && lineNumbers && (
          <div
            aria-hidden
            className="select-none py-3 pl-3 pr-2 text-right font-mono text-sm leading-6 text-fg-subtle border-r border-line"
          >
            {lineNumbers.map((n) => (
              <div key={n} className="leading-6">
                {n}
              </div>
            ))}
          </div>
        )}
        <div className="relative flex-1">
          {mode === 'inline' && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-3 font-mono text-sm leading-6 text-fg-subtle"
            >
              {'>>> '}
            </span>
          )}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={rows}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            className={[
              'w-full bg-transparent font-mono text-sm leading-6 text-fg caret-accent outline-none resize-none',
              'placeholder:text-fg-subtle',
              mode === 'inline' ? 'pl-12 pr-3 py-3' : 'px-3 py-3',
              'disabled:cursor-not-allowed',
            ].join(' ')}
          />
        </div>
      </div>
    </div>
  );
}
