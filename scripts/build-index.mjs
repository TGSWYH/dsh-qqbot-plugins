#!/usr/bin/env node
/**
 * build-index.mjs — 扫 packs/ 生成 index.json
 *
 * 设计要点（2026-10-24 定）：
 *   · 作者 PR 里**只加自己的目录**，不碰 index.json ⇒ 多人同时提 PR 零冲突。
 *   · 本脚本在合并后自动跑，把 packs/<id>/qqbot-pack.json 拼成索引。
 *   · files 清单也由这里扫出来 —— 作者不用手写，也就不会写漏。
 *   · cover 自动探测目录根下的 cover.png/jpg/webp/gif，不用声明。
 *
 * qqbot-pack.json 需要的字段：
 *   name        必填
 *   author      必填
 *   version     必填
 *   description 可选
 *   homepage    可选
 *   tags        可选 string[]
 *   cover       可选（一般不用填，自动探测）
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const PACKS_DIR = join(ROOT, 'packs');
const OUT = join(ROOT, 'index.json');
const EXTS = new Set(['.mjs', '.js', '.cjs']);
const KINDS = ['tools', 'commands', 'hooks', 'inbound', 'outbound', 'botplay'];
const COVER_RE = /^cover\.(png|jpe?g|webp|gif)$/i;

const REPO = process.env.GITHUB_REPOSITORY || 'zaofan-make/dsh-qqbot-plugins';
const BRANCH = process.env.GITHUB_REF_NAME || 'main';

function walkFiles(dir, base) {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...walkFiles(join(dir, e.name), rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

const plugins = [];
const problems = [];

let packDirs = [];
try {
  packDirs = readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
} catch {
  packDirs = [];
}

for (const id of packDirs.sort()) {
  const dir = join(PACKS_DIR, id);
  const manifestPath = join(dir, 'qqbot-pack.json');

  if (!existsSync(manifestPath)) {
    problems.push(id + ': 缺 qqbot-pack.json');
    continue;
  }

  let meta;
  try {
    meta = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    problems.push(id + ': qqbot-pack.json 解析失败 - ' + (e && e.message));
    continue;
  }

  for (const k of ['name', 'author', 'version']) {
    if (!meta[k]) problems.push(id + ': 缺必填字段 ' + k);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    problems.push(id + ': 目录名只能用字母数字-_');
  }

  const all = walkFiles(dir, '');

  // 参与「安装」的文件：扩展点目录下的脚本
  const files = all.filter((f) => {
    const top = f.split('/')[0];
    return KINDS.includes(top) && EXTS.has(extname(f));
  });
  if (files.length === 0) problems.push(id + ': 没有任何扩展文件（tools/ commands/ …）');

  const kinds = [...new Set(files.map((f) => f.split('/')[0]))];

  // 封面：manifest 声明优先，否则自动探测
  let cover = '';
  if (meta.cover && all.includes(String(meta.cover))) cover = String(meta.cover);
  else {
    const auto = all.find((f) => COVER_RE.test(f));
    if (auto) cover = auto;
  }

  const entry = {
    id,
    name: String(meta.name || id),
    author: String(meta.author || '未知'),
    version: String(meta.version || '0.0.0'),
    description: String(meta.description || ''),
    repo: REPO,
    path: 'packs/' + id,
    tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
    kinds,
    files,
  };
  if (meta.homepage) entry.homepage = String(meta.homepage);
  if (cover) entry.cover = 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + BRANCH + '/packs/' + id + '/' + cover;

  plugins.push(entry);
}

const index = {
  version: 3,
  updated: new Date().toISOString().slice(0, 10),
  note: '本文件由 .github/workflows/build-index.yml 自动生成，请勿手改；新增插件只要在 packs/ 下建目录。',
  plugins,
};

writeFileSync(OUT, JSON.stringify(index, null, 2) + '\n', 'utf8');

console.log('✅ 已生成 index.json：' + plugins.length + ' 个插件');
for (const p of plugins) {
  console.log('   · ' + p.id + ' (' + p.files.length + ' 个文件, kinds=' + p.kinds.join(',') + (p.cover ? ', 有封面' : '') + ')');
}
if (problems.length) {
  console.log('');
  console.log('⚠️ 问题：');
  for (const p of problems) console.log('   - ' + p);
}
