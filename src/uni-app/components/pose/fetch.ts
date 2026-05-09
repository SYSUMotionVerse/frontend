/**
 * TFJS fetch polyfill for WeChat Miniprogram.
 *
 * All model files are loaded from TF Hub via HTTP, so we only need wx.request().
 * Local file reading is NOT supported in WeChat miniprogram (fs.readFile returns
 * permission denied for code-package static assets).
 *
 * Pattern adapted from:
 *   /tmp/MultiPose-MiniProgram/src/tfjs-plugin/fetch.ts
 */
// @ts-ignore
declare const wx: any;

const TEXT_FILE_EXTS = /\.(txt|json|html|xml|csv)$/i;

function parseResponse(
  url: string,
  res: WechatMiniprogram.RequestSuccessCallbackResult,
): Response {
  const header: Record<string, string> = {};
  if (res.header) {
    for (const key of Object.keys(res.header)) {
      header[key.toLowerCase()] = (res.header as any)[key];
    }
  }

  return {
    ok: res.statusCode >= 200 && res.statusCode < 300,
    status: res.statusCode,
    statusText: String(res.statusCode),
    url,
    clone: () => parseResponse(url, res),
    text: () =>
      Promise.resolve(
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
      ),
    json: () => {
      if (typeof res.data === 'object') return Promise.resolve(res.data);
      let json = {};
      try {
        json = JSON.parse(res.data as string);
      } catch (_err) {
        /* leave as {} */
      }
      return Promise.resolve(json);
    },
    arrayBuffer: () => Promise.resolve(res.data as ArrayBuffer),
    headers: {
      keys: () => Object.keys(header),
      entries: () => {
        const all: Array<[string, string]> = [];
        for (const key of Object.keys(header)) {
          all.push([key, header[key]]);
        }
        return all;
      },
      get: (n: string) => header[n.toLowerCase()] ?? null,
      has: (n: string) => n.toLowerCase() in header,
    },
    blob: () => {
      throw new Error('blob() not implemented in WeChat Miniprogram');
    },
    formData: () => {
      throw new Error('formData() not implemented in WeChat Miniprogram');
    },
    redirected: false,
    type: 'basic' as ResponseType,
  } as unknown as Response;
}

export function fetchFunc(
  path: string,
  requestInits?: RequestInit,
): Promise<Response> {
  const opts = requestInits ?? {};
  const isText = TEXT_FILE_EXTS.test(path);
  const dataType: string = isText ? 'text' : 'arraybuffer';

  return new Promise((resolve, reject) => {
    let successed = false;
    const onSuccess = (resp: any) => {
      if (successed) return;
      successed = true;
      resolve(parseResponse(path, resp));
    };

    // @ts-ignore
    wx.request({
      url: path,
      method: (opts.method as any) ?? 'GET',
      data: opts.body,
      header: opts.headers,
      dataType,
      responseType: dataType,
      enableCache: true,
      success: onSuccess,
      fail: (err: any) => reject(new Error(err?.errMsg ?? 'request failed')),
    });
  });
}
