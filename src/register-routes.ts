import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Express, RequestHandler } from 'express';
import { mountHandler } from '@/adapters/mount-handler';

interface DiscoveredRoute {
  expressPath: string;
  modulePath: string;
  paramNames: string[];
}

function segmentToExpress(segment: string): { pattern: string; param?: string } {
  if (segment.startsWith('[') && segment.endsWith(']')) {
    const name = segment.slice(1, -1);
    return { pattern: `:${name}`, param: name };
  }
  return { pattern: segment };
}

function discoverRoutes(
  directory: string,
  urlSegments: string[] = [],
  paramNames: string[] = [],
): DiscoveredRoute[] {
  const routes: DiscoveredRoute[] = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      const mapped = segmentToExpress(entry.name);
      const nextParams = mapped.param
        ? [...paramNames, mapped.param]
        : paramNames;
      routes.push(
        ...discoverRoutes(fullPath, [...urlSegments, mapped.pattern], nextParams),
      );
      continue;
    }

    if (!/^route\.(t|j)s$/.test(entry.name)) continue;

    const expressPath = `/api/${urlSegments.join('/')}`.replace(/\/+/g, '/');
    routes.push({
      expressPath,
      modulePath: fullPath,
      paramNames,
    });
  }

  return routes;
}

export function registerApiRoutes(app: Express, handlersRoot: string): number {
  const routes = discoverRoutes(handlersRoot);
  const methods: Array<'get' | 'post' | 'put' | 'delete' | 'patch'> = [
    'get',
    'post',
    'put',
    'delete',
    'patch',
  ];

  for (const route of routes) {
    const moduleUrl = pathToFileURL(route.modulePath).href;
    const handler = mountHandler(() => import(moduleUrl), route.paramNames);

    for (const method of methods) {
      (app[method] as (path: string, ...handlers: RequestHandler[]) => Express)(
        route.expressPath,
        handler,
      );
    }
  }

  return routes.length;
}
