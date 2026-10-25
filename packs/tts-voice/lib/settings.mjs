/**
 * settings.mjs — TTS 配置的唯一读取入口
 *
 * 为什么需要它：
 *   `.qqbot-extensions` 里每个扩展文件按「文件名」各存一份配置
 *   → outbound/tts-voice.mjs、tools/tts_voice.mjs、commands/tts.mjs 会各读各的，互相看不见。
 *   所以这里**不按扩展文件名找**，而是按固定候选列表依次读、依次合并，
 *   保证面板里填一次，出站/工具/命令三处都生效。
 *
 * 读取顺序（后面的覆盖前面的，即"面板 > 旧配置 > 包内默认"）：
 *   1. 包内 settings.json            ← 随包分发的默认值（可选）
 *   2. 旧版 工具/tts-plugin/tts-config.json ← 兼容迁移，老用户不用重填
 *   3. {dataRoot}/.qqbot-extensions/.state/ext-config/tts-voice.json ← 面板主存
 *   4. 同目录 tts_voice.json / tts.json ← 面板若挂在别的文件上时的兜底
 */
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** 包根目录（lib 的上一级） */
export const PACK_DIR = dirname(HERE);

export const DEFAULT_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

/** 包内默认值：只有这里真正缺省才用得到，面板值永远优先 */
export const DEFAULTS = {
  authMode: 'apiKey',        // apiKey=新版控制台 | legacy=旧版 AppId+AccessToken
  apiKey: '',
  appId: '',
  accessToken: '',
  baseUrl: DEFAULT_URL,
  altBaseUrls: [],
  defaultSpeaker: 'zh_female_vv_uranus_bigtts',
  resourceId: 'auto',
  model: 'seed-tts-2.0-expressive',
  format: 'mp3',
  sampleRate: 24000,
  uid: 'dsh-tts-voice',
  // 情绪/语调总开关：关掉就只合成字面文本（有的音色不支持情感，关掉更稳）
  emotionEnabled: true,
  // 正文里除语音标记外一个字都不剩时，是否只发语音（默认是）
  voiceOnlyEnabled: true,
  outDir: '',
};

/** 从各种 env 里抠出 dataRoot（不同扩展点叫法不同） */
export function dataRootOf(env) {
  const e = env || {};
  const cands = [
    e.dataRoot,
    e.caps && e.caps.dataRoot,
    e.ctx && e.ctx.dataRoot,
    process.env.DSH_QQBOT_DATA_ROOT,
  ];
  for (const c of cands) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  // 兜底：从 DSH_HOME/qqbot-settings 推（qqbot-settings 与 .qqbot-extensions 同级）
  const home = process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || '.', '.dsh');
  const guess = join(home, 'qqbot-settings');
  return existsSync(guess) ? guess : home;
}

/** 配置候选路径（低优先级在前） */
export function settingsCandidates(dataRoot) {
  const list = [
    join(PACK_DIR, 'settings.json'),
    'D:/newwenjianjia/aiwork/鲸鱼娘/工具/tts-plugin/tts-config.json', // 旧版兼容
  ];
  if (dataRoot) {
    const cfgDir = join(dataRoot, '.qqbot-extensions', '.state', 'ext-config');
    list.push(join(cfgDir, 'tts-voice.json'));
    list.push(join(cfgDir, 'tts_voice.json'));
    list.push(join(cfgDir, 'tts.json'));
  }
  return list;
}

function safeReadJson(p) {
  try {
    if (!existsSync(p)) return null;
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return j && typeof j === 'object' ? j : null;
  } catch { return null; }
}

/** 读合并后的配置；`sources` 会告诉你每个字段最后来自哪个文件（排错用） */
export function loadSettings(env) {
  const dataRoot = dataRootOf(env);
  const candidates = settingsCandidates(dataRoot);
  let cfg = { ...DEFAULTS };
  const sources = [];
  for (const p of candidates) {
    const j = safeReadJson(p);
    if (!j) continue;
    // 空串不覆盖有值的（面板里清空某项不该把默认值抹掉）
    for (const [k, v] of Object.entries(j)) {
      if (v === '' || v === null || v === undefined) continue;
      cfg[k] = v;
    }
    sources.push(p);
  }
  if (!cfg.outDir) cfg.outDir = join(PACK_DIR, 'out');
  return { cfg, dataRoot, sources, candidates };
}

