"use client";

import { api } from "./api-client";
import type { AdminRecordKind } from "./admin-records-config";

type StoredRecord = Record<string, unknown> & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export async function getAdminRecords<T extends StoredRecord>(
  kind: AdminRecordKind,
): Promise<T[]> {
  const result = await api<{ records: T[] }>(
    "/api/admin/records?kind=" + encodeURIComponent(kind),
  );
  return result.records;
}

export async function putAdminRecord<T extends StoredRecord>(
  kind: AdminRecordKind,
  id: string,
  patch: Partial<Omit<T, "id" | "createdAt" | "updatedAt" | "updatedBy">>,
): Promise<T> {
  const result = await api<{ record: T }>("/api/admin/records", {
    kind,
    id,
    patch,
    key: crypto.randomUUID(),
  });
  return result.record;
}

export async function putAdminRecords<T extends StoredRecord>(
  kind: AdminRecordKind,
  entries: Array<{
    id: string;
    patch: Partial<Omit<T, "id" | "createdAt" | "updatedAt" | "updatedBy">>;
  }>,
) {
  const saved: T[] = [];
  for (const entry of entries) {
    saved.push(await putAdminRecord<T>(kind, entry.id, entry.patch));
  }
  return saved;
}
