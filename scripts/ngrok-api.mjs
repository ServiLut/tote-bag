#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_API_PORT = '4003';
const rootDir = resolve(import.meta.dirname, '..');
const envFileCandidates = [
  resolve(rootDir, 'apps/api/.env'),
  resolve(rootDir, 'apps/api/.env.example'),
];

function getNgrokExecutableCandidates() {
  const candidates = [];
  const explicitNgrokPath = process.env.NGROK_PATH?.trim();

  if (explicitNgrokPath) {
    candidates.push(explicitNgrokPath);
  }

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA?.trim();
    if (localAppData) {
      candidates.push(
        join(
          localAppData,
          'Microsoft',
          'WinGet',
          'Packages',
          'Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe',
          'ngrok.exe',
        ),
      );
    }
  }

  const pathEntries = (process.env.PATH ?? '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of pathEntries) {
    if (/windowsapps/i.test(entry)) {
      continue;
    }

    candidates.push(
      process.platform === 'win32' ? join(entry, 'ngrok.exe') : join(entry, 'ngrok'),
    );
  }

  candidates.push('ngrok');
  return Array.from(new Set(candidates));
}

function resolveNgrokExecutable() {
  for (const candidate of getNgrokExecutableCandidates()) {
    if (candidate === 'ngrok') {
      return candidate;
    }

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return 'ngrok';
}

function readConfiguredPort() {
  const explicitPort = process.env.PORT?.trim();
  if (explicitPort) {
    return explicitPort;
  }

  for (const filePath of envFileCandidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const match = readFileSync(filePath, 'utf8').match(/^\s*PORT\s*=\s*(.+)\s*$/m);
    if (!match) {
      continue;
    }

    const configuredPort = match[1]
      .trim()
      .replace(/^['"]/, '')
      .replace(/['"]$/, '');

    if (configuredPort) {
      return configuredPort;
    }
  }

  return DEFAULT_API_PORT;
}

function ensureNgrokIsRunnable(ngrokExecutable, port) {
  const result = spawnSync(ngrokExecutable, ['version'], {
    encoding: 'utf8',
  });

  if (result.status === 0) {
    return;
  }

  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join('\n')
    .trim();

  const hint =
    process.platform === 'win32'
      ? 'Windows detecto un alias de ngrok no funcional. Instala ngrok de forma real o corrige el App Execution Alias antes de volver a intentarlo.'
      : 'Instala ngrok y asegurate de que el binario este disponible en PATH.';

  console.error(
    `[ngrok:api] No fue posible ejecutar "${ngrokExecutable} version" para exponer el puerto ${port}. ${hint}`,
  );

  if (output) {
    console.error(output);
  }

  process.exit(result.status ?? 1);
}

const port = readConfiguredPort();
const ngrokExecutable = resolveNgrokExecutable();
ensureNgrokIsRunnable(ngrokExecutable, port);

const child = spawnSync(ngrokExecutable, ['http', port, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (child.error) {
  console.error(
    `[ngrok:api] No fue posible iniciar ngrok para el puerto ${port} usando ${ngrokExecutable}: ${child.error.message}`,
  );
  process.exit(1);
}

process.exit(child.status ?? 1);
