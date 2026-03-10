#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pidFile = path.join(process.cwd(), '.nominaapp.pid');
if (!fs.existsSync(pidFile)) {
  console.log('No PID file found. Nothing to stop.');
  process.exit(0);
}

const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
if (!Number.isFinite(pid) || pid <= 0) {
  console.log('Invalid PID file.');
  process.exit(1);
}

try {
  if (process.platform === 'win32') {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
  } else {
    process.kill(-pid, 'SIGTERM');
  }
  console.log(`Stopped process tree for PID ${pid}.`);
} catch {
  console.log(`Process ${pid} was not running or could not be terminated.`);
}

try {
  fs.unlinkSync(pidFile);
} catch {}

