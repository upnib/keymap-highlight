// layout-pipeline/src/index.ts - Public API barrel for keyboard layout processing and mapping utilities.
export type { DetectedConfigOs, DetectedEditorFormat, SupportedEditorFormat, SupportedOs } from './types';

export {
  HARDWARE_LAYOUT_OPTIONS,
  layouts,
  type LayoutKey,
} from './hardware-layouts';

export {
  DEFAULT_CUSTOM_INPUT_MAPPING,
  INPUT_LAYOUT_CUSTOM_KEY_PATTERN,
  INPUT_LAYOUT_MAPPINGS,
  INPUT_LAYOUT_OPTIONS,
  type InputLayoutMapping,
  type InputLayoutType,
} from './input-layouts';

export {
  MODIFIER_ALIASES,
  OS_MODIFIER_ALIASES,
  contextMatches,
  modifiersIncludeSubset,
  modifiersMatch,
  normalizeBindingModifiers,
  normalizeModifier,
  type NormalizedModifier,
} from './modifier-aliases';

export {
  createBindingSignature,
  formatChordSequence,
  formatStroke,
  getConflictIdentity,
  type PipelineBinding,
} from './binding-display';

export {
  normalizeBindingKeyToken,
  normalizeParsedBinding,
  normalizeParseResult,
} from './binding-normalization';

export {
  resolveParsedInput,
  type ResolveParsedInputOptions,
  type ResolvedParsedInput,
} from './parsed-input';

export { mapStoreOsToWorkerOs } from './format-detection';

export {
  remapConfigByModifierLayout,
} from './os-modifier-layout';

export {
  resolveLayoutKey,
} from './resolve-layout-key';

export {
  formatBindingModifierLabels,
  getActiveInputMapping,
  remapLayoutKeyByInputLayout,
  resolveBindingDisplayKey,
} from './shortcut-display';

export {
  getKeyType,
  type KeyType,
} from './key-types';

export {
  RELATED_SHORTCUT_COLORS,
  computeRelatedKeys,
  type ComputeRelatedKeysParams,
  type RelatedIndicatorShape,
  type RelatedKeyIndicator,
  type RelatedKeysMap,
} from './related-keys';
