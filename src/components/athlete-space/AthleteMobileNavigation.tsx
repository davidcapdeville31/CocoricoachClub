import { useState } from "react";
import { Activity, BarChart3, CalendarDays, Home, LogOut, MessageSquare, Moon, MoreHorizontal, Sun, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useFieldMode } from "@/contexts/FieldModeContext";
import { cn } from "@/lib/utils";

export interface AthleteDestination {
  value: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export function AthleteThemeCommand() {
  const { fieldMode, toggleFieldMode } = useFieldMode();
  return <Button variant="secondary" onClick={toggleFieldMode} className="min-h-11 gap-2" aria-label={fieldMode ? "Passer en mode clair" : "Passer en mode sombre"}>
    {fieldMode ? <Sun /> : <Moon />}
    {fieldMode ? "Mode clair" : "Mode sombre"}
  </Button>;
}

export function AthleteMobileNavigation({ active, onNavigate, secondary, unreadMessages, recordCount, onBack, onSignOut }: {
  active: string;
  onNavigate: (value: string) => void;
  secondary: AthleteDestination[];
  unreadMessages: number;
  recordCount: number;
  onBack?: () => void;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const primary: AthleteDestination[] = [
    { value: "dashboard", label: "Accueil", icon: Home },
    { value: "calendar", label: "Planning", icon: CalendarDays },
    { value: "stats", label: "Stats", icon: BarChart3, count: recordCount },
    { value: "messaging", label: "Chat", icon: MessageSquare, count: unreadMessages },
  ];
  const secondaryActive = !primary.some(item => item.value === active);
  const moreCount = secondary.reduce((sum, item) => sum + (item.count || 0), 0);
  const choose = (value: string) => { onNavigate(value); setOpen(false); };
  const badge = (count?: number) => count ? <span className="athlete-nav-count">{count > 9 ? "9+" : count}</span> : null;
  return <>
    <nav className="athlete-bottom-nav md:hidden" aria-label="Navigation athlète">
      {primary.map(({ value, label, icon: Icon, count }) => <Button key={value} variant="ghost"
        className={cn("athlete-bottom-item", active === value && "is-active")}
        aria-current={active === value ? "page" : undefined} onClick={() => choose(value)}>
        <span className="relative"><Icon strokeWidth={1.8} />{badge(count)}</span><span>{label}</span>
      </Button>)}
      <Button variant="ghost" className={cn("athlete-bottom-item", (secondaryActive || open) && "is-active")}
        aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="relative"><MoreHorizontal strokeWidth={1.8} />{badge(moreCount)}</span><span>Plus</span>
      </Button>
    </nav>
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
      <DrawerContent className="athlete-space athlete-more-panel" aria-describedby={undefined}>
        <DrawerHeader className="flex items-center justify-between pb-3">
          <DrawerTitle>Mon espace</DrawerTitle>
          <DrawerClose asChild><Button size="icon" variant="ghost" aria-label="Fermer le menu"><X /></Button></DrawerClose>
        </DrawerHeader>
        <div className="athlete-more-grid">
          {secondary.map(({ value, label, icon: Icon, count }) => <Button key={value} variant="ghost"
            className={cn("athlete-more-item", active === value && "is-active")} onClick={() => choose(value)}>
            <span className="relative"><Icon strokeWidth={1.8} />{badge(count)}</span><span>{label}</span>
          </Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border mx-4 mt-4 pt-4">
          <AthleteThemeCommand />
          {onBack && <Button variant="ghost" className="min-h-11" onClick={() => { setOpen(false); onBack(); }}>Retour</Button>}
          {onSignOut && <Button variant="ghost" className="min-h-11" onClick={onSignOut}><LogOut />Déconnexion</Button>}
        </div>
      </DrawerContent>
    </Drawer>
  </>;
}