// layout-pipeline/src/shortcut-display.ts - Display key remap and modifier label helpers.
import {
  INPUT_LAYOUT_CUSTOM_KEY_PATTERN,
  INPUT_LAYOUT_MAPPINGS,
  type InputLayoutMapping,
  type InputLayoutType,
} from './input-layouts';
import { resolveLayoutKey } from './resolve-layout-key';
import { normalizeModifier } from './modifier-aliases';
import type { SupportedOs } from './types';

const MODIFIER_DISPLAY_ORDER: Record<string, number> = {
  ctrl: 0,
  shift: 1,
  alt: 2,
  meta: 3,
  fn: 4,
  menu: 5,
};

const MODIFIER_DISPLAY_LABELS: Record<SupportedOs, Record<string, string>> = {
  mac: {
    ctrl: 'Control',
    shift: 'Shift',
    alt: 'Option',
    meta: 'Cmd',
    fn: 'Fn',
    menu: 'Menu',
  },
  win: {
    ctrl: 'Ctrl',
    shift: 'Shift',
    alt: 'Alt',
    meta: 'Win',
    fn: 'Fn',
    menu: 'Menu',
  },
  linux: {
    ctrl: 'Ctrl',
    shift: 'Shift',
    alt: 'Alt',
    meta: 'Super',
    fn: 'Fn',
    menu: 'Menu',
  },
};

function toDisplayKey(key: string): string {
  if (/^[a-z]$/i.test(key)) {
    return key.toUpperCase();
  }
  return key;
}

export function getActiveInputMapping(
  inputLayout: InputLayoutType,
  customInputMapping: InputLayoutMapping,
): InputLayoutMapping {
  if (inputLayout === 'custom') {
    return customInputMapping;
  }

  return INPUT_LAYOUT_MAPPINGS[inputLayout];
}

export function remapLayoutKeyByInputLayout(
  layoutKey: string,
  inputMapping: InputLayoutMapping,
): string {
  const normalizedKey = layoutKey.trim().toLowerCase();
  if (!INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test(normalizedKey)) {
    return toDisplayKey(layoutKey);
  }

  const mappedKey = inputMapping[normalizedKey];
  if (!mappedKey) {
    return toDisplayKey(layoutKey);
  }

  return toDisplayKey(mappedKey);
}

export function resolveBindingDisplayKey(
  bindingKey: string,
  os: SupportedOs,
  inputMapping: InputLayoutMapping,
): string | null {
  const layoutKey = resolveLayoutKey(bindingKey, os);
  if (!layoutKey) {
    return null;
  }

  return remapLayoutKeyByInputLayout(layoutKey, inputMapping);
}

export function formatBindingModifierLabels(
  modifiers: string[],
  os: SupportedOs,
): string[] {
  const normalizedModifiers = Array.from(
    new Set(modifiers.map((modifier) => normalizeModifier(modifier, os))),
  );

  normalizedModifiers.sort(
    (left, right) => (MODIFIER_DISPLAY_ORDER[left] ?? 99) - (MODIFIER_DISPLAY_ORDER[right] ?? 99),
  );

  return normalizedModifiers.map(
    (modifier) => MODIFIER_DISPLAY_LABELS[os][modifier] ?? toDisplayKey(modifier),
  );
}
