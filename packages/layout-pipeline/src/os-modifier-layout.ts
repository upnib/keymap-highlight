// layout-pipeline/src/os-modifier-layout.ts - Cross-OS shortcut remap using explicit per-OS modifier layout profiles.
import linuxModifierLayout from './data/modifier-layouts/linux.json';
import macModifierLayout from './data/modifier-layouts/mac.json';
import winModifierLayout from './data/modifier-layouts/win.json';
import type { DetectedConfigOs, SupportedOs } from './types';

type ModifierSlot = 'control' | 'shift' | 'systemOuter' | 'systemInner' | 'fn' | 'menu';

type ModifierLayoutProfile = {
  canonicalBySlot: Record<ModifierSlot, string>;
  aliasesBySlot: Record<ModifierSlot, string[]>;
};

const MODIFIER_SLOTS: readonly ModifierSlot[] = ['control', 'shift', 'systemOuter', 'systemInner', 'fn', 'menu'];

const MODIFIER_LAYOUT_PROFILES: Record<SupportedOs, ModifierLayoutProfile> = {
  mac: macModifierLayout as ModifierLayoutProfile,
  win: winModifierLayout as ModifierLayoutProfile,
  linux: linuxModifierLayout as ModifierLayoutProfile,
};

const UNKNOWN_CONTROL_ALIASES = ['ctrl', 'control', 'ctl'] as const;
const UNKNOWN_SHIFT_ALIASES = ['shift'] as const;
const UNKNOWN_ALT_ALIASES = ['alt', 'option', 'opt', 'altgr'] as const;
const UNKNOWN_META_ALIASES = ['cmd', 'command', 'meta', 'super', 'win', 'windows', 'gui', 'hyper'] as const;
const UNKNOWN_FN_ALIASES = ['fn'] as const;
const UNKNOWN_MENU_ALIASES = ['menu', 'apps', 'context'] as const;

function applyTokenCase(sourceToken: string, targetToken: string): string {
  if (sourceToken === sourceToken.toUpperCase()) {
    return targetToken.toUpperCase();
  }

  if (sourceToken[0] === sourceToken[0]?.toUpperCase()) {
    return targetToken.charAt(0).toUpperCase() + targetToken.slice(1);
  }

  return targetToken;
}

function buildReplacementMap(
  fromOs: SupportedOs,
  toOs: SupportedOs,
  forceAliasCanonicalization: boolean,
): Map<string, string> {
  const sourceProfile = MODIFIER_LAYOUT_PROFILES[fromOs];
  const targetProfile = MODIFIER_LAYOUT_PROFILES[toOs];
  const replacementMap = new Map<string, string>();

  for (const slot of MODIFIER_SLOTS) {
    const targetCanonical = targetProfile.canonicalBySlot[slot].toLowerCase();
    for (const sourceAlias of sourceProfile.aliasesBySlot[slot]) {
      const normalizedSourceAlias = sourceAlias.toLowerCase();
      if (
        (!forceAliasCanonicalization && normalizedSourceAlias === targetCanonical)
        || replacementMap.has(normalizedSourceAlias)
      ) {
        continue;
      }

      replacementMap.set(normalizedSourceAlias, targetCanonical);
    }
  }

  return replacementMap;
}

function buildUnknownSourceReplacementMap(
  toOs: SupportedOs,
  forceAliasCanonicalization: boolean,
): Map<string, string> {
  const targetProfile = MODIFIER_LAYOUT_PROFILES[toOs];
  const replacementMap = new Map<string, string>();
  const controlCanonical = targetProfile.canonicalBySlot.control.toLowerCase();
  const shiftCanonical = targetProfile.canonicalBySlot.shift.toLowerCase();
  const fnCanonical = targetProfile.canonicalBySlot.fn.toLowerCase();
  const menuCanonical = targetProfile.canonicalBySlot.menu.toLowerCase();
  const altCanonical = (toOs === 'mac'
    ? targetProfile.canonicalBySlot.systemOuter
    : targetProfile.canonicalBySlot.systemInner).toLowerCase();
  const metaCanonical = (toOs === 'mac'
    ? targetProfile.canonicalBySlot.systemInner
    : targetProfile.canonicalBySlot.systemOuter).toLowerCase();

  const applyAliasGroup = (aliases: readonly string[], targetCanonical: string) => {
    for (const alias of aliases) {
      const normalizedAlias = alias.toLowerCase();
      if (
        (!forceAliasCanonicalization && normalizedAlias === targetCanonical)
        || replacementMap.has(normalizedAlias)
      ) {
        continue;
      }

      replacementMap.set(normalizedAlias, targetCanonical);
    }
  };

  applyAliasGroup(UNKNOWN_CONTROL_ALIASES, controlCanonical);
  applyAliasGroup(UNKNOWN_SHIFT_ALIASES, shiftCanonical);
  applyAliasGroup(UNKNOWN_ALT_ALIASES, altCanonical);
  applyAliasGroup(UNKNOWN_META_ALIASES, metaCanonical);
  applyAliasGroup(UNKNOWN_FN_ALIASES, fnCanonical);
  applyAliasGroup(UNKNOWN_MENU_ALIASES, menuCanonical);

  return replacementMap;
}

