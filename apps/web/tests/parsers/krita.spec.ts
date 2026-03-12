// Test suite for the Krita parser covering .shortcuts file format, section detection,
// multi-variant shortcut splitting, disabled shortcut filtering, modifier normalization,
// special key aliases, and warning codes for malformed input.
import { test, expect } from '@playwright/test';
import { parseKrita } from '@keymap-highlight/file-parsers';
import { assertCanonicalStroke } from './helpers/stroke-contract';

test.describe('Krita Parser', () => {
  test.describe('metadata', () => {
    test('sets sourceEditor to krita', () => {
      const content = `[Shortcuts]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.metadata.sourceEditor).toBe('krita');
    });

    test('includes totalBindings and totalWarnings in metadata', () => {
      const content = `[Shortcuts]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.metadata.totalBindings).toBe(result.bindings.length);
      expect(result.metadata.totalWarnings).toBe(result.warnings.length);
    });
  });

  test.describe('section parsing', () => {
    test('parses bindings inside [Shortcuts] section', () => {
      const content = `[Shortcuts]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('file_new');
    });

    test('ignores entries in non-Shortcuts sections', () => {
      const content = `[General]\nauthor=Krita Team\n[Shortcuts]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('file_new');
    });

    test('emits KRITA_SHORTCUTS_SECTION_MISSING warning when no [Shortcuts] section found', () => {
      const content = `[General]\nauthor=Krita Team`;
      const result = parseKrita(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'KRITA_SHORTCUTS_SECTION_MISSING')).toBe(true);
    });

    test('parses entries before any section header when no sections present', () => {
      const content = `file_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('handles section name case-insensitively', () => {
      const content = `[SHORTCUTS]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('handles multiple sections and only processes [Shortcuts]', () => {
      const content = [
        '[General]',
        'version=5',
        '[Shortcuts]',
        'file_new=Ctrl+N',
        '[Extra]',
        'extra_key=Alt+X',
      ].join('\n');
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('file_new');
    });
  });

  test.describe('basic shortcut parsing', () => {
    test('parses Ctrl+N into ctrl modifier and n key', () => {
      const content = `[Shortcuts]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('n');
      expect(result.bindings[0].modifiers).toContain('ctrl');
    });

    test('parses Alt+F4 into alt modifier and f4 key', () => {
      const content = `[Shortcuts]\nclose_window=Alt+F4`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('f4');
      expect(result.bindings[0].modifiers).toContain('alt');
    });

    test('parses Ctrl+Shift+S into ctrl and shift modifiers', () => {
      const content = `[Shortcuts]\nfile_save_as=Ctrl+Shift+S`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('s');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].modifiers).toContain('shift');
    });

    test('preserves modifier order as ctrl then shift', () => {
      const content = `[Shortcuts]\nfile_save_as=Shift+Ctrl+S`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift']);
    });

    test('parses shortcut with no modifiers (single key)', () => {
      const content = `[Shortcuts]\ntool_brush=B`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('b');
      expect(result.bindings[0].modifiers).toEqual([]);
    });

    test('sets chords to empty array and sourceEditor to krita', () => {
      const content = `[Shortcuts]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      assertCanonicalStroke(result.bindings[0], { key: 'n', modifiers: ['ctrl'] });
      expect(result.bindings[0].sourceEditor).toBe('krita');
    });

    test('sets when to empty string', () => {
      const content = `[Shortcuts]\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].when).toBe('');
    });
  });

  test.describe('multi-variant shortcut splitting', () => {
    test('parses two shortcut variants separated by semicolon', () => {
      const content = `[Shortcuts]\nview_zoom_in=Ctrl+=; Ctrl++`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(2);
      const zoomEquals = result.bindings.find((b) => b.key === '=');
      expect(zoomEquals).toBeDefined();
      expect(zoomEquals?.modifiers).toContain('ctrl');
      const zoomPlus = result.bindings.find((b) => b.key === '+');
      expect(zoomPlus).toBeDefined();
      expect(zoomPlus?.modifiers).toContain('ctrl');
    });

    test('produces one binding per variant sharing the same command', () => {
      const content = `[Shortcuts]\nview_zoom_in=Ctrl+=; Ctrl++`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.every((b) => b.command === 'view_zoom_in')).toBe(true);
    });

    test('parses Alt+Shift++ as plus key with alt and shift modifiers', () => {
      const content = `[Shortcuts]\ntoggle_display=Alt+Shift++`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('+');
      expect(result.bindings[0].modifiers).toEqual(['shift', 'alt']);
    });

    test('handles Ctrl+Shift+; as semicolon key binding', () => {
      const content = `[Shortcuts]\nview_snap_to_grid=Ctrl+Shift+;`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe(';');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift']);
    });
  });

  test.describe('disabled shortcut handling', () => {
    test('skips entry with shortcut value none', () => {
      const content = `[Shortcuts]\nfile_open=none`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(0);
    });

    test('skips entry with empty shortcut value', () => {
      const content = `[Shortcuts]\nfile_open=`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(0);
    });

    test('does not emit a warning for disabled none shortcut', () => {
      const content = `[Shortcuts]\nfile_open=none`;
      const result = parseKrita(content, 'windows');
      expect(result.warnings.length).toBe(0);
    });
  });

  test.describe('special key aliases', () => {
    test('Esc normalizes to escape', () => {
      const content = `[Shortcuts]\ntool_cancel=Esc`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('escape');
    });

    test('Del normalizes to delete', () => {
      const content = `[Shortcuts]\ndelete_layer=Del`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('delete');
    });

    test('Ins normalizes to insert', () => {
      const content = `[Shortcuts]\ntoggle_insert=Ins`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('insert');
    });

    test('Return normalizes to enter', () => {
      const content = `[Shortcuts]\nconfirm=Return`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('enter');
    });

    test('PgUp normalizes to pageup', () => {
      const content = `[Shortcuts]\nscroll_up=PgUp`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('pageup');
    });

    test('PgDown normalizes to pagedown', () => {
      const content = `[Shortcuts]\nscroll_down=PgDown`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('pagedown');
    });

    test('Spacebar normalizes to space', () => {
      const content = `[Shortcuts]\npan_canvas=Spacebar`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings[0].key).toBe('space');
    });
  });

  test.describe('comment and whitespace handling', () => {
    test('ignores lines starting with # comment', () => {
      const content = `[Shortcuts]\n# This is a comment\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('ignores lines starting with ; comment', () => {
      const content = `[Shortcuts]\n; This is a comment\nfile_new=Ctrl+N`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('ignores blank lines', () => {
      const content = `[Shortcuts]\n\nfile_new=Ctrl+N\n\n`;
      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });
  });

  test.describe('warning codes', () => {
    test('emits KRITA_EMPTY_CONTENT warning for empty content', () => {
      const result = parseKrita('', 'windows');
      expect(result.warnings.some((w) => w.code === 'KRITA_EMPTY_CONTENT')).toBe(true);
    });

    test('emits KRITA_ENTRY_INVALID warning for malformed line', () => {
      const content = `[Shortcuts]\nthis line is malformed`;
      const result = parseKrita(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'KRITA_ENTRY_INVALID')).toBe(true);
    });

    test('emits KRITA_SHORTCUT_INVALID warning for unsupported modifier token', () => {
      const content = `[Shortcuts]\ninvalid_shortcut=Ctrl+Unknown+K`;
      const result = parseKrita(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'KRITA_SHORTCUT_INVALID')).toBe(true);
    });

    test('emits KRITA_SHORTCUTS_SECTION_MISSING when file has sections but not [Shortcuts]', () => {
      const content = `[General]\nauthor=Test`;
      const result = parseKrita(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'KRITA_SHORTCUTS_SECTION_MISSING')).toBe(true);
    });

    test('includes line number in KRITA_ENTRY_INVALID warning', () => {
      const content = `[Shortcuts]\nthis line is malformed`;
      const result = parseKrita(content, 'windows');
      const warning = result.warnings.find((w) => w.code === 'KRITA_ENTRY_INVALID');
      expect(warning?.line).toBeDefined();
    });

    test('includes line number in KRITA_SHORTCUT_INVALID warning', () => {
      const content = `[Shortcuts]\nbad_action=Ctrl+Unknown+K`;
      const result = parseKrita(content, 'windows');
      const warning = result.warnings.find((w) => w.code === 'KRITA_SHORTCUT_INVALID');
      expect(warning?.line).toBeDefined();
    });
  });

  test.describe('real-world shortcut block', () => {
    test('parses a realistic [Shortcuts] block correctly', () => {
      const content = [
        '[Shortcuts]',
        'file_new=Ctrl+N',
        'file_open=Ctrl+O',
        'file_save=Ctrl+S',
        'file_save_as=Ctrl+Shift+S',
        'view_zoom_in=Ctrl+=; Ctrl++',
        'view_zoom_out=Ctrl+-',
        'tool_brush=B',
        'tool_cancel=Esc',
      ].join('\n');

      const result = parseKrita(content, 'windows');
      expect(result.bindings.length).toBe(9);
      expect(result.warnings.length).toBe(0);

      const fileNew = result.bindings.find((b) => b.command === 'file_new');
      expect(fileNew?.key).toBe('n');
      expect(fileNew?.modifiers).toContain('ctrl');

      const toolBrush = result.bindings.find((b) => b.command === 'tool_brush');
      expect(toolBrush?.key).toBe('b');
      expect(toolBrush?.modifiers).toEqual([]);
    });
  });
});
