// useKeymapMapper.ts — Maps parsed keybindings to physical keyboard layout keys.
// Resolves binding key names (e.g. "escape", "pageup") to layout codes (e.g. "Esc", "PgUp")
// and filters by active context and modifier combination.
// Handles JetBrains named key tokens (e.g. "period", "openbracket"), Vim bracket-notation keys,
// Zed hyphen-separated keys, and OS-equivalent modifier aliases (cmd/meta, option/alt).
// isConflict uses the same getConflictIdentity signature as the store for a consistent match.
import { useMemo } from 'react';
import type { ParseResult } from '@keymap-highlight/file-parsers';
import {
  contextMatches,
  getConflictIdentity,
  modifiersMatch,
  resolveLayoutKey,
} from '@keymap-highlight/layout-pipeline';
import { useKeymapStore } from '../store/useKeymapStore';

type ParsedBinding = ParseResult['bindings'][number];

export interface MappedKeyInfo {
  command: string;
  rawCommand: string;
  isConflict: boolean;
  bindings: ParsedBinding[];
  source: ParsedBinding['sourceEditor'];
}

export type MappedKeysMap = Map<string, MappedKeyInfo>;

export { resolveLayoutKey } from '@keymap-highlight/layout-pipeline';

export function useKeymapMapper(activeModifiers?: Set<string>): { mappedKeys: MappedKeysMap } {
  const bindings = useKeymapStore((state) => state.bindings);
  const conflicts = useKeymapStore((state) => state.conflicts);
  const activeContext = useKeymapStore((state) => state.activeContext);
  const hoveredContext = useKeymapStore((state) => state.hoveredContext);
  const storeActiveModifiers = useKeymapStore((state) => state.activeModifiers);
  const os = useKeymapStore((state) => state.os);
  const contextForPreview = hoveredContext ?? activeContext;

  const activeModifierList = useMemo(
    () =>
      Array.from(new Set(activeModifiers ? Array.from(activeModifiers) : storeActiveModifiers))
        .sort(),
    [activeModifiers, storeActiveModifiers]
  );

  const conflictSet = useMemo(() => {
    const set = new Set<string>();
    for (const conflictBinding of conflicts) {
      set.add(getConflictIdentity(conflictBinding));
    }
    return set;
  }, [conflicts]);

  const mappedKeys = useMemo(() => {
    const result: MappedKeysMap = new Map();

    for (const binding of bindings) {
      if (!contextMatches(binding.when, contextForPreview)) {
        continue;
      }

      const code = resolveLayoutKey(binding.key, os);
      if (!code) {
        continue;
      }

      const bindingModifiers = Array.from(new Set(binding.modifiers)).sort();
      if (!modifiersMatch(bindingModifiers, activeModifierList)) {
        continue;
      }

      const conflictId = getConflictIdentity(binding);
      const isConflict = conflictSet.has(conflictId);

      const existing = result.get(code);
      if (existing) {
        existing.bindings.push(binding);
        if (!existing.isConflict && isConflict) {
          existing.isConflict = true;
        }
        continue;
      }

      result.set(code, {
        command: binding.command,
        rawCommand: binding.command,
        isConflict,
        bindings: [binding],
        source: binding.sourceEditor,
      });
    }

    return result;
  }, [activeModifierList, bindings, conflictSet, contextForPreview, os]);

  return { mappedKeys };
}
