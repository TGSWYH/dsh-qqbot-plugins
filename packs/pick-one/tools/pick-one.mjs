// 帮我选（来自扩展包 pick-one）
// 从一个列表里随机挑一项。
//
// ⚠️ inputSchema 用 dsh 的扁平写法：属性名 → 类型描述。
//    不要包成标准 JSON Schema 的 { type: 'object', properties: {...} }，
//    那样会被 defineTool 拒绝：
//    unsupported JSON schema: parameters.type must be a value schema object
export default {
  name: 'pick_one',
  description: '从一个选项列表里随机挑一个（做决定用）',
  inputSchema: {
    options: { type: 'array', items: { type: 'string' }, description: '候选选项列表，至少 2 个' },
    exclude: { type: 'array', items: { type: 'string' }, description: '要排除的选项（可选）' },
  },
  run: async (args) => {
    let list = Array.isArray(args && args.options) ? args.options.map((s) => String(s).trim()).filter(Boolean) : [];
    const ex = Array.isArray(args && args.exclude) ? args.exclude.map((s) => String(s).trim()) : [];
    if (ex.length) list = list.filter((x) => !ex.includes(x));
    if (list.length === 0) return { ok: false, msg: '没有可选项：options 为空或全被 exclude 排掉了' };
    if (list.length === 1) return { ok: true, msg: '只剩一个选不了，就是它：' + list[0] };

    const pick = list[Math.floor(Math.random() * list.length)];
    return {
      ok: true,
      msg: '🎯 选中：' + pick + '\n（候选 ' + list.length + ' 个）',
      pick,
      candidates: list,
    };
  },
};
