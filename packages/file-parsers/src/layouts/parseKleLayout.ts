// layouts/parseKleLayout.ts - Converts a raw KLE JSON array into a flat list of key geometries.
// Handles per-row position accumulation, rotation origin resets, and secondary key dimensions
// (w2/h2/x2/y2) following the KLE serialisation spec.
import type { KleKeyProps, KleLayout, KleRow, ParsedKleLayout } from './types';

interface RotationState {
  angle: number;
  rx: number;
  ry: number;
}

const DEFAULT_KEY_WIDTH = 1;
const DEFAULT_KEY_HEIGHT = 1;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isKleRow(entry: KleLayout[number]): entry is KleRow {
  return Array.isArray(entry);
}

function isKleKeyProps(entry: KleRow[number]): entry is KleKeyProps {
  return typeof entry === 'object' && entry !== null && !Array.isArray(entry);
}

export function parseKleLayout(layout: KleLayout): ParsedKleLayout {
  const geometry: ParsedKleLayout = [];
  const rotation: RotationState = {
    angle: 0,
    rx: 0,
    ry: 0,
  };

  let rowBaseY = 0;
  let isFirstRow = true;

  for (const rowEntry of layout) {
    if (!isKleRow(rowEntry)) {
      continue;
    }

    if (isFirstRow) {
      isFirstRow = false;
    } else {
      rowBaseY += 1;
    }

    let x = rotation.rx;
    let y = rowBaseY;
    let nextWidth = DEFAULT_KEY_WIDTH;
    let nextHeight = DEFAULT_KEY_HEIGHT;
    let nextW2: number | undefined;
    let nextH2: number | undefined;
    let nextX2: number | undefined;
    let nextY2: number | undefined;
    let hasKeyInRow = false;
    let persistedRowY = y;

    for (const rowItem of rowEntry) {
      if (typeof rowItem === 'string') {
        geometry.push({
          x,
          y,
          w: nextWidth,
          h: nextHeight,
          rotation: rotation.angle,
          rx: rotation.rx,
          ry: rotation.ry,
          label: rowItem,
          code: rowItem,
          w2: nextW2,
          h2: nextH2,
          x2: nextX2,
          y2: nextY2,
        });

        x += nextWidth;
        nextWidth = DEFAULT_KEY_WIDTH;
        nextHeight = DEFAULT_KEY_HEIGHT;
        nextW2 = undefined;
        nextH2 = undefined;
        nextX2 = undefined;
        nextY2 = undefined;
        hasKeyInRow = true;
        continue;
      }

      if (!isKleKeyProps(rowItem)) {
        continue;
      }

      const hasRotationOrigin = isFiniteNumber(rowItem.rx) || isFiniteNumber(rowItem.ry);

      if (isFiniteNumber(rowItem.r)) {
        rotation.angle = rowItem.r;
      }

      if (isFiniteNumber(rowItem.rx)) {
        rotation.rx = rowItem.rx;
      }

      if (isFiniteNumber(rowItem.ry)) {
        rotation.ry = rowItem.ry;
      }

      if (hasRotationOrigin) {
        x = rotation.rx;
        y = rotation.ry;
        persistedRowY = y;
        rowBaseY = y;
        hasKeyInRow = false;
      }

      if (isFiniteNumber(rowItem.x)) {
        x += rowItem.x;
      }

      if (isFiniteNumber(rowItem.y)) {
        y += rowItem.y;
        if (!hasKeyInRow) {
          persistedRowY = y;
          rowBaseY = y;
        }
      }

      if (isFiniteNumber(rowItem.w)) {
        nextWidth = rowItem.w;
      }

      if (isFiniteNumber(rowItem.h)) {
        nextHeight = rowItem.h;
      }

      if (isFiniteNumber(rowItem.w2)) {
        nextW2 = rowItem.w2;
      }

      if (isFiniteNumber(rowItem.h2)) {
        nextH2 = rowItem.h2;
      }

      if (isFiniteNumber(rowItem.x2)) {
        nextX2 = rowItem.x2;
      }

      if (isFiniteNumber(rowItem.y2)) {
        nextY2 = rowItem.y2;
      }
    }

    rowBaseY = persistedRowY;
  }

  return geometry;
}
