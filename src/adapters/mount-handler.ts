import type { Request, Response, NextFunction } from 'express';
import { NextResponse } from '@/shims/next-server';
import { requestContext } from '@/lib/request-context';

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
  const url = `${protocol}://${host}${req.originalUrl}`;
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
      init.body = req.body;
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

async function sendWebResponse(webResponse: Response, res: Response): Promise<void> {
  res.status(webResponse.status);

  webResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });

  if (webResponse instanceof NextResponse) {
    for (const cookie of webResponse.getCookieHeaders()) {
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
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mod = await loadModule();
      const handler = mod[req.method as keyof HandlerModule] as
        | RouteHandler
        | undefined;

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
