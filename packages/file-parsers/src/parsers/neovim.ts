// parsers/neovim.ts - Dedicated Neovim parser that supports mixed Vimscript/Lua configs.
// Normalizes common Neovim Lua alias patterns, rewrites buffer-local API calls into
// parseable canonical forms, and merges embedded `vim.cmd` Vimscript snippets.
import type { OS } from '../schemas/enums';
import type { KeyBinding } from '../schemas/keyBinding';
import {
  ParseResult as ParseResultSchema,
  type ParseResult,
  type ParseWarning,
} from '../schemas/parseResult';
import { parseVim } from './vim';

interface LuaCallRange {
  args: string;
  line: number;
  startIndex: number;
  closeParenIndex: number;
}

interface EmbeddedVimscriptBlock {
  content: string;
  line: number;
}

export function parseNeovim(content: string, os: OS): ParseResult {
  const normalizedContent = normalizeNeovimLuaContent(content);
  const baseResult = parseVim(normalizedContent, os);
  const embeddedVimscriptResult = parseEmbeddedVimscriptBlocks(normalizedContent, os);

  const bindings = dedupeBindings([
    ...baseResult.bindings.map((binding) => ({ ...binding, sourceEditor: 'neovim' as const })),
    ...embeddedVimscriptResult.bindings.map((binding) => ({ ...binding, sourceEditor: 'neovim' as const })),
  ]);

  const warnings = [...baseResult.warnings, ...embeddedVimscriptResult.warnings];

  return ParseResultSchema.parse({
    bindings,
    warnings,
    metadata: {
      sourceEditor: 'neovim',
      parsedAt: new Date().toISOString(),
      totalBindings: bindings.length,
      totalWarnings: warnings.length,
    },
  });
}

function normalizeNeovimLuaContent(content: string): string {
  const aliasNormalized = normalizeLuaAliases(content);
  return rewriteBufferSetKeymapCalls(aliasNormalized);
}

function normalizeLuaAliases(content: string): string {
  let normalized = content;

  for (let pass = 0; pass < 2; pass += 1) {
    const keymapSetAliases = collectAliasesForTarget(normalized, 'vim.keymap.set');
    for (const alias of keymapSetAliases) {
      normalized = replaceFunctionAliasCalls(normalized, alias, 'vim.keymap.set');
    }

    const keymapObjectAliases = collectAliasesForTarget(normalized, 'vim.keymap');
    for (const alias of keymapObjectAliases) {
      normalized = replaceObjectMethodAliasCalls(normalized, alias, 'set', 'vim.keymap.set');
    }

    const apiSetAliases = collectAliasesForTarget(normalized, 'vim.api.nvim_set_keymap');
    for (const alias of apiSetAliases) {
      normalized = replaceFunctionAliasCalls(normalized, alias, 'vim.api.nvim_set_keymap');
    }

    const apiBufferSetAliases = collectAliasesForTarget(normalized, 'vim.api.nvim_buf_set_keymap');
    for (const alias of apiBufferSetAliases) {
      normalized = replaceFunctionAliasCalls(normalized, alias, 'vim.api.nvim_buf_set_keymap');
    }

    const apiObjectAliases = collectAliasesForTarget(normalized, 'vim.api');
    for (const alias of apiObjectAliases) {
      normalized = replaceObjectMethodAliasCalls(normalized, alias, 'nvim_set_keymap', 'vim.api.nvim_set_keymap');
      normalized = replaceObjectMethodAliasCalls(normalized, alias, 'nvim_buf_set_keymap', 'vim.api.nvim_buf_set_keymap');
      normalized = replaceObjectMethodAliasCalls(normalized, alias, 'nvim_exec', 'vim.api.nvim_exec');
      normalized = replaceObjectMethodAliasCalls(normalized, alias, 'nvim_exec2', 'vim.api.nvim_exec2');
      normalized = replaceObjectMethodAliasCalls(normalized, alias, 'nvim_command', 'vim.api.nvim_command');
    }
  }

  return normalized;
}

function collectAliasesForTarget(content: string, target: string): string[] {
  const escapedTarget = escapeRegex(target);
  const pattern = new RegExp(`^\\s*(?:local\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*${escapedTarget}\\b`, 'gm');
  const aliases = new Set<string>();

  let match = pattern.exec(content);
  while (match) {
    const alias = (match[1] ?? '').trim();
    if (alias && alias !== 'vim') {
      aliases.add(alias);
    }

    match = pattern.exec(content);
  }

  return Array.from(aliases);
}

function replaceFunctionAliasCalls(content: string, alias: string, replacementTarget: string): string {
  const escapedAlias = escapeRegex(alias);
  const pattern = new RegExp(`(^|[^\\w.])${escapedAlias}\\s*\\(`, 'g');

  return content.replace(pattern, (fullMatch, prefix: string, offset: number, source: string) => {
    const aliasStart = offset + prefix.length;
    const leadingSlice = source.slice(Math.max(0, aliasStart - 24), aliasStart).toLowerCase();
    if (/\bfunction\s*$/.test(leadingSlice)) {
      return fullMatch;
    }

    return `${prefix}${replacementTarget}(`;
  });
}

