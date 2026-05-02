import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useClubBranding, type LogoCrop } from '@/contexts/ClubBrandingContext';
import { BrandingColorPicker } from '@/components/ui/branding-color-picker';
import { LogoCropModal } from '@/components/branding/LogoCropModal';
import {
  Palette, Upload, RotateCcw, Save, Loader2, ImageIcon, Wand2, Eye, Check, Sparkles, AlertTriangle, Scissors,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  extractColorsFromImage,
  generateBrandingPalette,
  generateDarkPalette,
  getContrastRatio,
  isWCAGCompliant,
  getContrastTextColor,
  PRESET_PALETTES,
  type PresetPalette,
} from '@/lib/brandingColorUtils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
}

const defaultCrop: LogoCrop = { scale: 1, positionX: 0, positionY: 0 };

export function ClubBrandingDialog({ open, onOpenChange, clubId }: Props) {
  const { refreshBranding, applyTheme, resetToDefault } = useClubBranding();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [secondaryColor, setSecondaryColor] = useState('#f5f5f5');
  const [accentColor, setAccentColor] = useState('#dc2626');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logoCrop, setLogoCrop] = useState<LogoCrop>(defaultCrop);
  const [showCropModal, setShowCropModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('club_branding').select('*').eq('club_id', clubId).maybeSingle();
        if (error) { console.error(error); setIsLoading(false); return; }
        if (data) {
          setPrimaryColor(data.primary_color || '#2563eb');
          setSecondaryColor(data.secondary_color || '#f5f5f5');
          setAccentColor(data.accent_color || '#dc2626');
          if (data.logo_crop && typeof data.logo_crop === 'object') {
            const cd = data.logo_crop as Record<string, unknown>;
            setLogoCrop({
              scale: (cd.scale as number) || 1,
              positionX: (cd.positionX as number) || 0,
              positionY: (cd.positionY as number) || 0,
            });
          } else setLogoCrop(defaultCrop);
          if (data.logo_url) {
            const url = `${data.logo_url}?t=${Date.now()}`;
            setLogoUrl(url);
            loadLogoAsDataUrl(url);
          } else { setLogoUrl(null); setLogoDataUrl(null); }
        } else {
          setLogoUrl(null); setLogoDataUrl(null);
          setPrimaryColor('#2563eb'); setSecondaryColor('#f5f5f5'); setAccentColor('#dc2626');
        }
      } finally { setIsLoading(false); }
    };
    load();
  }, [open, clubId]);

  const loadLogoAsDataUrl = async (url: string) => {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (e) => setLogoDataUrl(e.target?.result as string);
      reader.readAsDataURL(blob);
    } catch { setLogoDataUrl(null); }
  };

  // Live preview
  useEffect(() => {
    if (open && !extracting && !isLoading) {
      applyTheme({ primary_color: primaryColor, secondary_color: secondaryColor, accent_color: accentColor });
    }
  }, [primaryColor, secondaryColor, accentColor, open, extracting, isLoading, applyTheme]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Veuillez sélectionner une image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Maximum 5MB'); return; }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve(e.target?.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      setLogoDataUrl(dataUrl);
      const ext = file.name.split('.').pop();
      const path = `${clubId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from('club-logos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('club-logos').getPublicUrl(path);
      setLogoUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success('Logo uploadé !');
      handleExtractColors(dataUrl);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'upload");
    } finally { setUploading(false); }
  };

  const handleExtractColors = async (imageData?: string) => {
    const data = imageData || logoDataUrl;
    if (!data) { toast.error("Veuillez d'abord uploader un logo"); return; }
    setExtracting(true);
    try {
      const colors = await extractColorsFromImage(data);
      setExtractedColors(colors.dominantColors);
      setPrimaryColor(colors.primary);
      setSecondaryColor(colors.secondary);
      setAccentColor(colors.accent);
      toast.success('Palette extraite !');
    } catch (err) {
      console.error(err);
      toast.error("Erreur d'extraction");
    } finally { setExtracting(false); }
  };

  const handlePresetSelect = (p: PresetPalette) => {
    setPrimaryColor(p.primary); setSecondaryColor(p.secondary); setAccentColor(p.accent);
    toast.success(`Thème "${p.name}" appliqué`);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanLogoUrl = logoUrl?.split('?')[0] || null;
      const { error } = await supabase.from('club_branding').upsert({
        club_id: clubId,
        logo_url: cleanLogoUrl,
        logo_crop: cleanLogoUrl ? (logoCrop as any) : null,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        is_custom: true,
      }, { onConflict: 'club_id' });
      if (error) throw error;
      await refreshBranding();
      toast.success('Personnalisation enregistrée !');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'enregistrement");
    } finally { setSaving(false); }
  };

  const handleReset = async () => {
    if (!confirm('Revenir au thème par défaut ?')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('club_branding').update({ is_custom: false }).eq('club_id', clubId);
      if (error) throw error;
      resetToDefault();
      setPrimaryColor('#2563eb'); setSecondaryColor('#f5f5f5'); setAccentColor('#dc2626');
      setLogoUrl(null); setLogoDataUrl(null); setExtractedColors([]);
      await refreshBranding();
      toast.success('Thème par défaut restauré');
    } catch (err) {
      console.error(err);
      toast.error('Erreur');
    } finally { setSaving(false); }
  };

  const primaryContrast = getContrastRatio(primaryColor, getContrastTextColor(primaryColor));
  const accentContrast = getContrastRatio(accentColor, getContrastTextColor(accentColor));
  const palette = generateBrandingPalette(primaryColor, secondaryColor, accentColor);
  const darkPalette = generateDarkPalette(primaryColor, secondaryColor, accentColor);

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Personnaliser mon application
          </DialogTitle>
          <DialogDescription>
            Personnalisez l'interface avec votre logo et vos couleurs. Le thème s'appliquera à tous les membres du club.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="logo" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="logo" className="gap-2"><ImageIcon className="h-4 w-4" />Logo</TabsTrigger>
            <TabsTrigger value="colors" className="gap-2"><Palette className="h-4 w-4" />Couleurs</TabsTrigger>
            <TabsTrigger value="preview" className="gap-2"><Eye className="h-4 w-4" />Aperçu</TabsTrigger>
          </TabsList>

          <TabsContent value="logo" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4">
                  <div
                    onClick={() => !logoDataUrl && fileInputRef.current?.click()}
                    className={cn(
                      "w-full max-w-md h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all overflow-hidden bg-muted/30",
                      !logoDataUrl && "cursor-pointer hover:border-primary hover:bg-primary/5",
                      uploading && "opacity-50 pointer-events-none"
                    )}
                  >
                    {logoDataUrl ? (
                      <div className="relative w-full h-full overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
                        <img
                          src={logoDataUrl}
                          alt="Logo"
                          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                          style={{
                            transform: `scale(${logoCrop.scale}) translate(${logoCrop.positionX / logoCrop.scale}%, ${logoCrop.positionY / logoCrop.scale}%)`,
                            transformOrigin: 'center center',
                          }}
                        />
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Cliquez pour uploader votre logo</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG ou SVG (max. 5MB)</p>
                      </>
                    )}
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />

                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Upload className="h-4 w-4 mr-2" />
                      {logoDataUrl ? 'Changer' : 'Uploader un logo'}
                    </Button>
                    {logoDataUrl && (
                      <>
                        <Button variant="outline" onClick={() => setShowCropModal(true)}>
                          <Scissors className="h-4 w-4 mr-2" />Recadrer
                        </Button>
                        <Button variant="default" onClick={() => handleExtractColors()} disabled={extracting}>
                          {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                          Extraire couleurs
                        </Button>
                      </>
                    )}
                  </div>

                  {extractedColors.length > 0 && (
                    <div className="w-full max-w-md">
                      <Label className="text-sm text-muted-foreground mb-2 block">
                        Couleurs détectées dans votre logo
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {extractedColors.slice(0, 8).map((color, i) => (
                          <button
                            key={i}
                            onClick={() => setPrimaryColor(color)}
                            className="w-8 h-8 rounded-lg border shadow-sm hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={`Utiliser ${color}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="colors" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <Label className="text-sm font-medium mb-3 block">Thèmes prédéfinis</Label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_PALETTES.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      className={cn(
                        "p-2 rounded-lg border-2 transition-all hover:scale-105",
                        primaryColor === preset.primary && accentColor === preset.accent
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-muted"
                      )}
                      title={preset.name}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg">{preset.icon}</span>
                        <div className="flex gap-0.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.primary }} />
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.accent }} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Couleur principale</Label>
                      <Badge variant={isWCAGCompliant(primaryContrast) ? "default" : "destructive"} className="text-xs">
                        {isWCAGCompliant(primaryContrast)
                          ? <><Check className="h-3 w-3 mr-1" /> AA</>
                          : <><AlertTriangle className="h-3 w-3 mr-1" /> Contraste</>}
                      </Badge>
                    </div>
                    <BrandingColorPicker value={primaryColor} onChange={setPrimaryColor} />
                    <p className="text-xs text-muted-foreground">Boutons, liens, titres, éléments actifs</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Couleur secondaire</Label>
                    <BrandingColorPicker value={secondaryColor} onChange={setSecondaryColor} />
                    <p className="text-xs text-muted-foreground">Fonds, surfaces, éléments neutres</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Couleur d'accent</Label>
                      <Badge variant={isWCAGCompliant(accentContrast) ? "default" : "destructive"} className="text-xs">
                        {isWCAGCompliant(accentContrast)
                          ? <><Check className="h-3 w-3 mr-1" /> AA</>
                          : <><AlertTriangle className="h-3 w-3 mr-1" /> Contraste</>}
                      </Badge>
                    </div>
                    <BrandingColorPicker value={accentColor} onChange={setAccentColor} />
                    <p className="text-xs text-muted-foreground">Notifications, badges, indicateurs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <Label className="text-sm text-muted-foreground mb-3 block">Hiérarchie des boutons</Label>
                  <div className="flex flex-wrap gap-3">
                    <Button>Bouton principal</Button>
                    <Button variant="outline">Bouton secondaire</Button>
                    <Button variant="ghost">Bouton tertiaire</Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm text-muted-foreground mb-3 block">Badges</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge style={{ backgroundColor: primaryColor, color: palette.primaryForeground }}>Nouveau</Badge>
                    <Badge style={{ backgroundColor: accentColor, color: palette.accentForeground }}>Important</Badge>
                    <Badge variant="secondary">Neutre</Badge>
                    <Badge variant="outline">Outline</Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm text-muted-foreground mb-3 block">Exemple de carte</Label>
                  <Card className="max-w-sm">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        {logoDataUrl ? (
                          <img src={logoDataUrl} alt="Logo" className="h-10 w-10 object-contain" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                            <Sparkles className="h-5 w-5" style={{ color: palette.primaryForeground }} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold">Séance du jour</h4>
                          <p className="text-sm text-muted-foreground">3 exercices • 45 min</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm">Commencer</Button>
                        <Button size="sm" variant="ghost">Détails</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div>
                  <Label className="text-sm text-muted-foreground mb-3 block">Aperçu modes clair et sombre</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
                      <p className="text-xs mb-2 font-medium" style={{ color: palette.mutedForeground }}>☀️ Mode clair</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: palette.primary, color: palette.primaryForeground }}>Principal</span>
                        <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: palette.accent, color: palette.accentForeground }}>Accent</span>
                      </div>
                      <p className="text-sm" style={{ color: palette.foreground }}>Texte sur fond clair</p>
                    </div>
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: darkPalette.background, borderColor: darkPalette.border }}>
                      <p className="text-xs mb-2 font-medium" style={{ color: darkPalette.mutedForeground }}>🌙 Mode sombre</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: darkPalette.primary, color: darkPalette.primaryForeground }}>Principal</span>
                        <span className="px-2 py-1 rounded text-xs font-medium" style={{ backgroundColor: darkPalette.accent, color: darkPalette.accentForeground }}>Accent</span>
                      </div>
                      <p className="text-sm" style={{ color: darkPalette.foreground }}>Texte sur fond sombre</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Les contrastes sont automatiquement optimisés pour l'accessibilité (WCAG AA)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset} disabled={saving} className="text-destructive hover:text-destructive">
            <RotateCcw className="h-4 w-4 mr-2" />Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </div>
        </div>
      </DialogContent>

      {logoDataUrl && (
        <LogoCropModal
          isOpen={showCropModal}
          onClose={() => setShowCropModal(false)}
          imageUrl={logoDataUrl}
          initialCrop={logoCrop}
          onSave={(c) => { setLogoCrop(c); toast.success('Recadrage appliqué'); }}
        />
      )}
    </Dialog>
  );
}
