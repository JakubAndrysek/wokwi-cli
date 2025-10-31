import { execSync } from 'child_process';
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const sha = execSync('git rev-parse --short=12 HEAD').toString().trim();

const installCommands = {
  win32: 'iwr https://wokwi.com/ci/install.ps1 -useb | iex',
  default: 'curl -L https://wokwi.com/ci/install.sh | sh',
};

mkdirSync('dist/bin', { recursive: true });
writeFileSync(
  'dist/bin/version.json',
  JSON.stringify(
    {
      version,
      sha,
      install: installCommands,
    },
    null,
    2,
  ),
);

const cliOptions = {
  platform: 'node',
  entryPoints: ['./src/main.ts'],
  outfile: './dist/cli.cjs',
  bundle: true,
  define: {
    'process.env.WOKWI_CONST_CLI_VERSION': JSON.stringify(version),
    'process.env.WOKWI_CONST_CLI_SHA': JSON.stringify(sha),
  },
};

// Build library exports for use in other packages
const libOptions = {
  platform: 'neutral',
  entryPoints: ['./src/index.ts'],
  outfile: './dist/index.js',
  bundle: true,
  format: 'esm',
  external: ['ws', 'stream', 'path', 'fs', 'url', 'buffer', 'child_process', 'pngjs', 'yaml', '@iarna/toml'],
  define: {
    'process.env.WOKWI_CONST_CLI_VERSION': JSON.stringify(version),
    'process.env.WOKWI_CONST_CLI_SHA': JSON.stringify(sha),
  },
};

// Build both CLI and library
Promise.all([
  build(cliOptions),
  build(libOptions),
]).then(() => {
  // Generate TypeScript declaration files
  console.log('Building TypeScript declarations...');
  execSync('npx tsc --declaration --emitDeclarationOnly --outDir dist --skipLibCheck src/index.ts', { stdio: 'inherit' });
}).catch(() => process.exit(1));
