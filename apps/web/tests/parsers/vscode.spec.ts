// Tests for VS Code parser — covering chord sequences, OS-specific key resolution,
// special key alias normalization, modifier variants, and invalid entry handling.
import { test, expect } from '@playwright/test';
import { parseVSCode } from '@keymap-highlight/file-parsers';
import { assertCanonicalStroke } from './helpers/stroke-contract';

test.describe('VS Code Parser', () => {
  test.describe('metadata', () => {
    test('sets sourceEditor to vscode', () => {
      const json = `[{ "key": "ctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.metadata.sourceEditor).toBe('vscode');
    });

    test('reports totalBindings and totalWarnings in metadata', () => {
      const json = `[
        { "key": "ctrl+a", "command": "selectAll" },
        { "key": "ctrl+z", "command": "undo" }
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.metadata.totalBindings).toBe(2);
      expect(result.metadata.totalWarnings).toBe(0);
    });

    test('parsedAt is a valid ISO timestamp string', () => {
      const json = `[{ "key": "ctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'windows');
      expect(() => new Date(result.metadata.parsedAt)).not.toThrow();
      expect(new Date(result.metadata.parsedAt).toISOString()).toBe(result.metadata.parsedAt);
    });
  });

  test.describe('simple binding parsing', () => {
    test('parses key, command, and when from a single binding', () => {
      const json = `[
        {
          "key": "ctrl+c",
          "command": "editor.action.clipboardCopyAction",
          "when": "textInputFocus"
        }
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('editor.action.clipboardCopyAction');
      expect(result.bindings[0].key).toBe('c');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
      expect(result.bindings[0].when).toBe('textInputFocus');
      expect(result.bindings[0].chords).toEqual([]);
    });

    test('sets sourceEditor to vscode on every binding', () => {
      const json = `[{ "key": "ctrl+s", "command": "workbench.action.files.save" }]`;
      const result = parseVSCode(json, 'linux');
      expect(result.bindings[0].sourceEditor).toBe('vscode');
    });

    test('normalizes when to empty string when absent', () => {
      const json = `[{ "key": "ctrl+z", "command": "undo" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].when).toBe('');
    });

    test('trims whitespace from when clause', () => {
      const json = `[{ "key": "ctrl+z", "command": "undo", "when": "  editorTextFocus  " }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].when).toBe('editorTextFocus');
    });

    test('preserves multiple bindings', () => {
      const json = `[
        { "key": "ctrl+c", "command": "copy" },
        { "key": "ctrl+v", "command": "paste" },
        { "key": "ctrl+x", "command": "cut" }
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(3);
    });
  });

  test.describe('multi-chord (chord sequence) parsing', () => {
    test('parses two-chord sequence into key, modifiers, and chords array', () => {
      const json = `[
        {
          "key": "ctrl+k ctrl+b",
          "command": "workbench.action.toggleSidebarVisibility"
        }
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(1);
      assertCanonicalStroke(result.bindings[0], {
        key: 'k',
        modifiers: ['ctrl'],
        chords: [{ key: 'b', modifiers: ['ctrl'] }],
      });
    });

    test('parses three-chord sequence correctly', () => {
      const json = `[
        {
          "key": "ctrl+k ctrl+shift+l ctrl+m",
          "command": "multi.chord.action"
        }
      ]`;
      const result = parseVSCode(json, 'windows');
      assertCanonicalStroke(result.bindings[0], {
        key: 'k',
        modifiers: ['ctrl'],
        chords: [
          { key: 'l', modifiers: ['ctrl', 'shift'] },
          { key: 'm', modifiers: ['ctrl'] },
        ],
      });
    });

    test('chord sequence on macos resolves ctrl modifier per stroke', () => {
      const json = `[{ "key": "ctrl+k ctrl+b", "command": "toggle" }]`;
      const result = parseVSCode(json, 'macos');
      assertCanonicalStroke(result.bindings[0], {
        key: 'k',
        modifiers: ['ctrl'],
        chords: [{ key: 'b', modifiers: ['ctrl'] }],
      });
    });
  });

  test.describe('OS-specific key resolution', () => {
    test('uses mac-specific key when os is macos and mac property is present', () => {
      const json = `[{
        "key": "ctrl+c",
        "mac": "cmd+c",
        "command": "copy"
      }]`;
      const result = parseVSCode(json, 'macos');
      expect(result.bindings[0].modifiers).toEqual(['meta']);
      expect(result.bindings[0].key).toBe('c');
    });

    test('uses win-specific key when os is windows and win property is present', () => {
      const json = `[{
        "key": "ctrl+c",
        "win": "ctrl+shift+c",
        "command": "copy"
      }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift']);
      expect(result.bindings[0].key).toBe('c');
    });

    test('uses linux-specific key when os is linux and linux property is present', () => {
      const json = `[{
        "key": "ctrl+c",
        "linux": "ctrl+alt+c",
        "command": "copy"
      }]`;
      const result = parseVSCode(json, 'linux');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'alt']);
      expect(result.bindings[0].key).toBe('c');
    });

    test('falls back to key property when OS-specific property is absent', () => {
      const json = `[{ "key": "ctrl+z", "command": "undo" }]`;
      const resultWin = parseVSCode(json, 'windows');
      const resultMac = parseVSCode(json, 'macos');
      const resultLinux = parseVSCode(json, 'linux');
      expect(resultWin.bindings[0].key).toBe('z');
      expect(resultMac.bindings[0].key).toBe('z');
      expect(resultLinux.bindings[0].key).toBe('z');
    });

    test('falls back to key property when OS-specific property is an empty string', () => {
      const json = `[{ "key": "ctrl+z", "mac": "", "command": "undo" }]`;
      const result = parseVSCode(json, 'macos');
      expect(result.bindings[0].key).toBe('z');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('ctrlcmd resolves to meta on macos', () => {
      const json = `[{ "key": "ctrlcmd+s", "command": "save" }]`;
      const result = parseVSCode(json, 'macos');
      expect(result.bindings[0].modifiers).toEqual(['meta']);
    });

    test('ctrlcmd resolves to ctrl on windows', () => {
      const json = `[{ "key": "ctrlcmd+s", "command": "save" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('ctrlcmd resolves to ctrl on linux', () => {
      const json = `[{ "key": "ctrlcmd+s", "command": "save" }]`;
      const result = parseVSCode(json, 'linux');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('cmdorctrl resolves to meta on macos', () => {
      const json = `[{ "key": "cmdorctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'macos');
      expect(result.bindings[0].modifiers).toEqual(['meta']);
    });

    test('cmdorctrl resolves to ctrl on windows', () => {
      const json = `[{ "key": "cmdorctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('winctrl resolves to ctrl on macos', () => {
      const json = `[{ "key": "winctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'macos');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('winctrl resolves to meta on windows', () => {
      const json = `[{ "key": "winctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['meta']);
    });

    test('winctrl resolves to meta on linux', () => {
      const json = `[{ "key": "winctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'linux');
      expect(result.bindings[0].modifiers).toEqual(['meta']);
    });

    test('altgr is normalized to alt', () => {
      const json = `[{ "key": "altgr+e", "command": "euro" }]`;
      const result = parseVSCode(json, 'linux');
      expect(result.bindings[0].modifiers).toEqual(['alt']);
    });
  });

  test.describe('modifier ordering', () => {
    test('modifiers follow canonical order ctrl < shift < alt < meta', () => {
      const json = `[{ "key": "meta+alt+shift+ctrl+a", "command": "multimod" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift', 'alt', 'meta']);
    });

    test('duplicate modifier tokens are deduplicated', () => {
      const json = `[{ "key": "ctrl+ctrl+a", "command": "doubleCtrl" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });
  });

  test.describe('special key alias normalization', () => {
    test('normalizes oem_plus to equals sign', () => {
      const json = `[{ "key": "ctrl+oem_plus", "command": "zoomIn" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('=');
    });

    test('normalizes oem_minus to hyphen', () => {
      const json = `[{ "key": "ctrl+oem_minus", "command": "zoomOut" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('-');
    });

    test('normalizes oem_1 to semicolon', () => {
      const json = `[{ "key": "shift+oem_1", "command": "semicolonCommand" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe(';');
    });

    test('normalizes oem_3 to backtick', () => {
      const json = `[{ "key": "ctrl+oem_3", "command": "openTerminal" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('`');
    });

    test('normalizes minus to hyphen key', () => {
      const json = `[{ "key": "ctrl+minus", "command": "zoomOut" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('-');
    });

    test('normalizes plus standalone to plus symbol', () => {
      const json = `[{ "key": "ctrl+plus", "command": "zoomIn" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('+');
    });

    test('normalizes slash to forward slash', () => {
      const json = `[{ "key": "ctrl+slash", "command": "search" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('/');
    });

    test('handles literal plus as key via ++ syntax', () => {
      const json = `[{ "key": "ctrl++", "command": "zoomIn" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('+');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });
  });

  test.describe('invalid entry handling and warnings', () => {
    test('skips non-object entry and adds warning with code VSCODE_ENTRY_NOT_OBJECT', () => {
      const json = `["notAnObject", { "key": "ctrl+a", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.warnings.some((w) => w.code === 'VSCODE_ENTRY_NOT_OBJECT')).toBe(true);
    });

    test('skips entry without command and adds warning with code VSCODE_COMMAND_INVALID', () => {
      const json = `[{ "key": "ctrl+a" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'VSCODE_COMMAND_INVALID')).toBe(true);
    });

    test('skips entry with command set to "-" (unbind) and adds warning', () => {
      const json = `[{ "key": "ctrl+a", "command": "-" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'VSCODE_COMMAND_INVALID')).toBe(true);
    });

    test('skips entry with non-string command and adds warning', () => {
      const json = `[{ "key": "ctrl+a", "command": 42 }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'VSCODE_COMMAND_INVALID')).toBe(true);
    });

    test('skips entry without key and adds warning with code VSCODE_KEY_MISSING', () => {
      const json = `[{ "command": "selectAll" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'VSCODE_KEY_MISSING')).toBe(true);
    });

    test('skips entry with empty key string and adds warning', () => {
      const json = `[{ "key": "   ", "command": "selectAll" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'VSCODE_KEY_MISSING')).toBe(true);
    });

    test('skips entry with unknown modifier in key expression', () => {
      const json = `[{ "key": "hyper+a", "command": "superAction" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'VSCODE_KEY_EXPRESSION_INVALID')).toBe(true);
    });

    test('skips entry when key token resolves to empty string', () => {
      const json = `[{ "key": "ctrl+", "command": "badKey" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('valid entries are still parsed when mixed with invalid ones', () => {
      const json = `[
        { "command": "bad" },
        { "key": "ctrl+s", "command": "save" }
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('save');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  test.describe('root shape validation', () => {
    test('returns empty bindings and warning when root is an object not an array', () => {
      const json = `{ "key": "ctrl+c", "command": "copy" }`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'VSCODE_ROOT_NOT_ARRAY')).toBe(true);
    });

    test('returns empty bindings and warning when root is a string', () => {
      const json = `"notAnArray"`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('returns empty bindings for completely empty array', () => {
      const json = `[]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    test('handles invalid JSONC and adds parse warning', () => {
      const json = `[{ "key": "ctrl+c"  ]`;
      const result = parseVSCode(json, 'linux');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  test.describe('JSONC features', () => {
    test('parses JSONC with trailing commas', () => {
      const json = `[
        { "key": "ctrl+a", "command": "selectAll", },
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('parses JSONC with line comments', () => {
      const lineComment = '/'+ '/ This is a copy binding';
      const json = `[
        ${lineComment}
        { "key": "ctrl+c", "command": "copy" }
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('copy');
    });

    test('parses JSONC with block comments', () => {
      const json = `[
        /* copy action */
        { "key": "ctrl+c", "command": "copy" }
      ]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings.length).toBe(1);
    });
  });

  test.describe('key expression edge cases', () => {
    test('parses function key f1', () => {
      const json = `[{ "key": "f1", "command": "help" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('f1');
      expect(result.bindings[0].modifiers).toEqual([]);
    });

    test('parses shift+f12 correctly', () => {
      const json = `[{ "key": "shift+f12", "command": "findAllReferences" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('f12');
      expect(result.bindings[0].modifiers).toEqual(['shift']);
    });

    test('parses escape key', () => {
      const json = `[{ "key": "escape", "command": "cancelSelection" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('escape');
    });

    test('parses key expression case-insensitively', () => {
      const json = `[{ "key": "Ctrl+Shift+A", "command": "action" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('a');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift']);
    });

    test('parses key with no modifiers', () => {
      const json = `[{ "key": "f5", "command": "run" }]`;
      const result = parseVSCode(json, 'windows');
      expect(result.bindings[0].key).toBe('f5');
      expect(result.bindings[0].modifiers).toEqual([]);
      expect(result.bindings[0].chords).toEqual([]);
    });
  });
});
