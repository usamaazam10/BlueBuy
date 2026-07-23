'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

/** Toggles between light and dark themes (class strategy via next-themes). */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      className={cn(
        'text-foreground hover:bg-secondary focus-visible:ring-ring relative flex size-10 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2',
        className
      )}
    >
      {/* Render both and cross-fade with CSS to avoid hydration mismatch flicker. */}
      <Sun
        className={cn(
          'size-[18px] transition-all duration-300',
          mounted && isDark ? 'scale-0 -rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
        )}
      />
      <Moon
        className={cn(
          'absolute size-[18px] transition-all duration-300',
          mounted && isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 rotate-90 opacity-0'
        )}
      />
    </button>
  );
}
