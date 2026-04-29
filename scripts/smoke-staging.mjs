#!/usr/bin/env node

const HELP_FLAGS = new Set(['--help', '-h']);

if (process.argv.slice(2).some((flag) => HELP_FLAGS.has(flag))) {
  console.log(`Usage:
  SMOKE_API_URL=https://api.staging.example.com/api/v1 \\
  SMOKE_WEB_URL=https://staging.example.com \\
  node scripts/smoke-staging.mjs

Optional env vars:
  SMOKE_REQUIRE_HEALTH_OK=true   Fail if /health reports "degraded"
  SMOKE_TIMEOUT_MS=10000         Per-request timeout in milliseconds
`);
  process.exit(0);
}

const apiBaseUrl = process.env.SMOKE_API_URL?.trim();
const webBaseUrl = process.env.SMOKE_WEB_URL?.trim();
const requireHealthOk = process.env.SMOKE_REQUIRE_HEALTH_OK === 'true';
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10000);

if (!apiBaseUrl || !webBaseUrl) {
  console.error(
    '[smoke] Missing SMOKE_API_URL or SMOKE_WEB_URL. Run with --help for usage.',
  );
  process.exit(1);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: 'manual',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function expectJson(url, label) {
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }

  const body = await response.json();
  return { response, body };
}

async function expectWebRoot(url) {
  let response = await fetchWithTimeout(url, { method: 'HEAD' });

  if (response.status === 405) {
    response = await fetchWithTimeout(url, { method: 'GET' });
  }

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`web root failed with HTTP ${response.status}`);
  }

  return response;
}

function assertHealth(body) {
  if (body?.status !== 'ok' && body?.status !== 'degraded') {
    throw new Error(`unexpected /health status: ${String(body?.status)}`);
  }

  if (requireHealthOk && body.status !== 'ok') {
    throw new Error('/health is degraded and SMOKE_REQUIRE_HEALTH_OK=true');
  }
}

function assertReady(body) {
  if (body?.status !== 'ready') {
    throw new Error(`unexpected /ready status: ${String(body?.status)}`);
  }
}

async function main() {
  const normalizedApiBaseUrl = normalizeBaseUrl(apiBaseUrl);
  const normalizedWebBaseUrl = normalizeBaseUrl(webBaseUrl);

  const healthUrl = `${normalizedApiBaseUrl}/health`;
  const readyUrl = `${normalizedApiBaseUrl}/ready`;

  console.log(`[smoke] GET ${healthUrl}`);
  const health = await expectJson(healthUrl, '/health');
  assertHealth(health.body);
  console.log(`[smoke] /health -> ${health.body.status}`);

  console.log(`[smoke] GET ${readyUrl}`);
  const ready = await expectJson(readyUrl, '/ready');
  assertReady(ready.body);
  console.log(`[smoke] /ready -> ${ready.body.status}`);

  console.log(`[smoke] HEAD ${normalizedWebBaseUrl}/`);
  const webResponse = await expectWebRoot(`${normalizedWebBaseUrl}/`);
  console.log(`[smoke] web root -> HTTP ${webResponse.status}`);

  console.log('[smoke] Smoke checks passed.');
}

main().catch((error) => {
  console.error(
    `[smoke] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
