import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Raw HTML is not executed; links use the renderer's safe URL transform. */
export function FormattedText({ text, className, headingIdPrefix }: { text: string; className?: string; headingIdPrefix?: string }) {
  let headingIndex = 0;
  const heading = ({ children }: { children?: React.ReactNode }) => {
    const id = headingIdPrefix ? `${headingIdPrefix}-${headingIndex++}` : undefined;
    return <h3 id={id} className="scroll-mt-4 pt-3 text-base font-semibold leading-snug text-foreground">{children}</h3>;
  };
  return (
    <div className={cn("min-w-0 space-y-3 text-sm leading-relaxed break-words [overflow-wrap:anywhere]", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        h1: heading, h2: heading, h3: heading, h4: heading, h5: heading, h6: heading,
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children, start }) => <ol start={start} className="list-decimal space-y-1 pl-5">{children}</ol>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-accent pl-3 text-muted-foreground">{children}</blockquote>,
        pre: ({ children }) => <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3">{children}</pre>,
        table: ({ children }) => <div className="overflow-x-auto"><table className="w-full text-sm">{children}</table></div>,
        th: ({ children }) => <th className="border border-border p-2 text-left">{children}</th>,
        td: ({ children }) => <td className="border border-border p-2">{children}</td>,
      }}>{text}</ReactMarkdown>
    </div>
  );
}

export function CollapsibleFormattedText({ text, className, lines = 3 }: { text: string; className?: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 180 || text.split("\n").length > lines + 1;
  return (
    <div className={className}>
      <div className={cn(!open && long && "max-h-[4.5rem] overflow-hidden")}><FormattedText text={text} /></div>
      {long && <Button type="button" variant="ghost" size="sm" className="mt-1 h-9 px-0 text-primary" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>{open ? "Voir moins" : "Voir les consignes"}</Button>}
    </div>
  );
}