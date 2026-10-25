/**
 * tts.mjs — /tts 命令：状态自检、试听、临时换音色
 *
 * 为什么命令也要自己读配置：
 *   命令的 ctx.config 是**本文件**（tts.json）的配置，
 *   而设置页声明在 outbound/tts-voice.mjs 上（存 tts-voice.json）——两者不是一份。
 *   所以统一走 lib/settings.mjs 读合并后的配置，避免"面板里明明填了却读不到"。
 */
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  loadSettings, buildHeaders, resolveVoice, resolveResourceId, pickSpeaker,
  ensureOutDir, describeAuth, DEFAULT_URL,
} from '../lib/settings.mjs';

const NAME = ['tts', '语音'];

const GUIDE = [
  '【TTS 语音合成 · 用法】',
  '',
  '① 最常用：直接在正文里写标记，出站时自动变语音',
  '   [语音合成]主人早上好～[/语音合成]',
  '   [语音合成|撒娇]人家还想再睡五分钟嘛[/语音合成]',
  '   [语音合成 情绪=开心 语速=1.1 音量=1.1]来了来了！[/语音合成]',
  '',
  '② 指令',
  '   /tts            看当前状态（鉴权有没有配好、音色、配置文件位置）',
  '   /tts status     同上',
  '   /tts test 你好  合成一条立刻发出来（验证鉴权通不通）',
  '   /tts voice zh_female_xxx_bigtts   用指定音色试听一句',
  '   /tts guide      这份说明',
  '',
  '③ 配置在哪',
  '   面板：QQ 机器人扩展 → ⚙ 设置 →「TTS 语音合成 · 火山方舟」',
  '   也能用工具 tts_voice(action="status" / "emotions" / "test") 查',
  '',
  '④ 音色 ID 从哪来',
  '   火山方舟控制台 → 语音技术 → 音色管理，复制你要的音色 ID 填进设置页。',
].join('\n');

function fmtStatus(env) {
  const { cfg, sources, candidates, dataRoot } = loadSettings(env);
  const st = describeAuth(cfg);
  const lines = [];
  lines.push('【TTS 状态】');
  lines.push(st.ok
    ? `鉴权：✅ 已配置（${st.mode === 'legacy' ? '旧版 AppId + AccessToken' : '新版 API Key'}）`
    : '鉴权：❌ 还没配 —— 去设置页填 API Key，或用旧版 AppId + AccessToken');
  if (st.apiKey) lines.push(`  API Key：${st.apiKey}`);
  if (st.appId) lines.push(`  AppId：${st.appId}`);
  if (st.accessToken) lines.push(`  AccessToken：${st.accessToken}`);
  lines.push(`音色：${cfg.customSpeaker || cfg.defaultSpeaker}`);
  lines.push(`Resource-Id：${st.resourceId}${cfg.resourceId === 'auto' ? '（按音色自动判定）' : '（手工指定）'}`);
  lines.push(`模型：${st.model}`);
  lines.push(`格式/采样率：${cfg.format || 'mp3'} / ${cfg.sampleRate || 24000}`);
  lines.push(`输出目录：${cfg.outDir}`);
  lines.push(`dataRoot：${dataRoot || '(未识别)'}`);
  lines.push('');
  lines.push('实际读到的配置（后者覆盖前者）：');
  lines.push(...(sources.length ? sources.map((x) => '  · ' + x) : ['  （一个都没有 → 全用包内默认值）']));
  if (!sources.length) {
    lines.push('');
    lines.push('将会尝试这些路径：');
    lines.push(...candidates.map((x) => '  - ' + x));
  }
  return lines.join('\n');
}

