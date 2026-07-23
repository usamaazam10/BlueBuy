import * as React from 'react';
import { cn } from '@/lib/utils';

type ContainerProps<T extends React.ElementType> = {
  as?: T;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

/**
 * Centered max-width wrapper with responsive horizontal padding.
 * Polymorphic via `as` so it can render <section>, <main>, etc.
 */
export function Container<T extends React.ElementType = 'div'>({
  as,
  className,
  children,
  ...props
}: ContainerProps<T>) {
  const Component = as ?? 'div';
  return (
    <Component className={cn('container-px mx-auto w-full max-w-7xl', className)} {...props}>
      {children}
    </Component>
  );
}
