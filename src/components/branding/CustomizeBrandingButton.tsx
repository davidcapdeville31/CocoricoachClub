import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Palette } from 'lucide-react';
import { ClubBrandingDialog } from './ClubBrandingDialog';

interface Props {
  clubId: string;
  className?: string;
}

export function CustomizeBrandingButton({ clubId, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`gap-2 bg-white/90 text-slate-900 border-white/40 hover:bg-white hover:text-slate-900 backdrop-blur-sm shadow-sm ${className || ''}`}
      >
        <Palette className="h-4 w-4" />
        Personnaliser
      </Button>
      <ClubBrandingDialog open={open} onOpenChange={setOpen} clubId={clubId} />
    </>
  );
}
