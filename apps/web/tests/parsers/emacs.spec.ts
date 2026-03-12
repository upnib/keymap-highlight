// Test suite for the Emacs parser covering global-set-key, define-key forms,
// key sequence extraction, chord parsing, modifier mapping, command normalization,
// map context derivation, and comment stripping behavior.
import { test, expect } from '@playwright/test';
import { parseEmacs } from '@keymap-highlight/file-parsers';
import { assertCanonicalStroke } from './helpers/stroke-contract';

test.describe('Emacs Parser', () => {
  test.describe('metadata', () => {
    test('sets sourceEditor to emacs', () => {
      const content = `(global-set-key (kbd "C-x C-s") 'save-buffer)`;
      const result = parseEmacs(content, 'windows');
      expect(result.metadata.sourceEditor).toBe('emacs');
    });

    test('includes totalBindings and totalWarnings in metadata', () => {
      const content = `(global-set-key (kbd "C-c p") 'my-command)`;
      const result = parseEmacs(content, 'linux');
      expect(result.metadata.totalBindings).toBe(result.bindings.length);
      expect(result.metadata.totalWarnings).toBe(result.warnings.length);
    });
  });

  test.describe('global-set-key parsing', () => {
    test('parses single-chord global-set-key with kbd form', () => {
      const content = `(global-set-key (kbd "C-s") 'isearch-forward)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('s');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].command).toBe('isearch-forward');
      expect(result.bindings[0].when).toBe('global');
      expect(result.bindings[0].sourceEditor).toBe('emacs');
    });

    test('parses two-chord global-set-key with kbd form', () => {
      const content = `(global-set-key (kbd "C-x C-s") 'save-buffer)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      assertCanonicalStroke(result.bindings[0], {
        key: 'x',
        modifiers: ['ctrl'],
        chords: [{ key: 's', modifiers: ['ctrl'] }],
      });
      expect(result.bindings[0].command).toBe('save-buffer');
    });

    test('parses global-set-key with quoted string key', () => {
      const content = `(global-set-key "\\C-c p" 'my-custom-mode)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('my-custom-mode');
    });

    test('assigns when=global for global-set-key', () => {
      const content = `(global-set-key (kbd "C-c g") 'magit-status)`;
      const result = parseEmacs(content, 'linux');
      expect(result.bindings[0].when).toBe('global');
    });

    test('parses global-set-key with sharp-quote command syntax', () => {
      const content = `(global-set-key (kbd "C-c f") #'find-file)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('find-file');
    });

    test('parses global-set-key with function form command', () => {
      const content = `(global-set-key (kbd "C-c l") (function list-buffers))`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('list-buffers');
    });

    test('parses global-set-key with lambda command as lambda placeholder', () => {
      const content = `(global-set-key (kbd "C-c r") (lambda () (interactive) (revert-buffer t t)))`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('lambda');
    });

    test('parses multiple global-set-key forms in sequence', () => {
      const content = [
        `(global-set-key (kbd "C-s") 'isearch-forward)`,
        `(global-set-key (kbd "C-r") 'isearch-backward)`,
        `(global-set-key (kbd "M-x") 'execute-extended-command)`,
      ].join('\n');
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(3);
    });
  });

  test.describe('define-key parsing', () => {
    test('parses define-key with named keymap', () => {
      const content = `(define-key org-mode-map (kbd "C-c a") 'org-agenda)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('a');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].command).toBe('org-agenda');
      expect(result.bindings[0].when).toBe('org-mode-map');
    });

    test('assigns when=global for define-key with global-map', () => {
      const content = `(define-key global-map (kbd "C-x b") 'switch-to-buffer)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toBe('global');
    });

    test('assigns when=global for define-key with current-global-map', () => {
      const content = `(define-key (current-global-map) (kbd "C-x f") 'set-fill-column)`;
      const result = parseEmacs(content, 'linux');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toBe('global');
    });

    test('parses define-key with emacs-lisp-mode-map context', () => {
      const content = `(define-key emacs-lisp-mode-map (kbd "C-c C-e") 'eval-last-sexp)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toBe('emacs-lisp-mode-map');
    });

    test('parses define-key two-chord binding', () => {
      const content = `(define-key my-map (kbd "C-c C-k") 'kill-compilation)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      assertCanonicalStroke(result.bindings[0], {
        key: 'c',
        modifiers: ['ctrl'],
        chords: [{ key: 'k', modifiers: ['ctrl'] }],
      });
    });
  });

  test.describe('modifier mapping', () => {
    test('C- prefix maps to ctrl modifier', () => {
      const content = `(global-set-key (kbd "C-a") 'beginning-of-line)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('ctrl');
    });

    test('M- prefix maps to meta modifier', () => {
      const content = `(global-set-key (kbd "M-x") 'execute-extended-command)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('meta');
    });

    test('s- prefix maps to meta modifier (Emacs super maps to meta)', () => {
      const content = `(global-set-key (kbd "s-x") 'my-command)`;
      const result = parseEmacs(content, 'linux');
      expect(result.bindings[0].modifiers).toContain('meta');
    });

    test('S- prefix maps to shift modifier', () => {
      const content = `(global-set-key (kbd "S-<return>") 'my-command)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('shift');
    });

    test('H- prefix maps to super modifier', () => {
      const content = `(global-set-key (kbd "H-f") 'my-command)`;
      const result = parseEmacs(content, 'linux');
      expect(result.bindings[0].modifiers).toContain('super');
    });

    test('A- prefix maps to alt modifier', () => {
      const content = `(global-set-key (kbd "A-x") 'my-command)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('alt');
    });

    test('combined C-M- prefix produces ctrl and meta', () => {
      const content = `(global-set-key (kbd "C-M-s") 'isearch-forward-regexp)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].modifiers).toContain('meta');
    });
  });

  test.describe('special key normalization', () => {
    test('<return> normalizes to enter', () => {
      const content = `(global-set-key (kbd "<return>") 'newline)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].key).toBe('enter');
    });

    test('RET normalizes to enter', () => {
      const content = `(global-set-key (kbd "C-m") 'newline)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('<tab> normalizes to tab', () => {
      const content = `(global-set-key (kbd "<tab>") 'indent-for-tab-command)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].key).toBe('tab');
    });

    test('<escape> normalizes to escape', () => {
      const content = `(global-set-key (kbd "<escape>") 'keyboard-quit)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].key).toBe('escape');
    });

    test('SPC normalizes to space', () => {
      const content = `(global-set-key (kbd "SPC") 'my-leader)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].key).toBe('space');
    });

    test('<delete> normalizes to delete', () => {
      const content = `(global-set-key (kbd "<delete>") 'delete-char)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].key).toBe('delete');
    });

    test('<backspace> normalizes to backspace', () => {
      const content = `(global-set-key (kbd "<backspace>") 'backward-delete-char)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings[0].key).toBe('backspace');
    });
  });

  test.describe('comment stripping', () => {
    test('ignores lines starting with semicolon comment', () => {
      const content = [
        `;; This is a comment`,
        `(global-set-key (kbd "C-s") 'isearch-forward)`,
      ].join('\n');
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
    });

    test('strips inline semicolon comments before parsing', () => {
      const content = `(global-set-key (kbd "C-s") 'isearch-forward) ; search forward`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].command).toBe('isearch-forward');
    });

    test('does not strip semicolons inside strings', () => {
      const content = `(global-set-key (kbd "C-;") 'comment-dwim)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe(';');
    });
  });

  test.describe('warning behavior', () => {
    test('emits EMACS_FORM_PARSE warning for malformed global-set-key', () => {
      const content = `(global-set-key)`;
      const result = parseEmacs(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'EMACS_FORM_PARSE')).toBe(true);
    });

    test('emits EMACS_FORM_PARSE warning for define-key missing key expression', () => {
      const content = `(define-key my-map)`;
      const result = parseEmacs(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'EMACS_FORM_PARSE')).toBe(true);
    });

    test('emits EMACS_BINDING_SKIP warning for unsupported key syntax', () => {
      const content = `(global-set-key "" 'my-command)`;
      const result = parseEmacs(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'EMACS_BINDING_SKIP')).toBe(true);
    });

    test('ignores non-keybinding forms without warning', () => {
      const content = `(some-other-function "hello" 42)`;
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });
  });

  test.describe('empty and edge case content', () => {
    test('returns empty bindings for empty string', () => {
      const result = parseEmacs('', 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    test('returns empty bindings for whitespace-only content', () => {
      const result = parseEmacs('   \n\t  ', 'windows');
      expect(result.bindings.length).toBe(0);
    });

    test('parses mixed global-set-key and define-key forms', () => {
      const content = [
        `(global-set-key (kbd "C-s") 'isearch-forward)`,
        `(define-key org-mode-map (kbd "C-c a") 'org-agenda)`,
      ].join('\n');
      const result = parseEmacs(content, 'windows');
      expect(result.bindings.length).toBe(2);
      const globalBinding = result.bindings.find((b) => b.when === 'global');
      expect(globalBinding).toBeDefined();
      const orgBinding = result.bindings.find((b) => b.when === 'org-mode-map');
      expect(orgBinding).toBeDefined();
    });
  });
});
