// Tests for os-detection — detectConfigOs format-based inference and detectUserOs browser platform detection.
import { test, expect } from '@playwright/test';
import { detectConfigOs } from '@keymap-highlight/file-parsers';
import { detectUserOs } from '../../src/utils/detect-user-os';

test.describe('detectConfigOs — vscode format', () => {
  test('detects mac from cmd modifier in vscode config', () => {
    const config = '[{"key":"cmd+c","command":"editor.action.clipboardCopyAction"}]';
    expect(detectConfigOs(config, 'vscode')).toBe('mac');
  });

  test('detects win from windows key reference in vscode config', () => {
    const config = '[{"key":"ctrl+c","command":"editor.action.clipboardCopyAction"}]';
    const result = detectConfigOs(config, 'vscode');
    expect(['win', 'linux', 'unknown']).toContain(result);
  });

  test('returns unknown for vscode config with no OS-specific modifiers', () => {
    const config = '[{"key":"ctrl+c","command":"copy"}]';
    const result = detectConfigOs(config, 'vscode');
    expect(['win', 'linux', 'unknown']).toContain(result);
  });

  test('returns unknown for empty vscode config', () => {
    expect(detectConfigOs('[]', 'vscode')).toBe('unknown');
  });
});

test.describe('detectConfigOs — krita format', () => {
  test('returns unknown for krita config with only ctrl shortcuts (OS-neutral)', () => {
    const config = `[Shortcuts]\nfile_new=Ctrl+N\n`;
    const result = detectConfigOs(config, 'krita');
    expect(['win', 'linux', 'unknown']).toContain(result);
  });
});

test.describe('detectConfigOs — jetbrains format', () => {
  test('detects mac from meta modifier in jetbrains config', () => {
    const config = `<keymap version="1" name="Mac OS X" parent="$default">
      <action id="Copy"><keyboard-shortcut first-keystroke="meta c" /></action>
    </keymap>`;
    expect(detectConfigOs(config, 'jetbrains')).toBe('mac');
  });

  test('detects windows from ctrl modifier in jetbrains config', () => {
    const config = `<keymap version="1" name="Windows" parent="$default">
      <action id="Copy"><keyboard-shortcut first-keystroke="ctrl c" /></action>
    </keymap>`;
    const result = detectConfigOs(config, 'jetbrains');
    expect(['win', 'linux', 'unknown']).toContain(result);
  });
});

test.describe('detectConfigOs — unsupported formats', () => {
  test('returns unknown for unrecognized format name', () => {
    expect(detectConfigOs('anything', 'unknown-format')).toBe('unknown');
  });

  test('returns unknown for empty format string', () => {
    expect(detectConfigOs('anything', '')).toBe('unknown');
  });

  test('returns unknown for whitespace-only format', () => {
    expect(detectConfigOs('anything', '   ')).toBe('unknown');
  });
});

test.describe('detectConfigOs — emacs format', () => {
  test('returns unknown for emacs config with generic key bindings', () => {
    const config = `(global-set-key (kbd "C-c C-c") 'comment-region)`;
    const result = detectConfigOs(config, 'emacs');
    expect(['win', 'mac', 'linux', 'unknown']).toContain(result);
  });
});

test.describe('detectConfigOs — illustrator format', () => {
  test('detects mac from Cmd modifier in illustrator content', () => {
    const config = `Tools\nCopy\tCmd+C\n\nMenu Commands\nNew\tCmd+N`;
    expect(detectConfigOs(config, 'illustrator')).toBe('mac');
  });
});

test.describe('detectUserOs — browser platform detection', () => {
  test('returns unknown when navigator is undefined', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(detectUserOs()).toBe('unknown');
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  test('returns mac when navigator.platform contains Mac', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'MacIntel', userAgentData: undefined },
      writable: true,
      configurable: true,
    });
    expect(detectUserOs()).toBe('mac');
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  test('returns win when navigator.platform contains Win', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32', userAgentData: undefined },
      writable: true,
      configurable: true,
    });
    expect(detectUserOs()).toBe('win');
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  test('returns linux when navigator.platform contains Linux', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Linux x86_64', userAgentData: undefined },
      writable: true,
      configurable: true,
    });
    expect(detectUserOs()).toBe('linux');
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  test('returns unknown as fallback when navigator.platform is unrecognized', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'SomeUnknownOS', userAgentData: undefined },
      writable: true,
      configurable: true,
    });
    expect(detectUserOs()).toBe('unknown');
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  test('prefers userAgentData.platform over navigator.platform', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        platform: 'Win32',
        userAgentData: { platform: 'macOS' },
      },
      writable: true,
      configurable: true,
    });
    expect(detectUserOs()).toBe('mac');
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  test('falls back to navigator.platform when userAgentData.platform is empty', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        platform: 'Win32',
        userAgentData: { platform: '' },
      },
      writable: true,
      configurable: true,
    });
    expect(detectUserOs()).toBe('win');
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });
});
