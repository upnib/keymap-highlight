// layout-pipeline/src/binding-display.ts - Binding signature and conflict identity utilities.
import { MODIFIER_ALIASES } from './modifier-aliases';

export type PipelineBinding = {
  key: string;
  command: string;
  when: string;
  modifiers: string[];
  chords: Array<{ key: string; modifiers: string[] }>;
  sourceEditor: string;
  isConflict?: boolean;
};

const normalizeModifiers = (modifiers: string[]): string[] =>
  Array.from(
    new Set(
      modifiers.map((modifier) => {
        const normalizedModifier = modifier.toLowerCase();
        return MODIFIER_ALIASES[normalizedModifier] ?? normalizedModifier;
      }),
    ),
  ).sort();

const normalizeContextKey = (when: string): string => {
  const trimmedWhen = when.trim();
  if (!trimmedWhen || trimmedWhen === '*') return 'global';

  let normalizedContext = trimmedWhen
    .toLowerCase()
    .replace(/\s*&&\s*/g, '&&')
    .replace(/\s*\|\|\s*/g, '||')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();

  normalizedContext = normalizedContext
    .split('||')
    .map((orPart) =>
      orPart
        .split('&&')
        .map((part) => part.trim())
        .sort()
        .join('&&'),
    )
    .sort()
    .join('||');

  return normalizedContext || 'global';
};

export function formatStroke(key: string, modifiers: string[]): string {
  if (!modifiers.length) {
    return key;
  }

  return [...modifiers, key].join('+');
}

export function formatChordSequence(binding: PipelineBinding): string {
  const primary = formatStroke(binding.key, binding.modifiers);
  if (!binding.chords.length) {
    return primary;
  }

  const sequence = binding.chords.map((chord) => formatStroke(chord.key, chord.modifiers));
  return [primary, ...sequence].join(' → ');
}

export function getConflictIdentity(binding: PipelineBinding): string {
  const normalizedKey = binding.key.trim().toLowerCase();
  const normalizedMods = normalizeModifiers(binding.modifiers).join('+');
  const chordSignature = binding.chords
    .map((chord) => `${chord.key.trim().toLowerCase()}:${normalizeModifiers(chord.modifiers).join('+')}`)
    .join('>');
  const normalizedContext = normalizeContextKey(binding.when);
  return `${binding.sourceEditor}:${normalizedKey}:${normalizedMods}:${chordSignature}:${normalizedContext}`;
}

export function createBindingSignature(binding: PipelineBinding): string {
  return `${getConflictIdentity(binding)}:${binding.command}`;
}
