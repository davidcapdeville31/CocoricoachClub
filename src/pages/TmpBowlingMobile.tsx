import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { SimplifiedGamesBlockEditor } from "@/components/bowling/simplified/SimplifiedGamesBlockEditor";
import { newGamesBlock, type SimplifiedGamesBlock } from "@/components/bowling/simplified/types";
import { Button } from "@/components/ui/button";
import "@/index.css";
const queryClient = new QueryClient();
function Preview() {
  const [block, setBlock] = useState<SimplifiedGamesBlock>(() => ({ ...newGamesBlock(), entry_mode: "detailed" }));
  const [saved, setSaved] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  return <QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><main className="mx-auto max-w-4xl p-2"><SimplifiedGamesBlockEditor key={version} value={block} index={0} categoryId="test" hideOilPicker onChange={setBlock} onRemove={() => {}} /><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setSaved(JSON.stringify(block))}>Sauvegarder simulation</Button><Button onClick={() => { if (saved) { setBlock(JSON.parse(saved)); setVersion(v => v + 1); } }}>Réouvrir simulation</Button></div><output data-testid="state" className="sr-only">{JSON.stringify(block)}</output></main></TooltipProvider></QueryClientProvider>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Preview />);