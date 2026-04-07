# **ARQUITECTURA EMPRESARIAL**

E-Commerce Platform

NestJS • Next.js • Supabase

**Nivel: Producción Empresarial**

# TABLA DE CONTENIDOS

- Gobierno de Arquitectura
- Configuración Profesional
- Seguridad y Cumplimiento
- Base de Datos y Transaccionalidad
- Backend: NestJS Empresarial
- Frontend: Next.js Optimizado
- Observabilidad y Monitoreo
- Testing Profesional
- CI/CD y Despliegue
- Especificación Funcional: Catálogo de Productos
- Especificación Funcional: Gestión de Pedidos

# 1. GOBIERNO DE ARQUITECTURA

El gobierno de arquitectura define las reglas que evitan el caos técnico a medida que el sistema crece. Sin estas convenciones, cada desarrollador tomará decisiones diferentes.

## 1.1 Convenciones Obligatorias

### Nomenclatura de Archivos

Backend (NestJS):

- Módulos: *.module.ts
- Controladores: *.controller.ts
- Servicios: *.service.ts
- DTOs: *.dto.ts (carpeta dto/)
- Entities: *.entity.ts (carpeta entities/)
- Guards: *.guard.ts (carpeta guards/)
- Interceptors: *.interceptor.ts

Frontend (Next.js):

- Páginas: page.tsx
- Layouts: layout.tsx
- Loading: loading.tsx
- Errores: error.tsx
- Componentes: PascalCase.tsx
- Hooks: use*.ts

### Estructura de DTOs Estandarizada

Todos los DTOs deben seguir este patrón:

import { IsString, IsNumber, IsOptional, IsUUID } from 'class-validator'; import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'; export class CreateProductDto {
  @ApiProperty({ example: 'iPhone 15 Pro' })
  @IsString()
  name: string;

  @ApiProperty({ example: 999.99 })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

### Formato de Respuestas API

TODAS las respuestas de la API deben usar este formato estándar:

// src/common/interfaces/api-response.interface.ts export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    path: string;
    version: string;
  };
} // Ejemplo de uso exitoso { "success": true, "data": { "id": "123", "name": "Product" }, "metadata": { "timestamp": "2025-01-29T10:00:00Z", "path": "/v1/products/123", "version": "1.0" } } // Ejemplo de error { "success": false, "error": { "code": "PRODUCT_NOT_FOUND", "message": "Product with ID 123 not found", "details": { "productId": "123" } }, "metadata": { "timestamp": "2025-01-29T10:00:00Z", "path": "/v1/products/123", "version": "1.0" } }

## 1.2 Versionado de API

⚠️ CRÍTICO: Implementar versionado desde el día 1

Nunca cambies una API sin versionar. Los clientes móviles y terceros dependen de contratos estables.

### Estrategia de Versionado

// main.ts app.setGlobalPrefix('api'); app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', }); // products.controller.ts @Controller({ path: 'products', version: '1', }) export class ProductsControllerV1 {} @Controller({ path: 'products', version: '2', }) export class ProductsControllerV2 {} // URLs resultantes: // GET /api/v1/products // GET /api/v2/products

### Política de Breaking Changes

- Compatible (patch/minor): Agregar campos opcionales, nuevos endpoints
- Breaking (major): Eliminar campos, cambiar tipos, renombrar endpoints
- Deprecación: Marcar como @deprecated 3 meses antes de eliminar
- Documentación: Mantener changelog público en /api/v1/changelog

## 1.3 Catálogo de Códigos de Error

