import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { VersioningType } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetRuntimeDependencyState } from '../src/runtime-dependency-state';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  const originalRedisUrl = process.env.REDIS_URL;
  let queryRawMock: jest.Mock;

  beforeAll(() => {
    process.env.REDIS_URL = '';
  });

  afterAll(() => {
    process.env.REDIS_URL = originalRedisUrl;
    resetRuntimeDependencyState();
  });

  beforeEach(async () => {
    queryRawMock = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRawMock,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(body.status).toBe('degraded');
        expect(typeof body.timestamp).toBe('string');
        expect(typeof body.uptimeSeconds).toBe('number');
        expect(body.dependencies).toEqual({
          cache: {
            status: 'degraded',
            mode: 'memory',
            configured: false,
            reason: 'missing_url',
          },
        });
      });
  });

  it('/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/ready')
      .expect(200)
      .expect(({ body }: { body: Record<string, unknown> }) => {
        expect(queryRawMock).toHaveBeenCalledTimes(1);
        expect(body.status).toBe('ready');
        expect(body.dependencies).toEqual({
          database: 'up',
          cache: {
            status: 'degraded',
            mode: 'memory',
            configured: false,
            reason: 'missing_url',
          },
        });
      });
  });
});
