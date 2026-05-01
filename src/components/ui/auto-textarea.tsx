 import * as React from "react";
 import { cn } from "@/lib/utils";
 
 export interface AutoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
   minRows?: number;
   maxRows?: number;
 }
 
 const AutoTextarea = React.forwardRef<HTMLTextAreaElement, AutoTextareaProps>(
   ({ className, minRows = 3, maxRows = 20, onChange, value, ...props }, ref) => {
     const textareaRef = React.useRef<HTMLTextAreaElement>(null);
     const combinedRef = (node: HTMLTextAreaElement) => {
       textareaRef.current = node;
       if (typeof ref === 'function') {
         ref(node);
       } else if (ref) {
         ref.current = node;
       }
     };
 
     const adjustHeight = React.useCallback(() => {
       const textarea = textareaRef.current;
       if (!textarea) return;
 
       // Reset height to auto to get the correct scrollHeight
       textarea.style.height = 'auto';
       
       // Calculate line height
       const computedStyle = window.getComputedStyle(textarea);
       const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
       const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
       const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
       
       const minHeight = lineHeight * minRows + paddingTop + paddingBottom;
       const maxHeight = lineHeight * maxRows + paddingTop + paddingBottom;
       
       // Set height based on content, bounded by min/max
       const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
       textarea.style.height = `${newHeight}px`;
     }, [minRows, maxRows]);
 
     React.useEffect(() => {
       adjustHeight();
     }, [value, adjustHeight]);
 
     const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
       onChange?.(e);
       adjustHeight();
     };
 
     return (
       <textarea
         className={cn(
           "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-y-auto",
           className,
         )}
         ref={combinedRef}
         value={value}
         onChange={handleChange}
         {...props}
       />
     );
   }
 );
 AutoTextarea.displayName = "AutoTextarea";
 
 export { AutoTextarea };