// src/common/errors/error-codes.ts export enum ErrorCode {
  // Autenticación (1xxx)
  INVALID_CREDENTIALS = 'AUTH_1001',
  TOKEN_EXPIRED = 'AUTH_1002',
  INVALID_TOKEN = 'AUTH_1003',
  INSUFFICIENT_PERMISSIONS = 'AUTH_1004',
  // Productos (2xxx)
  PRODUCT_NOT_FOUND = 'PRODUCT_2001',
  PRODUCT_OUT_OF_STOCK = 'PRODUCT_2002',
  INVALID_PRODUCT_DATA = 'PRODUCT_2003',
  // Órdenes (3xxx)
  ORDER_NOT_FOUND = 'ORDER_3001',
  ORDER_ALREADY_PROCESSED = 'ORDER_3002',
  ORDER_CREATION_FAILED = 'ORDER_3003',
  INSUFFICIENT_STOCK = 'ORDER_3004',
  // Pagos (4xxx)
  PAYMENT_FAILED = 'PAYMENT_4001',
  PAYMENT_ALREADY_PROCESSED = 'PAYMENT_4002',
  INVALID_PAYMENT_METHOD = 'PAYMENT_4003',
  // Validación (5xxx)
  VALIDATION_ERROR = 'VALIDATION_5001',
  MISSING_REQUIRED_FIELD = 'VALIDATION_5002',
  // Sistema (9xxx)
  INTERNAL_SERVER_ERROR = 'SYSTEM_9001',
  SERVICE_UNAVAILABLE = 'SYSTEM_9002',
  RATE_LIMIT_EXCEEDED = 'SYSTEM_9003',
}

# 2. CONFIGURACIÓN PROFESIONAL

## 2.1 Gestión de Configuración Centralizada

### Estructura de Configuración

src/config/ 
  ├── database.config.ts 
  ├── auth.config.ts 
  ├── cache.config.ts 
  ├── email.config.ts 
  ├── storage.config.ts 
  ├── payment.config.ts 
  └── app.config.ts

### Validación de Variables de Entorno

// src/config/env.validation.ts import { plainToClass } from 'class-transformer'; import { IsString, IsNumber, IsEnum, validateSync } from 'class-validator'; enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  SUPABASE_URL: string;

  @IsString()
  SUPABASE_KEY: string;

  @IsString()
  JWT_SECRET: string;

  @IsNumber()
  JWT_EXPIRATION: number;

  @IsString()
  REDIS_URL: string;

  @IsString()
  STRIPE_SECRET_KEY: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(
    EnvironmentVariables,
    config,
    { enableImplicitConversion: true },
  );

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}

## 2.2 Configuración por Entorno

.env.development:

NODE_ENV=development PORT=3001 LOG_LEVEL=debug RATE_LIMIT_TTL=60 RATE_LIMIT_LIMIT=100 ENABLE_SWAGGER=true CORS_ORIGIN=<http://localhost:3000>

.env.production:

NODE_ENV=production PORT=3001 LOG_LEVEL=info RATE_LIMIT_TTL=60 RATE_LIMIT_LIMIT=20 ENABLE_SWAGGER=false CORS_ORIGIN=<https://yourdomain.com> ENABLE_COMPRESSION=true ENABLE_HELMET=true

# 3. SEGURIDAD Y CUMPLIMIENTO

⚠️ Esta sección es CRÍTICA para operaciones con dinero real

## 3.1 RBAC (Role-Based Access Control)

### Schema de Permisos en Supabase

-- Tabla de roles CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de permisos CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL, -- 'products', 'orders', 'users'
  action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- Relación roles-permisos CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Relación usuarios-roles CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

### Seed de Roles y Permisos

-- Insertar roles base INSERT INTO roles (name, description) VALUES ('super_admin', 'Acceso total al sistema'), ('admin', 'Administrador de tienda'), ('manager', 'Gestor de inventario y órdenes'), ('customer', 'Cliente regular');

-- Insertar permisos INSERT INTO permissions (resource, action) VALUES ('products', 'create'), ('products', 'read'), ('products', 'update'), ('products', 'delete'), ('orders', 'create'), ('orders', 'read'), ('orders', 'update'), ('orders', 'cancel'), ('users', 'read'), ('users', 'update'), ('users', 'delete'), ('analytics', 'view');

-- Asignar permisos a super_admin (todos) INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'super_admin';

-- Asignar permisos a customer (limitados) INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'customer' AND p.resource IN ('products', 'orders') AND p.action IN ('read', 'create');

### Guard de Permisos en NestJS

