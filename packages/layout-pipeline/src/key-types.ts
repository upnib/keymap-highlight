// layout-pipeline/src/key-types.ts - Key label classification for modifier/standard/action rendering.
import ModifiersData from './data/names/key-modifiers.json';

export type KeyType = 'modifier' | 'standard' | 'action';

const MODIFIER_KEYS = new Set<string>();

for (const tokens of Object.values(ModifiersData.modifierTokens)) {
  for (const token of tokens) {
    MODIFIER_KEYS.add(token.toLowerCase());
  }
}

for (const kind of ModifiersData.modifierKinds) {
  MODIFIER_KEYS.add(kind.toLowerCase());
}

const STANDARD_KEY_REGEX = /^[a-zA-Z0-9`\-=[\]\\;',./]$/;
const NUMPAD_KEY_REGEX = /^num(?:[0-9]|dec|enter|lock|[+\-*/])$/i;

export function getKeyType(label: string): KeyType {
  const cleanLabel = label.trim();
  const lowerLabel = cleanLabel.toLowerCase();

  if (MODIFIER_KEYS.has(lowerLabel)) {
    return 'modifier';
  }

  if (cleanLabel.length === 1 && STANDARD_KEY_REGEX.test(cleanLabel)) {
    return 'standard';
  }

  if (NUMPAD_KEY_REGEX.test(cleanLabel)) {
    return 'standard';
  }

  return 'action';
}
