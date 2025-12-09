import { getDb } from "./mongodb"

export type AuditEvent = {
  actorRut?: string | null
  action: "create" | "update" | "delete" | "change_status"
  entity: string
  entityId?: string | null
  details?: Record<string, any>
}

export async function logAudit(event: AuditEvent) {
  try {
    const db = await getDb()
    await db.collection("audit_logs").insertOne({
      actorRut: event.actorRut ?? null,
      action: event.action,
      entity: event.entity,
      entityId: event.entityId ?? null,
      details: event.details ?? {},
      createdAt: new Date().toISOString(),
    })
  } catch {
    // silent fail to avoid breaking the main flow
  }
}
