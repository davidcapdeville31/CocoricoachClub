import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown } from "lucide-react";

interface TimeInputProps {
  /** Value in seconds */
  value: number | undefined;
  /** Callback with value in seconds */
  onChange: (seconds: number) => void;
  /** Placeholder text (unused now but kept for compatibility) */
  placeholder?: string;
  /** Minimum value in seconds */
  min?: number;
  /** Maximum value in seconds */
  max?: number;
  /** Additional className */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Optional label above input */
  label?: string;
  /** Compact mode - simpler layout without increment buttons */
  compact?: boolean;
}

/**
 * Converts seconds to mm:ss format
 */
export const formatSecondsToTime = (seconds: number | undefined): string => {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Parses mm:ss or raw seconds input to total seconds
 */
export const parseTimeToSeconds = (input: string): number | null => {
  if (!input || input.trim() === "") return null;
  
  const trimmed = input.trim();
  
  // If it contains a colon, parse as mm:ss
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return mins * 60 + secs;
    }
  }
  
  // Otherwise parse as raw seconds
  const num = parseInt(trimmed, 10);
  return isNaN(num) ? null : num;
};

/**
 * Time input component with separate minutes and seconds fields
 */
export const TimeInput = ({
  value,
  onChange,
  min = 0,
  max = 3600,
  className,
  disabled = false,
  label,
  compact = false,
}: TimeInputProps) => {
  const totalSeconds = value ?? 0;
  const [minutes, setMinutes] = useState(Math.floor(totalSeconds / 60));
  const [seconds, setSeconds] = useState(totalSeconds % 60);

  // Sync with external value
  useEffect(() => {
    const newMins = Math.floor((value ?? 0) / 60);
    const newSecs = (value ?? 0) % 60;
    setMinutes(newMins);
    setSeconds(newSecs);
  }, [value]);

  const updateValue = (newMins: number, newSecs: number) => {
    // Normalize seconds overflow
    if (newSecs >= 60) {
      newMins += Math.floor(newSecs / 60);
      newSecs = newSecs % 60;
    }
    if (newSecs < 0) {
      newMins -= 1;
      newSecs = 59;
    }
    if (newMins < 0) {
      newMins = 0;
      newSecs = 0;
    }

    const total = newMins * 60 + newSecs;
    const clamped = Math.max(min, Math.min(max, total));
    
    setMinutes(Math.floor(clamped / 60));
    setSeconds(clamped % 60);
    onChange(clamped);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 99) {
      updateValue(val, seconds);
    }
  };

  const handleSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0 && val <= 59) {
      updateValue(minutes, val);
    }
  };

  const incrementMinutes = () => updateValue(minutes + 1, seconds);
  const decrementMinutes = () => updateValue(minutes - 1, seconds);
  const incrementSeconds = () => updateValue(minutes, seconds + 10);
  const decrementSeconds = () => updateValue(minutes, seconds - 10);

  // Compact mode - simple inputs without buttons
  if (compact) {
    const compactElement = (
      <div className={cn("flex items-center gap-0.5", className)}>
        <Input
          type="number"
          inputMode="numeric"
          value={minutes}
          onChange={handleMinutesChange}
          disabled={disabled}
          className="w-7 h-7 text-center text-xs p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
          max={99}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onWheel={(e) => e.currentTarget.blur()}
        />
        <span className="text-muted-foreground text-xs font-medium">:</span>
        <Input
          type="number"
          inputMode="numeric"
          value={seconds.toString().padStart(2, '0')}
          onChange={handleSecondsChange}
          disabled={disabled}
          className="w-8 h-7 text-center text-xs p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
          max={59}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onWheel={(e) => e.currentTarget.blur()}
        />
      </div>
    );

    if (label) {
      return (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {compactElement}
        </div>
      );
    }
    return compactElement;
  }

  // Full mode with increment/decrement buttons
  const inputElement = (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Minutes */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-5 p-0"
          onClick={decrementMinutes}
          disabled={disabled || minutes <= 0}
          tabIndex={-1}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          value={minutes}
          onChange={handleMinutesChange}
          disabled={disabled}
          className="w-8 h-7 text-center text-xs p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
          max={99}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onWheel={(e) => e.currentTarget.blur()}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-5 p-0"
          onClick={incrementMinutes}
          disabled={disabled}
          tabIndex={-1}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
      </div>

      <span className="text-muted-foreground text-[10px]">m</span>

      {/* Seconds */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-5 p-0"
          onClick={decrementSeconds}
          disabled={disabled || (minutes <= 0 && seconds <= 0)}
          tabIndex={-1}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          value={seconds}
          onChange={handleSecondsChange}
          disabled={disabled}
          className="w-8 h-7 text-center text-xs p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={0}
          max={59}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onWheel={(e) => e.currentTarget.blur()}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-5 p-0"
          onClick={incrementSeconds}
          disabled={disabled}
          tabIndex={-1}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
      </div>

      <span className="text-muted-foreground text-[10px]">s</span>
    </div>
  );

  if (label) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {inputElement}
      </div>
    );
  }

  return inputElement;
};

export default TimeInput;
