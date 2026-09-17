/* ==========================================================================
   Latest Properties — app logic
   ========================================================================== */

let allListings = [];
let filteredListings = [];
let currentPage = 1;
const listingsPerPage = 24;
let currentFilters = {};
let debounceTimer = null;

const sessionKey = 'hk_property_unlocked';
const FAV_KEY = 'fav_listings';
const LANG_KEY = 'lang';
let favOnly = false;
let lastCrawlTime = null;
let dupOthers = {};

/* --------------------------------------------------------------------------
   Internationalisation (en / zh-CN)
   -------------------------------------------------------------------------- */
const I18N = {
    en: {
        appTitle: 'Latest Properties',
        metaDesc: 'Curated property listings, refreshed minute by minute.',
        accessRequired: 'Access Required',
        loginSubtitle: 'Enter your password to continue',
        password: 'Password',
        continue: 'Continue',
        pleaseEnterPassword: 'Please enter a password.',
        incorrectPassword: 'Incorrect password.',
        justNow: 'just now',
        minsAgo: '{n}m ago',
        hoursAgo: '{n}h ago',
        sortAria: 'Sort listings',
        sortNewest: 'Newest first',
        sortPriceAsc: 'Price: low → high',
        sortPriceDesc: 'Price: high → low',
        sortSize: 'Size: largest',
        sortValue: 'Price / sqft: best value',
        filters: 'Filters',
        toggleDark: 'Toggle dark mode',
        export: 'Export',
        exportTitle: 'Export CSV',
        langAria: 'Switch language',
        search: 'Search',
        searchPh: 'Estate, address…',
        priceRange: 'Price range (HK$)',
        min: 'Min',
        max: 'Max',
        bedrooms: 'Bedrooms',
        any: 'Any',
        studio: 'Studio',
        bed4plus: '4+',
        transactionType: 'Transaction',
        buy: 'Buy',
        rent: 'Rent',
        type: 'Type',
        allTypes: 'All types',
        apartment: 'Apartment',
        house: 'House',
        villageHouse: 'Village House',
        penthouse: 'Penthouse',
        duplex: 'Duplex',
        sources: 'Sources',
        allSources: 'All sources',
        newTodayOnly: 'New today only',
        resetFilters: 'Reset filters',
        loading: 'Loading…',
        loadingListings: 'Loading listings…',
        properties: 'properties',
        ofRange: 'of',
        updatedPrefix: '· updated {x}',
        emptyNoMatches: 'No matches',
        emptyNoMatchesText: 'Try widening your filters or resetting them.',
        noListingsYet: 'No listings yet',
        noListingsText: 'The automated crawler updates this page every 2 hours.',
        noListingsToast: 'Listing data unavailable yet — crawler runs every 2 hours.',
        refreshedToast: 'Listings refreshed automatically.',
        bedsLabel: '{n} beds',
        bathsLabel: '{n} baths',
        sqftLabel: '{n} sqft',
        locUnavailable: 'Location unavailable',
        alsoOn: 'Also on {s}',
        openOriginal: 'open original listing',
        viewOriginal: 'View original',
        share: 'Share',
        saveListing: 'Save listing',
        removeSaved: 'Remove from saved',
        favSaved: 'Saved — tap the star again to remove.',
        favRemoved: 'Removed from saved.',
        onRequest: 'On request',
        perSqft: ' / sqft',
        prev: 'Prev',
        next: 'Next',
        noUrlToast: 'No original listing URL available.',
        noPhotosToast: 'No photos available for this listing.',
        imgFail: 'Image failed to load.',
        favOnlyOn: 'Showing saved listings only.',
        favOnlyOff: 'Showing all listings.',
        saved: 'Saved',
        exportNone: 'No listings to export.',
        exportedToast: '{n} listings exported.',
        bedroomCard: '{n} bedroom',
        propertyListing: 'Property listing',
        close: 'Close',
        prevImage: 'Previous image',
        nextImage: 'Next image'
    },
    zh: {
        appTitle: '最新楼盘',
        metaDesc: '精选房源，实时更新。',
        accessRequired: '需要访问权限',
        loginSubtitle: '请输入密码以继续',
        password: '密码',
        continue: '继续',
        pleaseEnterPassword: '请输入密码。',
        incorrectPassword: '密码不正确。',
        justNow: '刚刚',
        minsAgo: '{n} 分钟前',
        hoursAgo: '{n} 小时前',
        sortAria: '排序',
        sortNewest: '最新优先',
        sortPriceAsc: '价格：低 → 高',
        sortPriceDesc: '价格：高 → 低',
        sortSize: '面积：最大',
        sortValue: '单价：性价比最高',
        filters: '筛选',
        toggleDark: '切换深色模式',
        export: '导出',
        exportTitle: '导出 CSV',
        langAria: '切换语言',
        search: '搜索',
        searchPh: '屋苑、地址…',
        priceRange: '价格范围（港币）',
        min: '最低',
        max: '最高',
        bedrooms: '卧室',
        any: '不限',
        studio: '单间',
        bed4plus: '4+',
        transactionType: '交易类型',
        buy: '买入',
        rent: '租赁',
        type: '类型',
        allTypes: '所有类型',
        apartment: '公寓',
        house: '独立屋',
        villageHouse: '村屋',
        penthouse: '顶层复式',
        duplex: '复式',
        sources: '来源',
        allSources: '所有来源',
        newTodayOnly: '仅今日新增',
        resetFilters: '重置筛选',
        loading: '加载中…',
        loadingListings: '正在加载房源…',
        properties: '套房',
        ofRange: '，共',
        updatedPrefix: '· 更新于 {x}',
        emptyNoMatches: '无匹配结果',
        emptyNoMatchesText: '请放宽筛选条件或重置筛选。',
        noListingsYet: '暂无房源',
        noListingsText: '自动化爬虫每 2 小时更新此页面。',
        noListingsToast: '房源数据暂时不可用 — 爬虫每 2 小时运行一次。',
        refreshedToast: '房源已自动刷新。',
        bedsLabel: '{n} 房',
        bathsLabel: '{n} 卫',
        sqftLabel: '{n} 平方呎',
        locUnavailable: '位置未知',
        alsoOn: '同时发布于 {s}',
        openOriginal: '打开原始房源',
        viewOriginal: '查看原文',
        share: '分享',
        saveListing: '保存房源',
        removeSaved: '取消保存',
        favSaved: '已保存 — 再次点击星标可取消。',
        favRemoved: '已取消保存。',
        onRequest: '面议',
        perSqft: ' ／呎',
        prev: '上一页',
        next: '下一页',
        noUrlToast: '没有可用的原始房源链接。',
        noPhotosToast: '该房源暂无照片。',
        imgFail: '图片加载失败。',
        favOnlyOn: '仅显示已保存的房源。',
        favOnlyOff: '显示全部房源。',
        saved: '已保存',
        exportNone: '没有可导出的房源。',
        exportedToast: '已导出 {n} 套房源。',
        bedroomCard: '{n} 卧室',
        propertyListing: '房产房源',
        close: '关闭',
        prevImage: '上一张',
        nextImage: '下一张'
    }
};

