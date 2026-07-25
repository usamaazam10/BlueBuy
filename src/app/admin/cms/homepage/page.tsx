import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { HomepageEditor } from '@/components/admin/cms/homepage-editor';

export const metadata: Metadata = { title: 'Homepage' };

export default function HomepageCmsPage() {
  return (
    <div>
      <PageHeader
        title="Homepage"
        description="Edit the hero, featured content, promotional banner, newsletter and SEO."
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Content' },
          { label: 'Homepage' },
        ]}
      />
      <HomepageEditor />
    </div>
  );
}
