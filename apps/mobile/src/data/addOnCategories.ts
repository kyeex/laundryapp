import type { AddOn, AddOnCategory } from "@/types/domain";

export const addOnCategories: Array<{
  id: AddOnCategory;
  title: string;
  description: string;
}> = [
  {
    id: "washers",
    title: "Washer loads",
    description: "Choose washer load sizes that match your laundry.",
  },
  {
    id: "detergent",
    title: "Detergent",
    description: "Pick the detergent option that fits your care needs.",
  },
  {
    id: "drying",
    title: "Drying heat",
    description: "Select a preferred drying temperature.",
  },
  {
    id: "extras",
    title: "Laundry extras",
    description: "Add bedding, sorting, or special service options.",
  },
];

const addOnCategoryById: Record<string, AddOnCategory> = {
  "small-washer": "washers",
  "medium-washer": "washers",
  "large-washer": "washers",
  "tide-detergent": "detergent",
  "sensitive-skin-detergent": "detergent",
  "dry-low-heat": "drying",
  "dry-medium-heat": "drying",
  "dry-high-heat": "drying",
};

export function getAddOnCategoryId(
  addOn: Pick<AddOn, "id" | "category">,
): AddOnCategory {
  return addOn.category ?? addOnCategoryById[addOn.id] ?? "extras";
}
