// layout-pipeline/src/modifier-aliases.ts - Shared modifier normalization and matching helpers.
import ModifiersData from './data/names/key-modifiers.json';
import type { SupportedOs } from './types';

export type NormalizedModifier = keyof typeof ModifiersData.modifierTokens;

const MODIFIER_TOKENS = ModifiersData.modifierTokens as Record<NormalizedModifier, string[]>;

function buildModifierAliases(): Record<string, NormalizedModifier> {
  const aliases: Record<string, NormalizedModifier> = {};

  for (const [kind, tokens] of Object.entries(MODIFIER_TOKENS) as [NormalizedModifier, string[]][]) {
    aliases[kind] = kind;
    for (const token of tokens) {
      aliases[token.toLowerCase()] = kind;
    }
  }

  return aliases;
}

export const MODIFIER_ALIASES: Record<string, NormalizedModifier> = buildModifierAliases();

export const OS_MODIFIER_ALIASES: Record<SupportedOs, Record<string, NormalizedModifier>> = {
  linux: { ...MODIFIER_ALIASES },
  mac: { ...MODIFIER_ALIASES },
  win: { ...MODIFIER_ALIASES },
};

function normalizeEditorSpecificModifier(
  lowerModifier: string,
  originalModifier: string,
  os: SupportedOs,
  sourceEditor?: string,
): string | null {
  if (lowerModifier === 'altgraph') {
    return 'alt';
  }

  if (lowerModifier === 'oskey') {
    return 'meta';
  }

  if (lowerModifier === 'ctrlcmd' || lowerModifier === 'cmdorctrl' || lowerModifier === 'ctrlorcmd') {
    return os === 'mac' ? 'meta' : 'ctrl';
  }

  if (lowerModifier === 'winctrl') {
    return os === 'mac' ? 'ctrl' : 'meta';
  }

  if (lowerModifier === 'mod') {
    return os === 'mac' ? 'meta' : 'ctrl';
  }

  if (sourceEditor === 'vim' || sourceEditor === 'neovim') {
    switch (lowerModifier) {
      case 'c':
      case 'ctrl':
      case 'control':
        return 'ctrl';
      case 's':
      case 'shift':
        return 'shift';
      case 'a':
      case 'alt':
        return 'alt';
      case 'm':
      case 'meta':
        return 'meta';
      case 'd':
      case 'cmd':
      case 'command':
        return os === 'mac' ? 'cmd' : 'meta';
      case 'opt':
      case 'option':
        return 'option';
      case 'super':
      case 'fn':
        return lowerModifier;
      default:
        break;
    }
  }

  if (sourceEditor === 'emacs') {
    if (originalModifier === 'S') {
      return 'shift';
    }

    switch (lowerModifier) {
      case 's':
      case 'm':
      case 'meta':
        return 'meta';
      case 'c':
      case 'ctrl':
      case 'control':
        return 'ctrl';
      case 'a':
      case 'alt':
        return 'alt';
      case 'h':
      case 'hyper':
      case 'super':
        return 'super';
      case 'cmd':
      case 'command':
        return 'cmd';
      case 'opt':
      case 'option':
        return 'option';
      case 'fn':
      case 'shift':
        return lowerModifier;
      default:
        break;
    }
  }

  return null;
}

export function normalizeModifier(
  modifier: string,
  os: SupportedOs,
  sourceEditor?: string,
): string {
  const lower = modifier.trim().toLowerCase();
  if (!lower) {
    return lower;
  }

  const editorSpecific = normalizeEditorSpecificModifier(lower, modifier.trim(), os, sourceEditor);
  if (editorSpecific) {
    return editorSpecific;
  }

  return OS_MODIFIER_ALIASES[os][lower] ?? MODIFIER_ALIASES[lower] ?? lower;
}

export function normalizeBindingModifiers(
  modifiers: readonly string[],
  os: SupportedOs,
  sourceEditor?: string,
): string[] {
  return Array.from(new Set(modifiers.map((modifier) => normalizeModifier(modifier, os, sourceEditor)))).sort();
}

export function contextMatches(bindingWhen: string, activeContext: string): boolean {
  const when = bindingWhen.trim().toLowerCase();
  const context = activeContext.trim().toLowerCase();
  if (!when || when === '*' || context === 'global') return true;
  if (when === context) return true;
  return when.includes(context);
}

export function modifiersMatch(bindingModifiers: string[], activeModifiers: string[]): boolean {
  if (bindingModifiers.length !== activeModifiers.length) return false;
  return bindingModifiers.every((modifier, index) => modifier === activeModifiers[index]);
}

export function modifiersIncludeSubset(bindingModifiers: string[], activeModifiers: string[]): boolean {
  if (activeModifiers.length === 0) return true;
  return activeModifiers.every((mod) => bindingModifiers.includes(mod));
}
