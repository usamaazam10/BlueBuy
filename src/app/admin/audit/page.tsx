'use client';

/**
 * Audit log — who changed what, and when.
 *
 * Read-only and gated on `audit.view`, so only an owner or admin can open it.
 * The log itself is append-only: entries are written as a side effect of the
 * operations they describe and there is no path in the app that edits or
 * deletes one.
 */
import * as React from 'react';
import { ScrollText } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BreakdownTable } from '@/components/admin/business/breakdown-table';
import { DateRangePicker, useDateRange } from '@/components/admin/business/date-range-picker';
import { ExportButton } from '@/components/admin/business/export-button';
import { useAuditLogQuery } from '@/hooks/queries';
import { formatDateTime } from '@/lib/business';

export default function AuditLogPage() {
  return (
    <ProtectedRoute requiredPermission="audit.view">
      <AuditLogView />
    </ProtectedRoute>
  );
}

function AuditLogView() {
  const dates = useDateRange('last_30_days');
  const logQuery = useAuditLogQuery(dates.range);
  const entries = React.useMemo(() => logQuery.data ?? [], [logQuery.data]);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every sensitive business operation, with who performed it."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="audit-log"
              range={dates.range}
              getRows={() => entries}
              columns={[
                { header: 'When', value: (row) => formatDateTime(row.occurredAt) },
                { header: 'Action', value: (row) => row.action },
                { header: 'Entity', value: (row) => row.entity },
                { header: 'Entity id', value: (row) => row.entityId },
                { header: 'Entity', value: (row) => row.entityLabel },
                { header: 'Summary', value: (row) => row.summary },
                { header: 'User', value: (row) => row.actor.label },
              ]}
            />
          </div>
        }
      />

      <div className="border-border bg-card rounded-xl border">
        <BreakdownTable
          rows={entries}
          rowKey={(row) => row.id}
          initialRows={25}
          empty={
            <EmptyState
              icon={ScrollText}
              title="No activity in this period"
              description="Receiving stock, adjusting inventory, recording expenses and changing order status all appear here."
            />
          }
          columns={[
            {
              key: 'when',
              header: 'When',
              cell: (row) => (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDateTime(row.occurredAt)}
                </span>
              ),
            },
            {
              key: 'summary',
              header: 'What happened',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="text-pretty">{row.summary}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.action} · {row.entityLabel}
                  </p>
                </div>
              ),
            },
            {
              key: 'who',
              header: 'By',
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-muted-foreground text-xs">{row.actor.label}</span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
