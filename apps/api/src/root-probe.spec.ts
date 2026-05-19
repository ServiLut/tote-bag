import type { NextFunction, Request, Response } from 'express';
import { createApiProbePayload, rootProbeMiddleware } from './root-probe';

describe('rootProbeMiddleware', () => {
  it('returns a public API probe payload for GET /', () => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const next = jest.fn() as NextFunction;

    rootProbeMiddleware(
      { method: 'GET', path: '/' } as Request,
      { status, json } as unknown as Response,
      next,
    );

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        service: 'tote-bag-api',
        message: 'Tote Bag API is running',
        endpoints: {
          health: '/api/v1/health',
          ready: '/api/v1/ready',
        },
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('continues the request pipeline for non-root paths', () => {
    const next = jest.fn() as NextFunction;

    rootProbeMiddleware(
      { method: 'GET', path: '/api/v1/health' } as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('createApiProbePayload', () => {
  it('uses a stable timestamp from the provided date', () => {
    expect(createApiProbePayload(new Date('2026-05-15T13:34:51.027Z'))).toEqual(
      {
        status: 'ok',
        service: 'tote-bag-api',
        message: 'Tote Bag API is running',
        endpoints: {
          health: '/api/v1/health',
          ready: '/api/v1/ready',
        },
        timestamp: '2026-05-15T13:34:51.027Z',
      },
    );
  });
});
