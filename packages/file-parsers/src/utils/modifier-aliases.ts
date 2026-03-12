// modifier-aliases.ts — Canonical modifier alias map and normalization utilities for the parser
// engine. Inlines modifier kind/token data to avoid cross-package JSON imports.

const MODIFIER_KINDS = [
  'ctrl', 'shift', 'alt', 'meta', 'fn', 'cmd', 'super', 'win',
  'option', 'altgr', 'hyper', 'menu', 'gui',
] as const;

const MODIFIER_TOKENS_MAP = {
  ctrl: ['ctrl', 'control', 'ctl'],
  shift: ['shift'],
  alt: ['alt', 'option', 'opt', 'altgr'],
  meta: ['meta', 'cmd', 'command', 'super', 'win', 'windows', 'gui', 'hyper'],
  fn: ['fn'],
  menu: ['menu'],
} as const;

export type NormalizedModifier = keyof typeof MODIFIER_TOKENS_MAP;

const buildAliases = () => {
  const aliases: Record<string, NormalizedModifier> = {};
  for (const [kind, tokens] of Object.entries(MODIFIER_TOKENS_MAP) as [NormalizedModifier, readonly string[]][]) {
    for (const token of tokens) {
      aliases[token] = kind;
    }
  }
  return aliases;
};

export const BASE_MODIFIER_ALIASES: Readonly<Record<string, NormalizedModifier>> = buildAliases();

const NUMPAD_PLUS_PREFIXES = new Set([
  'num',
  'num_',
  'numpad',
  'numpad_',
  'kp',
  'kp_',
  'k',
]);

export function splitPlusShortcutTokens(raw: string): {
  modifierTokens: string[];
  keyToken: string;
} {
  const tokens = raw.split('+');
  let keyToken = tokens.pop() ?? '';

  if (keyToken.length === 0) {
    while (tokens.length > 0 && tokens[tokens.length - 1] === '') {
      tokens.pop();
    }

    const previousToken = (tokens[tokens.length - 1] ?? '').trim().toLowerCase();
    if (NUMPAD_PLUS_PREFIXES.has(previousToken)) {
      tokens.pop();
      keyToken = `${previousToken}+`;
    } else {
      keyToken = '+';
    }
  }

  return {
    modifierTokens: tokens.map((token) => token.trim()).filter((token) => token.length > 0),
    keyToken,
  };
}

export { MODIFIER_KINDS, MODIFIER_TOKENS_MAP };
