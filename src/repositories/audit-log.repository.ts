/**
 * AuditLogRepository — the append-only record of sensitive business operations.
 *
 * Read access is admin-only (enforced in `firestore.rules`); there is no update
 * or delete method at all, because an audit trail that can be rewritten is not
 * an audit trail.
 *
 * Writes are **best-effort by design**: see `audit.service.ts`. A failure to log
 * must never roll back the business operation the user actually asked for, so
 * callers record the action and then log, rather than the other way round.
 */
import {
  addDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { withAppError } from '@/firebase';
import { COLLECTIONS } from '@/types/models';
import type { AuditLog } from '@/types/business';
import { auditLogCreateSchema, type AuditLogCreateInput } from '@/lib/validations';
import type { DateRange } from '@/lib/business/date-range';
import {
  collectionRef,
  fromSnapshot,
  pruneUndefined,
  queryIn,
  rangeConstraints,
  DEFAULT_QUERY_LIMIT,
} from './shared';

const NAME = COLLECTIONS.auditLogs;

export const AuditLogRepository = {
  /** Entries in a period, newest first. */
  async list(range?: DateRange | null, max = DEFAULT_QUERY_LIMIT): Promise<AuditLog[]> {
    return withAppError(async () => {
      const snap = await getDocs(queryIn(NAME, rangeConstraints('occurredAt', range, max)));
      return snap.docs.map((d) => fromSnapshot<AuditLog>(d));
    }, 'list audit log');
  },

  /** Every entry for one entity — the "history" panel on a record. */
  async listForEntity(entity: string, entityId: string, max = 100): Promise<AuditLog[]> {
    return withAppError(async () => {
      const constraints: QueryConstraint[] = [
        where('entity', '==', entity),
        where('entityId', '==', entityId),
        ...rangeConstraints('occurredAt', null, max),
      ];
      const snap = await getDocs(query(collectionRef(NAME), ...constraints));
      return snap.docs.map((d) => fromSnapshot<AuditLog>(d));
    }, 'list audit log');
  },

  /** Append an entry. */
  async create(input: AuditLogCreateInput): Promise<void> {
    const data = auditLogCreateSchema.parse(input);
    return withAppError(async () => {
      await addDoc(collectionRef(NAME), {
        ...pruneUndefined(data),
        occurredAt: data.occurredAt ?? serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }, 'write audit log');
  },
};

export type AuditLogRepositoryType = typeof AuditLogRepository;
