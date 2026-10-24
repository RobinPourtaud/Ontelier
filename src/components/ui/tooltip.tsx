import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return <TooltipPrimitive.Root><TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger><TooltipPrimitive.Portal><TooltipPrimitive.Content className="tooltip" sideOffset={7}>{text}<TooltipPrimitive.Arrow/></TooltipPrimitive.Content></TooltipPrimitive.Portal></TooltipPrimitive.Root>;
}
export const TooltipProvider = TooltipPrimitive.Provider;
