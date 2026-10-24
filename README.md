# DSH QQ 机器人插件市场

这是 [dsh-qqbot](https://github.com/zaofan-make/dsh-qqbot) 的**插件索引仓库**。
机器人面板里的「市场」页签读的就是本仓库根目录的 `index.json`。

## 收录规则

每个插件是仓库里一个**独立目录**（约定放在 `packs/<id>/`），目录结构与机器人本地的
`extension-packs/<id>/` 完全一致：

```
packs/<id>/
  qqbot-pack.json        # 可选：{ name, author, version, description, homepage }
  tools/*.mjs            # 模型可调用的工具
  commands/*.mjs         # / 开头的斜杠命令
  hooks/ inbound/ outbound/ botplay/
```

然后在 `index.json` 的 `plugins` 里加一条：

```json
{
  "id": "your-pack",
  "name": "你的扩展包",
  "author": "你的名字",
  "version": "1.0.0",
  "description": "一句话介绍",
  "repo": "zaofan-make/dsh-qqbot-plugins",
  "path": "packs/your-pack",
  "tags": ["工具", "示例"],
  "kinds": ["tools", "commands"],
  "files": ["qqbot-pack.json", "tools/hello.mjs", "commands/hello.mjs"],
  "cover": "https://raw.githubusercontent.com/zaofan-make/dsh-qqbot-plugins/main/packs/your-pack/cover.png"

}
```

`files` **必填**，列出 `path` 目录下**所有文件**（相对路径）。装的时候按这个清单逐个下载，
不走 GitHub 目录 API —— 那个接口在墙内连不上。

`cover` 可选，指向仓库里的图片（png/jpg/webp），面板会把它当卡片封面。

## 工具怎么写

```js
// tools/hello.mjs
export default {
  name: 'hello_pack',
  description: '打个招呼',
  inputSchema: { name: { type: 'string', description: '名字' } },   // ← 扁平写法！
  run: async (args) => `你好，${args.name || '世界'}`,
};
```

> ⚠️ ** 是 dsh 的扁平写法**：直接 ，
> **不要**包成标准 JSON Schema 的 （会被  以
>  拒掉）。

## 命令怎么写

```js
// commands/hello.mjs
export default {
  name: ['hello', '你好'],           // 可以是数组（多个别名）
  description: '打招呼',
  usage: '/hello [名字]',
  handler: (ctx) => `你好呀 ${ctx?.command?.raw || ''}`,   // ← 是 handler，不是 run；返回字符串
};
```

## 自定义设置面板（可选）

在文件里再导出一个 `qqbotSettingsPage`，面板里就会出现 ⚙，用户填的值会存成配置，
执行时通过 `ctx.config` 读到：

```js
export const qqbotSettingsPage = {
  title: '我的设置',
  schema: [
    { key: 'text',  type: 'string', label: '回复文字', default: '你好' },
    { key: 'times', type: 'number', label: '重复次数', default: 1 },
    { key: 'on',    type: 'bool',   label: '启用',     default: true },
    { key: 'tags',  type: 'list',   label: '标签' },
    { key: 'mode',  type: 'select', label: '模式', options: ['普通', '高级'] },
  ],
};
```

## 提交新插件

直接提 PR：加 `packs/<id>/` 目录，并在 `index.json` 里补一条。

## 许可

各插件版权归各自作者，本仓库仅作索引与分发。

## 怎么提交自己的插件

**只加目录，不要改 `index.json`**（它由 Action 自动生成）：

```
packs/你的插件id/          ← id 只能用字母数字-_
  qqbot-pack.json          ← 元信息（必填）
  cover.png                ← 可选，卡片封面（自动探测）
  tools/xxx.mjs            ← 可选，给 AI 调用的工具
  commands/yyy.mjs         ← 可选，/命令
```

`qqbot-pack.json` 长这样：

```json
{
  "name": "我的插件",
  "author": "你的名字",
  "version": "1.0.0",
  "description": "一句话说明",
  "homepage": "https://github.com/你/你的仓库",
  "tags": ["工具"],
}

```

提 PR 后会自动跑检查（manifest 字段、`node --check`、禁二进制、`inputSchema` 格式）；
合并到 main 后 Action 自动重建 `index.json` —— **不需要你自己维护文件清单**。
两个人同时提 PR 也不会冲突，因为各自只加自己的目录。
