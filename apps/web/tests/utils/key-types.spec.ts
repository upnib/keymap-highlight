// Tests for key-types — getKeyType classification of modifier, standard, and action key labels.
import { test, expect } from '@playwright/test';
import { getKeyType } from '@keymap-highlight/layout-pipeline';

test.describe('getKeyType — modifier classification', () => {
  test('classifies ctrl as modifier', () => {
    expect(getKeyType('ctrl')).toBe('modifier');
  });

  test('classifies shift as modifier', () => {
    expect(getKeyType('shift')).toBe('modifier');
  });

  test('classifies alt as modifier', () => {
    expect(getKeyType('alt')).toBe('modifier');
  });

  test('classifies cmd as modifier', () => {
    expect(getKeyType('cmd')).toBe('modifier');
  });

  test('classifies meta as modifier', () => {
    expect(getKeyType('meta')).toBe('modifier');
  });

  test('classifies modifier labels case-insensitively', () => {
    expect(getKeyType('Ctrl')).toBe('modifier');
    expect(getKeyType('SHIFT')).toBe('modifier');
    expect(getKeyType('Alt')).toBe('modifier');
  });

  test('trims whitespace before classifying modifier', () => {
    expect(getKeyType('  ctrl  ')).toBe('modifier');
  });
});

test.describe('getKeyType — standard classification', () => {
  test('classifies single letter as standard', () => {
    expect(getKeyType('a')).toBe('standard');
    expect(getKeyType('z')).toBe('standard');
  });

  test('classifies single digit as standard', () => {
    expect(getKeyType('0')).toBe('standard');
    expect(getKeyType('9')).toBe('standard');
  });

  test('classifies standard punctuation characters as standard', () => {
    expect(getKeyType('`')).toBe('standard');
    expect(getKeyType('-')).toBe('standard');
    expect(getKeyType('=')).toBe('standard');
    expect(getKeyType('[')).toBe('standard');
    expect(getKeyType(']')).toBe('standard');
    expect(getKeyType('\\')).toBe('standard');
    expect(getKeyType(';')).toBe('standard');
    expect(getKeyType("'")).toBe('standard');
    expect(getKeyType(',')).toBe('standard');
    expect(getKeyType('.')).toBe('standard');
    expect(getKeyType('/')).toBe('standard');
  });

  test('classifies uppercase single letter as standard', () => {
    expect(getKeyType('A')).toBe('standard');
    expect(getKeyType('Z')).toBe('standard');
  });
});

test.describe('getKeyType — action classification', () => {
  test('classifies multi-character keys as action', () => {
    expect(getKeyType('escape')).toBe('action');
    expect(getKeyType('enter')).toBe('action');
    expect(getKeyType('backspace')).toBe('action');
    expect(getKeyType('delete')).toBe('action');
    expect(getKeyType('tab')).toBe('action');
  });

  test('classifies function keys as action', () => {
    expect(getKeyType('f1')).toBe('action');
    expect(getKeyType('f12')).toBe('action');
  });

  test('classifies arrow keys as action', () => {
    expect(getKeyType('arrowup')).toBe('action');
    expect(getKeyType('arrowdown')).toBe('action');
    expect(getKeyType('arrowleft')).toBe('action');
    expect(getKeyType('arrowright')).toBe('action');
  });

  test('classifies space as action since it does not match STANDARD_KEY_REGEX', () => {
    expect(getKeyType(' ')).toBe('action');
  });

  test('classifies empty string as action', () => {
    expect(getKeyType('')).toBe('action');
  });

  test('classifies multi-character symbols as action', () => {
    expect(getKeyType('up')).toBe('action');
    expect(getKeyType('down')).toBe('action');
    expect(getKeyType('home')).toBe('action');
    expect(getKeyType('end')).toBe('action');
    expect(getKeyType('pageup')).toBe('action');
    expect(getKeyType('pagedown')).toBe('action');
  });
});
