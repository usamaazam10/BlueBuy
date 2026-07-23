'use client';

import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` styles the confirm action in red for deletes. */
  tone?: 'default' | 'destructive';
}

/** A focused confirmation dialog for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'destructive',
}: ConfirmDialogProps) {
  const destructive = tone === 'destructive';
  return (
    <Modal open={open} onClose={onClose} title={title} hideCloseButton className="max-w-md">
      <div className="p-6">
        <div className="flex gap-4">
          {destructive && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="size-5" />
            </span>
          )}
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground text-base font-semibold">{title}</h2>
            {description && (
              <p className="text-muted-foreground text-sm text-pretty">{description}</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            className={cn(
              'rounded-lg',
              destructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
