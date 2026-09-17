<#
    generate-manifest.ps1
    ------------------------------------------------------------
    扫描 images/ 目录，生成网站读取的 images.json 清单，以及右侧
    热力图用的 heatmap.json。

    用法（在仓库根目录）：
        powershell -File tools\generate-manifest.ps1
      或双击 tools\update-gallery.cmd

    ------------------------------------------------------------
    目录层级 = 网站层级，共两级：

        images/2026/9月/001.jpg
               └大类┘└图集┘

      第 1 层  images/<大类>/            例如「2026」。以后想加新大类，
                                        直接建 images/<新大类>/ 即可
      第 2 层  <大类>/<图集>/            网站的图集列表，每个图集一张封面；
                                        图集里的图片拼成一面正方形缩略图墙

    规则：
      · **只有两级**：图集文件夹里的图片全部平铺在一起，不再分角色 /
        草稿箱。图集里如果又套了子文件夹，里面的图会被合并进同一个图集
        （脚本会打印一行提示）
      · 放在 images/ 根目录的图片 -> 大类「未分类」/ 图集「未分类」
      · 图片直接放在大类文件夹下（没有图集子文件夹）-> 图集「未分类」
      · 文件名去掉扩展名后作为标题，鼠标悬停在缩略图上才显示

    图集封面的确定顺序（先找到先用）：
      1) 图集文件夹里的 cover.jpg / cover.png / _cover.* / 封面.*
         想换封面，直接替换这个文件即可（它不会被当成图片显示）
      2) images/meta.json 里该图集的 "cover" 字段
      3) 该图集里的第一张图

    每张图还会带上原始宽高（w / h）。网页上缩略图是裁成正方形显示的，
    用不到它；记下来是为了以后想改排版时手上有数据。

    images/meta.json（可选，不存在就跳过）：
      {
        "collections": {
          "2026/9月": { "name": "显示名", "cover": "001.jpg" }
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
      也兼容旧格式：顶层直接就是「图片路径 -> 属性」的映射。
      date 是这张图的「日期」，用来画右侧热力图，见下面。

    ------------------------------------------------------------
    每日热力图（heatmap.json）：

      每张图都会被归到某一天，按这个顺序决定（先找到先用）：

        1) images/meta.json 里这张图的 "date" 字段
        2) 图片自带的 EXIF 拍摄时间（DateTimeOriginal / DateTime）
        3) 上一次生成的 images.json 里记着的日期
           —— 换电脑重新生成、文件时间被重置也不会乱
        4) 文件修改时间（最后兜底）

      统计出来的每天张数写进 heatmap.json：

        { "version": 1,
          "days": { "2026-01-05": { "count": 3, "note": "速写" } } }

      这里**不写生成时间**：内容没变时文件就不会变，
      重跑一次脚本 git status 是干净的，一眼能看出到底有没有变化。

      仓库根目录的 daily.json（可选）可以手动补录 / 覆盖某一天：

        { "days": {
            "2026-01-05": 3,                                    // 覆盖
            "2026-01-06": { "add": 2 },                         // 在自动统计上再加
            "2026-01-07": { "count": 1, "note": "只发了一张" },   // 覆盖 + 备注
            "2026-01-08": { "note": "写了一天代码" }              // 只要备注
        } }

      两种来源合并后写进 heatmap.json；前端只读这个文件，
      热力图的窗口（最近 3 个月 / 半年 / 一年）由前端自己算，
      所以隔很久不重新生成也不会显示错位。

    ------------------------------------------------------------
    派生图（两档）：
      脚本会顺手给每张图生成两张小图，目录结构与 images/ 保持一致，
      统一转成 .jpg。原图不再被页面自动加载，只用于「下载」和
      「复制图片 URL」。

        thumbs/  网格卡片和封面卡用，最长边 600px（约 20~50KB）
        views/   灯箱查看用，最长边 1600px（约 100~300KB）

      灯箱最多显示约 1000px 宽，以前直接拉原图等于下 4096px / 6.6MB
      只为显示 1000px，浪费 130 倍流量。现在换成 views/。

      用的是 .NET 自带的 System.Drawing，不需要安装任何东西。
      派生图比原图新时会自动跳过，所以重复运行很快。
      删图或改名后留下的旧派生图也会自动清理。

      可调参数：
        -NoThumbs            只更新清单和热力图，不生成派生图
        -NoExif              不读 EXIF，只用 meta.json / 旧清单 / 文件时间
        -ThumbWidth 600      缩略图最大宽度（默认 600）
        -ThumbQuality 82     缩略图 JPEG 质量（默认 82）
        -ViewWidth 1600      查看图最大边长（默认 1600）
        -ViewQuality 85      查看图 JPEG 质量（默认 85）

      两种情况会自动跳过，清单里对应字段留空、页面直接用原图：
        · webp / avif / svg —— System.Drawing 读不了
        · 原图本来就比派生图小（小 PNG 常见）—— 没必要为了"优化"变大

    ------------------------------------------------------------
    资源版本号：
      GitHub Pages 对所有文件都发 Cache-Control: max-age=600，浏览器
      10 分钟内不会重新请求。改了 style.css / script.js 如果 URL 不变，
      访客就会一直看到旧样式（刷新也没用）。

      所以本脚本会按这两个文件的内容算一个短哈希，写进 index.html：

          <link rel="stylesheet" href="style.css?v=d4b40e2f">
          <script src="script.js?v=d4b40e2f"></script>

      内容一变版本号就变，浏览器必然重新拉取。不用手动维护。
