import type { NextFunction, Request, Response } from 'express';

export type ApiProbePayload = {
  status: 'ok';
  service: 'tote-bag-api';
  message: string;
  endpoints: {
    health: string;
    ready: string;
  };
  timestamp: string;
};

export function createApiProbePayload(now = new Date()): ApiProbePayload {
  return {
    status: 'ok',
    service: 'tote-bag-api',
    message: 'Tote Bag API is running',
    endpoints: {
      health: '/api/v1/health',
      ready: '/api/v1/ready',
    },
    timestamp: now.toISOString(),
  };
}

function getRequestPath(
  request: Pick<Request, 'originalUrl' | 'path' | 'url'>,
) {
  const rawPath = request.path || request.originalUrl || request.url || '/';
  const [pathname] = rawPath.split('?');

  return pathname || '/';
}

export function rootProbeMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (request.method !== 'GET' || getRequestPath(request) !== '/') {
    next();
    return;
  }

  response.status(200).json(createApiProbePayload());
}
