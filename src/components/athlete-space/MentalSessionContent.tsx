import { useId } from "react";
import { Button } from "@/components/ui/button";
import { FormattedText } from "@/components/ui/formatted-text";

/** Navigation follows only headings actually stored by the coach. */
export function MentalSessionContent({ text }: { text: string }) {
  const prefix = useId().replace(/:/g, "");
  const headings = text.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*$/);
    return match ? [match[1].replace(/\*\*|__/g, "")] : [];
  });
  return (
    <section className="min-w-0 space-y-4" aria-label="Consignes du coach">
      {headings.length > 1 && (
        <nav aria-label="Sections de ma séance" className="flex flex-wrap gap-2">
          {headings.map((title, i) => (
            <Button key={i} type="button" variant="outline" size="sm" className="h-auto min-h-10 max-w-full whitespace-normal text-left"
              onClick={() => document.getElementById(`${prefix}-${i}`)?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
              {title}
            </Button>
          ))}
        </nav>
      )}
      <FormattedText text={text} headingIdPrefix={prefix} className="text-base leading-7" />
    </section>
  );
}