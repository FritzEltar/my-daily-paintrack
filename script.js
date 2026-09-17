/* =========================================================
   My Daily Paintrack — 图库 + 每日热力图 前端脚本
   ---------------------------------------------------------
   数据来源（都在同目录下，由 tools/generate-manifest.ps1 生成）：
     images.json    图片清单
     heatmap.json   每日数量：{ "days": { "2026-01-05": {count, note} } }

   清单是两级嵌套结构：
     {
       "version": 3,
       "groups": [                       // 第 1 级：大类（如「2026」）
         {
           "name": "2026",
           "cover": "images/...",
           "collectionCount": 1,
           "imageCount": 12,
           "collections": [              // 第 2 级：图集
             {
               "name": "9月",
               "path": "2026/9月",
               "cover": "images/...",    // 封面，每个图集固定一张
               "imageCount": 12,
               "images": [               // 图集里的图，拼成一面正方形缩略图墙
                 {
                   "file": "images/2026/9月/001.jpg",
                   "thumb": "thumbs/...", // 墙上用这张
                   "view": "views/...",   // 灯箱用这张
                   "title": "001",        // 鼠标悬停在缩略图上才显示
                   "tags": [], "date": "2026-09-01",
                   "w": 1400, "h": 2000   // 原图宽高（记录用，排版不依赖它）
                 }
               ]
             }
           ]
         }
       ]
     }

   导航（单页，不刷新、不开新网页）：
     #/                        只有一个大类时直接进它，否则显示大类列表
     #/2026                    该大类下的图集封面列表
     #/2026/9月                图集内部：一整面正方形缩略图墙
   浏览器前进 / 后退键可以直接用。

   右侧热力图只在「大类 / 图集列表」这两层出现；进入图集看图时
   会隐藏，把整幅宽度让给图片墙（body 加 .side-hidden）。
   ========================================================= */

