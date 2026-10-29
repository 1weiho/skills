import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Dependencies resolve from the directory the script is run from, so the
// project's own copies are used. pnpm keeps packages that aren't direct
// dependencies (sharp often comes in through Next) only in its store, so
// fall back to looking there.
const root = process.cwd();
const rootRequire = createRequire(path.join(root, 'package.json'));

function load(names, hint) {
  for (const name of names) {
    try {
      return rootRequire(name);
    } catch {}
    const store = path.join(root, 'node_modules/.pnpm');
    if (!existsSync(store)) continue;
    const prefix = `${name.replace('/', '+')}@`;
    const dir = readdirSync(store).find((entry) => entry.startsWith(prefix));
    if (dir) return rootRequire(path.join(store, dir, 'node_modules', name));
  }
  throw new Error(`${names.join(' / ')} not found from ${root}. ${hint}`);
}

const install =
  'Run from a project that has it, or `npm i playwright sharp` in a scratch directory and run the script from there.';

export function loadPlaywright() {
  return load(['playwright', '@playwright/test'], install);
}

export function loadSharp() {
  return load(['sharp'], install);
}

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else {
        flags[key] = next;
        i++;
      }
    } else positional.push(arg);
  }
  return { flags, positional };
}