function replaceObjectMethodAliasCalls(
  content: string,
  objectAlias: string,
  methodName: string,
  replacementTarget: string,
): string {
  const escapedAlias = escapeRegex(objectAlias);
  const escapedMethodName = escapeRegex(methodName);
  const pattern = new RegExp(`(^|[^\\w.])${escapedAlias}\\s*\\.\\s*${escapedMethodName}\\s*\\(`, 'g');
  return content.replace(pattern, `$1${replacementTarget}(`);
}

function rewriteBufferSetKeymapCalls(content: string): string {
  const calls = findLuaCallRanges(content, 'vim.api.nvim_buf_set_keymap');
  if (calls.length === 0) {
    return content;
  }

  let rewritten = content;
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    const call = calls[index];
    const args = splitLuaArguments(call.args);
    if (args.length < 4) {
      continue;
    }

    const mode = args[1] ?? "''";
    const lhs = args[2] ?? "''";
    const rhs = args[3] ?? "''";
    const options = args[4] ?? '{}';
    const replacement = `vim.api.nvim_set_keymap(${mode}, ${lhs}, ${rhs}, ${options})`;

    rewritten = `${rewritten.slice(0, call.startIndex)}${replacement}${rewritten.slice(call.closeParenIndex + 1)}`;
  }

  return rewritten;
}

function parseEmbeddedVimscriptBlocks(content: string, os: OS): { bindings: KeyBinding[]; warnings: ParseWarning[] } {
  const bindings: KeyBinding[] = [];
  const warnings: ParseWarning[] = [];
  const blocks = extractEmbeddedVimscriptBlocks(content);

  for (const block of blocks) {
    const parsed = parseVim(block.content, os);
    bindings.push(...parsed.bindings);

    for (const warning of parsed.warnings) {
      if (typeof warning.line === 'number') {
        warnings.push({
          ...warning,
          line: block.line + warning.line - 1,
        });
        continue;
      }

      warnings.push(warning);
    }
  }

  return { bindings, warnings };
}

function extractEmbeddedVimscriptBlocks(content: string): EmbeddedVimscriptBlock[] {
  const blocks: EmbeddedVimscriptBlock[] = [];

  blocks.push(...extractInlineVimCmdLongStrings(content));
  blocks.push(...extractFirstLuaStringArgument(content, 'vim.cmd'));
  blocks.push(...extractFirstLuaStringArgument(content, 'vim.api.nvim_exec'));
  blocks.push(...extractFirstLuaStringArgument(content, 'vim.api.nvim_exec2'));
  blocks.push(...extractFirstLuaStringArgument(content, 'vim.api.nvim_command'));

  return dedupeBlocks(blocks);
}

function extractInlineVimCmdLongStrings(content: string): EmbeddedVimscriptBlock[] {
  const blocks: EmbeddedVimscriptBlock[] = [];
  const callName = 'vim.cmd';
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const callIndex = content.indexOf(callName, searchIndex);
    if (callIndex === -1) {
      break;
    }

    const before = content[callIndex - 1] ?? '';
    if (before && /[\w.]/.test(before)) {
      searchIndex = callIndex + callName.length;
      continue;
    }

    let cursor = callIndex + callName.length;
    while (cursor < content.length && /\s/.test(content[cursor] ?? '')) {
      cursor += 1;
    }

    if (content[cursor] !== '[') {
      searchIndex = callIndex + callName.length;
      continue;
    }

    const endIndex = findLuaLongStringEnd(content, cursor);
    if (endIndex === -1) {
      searchIndex = cursor + 1;
      continue;
    }

    const rawValue = content.slice(cursor, endIndex + 1);
    const decoded = decodeLuaValue(rawValue).trim();
    if (decoded) {
      blocks.push({
        content: decoded,
        line: lineNumberAt(content, cursor),
      });
    }

    searchIndex = endIndex + 1;
  }

  return blocks;
}

function extractFirstLuaStringArgument(content: string, callName: string): EmbeddedVimscriptBlock[] {
  const blocks: EmbeddedVimscriptBlock[] = [];
  const calls = findLuaCallRanges(content, callName);

  for (const call of calls) {
    const args = splitLuaArguments(call.args);
    const scriptSource = decodeLuaValue(args[0] ?? '').trim();
    if (!scriptSource) {
      continue;
    }

    blocks.push({
      content: scriptSource,
      line: call.line,
    });
  }

  return blocks;
}

