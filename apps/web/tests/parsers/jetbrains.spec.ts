// Tests for JetBrains parser — covering XML keymap parsing, OS-specific keymap selection,
// first/second keystroke handling, key alias normalization, and malformed input behavior.
import { test, expect } from '@playwright/test';
import { parseJetBrains } from '@keymap-highlight/file-parsers';
import { assertCanonicalStroke } from './helpers/stroke-contract';

test.describe('JetBrains Parser', () => {
  test.describe('metadata', () => {
    test('sets sourceEditor to jetbrains', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.metadata.sourceEditor).toBe('jetbrains');
    });

    test('reports totalBindings and totalWarnings in metadata', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
          <action id="EditorPaste">
            <keyboard-shortcut first-keystroke="ctrl v" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.metadata.totalBindings).toBe(2);
      expect(result.metadata.totalWarnings).toBe(0);
    });

    test('parsedAt is a valid ISO timestamp string', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(() => new Date(result.metadata.parsedAt)).not.toThrow();
      expect(new Date(result.metadata.parsedAt).toISOString()).toBe(result.metadata.parsedAt);
    });

    test('sets sourceName from keymap name attribute', () => {
      const xml = `
        <keymap version="1" name="MyCustomKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.metadata.sourceName).toBe('MyCustomKeymap');
    });
  });

  test.describe('simple binding parsing', () => {
    test('parses key, modifiers, and command from a single keystroke', () => {
      const xml = `
        <keymap version="1" name="MyKeymap" parent="$default">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('EditorCopy');
      expect(result.bindings[0].key).toBe('c');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
      expect(result.bindings[0].chords).toEqual([]);
      expect(result.bindings[0].when).toBe('');
    });

    test('sets sourceEditor to jetbrains on every binding', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorSave">
            <keyboard-shortcut first-keystroke="ctrl s" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'linux');
      expect(result.bindings[0].sourceEditor).toBe('jetbrains');
    });

    test('when is always empty string (JetBrains has no when-clause)', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].when).toBe('');
    });

    test('parses multiple shortcuts for one action as separate bindings', () => {
      const xml = `
        <keymap version="1" name="MyKeymap" parent="$default">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
            <keyboard-shortcut first-keystroke="ctrl insert" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(2);
      expect(result.bindings[0].command).toBe('EditorCopy');
      expect(result.bindings[1].command).toBe('EditorCopy');
    });

    test('parses multiple actions each with a shortcut', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
          <action id="EditorPaste">
            <keyboard-shortcut first-keystroke="ctrl v" />
          </action>
          <action id="EditorCut">
            <keyboard-shortcut first-keystroke="ctrl x" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(3);
    });
  });

  test.describe('first and second keystroke handling', () => {
    test('parses second-keystroke as a chord entry', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="GotoAction">
            <keyboard-shortcut first-keystroke="ctrl k" second-keystroke="ctrl b" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(1);
      assertCanonicalStroke(result.bindings[0], {
        key: 'k',
        modifiers: ['ctrl'],
        chords: [{ key: 'b', modifiers: ['ctrl'] }],
      });
    });

    test('second-keystroke with shift modifier is parsed correctly', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="GotoDeclaration">
            <keyboard-shortcut first-keystroke="ctrl b" second-keystroke="shift b" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].chords[0].key).toBe('b');
      expect(result.bindings[0].chords[0].modifiers).toEqual(['shift']);
    });

    test('shortcut without second-keystroke has empty chords array', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].chords).toEqual([]);
    });

    test('skips shortcut with invalid second-keystroke and adds warning with code INVALID_SECOND_KEYSTROKE', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="GotoAction">
            <keyboard-shortcut first-keystroke="ctrl k" second-keystroke="shift" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'INVALID_SECOND_KEYSTROKE')).toBe(true);
    });

    test('keystroke tokens typed/pressed/released are ignored (treated as noise)', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="TypedA">
            <keyboard-shortcut first-keystroke="typed a" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('a');
      expect(result.bindings[0].modifiers).toEqual([]);
    });
  });

  test.describe('OS-specific keymap selection', () => {
    test('picks Windows keymap over default when os is windows', () => {
      const xml = `
        <application>
          <keymap version="1" name="Default Keymap">
            <action id="Undo">
              <keyboard-shortcut first-keystroke="ctrl z" />
            </action>
          </keymap>
          <keymap version="1" name="Windows Keymap" parent="Default Keymap">
            <action id="Undo">
              <keyboard-shortcut first-keystroke="ctrl shift z" />
            </action>
          </keymap>
        </application>
      `;
      const result = parseJetBrains(xml, 'windows');
      const undoBinding = result.bindings.find((b) => b.command === 'Undo');
      expect(undoBinding).toBeDefined();
      expect(undoBinding?.modifiers).toEqual(['ctrl', 'shift']);
    });

    test('picks macOS keymap when os is macos', () => {
      const xml = `
        <application>
          <keymap version="1" name="Default Keymap">
            <action id="Undo">
              <keyboard-shortcut first-keystroke="ctrl z" />
            </action>
          </keymap>
          <keymap version="1" name="Mac OS X Keymap" parent="Default Keymap">
            <action id="Undo">
              <keyboard-shortcut first-keystroke="meta z" />
            </action>
          </keymap>
        </application>
      `;
      const result = parseJetBrains(xml, 'macos');
      const undoBinding = result.bindings.find((b) => b.command === 'Undo');
      expect(undoBinding).toBeDefined();
      expect(undoBinding?.modifiers).toEqual(['meta']);
    });

    test('picks linux keymap when os is linux', () => {
      const xml = `
        <application>
          <keymap version="1" name="Default Keymap">
            <action id="Run">
              <keyboard-shortcut first-keystroke="shift f10" />
            </action>
          </keymap>
          <keymap version="1" name="Linux Keymap" parent="Default Keymap">
            <action id="Run">
              <keyboard-shortcut first-keystroke="ctrl r" />
            </action>
          </keymap>
        </application>
      `;
      const result = parseJetBrains(xml, 'linux');
      const runBinding = result.bindings.find((b) => b.command === 'Run');
      expect(runBinding).toBeDefined();
      expect(runBinding?.modifiers).toEqual(['ctrl']);
    });

    test('uses single keymap when only one is present regardless of os', () => {
      const xml = `
        <keymap version="1" name="OnlyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const resultWin = parseJetBrains(xml, 'windows');
      const resultMac = parseJetBrains(xml, 'macos');
      expect(resultWin.bindings.length).toBe(1);
      expect(resultMac.bindings.length).toBe(1);
    });
  });

  test.describe('key alias normalization', () => {
    test('normalizes period to dot symbol', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="GotoNextError">
            <keyboard-shortcut first-keystroke="alt period" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('.');
    });

    test('normalizes comma to comma symbol', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="GotoPrevError">
            <keyboard-shortcut first-keystroke="alt comma" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe(',');
    });

    test('normalizes open_bracket to left bracket', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="FoldCode">
            <keyboard-shortcut first-keystroke="ctrl open_bracket" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('[');
    });

    test('normalizes close_bracket to right bracket', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="UnfoldCode">
            <keyboard-shortcut first-keystroke="ctrl close_bracket" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe(']');
    });

    test('normalizes back_slash to backslash symbol', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="Navigate">
            <keyboard-shortcut first-keystroke="ctrl back_slash" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('\\');
    });

    test('normalizes minus to hyphen symbol', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="ZoomOut">
            <keyboard-shortcut first-keystroke="ctrl minus" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('-');
    });

    test('normalizes equals to equals sign', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="ZoomIn">
            <keyboard-shortcut first-keystroke="ctrl equals" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('=');
    });

    test('normalizes back_quote to backtick symbol', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="OpenTerminal">
            <keyboard-shortcut first-keystroke="ctrl back_quote" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('`');
    });

    test('normalizes semicolon alias to semicolon symbol', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="SemicolonAction">
            <keyboard-shortcut first-keystroke="ctrl semicolon" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe(';');
    });

    test('normalizes altgr modifier to alt', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EuroSign">
            <keyboard-shortcut first-keystroke="altgr e" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'linux');
      expect(result.bindings[0].modifiers).toEqual(['alt']);
    });

    test('normalizes ctl modifier to ctrl', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });

    test('normalizes multiply to numpad_multiply', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="NumpadMultiply">
            <keyboard-shortcut first-keystroke="multiply" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('numpad_multiply');
    });
  });

  test.describe('modifier ordering', () => {
    test('modifiers follow canonical order ctrl < shift < alt < meta', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="MultiMod">
            <keyboard-shortcut first-keystroke="meta alt shift ctrl a" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'shift', 'alt', 'meta']);
    });

    test('duplicate modifier tokens are deduplicated', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="DoubleCtrl">
            <keyboard-shortcut first-keystroke="ctrl ctrl a" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });
  });

  test.describe('invalid entry handling and warnings', () => {
    test('skips action without id and adds warning with code MISSING_ACTION_ID', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action>
            <keyboard-shortcut first-keystroke="ctrl a" />
          </action>
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.warnings.some((w) => w.code === 'MISSING_ACTION_ID')).toBe(true);
    });

    test('skips shortcut missing first-keystroke and adds warning with code MISSING_FIRST_KEYSTROKE', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'MISSING_FIRST_KEYSTROKE')).toBe(true);
    });

    test('skips shortcut with invalid first-keystroke and adds warning with code INVALID_FIRST_KEYSTROKE', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="BadAction">
            <keyboard-shortcut first-keystroke="shift" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'INVALID_FIRST_KEYSTROKE')).toBe(true);
    });

    test('valid shortcuts are still parsed when mixed with invalid ones', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="BadAction">
            <keyboard-shortcut />
          </action>
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="ctrl c" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('EditorCopy');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('action with no keyboard-shortcut children produces no bindings', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="NoShortcutAction">
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });
  });

  test.describe('root shape and content validation', () => {
    test('returns empty bindings and warning with code EMPTY_CONTENT for empty input', () => {
      const result = parseJetBrains('', 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'EMPTY_CONTENT')).toBe(true);
    });

    test('returns empty bindings and warning with code EMPTY_CONTENT for whitespace-only input', () => {
      const result = parseJetBrains('   \n\t  ', 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'EMPTY_CONTENT')).toBe(true);
    });

    test('returns warning with code NO_KEYMAP when no keymap node is found', () => {
      const xml = `<application><settings /></application>`;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'NO_KEYMAP')).toBe(true);
    });

    test('handles malformed XML gracefully with warning code INVALID_XML', () => {
      const xml = `<keymap version="1" name="Bad"<action id="X">`;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'INVALID_XML')).toBe(true);
    });
  });

  test.describe('special keystroke patterns', () => {
    test('parses function key f5', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="Run">
            <keyboard-shortcut first-keystroke="f5" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('f5');
      expect(result.bindings[0].modifiers).toEqual([]);
    });

    test('parses shift+f12 for findAllReferences', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="FindUsages">
            <keyboard-shortcut first-keystroke="shift f12" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('f12');
      expect(result.bindings[0].modifiers).toEqual(['shift']);
    });

    test('parses ctrl+alt+s for settings', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="ShowSettings">
            <keyboard-shortcut first-keystroke="ctrl alt s" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('s');
      expect(result.bindings[0].modifiers).toEqual(['ctrl', 'alt']);
    });

    test('parses keystroke case-insensitively', () => {
      const xml = `
        <keymap version="1" name="MyKeymap">
          <action id="EditorCopy">
            <keyboard-shortcut first-keystroke="Ctrl C" />
          </action>
        </keymap>
      `;
      const result = parseJetBrains(xml, 'windows');
      expect(result.bindings[0].key).toBe('c');
      expect(result.bindings[0].modifiers).toEqual(['ctrl']);
    });
  });
});
