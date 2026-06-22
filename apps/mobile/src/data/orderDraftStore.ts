import type { AppUser, CreateOrderInput } from "@/types/domain";

export type OrderDraft = {
  customer: AppUser;
  input: CreateOrderInput;
  createdAt: string;
};

const orderDraftStorageKey = "laundryapp.orderDraft.v1";

function getStorage() {
  try {
    return "sessionStorage" in globalThis ? globalThis.sessionStorage : null;
  } catch {
    return null;
  }
}

let memoryDraft: OrderDraft | null = null;

export function saveOrderDraft(draft: OrderDraft) {
  memoryDraft = draft;
  getStorage()?.setItem(orderDraftStorageKey, JSON.stringify(draft));
}

export function getOrderDraft() {
  if (memoryDraft) {
    return memoryDraft;
  }

  const storedDraft = getStorage()?.getItem(orderDraftStorageKey);

  if (!storedDraft) {
    return null;
  }

  try {
    memoryDraft = JSON.parse(storedDraft) as OrderDraft;
    return memoryDraft;
  } catch {
    clearOrderDraft();
    return null;
  }
}

export function clearOrderDraft() {
  memoryDraft = null;
  getStorage()?.removeItem(orderDraftStorageKey);
}
