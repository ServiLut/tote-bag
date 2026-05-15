const net = require('net');
const { applyStorageHardening } = require('./setup-storage.cjs');

function parsePositiveInt(rawValue, fallback) {
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(parsedValue));
}

function resolveDatabaseTarget() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!connectionString) {
    return null;
  }

  const url = new URL(connectionString);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
  };
}

function waitForTcpConnection(host, port, timeoutMs, retryDelayMs) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = new net.Socket();

      socket.setTimeout(Math.min(retryDelayMs, 5000));

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      const handleFailure = (error) => {
        socket.destroy();

        if (Date.now() >= deadline) {
          reject(error);
          return;
        }

        setTimeout(attempt, retryDelayMs);
      };

      socket.once('error', handleFailure);
      socket.once('timeout', () => {
        handleFailure(new Error(`Timed out connecting to ${host}:${port}`));
      });

      socket.connect(port, host);
    };

    attempt();
  });
}

async function main() {
  const databaseTarget = resolveDatabaseTarget();

  if (databaseTarget) {
    const startupTimeoutMs = parsePositiveInt(
      process.env.STARTUP_DB_WAIT_TIMEOUT_MS,
      30000,
    );
    const retryDelayMs = Math.max(
      250,
      parsePositiveInt(process.env.STARTUP_DB_WAIT_RETRY_DELAY_MS, 1000),
    );

    process.stdout.write(
      `[docker-start] Waiting for database ${databaseTarget.host}:${databaseTarget.port}...\n`,
    );

    await waitForTcpConnection(
      databaseTarget.host,
      databaseTarget.port,
      startupTimeoutMs,
      retryDelayMs,
    );

    process.stdout.write('[docker-start] Database is reachable.\n');
  }

  await applyStorageHardening({
    env: process.env,
    logPrefix: '[docker-start]',
  });

  require('./dist/main.js');
}

main().catch((error) => {
  console.error('[docker-start] Startup failed:', error);
  process.exit(1);
});
