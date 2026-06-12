import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

export interface RequestContext {
  req: ExpressRequest;
  res: ExpressResponse;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}
