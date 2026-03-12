// Tests for binding-display — formatStroke, formatChordSequence, getConflictIdentity, createBindingSignature.
import { test, expect } from '@playwright/test';
import type { Editor } from '@keymap-highlight/file-parsers';
import { formatStroke, formatChordSequence, getConflictIdentity, createBindingSignature } from '@keymap-highlight/layout-pipeline';

const makeBinding = (overrides: Partial<{
  key: string;
  modifiers: string[];
  chords: { key: string; modifiers: string[] }[];
  when: string;
  command: string;
  sourceEditor: Editor;
}> = {}) => ({
  key: 'c',
  modifiers: [] as string[],
  chords: [] as { key: string; modifiers: string[] }[],
  when: 'global',
  command: 'editor.copy',
  sourceEditor: 'vscode' as Editor,
  ...overrides,
});

test.describe('formatStroke', () => {
  test('returns key alone when no modifiers', () => {
    expect(formatStroke('c', [])).toBe('c');
  });

  test('joins single modifier and key with plus', () => {
    expect(formatStroke('c', ['ctrl'])).toBe('ctrl+c');
  });

  test('joins multiple modifiers and key with plus', () => {
    expect(formatStroke('s', ['ctrl', 'shift'])).toBe('ctrl+shift+s');
  });

  test('preserves modifier order as given', () => {
    expect(formatStroke('a', ['shift', 'alt'])).toBe('shift+alt+a');
  });
});

test.describe('formatChordSequence', () => {
  test('returns primary stroke alone when no chords', () => {
    const binding = makeBinding({ key: 'c', modifiers: ['ctrl'] });
    expect(formatChordSequence(binding)).toBe('ctrl+c');
  });

  test('joins primary and chord strokes with arrow separator', () => {
    const binding = makeBinding({
      key: 'k',
      modifiers: ['ctrl'],
      chords: [{ key: 'b', modifiers: ['ctrl'] }],
    });
    expect(formatChordSequence(binding)).toBe('ctrl+k → ctrl+b');
  });

  test('handles multiple chords in sequence', () => {
    const binding = makeBinding({
      key: 'k',
      modifiers: ['ctrl'],
      chords: [
        { key: 'b', modifiers: ['ctrl'] },
        { key: 'f', modifiers: [] },
      ],
    });
    expect(formatChordSequence(binding)).toBe('ctrl+k → ctrl+b → f');
  });

  test('returns plain key when no modifiers and no chords', () => {
    const binding = makeBinding({ key: 'escape', modifiers: [] });
    expect(formatChordSequence(binding)).toBe('escape');
  });
});

test.describe('getConflictIdentity', () => {
  test('produces stable identity for same binding data', () => {
    const binding = makeBinding({ key: 'c', modifiers: ['ctrl'], when: 'textInputFocus', command: 'copy' });
    expect(getConflictIdentity(binding)).toBe(getConflictIdentity(binding));
  });

  test('normalizes key to lowercase', () => {
    const lower = makeBinding({ key: 'c' });
    const upper = makeBinding({ key: 'C' });
    expect(getConflictIdentity(lower)).toBe(getConflictIdentity(upper));
  });

  test('normalizes modifiers to sorted lowercase', () => {
    const a = makeBinding({ modifiers: ['Ctrl', 'Shift'] });
    const b = makeBinding({ modifiers: ['shift', 'ctrl'] });
    expect(getConflictIdentity(a)).toBe(getConflictIdentity(b));
  });

  test('normalizes AND-joined context tokens regardless of order', () => {
    const a = makeBinding({ when: 'editorFocus && textInputFocus' });
    const b = makeBinding({ when: 'textInputFocus && editorFocus' });
    expect(getConflictIdentity(a)).toBe(getConflictIdentity(b));
  });

  test('normalizes empty when to global context', () => {
    const empty = makeBinding({ when: '' });
    const global = makeBinding({ when: 'global' });
    expect(getConflictIdentity(empty)).toBe(getConflictIdentity(global));
  });

  test('normalizes wildcard when to global context', () => {
    const wildcard = makeBinding({ when: '*' });
    const global = makeBinding({ when: 'global' });
    expect(getConflictIdentity(wildcard)).toBe(getConflictIdentity(global));
  });

  test('treats different keys as different identities', () => {
    const a = makeBinding({ key: 'c' });
    const b = makeBinding({ key: 'v' });
    expect(getConflictIdentity(a)).not.toBe(getConflictIdentity(b));
  });

  test('treats different sourceEditor as different identities', () => {
    const a = makeBinding({ sourceEditor: 'vscode' });
    const b = makeBinding({ sourceEditor: 'jetbrains' });
    expect(getConflictIdentity(a)).not.toBe(getConflictIdentity(b));
  });

  test('includes chord key and modifiers in identity', () => {
    const withChord = makeBinding({ chords: [{ key: 'b', modifiers: ['ctrl'] }] });
    const noChord = makeBinding({ chords: [] });
    expect(getConflictIdentity(withChord)).not.toBe(getConflictIdentity(noChord));
  });

  test('normalizes chord key to lowercase', () => {
    const lower = makeBinding({ chords: [{ key: 'b', modifiers: [] }] });
    const upper = makeBinding({ chords: [{ key: 'B', modifiers: [] }] });
    expect(getConflictIdentity(lower)).toBe(getConflictIdentity(upper));
  });

  test('identity includes sourceEditor prefix', () => {
    const binding = makeBinding({ sourceEditor: 'zed' });
    expect(getConflictIdentity(binding)).toMatch(/^zed:/);
  });
});

test.describe('createBindingSignature', () => {
  test('signature includes command and is different for different commands', () => {
    const a = makeBinding({ command: 'editor.copy' });
    const b = makeBinding({ command: 'editor.paste' });
    expect(createBindingSignature(a)).not.toBe(createBindingSignature(b));
  });

  test('signature is stable for same binding data', () => {
    const binding = makeBinding({ key: 'c', modifiers: ['ctrl'], command: 'copy' });
    expect(createBindingSignature(binding)).toBe(createBindingSignature(binding));
  });

  test('signature extends conflict identity with command suffix', () => {
    const binding = makeBinding({ command: 'my.command' });
    expect(createBindingSignature(binding)).toContain('my.command');
    expect(createBindingSignature(binding)).toContain(getConflictIdentity(binding));
  });

  test('two bindings with same key/context but different commands have different signatures', () => {
    const a = makeBinding({ key: 'c', modifiers: ['ctrl'], when: 'global', command: 'copy' });
    const b = makeBinding({ key: 'c', modifiers: ['ctrl'], when: 'global', command: 'paste' });
    expect(createBindingSignature(a)).not.toBe(createBindingSignature(b));
  });
});
