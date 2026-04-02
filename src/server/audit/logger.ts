export type AuditEvent = {
  action: string;
  target: string;
};

export async function logDangerousAction(event: AuditEvent) {
  if (process.env.NODE_ENV !== "test") {
    console.info("[audit]", event.action, event.target);
  }
}
