// Boot the NestJS backend via the local Nest CLI so the preview tool can launch
// it without relying on a shell-resolved nest binary.
const path = require('path');
const { spawn } = require('child_process');

const nestBin = path.join(__dirname, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
const args = ['start', '--watch'];

const child = spawn(process.execPath, [nestBin, ...args], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