function dedupeBlocks(blocks: EmbeddedVimscriptBlock[]): EmbeddedVimscriptBlock[] {
  const uniqueBlocks: EmbeddedVimscriptBlock[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const signature = `${block.line}:${block.content}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    uniqueBlocks.push(block);
  }

  return uniqueBlocks;
}

function dedupeBindings(bindings: KeyBinding[]): KeyBinding[] {
  const uniqueBindings: KeyBinding[] = [];
  const seen = new Set<string>();

  for (const binding of bindings) {
    const signature = JSON.stringify({
      key: binding.key,
      command: binding.command,
      when: binding.when,
      modifiers: binding.modifiers,
      chords: binding.chords,
    });

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    uniqueBindings.push(binding);
  }

  return uniqueBindings;
}

function findLuaCallRanges(content: string, callName: string): LuaCallRange[] {
  const calls: LuaCallRange[] = [];
  let index = 0;

  while (index < content.length) {
    const callIndex = content.indexOf(callName, index);
    if (callIndex === -1) {
      break;
    }

    const charBefore = content[callIndex - 1] ?? '';
    if (charBefore && /[\w.]/.test(charBefore)) {
      index = callIndex + callName.length;
      continue;
    }

    let openParenIndex = callIndex + callName.length;
    while (openParenIndex < content.length && /\s/.test(content[openParenIndex] ?? '')) {
      openParenIndex += 1;
    }

    if (content[openParenIndex] !== '(') {
      index = callIndex + callName.length;
      continue;
    }

    const closeParenIndex = findMatchingParenthesis(content, openParenIndex);
    if (closeParenIndex === -1) {
      index = openParenIndex + 1;
      continue;
    }

    calls.push({
      args: content.slice(openParenIndex + 1, closeParenIndex),
      line: lineNumberAt(content, callIndex),
      startIndex: callIndex,
      closeParenIndex,
    });

    index = closeParenIndex + 1;
  }

  return calls;
}

function findMatchingParenthesis(source: string, openParenIndex: number): number {
  let parenthesisDepth = 0;
  let quote: '"' | '\'' | null = null;

  for (let index = openParenIndex; index < source.length; index += 1) {
    const char = source[index] ?? '';
    const previous = source[index - 1] ?? '';

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    const longStringEnd = findLuaLongStringEnd(source, index);
    if (longStringEnd !== -1) {
      index = longStringEnd;
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (char === '(') {
      parenthesisDepth += 1;
      continue;
    }

    if (char === ')') {
      parenthesisDepth -= 1;
      if (parenthesisDepth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitLuaArguments(argsSource: string): string[] {
  const args: string[] = [];
  let tokenStart = 0;
  let parenthesisDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let quote: '"' | '\'' | null = null;

  for (let index = 0; index < argsSource.length; index += 1) {
    const char = argsSource[index] ?? '';
    const previous = argsSource[index - 1] ?? '';

    if (quote) {
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    const longStringEnd = findLuaLongStringEnd(argsSource, index);
    if (longStringEnd !== -1) {
      index = longStringEnd;
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (char === '(') {
      parenthesisDepth += 1;
      continue;
    }
    if (char === ')') {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      continue;
    }
    if (char === '{') {
      braceDepth += 1;
      continue;
    }
    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }
    if (char === '[') {
      bracketDepth += 1;
      continue;
    }
    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }

    if (char === ',' && parenthesisDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      const token = argsSource.slice(tokenStart, index).trim();
      if (token) {
        args.push(token);
      }
      tokenStart = index + 1;
    }
  }

  const lastToken = argsSource.slice(tokenStart).trim();
  if (lastToken) {
    args.push(lastToken);
  }

  return args;
}

function findLuaLongStringEnd(source: string, index: number): number {
  if (source[index] !== '[') {
    return -1;
  }

  let probe = index + 1;
  while (probe < source.length && source[probe] === '=') {
    probe += 1;
  }

  if (source[probe] !== '[') {
    return -1;
  }

  const equalsCount = probe - index - 1;
  const closing = `]${'='.repeat(equalsCount)}]`;
  const endIndex = source.indexOf(closing, probe + 1);
  if (endIndex === -1) {
    return source.length - 1;
  }

  return endIndex + closing.length - 1;
}

function decodeLuaValue(argument: string): string {
  const trimmed = argument.trim();
  if (!trimmed) {
    return '';
  }

  const longStringMatch = trimmed.match(/^\[(=*)\[([\s\S]*)\]\1\]$/);
  if (longStringMatch) {
    return (longStringMatch[2] ?? '').trim();
  }

  const quote = trimmed[0];
  if ((quote === '"' || quote === '\'') && trimmed.endsWith(quote)) {
    return unescapeLuaString(trimmed.slice(1, -1));
  }

  return trimmed;
}

function unescapeLuaString(input: string): string {
  return input
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

function lineNumberAt(content: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (content[cursor] === '\n') {
      line += 1;
    }
  }
  return line;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
