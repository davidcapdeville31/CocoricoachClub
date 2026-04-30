import type { TestCategory } from "@/lib/constants/testCategories";

export interface CustomTestCatalogItem {
  name: string;
  test_category: string;
  unit: string | null;
  is_time?: boolean | null;
}

export const formatCategoryLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const normalizeCustomTestType = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function mergeCustomTestsIntoCategories(
  baseCategories: TestCategory[],
  customTests: CustomTestCatalogItem[]
): TestCategory[] {
  const mergedCategories = baseCategories.map((category) => ({
    ...category,
    tests: [...category.tests],
  }));

  const categoryMap = new Map(mergedCategories.map((category) => [category.value, category]));

  customTests.forEach((customTest) => {
    if (!customTest.test_category || !customTest.name) return;

    const testValue = `custom_${normalizeCustomTestType(customTest.name)}`;
    let category = categoryMap.get(customTest.test_category);

    if (!category) {
      category = {
        value: customTest.test_category,
        label: formatCategoryLabel(customTest.test_category),
        tests: [],
      };
      mergedCategories.push(category);
      categoryMap.set(customTest.test_category, category);
    }

    if (!category.tests.some((test) => test.value === testValue)) {
      category.tests.push({
        value: testValue,
        label: customTest.name,
        unit: customTest.unit || "",
        isTime: Boolean(customTest.is_time),
      });
    }
  });

  return mergedCategories;
}