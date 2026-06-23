import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { getFirebaseFirestore, shouldUseDemoBackend } from "@/config/firebase";
import type { UserRole } from "@/types/domain";

type AuditResourceType =
  | "order"
  | "batch"
  | "catalog"
  | "configuration"
  | "user"
  | "payment";

export type AuditLogInput = {
  actorId: string;
  actorRole: UserRole;
  action: string;
  resourceType: AuditResourceType;
  resourceId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function recordAuditLog(input: AuditLogInput) {
  if (shouldUseDemoBackend) {
    return;
  }

  const db = getFirebaseFirestore();

  await addDoc(collection(db, "auditLogs"), {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    summary: input.summary,
    metadata: input.metadata ?? {},
    createdAt: serverTimestamp(),
  });
}
