// Tests for KLE layout parser - verifying geometry accumulation, row offset increments,
// per-key dimension reset, rotation origin handling, secondary geometry fields, and metadata skipping.
import { test, expect } from '@playwright/test';
import { parseKleLayout } from '@keymap-highlight/file-parsers';
import type { KleLayout } from '@keymap-highlight/file-parsers';

test.describe('KLE Layout Parser', () => {
  test.describe('basic single-key parsing', () => {
    test('parses simple 1u key with default dimensions', () => {
      const layout: KleLayout = [['Q']];
      const result = parseKleLayout(layout);
      expect(result.length).toBe(1);
      expect(result[0].label).toBe('Q');
      expect(result[0].code).toBe('Q');
      expect(result[0].w).toBe(1);
      expect(result[0].h).toBe(1);
    });

    test('parses key starting at origin (x=0, y=0) by default', () => {
      const layout: KleLayout = [['A']];
      const result = parseKleLayout(layout);
      expect(result[0].x).toBe(0);
      expect(result[0].y).toBe(0);
    });

    test('parses key with zero rotation by default', () => {
      const layout: KleLayout = [['A']];
      const result = parseKleLayout(layout);
      expect(result[0].rotation).toBe(0);
      expect(result[0].rx).toBe(0);
      expect(result[0].ry).toBe(0);
    });

    test('secondary geometry fields are undefined for plain key', () => {
      const layout: KleLayout = [['A']];
      const result = parseKleLayout(layout);
      expect(result[0].w2).toBeUndefined();
      expect(result[0].h2).toBeUndefined();
      expect(result[0].x2).toBeUndefined();
      expect(result[0].y2).toBeUndefined();
    });
  });

  test.describe('custom width and height', () => {
    test('parses key with custom width', () => {
      const layout: KleLayout = [[{ w: 1.5 }, 'Tab']];
      const result = parseKleLayout(layout);
      expect(result[0].w).toBe(1.5);
      expect(result[0].h).toBe(1);
    });

    test('parses key with custom height', () => {
      const layout: KleLayout = [[{ h: 2 }, 'Enter']];
      const result = parseKleLayout(layout);
      expect(result[0].w).toBe(1);
      expect(result[0].h).toBe(2);
    });

    test('parses key with both custom width and height', () => {
      const layout: KleLayout = [[{ w: 1.5, h: 2 }, 'Enter']];
      const result = parseKleLayout(layout);
      expect(result[0].w).toBe(1.5);
      expect(result[0].h).toBe(2);
    });

    test('resets width to 1 for subsequent key after wide key', () => {
      const layout: KleLayout = [[{ w: 1.5 }, 'Tab', 'Q']];
      const result = parseKleLayout(layout);
      expect(result[0].w).toBe(1.5);
      expect(result[1].w).toBe(1);
    });

    test('resets height to 1 for subsequent key after tall key', () => {
      const layout: KleLayout = [[{ h: 2 }, 'Enter', 'Q']];
      const result = parseKleLayout(layout);
      expect(result[0].h).toBe(2);
      expect(result[1].h).toBe(1);
    });
  });

  test.describe('multiple keys x accumulation', () => {
    test('second key x position equals width of first key', () => {
      const layout: KleLayout = [['Q', 'W']];
      const result = parseKleLayout(layout);
      expect(result[0].x).toBe(0);
      expect(result[1].x).toBe(1);
    });

    test('third key x equals sum of first two key widths', () => {
      const layout: KleLayout = [['Q', 'W', 'E']];
      const result = parseKleLayout(layout);
      expect(result[2].x).toBe(2);
    });

    test('x offset from props adds to accumulated x before key placement', () => {
      const layout: KleLayout = [[{ x: 0.5 }, 'A']];
      const result = parseKleLayout(layout);
      expect(result[0].x).toBe(0.5);
    });

    test('x offset accumulates on top of previous key width', () => {
      const layout: KleLayout = [['Q', { x: 0.25 }, 'W']];
      const result = parseKleLayout(layout);
      expect(result[1].x).toBe(1.25);
    });

    test('wide key advances x by its own width for next key', () => {
      const layout: KleLayout = [[{ w: 2 }, 'Backspace', 'Del']];
      const result = parseKleLayout(layout);
      expect(result[0].x).toBe(0);
      expect(result[1].x).toBe(2);
    });
  });

  test.describe('row offset increments', () => {
    test('second row starts at y=1', () => {
      const layout: KleLayout = [['Q'], ['A']];
      const result = parseKleLayout(layout);
      expect(result[0].y).toBe(0);
      expect(result[1].y).toBe(1);
    });

    test('third row starts at y=2', () => {
      const layout: KleLayout = [['Q'], ['A'], ['Z']];
      const result = parseKleLayout(layout);
      expect(result[2].y).toBe(2);
    });

    test('y offset from props adds to current row y', () => {
      const layout: KleLayout = [[{ y: 0.5 }, 'A']];
      const result = parseKleLayout(layout);
      expect(result[0].y).toBe(0.5);
    });

    test('y offset in second row stacks on row base y', () => {
      const layout: KleLayout = [['Q'], [{ y: 0.25 }, 'A']];
      const result = parseKleLayout(layout);
      expect(result[1].y).toBe(1.25);
    });

    test('x resets to 0 at start of each new row', () => {
      const layout: KleLayout = [['Q', 'W', 'E'], ['A']];
      const result = parseKleLayout(layout);
      expect(result[3].x).toBe(0);
    });
  });

  test.describe('rotation origin handling', () => {
    test('key has rotation angle when r is specified', () => {
      const layout: KleLayout = [[{ r: 15, rx: 5, ry: 2 }, 'A']];
      const result = parseKleLayout(layout);
      expect(result[0].rotation).toBe(15);
    });

    test('key has rx and ry set from rotation origin props', () => {
      const layout: KleLayout = [[{ r: 15, rx: 5, ry: 2 }, 'A']];
      const result = parseKleLayout(layout);
      expect(result[0].rx).toBe(5);
      expect(result[0].ry).toBe(2);
    });

    test('rx resets x position to rx value when rotation origin is set', () => {
      const layout: KleLayout = [[{ rx: 3, ry: 1 }, 'A']];
      const result = parseKleLayout(layout);
      expect(result[0].x).toBe(3);
    });

    test('ry resets y position to ry value when rotation origin is set', () => {
      const layout: KleLayout = [[{ rx: 3, ry: 1 }, 'A']];
      const result = parseKleLayout(layout);
      expect(result[0].y).toBe(1);
    });

    test('rotation angle persists across subsequent keys in same row', () => {
      const layout: KleLayout = [[{ r: 10, rx: 2, ry: 1 }, 'A', 'B']];
      const result = parseKleLayout(layout);
      expect(result[0].rotation).toBe(10);
      expect(result[1].rotation).toBe(10);
    });

    test('x increments from rx base after rotation origin reset', () => {
      const layout: KleLayout = [[{ rx: 3, ry: 1 }, 'A', 'B']];
      const result = parseKleLayout(layout);
      expect(result[0].x).toBe(3);
      expect(result[1].x).toBe(4);
    });
  });

  test.describe('secondary geometry fields (w2/h2/x2/y2)', () => {
    test('w2 is set on key when provided in props', () => {
      const layout: KleLayout = [[{ w: 1.25, w2: 1.5 }, 'Backslash']];
      const result = parseKleLayout(layout);
      expect(result[0].w2).toBe(1.5);
    });

    test('h2 is set on key when provided in props', () => {
      const layout: KleLayout = [[{ h: 2, h2: 1 }, 'Enter']];
      const result = parseKleLayout(layout);
      expect(result[0].h2).toBe(1);
    });

    test('x2 is set on key when provided in props', () => {
      const layout: KleLayout = [[{ x2: -0.25 }, 'Enter']];
      const result = parseKleLayout(layout);
      expect(result[0].x2).toBe(-0.25);
    });

    test('y2 is set on key when provided in props', () => {
      const layout: KleLayout = [[{ y2: 1 }, 'Enter']];
      const result = parseKleLayout(layout);
      expect(result[0].y2).toBe(1);
    });

    test('secondary geometry fields reset to undefined for next key after being set', () => {
      const layout: KleLayout = [[{ w2: 1.5, h2: 2, x2: -0.5, y2: 1 }, 'Enter', 'Q']];
      const result = parseKleLayout(layout);
      expect(result[1].w2).toBeUndefined();
      expect(result[1].h2).toBeUndefined();
      expect(result[1].x2).toBeUndefined();
      expect(result[1].y2).toBeUndefined();
    });

    test('primary w and h are set independently of w2 and h2', () => {
      const layout: KleLayout = [[{ w: 1.5, h: 2, w2: 1.25, h2: 1 }, 'Enter']];
      const result = parseKleLayout(layout);
      expect(result[0].w).toBe(1.5);
      expect(result[0].h).toBe(2);
      expect(result[0].w2).toBe(1.25);
      expect(result[0].h2).toBe(1);
    });
  });

  test.describe('metadata row handling', () => {
    test('skips keyboard metadata object at start of layout', () => {
      const layout: KleLayout = [{ name: 'My Keyboard', author: 'Test' }, ['Q']];
      const result = parseKleLayout(layout);
      expect(result.length).toBe(1);
      expect(result[0].label).toBe('Q');
    });

    test('metadata at start does not affect first row y position', () => {
      const layout: KleLayout = [{ name: 'Test' }, ['Q']];
      const result = parseKleLayout(layout);
      expect(result[0].y).toBe(0);
    });

    test('returns empty array for layout with only metadata', () => {
      const layout: KleLayout = [{ name: 'Empty Board' }];
      const result = parseKleLayout(layout);
      expect(result.length).toBe(0);
    });

    test('returns empty array for empty layout', () => {
      const layout: KleLayout = [];
      const result = parseKleLayout(layout);
      expect(result.length).toBe(0);
    });
  });

  test.describe('multi-row full layout', () => {
    test('parses 3-row layout with correct total key count', () => {
      const layout: KleLayout = [
        ['Q', 'W', 'E'],
        ['A', 'S', 'D'],
        ['Z', 'X', 'C'],
      ];
      const result = parseKleLayout(layout);
      expect(result.length).toBe(9);
    });

    test('first key of each row has correct y values in 3-row layout', () => {
      const layout: KleLayout = [
        ['Q', 'W'],
        ['A', 'S'],
        ['Z', 'X'],
      ];
      const result = parseKleLayout(layout);
      expect(result[0].y).toBe(0);
      expect(result[2].y).toBe(1);
      expect(result[4].y).toBe(2);
    });
  });
});
