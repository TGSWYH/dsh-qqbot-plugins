# TTS 语音合成 · 火山方舟（豆包语音合成 2.0）

把 AI 的正文变成**真的语音消息**发到 QQ 里。

```
[语音合成]主人早上好～[/语音合成]
[语音合成|撒娇]人家还想再睡五分钟嘛[/语音合成]
[语音合成 情绪=开心 强度=5 语速=1.1]来了来了！[/语音合成]
```

---

## 快速开始（三步）

1. **开通模型**：火山方舟 → 开通管理 → 语音模型 → `Doubao-语音合成2.0`
2. **填鉴权**：把控制台给的 `APP ID` + `Access Token` 填进设置页
3. **试一句**：群里发 `/tts test 你好呀`

---

## 一、开通「Doubao-语音合成2.0」

先在 <https://console.volcengine.com/> 注册并**实名认证**（语音类产品必须实名，个人认证即可）。

然后进方舟控制台：

```
火山方舟 → 控制台 → 左侧「开通管理」→ 顶部标签「语音模型」
        → 找到「Doubao-语音合成2.0」→ 点「立即使用」
```

![开通管理 · 语音模型 · Doubao-语音合成2.0](docs/01-open-tts-model.png)

要点：

- 名额列里写着 **推理额度 20000 字符 / 10 QPS**，够日常用了；超了单价 5 元/万字符
- 同一页下面还有「Doubao-声音复刻」—— **只在你想用自己的声音时**才需要开，普通用法不用
- 别开成「Doubao-流式语音识别 / 录音文件识别」，那些是**听**的（STT），不是**说**的

## 二、拿鉴权

开通后回到控制台，打开「音色详情」那一页，**页面底部**就是服务接口认证信息：

![音色详情页：中间 Voice_type 那列就是音色 ID，页面底部是服务接口认证信息（图中已打码）](docs/02-voices-and-auth.png)

```
APP ID        1234567890        ← 一串纯数字
Access Token  ●●●●●●●●（点眼睛显示）
Secret Key    ●●●●●●●●          ← 注意：这个不是我们要的
```

⚠️ **别把 Secret Key 当成 Access Token** —— 两个长得一样、都在那一排，但接口认的是 **Access Token**。

填到设置页：

```
QQ 机器人扩展 → ⚙ 设置 →「TTS 语音合成 · 火山方舟」
  鉴权方式：legacy
  APP ID：那串数字
  Access Token：复制进去
```

> 页面顶部还有一行提示：「API 接入使用 **API Key** 接入方式（旧版使用 APP ID）」。
> 如果你走的是新版（方舟 → **API Key 管理** → 新建），那就在设置页把「鉴权方式」改成 `apiKey`，只填那串 key。
> 两条路都支持；两样都填时**优先用 APP ID + Access Token**。

## 三、选音色

同一页「音色详情」表里，`Voice_type` 那一列就是音色 ID（一共 99 个，翻页看）。
页面**底部**还有「服务接口认证信息」，就是上一步要填的 APP ID / Access Token：

| 音色名称 | Voice_type（填这个） | 推荐场景 |
| --- | --- | --- |
| vivi 2.0 | `zh_female_vv_uranus_bigtts` | 通用（默认） |
| 知性灿灿 | `saturn_zh_female_cancan_tob` | 角色扮演 |
| 可爱女生 | `saturn_zh_female_keainvsheng_tob` | 角色扮演 |
| 调皮公主 | `saturn_zh_female_tiaopigongzhu_tob` | 角色扮演 |
| 爽朗少年 | `saturn_zh_male_shuanglangshaonian_tob` | 角色扮演 |
| 天才同桌 | `saturn_zh_male_tiancaitongzhuo_tob` | 角色扮演 |
| 小何 | `zh_female_xiaohe_uranus_bigtts` | 通用 |
| 云舟 | `zh_male_m191_uranus_bigtts` | 通用 |
| 小天 | `zh_male_taocheng_uranus_bigtts` | 通用 |
| Tim | `en_male_tim_uranus_bigtts` | 通用（英文） |

设置页下拉里已经放了这些；要**别的**就填「自定义音色 ID」（优先级高于下拉）。

临时试听不改配置：

```
/tts voice zh_female_xiaohe_uranus_bigtts
```

> 复刻类音色（`ICL_…` 前缀）也能用，Resource-Id 会自动落到 `seed-tts-2.0`。

---

## 用法

### 正文标记