function remapSideVariantToken(token: string, replacementMap: Map<string, string>): string | null {
  const prefixed = token.match(/^((?:left|right|l|r))([_-]?)([a-z0-9]+)$/i);
  if (prefixed) {
    const side = prefixed[1] ?? '';
    const separator = prefixed[2] ?? '';
    const baseToken = prefixed[3] ?? '';
    const remappedBaseToken = replacementMap.get(baseToken.toLowerCase());
    if (!remappedBaseToken) {
      return null;
    }

    return `${side}${separator}${applyTokenCase(baseToken, remappedBaseToken)}`;
  }

  const suffixed = token.match(/^([a-z0-9]+)([_-]?)((?:left|right|l|r))$/i);
  if (!suffixed) {
    return null;
  }

  const baseToken = suffixed[1] ?? '';
  const separator = suffixed[2] ?? '';
  const side = suffixed[3] ?? '';
  const remappedBaseToken = replacementMap.get(baseToken.toLowerCase());
  if (!remappedBaseToken) {
    return null;
  }

  return `${applyTokenCase(baseToken, remappedBaseToken)}${separator}${side}`;
}

function remapModifierToken(token: string, replacementMap: Map<string, string>): string {
  const directRemap = replacementMap.get(token.toLowerCase());
  if (directRemap) {
    return applyTokenCase(token, directRemap);
  }

  const sideVariantRemap = remapSideVariantToken(token, replacementMap);
  if (sideVariantRemap) {
    return sideVariantRemap;
  }

  return token;
}

function remapShortcutTokens(
  keyValue: string,
  delimiterPattern: RegExp,
  replacementMap: Map<string, string>,
): string {
  return keyValue.replace(delimiterPattern, (token) => remapModifierToken(token, replacementMap));
}

function remapJetbrainsConfig(rawConfig: string, replacementMap: Map<string, string>): string {
  return rawConfig.replace(
    /(keystroke=")(.*?)"/gi,
    (_match, prefix, keyValue) => prefix + remapShortcutTokens(keyValue, /[^\s]+/g, replacementMap) + '"',
  );
}

function remapZedConfig(rawConfig: string, replacementMap: Map<string, string>): string {
  return rawConfig.replace(
    /(")([^"\\]+)(?:":)/gi,
    (match, _prefix, keyValue) => {
      if (!keyValue.includes('-')) {
        return match;
      }

      return '"' + remapShortcutTokens(keyValue, /[^-]+/g, replacementMap) + '":';
    },
  );
}

function remapVimLikeConfig(rawConfig: string, replacementMap: Map<string, string>): string {
  return rawConfig.replace(
    /(<)([^>]+)(>)/gi,
    (_match, prefix, keyValue, suffix) => {
      return prefix + remapShortcutTokens(keyValue, /[^-]+/g, replacementMap) + suffix;
    },
  );
}

function remapKritaConfig(rawConfig: string, replacementMap: Map<string, string>): string {
  return rawConfig.replace(
    /^(\s*[^=\r\n]+=\s*)([^\r\n]*)(\r?\n|$)/gim,
    (_match, prefix, keyValue, suffix) => {
      const trimmedValue = keyValue.trim().toLowerCase();
      if (!trimmedValue || trimmedValue === 'none') {
        return prefix + keyValue + suffix;
      }

      return prefix + remapShortcutTokens(keyValue, /[^+\s;]+/g, replacementMap) + suffix;
    },
  );
}

function remapIllustratorConfig(rawConfig: string, replacementMap: Map<string, string>): string {
  const lines = rawConfig.split(/\r?\n/);
  const remappedLines = lines.map((line) => {
    const segments = line.split('\t');
    if (segments.length > 1) {
      const shortcut = segments[segments.length - 1] ?? '';
      const remappedShortcut = remapShortcutTokens(shortcut, /[^+\s]+/g, replacementMap);
      return [...segments.slice(0, -1), remappedShortcut].join('\t');
    }

    return line.replace(
      /((?:ctrl|control|ctl|shift|alt|option|opt|cmd|command|meta|super|win|windows|fn|menu)\+[^\s]+)$/i,
      (shortcut) => remapShortcutTokens(shortcut, /[^+\s]+/g, replacementMap),
    );
  });

  return remappedLines.join('\n');
}

function remapVsCodeConfig(rawConfig: string, replacementMap: Map<string, string>): string {
  return rawConfig.replace(
    /("key"\s*:\s*")([^"\\]*)(")/gi,
    (_match, prefix, keyValue, suffix) => {
      return prefix + remapShortcutTokens(keyValue, /[^+\s]+/g, replacementMap) + suffix;
    },
  );
}

export function remapConfigByModifierLayout(
  rawConfig: string,
  fromOs: DetectedConfigOs,
  toOs: SupportedOs,
  format: string = 'vscode',
): string {
  const shouldForceAliasCanonicalization = fromOs === 'unknown';

  if (!shouldForceAliasCanonicalization && fromOs === toOs) {
    return rawConfig;
  }

  const replacementMap = fromOs === 'unknown'
    ? buildUnknownSourceReplacementMap(toOs, shouldForceAliasCanonicalization)
    : buildReplacementMap(fromOs, toOs, shouldForceAliasCanonicalization);
  if (replacementMap.size === 0) {
    return rawConfig;
  }

  if (format === 'jetbrains') {
    return remapJetbrainsConfig(rawConfig, replacementMap);
  }

  if (format === 'zed') {
    return remapZedConfig(rawConfig, replacementMap);
  }

  if (format === 'vim' || format === 'neovim') {
    return remapVimLikeConfig(rawConfig, replacementMap);
  }

  if (format === 'krita') {
    return remapKritaConfig(rawConfig, replacementMap);
  }

  if (format === 'illustrator') {
    return remapIllustratorConfig(rawConfig, replacementMap);
  }

  return remapVsCodeConfig(rawConfig, replacementMap);
}
