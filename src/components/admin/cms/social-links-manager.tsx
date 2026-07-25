'use client';

import { Share2 } from 'lucide-react';
import { Field, Input, Select, Label, Switch } from '@/components/admin/ui/control';
import { SocialLinkRepository } from '@/repositories';
import { queryKeys } from '@/hooks/queries/keys';
import {
  DEFAULT_SOCIAL_LINKS,
  SOCIAL_PLATFORMS,
  type SocialLink,
  type SocialPlatform,
} from '@/types/cms';
import type { SocialLinkCreateInput, SocialLinkUpdateInput } from '@/lib/validations';
import { CmsCollectionManager } from './cms-collection-manager';

interface Draft {
  platform: SocialPlatform;
  label: string;
  url: string;
  active: boolean;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Admin manager for the `social_links` collection (footer social icons). */
export function SocialLinksManager() {
  return (
    <CmsCollectionManager<SocialLink, Draft, SocialLinkCreateInput, SocialLinkUpdateInput>
      repository={SocialLinkRepository}
      queryKey={queryKeys.socialLinks}
      entityName="social link"
      addLabel="Add social link"
      emptyIcon={Share2}
      emptyTitle="No social links yet"
      emptyDescription="Add links to your social profiles, or load the defaults."
      emptyDraft={{ platform: 'twitter', label: '', url: '', active: true }}
      seed={DEFAULT_SOCIAL_LINKS}
      toDraft={(item) => ({
        platform: item.platform,
        label: item.label,
        url: item.url,
        active: item.active,
      })}
      toCreate={(draft, sortOrder) => ({ ...draft, sortOrder })}
      toUpdate={(draft) => draft}
      isValid={(draft) => draft.url.trim().length > 0}
      renderSummary={(item) => (
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">
            {item.label || titleCase(item.platform)}
          </p>
          <p className="text-muted-foreground truncate text-xs">{item.url}</p>
        </div>
      )}
      renderForm={(draft, set) => (
        <>
          <Field label="Platform" htmlFor="social-platform">
            <Select
              id="social-platform"
              value={draft.platform}
              onChange={(e) => set({ platform: e.target.value as SocialPlatform })}
            >
              {SOCIAL_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {titleCase(platform)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Label"
            htmlFor="social-label"
            hint="Accessible label; defaults to the platform."
          >
            <Input
              id="social-label"
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder={titleCase(draft.platform)}
            />
          </Field>
          <Field label="URL" htmlFor="social-url" required>
            <Input
              id="social-url"
              value={draft.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://…"
            />
          </Field>
          <div className="flex items-center justify-between">
            <Label htmlFor="social-active">Active</Label>
            <Switch
              id="social-active"
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
