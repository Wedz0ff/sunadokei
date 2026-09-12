import { useState } from 'react';
import { parseTimeString, formatDuration } from '@brachio/shared';
import { Check, AlertCircle } from 'lucide-react';

export interface TimerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const TimerInput: React.FC<TimerInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'e.g. 1min40s',
  disabled = false,
  className = ''
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const parseResult = parseTimeString(value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (parseResult.valid) {
        onSubmit?.();
        (e.target as HTMLInputElement).blur();
      }
    } else if (e.key === 'Escape') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const hasContent = value.trim().length > 0;
  const isValid = parseResult.valid;
  const hasError = hasContent && !isValid;

  let borderColor = 'border-zinc-700 focus-within:border-blue-500';
  if (hasError) {
    borderColor = 'border-rose-500/80 focus-within:border-rose-500';
  } else if (hasContent && isValid) {
    borderColor = 'border-emerald-600/70 focus-within:border-emerald-500';
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      <div
        className={`flex items-center bg-zinc-900/90 hover:bg-zinc-800/90 rounded-md border px-2 py-1 transition-all ${borderColor} ${className}`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Set timer duration"
          aria-invalid={hasError}
          className="bg-transparent text-sm font-mono text-white placeholder-zinc-500 focus:outline-none w-28 text-center"
        />

        {hasContent && (
          <span
            className="ml-1 flex items-center"
            title={isValid ? `Parsed: ${formatDuration(parseResult.durationMs)}` : parseResult.error}
          >
            {isValid ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <AlertCircle size={14} className="text-rose-400" />
            )}
          </span>
        )}
      </div>

      {/* Live parsing feedback tooltip / popup when focused or hovering error */}
      {isFocused && hasContent && (
        <div className="absolute -bottom-8 z-30 whitespace-nowrap px-2 py-0.5 rounded text-xs shadow-lg pointer-events-none transition-all duration-150 animate-in fade-in">
          {isValid ? (
            <div className="bg-zinc-800 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] px-1.5 py-0.5 rounded shadow">
              = {formatDuration(parseResult.durationMs, true)} ({parseResult.durationMs / 1000}s)
            </div>
          ) : (
            <div className="bg-rose-950/90 border border-rose-600/50 text-rose-300 text-[11px] px-1.5 py-0.5 rounded shadow">
              {parseResult.error ?? 'Invalid time format'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
