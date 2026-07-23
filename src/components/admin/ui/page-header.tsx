import { Breadcrumb, type Crumb } from './breadcrumb';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  /** Right-aligned actions (buttons, filters). */
  actions?: React.ReactNode;
}

/** Consistent page heading block: breadcrumb, title, description and actions. */
export function PageHeader({ title, description, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-1" />}
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
