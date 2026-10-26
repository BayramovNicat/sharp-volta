import { describe, expect, test } from 'bun:test';
import { calculateVirtualWindow } from '../src/utils/virtual-window';

describe('calculateVirtualWindow', () => {
  test('handles empty count', () => {
    const res = calculateVirtualWindow({
      totalCount: 0,
      getItemHeight: () => 50,
      scrollTop: 100,
      clientHeight: 500,
    });

    expect(res.startIndex).toBe(0);
    expect(res.endIndex).toBe(-1);
    expect(res.topSpacerHeight).toBe(0);
    expect(res.bottomSpacerHeight).toBe(0);
    expect(res.totalHeight).toBe(0);
  });

  test('calculates correct start and end indices with uniform heights', () => {
    const itemHeight = 60;
    const totalCount = 100;

    const res = calculateVirtualWindow({
      totalCount,
      getItemHeight: () => itemHeight,
      scrollTop: 1200,
      clientHeight: 600,
      overscanPx: 200,
    });

    // viewTop = 1000, viewBottom = 2000
    // item 16 ends at 17 * 60 = 1020 >= 1000 -> startIndex = 16
    expect(res.startIndex).toBe(16);
    expect(res.topSpacerHeight).toBe(16 * 60);

    // item 33 starts at 33 * 60 = 1980 < 2000, so endIndex extends to 34 to cover the viewport edge
    expect(res.endIndex).toBe(34);
    expect(res.bottomSpacerHeight).toBe((totalCount - (34 + 1)) * 60);

    const renderedCount = res.endIndex - res.startIndex + 1;
    expect(res.topSpacerHeight + renderedCount * itemHeight + res.bottomSpacerHeight).toBe(
      totalCount * itemHeight
    );
  });

  test('calculates correct window with variable heights', () => {
    const heights = [30, 100, 45, 200, 60, 80, 50, 120, 90, 70];
    const totalCount = heights.length;
    const totalHeight = heights.reduce((a, b) => a + b, 0);

    const res = calculateVirtualWindow({
      totalCount,
      getItemHeight: (i) => heights[i],
      scrollTop: 200,
      clientHeight: 300,
      overscanPx: 50,
    });

    const renderedHeight = heights
      .slice(res.startIndex, res.endIndex + 1)
      .reduce((a, b) => a + b, 0);

    expect(res.topSpacerHeight + renderedHeight + res.bottomSpacerHeight).toBe(totalHeight);
    expect(res.totalHeight).toBe(totalHeight);
  });
});