#>

[CmdletBinding()]
param(
    # 图片目录（相对仓库根目录）
    [string]$ImagesDir = 'images',

    # 输出的清单文件名（相对仓库根目录）
    [string]$OutputFile = 'images.json',

    # 输出的热力图数据文件名（相对仓库根目录）
    [string]$HeatmapFile = 'heatmap.json',

    # 手动补录 / 覆盖的每日记录（相对仓库根目录，可选）
    [string]$DailyFile = 'daily.json',

    # 缩略图输出目录（相对仓库根目录）
    [string]$ThumbDir = 'thumbs',

    # 缩略图最大宽度（像素）。网格里一张卡片约 285px 宽，600 够 2 倍屏
    [int]$ThumbWidth = 600,

    # 缩略图 JPEG 质量（1-100）
    [int]$ThumbQuality = 82,

    # 查看尺寸的输出目录（灯箱用，介于缩略图和原图之间）
    [string]$ViewDir = 'views',

    # 查看尺寸的最大边长。灯箱最多显示约 1000px 宽，1600 留了 1.6 倍余量
    [int]$ViewWidth = 1600,

    # 查看尺寸 JPEG 质量（1-100）
    [int]$ViewQuality = 85,

    # 只更新清单和热力图，不生成缩略图和查看尺寸
    [switch]$NoThumbs,

    # 不读 EXIF 拍摄时间（图很多时能快一点），日期只用 meta.json / 旧清单 / 文件时间
    [switch]$NoExif
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$imagesPath = Join-Path $root $ImagesDir
$outputPath = Join-Path $root $OutputFile
$heatmapPath = Join-Path $root $HeatmapFile
$dailyPath = Join-Path $root $DailyFile
$thumbRoot = Join-Path $root $ThumbDir
$viewRoot = Join-Path $root $ViewDir

if (-not (Test-Path -LiteralPath $imagesPath)) {
    Write-Host "找不到图片目录：$imagesPath" -ForegroundColor Red
    exit 1
}

$extensions = @('.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.svg')
# System.Drawing 读不了的格式，只能直接用小图代替缩略图
$thumbableExtensions = @('.jpg', '.jpeg', '.png', '.gif', '.bmp')
$coverNames = @('cover', '_cover', '封面')
$UNCLASSIFIED = '未分类'

# 必须写成 UTF-8 无 BOM，否则浏览器 fetch + JSON.parse 会报错
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# ---------- 小工具 ----------

# PS 5.1 的 ConvertTo-Json 会把中文输出成 \uXXXX，这里还原成可读字符
function ConvertTo-ReadableJson($payload) {
    $json = ConvertTo-Json -InputObject $payload -Depth 20

    $sb = New-Object System.Text.StringBuilder
    $last = 0
    # 不用 [regex]::Replace 的脚本块重载：5.1 不支持 ScriptBlock -> MatchEvaluator
    foreach ($m in [regex]::Matches($json, '\\u([0-9a-fA-F]{4})')) {
        [void]$sb.Append($json.Substring($last, $m.Index - $last))
        [void]$sb.Append([char][Convert]::ToInt32($m.Groups[1].Value, 16))
        $last = $m.Index + $m.Length
    }
    [void]$sb.Append($json.Substring($last))
    return $sb.ToString()
}

# 把各种写法的日期统一成 'yyyy-MM-dd'，认不出来就返回空串
function Get-DateKey($value) {
    if ($null -eq $value) { return '' }
    $s = ([string]$value).Trim()
    if (-not $s) { return '' }

    if ($s -match '^(\d{4})[-/:.](\d{1,2})[-/:.](\d{1,2})') {
        $y = [int]$matches[1]
        $m = [int]$matches[2]
        $d = [int]$matches[3]
        if ($m -ge 1 -and $m -le 12 -and $d -ge 1 -and $d -le 31) {
            return ('{0:d4}-{1:d2}-{2:d2}' -f $y, $m, $d)
        }
    }
    return ''
}

# ---------- 派生图（.NET 自带的 System.Drawing，无需装任何东西）----------
# 两档，原图不再被页面自动加载：
#   thumbs/  网格卡片和封面用，最长边 600px
#   views/   灯箱查看用，最长边 1600px（灯箱最多显示约 1000px 宽）
#   原图     只在「下载」和「复制图片 URL」时用到

# 尺寸、EXIF、派生图都要用它，能加载就加载（.NET 自带，不用装东西）
$drawingLoaded = $false
try {
    Add-Type -AssemblyName System.Drawing
    $drawingLoaded = $true
}
catch {
    Write-Host "无法加载 System.Drawing：本次不生成派生图、不读 EXIF，也没有图片尺寸：$($_.Exception.Message)" -ForegroundColor Yellow
}

$derivativesAvailable = $drawingLoaded -and (-not $NoThumbs)

# 源图相对 images/ 的路径 -> 派生图相对仓库的路径
$thumbMap = @{}
$viewMap = @{}
$usedNames = @{}      # 防止不同源图撞到同一个派生图文件名
$thumbStats = @{ made = 0; skipped = 0; failed = 0; dropped = 0; bytes = 0 }
$viewStats = @{ made = 0; skipped = 0; failed = 0; dropped = 0; bytes = 0 }

function Get-DerivativeRelPath($relFromImages, $dirName) {
    $dir = Split-Path $relFromImages -Parent
    $base = [System.IO.Path]::GetFileNameWithoutExtension($relFromImages)

    $candidate = if ($dir) { Join-Path $dirName (Join-Path $dir "$base.jpg") } else { Join-Path $dirName "$base.jpg" }
    $candidate = $candidate -replace '\\', '/'

    # 同名不同扩展名（a.png 和 a.jpg）会撞车，撞了就带上原扩展名
    if ($usedNames.ContainsKey($candidate) -and $usedNames[$candidate] -ne $relFromImages) {
        $ext = [System.IO.Path]::GetExtension($relFromImages).TrimStart('.').ToLower()
        $candidate = if ($dir) { Join-Path $dirName (Join-Path $dir "$base.$ext.jpg") } else { Join-Path $dirName "$base.$ext.jpg" }
        $candidate = $candidate -replace '\\', '/'
    }
    $usedNames[$candidate] = $relFromImages
    return $candidate
}

function New-ScaledJpeg($sourcePath, $targetPath, $maxWidth, $quality) {
    $img = $null; $bmp = $null; $gfx = $null
    try {
        $img = [System.Drawing.Image]::FromFile($sourcePath)

        $ratio = $maxWidth / $img.Width
        if ($ratio -gt 1) { $ratio = 1 }        # 不放大
        $w = [int][Math]::Max(1, [Math]::Round($img.Width * $ratio))
        $h = [int][Math]::Max(1, [Math]::Round($img.Height * $ratio))

        $bmp = New-Object System.Drawing.Bitmap($w, $h)
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)
        $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        # 透明区域铺白，否则转 JPEG 会变黑
        $gfx.Clear([System.Drawing.Color]::White)
        $gfx.DrawImage($img, 0, 0, $w, $h)

        $targetDir = Split-Path -Parent $targetPath
        if (-not (Test-Path -LiteralPath $targetDir)) {
            New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        }

        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
            Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1

        $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
            [System.Drawing.Imaging.Encoder]::Quality, [int]$quality)

        $bmp.Save($targetPath, $codec, $encParams)
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($gfx) { $gfx.Dispose() }
        if ($bmp) { $bmp.Dispose() }
        if ($img) { $img.Dispose() }
    }
}

