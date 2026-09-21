// tools/auto-push.mjs
// ------------------------------------------------------------
// 自动同步：盯着 images/（以及根目录的 daily.json），一有变化就：
//   1. 跑 tools/generate-manifest.ps1 —— 清单 / 缩略图 / 热力图全自动
//   2. git add + git commit
//   3. git push
//
// 它**只管图片相关的路径**（见下面的 SYNC_PATHS）：代码、文档、别的杂项
// 一概不碰，所以你（或者帮你改代码的人）改到一半的东西不会被顺手推上线。
// 那些改动留在工作区，等你自己 commit。
//
// 用法（双击 tools\auto-push.cmd 即可）：
//   node tools/auto-push.mjs
//
// 参数：
//   --delay 8000     最后一次变化之后等多久再同步（毫秒），
//                    一次拖进去 20 张也只会同步一回
//   --retry 60000    推送失败后多久重试（毫秒）
//   --no-push        只提交，不推送
//   --no-commit      只生成，不提交（调试用）
//   --oneshot        同步一次就退出
//   --no-initial     启动时不先同步一次
//   --all-paths      恢复成「什么都提交」（老的 git add -A 行为）
//   --heartbeat 1800000   每隔多久报一次「我还活着」（毫秒，默认 30 分钟）
//
// 它只监听 images/ 和 daily.json，而生成脚本写的是 images.json /
// heatmap.json / thumbs/ / views/，都不在监听范围内，所以不会自己触发自己。
// ------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES = path.join(ROOT, 'images');
const DAILY = path.join(ROOT, 'daily.json');
const GEN = path.join(__dirname, 'generate-manifest.ps1');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'sync.log');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
    const i = argv.indexOf(name);
    const v = i >= 0 ? Number(argv[i + 1]) : NaN;
    return Number.isFinite(v) && v > 0 ? v : fallback;
};

const DELAY = opt('--delay', 8000);      // 变化之后等多久
const RETRY = opt('--retry', 60000);     // 推送失败重试间隔
const NO_PUSH = flag('--no-push');
const NO_COMMIT = flag('--no-commit');
const ONESHOT = flag('--oneshot');
const NO_INITIAL = flag('--no-initial');
const ALL_PATHS = flag('--all-paths');    // 退回到「什么都提交」
const HEARTBEAT = opt('--heartbeat', 30 * 60 * 1000);   // 每隔多久报一次平安

// 自动同步只管这些路径，别的一律不碰
const SYNC_PATHS = [
    'images',
    'thumbs',
    'views',
    'images.json',
    'heatmap.json',
    'daily.json'
];

function isSyncPath(file) {
    return SYNC_PATHS.some((p) => file === p || file.startsWith(p + '/'));
}

/* ---------------- 日志 ---------------- */

fs.mkdirSync(LOG_DIR, { recursive: true });
try {
    if (fs.statSync(LOG_FILE).size > 1024 * 1024) {
        fs.renameSync(LOG_FILE, LOG_FILE + '.1');   // 超过 1MB 就轮转一次
    }
} catch { /* 第一次跑，没有日志文件 */ }

function stamp() {
    return new Date().toLocaleString('zh-CN', { hour12: false });
}

function log(msg) {
    const line = `[${stamp()}] ${msg}`;
    console.log(line);
    try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* 日志写不了就算了 */ }
}

/* ---------------- 跑命令 ---------------- */

function run(cmd, args, label) {
    if (label) { log(label); }
    const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
    if (r.error) {
        log(`执行 ${cmd} 出错：${r.error.message}`);
        return 1;
    }
    return r.status === null ? 1 : r.status;
}

function capture(cmd, args) {
    const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
    return r.stdout || '';
}

// git status --porcelain 每行是「两位状态 + 空格 + 路径」，
// 注意不能先把整段文本 trim 掉 —— 第一行的状态位可能正好是个空格，
// 一 trim 就会把路径的前两个字符切掉。顺带关掉 core.quotepath，
// 免得中文文件名被转义成 \346\234\210 这种。
function changedFiles() {
    const raw = capture('git', ['-c', 'core.quotepath=false', 'status', '--porcelain']);
    return raw
        .split('\n')
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '')
        .map((line) => line.slice(3).trim())
        .map((p) => {
            const arrow = p.indexOf(' -> ');     // 改名会写成 "旧 -> 新"
            if (arrow >= 0) { p = p.slice(arrow + 4); }
            return p.replace(/^"|"$/g, '');      // 带空格的路径会被引号包住
        });
}

/* ---------------- 判断文件是不是已经写完了 ---------------- */
// 往文件夹里拖一张 6MB 的图，文件会先出现、再慢慢变大。
// 这时候去生成缩略图会读到半张图，所以先等它稳定下来。

function signature() {
    const parts = [];

    const walk = (dir) => {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { walk(full); continue; }
            try {
                const st = fs.statSync(full);
                parts.push(`${full}|${st.size}|${Math.round(st.mtimeMs)}`);
            } catch { /* 正好被删了 */ }
        }
    };

    walk(IMAGES);
    try {
        const st = fs.statSync(DAILY);
        parts.push(`daily.json|${st.size}|${Math.round(st.mtimeMs)}`);
    } catch { /* 没有 daily.json */ }

    return parts.sort().join('\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitStable() {
    for (let i = 0; i < 20; i++) {
        const before = signature();
        await sleep(700);
        if (before === signature()) { return true; }
        log('  文件还在变（正在复制？），再等等…');
    }
    return true;
}

/* ---------------- 同步 ---------------- */

