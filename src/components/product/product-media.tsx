import { cn } from '@/lib/utils';

interface ProductMediaProps {
  /** Deterministic seed (e.g. an image id) that shapes the artwork. */
  seed: string;
  accent: string;
  className?: string;
  /** Larger, more detailed composition for the details gallery. */
  detailed?: boolean;
}

/** Small deterministic string hash so the same seed always renders the same art. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Generates an elegant geometric placeholder instead of using stock imagery.
 * A soft gradient wash plus a few accent shapes, all derived from `seed`.
 */
export function ProductMedia({ seed, accent, className, detailed = false }: ProductMediaProps) {
  const h = hash(seed);
  const rotation = (h % 8) * 15;
  const variant = h % 3;
  const gradientId = `grad-${seed}`;
  const glowId = `glow-${seed}`;

  return (
    <div className={cn('relative overflow-hidden', className)} aria-hidden="true">
      <svg
        viewBox="0 0 400 400"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.16" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.04" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="400" height="400" fill={`url(#${gradientId})`} />
        <circle cx="200" cy="168" r="150" fill={`url(#${glowId})`} />

        <g transform={`rotate(${rotation} 200 200)`}>
          {variant === 0 && (
            <>
              <circle cx="200" cy="200" r="96" fill={accent} fillOpacity="0.9" />
              <circle cx="200" cy="200" r="60" fill="white" fillOpacity="0.14" />
              <circle cx="200" cy="200" r="26" fill="white" fillOpacity="0.22" />
            </>
          )}
          {variant === 1 && (
            <>
              <rect
                x="118"
                y="118"
                width="164"
                height="164"
                rx="40"
                fill={accent}
                fillOpacity="0.9"
              />
              <rect
                x="150"
                y="150"
                width="100"
                height="100"
                rx="26"
                fill="white"
                fillOpacity="0.16"
              />
            </>
          )}
          {variant === 2 && (
            <>
              <path d="M200 96 L296 296 L104 296 Z" fill={accent} fillOpacity="0.9" />
              <circle cx="200" cy="232" r="34" fill="white" fillOpacity="0.18" />
            </>
          )}
        </g>

        {detailed && (
          <g opacity="0.5">
            <circle cx="326" cy="86" r="10" fill={accent} />
            <circle cx="74" cy="320" r="6" fill={accent} />
            <circle cx="96" cy="90" r="4" fill={accent} />
          </g>
        )}
      </svg>
    </div>
  );
}
