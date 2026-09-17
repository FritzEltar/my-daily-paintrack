# My Daily Paintrack

个人图片素材库 + **每日打卡热力图**，托管在 GitHub Pages 上的纯静态站点。

它和隔壁的 [`my-image-site`](https://github.com/FritzEltar/my-image-site) 是同一套图库代码，
但结构更简单，而且多了一块**右侧「每日画迹」热力图**：

- **目录只有两级**：`大类 / 图集`（`images/2026/9月/001.jpg`），没有角色、没有草稿箱。
- 图集里是**固定大小的正方形缩略图**，无缝拼成一面墙；**鼠标悬停才显示文件名**，
  点开才加载完整原图。
- 每张图按日期归到某一天，右侧热力图一天一格，一眼看出哪几天画得多。

线上地址：

- <https://fritzeltar.github.io/my-daily-paintrack/>
- 和 my-image-site **同一个域名、同一个父目录**（`D:\Github_repository\`），互不影响。

**单页应用，不会开新网页。** 所有层级切换都靠前端视图 + URL hash
（`#/2026/9月`），浏览器的前进 / 后退键可以直接用，刷新页面也能停在原来的位置。

---

## 目录结构

```
my-daily-paintrack/
├── index.html                     页面骨架（左右两栏）
├── style.css                      样式（含深色模式与响应式）
├── script.js                      图库逻辑 + 热力图渲染
├── images.json                    图片清单 —— 由脚本自动生成，不要手改
├── heatmap.json                   每日数量 —— 由脚本自动生成，不要手改
├── daily.json                     手动补录 / 覆盖每天数量（可选，手改这个）
├── .nojekyll                      告诉 GitHub Pages 不要跑 Jekyll
├── images/                        图片放这里，目录层级 = 网站层级
│   ├── README.txt
│   └── meta.json                  （可选）封面 / 标题 / 标签 / 日期
├── thumbs/                        缩略图（墙用）—— 脚本生成，不要手改
├── views/                         查看图（灯箱用）—— 脚本生成，不要手改
└── tools/
    ├── generate-manifest.ps1      扫描 images/ 生成 images.json + heatmap.json
    ├── update-gallery.cmd         上面脚本的双击版
    ├── auto-push.mjs              自动同步：盯着 images/，自动生成 + 提交 + 推送
    ├── auto-push.cmd              上面脚本的双击版
    ├── autostart.ps1 / .cmd       开机自启开关（双击一下开、再双击关）
    ├── preview.mjs                本地预览服务器
    └── preview.cmd                上面脚本的双击版
```

---

## 分类逻辑（两级）

```
images/
└── 2026/                    ← 第 1 级：大类
    ├── 9月/                 ← 第 2 级：图集
    │   ├── 001.jpg
    │   ├── 002.jpg
    │   └── cover.jpg        ← 封面（不会被当成图片显示）
    └── 10月/
        └── ...
```

**图集里面不再分子文件夹。** 9月 里的图全部平铺在一起，顺序按文件名排。
真在 9月 里又建了子文件夹也不会出错 —— 里面的图会被合并进 9月，
脚本会打印一行「有 N 张图放在图集下的子文件夹里，已合并进图集」告诉你。

兜底规则：

- 图片直接扔在 `images/2026/` 下（没有图集子文件夹）→ 图集「未分类」
- 图片直接扔在 `images/` 下 → 大类「未分类」/ 图集「未分类」

### 「备注」是个占位大类

`images/备注/` 和 `2026`、`2027` 是同一级（都算大类），不过有两条特殊待遇：

- **永远排在所有年份文件夹的最后面**
  （由 `tools\generate-manifest.ps1` 的 `-LastGroups` 参数控制，默认就是 `备注`）
- **里面一张图都没有也照样显示**，卡片上写着「还空着」

现在它是空的，专门留着以后往里放备注页面。想放东西时按普通规矩来就行：
`images/备注/<图集名>/图片.jpg`，放完重跑一次脚本，卡片就变成正常的图集列表。

### 网站上怎么走

| 层级 | 页面 | 说明 |
|---|---|---|
| 第 1 级 | **大类列表** | 每个大类一张封面卡。**只有一个大类时会自动进入，不显示这一层** |
| 第 2 级 | **图集封面列表** | 每个图集一张固定封面，下面写着「几张图 · 日期范围」 |
| 第 3 屏 | **图集内部** | 一整面正方形缩略图墙，无缝拼接；悬停显示文件名，点开看原图 |

- 顶部有**面包屑**：`全部图库 / 2026 / 9月`，点中间任一段都能跳回去。
- 图集内部**没有「全部」这一档筛选**，也不需要，因为所有图就在一面墙上。

### 未来扩展

想加新的大类，直接在 `images/` 下建文件夹：

```
images/
├── 2026/          ← 现有
└── 2027/          ← 建好这个文件夹，网站首页就会自动变成大类列表
    └── 1月/
        └── 001.jpg
```

---

## 缩略图墙长什么样

- 每张图都是**同样大小的正方形**，`object-fit: cover` 居中裁切，所以一面墙方方正正。
- **无缝**：图与图之间没有缝隙（`--wall-gap: 0px`）。想留缝就改
  `style.css` 里 `.gallery` 的 `--wall-gap`，比如 `3px`。
- **列数**：宽屏 4 列，≤900px 3 列，≤650px 2 列。
- **文件名**：平时不显示，鼠标悬停（或键盘 Tab 聚焦）时从底部浮出一条渐变条，
  上面是文件名。触屏设备没有悬停，所以文件名常显。
- **点开看原图**：墙上加载的是 `thumbs/` 缩略图，点开灯箱才加载 `views/`，
  「下载原图 / 复制图片 URL」用的是 `images/` 里的原图。
- 每页 24 张，超出会分页。

---

## 图集封面

每个图集的封面按这个顺序确定，**先找到先用**：

1. **图集文件夹里的 `cover.jpg`**（也支持 `cover.png` / `_cover.*` / `封面.*`）
   —— 想换封面，直接替换这个文件即可。它不会被当成图片显示在墙上。
2. `images/meta.json` 里该图集的 `cover` 字段
3. 该图集里的第一张图

---

## 每日热力图（右侧那栏）

位置：**首页 / 图集列表页的右侧固定栏**。
进入某个图集看图时它会自动收起，把整幅宽度让给缩略图墙
（想看热力图就点面包屑退回上一层）。

### 一天算多少张，怎么定

每张图会被归到某一天，按这个顺序决定，**先找到先用**：

| 顺序 | 来源 | 说明 |
|---|---|---|
| 1 | `images/meta.json` 的 `date` 字段 | 最准，推荐给截图 / 板绘导出图手写 |
| 2 | 图片自带的 EXIF 拍摄时间 | `DateTimeOriginal` / `DateTimeDigitized` / `DateTime` |
| 3 | 上一次生成的 `images.json` 里记着的日期 | 换电脑 / 重新 clone 后文件时间会被重置，靠它保住原日期 |
| 4 | 文件修改时间 | 最后兜底 |

所以：

- **手机拍的照片**不用管，EXIF 自带日期。
- **截图、板绘导出图**没有 EXIF，如果文件时间是乱的，就在
  `images/meta.json` 里写死：

  ```json
  {
    "images": {
      "2026/9月/001.jpg": { "title": "9月速写 01", "date": "2026-09-01" }
    }
  }
  ```

### 某天没出图，也想留个记录

编辑仓库根目录的 `daily.json`：

```json
{
  "days": {
    "2026-09-05": 3,                                    // 直接覆盖成 3 张
    "2026-09-06": { "add": 2 },                         // 在自动统计之上再加 2
    "2026-09-07": { "count": 1, "note": "只发了一张" },   // 覆盖 + 备注
    "2026-09-08": { "note": "写了一天代码" }              // 只留备注，张数按自动算
  }
}
```

- 值写**数字** = 覆盖那天的数量。
- 值写 `{ "add": n }` = 自动统计 + n。
- 值写 `{ "count": n }` = 覆盖。
- `note` 会显示在热力图的悬浮提示和「最近记录」里。
- **只有备注、没有张数**的日子算「有记录」（格子是最浅的一档），
  会算进「有记录的天数」和「连续天数」。
- 键以下划线开头（比如 `_说明`）会被忽略，可以当注释用。
- 改完重跑一次 `tools\update-gallery.cmd` 即可。

**写过 `note` 的日子会出现在右侧面板的「备注」块里**（就在热力图正下方），
按日期倒序排，最多显示 4 条；那一块右边的「查看备注 →」可以直接进
「备注」大类。有张数又有备注的日子，两边都会出现：
「最近记录」列它有几张，「备注」列它写了什么。

### 面板上都有什么

| 位置 | 内容 |
|---|---|
| 范围按钮 | 3 个月 / **半年（默认）** / 一年，切换后不刷新页面 |
| 月份行 | 每个月的第一列上方标 `N月` |
| 左侧 `一 三 五` | 星期（列按周排，周日在最上面一行的位置） |
| 格子 | 一天一格，鼠标悬停显示「日期 · N 张」+ 备注 |
| 图例 | 一行 `低 ■■■■ 高`（四个格子紧挨着），**鼠标悬停或 Tab 聚焦某一格，会显示那一档的张数要求** |
| 备注 | 热力图正下方，列出 `daily.json` 里写过 `note` 的日子；右边「查看备注 →」进「备注」大类 |
| 今日 | 今天那一格描边，方便定位 |
| 统计 | 累计记录 / 有记录的天数 / 当前连续 / 最长连续 |
| 最近记录 | 最近 5 个有记录的日子，带备注 |
| 一年视图 | 一年是 53 列，比栏宽长，栏内可以横向滚动 |

### 颜色怎么分档

**按当天新增的张数固定分档**，不看时间范围里的最大值：

| 档位 | 条件 | 颜色 |
|---|---|---|
| 无 | 0 张（那天没有记录） | 浅灰 |
| 低 | **1 张** | 浅蓝 |
| 中 | **2 ~ 3 张** | 中蓝 |
| 高 | **4 张及以上** | 深蓝 |

因为是绝对档位，所以「深蓝」在 3 个月视图和一年视图里含义完全一样，
不会因为某个月画得特别多就把别的月份衬托得像没画。

> 只写了备注、没写张数的日子（`daily.json` 里只给 `note`）按**低**显示，
> 不然它会被当成「那天什么都没干」。悬停那一格仍然会如实显示「0 张」。

想改档位规则，只改一处：`script.js` 里的 `HEAT_LEVELS`
（顺带改 `style.css` 里 `.hm-cell.lv0 ~ .lv3` 的配色）。

热力图的**窗口是按「今天」现算的**（`heatmap.json` 里只存日期和数量），
所以隔几个月不重新生成也不会显示错位，只是新日子的数据要重跑脚本才有。

---

## 派生图（自动生成，两档）

你的原图可能很大。生成脚本会**顺手做两张小图**：

```
images/2026/9月/001.jpg    6.6 MB   ← 原图：只在「下载」「复制 URL」时用
views/ 2026/9月/001.jpg     300 KB   ← 灯箱查看用（最长边 1600px）
thumbs/2026/9月/001.jpg      50 KB   ← 缩略图墙用（最长边 600px）
```

### 为什么要有 `views/` 这一档

只做 `thumbs/` 的话，**点开大图会比优化前还慢**：墙上只加载 50KB 缩略图，
点开才第一次去下 5～7MB 原图。而灯箱最多只显示约 1000px 宽
（`max-height: 65vh` + `max-width: 1000px`），却下载 4096px 的图 ——
白白多下 **130 倍**的流量。

所以灯箱改用 `views/`（1600px，比显示尺寸大 1.6 倍，高清屏也够清晰），
并且做了两件事让等待感消失：

- **秒显缩略图占位**：点开瞬间先显示放大并轻微模糊的缩略图，
  右上角提示「载入大图…」，大图下载完自动换上清晰版。
- **悬停预取**：鼠标在缩略图上停 120ms 就开始后台下载查看图。

### 其他说明

- 缩略图比原图新时自动跳过，所以重复运行很快；删掉 `thumbs/` `views/` 就会全部重做。
- 用的是 .NET 自带的 `System.Drawing`，**不需要安装任何东西**。
- **两种情况会自动跳过**（清单里对应字段留空、页面直接用原图）：
  - `webp` / `avif` / `svg` —— `System.Drawing` 读不了
  - 原图本来就比派生图小（小 PNG 很常见）—— 没必要为了"优化"反而变大
- 派生图**必须一起提交**，否则线上看到的是原图。
- **删图或给文件夹改名后，脚本会自动清理失效的旧派生图**。

想调整：

```powershell
# 只更新清单和热力图，不做派生图
powershell -File tools\generate-manifest.ps1 -NoThumbs

# 图很多、不想读 EXIF（日期退回 meta.json / 旧清单 / 文件时间）
powershell -File tools\generate-manifest.ps1 -NoExif

# 想要更清晰的缩略图（体积会大一些）
powershell -File tools\generate-manifest.ps1 -ThumbWidth 900 -ThumbQuality 88

# 想要更清晰的大图
powershell -File tools\generate-manifest.ps1 -ViewWidth 2200 -ViewQuality 90
```

---

## 添加图片

1. 把图片放进 `images/大类/图集/`，例如：

   ```
   images/2026/9月/001.jpg
   images/2026/9月/002.png
   images/2026/10月/001.webp
   ```

   文件夹名就是网站上显示的名字，**随便改，改完重跑一次脚本即可**。

2. 双击 `tools\update-gallery.cmd`（或运行
   `powershell -File tools\generate-manifest.ps1`）重新生成
   `images.json` + `heatmap.json`。

3. 提交并推送，网站即更新。

### 想让文件名更好看？

墙上悬停显示的就是**文件名去掉扩展名**。想换成正常名字，在
`images/meta.json` 里写覆盖信息即可（没有这个文件就自己新建一个）：

```json
{
  "collections": {
    "2026/9月": {
      "name": "九月速写",
      "cover": "001.jpg"
    }
  },
  "images": {
    "2026/9月/001.jpg": {
      "title": "9月速写 01",
      "description": "针管笔",
      "tags": ["速写", "参考"],
      "date": "2026-09-01"
    }
  }
}
```

- `collections` 的键是 `大类/图集`，`cover` 可以写相对图集文件夹的路径，
  也可以写完整的 `images/...` 路径。
- `images` 的键是相对 `images/` 的完整路径。
- `title` 就是墙上悬停显示的名字；`description` / `tags` 出现在灯箱里。
- `date` 见上面「每日热力图」。

**最省事的做法还是直接把文件改名**（`001.jpg` → `9月速写 01.jpg`），
中文名完全没问题，改完重跑脚本即可。

### 搜索

搜索框在图集内部，搜的是**整个图集**，标题、标签、描述、文件名都会匹配，
命中的图会重新拼成一面墙。

---

## 自动同步：加完图自动推送（可选）

嫌「跑脚本 + 三条 git 命令」麻烦的话，双击 **`tools\auto-push.cmd`**。
它会开一个小窗口一直盯着 `images\`，你一有动作它就自动：

1. 跑 `tools\generate-manifest.ps1`（清单 / 缩略图 / 灯箱图 / 热力图，全自动）
2. `git add` + `git commit`（提交信息自动生成，带上是哪几个文件）
3. `git push`

也就是说：**把图拖进 `images\2026\9月\`，剩下什么都不用管**，
一分钟左右 GitHub Pages 自己就更新了。删图、改名、改 `daily.json` 同样会自动同步。

### 一些细节

- **防抖**：最后一次改动之后等 8 秒才动手，一次拖进去 20 张只会同步一遍。
- **等文件写完**：复制大图时文件会先出现、再慢慢变大，脚本会等它稳定下来再生成缩略图，
  不会出现「半张图」的缩略图。
- **推送失败会自动重试**（默认每分钟一次）：代理软件忘了开、临时断网都不用管，
  窗口开着就行，网络恢复后它自己补推。
- **关掉窗口就停止**（也可以按 Ctrl+C）。
- 日志写在 `logs\sync.log`，超过 1MB 自动轮转；`logs/` 已经进了 `.gitignore`，不会提交。
- 它只监听 `images\` 和 `daily.json`；生成脚本写的是 `images.json` / `heatmap.json` /
  `thumbs/` / `views/`，都不在监听范围内，所以**不会自己触发自己**。
- 启动时它会先补同步一次，把上次关掉期间加的图一起处理掉。

### 开机自动跑

双击 **`tools\autostart.cmd`** 就行（会最小化启动）；再双击一次取消。
它只是在 Windows 的「启动」文件夹里放 / 删一个快捷方式，不写注册表、不加计划任务。

### 常用参数

```powershell
node tools/auto-push.mjs                  # 正常跑
node tools/auto-push.mjs --no-push        # 只提交，不推送
node tools/auto-push.mjs --oneshot        # 同步一次就退出
node tools/auto-push.mjs --delay 30000    # 改成静默 30 秒后再同步
node tools/auto-push.mjs --retry 300000   # 推送失败 5 分钟后重试
```

| 参数 | 作用 |
|---|---|
| `--delay <毫秒>` | 最后一次变化之后等多久再同步（默认 8000） |
| `--retry <毫秒>` | 推送失败后多久重试（默认 60000） |
| `--no-push` | 只提交，不推送 |
| `--no-commit` | 只生成清单和缩略图，不提交 |
| `--oneshot` | 同步一次就退出 |
| `--no-initial` | 启动时不先补同步一次 |

> 这些 `.cmd` 里**不写中文**（cmd.exe 按系统代码页读批处理，UTF-8 的中文会把
> 命令行拆坏），中文提示都由它调用的 `.ps1` / `.mjs` 输出。

---

## 本地预览

`script.js` 用 `fetch` 读取 `images.json` / `heatmap.json`，所以**直接双击
`index.html` 会因浏览器安全策略而读取失败**。请用本地服务器预览：

**最简单：双击 `tools\preview.cmd`**，会自动起服务器并打开浏览器。

也可以手动起服务：

```powershell
node tools/preview.mjs          # 仓库自带（需要 Node.js）
python -m http.server 8000      # 或者用 Python
npx --yes serve -l 8000         # 或者用 npx
```

然后打开 <http://127.0.0.1:8000>。

---

## 发布到 GitHub Pages

首次发布（在 GitHub 网页上操作）：

1. 打开 <https://github.com/new>，仓库名填 **my-daily-paintrack**，
   选 **Public**，**不要**勾选 "Add a README file" 等（本地已有内容）。
2. 点 **Create repository**，然后：

   ```powershell
   cd D:\Github_repository\my-daily-paintrack
   git remote add origin https://github.com/FritzEltar/my-daily-paintrack.git
   git push -u origin main
   ```

3. 仓库页面 → **Settings** → 左侧 **Pages** → Source 选
   `Deploy from a branch` → Branch 选 `main`、目录选 `/ (root)` → **Save**。

站点地址：<https://fritzeltar.github.io/my-daily-paintrack/>

之后每次更新：

```powershell
cd D:\Github_repository\my-daily-paintrack
git add .
git commit -m "更新图库"
git push
```

推送后等 1~2 分钟自动部署完成。

> 不想每次手动敲这几条？看上面的 **自动同步** 一节，双击一次就不用管了。

### 推送失败怎么排查

| 报错 | 原因 | 怎么办 |
|---|---|---|
| `schannel: failed to receive handshake, SSL/TLS connection failed` | **九成是 remote 地址少写了 `.com`**（写成了 `https://github/...`）。代理连不上这个主机就直接断开，git 却报成 TLS 握手失败，很误导人 | `git remote -v` 看地址；不对就 `git remote set-url origin https://github.com/FritzEltar/my-daily-paintrack.git` |
| `Connection was reset` / `Failed to connect to 127.0.0.1 port 7897` | 代理软件没开 | 打开代理，或 `git config --unset http.proxy` 走直连 |
| `Repository not found` | 仓库还没在 GitHub 上建，或名字拼错 | 先按上面第 1 步建仓库 |
| `failed to push some refs ... non-fast-forward` | 建仓库时勾了 "Add a README file"，远端已经有提交 | `git pull --rebase origin main` 之后再 `git push` |

---

## 更新后看不到变化？（缓存问题）

GitHub Pages 给**所有**文件都下发 `Cache-Control: max-age=600`，
意思是「10 分钟内别再来问我要」。直接后果：

- 改完 `style.css` / `script.js` 推上去，访客的浏览器还在用旧的缓存文件，
  **按 F5 也未必有用**，看起来就像"根本没更新"。

这个坑已经用**资源版本号**填掉了：生成脚本会按 `style.css` + `script.js`
的内容算一个短哈希，写进 `index.html`：

```html
<link rel="stylesheet" href="style.css?v=d4b40e2f">
<script src="script.js?v=d4b40e2f"></script>
```

内容一变，版本号就变，URL 就变，浏览器必然重新下载。**你什么都不用管**，
每次双击 `update-gallery.cmd` 都会自动维护。

如果哪次还是看到旧画面，按 **Ctrl + Shift + R**（强制刷新）一次即可。
实在不行就用无痕窗口打开，或者临时加个参数：
`https://fritzeltar.github.io/my-daily-paintrack/?v=1`

> `images.json` / `heatmap.json` 是前端用 `fetch(..., {cache:'no-cache'})`
> 读的，会正常重新请求，不受这条影响。

---

## 字体

正文用的是 **git-scm.com 的同款字体栈**：

```css
font-family: Adelle, "Roboto Slab", "DejaVu Serif", Georgia,
             "Times New Roman", "Microsoft YaHei", sans-serif;
```

git-scm.com 本身没有加载任何 web font，正文就是这个栈。本机没装
Adelle / Roboto Slab / DejaVu Serif，所以英文落在 **Georgia** 上。
这几个西文字体都没有中文字形，所以**中文会自动回退到微软雅黑**。

想换字体就改 `style.css` 最上面 `body` 里的 `font-family`。

---

## 页脚致谢

页脚第二行是本站的搭建者标记，和 "Powered by GitHub Pages" **并排在同一行**，
中间用一道横杠隔开，标记在右边：

```
Powered by GitHub Pages  —  🐋 Built with DeepSeek
```

它是内联 SVG（`index.html` 里 `.credit` 那一段），不额外请求文件；
深色 / 浅色模式的配色都单独适配过。不想要就删掉
`index.html` 页脚里的 `.credit` 和 `.footer-sep` 两段。

---

## 几点限制与提醒

- **单文件 ≤ 100 MB**，超过会被 GitHub 直接拒绝推送。原图大一点没关系
  （墙上只加载缩略图），但单张建议别超过 20 MB。
- 仓库建议保持在 1 GB 以内，GitHub Pages 站点也有 1 GB 软上限。
  缩略图只占几百 KB，不用担心。
- 图片是公开的，别放私人照片或涉及隐私、版权问题的素材。
- **本机 git 走代理**：这台机器上 git 已配置
  `http.proxy = http://127.0.0.1:7897`（只配在本仓库）。
  代理软件必须开着，否则 `git push` 会报 `Connection was reset`。
  想撤销：`git config --unset http.proxy`。
- **改动 `tools\generate-manifest.ps1` 后，最好存成「UTF-8 带 BOM」。**
  本机只有 Windows PowerShell 5.1，它会把无 BOM 的 UTF-8 脚本当 ANSI 读，
  导致里面的中文变成乱码、脚本直接报语法错误。
  **不过不用担心**：双击 `tools\update-gallery.cmd` 时它会自动检测并补回 BOM
  （会打印一行 `[fix] re-added UTF-8 BOM`），所以即使忘了也不会出问题。
- **EXIF 日期读不到时不要慌**：截图、板绘导出图本来就没有 EXIF，
  脚本会退到「上一次清单里的日期」→「文件修改时间」，
  想要准就在 `images/meta.json` 里写 `date`。

---

## 工作原理

- `images.json` 是两级嵌套清单：`groups → collections → images`，
  每个图片条目带 `file`（原图）、`view`（灯箱用）、`thumb`（墙上用）、
  `date`（热力图用）、`w` / `h`（原图尺寸，记录用）。
- `heatmap.json` 只有一张 `日期 -> {count, note}` 的表，
  自动统计（图片日期）和手动补录（`daily.json`）在生成脚本里合并。
- `script.js` 把 URL hash 解析成 `大类 / 图集` 两段，据此切换视图；
  改 hash 会触发 `hashchange`，所以浏览器前进后退天然可用。
- 路由里的非法层级会自动回退到上一层（比如手工输入了不存在的图集名）；
  旧版带第三段（角色）的链接也能正常打开，第三段直接忽略。
- 第 1 级只有一个大类时，首页直接进入它，省掉一次没有意义的点击。
- 缩略图墙是纯 CSS 网格（`repeat(4, 1fr)` + `aspect-ratio: 1/1`），
  不依赖图片尺寸，所以图加载出来不会跳版。
- 灯箱打开时先显示 `thumb` 放大版（轻微模糊）并提示「载入大图…」，
  `view` 下载完再换上；鼠标悬停缩略图 120ms 会提前预取 `view`。
- 图片用 `loading="lazy"` 懒加载；图集封面优先用 `cover.*` 文件。
- 热力图窗口按「今天」现算：`start = 本周日 - (N-1) 周`，`end = 本周六`，
  格子按 `周日 → 周六` 逐列填充；顶部月份标签用 CSS Grid 的
  `grid-column` 对齐到每个月第一列。
- 颜色是**绝对档位**，不看窗口里的最大值：0 张 / 1 张 / 2~3 张 / 4 张以上
  分别对应 无 / 低 / 中 / 高，所以颜色深浅在任何时间范围里含义都一样；
  只有备注、没有张数的日子按「低」显示。
- 图例和格子共用同一个气泡提示：图例上是「这一档要多少张」，格子上是
  「这一天几号、几张、有没有备注」。
- 「备注」块和「最近记录」块分工：备注块只收有 `note` 的日子，
  最近记录只收有张数的日子，不重复显示同一件事。
- 「备注」大类的排序和「没有图片也显示」由生成脚本的 `-LastGroups`
  参数决定；首页大类列表按 名字排序 + 末尾占位大类 输出。
- 深色模式存 `localStorage`（键名 `paintrack-dark`），首次访问跟随系统
  `prefers-color-scheme`。
- 灯箱支持 `Esc` 关闭、`←` `→` 在**当前筛选结果**里翻页、点遮罩关闭。
- `.nojekyll` 让 GitHub Pages 跳过 Jekyll 处理，避免下划线开头的文件被忽略。
