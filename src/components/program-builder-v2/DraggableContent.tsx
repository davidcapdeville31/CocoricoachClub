import React, { useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * A wrapper that allows drag from anywhere EXCEPT active input fields.
 * This enables intuitive "drag from anywhere" behavior while preserving
 * the ability to edit form fields without triggering drag.
 */

interface DraggableContentProps {
  children: React.ReactNode;
  className?: string;
}

// Elements that should NOT trigger drag when focused/active
const INTERACTIVE_SELECTORS = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  'button',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
];

/**
 * Check if the event target is an interactive element that should block drag
 */
const isInteractiveElement = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  
  // Check if the target matches any interactive selector
  const isInteractive = INTERACTIVE_SELECTORS.some(selector => 
    target.matches(selector)
  );
  
  // Also check if we're inside a button or other interactive element
  const closestInteractive = target.closest(
    INTERACTIVE_SELECTORS.join(', ')
  );
  
  return isInteractive || !!closestInteractive;
};

/**
 * Wrapper component that allows drag from anywhere except focused inputs.
 * Use this to wrap the content inside a draggable item.
 */
export const DraggableContent = ({ children, className }: DraggableContentProps) => {
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only stop propagation if clicking on an interactive element
    if (isInteractiveElement(e.target)) {
      e.stopPropagation();
    }
    // Otherwise, let the event bubble up to trigger drag
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Only stop propagation for interactive elements
    if (isInteractiveElement(e.target)) {
      e.stopPropagation();
    }
  }, []);

  return (
    <div 
      className={cn("flex-1 min-w-0", className)}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </div>
  );
};

/**
 * A simpler version that just wraps interactive controls.
 * Use this to wrap specific input groups within draggable content.
 */
export const InteractiveZone = ({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string;
}) => {
  return (
    <div 
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
};

export default DraggableContent;
