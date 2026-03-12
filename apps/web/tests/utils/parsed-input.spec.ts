// Tests for parsed-input — format pass-through, OS detection fallback, and remap orchestration.
import { test, expect } from '@playwright/test';
import { resolveParsedInput } from '@keymap-highlight/layout-pipeline';

test.describe('resolveParsedInput — format pass-through', () => {
  test('returns the provided format unchanged', () => {
    const result = resolveParsedInput({
      rawConfig: '[{"key":"ctrl+c","command":"copy"}]',
      targetOs: 'win',
      format: 'vscode',
    });
    expect(result.format).toBe('vscode');
  });

  test('returns jetbrains format when explicitly passed', () => {
    const result = resolveParsedInput({
      rawConfig: '<keymap></keymap>',
      targetOs: 'win',
      format: 'jetbrains',
    });
    expect(result.format).toBe('jetbrains');
  });

  test('returns unknown format when explicitly passed', () => {
    const result = resolveParsedInput({
      rawConfig: 'unrecognized content',
      targetOs: 'win',
      format: 'unknown',
    });
    expect(result.format).toBe('unknown');
  });
});

test.describe('resolveParsedInput — detectedConfigOs resolution', () => {
  test('uses uploadedOs when provided', () => {
    const result = resolveParsedInput({
      rawConfig: '[{"key":"ctrl+c","command":"copy"}]',
      targetOs: 'win',
      format: 'vscode',
      uploadedOs: 'mac',
    });
    expect(result.detectedConfigOs).toBe('mac');
  });

  test('defaults to unknown when uploadedOs is not provided', () => {
    const result = resolveParsedInput({
      rawConfig: '[{"key":"ctrl+c","command":"copy"}]',
      targetOs: 'win',
      format: 'vscode',
    });
    expect(result.detectedConfigOs).toBe('unknown');
  });

  test('defaults to unknown when uploadedOs is null', () => {
    const result = resolveParsedInput({
      rawConfig: '[{"key":"ctrl+c","command":"copy"}]',
      targetOs: 'win',
      format: 'vscode',
      uploadedOs: null,
    });
    expect(result.detectedConfigOs).toBe('unknown');
  });
});

test.describe('resolveParsedInput — remap behavior via contentToParse', () => {
  test('returns rawConfig unchanged when detectedConfigOs matches targetOs', () => {
    const rawConfig = '[{"key":"ctrl+c","command":"copy"}]';
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'mac',
      format: 'vscode',
      uploadedOs: 'mac',
    });
    expect(result.contentToParse).toBe(rawConfig);
  });

  test('returns rawConfig unchanged when detectedConfigOs is unknown (no uploadedOs)', () => {
    const rawConfig = '[{"key":"ctrl+c","command":"copy"}]';
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'win',
      format: 'vscode',
    });
    expect(result.contentToParse).toBe(rawConfig);
  });

  test('returns rawConfig unchanged when detectedConfigOs is unknown (explicit unknown)', () => {
    const rawConfig = '[{"key":"ctrl+c","command":"copy"}]';
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'win',
      format: 'vscode',
      uploadedOs: 'unknown',
    });
    expect(result.contentToParse).toBe(rawConfig);
  });

  test('returns rawConfig unchanged when format is unknown', () => {
    const rawConfig = 'some content';
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'win',
      format: 'unknown',
      uploadedOs: 'mac',
    });
    expect(result.contentToParse).toBe(rawConfig);
  });

  test('returns rawConfig unchanged for vscode when platform overrides exist', () => {
    const rawConfig = '[{"key":"ctrl+c","command":"copy","mac":"cmd+c"}]';
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'win',
      format: 'vscode',
      uploadedOs: 'mac',
    });
    expect(result.contentToParse).toBe(rawConfig);
  });

  test('remaps contentToParse when detectedConfigOs differs from targetOs and remap is allowed', () => {
    const rawConfig = '[{"key":"cmd+c","command":"copy"}]';
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'win',
      format: 'vscode',
      uploadedOs: 'mac',
    });
    expect(result.contentToParse).not.toBe(rawConfig);
    expect(result.contentToParse).toContain('"key"');
  });

  test('remaps cmd to ctrl style for vscode mac->win', () => {
    const rawConfig = '[{"key":"cmd+c","command":"copy"}]';
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'win',
      format: 'vscode',
      uploadedOs: 'mac',
    });
    expect(result.contentToParse.toLowerCase()).not.toContain('cmd+c');
    expect(result.contentToParse.toLowerCase()).toContain('ctrl');
  });

  test('remaps non-vscode format (jetbrains) when OS differs', () => {
    const rawConfig = `<keymap><action id="Copy"><keyboard-shortcut first-keystroke="mac c" /></action></keymap>`;
    const result = resolveParsedInput({
      rawConfig,
      targetOs: 'win',
      format: 'jetbrains',
      uploadedOs: 'mac',
    });
    expect(result.contentToParse).not.toBe(rawConfig);
  });
});
