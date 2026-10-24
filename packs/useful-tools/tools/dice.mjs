// 掷骰子（来自扩展包 useful-tools）
export default {
  name: 'dice',
  description: '掷一颗 N 面骰子（默认 6 面，支持多颗）',
  inputSchema: {
    type: 'object',
    properties: {
      sides: { type: 'number', description: '面数，默认 6' },
      count: { type: 'number', description: '颗数，默认 1（最多 10）' },
    },
  },
  run: async (args) => {
    const sides = Math.max(2, Math.min(1000, Number(args?.sides) || 6));
    const count = Math.max(1, Math.min(10, Number(args?.count) || 1));
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
    const total = rolls.reduce((a, b) => a + b, 0);
    if (count === 1) return `🎲 d${sides} → ${rolls[0]}`;
    return `🎲 ${count}×d${sides} → ${rolls.join(' + ')} = ${total}`;
  },
};
