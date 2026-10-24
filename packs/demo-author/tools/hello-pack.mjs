// 示例扩展工具：证明「扩展包」里的扩展能被面板扫到
// 注意：这只让面板显示；真正要被宿主加载还需要扩展扫描器支持 packs（下一步做）
export default {
  name: 'hello_pack',
  description: '来自示例扩展包的问候工具（演示用）',
  inputSchema: {},
  run: async () => ({ ok: true, msg: '你好，我来自扩展包 demo-author' }),
};
