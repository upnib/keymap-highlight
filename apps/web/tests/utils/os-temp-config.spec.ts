// Tests for os-modifier-layout — remapConfigByModifierLayout modifier rewriting for all supported formats.
import { test, expect } from '@playwright/test';
import { remapConfigByModifierLayout } from '@keymap-highlight/layout-pipeline';

test.describe('remapConfigByModifierLayout — identity behavior', () => {
  test('returns rawConfig unchanged when fromOs equals toOs', () => {
    const config = '[{"key":"cmd+c","command":"copy"}]';
    expect(remapConfigByModifierLayout(config, 'mac', 'mac')).toBe(config);
  });

  test('returns rawConfig unchanged when fromOs equals toOs for all OS values', () => {
    const config = '[{"key":"ctrl+c","command":"copy"}]';
    expect(remapConfigByModifierLayout(config, 'win', 'win')).toBe(config);
    expect(remapConfigByModifierLayout(config, 'linux', 'linux')).toBe(config);
  });
});

test.describe('remapConfigByModifierLayout — vscode format (default)', () => {
  test('remaps cmd to ctrl when converting mac to win', () => {
    const config = '[{"key":"cmd+c","command":"copy"}]';
    const result = remapConfigByModifierLayout(config, 'mac', 'win');
    expect(result.toLowerCase()).toContain('"key"');
    expect(result.toLowerCase()).not.toContain('"key": "cmd+c"');
  });

  test('does not modify command or when fields', () => {
    const config = '[{"key":"cmd+c","command":"cmd+copy","when":"cmd+context"}]';
    const result = remapConfigByModifierLayout(config, 'mac', 'win');
    expect(result).toContain('"command":"cmd+copy"');
    expect(result).toContain('"when":"cmd+context"');
  });

  test('only rewrites "key" values, preserving surrounding JSON structure', () => {
    const config = '[{"key":"cmd+c","command":"editor.copy"}]';
    const result = remapConfigByModifierLayout(config, 'mac', 'win');
    expect(result).toContain('"command":"editor.copy"');
  });

  test('remaps ctrl to cmd when converting win to mac', () => {
    const config = '[{"key":"ctrl+c","command":"copy"}]';
    const result = remapConfigByModifierLayout(config, 'win', 'mac');
    expect(result.toLowerCase()).toContain('"key"');
  });

  test('preserves original case of modifier token when fully uppercase', () => {
    const config = '[{"key":"CMD+C","command":"copy"}]';
    const result = remapConfigByModifierLayout(config, 'mac', 'win');
    const keyMatch = result.match(/"key"\s*:\s*"([^"]+)"/i);
    expect(keyMatch).not.toBeNull();
    expect(keyMatch![1]).toEqual(keyMatch![1].toUpperCase());
  });

  test('remaps multiple key bindings in a multi-entry config', () => {
    const config = `[
      {"key":"cmd+c","command":"copy"},
      {"key":"cmd+v","command":"paste"}
    ]`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win');
    const matches = [...result.matchAll(/"key"\s*:\s*"([^"]+)"/gi)];
    expect(matches.length).toBe(2);
    for (const match of matches) {
      expect(match[1].toLowerCase()).not.toContain('cmd');
    }
  });
});

test.describe('remapConfigByModifierLayout — jetbrains format', () => {
  test('remaps modifier tokens within keystroke attributes', () => {
    const config = `<keymap><action id="Copy"><keyboard-shortcut first-keystroke="meta c" /></action></keymap>`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'jetbrains');
    expect(result.toLowerCase()).not.toContain('first-keystroke="meta c"');
  });

  test('does not modify non-keystroke XML content', () => {
    const config = `<keymap name="meta settings"><action id="meta_action"><keyboard-shortcut first-keystroke="meta c" /></action></keymap>`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'jetbrains');
    expect(result).toContain('name="meta settings"');
    expect(result).toContain('id="meta_action"');
  });

  test('handles second-keystroke attribute as well', () => {
    const config = `<keymap><action id="X"><keyboard-shortcut first-keystroke="meta a" second-keystroke="meta b" /></action></keymap>`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'jetbrains');
    expect(result.toLowerCase()).not.toContain('second-keystroke="meta b"');
  });
});

test.describe('remapConfigByModifierLayout — zed format', () => {
  test('remaps modifier tokens in dash-separated binding keys', () => {
    const config = `[{"context":"Editor","bindings":{"cmd-c":"editor::Copy"}}]`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'zed');
    expect(result.toLowerCase()).not.toContain('"cmd-c":');
  });

  test('does not rewrite binding keys without dashes', () => {
    const config = `[{"context":"Editor","bindings":{"x":"editor::SomeAction"}}]`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'zed');
    expect(result).toContain('"x":');
  });
});

test.describe('remapConfigByModifierLayout — vim/neovim format', () => {
  test('remaps modifier tokens inside angle bracket sequences for vim', () => {
    const config = `nnoremap <D-c> :copy<CR>`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'vim');
    expect(result).not.toBe(config);
  });

  test('remaps modifier tokens inside angle bracket sequences for neovim', () => {
    const config = `vim.keymap.set('n', '<D-c>', ':copy<CR>')`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'neovim');
    expect(result).not.toBe(config);
  });

  test('does not modify content outside angle brackets', () => {
    const config = `-- map cmd+c\nnnoremap <D-c> :copy<CR>`;
    const result = remapConfigByModifierLayout(config, 'mac', 'win', 'vim');
    expect(result).toContain('-- map cmd+c');
  });
});

test.describe('remapConfigByModifierLayout — krita format', () => {
  test('remaps modifier tokens in krita key=value lines', () => {
    const config = `[Shortcuts]\nfile_new=Ctrl+N\n`;
    const result = remapConfigByModifierLayout(config, 'win', 'mac', 'krita');
    expect(result).not.toBe(config);
  });

  test('preserves lines with none value unchanged', () => {
    const config = `[Shortcuts]\nfile_open=none\n`;
    const result = remapConfigByModifierLayout(config, 'win', 'mac', 'krita');
    expect(result).toContain('file_open=none');
  });

  test('preserves empty value lines unchanged', () => {
    const config = `[Shortcuts]\nfile_close=\n`;
    const result = remapConfigByModifierLayout(config, 'win', 'mac', 'krita');
    expect(result).toContain('file_close=');
  });
});

test.describe('remapConfigByModifierLayout — illustrator format', () => {
  test('remaps modifier tokens in tab-delimited shortcut column', () => {
    const config = `Tools\nCopy\tCtrl+C\n\nMenu Commands\nPaste\tCtrl+V`;
    const result = remapConfigByModifierLayout(config, 'win', 'mac', 'illustrator');
    expect(result).not.toBe(config);
  });

  test('preserves tool and section names in tab-delimited lines', () => {
    const config = `Tools\nCopy\tCtrl+C`;
    const result = remapConfigByModifierLayout(config, 'win', 'mac', 'illustrator');
    expect(result).toContain('Copy');
    expect(result).toContain('Tools');
  });

  test('remaps modifiers in non-tab lines with trailing shortcut', () => {
    const config = `Menu Commands\nNewCtrl+N`;
    const result = remapConfigByModifierLayout(config, 'win', 'mac', 'illustrator');
    expect(result).not.toBe(config);
  });
});