let currentLang = detectLang();

function detectLang() {
    try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved === 'en' || saved === 'zh') return saved;
        const langs = (navigator.languages?.length ? navigator.languages : [navigator.language || 'en']);
        for (const lg of langs) {
            const code = String(lg).toLowerCase().replace('_', '-');
            if (code.startsWith('zh')) return 'zh';
        }
    } catch (e) {}
    return 'en';
}

function t(key, vars) {
    const s = (I18N[currentLang] && I18N[currentLang][key]) ?? I18N.en[key] ?? key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m);
}

function applyLangStatic() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('appTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t('metaDesc');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    updateLangBtn();
}

function refreshDynamicLang() {
    renderRegionChips();
    if (allListings.length > 0 || document.getElementById('resultsCount').textContent !== t('loading')) applyFilters();
}

function toggleLang() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, currentLang); } catch (e) {}
    applyLangStatic();
    refreshDynamicLang();
}

function updateLangBtn() {
    const btn = document.getElementById('langBtn');
    if (!btn) return;
    btn.textContent = currentLang === 'zh' ? 'EN' : '中文';
    btn.title = t('langAria');
    btn.setAttribute('aria-label', t('langAria'));
}

function imageProxy(url, width = 800) {
    if (!url) return url;
    try {
        const host = (url.split('/')[2] || '').toLowerCase();
        if (host === 'i1.squarefoot.com.hk' || host === 'wm-cdn.midland.com.hk') return url;
        return 'https://images.weserv.nl/?url=' + encodeURIComponent(url) + '&output=webp&w=' + width;
    } catch (e) {
        return url;
    }
}

function firstImage(listing) {
    return (listing.images || []).find(u => /^https?:\/\//i.test(u));
}

function parseUtcIso(value) {
    if (!value) return null;
    let s = String(value);
    if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) s += 'Z';
    return new Date(s);
}

document.addEventListener('DOMContentLoaded', () => {
    applyLangStatic();
    syncThemeWithSystem();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeWithSystem);
    syncThemeIcon();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    if (sessionStorage.getItem(sessionKey) === '1') {
        unlockSite();
    }
});

