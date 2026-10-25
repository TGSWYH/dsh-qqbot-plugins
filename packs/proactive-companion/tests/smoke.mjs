import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import companionCommand from '../commands/companion.mjs';
import companionTool from '../tools/companion_manage.mjs';
import daemon from '../hooks/companion-daemon.mjs';
import {
  getExtConfigPath,
  readExtConfig,
  resolveTargetOpenid,
  writeExtConfig,
} from '../lib/config.mjs';

const root = mkdtempSync(join(tmpdir(), 'proactive-companion-'));
const env = {
  dataRoot: root,
  caps: { owners: ['owner-openid'] },
  logger: { info() {}, warn() {} },
};
const store = {
  value: {},
  async load() { return this.value; },
  async save(value) { this.value = { ...value }; },
};

function commandCtx(raw, extra = {}) {
  return {
    env,
    store,
    isOwner: true,
    command: { raw },
    ...extra,
  };
}

try {
  // Configuration is rooted at env.dataRoot and target resolution is fail-closed.
  assert.equal(resolveTargetOpenid(env, { targetOpenid: 'legacy-target' }, { targetOpenid: 'panel-target' }), 'panel-target');
  assert.equal(resolveTargetOpenid({ dataRoot: root, caps: { owners: [] } }, {}, {}), '');
  writeExtConfig(env, { targetOpenid: 'owner-openid', displayName: '测试主人', dailyMax: 7 });
  assert.equal(existsSync(getExtConfigPath(env)), true);
  assert.equal(readExtConfig(env).displayName, '测试主人');

  // Command parsing uses ctx.command.raw and writes to ext-config.
  const setResult = await companionCommand.handler(commandCtx('set max 7'));
  assert.match(setResult, /每日最大关怀次数上限设为 7/);
  assert.equal(readExtConfig(env).dailyMax, 7);
  const statusResult = await companionCommand.handler(commandCtx('status'));
  assert.match(statusResult, /目标主人/);

  // Zero cooldown must persist through command parsing and config normalization.
  await companionCommand.handler(commandCtx('set interval 0'));
  assert.equal(readExtConfig(env).minIntervalHours, 0);
  await companionCommand.handler(commandCtx('set interval -1'));
  assert.equal(readExtConfig(env).minIntervalHours, 0);

  // Unauthorized command and tool calls fail closed.
  const deniedCommand = await companionCommand.handler({ ...commandCtx('set max 9'), isOwner: false });
  assert.match(deniedCommand, /仅主人/);
  const deniedTool = await companionTool.run({ action: 'get' }, { env, store, isOwner: false });
  assert.equal(deniedTool.ok, false);

  // Tool contract is run(input, context), and trigger_now records only after send succeeds.
  const sent = [];
  const toolCtx = {
    env,
    store,
    isOwner: true,
    text: async (...args) => sent.push(args),
  };
  const triggerResult = await companionTool.run({ action: 'trigger_now' }, toolCtx);
  assert.equal(triggerResult.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(readExtConfig(env).dailyCount, 1);
  assert.equal(readExtConfig(env).lastBubbleTs > 0, true);

  // A failed send must not consume quota or cooldown.
  const beforeFailed = readExtConfig(env);
  const failedResult = await companionTool.run({ action: 'trigger_now' }, {
    env,
    store,
    isOwner: true,
    text: async () => { throw new Error('send failed'); },
  });
  assert.equal(failedResult.ok, false);
  const afterFailed = readExtConfig(env);
  assert.equal(afterFailed.dailyCount, beforeFailed.dailyCount);
  assert.equal(afterFailed.lastBubbleTs, beforeFailed.lastBubbleTs);

  // Daemon lifecycle is idempotent and can be disposed without waiting 15 seconds.
  await daemon.run({ ...env, store });
  await daemon.run({ ...env, store });
  await daemon.dispose();

  // No-history startup must not send immediately; daemon can still start cleanly.
  const historyPath = join(root, '.qqbot', 'msg-history', 'c2c_owner-openid');
  mkdirSync(historyPath, { recursive: true });
  writeFileSync(join(historyPath, `${new Date().toISOString().slice(0, 10)}.jsonl`), '', 'utf8');

  console.log('PASS proactive-companion smoke tests');
} finally {
  rmSync(root, { recursive: true, force: true });
}
