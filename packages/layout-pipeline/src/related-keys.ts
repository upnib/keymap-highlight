// layout-pipeline/src/related-keys.ts - Computes related shortcut indicator groups for hovered keys.
import type { SupportedOs } from './types';
import {
  MODIFIER_ALIASES,
  contextMatches,
  modifiersIncludeSubset,
  normalizeBindingModifiers,
  normalizeModifier,
} from './modifier-aliases';
import { createBindingSignature } from './binding-display';
import { resolveLayoutKey } from './resolve-layout-key';

export type RelatedIndicatorShape = 'dot' | 'triangle' | 'square' | 'pentagon';

export interface RelatedKeyIndicator {
  color: string;
  shape: RelatedIndicatorShape;
  shortcutCommand: string;
  sourceEditor: string;
}

export type RelatedKeysMap = Map<string, RelatedKeyIndicator[]>;

export type PipelineBinding = {
  key: string;
  command: string;
  when: string;
  modifiers: string[];
  chords: Array<{ key: string; modifiers: string[] }>;
  sourceEditor: string;
};

export interface ComputeRelatedKeysParams {
  hoveredKey: string | null;
  hoveredBindingSignature?: string | null;
  bindings: PipelineBinding[];
  activeContext: string;
  activeModifiers: string[];
  os: SupportedOs;
}

interface ShortcutGroup {
  keyCodes: string[];
  keyCodeSet: Set<string>;
  shape: RelatedIndicatorShape;
  shortcutCommand: string;
  sourceEditor: string;
}

export const RELATED_SHORTCUT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F1948A', '#82E0AA', '#F8C471', '#73C6B6', '#E59866',
  '#AEB6BF', '#D2B4DE', '#F5B041', '#5DADE2', '#48C9B0',
  '#F08080', '#58D68D', '#F4D03F', '#5D6D7E', '#AF7AC5',
  '#EC7063', '#52BE80', '#EB984E', '#3498DB', '#A569BD',
] as const;

const SPECIAL_KEY_ALIASES: Record<string, string> = {
  escape: 'esc',
  esc: 'esc',
  enter: 'enter',
  return: 'enter',
  backspace: 'backspace',
  del: 'del',
  delete: 'del',
  ins: 'ins',
  insert: 'ins',
  pgup: 'pgup',
  pageup: 'pgup',
  pgdn: 'pgdn',
  pagedown: 'pgdn',
  arrowup: 'up',
  up: 'up',
  arrowdown: 'down',
  down: 'down',
  arrowleft: 'left',
  left: 'left',
  arrowright: 'right',
  right: 'right',
  space: 'space',
  capslock: 'caps',
  caps: 'caps',
};

const MODIFIER_LAYOUT_CODES: Record<string, string[]> = {
  ctrl: ['Ctrl', 'Control', 'ControlLeft', 'ControlRight', 'LeftCtrl', 'RightCtrl'],
  shift: ['Shift', 'ShiftLeft', 'ShiftRight', 'LeftShift', 'RightShift'],
  alt: ['Alt', 'Option', 'AltLeft', 'AltRight', 'OptionLeft', 'OptionRight'],
  meta: ['Win', 'Cmd', 'Meta', 'Super', 'Gui', 'Command', 'MetaLeft', 'MetaRight'],
  fn: ['Fn'],
  menu: ['Menu'],
};

const LAYOUT_KEY_VARIANTS: Record<string, string[]> = {
  Esc: ['Esc', 'Escape'],
  Enter: ['Enter', 'Return'],
  Del: ['Del', 'Delete'],
  Ins: ['Ins', 'Insert'],
  PgUp: ['PgUp', 'PageUp'],
  PgDn: ['PgDn', 'PageDown'],
  Up: ['Up', 'ArrowUp'],
  Down: ['Down', 'ArrowDown'],
  Left: ['Left', 'ArrowLeft'],
  Right: ['Right', 'ArrowRight'],
  Caps: ['Caps', 'CapsLock'],
  Space: ['Space'],
};

function normalizeActiveModifiers(modifiers: string[], os: SupportedOs): string[] {
  return Array.from(new Set(modifiers.map((modifier) => normalizeModifier(modifier, os)))).sort();
}

function toComparableKeyCode(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) {
    return '';
  }

  const lower = trimmed.toLowerCase();
  const normalizedModifier = MODIFIER_ALIASES[lower];
  if (normalizedModifier) {
    return normalizedModifier;
  }

  const normalizedSpecial = SPECIAL_KEY_ALIASES[lower];
  if (normalizedSpecial) {
    return normalizedSpecial;
  }

  return lower;
}

