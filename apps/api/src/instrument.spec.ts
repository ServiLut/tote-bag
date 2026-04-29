const initMock = jest.fn();
const nodeProfilingIntegrationMock = jest.fn(() => ({
  name: 'profiling',
}));

jest.mock('@sentry/nestjs', () => ({
  init: initMock,
}));

jest.mock('@sentry/profiling-node', () => ({
  nodeProfilingIntegration: nodeProfilingIntegrationMock,
}));

import { getSentryInitOptions, initializeSentry } from './instrument';

describe('instrument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('usa defaults conservadores en produccion y sin PII por defecto', () => {
    const options = getSentryInitOptions({
      NODE_ENV: 'production',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    });

    expect(options).toMatchObject({
      dsn: 'https://public@example.ingest.sentry.io/1',
      environment: 'production',
      tracesSampleRate: 0.05,
      profilesSampleRate: 0,
      sendDefaultPii: false,
    });
    expect(options?.integrations).toBeUndefined();
    expect(nodeProfilingIntegrationMock).not.toHaveBeenCalled();
  });

  it('permite overrides explicitos y normaliza sample rates invalidos', () => {
    const options = getSentryInitOptions({
      NODE_ENV: 'production',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
      SENTRY_TRACES_SAMPLE_RATE: '2',
      SENTRY_PROFILES_SAMPLE_RATE: '0.5',
      SENTRY_SEND_DEFAULT_PII: 'true',
      SENTRY_ENVIRONMENT: 'staging',
    });

    expect(options).toMatchObject({
      environment: 'staging',
      tracesSampleRate: 1,
      profilesSampleRate: 0.5,
      sendDefaultPii: true,
    });
    expect(options?.integrations).toEqual([{ name: 'profiling' }]);
    expect(nodeProfilingIntegrationMock).toHaveBeenCalledTimes(1);
  });

  it('solo inicializa Sentry cuando hay DSN', () => {
    initializeSentry({ NODE_ENV: 'production' });
    initializeSentry({
      NODE_ENV: 'production',
      SENTRY_DSN: 'https://public@example.ingest.sentry.io/1',
    });

    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@example.ingest.sentry.io/1',
      }),
    );
  });
});