// src/common/guards/permissions.guard.ts import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'; import { Reflector } from '@nestjs/core'; @Injectable() export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<Permission[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userPermissions = await this.permissionsService.getUserPermissions(user.id);

    return requiredPermissions.every(permission =>
      userPermissions.some(
        up => up.resource === permission.resource && up.action === permission.action,
      ),
    );
  }
}
// Decorador personalizado export const RequirePermissions = (...permissions: Permission[]) => SetMetadata('permissions', permissions);

// Uso en controlador @Post()
@RequirePermissions({ resource: 'products', action: 'create' })
createProduct() {}

## 3.2 Row Level Security (RLS) en Supabase

Las políticas de RLS protegen los datos a nivel de base de datos, independiente del backend:

-- Habilitar RLS en todas las tablas ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios solo ven sus propias órdenes CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);

-- Política: Los admins ven todo CREATE POLICY "Admins can view all orders" ON orders FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin')
  )
);

-- Política: Productos públicos para lectura CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = true);

-- Política: Solo admins pueden crear/editar productos CREATE POLICY "Admins can manage products" ON products FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin', 'manager')
  )
);

## 3.3 Auditoría y Logging

### Tabla de Auditoría

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas eficientes CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

### Interceptor de Auditoría

// src/common/interceptors/audit.interceptor.ts @Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, ip, headers } = request;

    return next.handle().pipe(
      tap(async (data) => {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          await this.auditService.log({
            userId: user?.id,
            action: method,
            resource: url,
            newData: data,
            ipAddress: ip,
            userAgent: headers['user-agent'],
          });
        }
      }),
    );
  }
}

## 3.4 Rate Limiting Avanzado

// src/common/guards/throttle.guard.ts import { ThrottlerGuard } from '@nestjs/throttler'; @Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Rate limit por usuario autenticado
    if (req.user?.id) {
      return `user-${req.user.id}`;
    }
    // Rate limit por IP para usuarios anónimos
    return req.ip;
  }
}
// Configuración en app.module.ts ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 60000, // 1 minuto
    limit: 10, // 10 requests
  },
  {
    name: 'medium',
    ttl: 600000, // 10 minutos
    limit: 100,
  },
  {
    name: 'long',
    ttl: 3600000, // 1 hora
    limit: 1000,
  },
]),

// Uso en endpoints críticos @Post('login')
@Throttle({ short: { limit: 5, ttl: 60000 } })
async login() {}

@Post('checkout')
@Throttle({ short: { limit: 3, ttl: 60000 } })
async checkout() {}

## 3.5 Cumplimiento Legal (Colombia - Habeas Data)

Para operar en Colombia, el sistema debe cumplir estrictamente con el régimen de protección de datos personales.

### Normativa Aplicable
- **Ley 1581 de 2012**: Disposiciones generales para la protección de datos personales.
- **Decreto 1377 de 2013**: Reglamentación de la ley para el tratamiento de datos.

### Implementación Técnica Obligatoria

1. **Autorización Expresa**: Los formularios de registro y checkout deben incluir un checkbox (no marcado por defecto) para la aceptación de la Política de Tratamiento de Datos.
2. **Registro de Autorización**: Se debe almacenar la fecha, hora e IP donde el usuario aceptó los términos (utilizar la tabla `audit_logs` o extender `users`).
3. **Derechos ARCO**: Implementar endpoints para que el usuario pueda Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos.
4. **Finalidad del Dato**: Los datos recolectados deben limitarse estrictamente a lo necesario para la prestación del servicio de e-commerce y logística.

# 4. BASE DE DATOS Y TRANSACCIONALIDAD

## 4.1 Schema Completo de Producción

El siguiente esquema incluye todas las tablas necesarias con sus relaciones, constraints y triggers:

-- Extensiones necesarias CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsqueda full-text

-- USUARIOS Y AUTENTICACIÓN CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ROLES Y PERMISOS (ya definidos anteriormente)

-- DIRECCIONES CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  address_type VARCHAR(50) DEFAULT 'shipping', -- shipping, billing
  is_default BOOLEAN DEFAULT false,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  company VARCHAR(255),
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(2) NOT NULL, -- ISO code
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- CATEGORÍAS CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- PRODUCTOS CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  short_description VARCHAR(500),
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  compare_price DECIMAL(10, 2) CHECK (compare_price >= price),
  cost DECIMAL(10, 2) CHECK (cost >= 0),
  sku VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

