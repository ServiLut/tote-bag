import {
  createPrismaPoolConfig,
  getConnectionStringSslMode,
  normalizeDatabaseConnectionString,
  resolveDatabaseSslMode,
  shouldDisableImplicitPreferSsl,
} from './prisma.service';

describe('PrismaService connection config', () => {
  it('inherits SSL from the connection string by default', () => {
    expect(resolveDatabaseSslMode(undefined)).toBe('inherit');
    expect(resolveDatabaseSslMode('inherit')).toBe('inherit');
  });

  it('only strips SSL parameters when DATABASE_SSL=false', () => {
    const connectionString = normalizeDatabaseConnectionString(
      'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
      'disabled',
    );

    expect(connectionString).toContain('schema=tote-bag');
    expect(connectionString).toContain('options=-c+search_path%3Dtote-bag');
    expect(connectionString).not.toContain('sslmode=require');
  });

  it('preserves SSL parameters when DATABASE_SSL is inherited', () => {
    const connectionString = normalizeDatabaseConnectionString(
      'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
      'inherit',
    );

    expect(connectionString).toContain('sslmode=require');
  });

  it('detects sslmode values from the connection string', () => {
    expect(
      getConnectionStringSslMode(
        'postgresql://user:pass@db.example.com:5432/app?sslmode=prefer',
      ),
    ).toBe('prefer');
    expect(
      getConnectionStringSslMode(
        'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
      ),
    ).toBe('require');
    expect(
      getConnectionStringSslMode(
        'postgresql://user:pass@db.example.com:5432/app',
      ),
    ).toBeNull();
  });

  it('disables implicit sslmode=prefer outside production', () => {
    expect(
      shouldDisableImplicitPreferSsl(
        'postgresql://user:pass@db.example.com:5432/app?sslmode=prefer',
        'inherit',
        'development',
      ),
    ).toBe(true);
    expect(
      shouldDisableImplicitPreferSsl(
        'postgresql://user:pass@db.example.com:5432/app?sslmode=prefer',
        'inherit',
        'production',
      ),
    ).toBe(false);
  });

  it('enables explicit SSL pool config only when DATABASE_SSL=true', () => {
    const enabled = createPrismaPoolConfig({
      DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/app',
      DATABASE_SSL: 'true',
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'false',
    });
    const inherited = createPrismaPoolConfig({
      DATABASE_URL:
        'postgresql://user:pass@db.example.com:5432/app?sslmode=require',
    });

    expect(enabled.ssl).toEqual({ rejectUnauthorized: false });
    expect(inherited.ssl).toBeUndefined();
  });

  it('coerces inherited sslmode=prefer to plain TCP in development', () => {
    const config = createPrismaPoolConfig({
      NODE_ENV: 'development',
      DATABASE_URL:
        'postgresql://user:pass@db.example.com:5432/app?sslmode=prefer',
    });

    expect(config.ssl).toBe(false);
    expect(config.connectionString).toContain('schema=tote-bag');
    expect(config.connectionString).not.toContain('sslmode=prefer');
  });
});
