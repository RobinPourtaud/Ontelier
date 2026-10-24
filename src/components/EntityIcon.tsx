import { Box, Circle, ArrowUpRight, TextCursorInput, StickyNote, Braces } from 'lucide-react';
import type { EntityKind } from '../core/types';
export function EntityIcon({ kind, size = 14 }: { kind: EntityKind | 'expression'; size?: number }) {
  const Icon = { class: Box, individual: Circle, object: ArrowUpRight, data: TextCursorInput, annotation: StickyNote, expression: Braces }[kind];
  return <span className={'entity-icon kind-' + kind}><Icon size={size}/></span>;
}
