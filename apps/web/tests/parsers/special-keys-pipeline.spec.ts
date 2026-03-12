// special-keys-pipeline.spec.ts - Verifies special/mark key alias handling end-to-end.
// Covers parser normalization for named punctuation keys and mapper/layout pipeline resolution.
import { test, expect } from '@playwright/test';
import {
  parseVSCode,
  parseZed,
  parseVim,
  parseEmacs,
  parseKrita,
  parseIllustrator,
} from '@keymap-highlight/file-parsers';
import { resolveLayoutKey, INPUT_LAYOUT_CUSTOM_KEY_PATTERN } from '@keymap-highlight/layout-pipeline';

test.describe('Special key pipeline', () => {
  test('normalizes named quote and punctuation keys across parsers', () => {
    const vscodeResult = parseVSCode(
      `[
        {
          "key": "ctrl+quote",
          "command": "editor.action.clipboardCopyAction"
        }
      ]`,
      'windows',
    );
    expect(vscodeResult.bindings[0]?.key).toBe("'");

    const zedResult = parseZed(
      `[
        {
          "context": "Editor",
          "bindings": {
            "ctrl-back-quote": "editor::Toggle"
          }
        }
      ]`,
      'windows',
    );
    expect(zedResult.bindings[0]?.key).toBe('`');

    const vimResult = parseVim('nnoremap <C-Quote> :w<CR>', 'windows');
    expect(vimResult.bindings[0]?.key).toBe("'");

    const emacsResult = parseEmacs(`(global-set-key (kbd "C-quote") 'save-buffer)`, 'windows');
    expect(emacsResult.bindings[0]?.key).toBe("'");

    const kritaResult = parseKrita(`[Shortcuts]\nfile_new=Ctrl+Quote\n`, 'windows');
    expect(kritaResult.bindings[0]?.key).toBe("'");

    const illustratorResult = parseIllustrator(`Menu Commands\nFile\nNewCtrl+Quote`, 'windows');
    expect(illustratorResult.bindings[0]?.key).toBe("'");
  });

  test('resolves named punctuation keys to layout key labels', () => {
    expect(resolveLayoutKey('quote', 'win')).toBe("'");
    expect(resolveLayoutKey('comma', 'win')).toBe(',');
    expect(resolveLayoutKey('period', 'win')).toBe('.');
    expect(resolveLayoutKey('slash', 'win')).toBe('/');
    expect(resolveLayoutKey('oem_7', 'win')).toBe("'");
    expect(resolveLayoutKey('oem_3', 'win')).toBe('`');
  });

  test('accepts punctuation keys in custom input mapping validation pattern', () => {
    expect(INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test("'")).toBe(true);
    expect(INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test('/')).toBe(true);
    expect(INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test('`')).toBe(true);
    expect(INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test('[')).toBe(true);
    expect(INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test(']')).toBe(true);
    expect(INPUT_LAYOUT_CUSTOM_KEY_PATTERN.test('ab')).toBe(false);
  });
});
