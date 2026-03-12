// layouts/index.ts - Re-exports the KLE layout parser and all associated TypeScript types
// as the public surface of the layouts sub-module.
export { parseKleLayout } from './parseKleLayout';
export type {
  KleKeyboardMetadata,
  KleKeyLegend,
  KleKeyProps,
  KleLayout,
  KleRow,
  KleRowItem,
  ParsedKleKeyGeometry,
  ParsedKleLayout,
} from './types';