/** 音色别名：voice=ja → voicePresets.ja（统一小写匹配） */
export function resolveVoice(cfg, voice) {
  let v = String(voice || '').trim();
  if (!v) return null;

  // 面板下拉的值是「中文名｜voice_type」这种形式（人能看懂），这里剥出真正的 voice_type。
  // 全角｜和半角 | 都认；没有分隔符就当纯 id 用。
  for (const sep of ['｜', '|']) {
    if (v.includes(sep)) {
      const tail = v.split(sep).pop().trim();
      if (tail) { v = tail; break; }
    }
  }

  const presets = cfg.voicePresets || {};
  if (presets[v]) return presets[v];
  const lower = v.toLowerCase();
  if (presets[lower]) return presets[lower];
  return v;
}

/**
 * 选出最终要用的 speaker（★2026-10-26 修）
 *
 * 坑：面板的 select/datalist 存的是「中文名｜voice_type」整串，
 * 而老代码写的是 `resolveVoice(cfg, voice) || cfg.defaultSpeaker` ——
 * voice 为空时 resolveVoice 返回 null，于是**整串原样**拿去当 speaker，
 * 火山直接回 55000000 "resource ID is mismatched with speaker"。
 *
 * 所以 cfg.customSpeaker / cfg.defaultSpeaker 也**必须**过一遍 resolveVoice。
 */
export function pickSpeaker(cfg, override) {
  const fromOverride = resolveVoice(cfg, override);
  if (fromOverride) return fromOverride;
  const fromCustom = resolveVoice(cfg, cfg.customSpeaker);
  if (fromCustom) return fromCustom;
  const fromDefault = resolveVoice(cfg, cfg.defaultSpeaker);
  if (fromDefault) return fromDefault;
  return String(cfg.defaultSpeaker || '');
}

/**
 * Resource-Id 判定（2026-10-19 实测结论，别乱改）：
 *   · `_mars_/_moon_` 结尾的 1.0 音色 必须 seed-tts-1.0，否则 resource mismatched
 *   · `ICL_` 前缀（复刻音色）挂 seed-icl-2.0 会 403（未授权），挂 seed-tts-2.0 反而 200
 *   · `S_` 前缀（复刻 1.0）才走 seed-icl-1.0
 *   面板里手填 resourceId 时一切听面板的。
 */
export function resolveResourceId(cfg, speaker) {
  const sp = String(speaker || cfg.defaultSpeaker || '');
  if (/_(mars|moon)_bigtts$/i.test(sp)) return 'seed-tts-1.0';
  if (cfg.resourceId && cfg.resourceId !== 'auto') return cfg.resourceId;
  if (/^S_/i.test(sp)) return 'seed-icl-1.0';
  return 'seed-tts-2.0';
}

export function hasAuth(cfg) {
  return !!((cfg.appId && cfg.accessToken) || cfg.apiKey);
}

/** 拼鉴权头：旧版三件套优先，其次新版 API Key */
export function buildHeaders(cfg, speaker) {
  const h = { 'Content-Type': 'application/json' };
  if (cfg.appId && cfg.accessToken) {
    h['X-Api-App-Id'] = String(cfg.appId);
    h['X-Api-Access-Key'] = String(cfg.accessToken);
  } else if (cfg.apiKey) {
    h['X-Api-Key'] = String(cfg.apiKey);
  } else {
    throw new Error('还没配置鉴权：请在「TTS 语音合成」设置页填 API Key（或旧版 AppId + AccessToken）');
  }
  const rid = resolveResourceId(cfg, speaker);
  if (rid) h['X-Api-Resource-Id'] = rid;
  h['X-Api-Request-Id'] = randomUUID();
  return h;
}

export function ensureOutDir(cfg) {
  const dir = cfg.outDir || join(PACK_DIR, 'out');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 面板里该展示的鉴权状态（不泄露密钥本体） */
export function describeAuth(cfg) {
  const mode = cfg.appId && cfg.accessToken ? 'legacy' : (cfg.apiKey ? 'apiKey' : 'none');
  const mask = (s) => {
    const t = String(s || '');
    if (!t) return '';
    if (t.length <= 8) return '*'.repeat(t.length);
    return t.slice(0, 4) + '****' + t.slice(-4);
  };
  return {
    mode,
    ok: hasAuth(cfg),
    apiKey: mask(cfg.apiKey),
    appId: cfg.appId ? mask(cfg.appId) : '',
    accessToken: mask(cfg.accessToken),
    speaker: cfg.defaultSpeaker,
    resourceId: resolveResourceId(cfg, cfg.defaultSpeaker),
    model: cfg.model,
  };
}
