import type { Metadata } from 'next';
import { PageHeader } from '@/components/admin/ui/page-header';
import { ContactEditor } from '@/components/admin/cms/contact-editor';

export const metadata: Metadata = { title: 'Contact information' };

export default function ContactCmsPage() {
  return (
    <div>
      <PageHeader
        title="Contact information"
        description="Details shown on the contact page and in the footer."
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Content' },
          { label: 'Contact' },
        ]}
      />
      <ContactEditor />
    </div>
  );
}