# 为一张图生成一档派生图，成功后记进对应的 map
function Add-Derivative($relFromImages, $map, $dirName, $maxWidth, $quality, $stats) {
    if (-not $derivativesAvailable) { return }

    # 已经处理过就跳过：封面和图片会是同一张，避免重复计数
    if ($map.ContainsKey($relFromImages)) { return }

    $ext = [System.IO.Path]::GetExtension($relFromImages).ToLower()
    if ($thumbableExtensions -notcontains $ext) { return }   # webp/avif/svg 跳过

    $rel = Get-DerivativeRelPath $relFromImages $dirName
    $sourceFull = Join-Path $imagesPath $relFromImages
    $targetFull = Join-Path $root ($rel -replace '/', '\')

    # 增量：派生图比原图新就跳过
    if (Test-Path -LiteralPath $targetFull) {
        $srcTime = (Get-Item -LiteralPath $sourceFull).LastWriteTimeUtc
        $dstTime = (Get-Item -LiteralPath $targetFull).LastWriteTimeUtc
        if ($dstTime -ge $srcTime) {
            $map[$relFromImages] = $rel
            $stats.skipped++
            $stats.bytes += (Get-Item -LiteralPath $targetFull).Length
            return
        }
    }

    if (New-ScaledJpeg $sourceFull $targetFull $maxWidth $quality) {
        $derivedSize = (Get-Item -LiteralPath $targetFull).Length
        $sourceSize = (Get-Item -LiteralPath $sourceFull).Length

        # 本来就小的图，重编码成 JPEG 反而更大（PNG 小图很常见）。
        # 这种情况直接丢掉派生图，让页面用原图，反而更快。
        if ($derivedSize -ge $sourceSize) {
            Remove-Item -LiteralPath $targetFull -Force
            $stats.dropped++
            return
        }

        $map[$relFromImages] = $rel
        $stats.made++
        $stats.bytes += $derivedSize
    }
    else {
        $stats.failed++
        Write-Host ("  $dirName 生成失败，将直接用原图：" + $relFromImages) -ForegroundColor Yellow
    }
}

function Add-ThumbFor($relFromImages) {
    Add-Derivative $relFromImages $thumbMap $ThumbDir $ThumbWidth $ThumbQuality $thumbStats
}

function Add-ViewFor($relFromImages) {
    Add-Derivative $relFromImages $viewMap $ViewDir $ViewWidth $ViewQuality $viewStats
}

function ConvertTo-TagArray($value) {
    if ($null -eq $value) { return @() }
    $raw = @()
    foreach ($v in @($value)) {
        $raw += ([string]$v) -split '[,，;；]'
    }
    return @($raw | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

# ---------- 读 EXIF 拍摄时间 ----------

function Get-ExifDateKey($fullPath) {
    if (-not $drawingLoaded) { return '' }

    $img = $null
    try {
        $img = [System.Drawing.Image]::FromFile($fullPath)
        # 0x9003 DateTimeOriginal（拍摄） > 0x9004 DateTimeDigitized > 0x0132 DateTime
        foreach ($id in @(0x9003, 0x9004, 0x0132)) {
            try {
                $prop = $img.GetPropertyItem($id)
                $text = [System.Text.Encoding]::ASCII.GetString($prop.Value)
                $key = Get-DateKey $text
                if ($key) { return $key }
            }
            catch {
                # 这张图没有这个属性，继续试下一个
            }
        }
    }
    catch {
        # 读不了就算了，交给文件时间兜底
    }
    finally {
        if ($img) { $img.Dispose() }
    }
    return ''
}

# ---------- 读图片尺寸 ----------
# 瀑布流要靠原始宽高比先把位置算好，不然图一张张加载出来高度一变，
# 整面墙会跳来跳去。优先读缩略图（小、快、一定读得出来），没有就读原图。

function Get-ImageSize($fullPath, $relFromImages) {
    $target = $fullPath
    if ($relFromImages -and $thumbMap.ContainsKey($relFromImages)) {
        $thumbFull = Join-Path $root ($thumbMap[$relFromImages] -replace '/', '\')
        if (Test-Path -LiteralPath $thumbFull) { $target = $thumbFull }
    }
    if ((-not $drawingLoaded) -or (-not $target)) { return @(0, 0) }

    $img = $null
    try {
        $img = [System.Drawing.Image]::FromFile($target)
        return @([int]$img.Width, [int]$img.Height)
    }
    catch {
        # webp / avif / svg 之类读不了，交给前端按默认比例兜底
        return @(0, 0)
    }
    finally {
        if ($img) { $img.Dispose() }
    }
}

# ---------- 上一次生成的 images.json 里记着的日期 ----------
# 换电脑 / 重新 clone 之后文件时间会全部变成同一天，这张表能保住原来的日期。

function Get-PreviousDates($path) {
    $map = @{}
    if (-not (Test-Path -LiteralPath $path)) { return $map }

    try {
        $old = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($old -and $old.groups) {
            $flat = New-Object System.Collections.Generic.List[object]

            foreach ($g in @($old.groups)) {
                foreach ($c in @($g.collections)) {
                    # 新清单是 collections -> images
                    if ($c.images) {
                        foreach ($i in @($c.images)) { $flat.Add($i) }
                    }
                    # 旧清单是 collections -> roles -> images
                    if ($c.roles) {
                        foreach ($r in @($c.roles)) {
                            if ($r.images) {
                                foreach ($i in @($r.images)) { $flat.Add($i) }
                            }
                        }
                    }
                }
            }

            foreach ($i in $flat) {
                if (-not $i.file -or -not $i.date) { continue }
                $key = Get-DateKey $i.date
                if (-not $key) { continue }
                $rel = ([string]$i.file) -replace ('^' + [regex]::Escape("$ImagesDir/")), ''
                if ($rel) { $map[$rel] = $key }
            }
        }
    }
    catch {
        Write-Host "旧的 $OutputFile 读不了，日期将重新判断：$($_.Exception.Message)" -ForegroundColor DarkGray
    }
    return $map
}

$previousDates = Get-PreviousDates $outputPath
if ($previousDates.Count -gt 0) {
    Write-Host "已沿用 $($previousDates.Count) 张图的旧日期（来自上一次的 $OutputFile）" -ForegroundColor DarkGray
}

# ---------- 读取 meta.json ----------

$metaCollections = @{}
$metaImages = @{}

$metaPath = Join-Path $imagesPath 'meta.json'
if (Test-Path -LiteralPath $metaPath) {
    try {
        $raw = Get-Content -LiteralPath $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $propNames = @($raw.PSObject.Properties.Name)

        if (($propNames -contains 'collections') -or ($propNames -contains 'images')) {
            if ($raw.collections) {
                foreach ($p in $raw.collections.PSObject.Properties) {
                    $metaCollections[($p.Name -replace '\\', '/').Trim('/')] = $p.Value
                }
            }
            if ($raw.images) {
                foreach ($p in $raw.images.PSObject.Properties) {
                    $metaImages[($p.Name -replace '\\', '/').Replace('images/', '').Trim('/')] = $p.Value
                }
            }
        }
        else {
            # 旧格式：顶层直接是「图片路径 -> 属性」
            foreach ($p in $raw.PSObject.Properties) {
                $metaImages[($p.Name -replace '\\', '/').Replace('images/', '').Trim('/')] = $p.Value
            }
        }

        Write-Host "已读取 meta.json（图集 $($metaCollections.Count) 条 / 图片 $($metaImages.Count) 条）" -ForegroundColor Cyan
    }
    catch {
        Write-Host "meta.json 解析失败，已忽略：$($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ---------- 读取 daily.json（手动补录 / 覆盖）----------
# 值可以是：
#   数字               -> 直接覆盖这一天的数量
#   { "count": n }     -> 覆盖
#   { "add": n }       -> 在自动统计之上再加 n
#   { "note": "..." }  -> 备注（数量和自动统计一样）
# 也可以直接写成 { "2026-01-05": 3 } 这种没有 "days" 外壳的形式。

$manualDays = @{}

if (Test-Path -LiteralPath $dailyPath) {
    try {
        $raw = Get-Content -LiteralPath $dailyPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $entries = $raw
        if ($raw -and (@($raw.PSObject.Properties.Name) -contains 'days')) {
            $entries = $raw.days
        }

        if ($entries) {
            foreach ($p in $entries.PSObject.Properties) {
                if ($p.Name.StartsWith('_')) { continue }      # 下划线开头当注释，跳过

                $key = Get-DateKey $p.Name
                if (-not $key) {
                    Write-Host "daily.json 里的「$($p.Name)」不是合法日期，已跳过" -ForegroundColor Yellow
                    continue
                }

                $val = $p.Value
                $item = @{ count = $null; add = 0; note = '' }

                if (($null -ne $val) -and ($val.GetType().Name -eq 'PSCustomObject')) {
                    $names = @($val.PSObject.Properties.Name)
                    if ($names -contains 'count') { $item.count = [int]$val.count }
                    if ($names -contains 'add') { $item.add = [int]$val.add }
                    if ($names -contains 'note') { $item.note = [string]$val.note }
                }
                elseif ($val -is [string]) {
                    $item.note = $val
                }
                else {
                    $item.count = [int]$val
                }

                $manualDays[$key] = $item
            }
        }

        Write-Host "已读取 daily.json（手动记录 $($manualDays.Count) 天）" -ForegroundColor Cyan
    }
    catch {
        Write-Host "daily.json 解析失败，已忽略：$($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ---------- 扫描文件，建两级树 ----------

$files = Get-ChildItem -LiteralPath $imagesPath -Recurse -File |
    Where-Object { $extensions -contains $_.Extension.ToLower() } |
    Where-Object { $_.Name -notlike '.*' } |
    Where-Object { $coverNames -notcontains [System.IO.Path]::GetFileNameWithoutExtension($_.Name).ToLower() } |
    Sort-Object FullName

$tree = [ordered]@{}
$coverFiles = @{}
$count = 0
$autoDays = @{}      # 'yyyy-MM-dd' -> 当天的图片张数
$flattened = 0       # 图集里又套了子文件夹、被合并进来的图片数

foreach ($file in $files) {
    $relFromImages = $file.FullName.Substring($imagesPath.Length).TrimStart('\', '/') -replace '\\', '/'
    $segments = @($relFromImages -split '/' | Where-Object { $_ })
    if ($segments.Count -lt 1) { continue }

    $name = $segments[$segments.Count - 1]
    $dirs = @()
    if ($segments.Count -gt 1) {
        $dirs = @($segments[0..($segments.Count - 2)])
    }

    # 第 1 层 = 大类，第 2 层 = 图集；再深的子文件夹直接并进图集，不再分角色
    $group = if ($dirs.Count -ge 1) { $dirs[0] } else { $UNCLASSIFIED }
    $collection = if ($dirs.Count -ge 2) { $dirs[1] } else { $UNCLASSIFIED }
    if ($dirs.Count -ge 3) { $flattened++ }

    $relPath = "$ImagesDir/$relFromImages"
    $title = [System.IO.Path]::GetFileNameWithoutExtension($name)
    $description = ''
    $tags = @()
    $metaEntry = $null

    if ($metaImages.ContainsKey($relFromImages)) {
        $metaEntry = $metaImages[$relFromImages]
        if ($metaEntry.title) { $title = [string]$metaEntry.title }
        if ($metaEntry.description) { $description = [string]$metaEntry.description }
        if ($metaEntry.tags) { $tags = ConvertTo-TagArray $metaEntry.tags }
    }

    # ---- 这张图算哪一天（热力图用）----
    $dateKey = ''
    if ($metaEntry -and $metaEntry.date) { $dateKey = Get-DateKey $metaEntry.date }
    if (-not $dateKey -and -not $NoExif) { $dateKey = Get-ExifDateKey $file.FullName }
    if (-not $dateKey -and $previousDates.ContainsKey($relFromImages)) { $dateKey = $previousDates[$relFromImages] }
    if (-not $dateKey) { $dateKey = Get-DateKey $file.LastWriteTime.ToString('yyyy-MM-dd') }

    if ($dateKey) {
        if ($autoDays.ContainsKey($dateKey)) { $autoDays[$dateKey] = [int]$autoDays[$dateKey] + 1 }
        else { $autoDays[$dateKey] = 1 }
    }

    if (-not $tree.Contains($group)) { $tree[$group] = [ordered]@{} }
    if (-not $tree[$group].Contains($collection)) {
        $tree[$group][$collection] = New-Object System.Collections.Generic.List[object]
    }

    # 先生成两档派生图，再写进条目
    Add-ThumbFor $relFromImages
    Add-ViewFor $relFromImages

    $thumbRel = ''
    if ($thumbMap.ContainsKey($relFromImages)) { $thumbRel = $thumbMap[$relFromImages] }
    $viewRel = ''
    if ($viewMap.ContainsKey($relFromImages)) { $viewRel = $viewMap[$relFromImages] }

    # 瀑布流排版要用原始宽高比
    $size = Get-ImageSize $file.FullName $relFromImages
    $width = [int]$size[0]
    $height = [int]$size[1]

    $tree[$group][$collection].Add([pscustomobject][ordered]@{
        file        = $relPath
        thumb       = $thumbRel
        view        = $viewRel
        title       = $title
        description = $description
        tags        = $tags
        date        = $dateKey
        w           = $width
        h           = $height
    }) | Out-Null

    $count++
}

# ---------- 找封面文件（cover.jpg / _cover.png / 封面.webp）----------

foreach ($group in @($tree.Keys)) {
    foreach ($collection in @($tree[$group].Keys)) {
        $dir = Join-Path $imagesPath (Join-Path $group $collection)
        if (-not (Test-Path -LiteralPath $dir)) { continue }

        $found = Get-ChildItem -LiteralPath $dir -File |
            Where-Object { $extensions -contains $_.Extension.ToLower() } |
            Where-Object { $coverNames -contains [System.IO.Path]::GetFileNameWithoutExtension($_.Name).ToLower() } |
            Select-Object -First 1

        if ($found) {
            $rel = $found.FullName.Substring($imagesPath.Length).TrimStart('\', '/') -replace '\\', '/'
            $coverFiles["$group/$collection"] = "$ImagesDir/$rel"
            Add-ThumbFor $rel      # 封面也要缩略图，它在卡片里也是小图
        }
    }
}

# ---------- 组装 JSON 结构 ----------

$groupsOut = New-Object System.Collections.Generic.List[object]
$totalImages = 0

foreach ($group in @($tree.Keys | Sort-Object)) {
    $collectionsOut = New-Object System.Collections.Generic.List[object]
    $groupImages = 0
    $groupCover = ''
    $groupCoverThumb = ''

    foreach ($collection in @($tree[$group].Keys | Sort-Object)) {
        $list = $tree[$group][$collection]
        $collectionImages = $list.Count
        if ($collectionImages -eq 0) { continue }

        # 排序是文件名顺序，第一张就是封面兜底
        $firstImage = $list[0].file

        $key = "$group/$collection"
        $cover = ''
        if ($coverFiles.ContainsKey($key)) {
            $cover = $coverFiles[$key]
        }
        elseif ($metaCollections.ContainsKey($key) -and $metaCollections[$key].cover) {
            $c = ([string]$metaCollections[$key].cover) -replace '\\', '/'
            if ($c -match '^images/') {
                $cover = $c
            }
            else {
                $cover = "$ImagesDir/$group/$collection/$($c.TrimStart('/'))"
            }
        }
        else {
            $cover = $firstImage
        }

        # 封面在卡片里也是小图，同样给它一张缩略图
        $coverRel = ''
        if ($cover -match "^$([regex]::Escape($ImagesDir))/(.+)$") { $coverRel = $matches[1] }
        if ($coverRel -and (Test-Path -LiteralPath (Join-Path $imagesPath $coverRel))) {
            Add-ThumbFor $coverRel
        }
        $coverThumb = ''
        if ($coverRel -and $thumbMap.ContainsKey($coverRel)) { $coverThumb = $thumbMap[$coverRel] }

        $displayName = $collection
        if ($metaCollections.ContainsKey($key) -and $metaCollections[$key].name) {
            $displayName = [string]$metaCollections[$key].name
        }

        $collectionsOut.Add([pscustomobject][ordered]@{
            name       = $displayName
            path       = $key
            cover      = $cover
            coverThumb = $coverThumb
            imageCount = $collectionImages
            images     = $list.ToArray()
        }) | Out-Null

        $groupImages += $collectionImages
        if (-not $groupCover) { $groupCover = $cover }
        if (-not $groupCoverThumb) { $groupCoverThumb = $coverThumb }
    }

    if ($collectionsOut.Count -eq 0) { continue }

    $groupsOut.Add([pscustomobject][ordered]@{
        name            = $group
        cover           = $groupCover
        coverThumb      = $groupCoverThumb
        collectionCount = $collectionsOut.Count
        imageCount      = $groupImages
        collections     = $collectionsOut.ToArray()
    }) | Out-Null

    $totalImages += $groupImages
}

# ---------- 清理孤儿派生图 ----------
# 图片被删除或改名后，thumbs/ views/ 里会留下对不上号的旧文件。
# 不清掉的话它们会一直跟着仓库走，越积越多。

$orphansRemoved = 0

function Remove-OrphanDerivatives($rootDir, $map) {
    if (-not $derivativesAvailable) { return 0 }
    if (-not (Test-Path -LiteralPath $rootDir)) { return 0 }

    $expected = @{}
    foreach ($key in $map.Keys) {
        $expected[(Join-Path $root ($map[$key] -replace '/', '\'))] = $true
    }

    $removed = 0
    Get-ChildItem -LiteralPath $rootDir -Recurse -File | ForEach-Object {
        if (-not $expected.ContainsKey($_.FullName)) {
            Remove-Item -LiteralPath $_.FullName -Force
            $removed++
        }
    }

    # 顺手删掉空目录
    Get-ChildItem -LiteralPath $rootDir -Recurse -Directory |
        Sort-Object { $_.FullName.Length } -Descending |
        ForEach-Object {
            if (-not (Get-ChildItem -LiteralPath $_.FullName -Recurse -File -ErrorAction SilentlyContinue)) {
                Remove-Item -LiteralPath $_.FullName -Recurse -Force
            }
        }

    return $removed
}

$orphansRemoved += Remove-OrphanDerivatives $thumbRoot $thumbMap
$orphansRemoved += Remove-OrphanDerivatives $viewRoot $viewMap

# ---------- 写 images.json ----------

if ($groupsOut.Count -eq 0) {
    $json = '[]'
}
else {
    $payload = [pscustomobject][ordered]@{
        version = 3
        groups  = $groupsOut.ToArray()
    }
    $json = ConvertTo-ReadableJson $payload
}

[System.IO.File]::WriteAllText($outputPath, $json, $utf8NoBom)

# ---------- 写 heatmap.json ----------
# 自动统计（图片日期）和手动补录（daily.json）在这里合并。

$dayKeys = @{}
foreach ($k in $autoDays.Keys) { $dayKeys[$k] = $true }
foreach ($k in $manualDays.Keys) { $dayKeys[$k] = $true }

$daysOut = [ordered]@{}
$heatTotal = 0
$heatActiveDays = 0
$heatMax = 0
$heatMaxDate = ''
$manualUsed = 0

foreach ($key in @($dayKeys.Keys | Sort-Object)) {
    $auto = 0
    if ($autoDays.ContainsKey($key)) { $auto = [int]$autoDays[$key] }

    $dayCount = $auto
    $note = ''

    if ($manualDays.ContainsKey($key)) {
        $m = $manualDays[$key]
        if ($null -ne $m.count) { $dayCount = [int]$m.count }
        if ($m.add) { $dayCount = $dayCount + [int]$m.add }
        $note = [string]$m.note
        $manualUsed++
    }

    if ($dayCount -lt 0) { $dayCount = 0 }
    if ($dayCount -eq 0 -and -not $note) { continue }

    $entry = [ordered]@{ count = $dayCount }
    if ($note) { $entry.note = $note }
    $daysOut[$key] = $entry

    $heatTotal += $dayCount
    if ($dayCount -gt 0) { $heatActiveDays++ }
    if ($dayCount -gt $heatMax) { $heatMax = $dayCount; $heatMaxDate = $key }
}

$heatPayload = [pscustomobject][ordered]@{
    version = 1
    days    = $daysOut
}

[System.IO.File]::WriteAllText($heatmapPath, (ConvertTo-ReadableJson $heatPayload), $utf8NoBom)

# ---------- 给 style.css / script.js 打版本号 ----------
# GitHub Pages 对所有文件都下发 Cache-Control: max-age=600，
# 浏览器 10 分钟内不会重新请求。如果改了 CSS/JS 而 URL 不变，
# 访客就会一直看到旧样式（刷也没用）。这里按内容算一个短哈希拼在
# URL 后面，内容一变 URL 就变，浏览器必然重新拉取。

$indexPath = Join-Path $root 'index.html'
$assetVersion = ''

if (Test-Path -LiteralPath $indexPath) {
    $combined = ''
    foreach ($asset in @('style.css', 'script.js')) {
        $assetPath = Join-Path $root $asset
        if (Test-Path -LiteralPath $assetPath) {
            $combined += [System.IO.File]::ReadAllText($assetPath, [System.Text.Encoding]::UTF8)
        }
    }

    if ($combined) {
        $md5 = [System.Security.Cryptography.MD5]::Create()
        $assetVersion = ([System.BitConverter]::ToString(
            $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($combined))) -replace '-', '').Substring(0, 8).ToLower()
        $md5.Dispose()

        $html = [System.IO.File]::ReadAllText($indexPath, [System.Text.Encoding]::UTF8)
        $updated = $html -replace 'href="style\.css(\?v=[0-9a-f]+)?"', "href=`"style.css?v=$assetVersion`""
        $updated = $updated -replace 'src="script\.js(\?v=[0-9a-f]+)?"', "src=`"script.js?v=$assetVersion`""

        if ($updated -ne $html) {
            [System.IO.File]::WriteAllText($indexPath, $updated, $utf8NoBom)
        }
    }
}

Write-Host ""
Write-Host "已生成清单：$outputPath" -ForegroundColor Green
Write-Host "共 $totalImages 张图片 / $($groupsOut.Count) 个大类" -ForegroundColor Green
Write-Host "已生成热力图数据：$heatmapPath" -ForegroundColor Green
Write-Host ("  有记录 $($daysOut.Count) 天（自动统计 $($autoDays.Count) 天 / 手动补录 $manualUsed 天），合计 $heatTotal 张") -ForegroundColor Green
if ($heatMax -gt 0) {
    Write-Host "  单日最多 $heatMax 张（$heatMaxDate）" -ForegroundColor Green
}
if ($assetVersion) {
    Write-Host "资源版本号：style.css / script.js -> ?v=$assetVersion" -ForegroundColor Green
}

foreach ($g in $groupsOut) {
    Write-Host ""
    Write-Host ("  【{0}】{1} 个图集，{2} 张图" -f $g.name, $g.collectionCount, $g.imageCount) -ForegroundColor Cyan
    foreach ($c in $g.collections) {
        Write-Host ("    - {0}（{1} 张）封面: {2}" -f $c.name, $c.imageCount, (Split-Path $c.cover -Leaf))
    }
}

if ($flattened -gt 0) {
    Write-Host ""
    Write-Host "  有 $flattened 张图放在图集下的子文件夹里，已合并进图集（现在只分两级，不再有角色）" -ForegroundColor DarkGray
}

if ($totalImages -gt 0) {
    Write-Host ""
    Write-Host "提示：换图集封面 = 往该图集文件夹放一个 cover.jpg；改标题/标签/日期 = 编辑 images\meta.json" -ForegroundColor DarkGray
}

# ---------- 派生图统计 ----------

if ($derivativesAvailable) {
    function Format-DerivativeStats($stats) {
        $text = "新生成 $($stats.made) 张"
        if ($stats.skipped -gt 0) { $text += "，复用 $($stats.skipped) 张" }
        if ($stats.dropped -gt 0) { $text += "，$($stats.dropped) 张原图更小改用原图" }
        return "$text，合计 {0:N0} KB" -f ($stats.bytes / 1KB)
    }

    Write-Host ""
    Write-Host ("缩略图（{0}/，网格用）：{1}" -f $ThumbDir, (Format-DerivativeStats $thumbStats)) -ForegroundColor Green
    Write-Host ("查看图（{0}/，灯箱用）：{1}" -f $ViewDir, (Format-DerivativeStats $viewStats)) -ForegroundColor Green

    if ($orphansRemoved -gt 0) {
        Write-Host "  清理了 $orphansRemoved 个已失效的旧派生图（图片被删或改名留下的）" -ForegroundColor Green
    }
    if ($thumbStats.failed -gt 0 -or $viewStats.failed -gt 0) {
        Write-Host "  有 $($thumbStats.failed + $viewStats.failed) 张生成失败，这些图会直接用原图显示" -ForegroundColor Yellow
    }
    Write-Host ("  合计 {0:N0} KB；原图只在点击「下载」时用到。" -f (($thumbStats.bytes + $viewStats.bytes) / 1KB)) -ForegroundColor DarkGray
}
elseif (-not $NoThumbs) {
    Write-Host ""
    Write-Host "本次未生成派生图。" -ForegroundColor Yellow
}
