import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { APP_INTERCEPTOR, APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { SentryModule } from '@sentry/nestjs/setup';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { B2bModule } from './b2b/b2b.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { ProfilesModule } from './profiles/profiles.module';
import { PaymentsModule } from './payments/payments.module';
import { LocationsModule } from './locations/locations.module';
import { AddressesModule } from './addresses/addresses.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditModule } from './audit/audit.module';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { CustomThrottlerGuard } from './common/guards/throttler.guard';
import { validate } from './config/env.validation';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        console.log(
          `[Redis] Connecting to: ${redisUrl ? 'URL provided' : 'MISSING URL'}`,
        );
        return {
          store: (await redisStore({
            url: redisUrl,
            ttl: 600 * 1000,
          })) as unknown as string, // Cast to avoid cache-manager version conflicts with NestJS types
        };
      },
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    PrometheusModule.register({
      path: '/metrics',
    }),
    PrismaModule,
    ProductsModule,
    B2bModule,
    AuthModule,
    OrdersModule,
    ProfilesModule,
    PaymentsModule,
    LocationsModule,
    AddressesModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
