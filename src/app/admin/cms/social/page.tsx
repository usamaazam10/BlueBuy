import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { SocialLinksManager } from '@/components/admin/cms/social-links-manager';

export const metadata: Metadata = { title: 'Social links' };

export default function SocialCmsPage() {
  return (
    <div>
      <PageHeader
        title="Social links"
        description="The social profile icons shown in the footer."
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Content' },
          { label: 'Social links' },
        ]}
      />
      <SocialLinksManager />
    </div>
  );
}
