import assert from 'node:assert/strict';

import { getSmokeConfig, runSmokeChecks } from './smoke-staging.mjs';

function testGetSmokeConfigDefaults() {
  const config = getSmokeConfig({
    SMOKE_API_URL: 'https://api.staging.example.com/api/v1/',
    SMOKE_WEB_URL: 'https://staging.example.com/',
  });

  assert.equal(
    config.normalizedApiBaseUrl,
    'https://api.staging.example.com/api/v1',
  );
  assert.equal(config.normalizedWebBaseUrl, 'https://staging.example.com');
  assert.equal(config.timeoutMs, 10000);
  assert.deepEqual(config.proxyCheck, {
    path: 'ready',
    url: 'https://staging.example.com/api/proxy/ready',
    expectedStatus: 200,
    expectedJsonField: 'status',
    expectedJsonValues: ['ready'],
    authorization: null,
  });
}

function testGetSmokeConfigParameterizedProxy() {
  const config = getSmokeConfig({
    SMOKE_API_URL: 'https://api.staging.example.com/api/v1',
    SMOKE_WEB_URL: 'https://staging.example.com',
    SMOKE_PROXY_PATH: '/profiles/me/',
    SMOKE_PROXY_EXPECT_STATUS: '200',
    SMOKE_PROXY_EXPECT_JSON_FIELD: 'user.role',
    SMOKE_PROXY_EXPECT_JSON_VALUE: 'operator,admin',
    SMOKE_PROXY_AUTHORIZATION: 'Bearer smoke-token',
  });

  assert.deepEqual(config.proxyCheck, {
    path: 'profiles/me',
    url: 'https://staging.example.com/api/proxy/profiles/me',
    expectedStatus: 200,
    expectedJsonField: 'user.role',
    expectedJsonValues: ['operator', 'admin'],
    authorization: 'Bearer smoke-token',
  });
}

async function testRunSmokeChecks() {
  const config = getSmokeConfig({
    SMOKE_API_URL: 'https://api.staging.example.com/api/v1',
    SMOKE_WEB_URL: 'https://staging.example.com',
    SMOKE_PROXY_AUTHORIZATION: 'Bearer smoke-token',
  });

  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      authorization:
        init.headers instanceof Headers
          ? init.headers.get('Authorization')
          : init.headers?.Authorization ?? null,
      accept:
        init.headers instanceof Headers
          ? init.headers.get('Accept')
          : init.headers?.Accept ?? null,
    });

    switch (url) {
      case 'https://api.staging.example.com/api/v1/health':
        return Response.json({ status: 'ok' });
      case 'https://api.staging.example.com/api/v1/ready':
        return Response.json({ status: 'ready' });
      case 'https://staging.example.com/':
        return new Response(null, { status: 200 });
      case 'https://staging.example.com/api/proxy/ready':
        return Response.json({ status: 'ready' });
      default:
        throw new Error(`Unexpected URL in test: ${url}`);
    }
  };

  await runSmokeChecks(config, {
    fetchImpl,
    log: () => undefined,
  });

  assert.deepEqual(calls, [
    {
      url: 'https://api.staging.example.com/api/v1/health',
      method: 'GET',
      authorization: null,
      accept: 'application/json',
    },
    {
      url: 'https://api.staging.example.com/api/v1/ready',
      method: 'GET',
      authorization: null,
      accept: 'application/json',
    },
    {
      url: 'https://staging.example.com/',
      method: 'HEAD',
      authorization: null,
      accept: null,
    },
    {
      url: 'https://staging.example.com/api/proxy/ready',
      method: 'GET',
      authorization: 'Bearer smoke-token',
      accept: 'application/json',
    },
  ]);
}

async function main() {
  testGetSmokeConfigDefaults();
  testGetSmokeConfigParameterizedProxy();
  await testRunSmokeChecks();
  console.log('smoke-staging tests passed');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
