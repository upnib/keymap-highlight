// Tests for editor-helpers — toEditor normalization and fallback to vscode for unknown values.
import { test, expect } from '@playwright/test';
import { toEditor } from '../../src/utils/editor-helpers';

test.describe('toEditor — valid editor identifiers', () => {
  test('returns vscode for "vscode"', () => {
    expect(toEditor('vscode')).toBe('vscode');
  });

  test('returns jetbrains for "jetbrains"', () => {
    expect(toEditor('jetbrains')).toBe('jetbrains');
  });

  test('returns vim for "vim"', () => {
    expect(toEditor('vim')).toBe('vim');
  });

  test('returns neovim for "neovim"', () => {
    expect(toEditor('neovim')).toBe('neovim');
  });

  test('returns zed for "zed"', () => {
    expect(toEditor('zed')).toBe('zed');
  });

  test('returns emacs for "emacs"', () => {
    expect(toEditor('emacs')).toBe('emacs');
  });

  test('returns krita for "krita"', () => {
    expect(toEditor('krita')).toBe('krita');
  });

  test('returns illustrator for "illustrator"', () => {
    expect(toEditor('illustrator')).toBe('illustrator');
  });
});

test.describe('toEditor — fallback to vscode', () => {
  test('falls back to vscode for undefined input', () => {
    expect(toEditor(undefined)).toBe('vscode');
  });

  test('falls back to vscode for empty string', () => {
    expect(toEditor('')).toBe('vscode');
  });

  test('falls back to vscode for unrecognized editor name', () => {
    expect(toEditor('sublimetext')).toBe('vscode');
    expect(toEditor('atom')).toBe('vscode');
    expect(toEditor('notepad')).toBe('vscode');
  });

  test('falls back to vscode for mixed-case editor identifiers', () => {
    expect(toEditor('VSCode')).toBe('vscode');
    expect(toEditor('VSCODE')).toBe('vscode');
    expect(toEditor('VsCode')).toBe('vscode');
  });

  test('falls back to vscode for whitespace-padded identifiers', () => {
    expect(toEditor(' vscode')).toBe('vscode');
    expect(toEditor('vscode ')).toBe('vscode');
  });
});
