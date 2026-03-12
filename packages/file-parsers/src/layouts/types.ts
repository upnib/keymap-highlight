// layouts/types.ts - TypeScript type definitions for raw KLE (Keyboard Layout Editor) JSON
// structures and the normalised geometry output produced by parseKleLayout.
// KleLayout mirrors the KLE serialised format; ParsedKleLayout is the flat, resolved form.
export interface KleKeyboardMetadata {
  name?: string;
  author?: string;
  notes?: string;
  background?: string;
  radii?: string;
  switchMount?: string;
  [key: string]: unknown;
}

export interface KleKeyProps {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  x2?: number;
  y2?: number;
  w2?: number;
  h2?: number;
  r?: number;
  rx?: number;
  ry?: number;
  [key: string]: unknown;
}

export type KleKeyLegend = string;
export type KleRowItem = KleKeyLegend | KleKeyProps;
export type KleRow = KleRowItem[];
export type KleLayout = Array<KleKeyboardMetadata | KleRow>;

export interface ParsedKleKeyGeometry {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  rx: number;
  ry: number;
  label: string;
  code: string;
  w2?: number;
  h2?: number;
  x2?: number;
  y2?: number;
}

export type ParsedKleLayout = ParsedKleKeyGeometry[];
