// /帮我选 —— 在几个选项里挑一个
//
// 用法：
//   /帮我选 火锅 烤肉 寿司
//   /帮我选 火锅，烤肉，寿司        （中文逗号也行）
//   /帮我选 A|B|C                  （竖线也行）
//
// ctx.command.raw 是命令后面的原始参数文本。
const SEP = /[|｜,，、\s]+/;

function parseOptions(raw) {
  return String(raw || '')
    .split(SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default {
  name: ['帮我选', 'pick', 'pickone'],
  description: '在几个选项里随机挑一个（逗号/空格/竖线分隔）',
  usage: '/帮我选 火锅 烤肉 寿司',

  handler: (ctx) => {
    const raw = String((ctx && ctx.command && ctx.command.raw) || '').trim();

    if (!raw) {
      return [
        '给我几个选项我来挑～',
        '用法：/帮我选 火锅 烤肉 寿司',
        '也支持逗号：/帮我选 火锅，烤肉，寿司',
      ].join('\n');
    }

    // 去重（同样的事不用纠结两次）
    const list = [...new Set(parseOptions(raw))];

    if (list.length === 0) return '没解析出选项，试试用空格或逗号隔开。';
    if (list.length === 1) return '只给了一个选项，那还用选吗：' + list[0];

    const pick = list[Math.floor(Math.random() * list.length)];
    const others = list.filter((x) => x !== pick);

    return [
      '🎯 就它了：' + pick,
      others.length ? '（其余 ' + others.length + ' 个先放一边）' : '',
    ].filter(Boolean).join('\n');
  },
};
