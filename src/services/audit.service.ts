/**
 * AuditService — records who did what, to which record, and when.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Best-effort by design.
 *
 * Audit writes are fired *after* the business operation they describe, and a
 * failure is swallowed with a console warning. That is a deliberate trade-off:
 * if logging were part of the operation's transaction, a transient failure to
 * write a log entry would roll back a genuine stock receipt or expense — losing
 * real business data to protect a record *about* that data.
 *
 * The operations that must never be lost (stock receipts, adjustments) write
 * their own immutable ledger entries inside their transactions, so the trail
 * survives even if an audit row is missed.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { AuditLogRepository } from '@/repositories';
import type { ActorRef, AuditAction, AuditEntity } from '@/types/business';

/** Fields never worth logging — noisy, huge, or server-managed. */
const IGNORED_FIELDS = new Set(['updatedAt', 'createdAt', 'gallery', 'description']);

/**
 * Reduce two versions of a record to just what changed.
 *
 * Whole documents are deliberately not stored: a product edit that touched one
 * price would otherwise persist the entire document twice on every save. Values
 * are also truncated, so a long text field can't bloat the log.
 */
export function diffForAudit(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): { before: Record<string, unknown> | null; after: Record<string, unknown> | null } {
  if (!before || !after) {
    return {
      before: before ? truncateValues(before) : null,
      after: after ? truncateValues(after) : null,
    };
  }

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const from = before[key];
    const to = after[key];
    // Structural comparison catches nested objects/arrays without a deep-equal
    // dependency; both sides are plain data straight out of Firestore.
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changedBefore[key] = from;
    changedAfter[key] = to;
  }

  if (Object.keys(changedAfter).length === 0) return { before: null, after: null };
  return { before: truncateValues(changedBefore), after: truncateValues(changedAfter) };
}

/** Cap string values so one long field can't bloat an audit entry. */
function truncateValues(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string' && value.length > 300) {
      out[key] = `${value.slice(0, 300)}…`;
    } else if (value === undefined) {
      // Firestore rejects undefined; record the absence explicitly.
      out[key] = null;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export interface RecordAuditArgs {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  summary: string;
  actor: ActorRef;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export const auditService = {
  /**
   * Write an audit entry. Never throws — a logging failure must not surface as
   * a failure of the operation the user performed.
   */
  async record(args: RecordAuditArgs): Promise<void> {
    try {
      const { before, after } = diffForAudit(args.before, args.after);
      await AuditLogRepository.create({
        action: args.action,
        entity: args.entity,
        entityId: args.entityId,
        entityLabel: args.entityLabel,
        summary: args.summary,
        before,
        after,
        actor: args.actor,
        occurredAt: null,
      });
    } catch (error) {
      // Surfaced in the console for diagnosis, invisible to the user.
      console.warn('[audit] failed to record entry', args.action, error);
    }
  },

  /** Entries for the audit log page. */
  async list(...args: Parameters<typeof AuditLogRepository.list>) {
    return AuditLogRepository.list(...args);
  },

  /** History for a single record. */
  async listForEntity(entity: AuditEntity, entityId: string, max?: number) {
    return AuditLogRepository.listForEntity(entity, entityId, max);
  },
};

export type AuditService = typeof auditService;
