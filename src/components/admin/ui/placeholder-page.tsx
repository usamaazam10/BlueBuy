import type { LucideIcon } from 'lucide-react';
import { PageHeader } from './page-header';
import { EmptyState } from './empty-state';
import type { Crumb } from './breadcrumb';

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  breadcrumb: Crumb[];
  /** What this section will eventually do. */
  comingSoon: string;
}

/** Shared scaffold for not-yet-built admin sections (Orders, Customers, …). */
export function PlaceholderPage({
  title,
  description,
  icon,
  breadcrumb,
  comingSoon,
}: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} breadcrumb={breadcrumb} />
      <div className="border-border bg-card rounded-xl border">
        <EmptyState icon={icon} title={`${title} is coming soon`} description={comingSoon} />
      </div>
    </div>
  );
}