/* --------------------------------------------------------------------------
   Auth
   -------------------------------------------------------------------------- */
function handleLogin(event) {
    event.preventDefault();
    const input = document.getElementById('passwordInput');
    const errorEl = document.getElementById('loginError');

    if (!input.value) {
        errorEl.textContent = t('pleaseEnterPassword');
        return;
    }

    const hash = sha256(input.value);
    if (hash === SITE_CONFIG.passwordHash) {
        sessionStorage.setItem(sessionKey, '1');
        errorEl.textContent = '';
        unlockSite();
    } else {
        errorEl.textContent = t('incorrectPassword');
        input.value = '';
        input.focus();
    }
}

function unlockSite() {
    document.getElementById('loginScreen').classList.add('hidden');
    setupEventListeners();
    loadListings();
}

/* --------------------------------------------------------------------------
   Icons
   -------------------------------------------------------------------------- */
const I = {
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>',
    bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.68 3 4 3.68 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2H7"/><path d="M10 5 8 7"/><path d="M9 11h6"/><path d="M7 21v-1"/><path d="M17 21v-1"/></svg>',
    size: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3l6 6-12 12H3v-6L15 3Z"/><path d="M9 9l4 4"/><path d="m15 9 2 2"/><path d="m5 14 2 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    src: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/><path d="M3 12h18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5.5v-5h3v5H19V9.5"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="m8.5 14-2 7 5.5-3 5.5 3-2-7"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>'
};

const SOURCE_LABELS = {
    'centaline': 'Centaline',
    'midland': 'Midland'
};

const DISTRICT_LABELS = {
    'hong_kong_island': 'Hong Kong Island',
    'kowloon': 'Kowloon',
    'new_territories': 'New Territories',
    'outlying_islands': 'Outlying Islands'
};

/* --------------------------------------------------------------------------
   Favorites
   -------------------------------------------------------------------------- */
function getFavs() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; }
}

function isFav(id) {
    return getFavs().includes(id);
}

function toggleFavorite(id, btn) {
    let favs = getFavs();
    const on = favs.includes(id);
    favs = on ? favs.filter(x => x !== id) : favs.concat(id);
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
    if (btn) btn.classList.toggle('active', !on);
    syncChipActive();
    if (on && favOnly) applyFilters();
    showToast(on ? t('favRemoved') : t('favSaved'), on ? 'info' : 'success');
}

/* --------------------------------------------------------------------------
   Duplicate detection across sources
   -------------------------------------------------------------------------- */
function buildDupIndex() {
    dupOthers = {};
    const map = new Map();
    for (const l of allListings) {
        const building = (l.building_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (building.length < 3) continue;
        const key = [
            l.transaction_type, l.district, (l.sub_district || '').toLowerCase().trim(),
            l.bedrooms ?? '', Math.round(l.sqft) || 0, building
        ].join('|');
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(l);
    }
    for (const group of map.values()) {
        const srcs = [...new Set(group.map(l => l.source))];
        if (srcs.length < 2) continue;
        for (const l of group) {
            dupOthers[l.id] = srcs.filter(s => s !== l.source);
        }
    }
}

/* --------------------------------------------------------------------------
   Events (live filtering)
   -------------------------------------------------------------------------- */
function setupEventListeners() {
    const debounced = (fn, ms = 250) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fn, ms);
    };

    document.getElementById('searchInput').addEventListener('input', () => debounced(applyFilters));

    for (const id of ['typeFilter', 'bedroomFilter', 'txFilter', 'sourceFilter', 'minPrice', 'maxPrice']) {
        const el = document.getElementById(id);
        if (id.includes('Price')) {
            el.addEventListener('input', () => debounced(applyFilters));
        } else {
            el.addEventListener('change', applyFilters);
        }
    }

    const sortMenuBtn = document.getElementById('sortMenuBtn');
    if (sortMenuBtn) {
        document.addEventListener('click', (e) => {
            const wrap = document.querySelector('.sort-menu-wrap');
            if (!wrap || !wrap.contains(e.target)) hideSortMenu();
        });
        window.addEventListener('resize', () => {
            const menu = document.getElementById('sortMenu');
            if (menu && !menu.hidden) positionSortMenu();
        });
    }

    document.getElementById('newOnlyFilter').addEventListener('change', applyFilters);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSortMenu();
            closeLightbox();
            closeMobileSidebar();
        }
        if (e.key === 'ArrowLeft') lightboxStep(-1);
        if (e.key === 'ArrowRight') lightboxStep(1);
    });
}

