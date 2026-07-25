import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { FooterEditor } from '@/components/admin/cms/footer-editor';

export const metadata: Metadata = { title: 'Footer' };

export default function FooterCmsPage() {
  return (
    <div>
      <PageHeader
        title="Footer"
        description="Edit the footer tagline, link columns and copyright."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Content' }, { label: 'Footer' }]}
      />
      <FooterEditor />
    </div>
  );
}
