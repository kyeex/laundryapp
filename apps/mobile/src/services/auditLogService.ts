import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";

import { getFirebaseFirestore, shouldUseDemoBackend } from "@/config/firebase";
import type { UserRole } from "@/types/domain";

type AuditResourceType =
  | "order"
  | "batch"
  | "catalog"
  | "configuration"
  | "user"
  | "payment"
  | "rewards";

export type AuditLogInput = {
  actorId: string;
  actorRole: UserRole;
  action: string;
  resourceType: AuditResourceType;
  resourceId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type AuditLog = Omit<AuditLogInput, "metadata"> & {
  id: string;
  createdAt: Date | null;
  metadata: Record<string, unknown>;
};

function mapAuditLog(id: string, data: DocumentData): AuditLog {
  return {
    id,
    actorId: data.actorId ?? "",
    actorRole: data.actorRole ?? "customer",
    action: data.action ?? "",
    resourceType: data.resourceType ?? "order",
    resourceId: data.resourceId ?? "",
    summary: data.summary ?? "",
    metadata: data.metadata ?? {},
    createdAt: data.createdAt?.toDate?.() ?? null,
  };
}

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

export async function getAuditLogs(maxCount = 100) {
  if (shouldUseDemoBackend) {
    return [];
  }

  const db = getFirebaseFirestore();
  const logsQuery = query(
    collection(db, "auditLogs"),
    orderBy("createdAt", "desc"),
    limit(maxCount),
  );
  const snapshot = await getDocs(logsQuery);

  return snapshot.docs.map((auditDoc) =>
    mapAuditLog(auditDoc.id, auditDoc.data()),
  );
}
