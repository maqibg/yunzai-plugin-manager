#!/usr/bin/env node
/**
 * 脚本名称：clone-and-install.js（单文件版）
 * 脚本用途：在当前工作目录内，交互选择并按顺序 git clone 指定仓库到指定相对路径；全部完成后执行一次 pnpm i。
 * 兼容平台：Linux / Windows（Node.js 单文件，无外部依赖）
 * 运行环境：Node >= 16，已安装 git 与 pnpm
 * 注意事项：脚本本身不产生任何额外文件；仅按配置克隆到目标路径。
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// ========== 可编辑区：仓库清单（单文件内置） ==========
// 字段说明：
// - name: 展示名称
// - url: 仓库地址（或 remote set-url 的新地址）
// - target: 相对目标目录/路径（相对当前运行目录）
// - depth: 可选，数字；指定浅克隆深度（如 1）
// - branch: 可选，字符串；指定克隆分支（等价于 git clone -b <branch> / --branch <branch>）
// - action: 可选，字符串；当为 'remoteSetUrl' 时，表示对已存在的 Git 仓库执行 `git -C <target> remote set-url <remote> <url>`
// - remote: 可选，字符串；与 action 结合，默认 'origin'
// 如需扩展，只需在下方数组中追加对象；不会创建除目标目录外的任何文件。
const REPOS = [
  { name: 'earth-k-plugin', url: 'https://github.com/maqibg/earth-k-plugin.git', target: 'plugins/earth-k-plugin', depth: 1 },
  { name: 'trss-xianxin-plugin', url: 'https://github.com/maqibg/trss-xianxin-plugin.git', target: 'plugins/trss-xianxin-plugin' },
  { name: 'BXX-plugin', url: 'https://github.com/maqibg/BXX-plugin.git', target: 'plugins/BXX-plugin', depth: 1 },
  { name: 'imgS-plugin', url: 'https://github.com/erzaozi/imgS-plugin.git', target: 'plugins/imgS-plugin' },
  { name: 'StarRail-plugin', url: 'https://github.com/TsukinaKasumi/StarRail-plugin.git', target: 'plugins/StarRail-plugin', depth: 1 },
  { name: 'cb-plugin', url: 'https://github.com/Sakura1618/cb-plugin.git', target: 'plugins/cb-plugin' },
  { name: 'ZZZ-Plugin', url: 'https://github.com/ZZZure/ZZZ-Plugin.git', target: 'plugins/ZZZ-Plugin', depth: 1 },
  { name: 'YePanel (build 分支)', url: 'https://github.com/XasYer/YePanel.git', target: 'plugins/YePanel', depth: 1, branch: 'build' },
  { name: 'micro-plugin', url: 'https://github.com/V2233/micro-plugin.git', target: 'plugins/micro-plugin', depth: 1 },
  { name: 'ark-plugin', url: 'https://github.com/NotIvny/ark-plugin.git', target: 'plugins/ark-plugin' },
  { name: 'yuki-plugin (main3 分支)', url: 'https://github.com/snowtafir/yuki-plugin.git', target: 'plugins/yuki-plugin', branch: 'main3' },
  { name: 'ws-plugin', url: 'https://github.com/XasYer/ws-plugin.git', target: 'plugins/ws-plugin', depth: 1 },
  { name: 'windoge-plugin', url: 'https://github.com/gxy12345/windoge-plugin.git', target: 'plugins/windoge-plugin' },
  { name: 'achievements-plugin (Gitee)', url: 'https://gitee.com/zolay-poi/achievements-plugin.git', target: 'plugins/achievements-plugin' },
  // 新增清单
  { name: 'Atlas', url: 'https://github.com/Nwflower/atlas', target: 'plugins/Atlas', depth: 1 },
  { name: 'GamePush-Plugin', url: 'https://github.com/rainbowwarmth/GamePush-Plugin.git', target: 'plugins/GamePush-Plugin' },
  { name: 'GT-Manual-Plugin', url: 'https://github.com/misaka20002/GT-Manual-Plugin.git', target: 'plugins/GT-Manual-Plugin', depth: 1 },
  { name: 'Guoba-Plugin', url: 'https://github.com/guoba-yunzai/guoba-plugin.git', target: 'plugins/Guoba-Plugin', depth: 1 },
  { name: 'miao-plugin（设置远程为 GitHub 源）', url: 'https://github.com/yoimiya-kokomi/miao-plugin', target: 'plugins/miao-plugin', action: 'remoteSetUrl', remote: 'origin' },
  { name: 'mora-plugin（Gitee）', url: 'https://gitee.com/Rrrrrrray/mora-plugin.git', target: 'plugins/mora-plugin', depth: 1 },
];

// ========== 工具函数 ==========
async function fileExists(p) {
  try { await fsp.access(p, fs.constants.F_OK); return true; } catch { return false; }
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32', // 提升 Windows 命令解析兼容性
      ...opts,
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function isGitRepo(dir) {
  // 仅通过 .git 目录判定；避免执行额外命令，确保无副产物
  return fileExists(path.join(dir, '.git'));
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function normalizeSelection(input, max) {
  // 规则：多个数字用 | 分隔；去重但保持首次出现顺序；越界或非法项丢弃
  const parts = input.split('|').map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) continue;
    const idx = Number(p);
    if (idx < 1 || idx > max) continue;
    if (!seen.has(idx)) { seen.add(idx); result.push(idx - 1); }
  }
  return result;
}

async function cloneOrPull(repo) {
  const abs = path.join(process.cwd(), repo.target);
  const exists = await fileExists(abs);

  if (!exists) {
    await ensureDir(path.dirname(abs));
    console.log(`\n[克隆] ${repo.name} -> ${repo.target}`);
    const cloneArgs = ['clone'];
    if (repo.branch) cloneArgs.push('-b', String(repo.branch));
    if (repo.depth && Number(repo.depth) > 0) cloneArgs.push('--depth', String(repo.depth));
    cloneArgs.push(repo.url, abs);
    const code = await runCmd('git', cloneArgs);
    return code === 0 ? { status: 'ok', repo } : { status: 'fail', repo };
  }

  if (await isGitRepo(abs)) {
    console.log(`\n[更新] ${repo.name} (pull) -> ${repo.target}`);
    const code = await runCmd('git', ['-C', abs, 'pull', '--ff-only']);
    return code === 0 ? { status: 'ok', repo } : { status: 'fail', repo };
  }

  // 已存在非空目录且非 Git 仓库，谨慎跳过，避免产生覆盖副作用
  const files = await fsp.readdir(abs);
  if (files.length > 0) {
    console.warn(`[跳过] 目标已存在且非 Git 仓库（非空目录）：${repo.target}`);
    return { status: 'skip', repo };
  }

  console.log(`\n[克隆] ${repo.name} -> ${repo.target}`);
  const cloneArgs = ['clone'];
  if (repo.branch) cloneArgs.push('-b', String(repo.branch));
  if (repo.depth && Number(repo.depth) > 0) cloneArgs.push('--depth', String(repo.depth));
  cloneArgs.push(repo.url, abs);
  const code = await runCmd('git', cloneArgs);
  return code === 0 ? { status: 'ok', repo } : { status: 'fail', repo };
}

async function remoteSetUrl(repo) {
  const abs = path.join(process.cwd(), repo.target);
  const exists = await fileExists(abs);
  if (!exists) {
    console.warn(`[跳过] 目录不存在，无法设置远程：${repo.target}`);
    return { status: 'skip', repo };
  }
  if (!(await isGitRepo(abs))) {
    console.warn(`[跳过] 非 Git 仓库，无法设置远程：${repo.target}`);
    return { status: 'skip', repo };
  }
  const remote = repo.remote || 'origin';
  console.log(`\n[设置远程] ${repo.name} (${remote} -> ${repo.url}) @ ${repo.target}`);
  const code = await runCmd('git', ['-C', abs, 'remote', 'set-url', remote, repo.url]);
  return code === 0 ? { status: 'ok', repo } : { status: 'fail', repo };
}

async function checkNode() {
  const [majorStr] = process.versions.node.split('.');
  const major = Number(majorStr);
  if (Number.isNaN(major) || major < 16) {
    console.error(`[错误] 需要 Node.js >= 16，当前版本：${process.versions.node}`);
    process.exit(1);
  }
}

async function checkDeps() {
  const checks = [
    { name: 'git', cmd: 'git', args: ['--version'], install: 'https://git-scm.com/downloads' },
    { name: 'pnpm', cmd: 'pnpm', args: ['--version'], install: 'npm i -g pnpm' },
  ];
  for (const c of checks) {
    const code = await runCmd(c.cmd, c.args);
    if (code !== 0) {
      console.error(`[缺少依赖] 未检测到 ${c.name}，请先安装：${c.install}`);
      process.exit(1);
    }
  }
}

// ========== 主流程 ==========
(async function main() {
  await checkNode();
  await checkDeps();

  if (!Array.isArray(REPOS) || REPOS.length === 0) {
    console.error('[错误] 仓库清单为空，请在脚本内的 REPOS 数组中配置。');
    process.exit(1);
  }

  console.log('\n可用仓库列表：');
  REPOS.forEach((r, i) => {
    console.log(`[${i + 1}] ${r.name} -> ${r.target} (${r.url})`);
  });

  let indices = [];
  while (indices.length === 0) {
    const ans = (await ask('\n请输入要拉取的编号（单选如 "1"，多选如 "1|3|2"）：')).trim();
    indices = normalizeSelection(ans, REPOS.length);
    if (indices.length === 0) console.log('输入无效，请重新输入。');
  }

  console.log('\n即将按以下顺序拉取：');
  indices.forEach((idx, order) => console.log(`${order + 1}. ${REPOS[idx].name} -> ${REPOS[idx].target}`));
  const confirm = (await ask('确认开始？(y/n): ')).trim().toLowerCase();
  if (confirm !== 'y') { console.log('已取消。'); process.exit(0); }

  const results = { ok: [], fail: [], skip: [] };
  for (const idx of indices) {
    const r = REPOS[idx];
    const res = await (r.action === 'remoteSetUrl' ? remoteSetUrl(r) : cloneOrPull(r));
    results[res.status].push(r);
  }

  console.log('\n[依赖安装] 执行 pnpm i ...');
  const code = await runCmd('pnpm', ['i']);
  if (code !== 0) {
    console.error('[错误] pnpm i 执行失败，请检查网络/锁文件/代理配置。');
  }

  console.log('\n=== 执行结果汇总 ===');
  console.log(`成功：${results.ok.length}`);
  results.ok.forEach((r) => console.log(`  - ${r.name} -> ${r.target}`));
  console.log(`跳过：${results.skip.length}`);
  results.skip.forEach((r) => console.log(`  - ${r.name} -> ${r.target}`));
  console.log(`失败：${results.fail.length}`);
  results.fail.forEach((r) => console.log(`  - ${r.name} -> ${r.target}`));

  process.exit(results.fail.length > 0 ? 1 : 0);
})().catch((err) => {
  console.error('[致命错误]', err);
  process.exit(1);
});
