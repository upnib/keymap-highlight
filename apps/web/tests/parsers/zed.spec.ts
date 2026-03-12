// Tests for Zed parser — covering context blocks, hyphen-separator chord parsing,
// command format variants (string/array/object/null), multi-chord sequences, and invalid input handling.
import { test, expect } from '@playwright/test';
import { parseZed } from '@keymap-highlight/file-parsers';
import { assertCanonicalStroke } from './helpers/stroke-contract';

test.describe('Zed Parser', () => {
  test.describe('metadata', () => {
    test('sets sourceEditor to zed', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-a": "editor::SelectAll" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.metadata.sourceEditor).toBe('zed');
    });

    test('reports totalBindings and totalWarnings in metadata', () => {
      const json = `[{
        "context": "Editor",
        "bindings": {
          "ctrl-c": "editor::Copy",
          "ctrl-v": "editor::Paste"
        }
      }]`;
      const result = parseZed(json, 'windows');
      expect(result.metadata.totalBindings).toBe(2);
      expect(result.metadata.totalWarnings).toBe(0);
    });

    test('parsedAt is a valid ISO timestamp string', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-a": "editor::SelectAll" } }]`;
      const result = parseZed(json, 'windows');
      expect(() => new Date(result.metadata.parsedAt)).not.toThrow();
      expect(new Date(result.metadata.parsedAt).toISOString()).toBe(result.metadata.parsedAt);
    });
  });

  test.describe('simple binding parsing', () => {
    test('parses key, modifiers, command, and when from a context block', () => {
      const json = `[
        {
          "context": "Editor",
          "bindings": {
            "ctrl-c": "editor::Copy"
          }
        }
      ]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('editor::Copy');
      expect(result.bindings[0].key).toBe('c');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
      expect(result.bindings[0].when).toBe('Editor');
      expect(result.bindings[0].chords).toEqual([]);
    });

    test('sets sourceEditor to zed on every binding', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-s": "editor::Save" } }]`;
      const result = parseZed(json, 'linux');
      expect(result.bindings[0].sourceEditor).toBe('zed');
    });

    test('uses empty string when context is missing', () => {
      const json = `[{ "bindings": { "ctrl-a": "editor::SelectAll" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].when).toBe('');
    });

    test('trims whitespace from context string', () => {
      const json = `[{ "context": "  Editor  ", "bindings": { "ctrl-a": "editor::SelectAll" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].when).toBe('Editor');
    });

    test('parses multiple bindings in a single context block', () => {
      const json = `[{
        "context": "Editor",
        "bindings": {
          "ctrl-c": "editor::Copy",
          "ctrl-v": "editor::Paste",
          "ctrl-x": "editor::Cut"
        }
      }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(3);
    });

    test('parses bindings from multiple context blocks', () => {
      const json = `[
        { "context": "Editor", "bindings": { "ctrl-c": "editor::Copy" } },
        { "context": "Workspace", "bindings": { "ctrl-n": "workspace::NewFile" } }
      ]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(2);
      expect(result.bindings[0].when).toBe('Editor');
      expect(result.bindings[1].when).toBe('Workspace');
    });
  });

  test.describe('command format variations', () => {
    test('parses string command', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-a": "editor::SelectAll" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].command).toBe('editor::SelectAll');
    });

    test('parses array command using first element', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-f": ["editor::Find", { "focus": true }] } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('editor::Find');
    });

    test('parses object command using command property', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-g": { "command": "editor::GoToLine" } } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('editor::GoToLine');
    });

    test('silently skips null command (unbind)', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-z": null } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    test('skips empty string command and adds warning with code ZED_INVALID_COMMAND', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-a": "" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_COMMAND')).toBe(true);
    });

    test('skips array command with non-string first element and adds warning', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-a": [42] } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_COMMAND')).toBe(true);
    });

    test('skips empty array command and adds warning', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-a": [] } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_COMMAND')).toBe(true);
    });

    test('skips numeric command and adds warning', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-a": 123 } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_COMMAND')).toBe(true);
    });
  });

  test.describe('multi-chord (chord sequence) parsing', () => {
    test('parses two-chord sequence into key, modifiers, and chords array', () => {
      const json = `[{
        "context": "Editor",
        "bindings": {
          "ctrl-k ctrl-b": "editor::ToggleSidebar"
        }
      }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      assertCanonicalStroke(result.bindings[0], {
        key: 'k',
        modifiers: ['ctrl'],
        chords: [{ key: 'b', modifiers: ['ctrl'] }],
      });
    });

    test('parses three-chord sequence with correct structure', () => {
      const json = `[{
        "context": "Editor",
        "bindings": {
          "ctrl-k ctrl-shift-l ctrl-m": "multi.action"
        }
      }]`;
      const result = parseZed(json, 'windows');
      assertCanonicalStroke(result.bindings[0], {
        key: 'k',
        modifiers: ['ctrl'],
        chords: [
          { key: 'l', modifiers: ['ctrl', 'shift'] },
          { key: 'm', modifiers: ['ctrl'] },
        ],
      });
    });
  });

  test.describe('OS-specific mod key resolution', () => {
    test('mod resolves to meta on macos', () => {
      const json = `[{ "context": "Editor", "bindings": { "mod-s": "editor::Save" } }]`;
      const result = parseZed(json, 'macos');
      expect(result.bindings[0].modifiers).toEqual(['meta']);
    });

    test('mod resolves to ctrl on windows', () => {
      const json = `[{ "context": "Editor", "bindings": { "mod-s": "editor::Save" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('mod resolves to ctrl on linux', () => {
      const json = `[{ "context": "Editor", "bindings": { "mod-s": "editor::Save" } }]`;
      const result = parseZed(json, 'linux');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('ctrl modifier is preserved as-is on all OS targets', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-c": "editor::Copy" } }]`;
      const resultWin = parseZed(json, 'windows');
      const resultMac = parseZed(json, 'macos');
      expect(resultWin.bindings[0].modifiers).toEqual(['ctrl']);
      expect(resultMac.bindings[0].modifiers).toEqual(['ctrl']);
    });
  });

  test.describe('modifier ordering', () => {
    test('modifiers follow canonical order ctrl < shift < alt < meta', () => {
      const json = `[{ "context": "Editor", "bindings": { "meta-alt-shift-ctrl-a": "multimod" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift', 'alt', 'meta']);
    });

    test('duplicate modifiers are deduplicated', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-ctrl-a": "doubleCtrl" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });
  });

  test.describe('special key and hyphen-separator edge cases', () => {
    test('parses plus sign as literal key using ctrl--+', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl-+": "zoomIn" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('+');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('parses hyphen as literal key using ctrl--- syntax', () => {
      const json = `[{ "context": "Editor", "bindings": { "ctrl--": "zoomOut" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('-');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('parses function key f1 with no modifiers', () => {
      const json = `[{ "context": "Editor", "bindings": { "f1": "editor::Help" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].key).toBe('f1');
      expect(result.bindings[0].modifiers).toEqual([]);
    });

    test('parses escape key', () => {
      const json = `[{ "context": "Editor", "bindings": { "escape": "editor::Cancel" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].key).toBe('escape');
    });

    test('parses key expression case-insensitively', () => {
      const json = `[{ "context": "Editor", "bindings": { "Ctrl-Shift-A": "action" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings[0].key).toBe('a');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift']);
    });
  });

  test.describe('invalid entry handling and warnings', () => {
    test('skips non-object block and adds warning with code ZED_INVALID_BLOCK', () => {
      const json = `["notABlock", { "context": "Editor", "bindings": { "ctrl-a": "selectAll" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_BLOCK')).toBe(true);
    });

    test('skips block with missing bindings object and adds warning with code ZED_INVALID_BINDINGS', () => {
      const json = `[{ "context": "Editor" }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_BINDINGS')).toBe(true);
    });

    test('skips block with non-object bindings and adds warning with code ZED_INVALID_BINDINGS', () => {
      const json = `[{ "context": "Editor", "bindings": ["ctrl-a", "selectAll"] }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_BINDINGS')).toBe(true);
    });

    test('skips empty shortcut key and adds warning with code ZED_EMPTY_SHORTCUT', () => {
      const json = `[{ "context": "Editor", "bindings": { "": "editor::SelectAll" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_EMPTY_SHORTCUT')).toBe(true);
    });

    test('skips shortcut with invalid chord and adds warning with code ZED_INVALID_SHORTCUT', () => {
      const json = `[{ "context": "Editor", "bindings": { "hyper-z": "action" } }]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_INVALID_SHORTCUT')).toBe(true);
    });

    test('valid bindings are parsed even when mixed with invalid ones', () => {
      const json = `[
        { "context": "Editor", "bindings": { "": "bad", "ctrl-s": "editor::Save" } }
      ]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('editor::Save');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  test.describe('root shape validation', () => {
    test('returns empty bindings and warning with code ZED_ROOT_NOT_ARRAY when root is an object', () => {
      const json = `{ "context": "Editor", "bindings": {} }`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZED_ROOT_NOT_ARRAY')).toBe(true);
    });

    test('returns empty bindings and warning when root is a string', () => {
      const json = `"notAnArray"`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('returns empty bindings for empty array', () => {
      const json = `[]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    test('handles invalid JSONC and adds parse warning with code ZED_JSONC_PARSE_ERROR', () => {
      const json = `[{ "context": "Editor" `;
      const result = parseZed(json, 'linux');
      expect(result.warnings.some((w) => w.code === 'ZED_JSONC_PARSE_ERROR')).toBe(true);
    });
  });

  test.describe('JSONC features', () => {
    test('parses JSONC with trailing commas', () => {
      const json = `[
        { "context": "Editor", "bindings": { "ctrl-a": "selectAll", }, },
      ]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('parses JSONC with line comments', () => {
      const lineComment = '/' + '/ Editor bindings';
      const json = `[
        ${lineComment}
        { "context": "Editor", "bindings": { "ctrl-c": "editor::Copy" } }
      ]`;
      const result = parseZed(json, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('editor::Copy');
    });
  });
});
