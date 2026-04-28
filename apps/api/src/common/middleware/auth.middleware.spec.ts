import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { Role } from '../../generated/client/enums';
import { DebugRoleContextService } from '../context/debug-role-context.service';
import { AuthMiddleware, RequestWithUser } from './auth.middleware';

const getUserMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

describe('AuthMiddleware', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL' || key === 'NEXT_PUBLIC_SUPABASE_URL') {
        return 'https://supabase.test';
      }
      if (
        key === 'SUPABASE_ANON_KEY' ||
        key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      ) {
        return 'anon-key';
      }
      return undefined;
    }),
  } as unknown as ConfigService;

  const tx = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  const debugRoleRun = jest.fn(
    (_debugRole: Role | null, callback: () => void) => callback(),
  );
  const debugRoleContext = {
    run: debugRoleRun,
  } as unknown as DebugRoleContextService;

  let middleware: AuthMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new AuthMiddleware(
      configService,
      prisma as never,
      debugRoleContext,
    );
  });

  it('preserva el rol existente para usuarios no whitelisteados', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'operator@empresa.com',
        },
      },
      error: null,
    });
    tx.user.findUnique.mockResolvedValue({
      role: Role.MANAGER,
      isActive: true,
    });
    tx.user.upsert.mockResolvedValue({});

    const req = {
      method: 'GET',
      url: '/shipping/shipments',
      headers: {
        authorization: 'Bearer valid-token',
      },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, {} as Response, next);

    const upsertCalls = tx.user.upsert.mock.calls as Array<
      [{ update: { role: Role }; create: { role: Role } }]
    >;
    const upsertArg = upsertCalls[0][0];

    expect(upsertArg).toBeDefined();

    expect(upsertArg.update.role).toBe(Role.MANAGER);
    expect(upsertArg.create.role).toBe(Role.MANAGER);
    expect(next).toHaveBeenCalled();
  });

  it('eleva a rol whitelisteado cuando el email corresponde', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-2',
          email: 'totebagbolsadetela@gmail.com',
        },
      },
      error: null,
    });
    tx.user.findUnique.mockResolvedValue({
      role: Role.CUSTOMER,
      isActive: true,
    });
    tx.user.upsert.mockResolvedValue({});

    const req = {
      method: 'GET',
      url: '/profiles/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, {} as Response, next);

    const whitelistedUpsertCalls = tx.user.upsert.mock.calls as Array<
      [{ update: { role: Role }; create: { role: Role } }]
    >;
    const upsertArg = whitelistedUpsertCalls[0][0];

    expect(upsertArg).toBeDefined();
    expect(upsertArg.update.role).toBe(Role.MANAGER);
    expect(upsertArg.create.role).toBe(Role.MANAGER);
    expect(next).toHaveBeenCalled();
  });

  it('fuerza ADMIN para la cuenta protegida e ignora rol QA', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-3',
          email: 'deybisasprilla@gmail.co',
        },
      },
      error: null,
    });
    tx.user.findUnique.mockResolvedValue({
      role: Role.CUSTOMER,
      isActive: true,
    });
    tx.user.upsert.mockResolvedValue({});

    const req = {
      method: 'GET',
      url: '/profiles/me',
      headers: {
        authorization: 'Bearer valid-token',
        'x-debug-role': Role.CUSTOMER,
      },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, {} as Response, next);

    const protectedAdminUpsertCalls = tx.user.upsert.mock.calls as Array<
      [{ update: { role: Role }; create: { role: Role } }]
    >;
    const upsertArg = protectedAdminUpsertCalls[0][0];

    expect(upsertArg).toBeDefined();
    expect(upsertArg.update.role).toBe(Role.ADMIN);
    expect(upsertArg.create.role).toBe(Role.ADMIN);
    expect(debugRoleRun).toHaveBeenCalledWith(null, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('ignora x-debug-role fuera de development', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-4',
          email: 'deybisasprilla@gmail.com',
        },
      },
      error: null,
    });
    tx.user.findUnique.mockResolvedValue({
      role: Role.ADMIN,
      isActive: true,
    });
    tx.user.upsert.mockResolvedValue({});

    const req = {
      method: 'GET',
      url: '/profiles/me',
      headers: {
        authorization: 'Bearer valid-token',
        'x-debug-role': Role.ADMIN,
      },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, {} as Response, next);

    expect(debugRoleRun).toHaveBeenCalledWith(null, expect.any(Function));
    expect(next).toHaveBeenCalled();
  });

  it('no adjunta req.user cuando la cuenta local esta inactiva', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'user-5',
          email: 'cliente@empresa.com',
        },
      },
      error: null,
    });
    tx.user.findUnique.mockResolvedValue({
      role: Role.CUSTOMER,
      isActive: false,
      email: 'cliente@empresa.com',
    });
    tx.user.upsert.mockResolvedValue({});

    const req = {
      method: 'GET',
      url: '/profiles/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    } as unknown as RequestWithUser;
    const next = jest.fn() as NextFunction;

    await middleware.use(req, {} as Response, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
