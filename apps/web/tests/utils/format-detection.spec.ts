// Tests for format-detection utilities — filename heuristics, content-based detection, and OS mapping.
import { test, expect } from '@playwright/test';
import { detectFormat } from '@keymap-highlight/file-parsers';
import { mapStoreOsToWorkerOs } from '@keymap-highlight/layout-pipeline';

test.describe('mapStoreOsToWorkerOs', () => {
  test('maps mac to macos', () => {
    expect(mapStoreOsToWorkerOs('mac')).toBe('macos');
  });

  test('maps win to windows', () => {
    expect(mapStoreOsToWorkerOs('win')).toBe('windows');
  });

  test('maps linux to linux', () => {
    expect(mapStoreOsToWorkerOs('linux')).toBe('linux');
  });
});

test.describe('detectFormat — filename-based detection', () => {
  test('detects jetbrains from .xml extension', () => {
    expect(detectFormat('keymap.xml', '')).toBe('jetbrains');
  });

  test('detects krita from .shortcuts extension', () => {
    expect(detectFormat('krita.shortcuts', '')).toBe('krita');
  });

  test('detects illustrator from .txt filename containing illustrator', () => {
    expect(detectFormat('Adobe Illustrator Shortcuts.txt', '')).toBe('illustrator');
  });

  test('detects vim from .vim extension', () => {
    expect(detectFormat('plugins.vim', '')).toBe('vim');
  });

  test('detects vim from .vimrc filename', () => {
    expect(detectFormat('.vimrc', '')).toBe('vim');
  });

  test('detects vim from vimrc filename', () => {
    expect(detectFormat('vimrc', '')).toBe('vim');
  });

  test('detects vim from _vimrc filename', () => {
    expect(detectFormat('_vimrc', '')).toBe('vim');
  });

  test('detects neovim from .lua extension', () => {
    expect(detectFormat('config.lua', '')).toBe('neovim');
  });

  test('detects neovim from init.lua filename', () => {
    expect(detectFormat('init.lua', '')).toBe('neovim');
  });

  test('detects emacs from .el extension', () => {
    expect(detectFormat('config.el', '')).toBe('emacs');
  });

  test('detects emacs from .emacs filename', () => {
    expect(detectFormat('.emacs', '')).toBe('emacs');
  });

  test('detects emacs from init.el filename', () => {
    expect(detectFormat('init.el', '')).toBe('emacs');
  });

  test('detects vscode from .json extension with non-zed content', () => {
    expect(detectFormat('keybindings.json', '[{"key":"ctrl+c","command":"copy"}]')).toBe('vscode');
  });

  test('detects vscode from .jsonc extension', () => {
    expect(detectFormat('keybindings.jsonc', '[{"key":"ctrl+c","command":"copy"}]')).toBe('vscode');
  });

  test('is case-insensitive for extensions', () => {
    expect(detectFormat('KEYMAP.XML', '')).toBe('jetbrains');
    expect(detectFormat('Config.VIM', '')).toBe('vim');
  });
});

test.describe('detectFormat — zed detection from JSON content', () => {
  test('detects zed when JSON array has context key', () => {
    const content = `[{"context":"Editor","bindings":{"ctrl-c":"editor::Copy"}}]`;
    expect(detectFormat('keybindings.json', content)).toBe('zed');
  });

  test('detects zed when JSON array has bindings key', () => {
    const content = `[{"bindings":{"ctrl-c":"editor::Copy"}}]`;
    expect(detectFormat('keybindings.json', content)).toBe('zed');
  });

  test('returns vscode for JSON array without context or bindings keys', () => {
    const content = `[{"key":"ctrl+c","command":"copy"}]`;
    expect(detectFormat('keybindings.json', content)).toBe('vscode');
  });

  test('returns unknown for malformed JSON array', () => {
    const content = `[{malformed`;
    expect(detectFormat('keybindings.json', content)).toBe('unknown');
  });

  test('strips line comments before parsing JSON', () => {
    const lineComment = '/' + '/ this is a comment';
    const content = `[
      ${lineComment}
      {"context":"Editor","bindings":{"ctrl-c":"editor::Copy"}}
    ]`;
    expect(detectFormat('keybindings.jsonc', content)).toBe('zed');
  });
});

test.describe('detectFormat — content-based detection without filename match', () => {
  test('detects krita from [shortcuts] section header in content', () => {
    const content = `[Shortcuts]\nfile_new=Ctrl+N\n`;
    expect(detectFormat('unknown.txt', content)).toBe('krita');
  });

  test('detects illustrator from tools and menu commands sections with shortcuts', () => {
    const content = `Tools\nSelection\tV\n\nMenu Commands\nFile\nNewCtrl+N`;
    expect(detectFormat('export.txt', content)).toBe('illustrator');
  });

  test('detects emacs from global-set-key expression', () => {
    const content = `(global-set-key (kbd "C-c C-c") 'comment-region)`;
    expect(detectFormat('unknown', content)).toBe('emacs');
  });

  test('detects emacs from define-key expression', () => {
    const content = `(define-key global-map (kbd "C-x C-f") 'find-file)`;
    expect(detectFormat('config', content)).toBe('emacs');
  });

  test('detects vim from noremap command in content', () => {
    const content = `nnoremap <C-s> :w<CR>`;
    expect(detectFormat('unknown', content)).toBe('vim');
  });

  test('detects vim from map command in content', () => {
    const content = `nmap <leader>f :Files<CR>`;
    expect(detectFormat('unknown', content)).toBe('vim');
  });

  test('falls back to unknown for unrecognized content', () => {
    const content = `some unrecognized content`;
    expect(detectFormat('unknown', content)).toBe('unknown');
  });

  test('illustrator detection requires both section markers and shortcut trait', () => {
    const content = `Tools\n\nMenu Commands\nFile\nNew`;
    expect(detectFormat('export.txt', content)).not.toBe('illustrator');
  });
});
