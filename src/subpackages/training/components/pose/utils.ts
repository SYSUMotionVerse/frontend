/**
 * WeChat-compatible getNode utility.
 * Use with getCurrentInstance() in uni-app Vue components.
 */
export function getNode<T = any>(
  id: string,
  ctx: any,
): Promise<Array<{ node: T; width: number; height: number }>> {
  return new Promise((resolve) => {
    // @ts-ignore
    wx.createSelectorQuery()
      .in(ctx)
      .select(id)
      .fields({ node: true, rect: true, size: true })
      .exec(resolve as any);
  });
}

/** Bind a native context API to the current uni-app custom component. */
export function createComponentContext<T>(
  componentProxy: any,
  createContext: (component?: any) => T,
): T {
  const nativeComponentScope = componentProxy?.$scope
  return nativeComponentScope
    ? createContext(nativeComponentScope)
    : createContext()
}

/** Object-fit contain math: returns [renderedW, renderedH]. */
export function objectFit(
  imgW: number,
  imgH: number,
  canW: number,
  canH: number,
): [number, number] {
  const canRatio = canW / canH;
  const imgRatio = imgW / imgH;
  if (canRatio > imgRatio) {
    return [canW, canW / imgRatio];
  } else {
    return [canH * imgRatio, canH];
  }
}

/** 1×1 transparent pixel — used for model warmup. */
export const onePixel: ImageData = {
  width: 1,
  height: 1,
  data: new Uint8ClampedArray([0, 0, 0, 1]),
} as unknown as ImageData;