/* --------------------------------------------------------------------------
   Data
   -------------------------------------------------------------------------- */
let autoRefreshTimer = null;
let lastDataSig = '';
let currentSort = 'date_crawled';

async function loadListings() {
    try {
        const data = JSON.parse(await fetchListingsText());
        allListings = (data.listings || []).filter(isDiscoveryBay);

        lastDataSig = dataSig(data);
        lastCrawlTime = data.last_crawl ? new Date(parseUtcIso(data.last_crawl)) : null;
        buildDupIndex();
        renderRegionChips();
        applyFilters();
        startAutoRefresh();
    } catch (error) {
        console.error('Error loading listings:', error);
        showToast(t('noListingsToast'), 'error');
        document.getElementById('listingsGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${I.home}</div>
                <div class="empty-state-title">${t('noListingsYet')}</div>
                <div class="empty-state-text">${t('noListingsText')}</div>
            </div>
        `;
    }
}

async function fetchListingsText() {
    const res = await fetch('listings.json');
    if (!res.ok) throw new Error('No data file');
    return await res.text();
}

function dataSig(data) {
    const total = data.total ?? (data.stats && data.stats.total);
    return `${total}|${data.last_crawl || ''}`;
}

function startAutoRefresh() {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        try {
            const response = await fetch(`stats.json?t=${Date.now()}`);
            if (!response.ok) return;
            const meta = await response.json();
            if (dataSig(meta) === lastDataSig) return;
            const data = JSON.parse(await fetchListingsText());
            const sig = dataSig(data);
            if (sig === lastDataSig) return;
            lastDataSig = sig;
            allListings = (data.listings || []).filter(isDiscoveryBay);
            lastCrawlTime = data.last_crawl ? new Date(parseUtcIso(data.last_crawl)) : null;
            buildDupIndex();
            renderRegionChips();
            applyFilters();
            showToast(t('refreshedToast'), 'info');
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, 3 * 60 * 1000);
}

function isDiscoveryBay(listing) {
    return (listing.sub_district || '').trim().toLowerCase() === 'discovery bay';
}

function renderRegionChips() {
    const box = document.getElementById('regionChips');
    if (!box) return;
    box.innerHTML =
        `<button class="chip chip-toggle" id="chipFav" onclick="toggleFavOnly()">${t('saved')}<span class="chip-count" id="chipFavCount"></span></button>`;
    syncChipActive();
}

function syncChipActive() {
    const chipFav = document.getElementById('chipFav');
    if (chipFav) chipFav.classList.toggle('active', favOnly);
    const favCount = document.getElementById('chipFavCount');
    if (favCount) favCount.textContent = countFavs();
}

function countFavs() {
    const favs = getFavs();
    if (favs.length === 0) return 0;
    const ids = new Set(allListings.map(l => l.id));
    return favs.filter(id => ids.has(id)).length;
}

function toggleFavOnly() {
    favOnly = !favOnly;
    applyFilters();
    showToast(favOnly ? t('favOnlyOn') : t('favOnlyOff'), 'info');
}

/* --------------------------------------------------------------------------
   Filtering / sorting
   -------------------------------------------------------------------------- */
function currentTx() {
    return document.getElementById('txFilter').value || '';
}

function selectedSources() {
    const v = document.getElementById('sourceFilter').value;
    return v ? [v] : Object.keys(SOURCE_LABELS);
}

function applyFilters() {
    currentFilters = {
        search: document.getElementById('searchInput').value.trim().toLowerCase(),
        sources: selectedSources(),
        minPrice: parseFloat(document.getElementById('minPrice').value) || null,
        maxPrice: parseFloat(document.getElementById('maxPrice').value) || null,
        tx: currentTx(),
        bedrooms: document.getElementById('bedroomFilter').value,
        propertyType: document.getElementById('typeFilter').value,
        sortBy: currentSort,
        newOnly: document.getElementById('newOnlyFilter').checked,
        favOnly: favOnly
    };

    filteredListings = allListings.filter(listing => {
        if (!currentFilters.sources.includes(listing.source)) return false;
        if (currentFilters.favOnly && !isFav(listing.id)) return false;
        if (currentFilters.tx && listing.transaction_type !== currentFilters.tx) return false;
        if (currentFilters.minPrice && listing.price && listing.price < currentFilters.minPrice) return false;
        if (currentFilters.maxPrice && listing.price && listing.price > currentFilters.maxPrice) return false;

        if (currentFilters.bedrooms !== '') {
            const bed = parseInt(currentFilters.bedrooms, 10);
            if (bed === 4) {
                if (!listing.bedrooms || listing.bedrooms < 4) return false;
            } else if (listing.bedrooms !== bed) {
                return false;
            }
        }

        if (currentFilters.propertyType && listing.property_type !== currentFilters.propertyType) return false;
        if (currentFilters.newOnly && !listing.is_new) return false;

        if (currentFilters.search) {
            const haystack = [
                listing.title,
                listing.address,
                listing.building_name,
                listing.sub_district,
                listing.district,
                listing.description
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(currentFilters.search)) return false;
        }

        return true;
    });

    sortListings();
    currentPage = 1;
    renderListings();
    updateFilterBadges();
}

function sortListings() {
    filteredListings.sort((a, b) => {
        switch (currentFilters.sortBy) {
            case 'price_asc': return (a.price ?? Infinity) - (b.price ?? Infinity);
            case 'price_desc': return (b.price ?? 0) - (a.price ?? 0);
            case 'sqft_desc': return (b.sqft ?? 0) - (a.sqft ?? 0);
            case 'price_per_sqft_asc': return (a.price_per_sqft ?? Infinity) - (b.price_per_sqft ?? Infinity);
            default: return (b.date_crawled || '').localeCompare(a.date_crawled || '');
        }
    });
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('typeFilter').value = '';
    currentSort = 'date_crawled';
    refreshSortMenu();
    document.getElementById('newOnlyFilter').checked = false;
    favOnly = false;
    document.getElementById('sourceFilter').value = '';
    document.getElementById('bedroomFilter').value = '';
    document.getElementById('txFilter').value = '';
    applyFilters();
    syncChipActive();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('hidden');
}

function toggleSidebarMobile(btn) {
    const isOpen = document.getElementById('sidebar').classList.toggle('mobile-open');
    btn.classList.toggle('active', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        const btn = document.getElementById('filtersNavBtn');
        btn.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
    }
}

function updateFilterBadges() {
    const badge = document.getElementById('filterBadge');
    if (!badge) return;
    const s = currentFilters;
    let count = 0;
    if (s.search) count++;
    if (s.minPrice || s.maxPrice) count++;
    if (s.tx) count++;
    if (s.bedrooms !== '') count++;
    if (s.propertyType) count++;
    if (s.sources.length < Object.keys(SOURCE_LABELS).length) count++;
    if (s.newOnly) count++;
    badge.textContent = count || '';
    badge.hidden = count === 0;
}

/* --------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */
function renderListings() {
    const grid = document.getElementById('listingsGrid');
    const start = (currentPage - 1) * listingsPerPage;
    const end = start + listingsPerPage;
    const pageListings = filteredListings.slice(start, end);

    const countEl = document.getElementById('resultsCount');
    const updated = lastCrawlTime ? agoText(lastCrawlTime) : '';
    const updatedHtml = updated ? `<span class="toolbar-updated">${t('updatedPrefix', { x: updated })}</span>` : '';
    if (filteredListings.length === 0) {
        countEl.innerHTML = `<strong>0</strong> ${t('properties')} ${updatedHtml}`;
    } else if (currentPage === 1 && end >= filteredListings.length) {
        countEl.innerHTML = `<strong>${filteredListings.length.toLocaleString()}</strong> ${t('properties')} ${updatedHtml}`;
    } else {
        countEl.innerHTML = `<strong>${start + 1}–${end}</strong> ${t('ofRange')} <strong>${filteredListings.length.toLocaleString()}</strong> ${t('properties')} ${updatedHtml}`;
    }

    if (pageListings.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${I.search}</div>
                <div class="empty-state-title">${t('emptyNoMatches')}</div>
                <div class="empty-state-text">${t('emptyNoMatchesText')}</div>
            </div>
        `;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    grid.innerHTML = pageListings.map((listing, i) =>
        createListingCard(listing, i)).join('');

    renderPagination();
}

function createListingCard(listing, index) {
    const img0 = firstImage(listing);
    const fp = index === 0 ? 'high' : 'low';
    const media = img0
        ? `<img src="${imageProxy(img0)}" alt="" loading="lazy" fetchpriority="${fp}" referrerpolicy="no-referrer"
               onload="this.classList.add('loaded')"
               onclick="event.stopPropagation();event.preventDefault();openLightbox('${listing.id}')"
               onerror="this.outerHTML='${htmlAttr(placeholderMediaMarkup)}'">`
        : placeholderMediaMarkup;

    const badges = [];
    if (listing.price_changed) {
        const up = listing.previous_price && listing.price > listing.previous_price;
        badges.push(`<span class="badge ${up ? 'badge-up' : 'badge-down'}">
            ${up ? '▲' : '▼'}&nbsp;${up ? 'Price up' : 'Price down'}</span>`);
    }
    const badgesHtml = badges.length
        ? `<div class="badge-row">${badges.join('')}</div>`
        : '';

    const priceHtml = listing.price ? priceOverlayHtml(listing) : `
        <div class="price-overlay"><span class="price" style="font-size:1.05rem">${t('onRequest')}</span></div>`;

    const isSaved = isFav(listing.id);
    const mediaActions = `
        <div class="media-actions">
            <button class="media-btn fav-star ${isSaved ? 'active' : ''}"
                    onclick="event.stopPropagation();event.preventDefault();toggleFavorite('${listing.id}', this)"
                    aria-label="${isSaved ? t('removeSaved') : t('saveListing')}" title="${isSaved ? t('removeSaved') : t('saveListing')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.5-1.4 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3.4 1-4.5 2.5C11 4 9.4 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.1 3 5.5l7 7Z"/></svg>
            </button>
        </div>`;

    const facts = [];
    if (listing.bedrooms !== null && listing.bedrooms !== undefined) {
        facts.push(`<span class="fact">${I.bed}${listing.bedrooms === 0 ? t('studio') : t('bedsLabel', { n: listing.bedrooms })}</span>`);
    }
    if (listing.bathrooms) {
        facts.push(`<span class="fact">${I.bath}${t('bathsLabel', { n: listing.bathrooms })}</span>`);
    }
    if (listing.sqft) {
        facts.push(`<span class="fact">${I.size}${t('sqftLabel', { n: listing.sqft.toLocaleString() })}</span>`);
    }

    const locParts = [listing.sub_district, DISTRICT_LABELS[listing.district]]
        .filter(Boolean);
    const loc = locParts.length
        ? `<div class="card-loc">${I.pin}${locParts.join(' · ')}</div>`
        : `<div class="card-loc" style="opacity:0.35">${t('locUnavailable')}</div>`;

    const others = dupOthers[listing.id] || [];
    const alsoOn = others.length
        ? `<span class="also-on">${t('alsoOn', { s: others.slice(0, 3).map(s => `<b>${escapeHtml(SOURCE_LABELS[s] || s)}</b>`).join(', ') })}${others.length > 3 ? ` +${others.length - 3}` : ''}</span>`
        : '';

    const title = resolveTitle(listing);

    return `
        <div class="card ${listing.price_changed ? 'price-changed' : ''}"
             tabindex="0"
             role="link"
             aria-label="${escapeHtml(title)} — ${t('openOriginal')}"
             onclick="openSource('${listing.id}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSource('${listing.id}')}"
             style="animation-delay:${Math.min(index, 6) * 55}ms">
            <div class="card-media">${media}${mediaActions}${badgesHtml}${priceHtml}</div>
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(title)}</h3>
                ${loc}
                <div class="card-facts">${facts.join('')}</div>
                ${alsoOn ? `<div class="also-row">${alsoOn}</div>` : ''}
                <div class="card-foot">
                    <span class="src">${I.src}${SOURCE_LABELS[listing.source] || listing.source}</span>
                    <span class="foot-right">
                        <button class="icon-btn share-btn" title="${t('share')}" aria-label="${t('share')}"
                                onclick="event.stopPropagation();event.preventDefault();shareListing('${listing.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
                        </button>
                        <span class="view-link">${t('viewOriginal')}${I.arrow}</span>
                    </span>
                </div>
            </div>
        </div>`;
}

function agoText(date) {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return t('minsAgo', { n: mins });
    if (mins < 1440) return t('hoursAgo', { n: Math.floor(mins / 60) });
    return date.toLocaleDateString();
}

const placeholderMediaMarkup = `<div class="card-media-placeholder">${I.home}</div>`;

function resolveTitle(listing) {
    const region = (listing.sub_district || '').toLowerCase();
    for (const c of [listing.building_name, listing.title]) {
        if (c && c.toLowerCase() !== region) return c;
    }
    const bits = [];
    if (listing.bedrooms !== null && listing.bedrooms !== undefined)
        bits.push(listing.bedrooms === 0 ? t('studio') : t('bedroomCard', { n: listing.bedrooms }));
    if (listing.sqft) bits.push(`${listing.sqft.toLocaleString()} sqft`);
    return bits.join(' · ') || listing.sub_district || t('propertyListing');
}

function priceOverlayHtml(listing) {
    const [value, unit] = compactPriceParts(listing.price);
    const perSqft = listing.price_per_sqft
        ? `${listing.price_per_sqft.toLocaleString()}${t('perSqft')}`
        : '';
    return `
        <div class="price-overlay">
            <span class="price"><small>HK$</small>${value}${unit ? `<small>${unit}</small>` : ''}</span>
            ${perSqft ? `<div class="per-sqft">${perSqft}</div>` : ''}
        </div>`;
}

function compactPriceParts(price) {
    if (price >= 1e9) return [(price / 1e9).toFixed(2).replace(/\.00$/, ''), 'B'];
    if (price >= 1e6) return [(price / 1e6).toFixed(2).replace(/\.00$/, ''), 'M'];
    if (price >= 1e3) return [(price / 1e3).toFixed(0), 'K'];
    return [price.toFixed(0), ''];
}

function fullPrice(price) {
    return 'HK$' + Math.round(price).toLocaleString();
}

/* --------------------------------------------------------------------------
   Pagination
   -------------------------------------------------------------------------- */
function renderPagination() {
    const totalPages = Math.ceil(filteredListings.length / listingsPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    const btn = (label, page, extra = '') =>
        `<button class="page-btn ${extra}" onclick="goToPage(${page})" ${page === currentPage ? 'disabled' : ''}>${label}</button>`;

    let html = '';
    html += ` <button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>${t('prev')}
             </button>`;

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        html += btn(1, 1);
        if (startPage > 2) html += '<span class="page-ellipsis">…</span>';
    }
    for (let i = startPage; i <= endPage; i++) {
        html += btn(i, i, i === currentPage ? 'active' : '');
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += '<span class="page-ellipsis">…</span>';
        html += btn(totalPages, totalPages);
    }

    html += ` <button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                 ${t('next')}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
             </button>`;

    pagination.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredListings.length / listingsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderListings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* --------------------------------------------------------------------------
   Open original listing
   -------------------------------------------------------------------------- */
function openSource(listingId) {
    const listing = allListings.find(l => l.id === listingId);
    if (!listing || !listing.source_url) {
        showToast(t('noUrlToast'), 'error');
        return;
    }
    window.open(listing.source_url, '_blank', 'noopener,noreferrer');
}

/* --------------------------------------------------------------------------
   Sort menu
   -------------------------------------------------------------------------- */
function toggleSortMenu() {
    const menu = document.getElementById('sortMenu');
    const btn = document.getElementById('sortMenuBtn');
    if (menu.hidden) {
        refreshSortMenu();
        menu.hidden = false;
        positionSortMenu();
        btn.setAttribute('aria-expanded', 'true');
    } else {
        hideSortMenu();
    }
}

function positionSortMenu() {
    const menu = document.getElementById('sortMenu');
    menu.style.left = '';
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    if (rect.right > vw) {
        menu.style.left = `${Math.min(0, vw - rect.right)}px`;
    } else if (rect.left < 0) {
        menu.style.left = `${-rect.left}px`;
    }
}

function hideSortMenu() {
    const menu = document.getElementById('sortMenu');
    if (!menu) return;
    menu.hidden = true;
    document.getElementById('sortMenuBtn').setAttribute('aria-expanded', 'false');
}

function refreshSortMenu() {
    document.querySelectorAll('#sortMenu .sort-menu-item').forEach(b => {
        b.classList.toggle('active', b.dataset.sort === currentSort);
    });
}

function setSort(value) {
    currentSort = value;
    refreshSortMenu();
    hideSortMenu();
    applyFilters();
}

/* --------------------------------------------------------------------------
   Lightbox
   -------------------------------------------------------------------------- */
let lightboxItems = [];
let lightboxIndex = 0;

function openLightbox(listingId) {
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) return;
    lightboxItems = (listing.images || []).filter(u => /^https?:\/\//i.test(u));
    if (lightboxItems.length === 0) {
        showToast(t('noPhotosToast'), 'error');
        return;
    }
    lightboxIndex = 0;
    lightboxItems.sort((a, b) => (a.split('/')[2] === 'i1.squarefoot.com.hk' ? 1 : 0) - (b.split('/')[2] === 'i1.squarefoot.com.hk' ? 1 : 0));
    showLightboxImage();
    document.getElementById('lightbox').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function showLightboxImage() {
    const img = document.getElementById('lightboxImg');
    const caption = document.getElementById('lightboxCaption');
    img.onerror = () => { caption.textContent = t('imgFail'); };
    img.src = imageProxy(lightboxItems[lightboxIndex], 1400);
    caption.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
    document.getElementById('lightboxPrev').hidden = lightboxItems.length < 2;
    document.getElementById('lightboxNext').hidden = lightboxItems.length < 2;
}

function lightboxStep(delta) {
    const lb = document.getElementById('lightbox');
    if (!lb.classList.contains('open') || lightboxItems.length < 2) return;
    lightboxIndex = (lightboxIndex + delta + lightboxItems.length) % lightboxItems.length;
    showLightboxImage();
}

function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (!lb.classList.contains('open')) return;
    lb.classList.remove('open');
    document.body.style.overflow = '';
}

/* --------------------------------------------------------------------------
   Share
   -------------------------------------------------------------------------- */
function shareListing(listingId) {
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) return;
    const text = `${resolveTitle(listing)} — ${listing.price ? fullPrice(listing.price) : t('onRequest')} · ${SOURCE_LABELS[listing.source] || listing.source}`;
    if (navigator.share) {
        navigator.share({ title: text, url: listing.source_url }).catch(() => {});
    } else {
        window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + listing.source_url), '_blank', 'noopener,noreferrer');
    }
}

