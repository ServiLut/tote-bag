import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const appRoot = process.cwd();
const lockPath = path.join(appRoot, '.next', 'dev', 'lock');
const devCachePath = path.join(appRoot, '.next', 'dev');

function escapeForPowerShell(value) {
  return value.replace(/'/g, "''");
}

function stopExistingWindowsWebDev() {
  const escapedAppRoot = escapeForPowerShell(appRoot);
  const script = `
$appRoot = '${escapedAppRoot}'
$pattern = [regex]::Escape($appRoot)
$processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Name -eq 'node.exe' -and $_.CommandLine -and (
    $_.CommandLine -match "$pattern\\\\node_modules.*next" -or
    $_.CommandLine -match "$pattern\\\\.next\\\\dev"
  )
}
$ids = @($processes | Select-Object -ExpandProperty ProcessId)
foreach ($id in $ids) {
  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
}
$ids -join ','
`;

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Command', script],
    {
      cwd: appRoot,
      encoding: 'utf8',
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || 'Failed to stop existing web dev process.');
  }

  return result.stdout
    .trim()
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function clearLockIfPresent() {
  if (existsSync(lockPath)) {
    rmSync(lockPath, { force: true });
  }
}

function clearDevCacheIfPresent() {
  if (existsSync(devCachePath)) {
    rmSync(devCachePath, { recursive: true, force: true });
  }
}

if (process.platform === 'win32') {
  const stoppedIds = stopExistingWindowsWebDev();

  if (stoppedIds.length > 0) {
    console.log(`[dev] Stopped existing web dev process(es): ${stoppedIds.join(', ')}`);
  }

  clearLockIfPresent();
  clearDevCacheIfPresent();
}

const child = process.platform === 'win32'
  ? spawn('cmd.exe', ['/c', path.join(appRoot, 'node_modules', '.bin', 'next.CMD'), 'dev'], {
      cwd: appRoot,
      stdio: 'inherit',
    })
  : spawn(path.join(appRoot, 'node_modules', '.bin', 'next'), ['dev'], {
      cwd: appRoot,
      stdio: 'inherit',
    });

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