## 4.2 Transacciones Atómicas

⚠️ CRÍTICO: Órdenes, pagos y stock DEBEN ser transaccionales

### Servicio de Órdenes con Transacciones

// src/orders/orders.service.ts @Injectable()
export class OrdersService {
  constructor(
    private supabase: SupabaseService,
    private paymentsService: PaymentsService,
    private inventoryService: InventoryService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    const client = this.supabase.getClient();
    try {
      // Iniciar transacción
      const { data, error } = await client.rpc('create_order_transaction', {
        p_user_id: createOrderDto.userId,
        p_items: createOrderDto.items,
        p_shipping_address: createOrderDto.shippingAddress,
        p_payment_method: createOrderDto.paymentMethod,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      // Rollback automático por PostgreSQL
      throw new OrderCreationException(error);
    }
  }
}
-- Función PostgreSQL para transacción atómica CREATE OR REPLACE FUNCTION create_order_transaction(
  p_user_id UUID,
  p_items JSONB[],
  p_shipping_address JSONB,
  p_payment_method VARCHAR
)
RETURNS TABLE (order_id UUID)
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_variant_id UUID;
  v_quantity INTEGER;
  v_available_stock INTEGER;
BEGIN
  -- 1. Crear orden
  INSERT INTO orders (user_id, shipping_address, payment_method, status)
  VALUES (p_user_id, p_shipping_address, p_payment_method, 'pending')
  RETURNING id INTO v_order_id;

  -- 2. Procesar cada item
  FOREACH v_item IN ARRAY p_items LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_variant_id := (v_item->>'variant_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    -- 2.1. Verificar stock disponible
    IF v_variant_id IS NOT NULL THEN
      SELECT quantity INTO v_available_stock FROM product_variants WHERE id = v_variant_id FOR UPDATE; -- Lock pesimista
    ELSE
      SELECT quantity INTO v_available_stock FROM products WHERE id = v_product_id FOR UPDATE;
    END IF;

    -- 2.2. Validar stock suficiente
    IF v_available_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id USING ERRCODE = 'ORDER_3004';
    END IF;

    -- 2.3. Reducir stock
    IF v_variant_id IS NOT NULL THEN
      UPDATE product_variants SET quantity = quantity - v_quantity WHERE id = v_variant_id;
    ELSE
      UPDATE products SET quantity = quantity - v_quantity WHERE id = v_product_id;
    END IF;

  END LOOP;

  RETURN QUERY SELECT v_order_id;

EXCEPTION WHEN OTHERS THEN
  RAISE; -- Rollback automático
END;
$$ LANGUAGE plpgsql;

## 4.3 Idempotencia en Pagos

Los webhooks de pago pueden llegar múltiples veces. La idempotencia previene cobros duplicados:

-- Tabla de webhook events procesados CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- 'stripe', 'mercadopago'
  event_id VARCHAR(255) NOT NULL UNIQUE, -- ID del evento del proveedor
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

-- Servicio de procesamiento idempotente @Injectable()
export class WebhookService {
  async processStripeWebhook(event: Stripe.Event): Promise<void> {
    const client = this.supabase.getClient();

    // Intentar insertar evento (falla si ya existe)
    const { data, error } = await client
      .from('webhook_events')
      .insert({
        provider: 'stripe',
        event_id: event.id,
        event_type: event.type,
        payload: event,
      })
      .select()
      .single();

    // Si ya fue procesado, salir
    if (error?.code === '23505') { // unique_violation
      this.logger.log(`Event ${event.id} already processed`);
      return;
    }

    try {
      // Procesar evento
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
      }

      // Marcar como procesado
      await client
        .from('webhook_events')
        .update({ processed: true, processed_at: new Date() })
        .eq('event_id', event.id);
    } catch (error) {
      // Registrar error
      await client
        .from('webhook_events')
        .update({ error: error.message })
        .eq('event_id', event.id);
      throw error;
    }
  }
}

# 7. OBSERVABILIDAD Y MONITOREO

'Lo que no se mide, no se puede mejorar.' La observabilidad es crítica para detectar y resolver problemas antes de que afecten a los usuarios.

## 7.1 Logging Estructurado

### Winston + Formato JSON

// src/common/logger/logger.service.ts import * as winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: 'ecommerce-api',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    // En producción: enviar a servicio externo
    process.env.NODE_ENV === 'production' &&
      new winston.transports.Http({
        host: process.env.LOG_HOST,
        path: '/logs',
      }),
  ].filter(Boolean),
});

