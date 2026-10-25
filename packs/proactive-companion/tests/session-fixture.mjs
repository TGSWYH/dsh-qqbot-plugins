import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A separate test-only host package: no imports of the live QQ session registry.
export function sessionFixture(root, target, calls = []) {
  const previous = process.env.DSH_PROFILE_DIR;
  const profile = join(root, 'fake-profile');
  const moduleDir = join(profile, 'node_modules', '@zaofan', 'dsh-qqbot', 'dist', 'features');
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(join(profile, 'node_modules', '@zaofan', 'dsh-qqbot', 'package.json'), JSON.stringify({ name: '@zaofan/dsh-qqbot', type: 'module' }));
  const key = 'companion-test-' + root;
  writeFileSync(join(moduleDir, 'session-registry.js'), `export function managersOf() { return globalThis[${JSON.stringify(key)}] || []; }`);
  const manager = {
    dataRoot: root, config: {}, accepted: true,
    findByPeer(scope, peerId) { return scope === 'c2c' && peerId === target ? { scope, peerId } : undefined; },
    async injectToPeer(...args) { calls.push(args); return this.accepted; },
  };
  globalThis[key] = [manager];
  process.env.DSH_PROFILE_DIR = profile;
  return { manager, restore() {
    delete globalThis[key];
    if (previous === undefined) delete process.env.DSH_PROFILE_DIR;
    else process.env.DSH_PROFILE_DIR = previous;
  } };
}
