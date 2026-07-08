import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  photoUrl?: string | null;
  online?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  showDot?: boolean;
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
} as const;

const DOT_SIZE = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
} as const;

function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function UserAvatar({
  name,
  photoUrl,
  online,
  size = "sm",
  className,
  showDot = true,
}: UserAvatarProps) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className={cn(SIZES[size])}>
        {photoUrl ? <AvatarImage src={photoUrl} alt={name || "avatar"} /> : null}
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {showDot && online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2 ring-background",
            DOT_SIZE[size],
            online ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
          aria-label={online ? "en ligne" : "hors ligne"}
        />
      )}
    </div>
  );
}
