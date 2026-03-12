// Shared contract helper for parser test suites — asserts canonical stroke model.
// Primary stroke lives in key/modifiers; trailing strokes live in chords[].
import { expect } from '@playwright/test';

/** Expected shape for assertCanonicalStroke. */
export interface StrokeExpected {
  key: string;
  modifiers: string[];
  chords?: Array<{ key: string; modifiers: string[] }>;
}

/**
 * Assert the canonical stroke model on a parsed binding.
 *
 * Rules enforced:
 * 1. Primary stroke lives in binding.key / binding.modifiers.
 * 2. Trailing strokes live in binding.chords[] (defaults to empty array).
 * 3. Primary stroke must not duplicate the first chord's key+modifiers signature.
 */
export function assertCanonicalStroke(
  binding: { key: string; modifiers: string[]; chords: Array<{ key: string; modifiers: string[] }> },
  expected: StrokeExpected,
): void {
  const expectedChords = expected.chords ?? [];

  // Rule 1: primary stroke key and modifiers
  expect(binding.key).toBe(expected.key);
  expect(binding.modifiers).toEqual(expected.modifiers);

  // Rule 2: trailing strokes live in chords[]
  expect(binding.chords).toHaveLength(expectedChords.length);
  for (let i = 0; i < expectedChords.length; i++) {
    expect(binding.chords[i].key).toBe(expectedChords[i].key);
    expect(binding.chords[i].modifiers).toEqual(expectedChords[i].modifiers);
  }

  // Rule 3: primary stroke must not duplicate the first chord's signature
  if (expectedChords.length > 0) {
    const primarySig = `${expected.key}:${expected.modifiers.slice().sort().join(',')}`;
    const firstChordSig = `${expectedChords[0].key}:${expectedChords[0].modifiers.slice().sort().join(',')}`;
    expect(primarySig).not.toBe(firstChordSig);
  }
}
