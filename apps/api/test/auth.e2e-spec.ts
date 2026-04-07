import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  closeTestApp,
  createTestApp,
  getTestServer,
} from './helpers/create-test-app';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    forgotPassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const setup = await createTestApp({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });

    app = setup.app;
  });

  afterEach(async () => {
    await closeTestApp(app);
  });

  it('POST /api/v1/auth/register valida payload y reenvia ip al servicio', async () => {
    authService.register.mockResolvedValue({
      user: { id: 'user-1', email: 'demo@tote.com' },
    });

    const response = await request(getTestServer(app))
      .post('/api/v1/auth/register')
      .set('x-forwarded-for', '203.0.113.10')
      .send({
        email: 'demo@tote.com',
        password: 'secret123',
        acceptTerms: true,
        acceptDataPolicy: true,
      })
      .expect(201);

    expect((response.body as { user: { email: string } }).user.email).toBe(
      'demo@tote.com',
    );

    expect(authService.register).toHaveBeenCalledWith(
      {
        email: 'demo@tote.com',
        password: 'secret123',
        acceptTerms: true,
        acceptDataPolicy: true,
      },
      expect.any(String),
    );
  });

  it('POST /api/v1/auth/login rechaza payload invalido', async () => {
    await request(getTestServer(app))
      .post('/api/v1/auth/login')
      .send({
        email: 'correo-invalido',
      })
      .expect(400);

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('POST /api/v1/auth/forgot-password llama al servicio con email valido', async () => {
    authService.forgotPassword.mockResolvedValue({
      message: 'ok',
    });

    await request(getTestServer(app))
      .post('/api/v1/auth/forgot-password')
      .send({
        email: 'demo@tote.com',
      })
      .expect(200);

    expect(authService.forgotPassword).toHaveBeenCalledWith('demo@tote.com');
  });
});