// Uso logger.info('Order created', { orderId: order.id, userId: user.id, total: order.total, items: order.items.length });
logger.error('Payment failed', { orderId: order.id, error: error.message, paymentProvider: 'stripe' });

## 7.2 Métricas y APM

### Integración con Prometheus

npm install @willsoto/nestjs-prometheus prom-client

// app.module.ts import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
})

// Métricas personalizadas import { Counter, Histogram } from 'prom-client';

const orderCounter = new Counter({
  name: 'orders_total',
  help: 'Total number of orders',
  labelNames: ['status'],
});

const orderValue = new Histogram({
  name: 'order_value',
  help: 'Order value distribution',
  buckets: [10, 50, 100, 500, 1000, 5000],
});

// Uso orderCounter.inc({ status: 'completed' });
orderValue.observe(order.total);

## 7.3 Error Tracking con Sentry

npm install @sentry/node @sentry/tracing

// main.ts import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});

// Captura automática de errores @Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    Sentry.captureException(exception);
    // ... manejo del error
  }
}

## 7.4 Alertas Críticas

Configurar alertas para eventos críticos del negocio:

- Tasa de errores en checkout > 5%
- Pagos fallidos > 10 en 10 minutos
- Tiempo de respuesta API > 2 segundos (p95)
- Stock de productos críticos < threshold
- Tasa de error en webhooks de pago > 2%

# 8. TESTING PROFESIONAL

⚠️ Testing no es opcional cuando hay dinero involucrado

## 8.1 Pirámide de Testing

- 70% Unit Tests - Lógica de negocio, servicios, utilidades
- 20% Integration Tests - Flujos completos con BD
- 10% E2E Tests - Casos de usuario críticos

## 8.2 Tests Unitarios (Backend)

// orders.service.spec.ts describe('OrdersService', () => {
  let service: OrdersService;
  let supabase: SupabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              rpc: jest.fn(),
              from: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('createOrder', () => {
    it('should create order successfully', async () => {
      const mockOrder = { id: 'uuid', total: 100, status: 'pending' };
      jest.spyOn(supabase.getClient(), 'rpc').mockResolvedValue({ data: mockOrder, error: null });

      const result = await service.createOrder(createOrderDto);

      expect(result).toEqual(mockOrder);
      expect(supabase.getClient().rpc).toHaveBeenCalledWith(
        'create_order_transaction',
        expect.any(Object),
      );
    });

    it('should throw error if insufficient stock', async () => {
      jest.spyOn(supabase.getClient(), 'rpc').mockResolvedValue({
        data: null,
        error: { code: 'ORDER_3004' },
      });

      await expect(service.createOrder(createOrderDto))
        .rejects
        .toThrow(InsufficientStockException);
    });
  });
});

## 8.3 Tests de Integración