/* --------------------------------------------------------------------------
   Theme
   -------------------------------------------------------------------------- */
function toggleTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', dark ? '' : 'dark');
    localStorage.setItem('theme', dark ? '' : 'dark');
    syncThemeIcon();
}

function syncThemeWithSystem() {
    if (localStorage.getItem('theme')) return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    syncThemeIcon();
}

function syncThemeIcon() {
    const icon = document.getElementById('themeIcon');
    if (!icon) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    icon.innerHTML = dark
        ? '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>'
        : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/>';
}

/* --------------------------------------------------------------------------
   Export
   -------------------------------------------------------------------------- */
function exportCSV() {
    if (filteredListings.length === 0) {
        showToast(t('exportNone'), 'error');
        return;
    }

    const headers = ['Title', 'Price (HKD)', 'District', 'Bedrooms', 'Bathrooms', 'Size (sqft)', 'Price/sqft', 'Type', 'Source', 'URL', 'Agency'];
    const rows = filteredListings.map(l => [
        `"${(l.title || '').replace(/"/g, '""')}"`,
        l.price || '',
        l.district || '',
        l.bedrooms ?? '',
        l.bathrooms ?? '',
        l.sqft ?? '',
        l.price_per_sqft ?? '',
        l.property_type || '',
        l.source || '',
        l.source_url || '',
        `"${(l.agent_company || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const d = new Date();
    link.download = `properties-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.csv`;
    link.click();
    showToast(t('exportedToast', { n: filteredListings.length.toLocaleString() }), 'success');
}

/* --------------------------------------------------------------------------
   Toast / utils
   -------------------------------------------------------------------------- */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = message;
    toast.className = `toast ${type}`;
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function htmlAttr(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* --------------------------------------------------------------------------
   SHA-256 (pure JS, used for the login gate)
   -------------------------------------------------------------------------- */
function sha256(str) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }

    const utf8 = unescape(encodeURIComponent(str));
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
    const originalLength = bytes.length;

    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    let hi = Math.floor(originalLength / 0x20000000);
    let lo = (originalLength << 3) >>> 0;
    for (let i = 0; i < 4; i++) bytes.push((hi >>> (24 - i * 8)) & 0xff);
    for (let i = 0; i < 4; i++) bytes.push((lo >>> (24 - i * 8)) & 0xff);

    const h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
          h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const w = new Array(64);
    const blocks = [];
    for (let i = 0; i < bytes.length / 64; i++) blocks.push(bytes.slice(i * 64, i * 64 + 64));

    let A = h0, B = h1, C = h2, D = h3, E = h4, F = h5, G = h6, H = h7;
    let a, b, c, d, e, f, g, h;

    for (const block of blocks) {
        for (let i = 0; i < 64; i++) {
            if (i < 16) {
                w[i] = ((block[i * 4] << 24) | (block[i * 4 + 1] << 16) | (block[i * 4 + 2] << 8) | block[i * 4 + 3]) >>> 0;
            } else {
                const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
            }
        }

        a = A; b = B; c = C; d = D; e = E; f = F; g = G; h = H;

        for (let i = 0; i < 64; i++) {
            const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const ch = (e & f) ^ ((~e) & g);
            const temp1 = (h + S1 + ch + k[i] + w[i]) >>> 0;
            const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) >>> 0;

            h = g; g = f; f = e;
            e = (d + temp1) >>> 0;
            d = c; c = b; b = a;
            a = (temp1 + temp2) >>> 0;
        }

        A = (A + a) >>> 0; B = (B + b) >>> 0; C = (C + c) >>> 0; D = (D + d) >>> 0;
        E = (E + e) >>> 0; F = (F + f) >>> 0; G = (G + g) >>> 0; H = (H + h) >>> 0;
    }

    return [A, B, C, D, E, F, G, H].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}