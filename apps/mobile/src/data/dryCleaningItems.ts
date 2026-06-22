import type { DryCleaningItem } from "@/types/domain";

export const dryCleaningItems: DryCleaningItem[] = [
  {
    id: "button-down-long-sleeve",
    name: "Button down long sleeve",
    description: "Pressed long-sleeve button down shirt.",
    price: 5,
    active: true,
    sortOrder: 1,
  },
  {
    id: "dress-pants",
    name: "Dress pants",
    description: "Dry cleaning for dress slacks or trousers.",
    price: 3.5,
    active: true,
    sortOrder: 2,
  },
  {
    id: "blazer",
    name: "Blazer",
    description: "Single jacket or blazer.",
    price: 8,
    active: true,
    sortOrder: 3,
  },
  {
    id: "dress",
    name: "Dress",
    description: "Standard dress dry cleaning.",
    price: 10,
    active: true,
    sortOrder: 4,
  },
];
