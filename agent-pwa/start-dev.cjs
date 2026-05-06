// Boot Vite from this directory so the preview tool can launch it without
// relying on shell-resolved npm/npx.
const path = require('path');
const { spawn } = require('child_process');

const viteBin = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
const args = process.argv.slice(2);

const child = spawn(process.execPath, [viteBin, ...args], {
  cwd: __dirname,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
