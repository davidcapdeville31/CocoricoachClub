 // Block type definitions and layouts for the modular coach page editor
 
 export type BlockType = 'text' | 'image' | 'image_text' | 'gallery' | 'hero';
 
 export interface BlockLayout {
   id: string;
   name: string;
   description: string;
   preview: string; // SVG or icon representation
 }
 
 export interface BlockTypeConfig {
   type: BlockType;
   name: string;
   description: string;
   icon: string;
   layouts: BlockLayout[];
 }
 
 // Text block layouts
 export const textLayouts: BlockLayout[] = [
   {
     id: 'full-width',
     name: 'Pleine largeur',
     description: 'Texte sur toute la largeur',
     preview: 'full-width',
   },
   {
     id: 'narrow',
     name: 'Largeur réduite',
     description: 'Lecture confortable, centré',
     preview: 'narrow',
   },
   {
     id: 'card',
     name: 'Carte',
     description: 'Texte dans une carte avec fond',
     preview: 'card',
   },
   {
     id: 'quote',
     name: 'Citation',
     description: 'Message fort, grande typographie',
     preview: 'quote',
   },
 ];
 
 // Image block layouts
 export const imageLayouts: BlockLayout[] = [
   {
     id: 'full-width',
     name: 'Pleine largeur',
     description: 'Image sur toute la largeur',
     preview: 'full-width',
   },
   {
     id: 'centered',
     name: 'Centrée',
     description: 'Image centrée avec marges',
     preview: 'centered',
   },
   {
     id: 'rounded',
     name: 'Carte arrondie',
     description: 'Image avec coins arrondis',
     preview: 'rounded',
   },
 ];
 
 // Image + Text block layouts
 export const imageTextLayouts: BlockLayout[] = [
   {
     id: 'image-left',
     name: 'Image à gauche',
     description: 'Image à gauche, texte à droite',
     preview: 'image-left',
   },
   {
     id: 'image-right',
     name: 'Image à droite',
     description: 'Texte à gauche, image à droite',
     preview: 'image-right',
   },
   {
     id: 'image-top',
     name: 'Image au-dessus',
     description: 'Image en haut, texte en dessous',
     preview: 'image-top',
   },
   {
     id: 'image-overlay',
     name: 'Texte superposé',
     description: 'Image pleine largeur avec texte par-dessus',
     preview: 'image-overlay',
   },
 ];
 
 // Gallery block layouts
 export const galleryLayouts: BlockLayout[] = [
   {
     id: 'grid-2',
     name: 'Grille 2 colonnes',
     description: '2 images côte à côte',
     preview: 'grid-2',
   },
   {
     id: 'grid-3',
     name: 'Grille 3 colonnes',
     description: '3 images en ligne',
     preview: 'grid-3',
   },
   {
     id: 'grid-4',
     name: 'Grille 4 colonnes',
     description: '4 images en grille',
     preview: 'grid-4',
   },
   {
     id: 'masonry',
     name: 'Mosaïque',
     description: 'Disposition libre',
     preview: 'masonry',
   },
 ];
 
 // Hero block layouts
 export const heroLayouts: BlockLayout[] = [
   {
     id: 'centered',
     name: 'Centré',
     description: 'Texte centré sur l\'image',
     preview: 'centered',
   },
   {
     id: 'left-aligned',
     name: 'Aligné à gauche',
     description: 'Texte aligné à gauche',
     preview: 'left-aligned',
   },
   {
     id: 'bottom',
     name: 'En bas',
     description: 'Texte en bas de l\'image',
     preview: 'bottom',
   },
 ];
 
 // Block type configurations
 export const blockTypeConfigs: BlockTypeConfig[] = [
   {
     type: 'text',
     name: 'Texte',
     description: 'Paragraphe, titre ou citation',
     icon: 'type',
     layouts: textLayouts,
   },
   {
     type: 'image',
     name: 'Image',
     description: 'Photo ou illustration',
     icon: 'image',
     layouts: imageLayouts,
   },
   {
     type: 'image_text',
     name: 'Image + Texte',
     description: 'Combinez image et texte',
     icon: 'layout',
     layouts: imageTextLayouts,
   },
   {
     type: 'gallery',
     name: 'Galerie',
     description: 'Plusieurs images en grille',
     icon: 'grid',
     layouts: galleryLayouts,
   },
   {
     type: 'hero',
     name: 'Hero',
     description: 'Grande image avec texte',
     icon: 'monitor',
     layouts: heroLayouts,
   },
 ];
 
 export const getLayoutsForType = (type: BlockType): BlockLayout[] => {
   const config = blockTypeConfigs.find(c => c.type === type);
   return config?.layouts || [];
 };
 
 export const getDefaultLayoutForType = (type: BlockType): string => {
   const layouts = getLayoutsForType(type);
   return layouts[0]?.id || 'default';
 };
 
 // Block settings interface
export interface BlockSettings {
  textAlign?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  textSize?: 'small' | 'medium' | 'large' | 'xlarge';
  padding?: 'none' | 'small' | 'medium' | 'large';
  titleFont?: string;
  titleFontSize?: string;
  contentFont?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  // Image crop settings (non-destructive)
  imageCrop?: ImageCropSettings;
  // Gallery: per-image crop settings by index
  galleryCrops?: Record<number, ImageCropSettings>;
  // Video background
  videoUrl?: string;
  videoOpacity?: number; // 0 to 1, controls video overlay darkness
}
 
// Non-destructive image crop settings
export interface ImageCropSettings {
  scale: number; // 1 = original, 2 = 200%, etc.
  positionX: number; // percentage offset from center (-50 to 50)
  positionY: number; // percentage offset from center (-50 to 50)
}

export const defaultImageCropSettings: ImageCropSettings = {
  scale: 1,
  positionX: 0,
  positionY: 0,
};

 export const defaultBlockSettings: BlockSettings = {
   textAlign: 'left',
   textSize: 'medium',
   padding: 'medium',
   titleFont: 'default',
   contentFont: 'default',
   overlay: true,
   overlayOpacity: 0.5,
 };
 
 export const fontOptions = [
   { id: 'default', name: 'Par défaut', className: '' },
   { id: 'serif', name: 'Serif (élégant)', className: 'font-serif' },
   { id: 'mono', name: 'Mono (technique)', className: 'font-mono' },
   { id: 'display', name: 'Display (impact)', className: 'font-bold tracking-tight' },
   { id: 'light', name: 'Light (léger)', className: 'font-light' },
 ];