function resolveIndicatorShape(keyCount: number): RelatedIndicatorShape | null {
  if (keyCount <= 2) return 'dot';
  if (keyCount === 3) return 'triangle';
  if (keyCount === 4) return 'square';
  return null;
}

function addKeyVariants(target: Set<string>, keyCode: string): void {
  const variants = LAYOUT_KEY_VARIANTS[keyCode] ?? [keyCode];
  for (const variant of variants) {
    target.add(variant);
  }
}

function buildShortcutGroup(baseKeyCode: string, bindingModifiers: string[], shortcutCommand: string, keyCount: number, sourceEditor: string): ShortcutGroup | null {
  const shape = resolveIndicatorShape(keyCount);
  if (shape === null) return null;

  const keyCodes = new Set<string>();
  addKeyVariants(keyCodes, baseKeyCode);

  for (const modifier of bindingModifiers) {
    const modifierCodes = MODIFIER_LAYOUT_CODES[modifier] ?? [];
    for (const modifierCode of modifierCodes) {
      keyCodes.add(modifierCode);
    }
  }

  const keyCodeSet = new Set<string>();
  for (const code of keyCodes) {
    keyCodeSet.add(toComparableKeyCode(code));
  }

  return {
    keyCodes: Array.from(keyCodes),
    keyCodeSet,
    shape,
    shortcutCommand,
    sourceEditor,
  };
}

function applyShortcutGroupToResult(result: RelatedKeysMap, group: ShortcutGroup, color: string): void {
  for (const keyCode of group.keyCodes) {
    const keyIndicators = result.get(keyCode) ?? [];
    keyIndicators.push({
      color,
      shape: group.shape,
      shortcutCommand: group.shortcutCommand,
      sourceEditor: group.sourceEditor,
    });
    result.set(keyCode, keyIndicators);
  }
}

export function computeRelatedKeys({
  hoveredKey,
  hoveredBindingSignature,
  bindings,
  activeContext,
  activeModifiers,
  os,
}: ComputeRelatedKeysParams): RelatedKeysMap {
  const normalizedActiveModifiers = normalizeActiveModifiers(activeModifiers, os);
  const result: RelatedKeysMap = new Map();

  if (hoveredBindingSignature) {
    const hoveredBinding = bindings.find((binding) => createBindingSignature(binding) === hoveredBindingSignature);
    if (!hoveredBinding || !contextMatches(hoveredBinding.when, activeContext)) {
      return result;
    }

    const baseKeyCode = resolveLayoutKey(hoveredBinding.key, os);
    if (!baseKeyCode) {
      return result;
    }

    const bindingModifiers = normalizeBindingModifiers(hoveredBinding.modifiers, os);
    if (bindingModifiers.length === 0) {
      return result;
    }

    const keyCount = 1 + bindingModifiers.length;
    const group = buildShortcutGroup(baseKeyCode, bindingModifiers, hoveredBinding.command, keyCount, hoveredBinding.sourceEditor);
    if (!group) {
      return result;
    }

    applyShortcutGroupToResult(result, group, RELATED_SHORTCUT_COLORS[0]);
    return result;
  }

  const shortcutGroups: ShortcutGroup[] = [];
  const seenCombos = new Set<string>();

  for (const binding of bindings) {
    if (!contextMatches(binding.when, activeContext)) {
      continue;
    }

    const baseKeyCode = resolveLayoutKey(binding.key, os);
    if (!baseKeyCode) {
      continue;
    }

    const bindingModifiers = normalizeBindingModifiers(binding.modifiers, os);
    if (!modifiersIncludeSubset(bindingModifiers, normalizedActiveModifiers)) {
      continue;
    }

    if (bindingModifiers.length === 0) {
      continue;
    }

    const comboKey = `${baseKeyCode}-${bindingModifiers.join('-')}`;
    if (seenCombos.has(comboKey)) continue;
    seenCombos.add(comboKey);

    const keyCount = 1 + bindingModifiers.length;
    const group = buildShortcutGroup(baseKeyCode, bindingModifiers, binding.command, keyCount, binding.sourceEditor);
    if (group !== null) {
      shortcutGroups.push(group);
    }
  }

  if (!hoveredKey) {
    return result;
  }

  const hoveredComparableCode = toComparableKeyCode(hoveredKey);
  if (!hoveredComparableCode) {
    return result;
  }

  let groupIndex = 0;
  for (const group of shortcutGroups) {
    if (!group.keyCodeSet.has(hoveredComparableCode)) {
      continue;
    }

    const color = RELATED_SHORTCUT_COLORS[groupIndex % RELATED_SHORTCUT_COLORS.length];
    applyShortcutGroupToResult(result, group, color);

    groupIndex += 1;
  }

  return result;
}
