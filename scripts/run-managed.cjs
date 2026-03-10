#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const args = process.argv.slice(3);
const pidFile = path.join(process.cwd(), '.nominaapp.pid');
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(npxCmd, ['next', mode, ...args], {
  stdio: 'inherit',
  shell: false,
});

fs.writeFileSync(pidFile, String(child.pid));

function killTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // Ignore cleanup failures
  }
}

function cleanupAndExit(code = 0) {
  killTree(child.pid);
  try {
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  } catch {}
  process.exit(code);
}

process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));
child.on('exit', (code) => cleanupAndExit(code || 0));

