// 掷骰子（来自扩展包 useful-tools）
// ⚠️ inputSchema 用 dsh 的扁平写法：属性名 → 类型描述，**不要**包 { type:'object', properties:{...} }
export default {
  name: 'dice',
  description: '掷一颗 N 面骰子（默认 6 面，可指定颗数）',
  inputSchema: {
    sides: { type: 'integer', description: '面数，默认 6' },
    count: { type: 'integer', description: '颗数，默认 1（最多 10）' },
  },
  run: async (args) => {
    const sides = Math.max(2, Math.min(1000, Math.round(Number(args?.sides) || 6)));
    const count = Math.max(1, Math.min(10, Math.round(Number(args?.count) || 1)));
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    const msg = count === 1
      ? `🎲 d${sides} → ${rolls[0]}`
      : `🎲 ${count}×d${sides} → ${rolls.join(' + ')} = ${total}`;
    return { ok: true, msg };
  },
};
