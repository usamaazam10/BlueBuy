'use client';

import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in seconds before the reveal starts. */
  delay?: number;
  y?: number;
}

/** Fade + rise into view once, respecting reduced-motion preferences. */
export function Reveal({ children, className, delay = 0, y = 20 }: RevealProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/**
 * Parent that staggers its <StaggerItem> children.
 * - `trigger="inView"` (default): reveals when scrolled into view — nice for
 *   marketing sections.
 * - `trigger="mount"`: reveals immediately on mount — use for primary content
 *   (e.g. a product listing) so it is never hidden behind a scroll.
 */
export function Stagger({
  children,
  className,
  trigger = 'inView',
}: {
  children: React.ReactNode;
  className?: string;
  trigger?: 'inView' | 'mount';
}) {
  const reduceMotion = useReducedMotion();
  const inViewProps =
    trigger === 'inView'
      ? { whileInView: 'show' as const, viewport: { once: true, margin: '-60px' } }
      : { animate: 'show' as const };

  return (
    <motion.div
      className={className}
      variants={reduceMotion ? undefined : containerVariants}
      initial={reduceMotion ? false : 'hidden'}
      {...inViewProps}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div className={className} variants={reduceMotion ? undefined : itemVariants}>
      {children}
    </motion.div>
  );
}
