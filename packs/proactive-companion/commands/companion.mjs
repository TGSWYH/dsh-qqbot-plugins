/**
 * companion.mjs — 主动陪伴与私聊智能关怀管理斜杠命令
 *
 * 用法：
 *   /companion                    — 查看当前状态与今日冒泡统计（双路线并行面板）
 *   /companion on / off           — 启用或停用主动关怀总开关
 *   /companion test               — 手动触发一次主动关怀演练
 *   /companion set idle 3         — 设置空闲多少小时触发关怀（默认 3 小时，0 使用分钟阈值）
 *   /companion set minutes 30     — 设置空闲分钟数并切换至分钟模式
 *   /companion set window on/off  — 开启或关闭作息时段关怀路线
 *   /companion set poke on/off    — 开启或关闭空闲超时冒泡路线
 *   /companion set max 5          — 设置每天最多关怀次数（默认 5 次，0 无上限）
 *   /companion set interval 2.5   — 设置两次关怀最小间隔小时数
 *   /companion set dnd 23:30 08:30 — 设置夜间免打扰时段
 */

import { isOwnerContext, normalizeConfig, readExtConfig, redactOpenid, resolveTargetOpenid, writeExtConfig } from '../lib/config.mjs';
import { sendCompanionText } from '../lib/transport.mjs';

