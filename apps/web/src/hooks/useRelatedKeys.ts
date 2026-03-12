// useRelatedKeys.ts - Computes hover-based shortcut relation indicators for keyboard keys.
// Determines visualization shapes (dots, triangles, squares) based on shortcut size and deduplicates commands.
import { useMemo } from 'react';
import type { ParseResult } from '@keymap-highlight/file-parsers';
import {
  computeRelatedKeys,
  type RelatedKeysMap,
  type SupportedOs,
} from '@keymap-highlight/layout-pipeline';

export {
  RELATED_SHORTCUT_COLORS,
  type RelatedIndicatorShape,
  type RelatedKeyIndicator,
  type RelatedKeysMap,
} from '@keymap-highlight/layout-pipeline';

type ParsedBinding = ParseResult['bindings'][number];

interface UseRelatedKeysParams {
  hoveredKey: string | null;
  hoveredBindingSignature?: string | null;
  bindings: ParsedBinding[];
  activeContext: string;
  activeModifiers: string[];
  os: SupportedOs;
}


export function useRelatedKeys({
  hoveredKey,
  hoveredBindingSignature,
  bindings,
  activeContext,
  activeModifiers,
  os,
}: UseRelatedKeysParams): RelatedKeysMap {
  const relatedKeys = useMemo(
    () =>
      computeRelatedKeys({
        hoveredKey,
        hoveredBindingSignature,
        bindings,
        activeContext,
        activeModifiers,
        os,
      }),
    [activeContext, activeModifiers, bindings, hoveredBindingSignature, hoveredKey, os],
  );

  return relatedKeys;
}
