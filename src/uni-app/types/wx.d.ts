/**
 * WeChat Miniprogram global type declarations.
 * @dcloudio/types covers uni.* but the raw wx.* API needs explicit declaration
 * for TypeScript to accept it as a global in mp-weixin builds.
 */
declare namespace WechatMiniprogram {
  interface Wx {
    request(options: any): any;
    createCameraContext(): CameraContext;
    createOffscreenCanvas(options?: any): OffscreenCanvas;
    getSystemInfoSync(): SystemInfo;
    createSelectorQuery(): SelectorQuery;
    getImageInfo(options: any): any;
  }

  interface RequestSuccessCallbackResult {
    data: string | object | ArrayBuffer;
    statusCode: number;
    header?: Record<string, string>;
    errMsg?: string;
  }

  interface SystemInfo {
    windowWidth: number;
    windowHeight: number;
    pixelRatio: number;
  }

  interface SelectorQuery {
    select(id: string): NodeSelector;
    in(ctx: any): SelectorQuery;
    fields(fields: object): SelectorQuery;
    exec(cb: (res: any[]) => void): void;
  }

  interface NodeSelector {
    fields(fields: object): SelectorQuery;
  }

  interface CameraContext {
    onCameraFrame(callback: (frame: CameraFrame) => void): CameraFrameListener;
    takePhoto(options: any): void;
    startRecord(options: any): void;
    stopRecord(options: any): void;
  }

  interface CameraFrame {
    data: ArrayBuffer;
    width: number;
    height: number;
  }

  interface CameraFrameListener {
    start(options?: any): void;
    stop(): void;
  }

  interface OffscreenCanvasImage {
    src: string;
    onload: null | (() => void);
    onerror: null | ((err: any) => void);
  }

  interface OffscreenCanvas {
    getContext(contextType: '2d', options?: any): CanvasRenderingContext2D;
    getContext(contextType: 'webgl', options?: any): WebGLRenderingContext;
    createImage(): OffscreenCanvasImage;
    width: number;
    height: number;
  }
}

declare const wx: WechatMiniprogram.Wx;