/** 合成一段并直接发语音（命令侧发送） */
async function synthAndSend(env, text, voiceOverride) {
  const { cfg } = loadSettings(env);
  if (!describeAuth(cfg).ok) {
    return { ok: false, msg: '鉴权还没配。去「TTS 语音合成 · 火山方舟」设置页填 API Key（或 AppId + AccessToken）。' };
  }
  const speaker = pickSpeaker(cfg, voiceOverride);
  const urls = [cfg.baseUrl || DEFAULT_URL, ...(Array.isArray(cfg.altBaseUrls) ? cfg.altBaseUrls : [])].filter(Boolean);
  let lastErr = null;

  for (const url of urls) {
    try {
      const body = JSON.stringify({
        user: { uid: cfg.uid || 'dsh-tts-voice' },
        req_params: {
          text,
          speaker,
          model: cfg.model || 'seed-tts-2.0-expressive',
          additions: JSON.stringify({ use_tag_parser: true }),
          audio_params: {
            format: cfg.format || 'mp3',
            sample_rate: Number(cfg.sampleRate) || 24000,
          },
        },
      });
      const resp = await fetch(url, { method: 'POST', headers: buildHeaders(cfg, speaker), body });
      const raw = await resp.text();
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${raw.slice(0, 200)}`);

      // 兼容单 JSON 与多行 JSON 分片
      let audio = null;
      try {
        const j = JSON.parse(raw);
        if (j && typeof j.data === 'string' && j.data) {
          if (j.code && j.code !== 0 && j.code !== 20000000) throw new Error(`code=${j.code} ${j.message || ''}`);
          audio = Buffer.from(j.data, 'base64');
        }
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
      if (!audio) {
        const chunks = [];
        for (const line of raw.split('\n')) {
          const s = line.trim();
          if (!s) continue;
          let ev = null;
          try { ev = JSON.parse(s); } catch { continue; }
          if (ev && typeof ev.data === 'string' && ev.data) chunks.push(Buffer.from(ev.data, 'base64'));
          if (ev && ev.code && ev.code !== 0 && ev.code !== 20000000) throw new Error(`TTS 失败 code=${ev.code} ${ev.message || ''}`);
        }
        if (chunks.length) audio = Buffer.concat(chunks);
      }
      if (!audio) throw new Error(`没有音频数据：${raw.slice(0, 160)}`);

      const outDir = ensureOutDir(cfg);
      const path = join(outDir, `cmd_${Date.now()}.${cfg.format || 'mp3'}`);
      writeFileSync(path, audio);

      // 发送：优先 sender，其次 caps
      let sent = false;
      const target = env?.replyTarget || env?.target;
      if (env?.sender && typeof env.sender.sendMedia === 'function' && target) {
        for (const kind of ['voice', 'file']) {
          try { await env.sender.sendMedia(target, kind, { localPath: path }); sent = true; break; } catch { /* 试下一个 kind */ }
        }
      }
      if (!sent && env?.caps && typeof env.caps.sendMedia === 'function') {
        sent = await env.caps.sendMedia({ path, kind: 'voice' });
      }
      return {
        ok: true,
        msg: sent
          ? `已合成并发出（音色 ${speaker}）：${text}`
          : `已合成但没找到发送通道，音频在：${path}`,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  return { ok: false, msg: `合成失败：${(lastErr && lastErr.message) || lastErr}` };
}

export default {
  name: NAME,
  description: '火山方舟语音合成：/tts 看状态，/tts test 文本 试听，/tts voice <音色ID> 换音色试听',
  usage: '/tts [status|test 文本|voice 音色ID|guide]',
  handler: async (ctx) => {
    const raw = String(ctx?.args?.raw ?? ctx?.args?.join?.(' ') ?? '').trim();
    const args = raw ? Array.isArray(ctx?.args) ? ctx.args : raw.split(/\s+/) : [];
    const sub = String(args[0] || 'status').toLowerCase();
    const rest = args.slice(1).join(' ').trim();

    if (sub === 'guide' || sub === 'help' || sub === '帮助') return GUIDE;
    if (sub === 'status' || sub === '状态') return fmtStatus(ctx);

    if (sub === 'test' || sub === '测试') {
      const text = rest || '主人早上好～这是火山方舟的语音测试，听见了就回人家一声嘛。';
      const r = await synthAndSend(ctx, text);
      return (r.ok ? '✅ ' : '❌ ') + r.msg;
    }

    if (sub === 'voice' || sub === '音色') {
      if (!rest) return '用法：/tts voice <音色ID>　例：/tts voice zh_female_tianmeixiaoyuan_moon_bigtts\n（只影响这一次试听，要永久换去设置页改「默认音色」）';
      const r = await synthAndSend(ctx, '这是这个音色的试听效果，好听吗？', rest);
      return (r.ok ? '✅ ' : '❌ ') + r.msg;
    }

    // 其它一律当"直接试听这段文字"
    const r = await synthAndSend(ctx, raw);
    return (r.ok ? '✅ ' : '❌ ') + r.msg;
  },
};
