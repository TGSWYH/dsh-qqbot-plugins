// 随机抽签（来自扩展包 useful-tools）
// 演示：命令 + 自定义设置面板（面板里可以改签文库）
export const qqbotSettingsPage = {
  title: '抽签 · 设置',
  desc: '改这里的签文，命令抽出的结果就跟着变',
  schema: [
    { key: 'items', type: 'list', label: '签文库', hint: '一行一条，至少 2 条',
      default: ['大吉', '中吉', '小吉', '吉', '末吉', '凶'] },
    { key: 'withEmoji', type: 'bool', label: '带装饰', default: true },
  ],
};

export default {
  name: ['抽签', 'omikuji', 'chouqian'],
  description: '随机抽一签（签文可在扩展面板里自定义）',
  usage: '/抽签',
  handler: (ctx) => {
    const cfg = ctx?.config || {};
    let items = Array.isArray(cfg.items) ? cfg.items.filter(Boolean) : [];
    if (items.length < 2) items = ['大吉', '中吉', '小吉', '吉', '末吉', '凶'];
    const emoji = cfg.withEmoji !== false;
    const pick = items[Math.floor(Math.random() * items.length)];
    const head = emoji ? '🎋 本次抽到：' : '本次抽到：';
    const tail = emoji ? '\n（签文共 ' + items.length + ' 种）' : '';
    return head + pick + tail;
  },
};
