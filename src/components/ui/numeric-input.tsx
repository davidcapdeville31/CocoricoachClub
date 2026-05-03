import * as React from "react";
import { cn } from "@/lib/utils";

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string | number | undefined;
  onChange: (value: string) => void;
  /** Minimum width in characters (ch units) */
  minChars?: number;
  /** Maximum width in characters (ch units) */
  maxChars?: number;
  /** Whether to show unit suffix */
  suffix?: string;
}

/**
 * Auto-resizing numeric input that adapts width to content
 * Uses ch units for character-based sizing
 */
const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      className,
      value,
      onChange,
      minChars = 5, // Increased from 3 to 5 for better visibility
      maxChars = 10, // Increased from 8 to 10
      suffix,
      placeholder,
      ...props
    },
    ref
  ) => {
    // Calculate width based on content
    const displayValue = value !== undefined && value !== "" ? String(value) : "";
    const placeholderLength = placeholder ? placeholder.length : 3;
    const contentLength = displayValue.length || placeholderLength;
    
    // Add padding for comfortable display (2.5 extra chars for better spacing)
    const calculatedWidth = Math.max(
      minChars,
      Math.min(maxChars, contentLength + 2.5)
    );

    // Minimum pixel width for usability
    const minPixelWidth = 60; // Minimum 60px to ensure values are always visible

    return (
      <div className="relative inline-flex items-center">
        <input
          type="text"
          inputMode="decimal"
          className={cn(
            "h-8 rounded-md px-3 py-1 text-sm text-center",
            // CRITICAL: Visible border and background for editable fields
            "border-2 border-input bg-white dark:bg-background",
            "ring-offset-background transition-all duration-200",
            "placeholder:text-muted-foreground/60",
            "hover:border-primary/50 hover:bg-white dark:hover:bg-card",
            "focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:outline-none focus:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          style={{
            width: `max(${minPixelWidth}px, ${calculatedWidth}ch)`,
            minWidth: `max(${minPixelWidth}px, ${minChars}ch)`,
            maxWidth: `${maxChars}ch`,
          }}
          ref={ref}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.currentTarget.blur()}
          onFocus={(e) => e.target.select()}
          {...props}
        />
        {suffix && (
          <span className="text-xs text-muted-foreground ml-1 shrink-0 font-medium">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
