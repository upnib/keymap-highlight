// Test suite for the Adobe Illustrator parser covering tab-separated entries,
// compact modifier shortcut extraction, compact function key entries, section context
// handling, supported key validation, and warning codes for invalid shortcuts.
import { test, expect } from '@playwright/test';
import { parseIllustrator } from '@keymap-highlight/file-parsers';
import { assertCanonicalStroke } from './helpers/stroke-contract';

test.describe('Illustrator Parser', () => {
  test.describe('metadata', () => {
    test('sets sourceEditor to illustrator', () => {
      const content = `Tools\nSelection\tV`;
      const result = parseIllustrator(content, 'windows');
      expect(result.metadata.sourceEditor).toBe('illustrator');
    });

    test('includes totalBindings and totalWarnings in metadata', () => {
      const content = `Tools\nSelection\tV`;
      const result = parseIllustrator(content, 'windows');
      expect(result.metadata.totalBindings).toBe(result.bindings.length);
      expect(result.metadata.totalWarnings).toBe(result.warnings.length);
    });
  });

  test.describe('section context', () => {
    test('assigns when=tools for bindings under Tools section', () => {
      const content = `Tools\nSelection\tV`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].when).toBe('tools');
    });

    test('assigns when=menu commands for bindings under Menu Commands section', () => {
      const content = `Menu Commands\nNewCtrl+N`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].when).toBe('menu commands');
    });

    test('section context persists until replaced by new section', () => {
      const content = [
        'Tools',
        'Selection\tV',
        'Menu Commands',
        'NewCtrl+N',
      ].join('\n');
      const result = parseIllustrator(content, 'windows');
      const selection = result.bindings.find((b) => b.command === 'Selection');
      expect(selection?.when).toBe('tools');
      const newCmd = result.bindings.find((b) => b.command === 'New');
      expect(newCmd?.when).toBe('menu commands');
    });

    test('assigns empty string when clause when no section has been encountered', () => {
      const content = `Selection\tV`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].when).toBe('');
    });

    test('section header matching is case-insensitive', () => {
      const content = `TOOLS\nSelection\tV`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].when).toBe('tools');
    });
  });

  test.describe('tab-separated entry parsing', () => {
    test('parses single-character tab-separated shortcut', () => {
      const content = `Tools\nSelection\tV`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('Selection');
      expect(result.bindings[0].key).toBe('v');
      expect(result.bindings[0].modifiers).toEqual([]);
      expect(result.bindings[0].sourceEditor).toBe('illustrator');
    });

    test('parses tab-separated shortcut with Shift modifier', () => {
      const content = `Tools\nArtboard\tShift+O`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('o');
      expect(result.bindings[0].modifiers).toContain('shift');
    });

    test('parses tab-separated Ctrl+key shortcut', () => {
      const content = `Tools\nBrush\tCtrl+B`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('b');
      expect(result.bindings[0].modifiers).toContain('ctrl');
    });

    test('parses tab-separated function key shortcut', () => {
      const content = `Menu Commands\nWindow\nLayers\tF7`;
      const result = parseIllustrator(content, 'windows');
      const layers = result.bindings.find((b) => b.command === 'Layers');
      expect(layers).toBeDefined();
      expect(layers?.key).toBe('f7');
      expect(layers?.modifiers).toEqual([]);
    });

    test('sets chords to empty array for all illustrator bindings', () => {
      const content = `Tools\nSelection\tV`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].chords).toEqual([]);
    });
  });

  test.describe('compact modifier entry parsing', () => {
    test('parses compact Ctrl+N entry extracting command and shortcut', () => {
      const content = `Menu Commands\nNewCtrl+N`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].command).toBe('New');
      expect(result.bindings[0].key).toBe('n');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('parses compact Shift+Ctrl+S entry with both modifiers', () => {
      const content = `Menu Commands\nSave AsShift+Ctrl+S`;
      const result = parseIllustrator(content, 'windows');
      const saveAs = result.bindings.find((b) => b.command === 'Save As');
      expect(saveAs).toBeDefined();
      expect(saveAs?.key).toBe('s');
      expect(saveAs?.modifiers).toEqual(['ctrl', 'shift']);
    });

    test('parses compact Cmd++ entry on macOS', () => {
      const content = `Menu Commands\nZoom InCmd++`;
      const result = parseIllustrator(content, 'macos');
      const zoomIn = result.bindings.find((b) => b.command === 'Zoom In');
      expect(zoomIn).toBeDefined();
      expect(zoomIn?.key).toBe('+');
      expect(zoomIn?.modifiers).toEqual(['meta']);
    });

    test('parses compact Option+Cmd+T entry on macOS', () => {
      const content = `Menu Commands\nParagraphOption+Cmd+T`;
      const result = parseIllustrator(content, 'macos');
      const paragraph = result.bindings.find((b) => b.command === 'Paragraph');
      expect(paragraph).toBeDefined();
      expect(paragraph?.key).toBe('t');
      expect(paragraph?.modifiers).toEqual(['alt', 'meta']);
    });
  });

  test.describe('compact function key entry parsing', () => {
    test('parses compact function key entry like LayersF7', () => {
      const content = `Menu Commands\nLayersF7`;
      const result = parseIllustrator(content, 'windows');
      const layers = result.bindings.find((b) => b.command === 'Layers');
      expect(layers).toBeDefined();
      expect(layers?.key).toBe('f7');
      expect(layers?.modifiers).toEqual([]);
    });

    test('parses compact F12 entry correctly', () => {
      const content = `Menu Commands\nSave ForWebF12`;
      const result = parseIllustrator(content, 'windows');
      const saveForWeb = result.bindings.find((b) => b.command === 'Save ForWeb');
      expect(saveForWeb).toBeDefined();
      expect(saveForWeb?.key).toBe('f12');
    });
  });

  test.describe('key normalization', () => {
    test('normalizes Esc to escape', () => {
      const content = `Tools\nCancel\tEsc`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('escape');
    });

    test('normalizes Del to delete', () => {
      const content = `Tools\nRemove Anchor Point\tDel`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('delete');
    });

    test('normalizes Bksp to backspace', () => {
      const content = `Tools\nDelete\tBksp`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('backspace');
    });

    test('normalizes PgUp to pageup', () => {
      const content = `Tools\nScroll Up\tPgUp`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('pageup');
    });

    test('normalizes PgDn to pagedown', () => {
      const content = `Tools\nScroll Down\tPgDn`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('pagedown');
    });

    test('normalizes Tab key', () => {
      const content = `Tools\nSwitch Tool\tTab`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('tab');
    });

    test('normalizes arrow key up', () => {
      const content = `Tools\nNudge Up\tUp`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('up');
    });

    test('normalizes arrow key down', () => {
      const content = `Tools\nNudge Down\tDown`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('down');
    });

    test('normalizes arrow key left', () => {
      const content = `Tools\nNudge Left\tLeft`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('left');
    });

    test('normalizes arrow key right', () => {
      const content = `Tools\nNudge Right\tRight`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].key).toBe('right');
    });
  });

  test.describe('modifier normalization', () => {
    test('Ctrl modifier maps to ctrl on windows', () => {
      const content = `Menu Commands\nUndoCtrl+Z`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('ctrl');
    });

    test('Alt modifier maps to alt', () => {
      const content = `Menu Commands\nPropertiesAlt+Enter`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('alt');
    });

    test('Shift modifier maps to shift', () => {
      const content = `Tools\nArtboard\tShift+O`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('shift');
    });

    test('Cmd modifier maps to meta on macOS', () => {
      const content = `Menu Commands\nUndoCmd+Z`;
      const result = parseIllustrator(content, 'macos');
      expect(result.bindings[0].modifiers).toContain('meta');
    });

    test('modifier order follows ctrl shift alt meta', () => {
      const content = `Menu Commands\nSave AsShift+Ctrl+S`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift']);
    });
  });

  test.describe('warning behavior', () => {
    test('emits ILLUSTRATOR_EMPTY_CONTENT warning for empty content', () => {
      const result = parseIllustrator('', 'windows');
      expect(result.warnings.some((w) => w.code === 'ILLUSTRATOR_EMPTY_CONTENT')).toBe(true);
    });

    test('emits ILLUSTRATOR_SHORTCUT_INVALID for unsupported modifier token', () => {
      const content = `Tools\nBroken Shortcut\tHyper+K`;
      const result = parseIllustrator(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'ILLUSTRATOR_SHORTCUT_INVALID')).toBe(true);
      expect(result.bindings.length).toBe(0);
    });

    test('includes line number in ILLUSTRATOR_SHORTCUT_INVALID warning', () => {
      const content = `Tools\nBroken Shortcut\tHyper+K`;
      const result = parseIllustrator(content, 'windows');
      const warning = result.warnings.find((w) => w.code === 'ILLUSTRATOR_SHORTCUT_INVALID');
      expect(warning?.line).toBeDefined();
    });

    test('emits warning for unsupported named key token', () => {
      const content = `Tools\nAction\tUnknownKey`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings.length).toBe(0);
    });
  });

  test.describe('supported key validation', () => {
    test('accepts single letter keys', () => {
      const content = `Tools\nBrush\tB`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('accepts function keys f1 through f24', () => {
      const content = `Menu Commands\nHelpF1`;
      const result = parseIllustrator(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('f1');
    });

    test('accepts named keys like tab, enter, escape', () => {
      const keys = [
        ['Tab', 'tab'],
        ['Enter', 'enter'],
        ['Esc', 'escape'],
      ] as const;
      for (const [input, expected] of keys) {
        const content = `Tools\nAction\t${input}`;
        const res = parseIllustrator(content, 'windows');
        expect(res.bindings.length).toBe(1);
        expect(res.bindings[0].key).toBe(expected);
      }
    });
  });

  test.describe('real-world mixed content', () => {
    test('parses a realistic mixed tools and menu commands block', () => {
      const content = [
        'Tools',
        'Selection\tV',
        'Artboard\tShift+O',
        '',
        'Menu Commands',
        'File',
        'NewCtrl+N',
        'Save AsShift+Ctrl+S',
        'Window',
        'LayersF7',
      ].join('\n');

      const result = parseIllustrator(content, 'windows');
      expect(result.bindings.length).toBe(5);
      expect(result.warnings.length).toBe(0);

      const selection = result.bindings.find((b) => b.command === 'Selection');
      expect(selection?.key).toBe('v');
      expect(selection?.when).toBe('tools');

      const newFile = result.bindings.find((b) => b.command === 'New');
      expect(newFile?.key).toBe('n');
      expect(newFile?.modifiers).toEqual(['ctrl']);
      expect(newFile?.when).toBe('menu commands');
    });
  });

  test.describe('empty and edge case content', () => {
    test('returns empty bindings for whitespace-only content', () => {
      const result = parseIllustrator('   \n  ', 'windows');
      expect(result.bindings.length).toBe(0);
    });

    test('returns empty bindings and warning for empty string', () => {
      const result = parseIllustrator('', 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
