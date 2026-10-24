import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
export function Dialog({ open, onOpenChange, title, description, children, className = '' }: { open: boolean; onOpenChange(open: boolean): void; title: string; description: string; children: ReactNode; className?: string }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay"/><DialogPrimitive.Content className={'dialog-content ' + className}>
    <header><div><DialogPrimitive.Title>{title}</DialogPrimitive.Title><DialogPrimitive.Description>{description}</DialogPrimitive.Description></div><DialogPrimitive.Close asChild><Button variant="ghost" size="icon" aria-label="Close dialog"><X size={17}/></Button></DialogPrimitive.Close></header>{children}
  </DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