let busy = false;
let queued = false;
let changeTimer = null;
let pushTimer = null;
let lastResult = '刚启动，还没同步过';      // 给心跳用：最近一次干了什么

function schedule(reason) {
    if (ONESHOT || busy) { queued = true; return; }
    if (changeTimer) { clearTimeout(changeTimer); }
    log(`检测到变化（${reason}），${Math.round(DELAY / 1000)} 秒后同步`);
    changeTimer = setTimeout(() => {
        changeTimer = null;
        sync('文件变化');
    }, DELAY);
}

async function sync(reason) {
    if (busy) { queued = true; return; }
    busy = true;

    try {
        log(`—— 开始同步（${reason}）——`);
        await waitStable();

        if (run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', GEN],
            '生成清单 / 缩略图 / 热力图…') !== 0) {
            log('生成失败，这次不提交（改完再存一次会自动重来）');
            return;
        }

        const all = changedFiles();
        const files = ALL_PATHS ? all : all.filter(isSyncPath);
        const skipped = all.length - files.length;

        if (!files.length) {
            lastResult = `没有变化（${stamp()}）`;
            log(skipped
                ? `图片这边没有变化（另有 ${skipped} 个改动不在自动同步范围内，留给你自己提交）`
                : '没有需要提交的变化');
            return;
        }

        log(`有 ${files.length} 个文件变化：${files.slice(0, 6).join('、')}${files.length > 6 ? ' …' : ''}`);
        if (skipped) {
            log(`  另有 ${skipped} 个改动不属于自动同步范围，这次不动它`);
        }

        if (NO_COMMIT) {
            log('--no-commit：已生成，不提交');
            return;
        }

        if (ALL_PATHS) {
            run('git', ['add', '-A'], '暂存（全部改动）…');
        }
        else {
            // 只暂存图片相关的路径；-A 让这些路径下的删除 / 改名也一起进去
            const paths = SYNC_PATHS.filter((p) => fs.existsSync(path.join(ROOT, p)));
            run('git', ['add', '-A', '--', ...paths], '暂存（只暂存图片相关的东西）…');
        }

        const subject = `自动同步图库（${files.length} 个文件）`;
        const body = files.slice(0, 20).join('\n');
        if (run('git', ['commit', '-m', `${subject}\n\n${body}`]) !== 0) {
            log('提交失败，跳过');
            return;
        }

        if (NO_PUSH) {
            log('--no-push：已提交，不推送');
            return;
        }

        push();
    }
    finally {
        busy = false;
        if (queued) {
            queued = false;
            schedule('同步期间又变了');
        }
    }
}

function push() {
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }

    if (run('git', ['push'], '推送到 GitHub…') === 0) {
        lastResult = `已推送（${stamp()}）`;
        log('✅ 已推送，等 1~2 分钟 GitHub Pages 就更新了');
        return;
    }

    lastResult = `推送失败，正在重试（${stamp()}）`;
    log(`❌ 推送失败（代理软件没开？断网？），${Math.round(RETRY / 1000)} 秒后自动重试`);
    pushTimer = setTimeout(push, RETRY);
}

/* ---------------- 入口 ---------------- */

log('');
log('My Daily Paintrack · 自动同步');
log(`  盯着：${IMAGES}`);
log(`  延时：${Math.round(DELAY / 1000)} 秒    推送失败重试：${Math.round(RETRY / 1000)} 秒` +
    `${NO_PUSH ? '    [--no-push]' : ''}${NO_COMMIT ? '    [--no-commit]' : ''}`);
log(`  提交范围：${ALL_PATHS ? '仓库里的全部改动' : '只有图片相关（images / thumbs / views / images.json / heatmap.json / daily.json）'}`);
log('  按 Ctrl+C 或直接关掉窗口即停止');
log('');
log('  这个窗口平时就是静静待着的 —— 没动静 = 一切正常。');
log(`  只有往 images\\ 里加图 / 删图 / 改 daily.json 时它才会动，`);
log(`  每隔 ${HEARTBEAT >= 60000 ? Math.round(HEARTBEAT / 60000) + ' 分钟' : Math.round(HEARTBEAT / 1000) + ' 秒'}` +
    '会报一句「还在盯着」让你确认它没死。');
log('');

if (!fs.existsSync(IMAGES)) { log(`找不到 ${IMAGES}`); process.exit(1); }
if (!fs.existsSync(GEN)) { log(`找不到 ${GEN}`); process.exit(1); }

if (ONESHOT) {
    await sync('手动触发一次');
    process.exit(0);
}

if (!NO_INITIAL) {
    log('先同步一次，把上次关掉期间加的补上…');
    await sync('启动');
}

try {
    fs.watch(IMAGES, { recursive: true }, (event, name) => {
        schedule(name ? name : event);
    });
} catch (e) {
    log('监听 images/ 失败：' + e.message);
    process.exit(1);
}

try {
    fs.watch(ROOT, { recursive: false }, (event, name) => {
        // 根目录只关心 daily.json（images.json / heatmap.json 是脚本自己写的，别理）
        if (name === 'daily.json') { schedule('daily.json'); }
    });
} catch (e) {
    log('监听 daily.json 失败：' + e.message);
}

// 心跳：平时窗口里什么都不打印，容易让人以为它没在干活
setInterval(() => {
    log(`还在盯着 images/ —— 最近一次：${lastResult}`);
}, HEARTBEAT).unref();

process.on('SIGINT', () => {
    log('收到 Ctrl+C，停止自动同步');
    process.exit(0);
});
