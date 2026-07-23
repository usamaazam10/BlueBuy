'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  /** Heading level for correct document outline. */
  as?: 'h1' | 'h2' | 'h3';
}

/**
 * Consistent section heading with an optional eyebrow and description.
 * Reveals gently on scroll into view.
 */
export function SectionTitle({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
  as: Heading = 'h2',
}: SectionTitleProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex max-w-2xl flex-col gap-3',
        align === 'center' && 'mx-auto items-center text-center',
        className
      )}
    >
      {eyebrow && (
        <span className="text-brand text-sm font-semibold tracking-wide uppercase">{eyebrow}</span>
      )}
      <Heading className="text-3xl font-semibold text-balance sm:text-4xl">{title}</Heading>
      {description && (
        <p className="text-muted-foreground text-base text-pretty sm:text-lg">{description}</p>
      )}
    </motion.div>
  );
}
