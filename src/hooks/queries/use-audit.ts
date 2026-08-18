'use client';

/**
 * Audit log hooks. Read-only by design — the log is append-only and written as
 * a side effect of the operations it records, never directly from the UI.
 */
import { useQuery } from '@tanstack/react-query';
import { auditService } from '@/services/audit.service';
import type { AuditEntity, AuditLog } from '@/types/business';
import type { DateRange } from '@/lib/business/date-range';
import { queryKeys, rangeToken } from './keys';

/** Audit entries in a period, newest first. */
export function useAuditLogQuery(range?: DateRange | null) {
  return useQuery<AuditLog[]>({
    queryKey: queryKeys.auditLogs(rangeToken(range)),
    queryFn: () => auditService.list(range),
  });
}

/** The change history for a single record. */
export function useEntityAuditQuery(entity: AuditEntity, entityId: string | undefined) {
  return useQuery<AuditLog[]>({
    queryKey: queryKeys.auditLogsFor(entity, entityId ?? ''),
    queryFn: () => auditService.listForEntity(entity, entityId as string),
    enabled: Boolean(entityId),
  });
}
