import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, v];
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}

export function BrandingColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(1);
  const [brightness, setBrightness] = useState(1);

  const paletteRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const isDraggingPalette = useRef(false);
  const isDraggingHue = useRef(false);

  useEffect(() => {
    setHexInput(value);
    const rgb = hexToRgb(value);
    if (rgb) {
      const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      setHue(h); setSaturation(s); setBrightness(v);
    }
  }, [value]);

  const updateColorFromHsv = useCallback((h: number, s: number, v: number) => {
    const [r, g, b] = hsvToRgb(h, s, v);
    const hex = rgbToHex(r, g, b);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handlePaletteInteraction = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!paletteRef.current) return;
    const rect = paletteRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSaturation(x); setBrightness(1 - y);
    updateColorFromHsv(hue, x, 1 - y);
  }, [hue, updateColorFromHsv]);

  const handleHueInteraction = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHue(x);
    updateColorFromHsv(x, saturation, brightness);
  }, [saturation, brightness, updateColorFromHsv]);

  const handlePaletteMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingPalette.current = true;
    handlePaletteInteraction(e);
    const mm = (e: MouseEvent) => { if (isDraggingPalette.current) handlePaletteInteraction(e); };
    const mu = () => { isDraggingPalette.current = false; document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  };

  const handleHueMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHue.current = true;
    handleHueInteraction(e);
    const mm = (e: MouseEvent) => { if (isDraggingHue.current) handleHueInteraction(e); };
    const mu = () => { isDraggingHue.current = false; document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    setHexInput(inputValue);
    if (!inputValue.startsWith('#')) inputValue = '#' + inputValue;
    if (/^#[0-9A-Fa-f]{6}$/.test(inputValue)) {
      onChange(inputValue.toLowerCase());
      const rgb = hexToRgb(inputValue);
      if (rgb) {
        const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
        setHue(h); setSaturation(s); setBrightness(v);
      }
    }
  };

  const handleHexBlur = () => {
    let normalized = hexInput;
    if (!normalized.startsWith('#')) normalized = '#' + normalized;
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      setHexInput(normalized.toLowerCase());
      onChange(normalized.toLowerCase());
    } else setHexInput(value);
  };

  const [hueR, hueG, hueB] = hsvToRgb(hue, 1, 1);
  const hueColor = `rgb(${hueR}, ${hueG}, ${hueB})`;

  return (
    <div className={cn("flex gap-2 items-center", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-10 h-10 rounded-lg border border-input cursor-pointer shadow-sm hover:shadow transition-shadow flex-shrink-0"
            style={{ backgroundColor: value }}
            aria-label="Choisir une couleur"
          />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div
            ref={paletteRef}
            className="relative w-full h-40 rounded-lg cursor-crosshair select-none"
            style={{ background: `linear-gradient(to right, #fff, ${hueColor})` }}
            onMouseDown={handlePaletteMouseDown}
          >
            <div className="absolute inset-0 rounded-lg" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{ left: `${saturation * 100}%`, top: `${(1 - brightness) * 100}%`, transform: 'translate(-50%, -50%)', backgroundColor: value }}
            />
          </div>
          <div
            ref={hueRef}
            className="relative w-full h-4 mt-3 rounded-lg cursor-pointer select-none"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
            onMouseDown={handleHueMouseDown}
          >
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{ left: `${hue * 100}%`, top: '50%', transform: 'translate(-50%, -50%)', backgroundColor: hueColor }}
            />
          </div>
          <div className="mt-3">
            <Input type="text" value={hexInput} onChange={handleHexChange} onBlur={handleHexBlur} placeholder="#000000" className="font-mono text-sm" maxLength={7} />
          </div>
        </PopoverContent>
      </Popover>
      <Input type="text" value={hexInput} onChange={handleHexChange} onBlur={handleHexBlur} placeholder="#000000" className="font-mono flex-1" maxLength={7} />
    </div>
  );
}
