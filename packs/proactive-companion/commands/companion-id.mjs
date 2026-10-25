/**
 * companion-id.mjs — 获取当前私聊 OpenID 并自动填入主动关怀配置
 *
 * 用法：
 *   /openid   — 获取当前私聊的 OpenID 并自动填入「主动陪伴关怀设置」
 *   /whoami   — 同 /openid
 */

import { bindTargetOpenidFromContext } from '../lib/config.mjs';

export default {
  name: ['openid', 'whoami'],
  description: '获取当前私聊的 OpenID 并自动填入主动陪伴设置',
  usage: '/openid 或 /whoami',
  handler: async (ctx) => {
    const res = bindTargetOpenidFromContext(ctx);
    return res.text;
  },
};
