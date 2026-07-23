import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <Container className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden py-20 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-50" />
      <div
        aria-hidden
        className="bg-brand/20 pointer-events-none absolute top-1/4 left-1/2 size-72 -translate-x-1/2 rounded-full blur-[110px]"
      />

      <div className="relative flex flex-col items-center">
        <span className="from-brand to-foreground/40 bg-gradient-to-b bg-clip-text text-7xl font-bold tracking-tight text-transparent sm:text-9xl">
          404
        </span>
        <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">This page went missing</h1>
        <p className="text-muted-foreground mt-3 max-w-md text-pretty">
          The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg">
            <Link href="/">
              <Home className="size-4" /> Back home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/products">
              <ArrowLeft className="size-4" /> Browse products
            </Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