(function () {
    'use strict';

    /* ---------------- 配置 ---------------- */

    var PAGE_SIZE = 24;                 // 每页显示张数（6 行 × 4 列）
    var MANIFEST_URL = 'images.json';   // 图片清单地址
    var HEATMAP_URL = 'heatmap.json';   // 每日热力图数据
    var STORAGE_KEY = 'paintrack-dark';
    var HEATMAP_WEEKS = 26;             // 热力图默认显示多少周（半年）

    /* ---------------- DOM ---------------- */

    var el = {
        homeLink: document.getElementById('homeLink'),
        breadcrumb: document.getElementById('breadcrumb'),

        groupsView: document.getElementById('groupsView'),
        groupsGrid: document.getElementById('groupsGrid'),

        collectionsView: document.getElementById('collectionsView'),
        collectionsGrid: document.getElementById('collectionsGrid'),

        imagesView: document.getElementById('imagesView'),
        searchInput: document.getElementById('searchInput'),
        resultCount: document.getElementById('resultCount'),
        gallery: document.getElementById('gallery'),
        imagesEmpty: document.getElementById('imagesEmpty'),
        imagesEmptyTitle: document.getElementById('imagesEmptyTitle'),
        imagesEmptyText: document.getElementById('imagesEmptyText'),
        pagination: document.getElementById('pagination'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        pageInfo: document.getElementById('pageInfo'),

        statusMessage: document.getElementById('statusMessage'),
        statusIcon: document.getElementById('statusIcon'),
        statusTitle: document.getElementById('statusTitle'),
        statusText: document.getElementById('statusText'),

        darkModeBtn: document.getElementById('darkModeBtn'),
        modal: document.getElementById('imageModal'),
        modalImage: document.getElementById('modalImage'),
        modalLoading: document.getElementById('modalLoading'),
        modalTitle: document.getElementById('modalTitle'),
        modalDescription: document.getElementById('modalDescription'),
        closeModal: document.getElementById('closeModal'),
        copyUrlBtn: document.getElementById('copyUrlBtn'),
        downloadBtn: document.getElementById('downloadBtn'),

        sidePanel: document.getElementById('sidePanel'),
        heatmap: document.getElementById('heatmap'),
        heatmapMonths: document.getElementById('heatmapMonths'),
        heatmapGrid: document.getElementById('heatmapGrid'),
        heatmapRange: document.getElementById('heatmapRange'),
        heatmapRangeSwitch: document.getElementById('heatmapRangeSwitch'),
        heatmapStats: document.getElementById('heatmapStats'),
        heatmapRecent: document.getElementById('heatmapRecent'),
        heatmapLegend: document.getElementById('heatmapLegend'),
        hmTip: document.getElementById('hmTip')
    };

    /* ---------------- 状态 ---------------- */

    var data = { groups: [] };          // 完整清单

    var view = {
        group: null,        // 当前大类名
        collection: null,   // 当前图集名
        query: '',          // 搜索词（只在图集内部生效）
        page: 1
    };

    var shownImages = [];               // 当前筛选出的全部图片（灯箱在其中前后翻）
    var modalIndex = -1;

    var heat = {
        available: false,   // heatmap.json 是否读到了
        days: {},           // 'YYYY-MM-DD' -> { count, note }
        weeks: HEATMAP_WEEKS
    };

    /* ---------------- 工具 ---------------- */

    function baseName(path) {
        var name = String(path).split('/').pop();
        return name.replace(/\.[^.]+$/, '');
    }

    function debounce(fn, wait) {
        var timer = null;
        return function () {
            var args = arguments;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(null, args); }, wait);
        };
    }

    /* ---------------- 日期工具 ----------------
       热力图按本地日期分格，'YYYY-MM-DD' 是键。
       所有计算都走「本地年月日」，避免 Date 解析 UTC 造成的偏移。 */

    function pad2(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function dayKey(d) {
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    }

    function parseDayKey(key) {
        var p = String(key).split('-');
        if (p.length !== 3) { return null; }
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return isNaN(d.getTime()) ? null : d;
    }

    function addDays(d, n) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    }

    // 周日为一周的第一天，和热力图的 7 行对齐
    function startOfWeek(d) {
        return addDays(d, -d.getDay());
    }

    // 把一个日期压成一个整数天号，用来算间隔（不受时区 / 夏令时影响）
    function dayNumber(d) {
        return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    }

    function today() {
        var d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    /* ---------------- 路由 ---------------- */

    function parseHash() {
        var raw = location.hash.replace(/^#\/?/, '');
        if (!raw) {
            return { group: null, collection: null };
        }
        // 先按 / 切分再解码，这样名字里的 / 会以 %2F 形式保留在单个片段内
        // 第 3 段（旧版是角色名）直接忽略，老链接照样能打开
        var parts = raw.split('/').filter(function (p) { return p !== ''; });
        return {
            group: parts[0] ? decodeURIComponent(parts[0]) : null,
            collection: parts[1] ? decodeURIComponent(parts[1]) : null
        };
    }

    function buildHash(group, collection) {
        var parts = [group, collection]
            .filter(function (p) { return p; })
            .map(encodeURIComponent);
        return '#/' + parts.join('/');
    }

    function navigate(group, collection) {
        var hash = buildHash(group, collection);
        if (location.hash === hash) {
            applyRoute();
        } else {
            location.hash = hash;   // 触发 hashchange -> applyRoute
        }
    }

    /* ---------------- 数据查找 ---------------- */

    function findGroup(name) {
        for (var i = 0; i < data.groups.length; i++) {
            if (data.groups[i].name === name) { return data.groups[i]; }
        }
        return null;
    }

    function findCollection(group, name) {
        if (!group) { return null; }
        for (var i = 0; i < group.collections.length; i++) {
            if (group.collections[i].name === name) { return group.collections[i]; }
        }
        return null;
    }

    // 图集里的图片数组。兼容还没重跑生成脚本的旧清单（collections -> roles -> images）
    function collectionImages(collection) {
        if (!collection) { return []; }
        if (collection.images) { return collection.images; }

        var out = [];
        (collection.roles || []).forEach(function (role) {
            (role.images || []).forEach(function (img) { out.push(img); });
        });
        return out;
    }

    // 把路由解析成合法状态：找不到的层级一律回退到上一层
    function applyRoute() {
        var route = parseHash();

        var group = findGroup(route.group);
        if (!group && data.groups.length === 1 && !route.group) {
            group = data.groups[0];              // 只有一个大类时自动进入
        }
        if (!group) {
            view.group = null;
            view.collection = null;
            view.query = '';
            view.page = 1;
            render();
            return;
        }

        var collection = findCollection(group, route.collection);

        view.group = group.name;
        view.collection = collection ? collection.name : null;
        view.query = '';
        view.page = 1;
        if (el.searchInput) { el.searchInput.value = ''; }

        render();
    }

    /* ---------------- 右侧栏显隐 ----------------
       只在「大类列表 / 图集列表」显示热力图；看图时藏起来。 */

    function setSideVisible(show) {
        var visible = !!show && heat.available && !!el.sidePanel;
        document.body.classList.toggle('side-hidden', !visible);
    }

    /* ---------------- 视图切换 ---------------- */

    function show(el2, visible) {
        if (el2) { el2.style.display = visible ? '' : 'none'; }
    }

    function render() {
        show(el.groupsView, false);
        show(el.collectionsView, false);
        show(el.imagesView, false);
        show(el.statusMessage, false);

        var group = findGroup(view.group);

        if (!group) {
            // 多个大类时显示大类列表；图库为空则由 renderStatus 接管
            if (data.groups.length > 1) {
                renderGroups();
                show(el.groupsView, true);
            }
            setSideVisible(true);
            renderBreadcrumb();
            return;
        }

        if (!view.collection) {
            renderCollections(group);
            show(el.collectionsView, true);
            setSideVisible(true);
            renderBreadcrumb();
            return;
        }

        renderImages(group);
        show(el.imagesView, true);
        setSideVisible(false);      // 看图时把宽度让给图片墙
        renderBreadcrumb();
    }

    function renderBreadcrumb() {
        el.breadcrumb.innerHTML = '';

        function crumb(text, onClick, isCurrent) {
            var node;
            if (onClick) {
                node = document.createElement('button');
                node.className = 'crumb crumb-link';
                node.addEventListener('click', onClick);
            } else {
                node = document.createElement('span');
                node.className = 'crumb' + (isCurrent ? ' crumb-current' : '');
            }
            node.textContent = text;
            el.breadcrumb.appendChild(node);
        }

        function sep() {
            var s = document.createElement('span');
            s.className = 'crumb-sep';
            s.textContent = '/';
            el.breadcrumb.appendChild(s);
        }

        var parts = [];
        var multi = data.groups.length > 1;

        if (multi) {
            parts.push({
                text: '全部图库',
                onClick: view.group ? function () { navigate(null, null); } : null,
                current: !view.group
            });
        }

        if (view.group) {
            var groupName = view.group;
            parts.push({
                text: groupName,
                // 已进入某个图集时，点大类名字返回该大类的图集列表
                onClick: view.collection ? function () { navigate(groupName, null); } : null,
                current: !view.collection
            });
        }

        if (view.collection) {
            parts.push({ text: view.collection, onClick: null, current: true });
        }

        parts.forEach(function (part, i) {
            if (i > 0) { sep(); }
            crumb(part.text, part.onClick, part.current);
        });
    }

    /* ---------------- 视图 1：大类 ---------------- */

    function renderGroups() {
        el.groupsGrid.innerHTML = '';

        data.groups.forEach(function (group) {
            el.groupsGrid.appendChild(createCoverCard({
                title: group.name,
                subtitle: group.collectionCount + ' 个图集 · ' + group.imageCount + ' 张图',
                cover: group.coverThumb || group.cover,
                coverFallback: group.cover,
                alt: group.name,
                onClick: function () { navigate(group.name, null); }
            }));
        });
    }

    /* ---------------- 视图 2：图集封面 ---------------- */

    function collectionDateRange(collection) {
        var days = [];
        collectionImages(collection).forEach(function (img) {
            if (img.date) { days.push(img.date); }
        });
        if (!days.length) { return ''; }
        days.sort();
        if (days[0] === days[days.length - 1]) { return days[0]; }
        return days[0] + ' ~ ' + days[days.length - 1];
    }

    function renderCollections(group) {
        el.collectionsGrid.innerHTML = '';

        if (group.collections.length === 0) {
            return;
        }

        group.collections.forEach(function (collection) {
            var bits = [collection.imageCount + ' 张图'];
            var range = collectionDateRange(collection);
            if (range) { bits.push(range); }

            el.collectionsGrid.appendChild(createCoverCard({
                title: collection.name,
                subtitle: bits.join(' · '),
                // 封面卡是小图，优先用缩略图
                cover: collection.coverThumb || collection.cover,
                coverFallback: collection.cover,
                alt: collection.name,
                onClick: function () {
                    navigate(group.name, collection.name);
                }
            }));
        });
    }

    function createCoverCard(opts) {
        var card = document.createElement('article');
        card.className = 'cover-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', opts.title);

        var wrap = document.createElement('div');
        wrap.className = 'cover-image';

        var img = document.createElement('img');
        img.src = opts.cover;
        img.alt = opts.alt || opts.title;
        img.loading = 'lazy';
        img.decoding = 'async';

        // 注意用布尔标记而不是比较 URL：img.src 会被浏览器编码，中文路径比不出来
        var triedFallback = false;
        img.addEventListener('error', function () {
            if (!triedFallback && opts.coverFallback) {   // 缩略图缺失就退回原图
                triedFallback = true;
                img.src = opts.coverFallback;
                return;
            }
            wrap.innerHTML = '';
            var fail = document.createElement('div');
            fail.className = 'cover-fallback';
            fail.textContent = '无封面';
            wrap.appendChild(fail);
        });
        wrap.appendChild(img);

        var info = document.createElement('div');
        info.className = 'cover-info';

        var title = document.createElement('h3');
        title.className = 'cover-title';
        title.textContent = opts.title;

        var sub = document.createElement('p');
        sub.className = 'cover-subtitle';
        sub.textContent = opts.subtitle;

        info.appendChild(title);
        info.appendChild(sub);

        card.appendChild(wrap);
        card.appendChild(info);

        card.addEventListener('click', opts.onClick);
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                opts.onClick();
            }
        });

        return card;
    }

    /* =========================================================
       视图 3：图集内部 —— 一面正方形缩略图墙

       每张图都是同样大小的正方形（CSS 网格 + object-fit: cover），
       无缝拼在一起，所以不需要算位置，也不需要图片尺寸；
       完整原图点开在灯箱里看。
       ========================================================= */

    function createCard(entry, index) {
        var img = entry.img;

        var item = document.createElement('article');
        item.className = 'wall-item';
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', '查看 ' + img.title);

        var image = document.createElement('img');
        image.className = 'wall-img';
        // 墙上用小图（缩略图），点开灯箱才加载原图
        image.src = img.thumb || img.file;
        image.alt = img.title;
        image.loading = 'lazy';
        image.decoding = 'async';

        var usingThumb = !!(img.thumb && img.thumb !== img.file);
        image.addEventListener('error', function () {
            if (usingThumb) {          // 缩略图缺失就退回原图
                usingThumb = false;
                image.src = img.file;
                return;
            }
            image.style.display = 'none';
            var fail = document.createElement('span');
            fail.className = 'wall-fail';
            fail.textContent = '图片加载失败';
            item.appendChild(fail);
        });

        // 文件名：平时藏着，鼠标悬停 / 键盘聚焦才浮上来
        var caption = document.createElement('span');
        caption.className = 'wall-caption';
        caption.textContent = img.title;

        item.appendChild(image);
        item.appendChild(caption);

        function open() { openModal(index); }
        item.addEventListener('click', open);

        // 悬停 120ms 后才预取，避免鼠标扫过时白白下载一堆图
        var hoverTimer = null;
        item.addEventListener('mouseenter', function () {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(function () { prefetch(img); }, 120);
        });
        item.addEventListener('mouseleave', function () {
            clearTimeout(hoverTimer);
        });
        item.addEventListener('focus', function () { prefetch(img); });

        item.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
            }
        });

        return item;
    }

    // 没搜索时出全部图，搜索时跨整个图集筛
    function computeShownImages(collection) {
        var q = view.query.trim().toLowerCase();

        var pool = collectionImages(collection).map(function (img) {
            return { img: img };
        });

        if (!q) { return pool; }

        return pool.filter(function (entry) {
            var img = entry.img;
            var haystack = [img.title, img.description, img.file]
                .concat(img.tags || [])
                .join(' ')
                .toLowerCase();
            return haystack.indexOf(q) !== -1;
        });
    }

    function renderImages(group) {
        var collection = findCollection(group, view.collection);
        if (!collection) {
            navigate(group.name, null);
            return;
        }

        var searching = view.query.trim() !== '';

        shownImages = computeShownImages(collection);

        // 分页
        var totalPages = Math.max(1, Math.ceil(shownImages.length / PAGE_SIZE));
        if (view.page > totalPages) { view.page = totalPages; }
        var start = (view.page - 1) * PAGE_SIZE;
        var pageItems = shownImages.slice(start, start + PAGE_SIZE);

        el.gallery.innerHTML = '';
        pageItems.forEach(function (entry, i) {
            el.gallery.appendChild(createCard(entry, start + i));
        });

        // 数量文案
        el.resultCount.textContent = searching
            ? '在本图集搜到 ' + shownImages.length + ' 张（共 ' + collection.imageCount + ' 张）'
            : collection.name + ' · ' + shownImages.length + ' 张';

        // 空状态
        var isEmpty = pageItems.length === 0;
        show(el.imagesEmpty, isEmpty);
        if (isEmpty) {
            el.imagesEmptyTitle.textContent = searching ? '没有找到图片' : '这个图集还没有图片';
            el.imagesEmptyText.textContent = searching
                ? '换个关键词试试'
                : '把图片放进对应的文件夹，重跑一次生成脚本即可。';
        }

        // 分页控件
        var showPager = shownImages.length > PAGE_SIZE;
        show(el.pagination, showPager);
        if (showPager) {
            el.pageInfo.textContent = '第 ' + view.page + ' / ' + totalPages + ' 页';
            el.prevBtn.disabled = view.page <= 1;
            el.nextBtn.disabled = view.page >= totalPages;
        }
    }

    /* ---------------- 全局状态 ---------------- */

    function renderStatus(icon, title, text) {
        el.statusIcon.textContent = icon;
        el.statusTitle.textContent = title;
        el.statusText.innerHTML = text;
        show(el.statusMessage, true);
        el.breadcrumb.innerHTML = '';
    }

    /* =========================================================
       每日热力图（右侧栏）
       ========================================================= */

    function countOf(key) {
        var info = heat.days[key];
        return info && info.count ? info.count : 0;
    }

    // 「这天有记录」= 有张数，或者至少留了备注（daily.json 里只写 note 的日子）
    function hasRecord(key) {
        var info = heat.days[key];
        if (!info) { return false; }
        return (info.count || 0) > 0 || !!info.note;
    }

    // 四档，按当天新增的张数**绝对**分档（不看窗口里的最大值，
    // 所以不同月份、不同颜色深浅的含义始终一致）：
    //   0 无 —— 一张都没有
    //   1 低 —— 1 张
    //   2 中 —— 2 ~ 3 张
    //   3 高 —— 4 张及以上
    // 下面这张表同时也是图例的悬停说明，改档位规则只改这里。
    var HEAT_LEVELS = [
        { name: '无', rule: '没有新增' },
        { name: '低', rule: '新增 1 张' },
        { name: '中', rule: '新增 2 ~ 3 张' },
        { name: '高', rule: '新增 4 张及以上' }
    ];

    function levelFor(count) {
        if (!count || count <= 0) { return 0; }
        if (count === 1) { return 1; }
        if (count <= 3) { return 2; }
        return 3;
    }

    // 热力图窗口：最近 N 周的整周（周日开头、本周周六结尾）
    function buildHeatWindow(weeks) {
        var t = today();
        var lastWeekStart = startOfWeek(t);
        return {
            start: addDays(lastWeekStart, -(weeks - 1) * 7),
            end: addDays(lastWeekStart, 6),
            today: t,
            cols: weeks
        };
    }

    function computeHeatStats() {
        var total = 0;
        var active = 0;
        var maxDay = 0;
        var activeKeys = [];

        Object.keys(heat.days).forEach(function (key) {
            var c = countOf(key);
            total += c;
            if (hasRecord(key)) {
                active++;
                activeKeys.push(key);
                if (c > maxDay) { maxDay = c; }
            }
        });

        // 最长连续
        activeKeys.sort();
        var longest = 0;
        var run = 0;
        var prev = 0;
        activeKeys.forEach(function (key) {
            var d = parseDayKey(key);
            if (!d) { return; }
            var n = dayNumber(d);
            run = (prev && n - prev === 1) ? run + 1 : 1;
            if (run > longest) { longest = run; }
            prev = n;
        });

        // 当前连续：今天还没记录就从昨天开始数（今天还没过完）
        var cursor = today();
        if (!hasRecord(dayKey(cursor))) { cursor = addDays(cursor, -1); }
        var current = 0;
        while (hasRecord(dayKey(cursor))) {
            current++;
            cursor = addDays(cursor, -1);
            if (current > 4000) { break; }      // 保险丝
        }

        return {
            total: total,
            active: active,
            current: current,
            longest: longest,
            maxDay: maxDay
        };
    }

    function renderHeatMonths(win) {
        el.heatmapMonths.innerHTML = '';

        var labels = [];
        var lastMonth = -1;

        for (var i = 0; i < win.cols; i++) {
            var weekStart = addDays(win.start, i * 7);
            var m = weekStart.getMonth();
            if (m !== lastMonth) {
                labels.push({ col: i, text: (m + 1) + '月', span: 1 });
                lastMonth = m;
            }
            if (labels.length) {
                labels[labels.length - 1].span = i - labels[labels.length - 1].col + 1;
            }
        }

        labels.forEach(function (lb) {
            var span = document.createElement('span');
            span.className = 'heatmap-month';
            span.textContent = lb.text;
            span.style.gridColumn = (lb.col + 1) + ' / span ' + lb.span;
            el.heatmapMonths.appendChild(span);
        });
    }

    function renderHeatStats(stats) {
        var items = [
            { num: stats.total, label: '累计记录（张）' },
            { num: stats.active, label: '有记录的天数' },
            { num: stats.current, label: '当前连续（天）' },
            { num: stats.longest, label: '最长连续（天）' }
        ];

        el.heatmapStats.innerHTML = '';

        items.forEach(function (it) {
            var box = document.createElement('div');
            box.className = 'hm-stat';

            var num = document.createElement('span');
            num.className = 'hm-stat-num';
            num.textContent = String(it.num);

            var label = document.createElement('span');
            label.className = 'hm-stat-label';
            label.textContent = it.label;

            box.appendChild(num);
            box.appendChild(label);
            el.heatmapStats.appendChild(box);
        });
    }

    function renderHeatRecent() {
        el.heatmapRecent.innerHTML = '';

        var keys = Object.keys(heat.days).filter(function (key) {
            var info = heat.days[key] || {};
            return countOf(key) > 0 || info.note;
        }).sort().reverse().slice(0, 5);

        if (!keys.length) {
            var empty = document.createElement('p');
            empty.className = 'recent-empty';
            empty.innerHTML = '还没有任何记录。<br>把图片放进 <code>images/</code> 后' +
                '双击 <code>tools\\update-gallery.cmd</code>，<br>或者手写 <code>daily.json</code> 补录。';
            el.heatmapRecent.appendChild(empty);
            return;
        }

        var title = document.createElement('p');
        title.className = 'recent-title';
        title.textContent = '最近记录';
        el.heatmapRecent.appendChild(title);

        keys.forEach(function (key) {
            var info = heat.days[key] || {};

            var row = document.createElement('div');
            row.className = 'recent-item';

            var date = document.createElement('span');
            date.className = 'recent-date';
            date.textContent = key.slice(5);        // 只留 月-日

            var count = document.createElement('span');
            count.className = 'recent-count';
            count.textContent = countOf(key) + ' 张';

            row.appendChild(date);
            row.appendChild(count);

            if (info.note) {
                var note = document.createElement('span');
                note.className = 'recent-note';
                note.textContent = info.note;
                note.title = info.note;
                row.appendChild(note);
            }

            el.heatmapRecent.appendChild(row);
        });
    }

    function renderHeatmap() {
        if (!el.heatmapGrid || !el.heatmap) { return; }

        var win = buildHeatWindow(heat.weeks);
        el.heatmap.style.setProperty('--hm-cols', win.cols);

        var stats = computeHeatStats();

        renderHeatMonths(win);

        var todayNum = dayNumber(win.today);
        var endNum = dayNumber(win.end);

        el.heatmapGrid.innerHTML = '';

        var frag = document.createDocumentFragment();

        for (var d = win.start, n = dayNumber(d); n <= endNum; d = addDays(d, 1), n = dayNumber(d)) {
            var key = dayKey(d);
            var count = countOf(key);
            var info = heat.days[key] || {};
            var isFuture = n > todayNum;

            var cell = document.createElement('span');
            // 只有备注、没有张数的日子按「低」显示，免得看起来像没记录
            var level = count > 0 ? levelFor(count) : (info.note ? 1 : 0);
            cell.className = 'hm-cell ' + (isFuture ? 'blank lv0' : 'lv' + level);
            cell.dataset.date = key;
            cell.dataset.count = String(count);
            if (info.note) { cell.dataset.note = info.note; }

            if (isFuture) {
                cell.setAttribute('aria-hidden', 'true');
            } else {
                if (n === todayNum) { cell.classList.add('today'); }
                cell.setAttribute('aria-label', key + '：' + count + ' 张' + (info.note ? '，' + info.note : ''));
                if (count > 0 || info.note) { cell.tabIndex = 0; }
            }

            frag.appendChild(cell);
        }

        el.heatmapGrid.appendChild(frag);

        el.heatmapRange.textContent = dayKey(win.start) + ' ~ ' + dayKey(win.end) +
            (stats.maxDay > 0 ? ' · 单日最多 ' + stats.maxDay + ' 张' : '');

        renderHeatStats(stats);
        renderHeatRecent();
    }

    /* ---------------- 半透明气泡：格子 + 图例共用 ---------------- */

    function hideHeatTip() {
        if (el.hmTip) { el.hmTip.hidden = true; }
    }

    // anchor 是锚点元素；bold 是加粗的开头，rest 跟在同一个 · 后面，
    // note 另起一行（小字说明）
    function showTip(anchor, bold, rest, note) {
        if (!el.hmTip || !anchor) { return; }

        el.hmTip.innerHTML = '';

        var line = document.createElement('div');
        var head = document.createElement('b');
        head.textContent = bold;
        line.appendChild(head);
        if (rest) { line.appendChild(document.createTextNode(' · ' + rest)); }
        el.hmTip.appendChild(line);

        if (note) {
            var noteLine = document.createElement('div');
            noteLine.textContent = note;
            el.hmTip.appendChild(noteLine);
        }

        el.hmTip.hidden = false;

        // 先显示再量尺寸，才能把提示框摆在锚点正上方
        var rect = anchor.getBoundingClientRect();
        var tip = el.hmTip.getBoundingClientRect();

        var left = rect.left + rect.width / 2 - tip.width / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - tip.width - 8));

        var top = rect.top - tip.height - 8;
        if (top < 8) { top = rect.bottom + 8; }

        el.hmTip.style.left = Math.round(left) + 'px';
        el.hmTip.style.top = Math.round(top) + 'px';
    }

    function showHeatTip(cell) {
        if (!cell || !cell.dataset.date) { return; }
        showTip(
            cell,
            cell.dataset.date,
            Number(cell.dataset.count || 0) + ' 张',
            cell.dataset.note || ''
        );
    }

    // 图例：悬停哪一档，就说清那一档要多少张
    function showLegendTip(item) {
        var info = HEAT_LEVELS[Number(item.dataset.level)];
        if (!info) { return; }
        showTip(item, info.name, info.rule, '');
    }

    function isHeatCell(node) {
        return !!(node && node.classList && node.classList.contains('hm-cell') &&
            !node.classList.contains('blank'));
    }

    function legendItemOf(node) {
        if (!node || !node.closest) { return null; }
        var item = node.closest('.legend-item');
        return (item && el.heatmapLegend && el.heatmapLegend.contains(item)) ? item : null;
    }

    function initHeatmapTip() {
        if (!el.heatmapGrid) { return; }

        el.heatmapGrid.addEventListener('mouseover', function (e) {
            if (isHeatCell(e.target)) { showHeatTip(e.target); }
        });
        el.heatmapGrid.addEventListener('mouseout', hideHeatTip);

        el.heatmapGrid.addEventListener('focusin', function (e) {
            if (isHeatCell(e.target)) { showHeatTip(e.target); }
        });
        el.heatmapGrid.addEventListener('focusout', hideHeatTip);

        // 图例走同一套气泡
        if (el.heatmapLegend) {
            el.heatmapLegend.addEventListener('mouseover', function (e) {
                var item = legendItemOf(e.target);
                if (item) { showLegendTip(item); }
            });
            el.heatmapLegend.addEventListener('mouseout', hideHeatTip);

            el.heatmapLegend.addEventListener('focusin', function (e) {
                var item = legendItemOf(e.target);
                if (item) { showLegendTip(item); }
            });
            el.heatmapLegend.addEventListener('focusout', hideHeatTip);
        }

        window.addEventListener('scroll', hideHeatTip, true);
        window.addEventListener('resize', hideHeatTip);
    }

    function initHeatRange() {
        if (!el.heatmapRangeSwitch) { return; }

        el.heatmapRangeSwitch.addEventListener('click', function (e) {
            var btn = e.target && e.target.closest ? e.target.closest('.range-btn') : null;
            if (!btn) { return; }

            var weeks = Number(btn.dataset.weeks);
            if (!weeks || weeks === heat.weeks) { return; }

            heat.weeks = weeks;

            var all = el.heatmapRangeSwitch.querySelectorAll('.range-btn');
            for (var i = 0; i < all.length; i++) {
                all[i].classList.toggle('active', all[i] === btn);
            }

            hideHeatTip();
            renderHeatmap();
        });
    }

    function loadHeatmap() {
        if (!el.heatmapGrid) { return; }

        fetch(HEATMAP_URL, { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) { throw new Error('HTTP ' + res.status); }
                return res.json();
            })
            .then(function (payload) {
                heat.days = (payload && payload.days) ? payload.days : {};
                heat.available = true;
                renderHeatmap();
                // 清单可能比热力图先加载完，那时右侧栏还是藏着的
                setSideVisible(!view.collection);
            })
            .catch(function (err) {
                heat.available = false;
                console.warn('[Paintrack] 无法加载 ' + HEATMAP_URL, err);
                setSideVisible(false);
            });
    }

    /* ---------------- 深色模式 ---------------- */

    function applyDarkMode(isDark) {
        document.body.classList.toggle('dark', isDark);
        if (el.darkModeBtn) {
            el.darkModeBtn.textContent = isDark ? '☀️' : '🌙';
            el.darkModeBtn.title = isDark ? '切换浅色模式' : '切换深色模式';
        }
    }

    function initDarkMode() {
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }

        var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyDarkMode(saved === null ? prefersDark : saved === '1');

        if (el.darkModeBtn) {
            el.darkModeBtn.addEventListener('click', function () {
                var isDark = !document.body.classList.contains('dark');
                applyDarkMode(isDark);
                try { localStorage.setItem(STORAGE_KEY, isDark ? '1' : '0'); } catch (e) { /* 忽略 */ }
            });
        }
    }

    /* ---------------- 灯箱 ---------------- */

    var modalToken = 0;        // 防止快速翻图时旧的大图把新的覆盖掉
    var prefetched = {};       // 已经预取过的 URL

    function showModalLoading(visible) {
        if (el.modalLoading) {
            el.modalLoading.hidden = !visible;
        }
    }

    // 灯箱优先用 views/（1600px，约 150KB），没有再退回原图
    function fullSrcOf(img) {
        return img.view || img.file;
    }

    // 悬停 / 聚焦时先把大图拉下来，点开就基本是秒出
    function prefetch(img) {
        var url = fullSrcOf(img);
        if (!url || prefetched[url]) { return; }
        prefetched[url] = true;
        var pre = new Image();
        pre.src = url;
    }

    function loadFullImage(target, url) {
        var token = ++modalToken;
        var loader = new Image();

        loader.onload = function () {
            if (token !== modalToken) { return; }   // 已经切到别的图了
            target.src = url;
            target.classList.remove('is-preview');
            showModalLoading(false);
        };
        loader.onerror = function () {
            if (token !== modalToken) { return; }
            // 大图失败就保留缩略图，至少不是空白
            target.classList.remove('is-preview');
            showModalLoading(false);
        };
        loader.src = url;
    }

    function openModal(index) {
        var entry = shownImages[index];
        if (!entry) { return; }

        var img = entry.img;
        modalIndex = index;

        var full = fullSrcOf(img);
        var preview = img.thumb || img.file;

        el.modalImage.alt = img.title;
        el.modalTitle.textContent = img.title;

        // 先秒显缩略图（轻微模糊）+ 提示，大图下载完再无缝换上
        if (full === preview) {
            modalToken++;
            el.modalImage.classList.remove('is-preview');
            el.modalImage.src = preview;
            showModalLoading(false);
        } else {
            el.modalImage.classList.add('is-preview');
            el.modalImage.src = preview;
            showModalLoading(true);
            loadFullImage(el.modalImage, full);
        }

        var parts = [];
        if (img.description) { parts.push(img.description); }
        parts.push('图集：' + view.collection);
        if (img.date) { parts.push('日期：' + img.date); }
        if ((img.tags || []).length) { parts.push('标签：' + img.tags.join('、')); }
        el.modalDescription.textContent = parts.join(' · ');

        el.downloadBtn.href = img.file;
        el.downloadBtn.setAttribute('download', baseName(img.file));
        el.copyUrlBtn.textContent = '🔗 复制图片 URL';

        el.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modalToken++;                     // 取消还在路上的大图
        el.modal.classList.remove('show');
        document.body.style.overflow = '';
        el.modalImage.src = '';
        el.modalImage.classList.remove('is-preview');
        showModalLoading(false);
        modalIndex = -1;
    }

    function stepModal(delta) {
        if (modalIndex < 0) { return; }
        var next = modalIndex + delta;
        if (next < 0 || next >= shownImages.length) { return; }
        openModal(next);
    }

    function fallbackCopy(text, done) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            done();
        } catch (e) {
            window.prompt('复制下面的链接：', text);
        }
        document.body.removeChild(ta);
    }

    function initModal() {
        el.closeModal.addEventListener('click', closeModal);

        el.modal.addEventListener('click', function (e) {
            if (e.target === el.modal) { closeModal(); }
        });

        document.addEventListener('keydown', function (e) {
            if (!el.modal.classList.contains('show')) { return; }
            if (e.key === 'Escape') { closeModal(); }
            else if (e.key === 'ArrowLeft') { stepModal(-1); }
            else if (e.key === 'ArrowRight') { stepModal(1); }
        });

        el.copyUrlBtn.addEventListener('click', function () {
            var entry = shownImages[modalIndex];
            if (!entry) { return; }
            var url = new URL(entry.img.file, window.location.href).href;

            function done() {
                el.copyUrlBtn.textContent = '✅ 已复制';
                setTimeout(function () {
                    el.copyUrlBtn.textContent = '🔗 复制图片 URL';
                }, 1500);
            }

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url, done); });
            } else {
                fallbackCopy(url, done);
            }
        });
    }

    /* ---------------- 控件 ---------------- */

    function initControls() {
        if (el.homeLink) {
            el.homeLink.addEventListener('click', function (e) {
                e.preventDefault();
                if (data.groups.length === 1) {
                    navigate(data.groups[0].name, null);
                } else {
                    navigate(null, null);
                }
            });
        }

        if (el.searchInput) {
            el.searchInput.addEventListener('input', debounce(function (e) {
                view.query = e.target.value;
                view.page = 1;
                renderImages(findGroup(view.group));
            }, 150));
        }

        el.prevBtn.addEventListener('click', function () {
            if (view.page > 1) {
                view.page--;
                renderImages(findGroup(view.group));
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });

        el.nextBtn.addEventListener('click', function () {
            var totalPages = Math.max(1, Math.ceil(shownImages.length / PAGE_SIZE));
            if (view.page < totalPages) {
                view.page++;
                renderImages(findGroup(view.group));
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    /* ---------------- 启动 ---------------- */

    function init() {
        initDarkMode();
        initControls();
        initModal();
        initHeatmapTip();
        initHeatRange();

        window.addEventListener('hashchange', applyRoute);

        // 热力图和图片清单并行加载，谁先到都不影响
        loadHeatmap();

        fetch(MANIFEST_URL, { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) { throw new Error('HTTP ' + res.status); }
                return res.json();
            })
            .then(function (payload) {
                // 兼容空清单 [] 与 {version, groups}
                data.groups = Array.isArray(payload)
                    ? []
                    : (payload && Array.isArray(payload.groups) ? payload.groups : []);

                var total = data.groups.reduce(function (sum, g) { return sum + g.imageCount; }, 0);

                if (total === 0) {
                    renderStatus(
                        '🖼️',
                        '图库还是空的',
                        '按 <code>images/大类/图集/</code> 的层级放图片，' +
                        '然后双击 <code>tools\\update-gallery.cmd</code> 生成清单和热力图。'
                    );
                    setSideVisible(true);
                    return;
                }

                applyRoute();
            })
            .catch(function (err) {
                console.error('[Paintrack] 无法加载 ' + MANIFEST_URL, err);
                renderStatus(
                    '⚠️',
                    '图片清单加载失败',
                    '无法读取 ' + MANIFEST_URL + '（' + err.message + '）。' +
                    '如果是在本地直接双击打开 index.html，浏览器会拦截读取，' +
                    '请改用本地预览：双击 tools\\preview.cmd。'
                );
                setSideVisible(heat.available);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
