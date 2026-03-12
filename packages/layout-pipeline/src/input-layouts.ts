// layout-pipeline/src/input-layouts.ts - Input layout options, mappings, and custom mapping validation pattern.
import qwertyLayout from './data/input/qwerty.json';
import colemakLayout from './data/input/colemak.json';
import dvorakLayout from './data/input/dvorak.json';
import normanLayout from './data/input/norman.json';
import workmanLayout from './data/input/workman.json';
import azertyLayout from './data/input/azerty.json';

export const INPUT_LAYOUT_OPTIONS = ['qwerty', 'colemak', 'dvorak', 'norman', 'workman', 'azerty', 'custom'] as const;
export const INPUT_LAYOUT_CUSTOM_KEY_PATTERN = /^[a-z,.;'\/[\]\\`=\-]$/;

export type InputLayoutType = (typeof INPUT_LAYOUT_OPTIONS)[number];
export type InputLayoutMapping = Record<string, string>;

type PresetInputLayoutType = Exclude<InputLayoutType, 'custom'>;

export const INPUT_LAYOUT_MAPPINGS: Record<PresetInputLayoutType, InputLayoutMapping> = {
  qwerty: qwertyLayout,
  colemak: colemakLayout,
  dvorak: dvorakLayout,
  norman: normanLayout,
  workman: workmanLayout,
  azerty: azertyLayout,
};

export const DEFAULT_CUSTOM_INPUT_MAPPING: InputLayoutMapping = {};
