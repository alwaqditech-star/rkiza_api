import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import { NextResponse } from '../shims/next-server';
import { requestContext } from '../lib/request-context';

type RouteHandler = (
  request: globalThis.Request,
  context?: { params: Record<string, string> | Promise<Record<string, string>> },
) => Promise<globalThis.Response>;

type HandlerModule = {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  DELETE?: RouteHandler;
  PATCH?: RouteHandler;
};

function buildWebRequest(req: Request): globalThis.Request {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost';
  let pathWithQuery = req.originalUrl || req.url || '/';

  if (!pathWithQuery.includes('?') && req.query && Object.keys(req.query).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        for (const item of value) searchParams.append(key, String(item));
      } else if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    }
    const query = searchParams.toString();
    if (query) pathWithQuery += `?${query}`;
  }

  const url = `${protocol}://${host}${pathWithQuery}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      init.body = new Uint8Array(req.body);
    } else if (typeof req.body === 'object' && req.body !== null) {
      init.body = JSON.stringify(req.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    } else if (typeof req.body === 'string') {
      init.body = req.body;
    }
  }

  return new globalThis.Request(url, init);
}

async function sendWebResponse(
  webResponse: globalThis.Response,
  res: ExpressResponse,
): Promise<void> {
  res.status(webResponse.status);

  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });

  if (webResponse instanceof NextResponse) {
    for (const cookie of (webResponse as NextResponse).getCookieHeaders()) {
      res.append('Set-Cookie', cookie);
    }
  }

  const buffer = Buffer.from(await webResponse.arrayBuffer());
  if (buffer.length > 0) {
    res.send(buffer);
    return;
  }

  res.end();
}

export function mountHandler(
  loadModule: () => Promise<HandlerModule>,
  paramNames: string[] = [],
) {
  return async (req: Request, res: ExpressResponse, next: NextFunction) => {
    try {
      const mod = await loadModule();
      const method = req.method.toUpperCase() as keyof HandlerModule;
      const handler = mod[method] as RouteHandler | undefined;

      if (!handler) {
        res.status(405).json({ success: false, message: 'الطريقة غير مدعومة' });
        return;
      }

      const params: Record<string, string> = {};
      for (const name of paramNames) {
        const value = req.params[name];
        if (value !== undefined) params[name] = String(value);
      }

      await requestContext.run({ req, res }, async () => {
        const webRequest = buildWebRequest(req);
        const webResponse = await handler(webRequest, {
          params: Promise.resolve(params),
        });
        await sendWebResponse(webResponse, res);
      });
    } catch (error) {
      next(error);
    }
  };
}