```
[语音合成]纯文本，用默认音色和默认语调[/语音合成]
[语音合成|开心]带情绪词，自动加情感 + 微调语速[/语音合成]
[语音合成 情绪=撒娇 强度=5 语速=0.9 音量=1.1]细调参数[/语音合成]
```

规则：

- `[语音合成]…[语音合成]` 开闭同标记也认
- 标记段会被整段摘掉，剩下的正文照常发
- **剥完一个字都不剩 → 只发语音，不发文字**（设置里可关「纯语音模式」）
- 一条正文多个标记 → 逐条合成、逐条发
- 语音不走 `[MEDIA:voice|…]`，只认 `[语音合成]`
- 别用全角括号 `【语音合成】`，不认

### 情绪词

`开心/高兴/欢快/愉快` · `兴奋/激动` · `伤心/难过/失落/委屈` · `生气/愤怒` · `惊讶` · `冷淡` · `平静/严肃` · `傲娇` · `撒娇` · `温柔/软萌` · `害羞` · `慵懒/困/疲惫`

英文也认：`happy / sad / angry / excited / surprised / coldness / neutral / tender / shy / calm / tired`

强度 `强度=1~5`（对应 `emotion_scale`，默认 4）。音色不支持情感时会**自动降级为不带情感重试**一次，不会报错。

### 指令

| 指令 | 作用 |
| --- | --- |
| `/tts` · `/tts status` | 看鉴权、音色、Resource-Id、**实际读到哪个配置文件** |
| `/tts test 你好呀` | 合成一句立刻发出来（验证鉴权） |
| `/tts voice <音色ID>` | 用指定音色试听 |
| `/tts guide` | 用法说明 |

### 工具

AI 可直接调 `tts_voice`：`action=guide / emotions / test / status`

---

## 设置页字段

| 字段 | 说明 |
| --- | --- |
| 鉴权方式 | `legacy`（APP ID + Access Token）/ `apiKey`（只有一串 key） |
| API Key / APP ID / Access Token | 填一套即可 |
| 默认音色 | 下拉常用音色 |
| 自定义音色 ID | 填了就覆盖下拉 |
| Resource-Id | 默认 `auto` 自动判定；报 `resource mismatched` 才手动指定 |
| 模型 | `expressive`（支持情绪）/ `standard`（更快） |
| 音频格式 / 采样率 | 默认 mp3 / 24000 |
| 启用情绪/语调 | 关掉只读字面文本 |
| 纯语音模式 | 关掉后即使只剩语音标记也保留占位文字 |
| 音频输出目录 | 留空 = 包内 `out/` |

---

## 排查

| 现象 | 原因 / 处理 |
| --- | --- |
| `还没配置鉴权` | 设置页没填 → `/tts status` 看它到底读了哪个文件 |
| `401 / 403` | ① 把 **Secret Key** 当成 Access Token 填了 ② 模型没开通 ③ Resource-Id 与音色不匹配 |
| `resource mismatched` | `_moon_/_mars_` 结尾的 1.0 音色要 `seed-tts-1.0`；`_uranus_bigtts` / `_tob` / `ICL_` 都用默认 `seed-tts-2.0` |
| 合成成功但没声音 | 看 `/tts status` 的输出目录里有没有音频文件；有 → 是**发送通道**问题（群可能限制语音） |
| 只发文字没语音 | 标记写成全角括号了，或正文里提到裸 `[语音合成]` 被误判 |
| 插件启动失败，没有 `starting bot` | `.qqbot-extensions/outbound/volcengintts.mjs` 与本包同名文件冲突 —— 删掉旧的 |

---

## 文件结构

```
volcengintts/
  qqbot-pack.json
  README.md
  cover.png                 封面
  docs/                     本 README 的两张图
  lib/settings.mjs          配置读取（面板 > 旧配置 > 包内默认）
  outbound/volcengintts.mjs    出站：正文标记 → 语音（含设置页声明）
  tools/tts_voice.mjs       工具：guide / emotions / test / status
  commands/tts.mjs          /tts 命令
  out/                      合成出来的音频（自动创建）
```

## 从旧的 volcengintts.mjs 迁移

以前把 `volcengintts.mjs` 丢在 `.qqbot-extensions/`、配置写在 `工具/tts-plugin/tts-config.json` 的**不用重填**：

`lib/settings.mjs` 仍会读那份旧配置（优先级低于面板），装好包就能继续用；在设置页填一次值后，就以面板为准。

> ⚠️ 两处同名文件同时存在会让插件**启动失败**（连 `starting bot` 都不打印）。装本包前先删 `.qqbot-extensions/outbound/volcengintts.mjs` 和 `.qqbot-extensions/tools/tts_voice.mjs`。
