import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Globe, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AppLanguage } from "@/i18n";

const OPTIONS: { value: AppLanguage; flag: string; labelKey: string }[] = [
  { value: "fr", flag: "🇫🇷", labelKey: "language.french" },
  { value: "en", flag: "🇬🇧", labelKey: "language.english" },
];

interface Props {
  /** Compact icon-only trigger, for dense headers */
  compact?: boolean;
  className?: string;
}

export function LanguageSwitcher({ compact = true, className }: Props) {
  const { language, defaultLanguage, setLanguage, saveAsDefault, savingDefault } = useLanguage();
  const { t } = useTranslation();

  const handleSaveDefault = async () => {
    const ok = await saveAsDefault();
    if (ok) toast.success(t("language.defaultSaved"));
    else toast.error(t("language.saveError"));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={compact ? `h-8 w-8 ${className ?? ""}` : className}
          title={t("language.label")}
          aria-label={t("language.label")}
        >
          <Globe className={compact ? "h-3.5 w-3.5" : "h-4 w-4 mr-2"} />
          {!compact && language.toUpperCase()}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
          {t("language.label")}
        </p>
        <div className="space-y-1">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLanguage(opt.value)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-muted transition-colors"
            >
              <span aria-hidden>{opt.flag}</span>
              <span className="flex-1 text-left">{t(opt.labelKey)}</span>
              {defaultLanguage === opt.value && (
                <Star className="h-3.5 w-3.5 text-primary" aria-label={t("language.isDefault")} />
              )}
              {language === opt.value && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2 w-full"
          onClick={handleSaveDefault}
        >
          <Star className="mr-2 h-3.5 w-3.5" />
          {savingDefault ? t("common.loading") : t("language.setDefault")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
