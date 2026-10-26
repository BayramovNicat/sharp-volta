export interface VirtualWindowOptions {
  totalCount: number;
  getItemHeight: (index: number) => number;
  scrollTop: number;
  clientHeight: number;
  overscanPx?: number;
}

export interface VirtualWindowResult {
  startIndex: number;
  endIndex: number;
  topSpacerHeight: number;
  bottomSpacerHeight: number;
  totalHeight: number;
}

export const calculateVirtualWindow = ({
  totalCount,
  getItemHeight,
  scrollTop,
  clientHeight,
  overscanPx = 400,
}: VirtualWindowOptions): VirtualWindowResult => {
  if (totalCount <= 0) {
    return {
      startIndex: 0,
      endIndex: -1,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      totalHeight: 0,
    };
  }

  const offsets: number[] = new Array(totalCount);
  const heights: number[] = new Array(totalCount);
  let accumulated = 0;

  for (let i = 0; i < totalCount; i++) {
    offsets[i] = accumulated;
    const h = getItemHeight(i);
    heights[i] = h;
    accumulated += h;
  }

  const totalHeight = accumulated;
  const viewTop = Math.max(0, scrollTop - overscanPx);
  const viewBottom = scrollTop + clientHeight + overscanPx;

  let startIndex = 0;
  while (startIndex < totalCount && offsets[startIndex] + heights[startIndex] < viewTop) {
    startIndex++;
  }
  if (startIndex >= totalCount) {
    startIndex = Math.max(0, totalCount - 1);
  }

  let endIndex = startIndex;
  while (endIndex < totalCount - 1 && offsets[endIndex] < viewBottom) {
    endIndex++;
  }

  const topSpacerHeight = offsets[startIndex];
  const bottomSpacerHeight = Math.max(0, totalHeight - (offsets[endIndex] + heights[endIndex]));

  return {
    startIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    totalHeight,
  };
};
