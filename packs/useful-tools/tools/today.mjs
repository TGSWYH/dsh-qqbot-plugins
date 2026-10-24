// 今天日期 / 今年第几天（来自扩展包 useful-tools）
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export default {
  name: 'today',
  description: '查今天的日期、星期、以及今年第几天',
  inputSchema: { type: 'object', properties: {} },
  run: async () => {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((d - start) / 86400000) + 1;
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${ymd} 星期${WEEK[d.getDay()]}｜今年第 ${dayOfYear} 天｜${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  },
};