function parseNumber(value, integer = false, allowZero = false) {
  const text = String(value ?? '').trim();
  if (!text || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return null;
  const num = Number(text);
  return Number.isFinite(num) && (allowZero ? num >= 0 : num > 0) && (!integer || Number.isInteger(num)) ? num : null;
}

function isValidTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function formatHours(ms) {
  if (ms <= 0) return '0 小时';
  const h = (ms / (3600 * 1000)).toFixed(1);
  return `${h} 小时`;
}

export default {
  name: ['companion', '关怀', '主动陪伴'],
  description: '查看或管理私聊主动陪伴与关怀双驱动策略（作息问候 + 空闲冒泡）',
  usage: '/companion [status|on|off|test|set <key> <val>]',
  handler: async (ctx) => {
    if (!isOwnerContext(ctx)) return '【主动陪伴】仅主人可以查看或修改陪伴设置。';

    const raw = String(ctx?.command?.raw ?? ctx?.rawArgs ?? ctx?.args ?? '').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    const sub = (parts[0] || 'status').toLowerCase();

    const env = ctx?.env || ctx;
    const today = new Date().toISOString().slice(0, 10);

    // 读写存储
    const store = ctx.store;
    let state = {};
    try {
      if (store && typeof store.load === 'function') {
        state = (await store.load()) || {};
      }
    } catch {
      state = {};
    }

    // 同时读取 ext-config 覆盖项
    try {
      state = { ...state, ...readExtConfig(env) };
    } catch {}

    const conf = normalizeConfig({
      ...state,
      targetOpenid: resolveTargetOpenid(env, state),
    });
    if (conf.dailyDate !== today) {
      conf.dailyDate = today;
      conf.dailyCount = 0;
      conf.greetedWindowsToday = [];
    }

    async function save() {
      writeExtConfig(env, conf);
    }

    if (sub === 'on') {
      conf.enabled = true;
      conf.consecutiveBubblesWithoutReply = 0;
      await save();
      return '【主动陪伴】已开启。将在私聊空闲与关键作息节点适时主动向你问候关怀~';
    }

    if (sub === 'off') {
      conf.enabled = false;
      await save();
      return '【主动陪伴】已停用。机器人将不再在私聊中主动冒泡发消息。';
    }

    if (sub === 'test') {
      const blocked = async (reason, message) => {
        conf.lastCheckTs = Date.now();
        conf.lastCheckReason = reason;
        await save();
        return message;
      };
      if (!conf.targetOpenid) return blocked('missing_target', '【主动陪伴】演练失败：未配置有效的主人 OpenID。');
      if (conf.mutedDate === today) return blocked('muted_today', '【主动陪伴】演练失败：今天已设为免打扰。');
      if (conf.dailyMax > 0 && conf.dailyCount >= conf.dailyMax) return blocked('daily_limit', '【主动陪伴】演练失败：今日主动关怀额度已用尽。');
      const lastBubble = Number(conf.lastBubbleTs || 0);
      if (lastBubble && Date.now() - lastBubble < conf.minIntervalHours * 3600000) return blocked('cooldown', '【主动陪伴】演练失败：仍在主动关怀冷却时间内。');
      try {
        await sendCompanionText({ ...ctx, ...env }, conf.targetOpenid, `悄悄戳一下${conf.displayName}~ 主动陪伴演练测试成功啦！随时都在呢~`);
      } catch (error) {
        conf.lastCheckTs = Date.now();
        conf.lastCheckReason = 'send_failed';
        conf.lastSendError = String(error?.message || error);
        await save();
        return `【主动陪伴】演练失败：${conf.lastSendError}`;
      }
      conf.lastBubbleTs = Date.now();
      conf.dailyCount += 1;
      conf.consecutiveBubblesWithoutReply += 1;
      conf.lastCheckTs = conf.lastBubbleTs;
      conf.lastCheckReason = 'manual_sent';
      conf.lastSendError = '';
      await save();
      return '【主动陪伴】演练触发成功！已向私聊通道发送主动问候。';
    }

    if (sub === 'set') {
      const key = (parts[1] || '').toLowerCase();
      const val = parts[2];
      if (!key || val == null) {
        return '用法说明：\n/companion set idle <小时数，0 使用分钟阈值>\n/companion set minutes <分钟数，默认 30>\n/companion set window <on|off>\n/companion set poke <on|off>\n/companion set max <每天最大次数，0 无上限>\n/companion set interval <最小冷却小时数>\n/companion set dnd <HH:mm> <HH:mm>';
      }

      if (key === 'idle') {
        const num = parseNumber(val, false, true);
        if (num == null) return '错误：idle 小时数必须为非负数；0 使用分钟阈值';
        conf.idleHoursThreshold = num;
        await save();
        return num === 0 ? `【主动陪伴】已切换为分钟模式：空闲满 ${conf.idleMinutesThreshold} 分钟主动搭话。` : `【主动陪伴】已将空闲超时触发时间设为 ${num} 小时。`;
      }

      if (key === 'minutes') {
        const num = parseNumber(val);
        if (num == null) return '错误：minutes 分钟数必须为正数';
        conf.idleHoursThreshold = 0;
        conf.idleMinutesThreshold = num;
        await save();
        return `【主动陪伴】已将空闲超时触发时间设为 ${num} 分钟。`;
      }

      if (key === 'window') {
        const normalized = String(val).toLowerCase();
        if (!['on', 'off', '1', '0', 'true', 'false'].includes(normalized)) return '错误：window 只接受 on/off';
        const on = normalized === 'on' || normalized === '1' || normalized === 'true';
        conf.windowGreetingEnabled = on;
        await save();
        return `【主动陪伴】作息时段关怀路线已${on ? '开启' : '关闭'}。`;
      }

      if (key === 'poke') {
        const normalized = String(val).toLowerCase();
        if (!['on', 'off', '1', '0', 'true', 'false'].includes(normalized)) return '错误：poke 只接受 on/off';
        const on = normalized === 'on' || normalized === '1' || normalized === 'true';
        conf.idlePokeEnabled = on;
        await save();
        return `【主动陪伴】空闲超时主动冒泡路线已${on ? '开启' : '关闭'}。`;
      }

      if (key === 'max') {
        const num = parseNumber(val, true, true);
        if (num == null) return '错误：每天最大关怀次数必须为非负整数；0 表示无上限';
        conf.dailyMax = num;
        await save();
        return num === 0 ? '【主动陪伴】每日关怀次数已设为无上限。' : `【主动陪伴】已将每日最大关怀次数上限设为 ${num} 次。`;
      }

      if (key === 'interval') {
        const num = parseNumber(val, false, true);
        if (num == null) return '错误：最小间隔必须为非负数，0 表示关闭冷却';
        conf.minIntervalHours = num;
        await save();
        return `【主动陪伴】已将两次关怀的最小间隔设为 ${num} 小时。`;
      }

      if (key === 'dnd') {
        const end = parts[3];
        if (!isValidTime(val) || !isValidTime(end)) {
          return '错误：免打扰格式应为 /companion set dnd 23:30 08:30';
        }
        conf.dndStart = val;
        conf.dndEnd = end;
        await save();
        return `【主动陪伴】免打扰时段已更新为 ${val} ~ ${end}。`;
      }

      return `未知设置项: ${key}`;
    }

    // 默认 status: 输出详细双驱动面板
    const now = Date.now();
    const idleDurationMs = conf.lastInteractionTs ? (now - conf.lastInteractionTs) : 0;
    const greeted = conf.greetedWindowsToday || [];

    const lines = [
      `🌟 【主动陪伴与私聊关怀状态】`,
      `总开关：${conf.enabled ? '🟢 已启用' : '🔴 已停用'}`,
      `目标主人：${redactOpenid(conf.targetOpenid)}`, 
      ``,
      `⏰ 【路线一：作息时段关怀】${conf.windowGreetingEnabled ? '🟢 开启' : '⚪ 关闭'}`,
      `  • 早安问候：${conf.morningEnabled ? '已开' : '已关'} (${conf.morningStart}~${conf.morningEnd}) ${greeted.includes('morning') ? '✅今日已问候' : '⏳未触发'}`,
      `  • 午后提神：${conf.afternoonEnabled ? '已开' : '已关'} (${conf.afternoonStart}~${conf.afternoonEnd}) ${greeted.includes('afternoon') ? '✅今日已问候' : '⏳未触发'}`,
      `  • 傍晚提醒：${conf.eveningEnabled ? '已开' : '已关'} (${conf.eveningStart}~${conf.eveningEnd}) ${greeted.includes('evening') ? '✅今日已问候' : '⏳未触发'}`,
      `  • 晚安陪伴：${conf.nightEnabled ? '已开' : '已关'} (${conf.nightStart}~${conf.nightEnd}) ${greeted.includes('night') ? '✅今日已问候' : '⏳未触发'}`,
      ``,
      `💬 【路线二：空闲超时冒泡】${conf.idlePokeEnabled ? '🟢 开启' : '⚪ 关闭'}`,
      `  • 设定阈值：连续空闲满 ${conf.idleHoursThreshold === 0 ? `${conf.idleMinutesThreshold} 分钟` : `${conf.idleHoursThreshold} 小时`}主动搭话`,
      `  • 当前空闲时长：${formatHours(idleDurationMs)}`,
      ``,
      `🛡️ 【频控与免打扰保护】`,
      `  • 今日已关怀次数：${conf.dailyCount} / ${conf.dailyMax === 0 ? '无上限' : conf.dailyMax}`,
      `  • 今日静音：${conf.mutedDate === today ? '已开启' : '未开启'}`,
      `  • 两次关怀最小冷却：${conf.minIntervalHours} 小时`,
      `  • 夜间免打扰时段：${conf.dndStart} ~ ${conf.dndEnd}`,
      `  • 连续无应答次数：${conf.consecutiveBubblesWithoutReply}${conf.consecutiveBubblesWithoutReply >= 2 ? ' (💤已触发休眠熔断)' : ''}`,
      ``,
      `🔎 【运行诊断】`,
      `  • 最近检查原因：${conf.lastCheckReason || '暂无'}`,
      `  • 最近发送错误：${conf.lastSendError || '无'}`,
      ``,
      `💡 提示：支持在 DSH「设置中心」中可视化调节各时段开关与时间，或使用 /companion set 指令。`
    ];

    return lines.join('\n');
  }
};
