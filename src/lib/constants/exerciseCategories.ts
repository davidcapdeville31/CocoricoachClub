export const EXERCISE_CATEGORIES = [
  { value: "stretching_mobility", label: "Stretching / Mobilité" },
  { value: "musculation", label: "Musculation" },
  { value: "terrain", label: "Terrain (courses, sprints...)" },
] as const;

export const EXERCISE_SUBCATEGORIES = [
  { value: "renforcement", label: "Renforcement", parentCategory: "musculation" },
  { value: "conditioning", label: "Conditioning", parentCategory: "musculation" },
  { value: "halterophilie", label: "Haltérophilie", parentCategory: "musculation" },
  { value: "gymnastique", label: "Gymnastique", parentCategory: "musculation" },
  { value: "plyometrie", label: "Pliométrie", parentCategory: "musculation" },
  { value: "prophylaxie", label: "Prophylaxie / Réathlétisation", parentCategory: "stretching_mobility" },
  { value: "mobilite", label: "Mobilité", parentCategory: "stretching_mobility" },
  { value: "echauffement", label: "Échauffement", parentCategory: "stretching_mobility" },
] as const;

export const DIFFICULTY_LEVELS = [
  { value: "beginner", label: "Débutant" },
  { value: "intermediate", label: "Intermédiaire" },
  { value: "advanced", label: "Avancé" },
] as const;

export function getSubcategoriesForCategory(category: string) {
  return EXERCISE_SUBCATEGORIES.filter(sub => sub.parentCategory === category);
}

export function getSubcategoryLabel(value: string | null | undefined): string {
  if (!value) return "";
  const subcategory = EXERCISE_SUBCATEGORIES.find(s => s.value === value);
  return subcategory?.label || value;
}

export function getCategoryLabel(value: string): string {
  const category = EXERCISE_CATEGORIES.find(c => c.value === value);
  return category?.label || value;
}
