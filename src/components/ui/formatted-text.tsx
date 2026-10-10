import { Fragment, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Rendu léger du Markdown saisi par le staff (titres, gras, italique, listes,
 * paragraphes, retours à la ligne). Les marqueurs orphelins (« ** » non fermés)
 * sont retirés au lieu d'être affichés. Le texte enregistré n'est jamais modifié.
 */
function renderInline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  const clean = (s: string) => s.replace(/\*\*|__/g, "");
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(clean(text.slice(last, m.index)));
    if (m[1] || m[2]) out.push(<strong key={`${key}-${i++}`} className="font-semibold text-foreground">{m[1] || m[2]}</strong>);
    else out.push(<em key={`${key}-${i++}`}>{m[3] || m[4]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(clean(text.slice(last)));
  return out;
}

type Block =
  | { t: "h"; level: number; text: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "p"; lines: string[] };

export function parseBlocks(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { blocks.push({ t: "p", lines: para }); para = []; } };
  src.replace(/\r\n/g, "\n").split("\n").forEach((raw) => {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); return; }
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) { flush(); blocks.push({ t: "h", level: h[1].length, text: h[2] }); return; }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flush();
      const type = ul ? "ul" : "ol";
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === type) prev.items.push((ul || ol)![1]);
      else blocks.push({ t: type, items: [(ul || ol)![1]] });
      return;
    }
    para.push(line.trim());
  });
  flush();
  return blocks;
}

export function FormattedText({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed break-words", className)}>
      {blocks.map((b, i) => {
        if (b.t === "h") return <p key={i} className="font-semibold text-foreground pt-1">{renderInline(b.text, `h${i}`)}</p>;
        if (b.t === "ul" || b.t === "ol") {
          const L = (b.t === "ul" ? "ul" : "ol") as "ul" | "ol";
          return (
            <L key={i} className={cn("pl-5 space-y-1", b.t === "ul" ? "list-disc" : "list-decimal")}>
              {b.items.map((it, j) => <li key={j}>{renderInline(it, `l${i}-${j}`)}</li>)}
            </L>
          );
        }
        if (b.t !== "p") return null;
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>{j > 0 && <br />}{renderInline(l, `p${i}-${j}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Aperçu court (quelques lignes) avec « Voir plus » pour éviter les longs défilements. */
export function CollapsibleFormattedText({ text, className, lines = 3 }: { text: string; className?: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 180 || text.split("\n").length > lines + 1;
  return (
    <div className={className}>
      <div className={cn(!open && long && "relative max-h-[4.5rem] overflow-hidden")}>
        <FormattedText text={text} />
        {!open && long && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent" />}
      </div>
      {long && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          className="mt-1 text-xs font-medium text-primary" aria-expanded={open}>
          {open ? "Voir moins" : "Voir les consignes"}
        </button>
      )}
    </div>
  );
}
