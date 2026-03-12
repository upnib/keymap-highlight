// layout-pipeline/src/resolve-layout-key.ts - Resolves parsed binding keys to hardware layout key codes.
import keyCodeMap from './data/names/key-code-map.json';
import { normalizeBindingKeyToken } from './binding-normalization';
import { normalizeModifier, type NormalizedModifier } from './modifier-aliases';
import type { SupportedOs } from './types';

const KEY_CODE_MAP: Record<string, string> = keyCodeMap;

const MODIFIER_LAYOUT_KEYS: Record<SupportedOs, Record<NormalizedModifier, string>> = {
  mac: {
    ctrl: 'Control',
    shift: 'Shift',
    alt: 'Option',
    meta: 'Command',
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

function resolveFromKeyCodeMap(baseKey: string): string | null {
  const directMatch = KEY_CODE_MAP[baseKey];
  if (directMatch) {
    return directMatch;
  }

  if (baseKey.includes('-')) {
    const underscoreVariant = baseKey.replace(/-/g, '_');
    const underscoreMatch = KEY_CODE_MAP[underscoreVariant];
    if (underscoreMatch) {
      return underscoreMatch;
    }
  }

  if (baseKey.includes('_')) {
    const hyphenVariant = baseKey.replace(/_/g, '-');
    const hyphenMatch = KEY_CODE_MAP[hyphenVariant];
    if (hyphenMatch) {
      return hyphenMatch;
    }
  }

  return null;
}

function resolveModifierLayoutKey(baseKey: string, os: SupportedOs): string | null {
  const normalizedModifier = normalizeModifier(baseKey, os);
  if (!Object.prototype.hasOwnProperty.call(MODIFIER_LAYOUT_KEYS[os], normalizedModifier)) {
    return null;
  }

  return MODIFIER_LAYOUT_KEYS[os][normalizedModifier as NormalizedModifier] ?? null;
}

export function resolveLayoutKey(bindingKey: string, os: SupportedOs = 'win'): string | null {
  const baseKey = normalizeBindingKeyToken(bindingKey);
  if (!baseKey) return null;
  const modifierLayoutKey = resolveModifierLayoutKey(baseKey, os);
  if (modifierLayoutKey) return modifierLayoutKey;
  const mappedKey = resolveFromKeyCodeMap(baseKey);
  if (mappedKey) return mappedKey;
  if (/^[a-z]$/.test(baseKey)) return baseKey.toUpperCase();
  if (/^[0-9]$/.test(baseKey)) return baseKey;
  if (/^f([1-9]|1[0-9]|2[0-4])$/.test(baseKey)) return baseKey.toUpperCase();
  if (/^[!@#$%^&*()_+{}|:"<>?~\-=\[\]\\;',./¥]$/.test(baseKey)) return baseKey;
  return null;
}
