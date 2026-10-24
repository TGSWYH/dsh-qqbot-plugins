// 示例扩展命令（来自扩展包 demo-author）
//
// 演示「扩展自注册设置面板」的完整闭环：
//   · export const qqbotSettingsPage → 面板里出现 ⚙，点开是这些字段
//   · handler(ctx) 里用 ctx.config 读到用户在面板填的值
export const qqbotSettingsPage = {
  title: '打包示例 · 设置',
  desc: '改这里的文字，命令回复就跟着变',
  schema: [
    { key: 'text', type: 'string', label: '回复文字', default: '✅ 扩展包命令跑通了', placeholder: '想让它说什么？' },
    { key: 'times', type: 'number', label: '重复次数', default: 1, hint: '1~5' },
    { key: 'emoji', type: 'bool', label: '带个表情', default: true },
    { key: 'tags', type: 'list', label: '附加标签', hint: '一行一个，会拼在末尾' },
    {
      key: 'style', type: 'select', label: '样式', default: '普通',
      options: ['普通', '加粗边框', '小字'],
    },
  ],
};

export default {
  name: ['打包示例', 'packdemo'],
  description: '演示「扩展包」里的命令 + 自定义设置面板（来自 demo-author 包）',
  usage: '/打包示例',
  handler: (ctx) => {
    // ★ 面板里填的值就在这里（没配过时是 {}）
    const cfg = (ctx?.config || {});
    const text = String(cfg.text || '✅ 扩展包命令跑通了');
    const times = Math.max(1, Math.min(5, Number(cfg.times) || 1));
    const emoji = cfg.emoji !== false;
    const tags = Array.isArray(cfg.tags) ? cfg.tags.filter(Boolean) : [];
    const style = String(cfg.style || '普通');

    const line = emoji ? text : text.replace(/[✅🎉✨]/g, '').trim();
    let body = Array.from({ length: times }, () => line).join('\n');
    if (tags.length) body += '\n' + tags.map((t) => '#' + t).join(' ');
    if (style === '加粗边框') body = '━━━━━━\n' + body + '\n━━━━━━';
    else if (style === '小字') body = '﹙' + body.replace(/\n/g, '﹚\n﹙') + '﹚';

    const raw = String(ctx?.command?.raw ?? '').trim();
    const extra = raw ? `（参数：${raw}）` : '';
    return body + extra + '\n来源：demo-author / 打包示例.mjs';
  },
};