// checkout.integration.spec.ts describe('Checkout Flow (Integration)', () => {
  let app: INestApplication;
  let supabase: SupabaseClient;

  beforeAll(async () => {
    // Setup test database
    supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY);
    await seedTestData(supabase);

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should complete full checkout flow', async () => {
    // 1. Create user
    const { data: user } = await supabase.auth.signUp({
      email: '<test@example.com>',
      password: 'password123',
    });

    // 2. Add items to cart
    await request(app.getHttpServer())
      .post('/api/v1/cart')
      .set('Authorization', `Bearer ${user.session.access_token}`)
      .send({ productId: 'product-1', quantity: 2 })
      .expect(201);

    // 3. Create order
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${user.session.access_token}`)
      .send({ shippingAddress: mockAddress, paymentMethod: 'card' })
      .expect(201);
    expect(orderRes.body.data.status).toBe('pending');

    // 4. Verify stock was reduced
    const { data: product } = await supabase
      .from('products')
      .select('quantity')
      .eq('id', 'product-1')
      .single();
    expect(product.quantity).toBe(8); // Was 10, reduced by 2

    // 5. Verify cart was cleared
    const { data: cart } = await supabase.from('cart').select('*').eq('user_id', user.id);
    expect(cart).toHaveLength(0);
  });

  afterAll(async () => {
    await cleanTestData(supabase);
    await app.close();
  });
});

## 8.4 Tests E2E (Frontend)

// e2e/checkout.spec.ts (Playwright) import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('should complete purchase successfully', async ({ page }) => {
    // 1. Navigate to product
    await page.goto('/products/iphone-15-pro');

    // 2. Add to cart
    await page.click('[data-testid="add-to-cart"]');
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

    // 3. Go to cart
    await page.click('[data-testid="cart-icon"]');
    await expect(page).toHaveURL('/cart');

    // 4. Proceed to checkout
    await page.click('[data-testid="checkout-button"]');
    await expect(page).toHaveURL('/checkout');

    // 5. Fill shipping info
    await page.fill('[name="email"]', '<test@example.com>');
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="address"]', '123 Main St');
    await page.fill('[name="city"]', 'New York');
    await page.fill('[name="zipCode"]', '10001');

    // 6. Select payment method
    await page.click('[data-testid="payment-card"]');

    // 7. Submit order
    await page.click('[data-testid="place-order"]');

    // 8. Verify success
    await expect(page).toHaveURL(///orders/\w+/);
    await expect(page.locator('h1')).toContainText('Order Confirmed');
  });
});

## 8.5 Cobertura de Tests

Objetivos mínimos de cobertura:

- Services críticos (orders, payments, auth): 90%+
- Services generales: 80%+
- Controllers: 70%+
- Utilities y helpers: 85%+

// package.json "scripts": {
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:integration": "jest --config ./test/jest-integration.json",
  "test:e2e": "playwright test"
}

// jest.config.js module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/main.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    './src/orders/**/*.ts': {
      statements: 90,
    },
    './src/payments/**/*.ts': {
      statements: 90,
    },
  },
};

# 9. CI/CD Y DESPLIEGUE

## 9.1 Pipeline de GitHub Actions

# .github/workflows/backend-ci.yml name: Backend CI/CD

on:
  push:
    branches: [main, develop]
    paths: 
      - 'backend/**'
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - name: Install dependencies
        working-directory: backend
        run: npm ci
      - name: Lint
        working-directory: backend
        run: npm run lint
      - name: Unit Tests
        working-directory: backend
        run: npm run test:cov
      - name: Integration Tests
        working-directory: backend
        run: npm run test:integration
        env:
          SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.TEST_SUPABASE_KEY }}
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker Image
        run: |
          docker build -t ecommerce-backend:latest \
          -f backend/Dockerfile backend/
      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker tag ecommerce-backend:latest ${{ secrets.DOCKER_USERNAME }}/ecommerce-backend:${{ github.sha }}
          docker push ${{ secrets.DOCKER_USERNAME }}/ecommerce-backend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_SERVER }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /app
            docker-compose pull
            docker-compose up -d
            docker-compose exec api npm run migration:run

## 9.2 Estrategia de Despliegue

### Entornos

- Development - Desarrollo local
- Staging - Réplica de producción para QA
- Production - Entorno live

### Estrategia de Rollout

- Blue-Green Deployment para zero downtime
- Canary releases para features de alto riesgo
- Feature flags para habilitar/deshabilitar features
- Rollback automático si health checks fallan

# 10. ESPECIFICACIÓN FUNCIONAL: CATÁLOGO DE PRODUCTOS

Para soportar el modelo de negocio completo, el módulo de productos debe extenderse para manejar complejidad real de e-commerce.

## 10.1 Modelo de Datos del Producto (Extendido)

Para soportar una tienda real, el modelo de producto debe incluir:

- **Pricing**:
  - `price`: Precio de venta actual.
  - `compareAtPrice`: Precio original (para mostrar tachado/oferta).
  - `costPerItem`: Para cálculo de ganancia (interno).
  - `discountPercentage`: Calculado virtualmente.

- **Media**:
  - `media`: Array de objetos { url, type, altText }.
  - Soporte para Video y Modelos 3D.

- **Inventario & Variantes**:
  - SKU autogenerado.
  - Trackeo de inventario multi-ubicación (futuro).
  - Atributos dinámicos (Color, Material, Tamaño).

- **SEO & Organización**:
  - `slug`: URL amigable.
  - `seoTitle` & `seoDescription`.
  - `tags`: Para filtrado.
  - `collections`: Relación N:M.

## 10.2 Requerimientos de UI (Dashboard)

El formulario de creación (`/dashboard/products/new`) debe implementar:

1.  **Carga de Imágenes Drag & Drop**: Subida múltiple con previsualización.
2.  **Gestión de Variantes**: Generador de combinaciones (ej: Color x Talla).
3.  **Pricing Inteligente**: Input de precio y precio de comparación; visualización automática del % de descuento y margen de ganancia.
4.  **SEO Preview**: Cómo se verá en Google.

# 11. ESPECIFICACIÓN FUNCIONAL: GESTIÓN DE PEDIDOS

El sistema de pedidos es el corazón de la operación y debe permitir una gestión fluida desde la compra hasta la entrega.

## 11.1 Modelo de Datos de Orden (Extendido)

- **Estados de Orden**:
  - `PENDIENTE_PAGO`: Creada pero no pagada.
  - `PAGADA`: Pago confirmado, lista para producción.
  - `EN_PRODUCCION`: Enviada al taller/imprenta.
  - `ENVIADA`: Entregada a logística (con # guía).
  - `ENTREGADA`: Cliente final recibió.
  - `CANCELADA`: Reembolsada o anulada.

- **Logística**:
  - `trackingNumber`: Guía de envío.
  - `carrier`: Transportadora (Coordinadora, Interrapidísimo).

## 11.2 Requerimientos de UI (Dashboard)

1.  **Vista de Detalle**: Modal o página con el desglose completo (Items, Totales, Cliente).
2.  **Cambio de Estado Rápido**: Dropdown en la tabla para mover de `PAGADA` a `EN_PRODUCCION` o `ENVIADA`.
3.  **Filtros Avanzados**: Por estado, fecha y cliente.

# CHECKLIST DE LANZAMIENTO

## Antes de Ir a Producción

ARQUITECTURA:

- ✅ Versionado de API implementado (/v1)
- ✅ Convenciones de código documentadas
- ✅ Formato estandarizado de respuestas
- ✅ Catálogo de errores completo

SEGURIDAD:

- ✅ RBAC implementado con roles y permisos
- ✅ RLS habilitado en Supabase
- ✅ Auditoría activada (audit_logs)
- ✅ Rate limiting configurado
- ✅ HTTPS forzado en producción
- ✅ Helmet.js configurado
- ✅ Variables de entorno validadas

BASE DE DATOS:

- ✅ Transacciones atómicas en órdenes
- ✅ Idempotencia en webhooks
- ✅ Índices optimizados
- ✅ Backups automáticos configurados
- ✅ Migrations versionadas

OBSERVABILIDAD:

- ✅ Logging estructurado implementado
- ✅ Sentry configurado
- ✅ Métricas exportadas (Prometheus)
- ✅ Alertas críticas configuradas
- ✅ Dashboard de monitoreo activo

TESTING:

- ✅ Cobertura de tests > 80%
- ✅ Tests críticos (orders, payments) > 90%
- ✅ Tests E2E para flujos principales
- ✅ Tests de carga ejecutados

CI/CD:

- ✅ Pipeline de CI configurado
- ✅ Deploy automático a staging
- ✅ Rollback plan documentado
- ✅ Health checks configurados

LEGAL Y COMPLIANCE:

- ✅ Política de privacidad publicada (Ley 1581 de 2012)
- ✅ Autorización de tratamiento de datos (Decreto 1377 de 2013)
- ✅ Términos y condiciones actualizados
- ✅ Procedimiento de derechos ARCO implementado
- ✅ Cookie consent con normativa local

**ARQUITECTURA LISTA PARA PRODUCCIÓN**

Este documento define una arquitectura empresarial robusta, escalable y preparada para operar con dinero real.
