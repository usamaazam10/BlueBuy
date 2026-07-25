'use client';

import { Megaphone } from 'lucide-react';
import { Field, Input, Textarea, Label, Switch } from '@/components/admin/ui/control';
import { BannerRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import type { Banner } from '@/types/cms';
import type { BannerCreateInput, BannerUpdateInput } from '@/lib/validations';
import { CmsCollectionManager } from './cms-collection-manager';
import { ColorField } from './color-field';

interface Draft {
  message: string;
  linkLabel: string;
  linkHref: string;
  background: string;
  active: boolean;
}

/**
 * Admin manager for the `banners` collection. The active banner (top by order)
 * renders in the storefront's dismissible announcement bar; with none active,
 * the storefront shows no bar at all.
 */
export function BannersManager() {
  return (
    <CmsCollectionManager<Banner, Draft, BannerCreateInput, BannerUpdateInput>
      repository={BannerRepository}
      queryKey={queryKeys.banners}
      entityName="banner"
      addLabel="Add banner"
      emptyIcon={Megaphone}
      emptyTitle="No banners yet"
      emptyDescription="Add an announcement banner to display a message at the top of the storefront."
      emptyDraft={{ message: '', linkLabel: '', linkHref: '', background: '', active: true }}
      toDraft={(item) => ({
        message: item.message,
        linkLabel: item.linkLabel,
        linkHref: item.linkHref,
        background: item.background,
        active: item.active,
      })}
      toCreate={(draft, sortOrder) => ({ ...draft, placement: 'announcement', sortOrder })}
      toUpdate={(draft) => draft}
      isValid={(draft) => draft.message.trim().length > 0}
      renderSummary={(item) => (
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: item.background || 'var(--brand)' }}
          />
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">{item.message}</p>
            {item.linkLabel && (
              <p className="text-muted-foreground truncate text-xs">
                {item.linkLabel} → {item.linkHref || '—'}
              </p>
            )}
          </div>
        </div>
      )}
      renderForm={(draft, set) => (
        <>
          <Field label="Message" htmlFor="banner-message" required>
            <Textarea
              id="banner-message"
              value={draft.message}
              onChange={(e) => set({ message: e.target.value })}
              placeholder="Free shipping on orders over $50 — this week only."
              className="min-h-16"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Link label" htmlFor="banner-link-label" hint="Optional inline link.">
              <Input
                id="banner-link-label"
                value={draft.linkLabel}
                onChange={(e) => set({ linkLabel: e.target.value })}
                placeholder="Shop now"
              />
            </Field>
            <Field label="Link URL" htmlFor="banner-link-href">
              <Input
                id="banner-link-href"
                value={draft.linkHref}
                onChange={(e) => set({ linkHref: e.target.value })}
                placeholder="/products"
              />
            </Field>
          </div>
          <ColorField
            label="Background colour"
            value={draft.background}
            onChange={(background) => set({ background })}
          />
          <div className="flex items-center justify-between">
            <Label htmlFor="banner-active">Active</Label>
            <Switch
              id="banner-active"
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
