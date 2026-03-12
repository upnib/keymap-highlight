// Test suite for the Vim/Neovim parser covering Vimscript mapping commands,
// option token filtering, mode derivation, bracket token normalization,
// command normalization, and Neovim Lua keymap call parsing.
import { test, expect } from '@playwright/test';
import { parseVim } from '@keymap-highlight/file-parsers';
import { assertCanonicalStroke } from './helpers/stroke-contract';

test.describe('Vim Parser', () => {
  test.describe('metadata', () => {
    test('sets sourceEditor to vim when only vimscript mappings present', () => {
      const content = `nnoremap <C-s> :w<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.metadata.sourceEditor).toBe('vim');
    });

    test('sets sourceEditor to neovim when lua keymap call present', () => {
      const content = `vim.keymap.set('n', '<C-s>', ':w<CR>')`;
      const result = parseVim(content, 'windows');
      expect(result.metadata.sourceEditor).toBe('neovim');
    });

    test('includes totalBindings and totalWarnings in metadata', () => {
      const content = `nnoremap <C-s> :w<CR>\nsome random text`;
      const result = parseVim(content, 'windows');
      expect(result.metadata.totalBindings).toBe(result.bindings.length);
      expect(result.metadata.totalWarnings).toBe(result.warnings.length);
    });
  });

  test.describe('vimscript mapping parsing', () => {
    test('parses nnoremap with Ctrl modifier bracket token', () => {
      const content = `nnoremap <C-s> :w<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('s');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].chords).toEqual([]);
      expect(result.bindings[0].sourceEditor).toBe('vim');
    });

    test('normalizes command by stripping leading colon and trailing <CR>', () => {
      const content = `nnoremap <C-s> :w<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].command).toBe('w');
    });

    test('normalizes command by stripping <cmd> prefix and trailing <cr>', () => {
      const content = `nnoremap <C-p> <cmd>FZF<cr>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].command).toBe('FZF');
    });

    test('parses inoremap with Alt modifier', () => {
      const content = `inoremap <A-j> <Down>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('down');
      expect(result.bindings[0].modifiers).toContain('alt');
    });

    test('parses vnoremap producing visual mode when clause', () => {
      const content = `vnoremap <C-c> "+y`;
      const result = parseVim(content, 'linux');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toBe('mode=visual');
    });

    test('parses map command deriving multi-mode when clause', () => {
      const content = `map <C-f> :grep<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toContain('normal');
      expect(result.bindings[0].when).toContain('visual');
    });

    test('parses noremap! command deriving insert and command modes', () => {
      const content = `noremap! <C-v> <Esc>pi`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toContain('insert');
      expect(result.bindings[0].when).toContain('command');
    });

    test('parses cnoremap producing command mode when clause', () => {
      const content = `cnoremap <C-a> <Home>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toBe('mode=command');
    });

    test('parses tnoremap producing terminal mode when clause', () => {
      const content = `tnoremap <Esc> <C-\\><C-n>`;
      const result = parseVim(content, 'linux');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toBe('mode=terminal');
    });

    test('parses literal character lhs into key', () => {
      const content = `map jj <Esc>`;
      const result = parseVim(content, 'linux');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('jj');
    });

    test('parses <Space> bracket token as space key', () => {
      const content = `nnoremap <Space>f :find<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('space');
    });

    test('parses <Tab> bracket token as tab key', () => {
      const content = `nnoremap <Tab> :tabnext<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('tab');
    });

    test('parses <CR> bracket token as enter key', () => {
      const content = `nnoremap <CR> :confirm<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('enter');
    });

    test('parses <BS> bracket token as backspace key', () => {
      const content = `nnoremap <BS> hx`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('backspace');
    });

    test('parses <Esc> bracket token as escape key', () => {
      const content = `nnoremap <Esc> :nohlsearch<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('escape');
    });

    test('parses function key <F5> correctly', () => {
      const content = `nnoremap <F5> :make<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('f5');
    });

    test('parses Ctrl+Shift combined modifier bracket token', () => {
      const content = `nnoremap <C-S-p> :Commands<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('p');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].modifiers).toContain('shift');
    });

    test('D modifier maps to cmd on macOS', () => {
      const content = `nnoremap <D-s> :w<CR>`;
      const result = parseVim(content, 'macos');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].modifiers).toContain('cmd');
    });

    test('D modifier maps to meta on non-macOS', () => {
      const content = `nnoremap <D-s> :w<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].modifiers).toContain('meta');
    });

    test('M modifier maps to meta', () => {
      const content = `nnoremap <M-x> :execute<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].modifiers).toContain('meta');
    });

    test('parses chord sequence lhs into primary key and secondary chords', () => {
      const content = `nnoremap <C-x><C-s> :wall<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      assertCanonicalStroke(result.bindings[0], {
        key: 'x',
        modifiers: ['ctrl'],
        chords: [{ key: 's', modifiers: ['ctrl'] }],
      });
    });
  });

  test.describe('option token filtering', () => {
    test('skips <silent> option token before lhs', () => {
      const content = `nnoremap <silent> <C-s> :w<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('s');
      expect(result.bindings[0].modifiers).toContain('ctrl');
    });

    test('skips <buffer> option token before lhs', () => {
      const content = `nnoremap <buffer> <C-n> :next<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('n');
    });

    test('skips multiple consecutive option tokens before lhs', () => {
      const content = `nnoremap <silent><nowait> <C-q> :quit<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('q');
    });

    test('skips <expr> <nowait> <unique> option tokens', () => {
      const content = `nnoremap <expr><nowait><unique> <C-a> pumvisible() ? '<C-n>' : '<C-a>'`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('a');
    });
  });

  test.describe('warning behavior', () => {
    test('skips blank lines without warning', () => {
      const content = `\n\n  \nnnoremap <C-s> :w<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.warnings.length).toBe(0);
    });

    test('skips comment lines without warning', () => {
      const content = `" This is a comment\nnnoremap <C-s> :w<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.warnings.length).toBe(0);
    });

    test('emits vim_mapping_parse_failed warning for incomplete mapping line', () => {
      const content = `nnoremap <C-s>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.some((w) => w.code === 'vim_mapping_parse_failed')).toBe(true);
    });

    test('emits warning for non-mapping lines mixed with valid mappings', () => {
      const content = `nnoremap <C-s> :w<CR>\nsome random text\nmap jj <Esc>`;
      const result = parseVim(content, 'linux');
      expect(result.bindings.length).toBe(2);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('includes line number in warning', () => {
      const content = `nnoremap <C-s> :w<CR>\nnnoremap <C-a>`;
      const result = parseVim(content, 'windows');
      const warning = result.warnings.find((w) => w.code === 'vim_mapping_parse_failed');
      expect(warning).toBeDefined();
      expect(warning?.line).toBe(2);
    });
  });

  test.describe('neovim lua keymap parsing', () => {
    test('parses vim.keymap.set single mode call', () => {
      const content = `vim.keymap.set('n', '<C-s>', ':w<CR>')`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('s');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].sourceEditor).toBe('neovim');
      expect(result.bindings[0].when).toBe('mode=normal');
    });

    test('parses vim.api.nvim_set_keymap call', () => {
      const content = `vim.api.nvim_set_keymap('i', '<C-j>', '<Down>', {noremap = true})`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('down');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].when).toBe('mode=insert');
      expect(result.bindings[0].sourceEditor).toBe('neovim');
    });

    test('parses lua call with multiple modes as table', () => {
      const content = `vim.keymap.set({'n', 'v'}, '<C-c>', '"+y')`;
      const result = parseVim(content, 'linux');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toContain('normal');
      expect(result.bindings[0].when).toContain('visual');
    });

    test('parses lua call with insert mode', () => {
      const content = `vim.keymap.set('i', 'jk', '<Esc>')`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].when).toBe('mode=insert');
    });

    test('emits lua_mapping_parse_failed warning for call with fewer than 3 args', () => {
      const content = `vim.keymap.set('n', '<C-s>')`;
      const result = parseVim(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'lua_mapping_parse_failed')).toBe(true);
    });

    test('emits lua_mapping_invalid_arguments when mode argument is empty', () => {
      const content = `vim.keymap.set('', '<C-s>', ':w<CR>')`;
      const result = parseVim(content, 'windows');
      expect(result.warnings.some((w) => w.code === 'lua_mapping_invalid_arguments')).toBe(true);
    });

    test('parses lua call with double-quoted strings', () => {
      const content = `vim.keymap.set("n", "<C-p>", ":FZF<CR>")`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('p');
      expect(result.bindings[0].modifiers).toContain('ctrl');
      expect(result.bindings[0].command).toBe('FZF');
    });

    test('parses mixed vimscript and lua in same content, sourceEditor becomes neovim', () => {
      const content = `nnoremap <C-s> :w<CR>\nvim.keymap.set('n', '<C-p>', ':FZF<CR>')`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(2);
      expect(result.metadata.sourceEditor).toBe('neovim');
    });
  });

  test.describe('mode derivation from vimscript commands', () => {
    test('nnoremap produces normal mode', () => {
      const content = `nnoremap <C-a> :inc<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].when).toBe('mode=normal');
    });

    test('inoremap produces insert mode', () => {
      const content = `inoremap <C-d> <Del>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].when).toBe('mode=insert');
    });

    test('xnoremap produces visual mode', () => {
      const content = `xnoremap <C-c> "+y`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].when).toBe('mode=visual');
    });

    test('snoremap produces select mode', () => {
      const content = `snoremap <C-a> <Esc>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].when).toBe('mode=select');
    });

    test('onoremap produces operator mode', () => {
      const content = `onoremap p ip`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].when).toBe('mode=operator');
    });

    test('map! produces insert and command modes', () => {
      const content = `map! <C-c> <Esc>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].when).toContain('insert');
      expect(result.bindings[0].when).toContain('command');
    });
  });

  test.describe('special key bracket token normalization', () => {
    test('<lt> normalizes to < character', () => {
      const content = `nnoremap <lt> :echoerr<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(1);
      expect(result.bindings[0].key).toBe('<');
    });

    test('<Up> normalizes to up', () => {
      const content = `nnoremap <Up> gk`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('up');
    });

    test('<Down> normalizes to down', () => {
      const content = `nnoremap <Down> gj`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('down');
    });

    test('<Left> normalizes to left', () => {
      const content = `nnoremap <Left> h`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('left');
    });

    test('<Right> normalizes to right', () => {
      const content = `nnoremap <Right> l`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('right');
    });

    test('<PageUp> normalizes to pageup', () => {
      const content = `nnoremap <PageUp> <C-b>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('pageup');
    });

    test('<PageDown> normalizes to pagedown', () => {
      const content = `nnoremap <PageDown> <C-f>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('pagedown');
    });

    test('<Home> normalizes to home', () => {
      const content = `nnoremap <Home> ^`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('home');
    });

    test('<End> normalizes to end', () => {
      const content = `nnoremap <End> $`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('end');
    });

    test('<Del> normalizes to delete', () => {
      const content = `nnoremap <Del> "_x`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('delete');
    });

    test('<Ins> normalizes to insert', () => {
      const content = `nnoremap <Ins> a`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('insert');
    });

    test('<Return> normalizes to enter', () => {
      const content = `nnoremap <Return> :confirm<CR>`;
      const result = parseVim(content, 'windows');
      expect(result.bindings[0].key).toBe('enter');
    });
  });

  test.describe('empty and edge case content', () => {
    test('returns empty bindings for empty content', () => {
      const result = parseVim('', 'windows');
      expect(result.bindings.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    test('returns empty bindings for whitespace-only content', () => {
      const result = parseVim('   \n  \t  ', 'windows');
      expect(result.bindings.length).toBe(0);
    });

    test('parses multiple valid mappings from multi-line content', () => {
      const content = [
        'nnoremap <C-s> :w<CR>',
        'inoremap <C-d> <Del>',
        'vnoremap <C-c> "+y',
      ].join('\n');
      const result = parseVim(content, 'windows');
      expect(result.bindings.length).toBe(3);
    });
  });
});
