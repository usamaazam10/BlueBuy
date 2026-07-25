'use client';

import { LinkIcon } from 'lucide-react';
import { Field, Input, Label, Switch } from '@/components/admin/ui/control';
import { NavigationRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import { DEFAULT_NAV_ITEMS, type NavItem } from '@/types/cms';
import type { NavItemCreateInput, NavItemUpdateInput } from '@/lib/validations';
import { CmsCollectionManager } from './cms-collection-manager';

interface Draft {
  label: string;
  href: string;
  active: boolean;
}

/** Admin manager for the `navigation` collection (primary menu items). */
export function NavigationManager() {
  return (
    <CmsCollectionManager<NavItem, Draft, NavItemCreateInput, NavItemUpdateInput>
      repository={NavigationRepository}
      queryKey={queryKeys.navigation}
      entityName="menu item"
      addLabel="Add menu item"
      emptyIcon={LinkIcon}
      emptyTitle="No menu items yet"
      emptyDescription="Add items to build your primary navigation, or load the defaults."
      emptyDraft={{ label: '', href: '', active: true }}
      seed={DEFAULT_NAV_ITEMS}
      toDraft={(item) => ({ label: item.label, href: item.href, active: item.active })}
      toCreate={(draft, sortOrder) => ({ ...draft, sortOrder })}
      toUpdate={(draft) => draft}
      isValid={(draft) => draft.label.trim().length > 0}
      renderSummary={(item) => (
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">{item.label}</p>
          <p className="text-muted-foreground truncate text-xs">{item.href || '—'}</p>
        </div>
      )}
      renderForm={(draft, set) => (
        <>
          <Field label="Label" htmlFor="nav-label" required>
            <Input
              id="nav-label"
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Products"
            />
          </Field>
          <Field label="Link" htmlFor="nav-href" hint="Internal path or full URL.">
            <Input
              id="nav-href"
              value={draft.href}
              onChange={(e) => set({ href: e.target.value })}
              placeholder="/products"
            />
          </Field>
          <div className="flex items-center justify-between">
            <Label htmlFor="nav-active">Active</Label>
            <Switch
              id="nav-active"
              checked={draft.active}
              onCheckedChange={(active) => set({ active })}
              aria-label="Active"
            />
          </div>
        </>
      )}
    />
  );
}
