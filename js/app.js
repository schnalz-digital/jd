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
const FAV_REGION_KEY = 'fav_region';

function parseUtcIso(value) {
    if (!value) return null;
    let s = String(value);
    if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) s += 'Z';
    return new Date(s);
}

function imageProxy(url) {
    if (!url) return url;
    try {
        return 'https://images.weserv.nl/?url=' + encodeURIComponent(url) + '&output=webp&w=800';
    } catch (e) {
        return url;
    }
}

document.addEventListener('DOMContentLoaded', () => {
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
        errorEl.textContent = 'Please enter a password.';
        return;
    }

    const hash = sha256(input.value);
    if (hash === SITE_CONFIG.passwordHash) {
        sessionStorage.setItem(sessionKey, '1');
        errorEl.textContent = '';
        unlockSite();
    } else {
        errorEl.textContent = 'Incorrect password.';
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
    '28hse': '28Hse',
    'spacious': 'Spacious',
    'squarefoot': 'Squarefoot',
    'propertyhk': 'Property.hk',
    'okay': 'OKAY.com',
    'centaline': 'Centaline'
};

const DISTRICT_LABELS = {
    'hong_kong_island': 'Hong Kong Island',
    'kowloon': 'Kowloon',
    'new_territories': 'New Territories',
    'outlying_islands': 'Outlying Islands'
};

/* --------------------------------------------------------------------------
   Events (live filtering)
   -------------------------------------------------------------------------- */
function setupEventListeners() {
    const debounced = (fn, ms = 250) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fn, ms);
    };

    document.getElementById('searchInput').addEventListener('input', () => debounced(applyFilters));

    for (const id of ['districtFilter', 'regionFilter', 'typeFilter', 'sortFilter', 'minPrice', 'maxPrice']) {
        const el = document.getElementById(id);
        if (id.includes('Price')) {
            el.addEventListener('input', () => debounced(applyFilters));
        } else {
            el.addEventListener('change', applyFilters);
        }
    }

    document.getElementById('newOnlyFilter').addEventListener('change', applyFilters);
    document.getElementById('sourceFilters').addEventListener('change', applyFilters);

    document.querySelectorAll('#bedroomFilter .pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#bedroomFilter .pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilters();
        });
    });

    document.getElementById('propertyModal').addEventListener('click', (e) => {
        if (e.target.id === 'propertyModal') closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeMobileSidebar();
        }
    });
}

/* --------------------------------------------------------------------------
   Data
   -------------------------------------------------------------------------- */
let autoRefreshTimer = null;
let lastDataSig = '';

async function loadListings() {
    try {
        const response = await fetch(`listings.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('No data file');

        const data = await response.json();
        allListings = data.listings || [];

        lastDataSig = dataSig(data);
        updateStatsHeader(data);
        populateRegions();
        applyFilters();
        startAutoRefresh();
    } catch (error) {
        console.error('Error loading listings:', error);
        showToast('Listing data unavailable yet — crawler runs every 2 hours.', 'error');
        document.getElementById('listingsGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${I.home}</div>
                <div class="empty-state-title">No listings yet</div>
                <div class="empty-state-text">The automated crawler updates this page every 2 hours.</div>
            </div>
        `;
    }
}

function dataSig(data) {
    return `${data.stats && data.stats.total}|${data.last_crawl || ''}`;
}

function startAutoRefresh() {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(async () => {
        try {
            const response = await fetch(`listings.json?t=${Date.now()}`);
            if (!response.ok) return;
            const data = await response.json();
            const sig = dataSig(data);
            if (sig === lastDataSig) return;
            lastDataSig = sig;
            allListings = data.listings || [];
            updateStatsHeader(data);
            applyFilters();
            showToast('Listings refreshed automatically.', 'info');
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, 3 * 60 * 1000);
}

function updateStatsHeader(data) {
    const totalEl = document.getElementById('totalListings');
    if (totalEl) totalEl.textContent = allListings.length.toLocaleString();

    const crawlEl = document.getElementById('lastCrawl');
    if (crawlEl) {
        if (data.last_crawl) {
            const d = parseUtcIso(data.last_crawl);
            const mins = Math.floor((Date.now() - d.getTime()) / 60000);
            if (mins < 1) crawlEl.textContent = 'just now';
            else if (mins < 60) crawlEl.textContent = `${mins}m ago`;
            else if (mins < 1440) crawlEl.textContent = `${Math.floor(mins / 60)}h ago`;
            else crawlEl.textContent = d.toLocaleDateString();
        } else {
            crawlEl.textContent = 'pending';
        }
    }
}

const DEFAULT_REGION = 'discovery bay';

function populateRegions() {
    const select = document.getElementById('regionFilter');
    const current = select.value;
    const regions = [...new Set(allListings.map(l => (l.sub_district || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    select.innerHTML = '<option value="">All regions</option>' +
        regions.map(r => `<option value="${escapeHtml(r).toLowerCase()}">${escapeHtml(r)}</option>`).join('');

    const savedFav = localStorage.getItem(FAV_REGION_KEY);
    let fav = '';
    if (savedFav && regions.some(r => r.toLowerCase() === savedFav.toLowerCase())) {
        fav = savedFav.toLowerCase();
    } else {
        if (savedFav) localStorage.removeItem(FAV_REGION_KEY);
        if (regions.some(r => r.toLowerCase() === DEFAULT_REGION)) fav = DEFAULT_REGION;
    }

    const favBtn = document.getElementById('favBtn');
    if (fav) {
        select.value = fav;
        favBtn.classList.add('active');
        favBtn.setAttribute('aria-pressed', 'true');
        const label = regions.find(r => r.toLowerCase() === fav) || '';
        favBtn.title = savedFav
            ? `Default: ${label} — tap to clear`
            : `Default region for everyone: ${label}`;
    } else {
        if (regions.some(r => r.toLowerCase() === current)) select.value = current;
        favBtn.classList.remove('active');
        favBtn.setAttribute('aria-pressed', 'false');
        favBtn.title = 'Save selected region as default';
    }
}

function toggleFavouriteRegion() {
    const select = document.getElementById('regionFilter');
    const favBtn = document.getElementById('favBtn');
    const savedFav = localStorage.getItem(FAV_REGION_KEY);

    if (savedFav) {
        localStorage.removeItem(FAV_REGION_KEY);
        const hasDefault = Array.from(select.options).some(o => o.value === DEFAULT_REGION);
        if (hasDefault) select.value = DEFAULT_REGION;
        favBtn.classList.add('active');
        favBtn.setAttribute('aria-pressed', 'true');
        favBtn.title = `Default region for everyone: Discovery Bay`;
        applyFilters();
        showToast('Discovery Bay is the default region again.', 'info');
        return;
    }

    const region = select.value;
    if (!region) {
        showToast('Pick a region to set as your default.', 'info');
        return;
    }

    localStorage.setItem(FAV_REGION_KEY, region);
    favBtn.classList.add('active');
    favBtn.setAttribute('aria-pressed', 'true');
    const label = Array.from(select.options).find(o => o.value === region)?.textContent || region;
    favBtn.title = `Default: ${label} — tap to clear`;
    showToast(`"${label}" set as your default region.`, 'success');
    applyFilters();
}

/* --------------------------------------------------------------------------
   Filtering / sorting
   -------------------------------------------------------------------------- */
function applyFilters() {
    currentFilters = {
        search: document.getElementById('searchInput').value.trim().toLowerCase(),
        sources: Array.from(document.querySelectorAll('#sourceFilters input:checked')).map(cb => cb.value),
        district: document.getElementById('districtFilter').value,
        region: document.getElementById('regionFilter').value,
        minPrice: (parseFloat(document.getElementById('minPrice').value) || null) * 1000000,
        maxPrice: (parseFloat(document.getElementById('maxPrice').value) || null) * 1000000,
        bedrooms: document.querySelector('#bedroomFilter .pill.active')?.dataset.value || '',
        propertyType: document.getElementById('typeFilter').value,
        sortBy: document.getElementById('sortFilter').value,
        newOnly: document.getElementById('newOnlyFilter').checked
    };

    filteredListings = allListings.filter(listing => {
        if (!currentFilters.sources.includes(listing.source)) return false;
        if (currentFilters.district && listing.district !== currentFilters.district) return false;
        if (currentFilters.region && (listing.sub_district || '').trim().toLowerCase() !== currentFilters.region) return false;
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
    document.getElementById('districtFilter').value = '';
    document.getElementById('regionFilter').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('sortFilter').value = 'date_crawled';
    document.getElementById('newOnlyFilter').checked = false;
    document.querySelectorAll('#sourceFilters input').forEach(cb => cb.checked = true);
    document.querySelectorAll('#bedroomFilter .pill').forEach(b => b.classList.toggle('active', b.dataset.value === ''));
    applyFilters();
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
    if (s.district) count++;
    if (s.region) count++;
    if (s.minPrice || s.maxPrice) count++;
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
    if (filteredListings.length === 0) {
        countEl.innerHTML = '<strong>0</strong> properties';
    } else if (currentPage === 1 && end >= filteredListings.length) {
        countEl.innerHTML = `<strong>${filteredListings.length.toLocaleString()}</strong> properties`;
    } else {
        countEl.innerHTML = `<strong>${start + 1}–${end}</strong> of <strong>${filteredListings.length.toLocaleString()}</strong> properties`;
    }

    if (pageListings.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">${I.search}</div>
                <div class="empty-state-title">No matches</div>
                <div class="empty-state-text">Try widening your filters or resetting them.</div>
            </div>
        `;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    grid.innerHTML = pageListings.map((listing, i) =>
        createListingCard(listing, Math.min(i, 8))).join('');

    renderPagination();
}

function createListingCard(listing, stagger) {
    const media = listing.images && listing.images.length > 0
        ? `<img src="${imageProxy(listing.images[0])}" alt="" loading="lazy"
               onerror="this.outerHTML='${htmlAttr(placeholderMediaMarkup)}'">`
        : placeholderMediaMarkup;

    const badges = [];
    if (listing.is_new) badges.push('<span class="badge badge-new">New</span>');
    if (listing.price_changed) {
        const up = listing.previous_price && listing.price > listing.previous_price;
        badges.push(`<span class="badge ${up ? 'badge-up' : 'badge-down'}">
            ${up ? '▲' : '▼'}&nbsp;${up ? 'Price up' : 'Price down'}</span>`);
    }
    const badgesHtml = badges.length
        ? `<div class="badge-row">${badges.join('')}</div>`
        : '';

    const priceHtml = listing.price ? priceOverlayHtml(listing) : `
        <div class="price-overlay"><span class="price" style="font-size:1.05rem">On request</span></div>`;

    const facts = [];
    if (listing.bedrooms !== null && listing.bedrooms !== undefined) {
        facts.push(`<span class="fact">${I.bed}${listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} beds`}</span>`);
    }
    if (listing.bathrooms) {
        facts.push(`<span class="fact">${I.bath}${listing.bathrooms} baths</span>`);
    }
    if (listing.sqft) {
        facts.push(`<span class="fact">${I.size}${listing.sqft.toLocaleString()} sqft</span>`);
    }

    const locParts = [listing.sub_district, DISTRICT_LABELS[listing.district]]
        .filter(Boolean);
    const loc = locParts.length
        ? `<div class="card-loc">${I.pin}${locParts.join(' · ')}</div>`
        : '<div class="card-loc" style="opacity:0.35">Location unavailable</div>';

    const title = resolveTitle(listing);

    const posted = listing.date_posted
        ? listing.date_posted
        : (listing.date_crawled ? new Date(listing.date_crawled).toLocaleDateString() : '');

    return `
        <div class="card ${listing.is_new ? 'is-new' : ''} ${listing.price_changed ? 'price-changed' : ''}"
             tabindex="0"
             role="button"
             aria-label="${escapeHtml(title)}"
             onclick="openModal('${listing.id}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openModal('${listing.id}')}"
             style="animation-delay:${stagger * 55}ms">
            <div class="card-media">${media}${badgesHtml}${priceHtml}</div>
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(title)}</h3>
                ${loc}
                <div class="card-facts">${facts.join('')}</div>
                <div class="card-foot">
                    <span class="src">${I.src}${SOURCE_LABELS[listing.source] || listing.source}</span>
                    <span class="view-link">Details${I.arrow}</span>
                </div>
            </div>
        </div>`;
}

const placeholderMediaMarkup = `<div class="card-media-placeholder">${I.home}</div>`;

function resolveTitle(listing) {
    const region = (listing.sub_district || '').toLowerCase();
    for (const c of [listing.building_name, listing.title]) {
        if (c && c.toLowerCase() !== region) return c;
    }
    const bits = [];
    if (listing.bedrooms !== null && listing.bedrooms !== undefined)
        bits.push(listing.bedrooms === 0 ? 'Studio' : `${listing.bedrooms} bedroom`);
    if (listing.sqft) bits.push(`${listing.sqft.toLocaleString()} sqft`);
    return bits.join(' · ') || listing.sub_district || 'Property listing';
}

function priceOverlayHtml(listing) {
    const [value, unit] = compactPriceParts(listing.price);
    const perSqft = listing.price_per_sqft
        ? `${listing.price_per_sqft.toLocaleString()} / sqft`
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
                 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>Prev
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
                 Next<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
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
   Modal
   -------------------------------------------------------------------------- */
function openModal(listingId) {
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) return;

    const modal = document.getElementById('propertyModal');
    const body = document.getElementById('modalBody');

    const hasImg = listing.images && listing.images.length > 0;
    const hero = hasImg
        ? `<img src="${imageProxy(listing.images[0])}" alt="${escapeHtml(listing.title)}"
               onerror="this.closest('.modal-hero').innerHTML='${htmlAttr(placeholderHero())}'">`
        : placeholderHero();

    const badges = [];
    if (listing.is_new) badges.push('<span class="badge badge-new">New</span>');
    if (listing.price_changed) {
        const up = listing.previous_price && listing.price > listing.previous_price;
        badges.push(`<span class="badge ${up ? 'badge-up' : 'badge-down'}">${up ? '▲' : '▼'} Price ${up ? 'up' : 'down'}</span>`);
    }
    badges.push(`<span class="badge badge-src">${SOURCE_LABELS[listing.source] || listing.source}</span>`);

    const locParts = [listing.sub_district, listing.address, DISTRICT_LABELS[listing.district]]
        .filter(Boolean);

    const cells = [];

    if (listing.sqft) cells.push(['Size', `${listing.sqft.toLocaleString()} sqft`]);
    if (listing.price_per_sqft) cells.push(['Price / sqft', `HK$${listing.price_per_sqft.toLocaleString()}`]);
    if (listing.bedrooms !== null && listing.bedrooms !== undefined)
        cells.push(['Bedrooms', listing.bedrooms === 0 ? 'Studio' : String(listing.bedrooms)]);
    if (listing.bathrooms) cells.push(['Bathrooms', String(listing.bathrooms)]);
    if (listing.floor_level) cells.push(['Floor', listing.floor_level.charAt(0).toUpperCase() + listing.floor_level.slice(1)]);
    if (listing.property_type) cells.push(['Type', listing.property_type.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())]);
    if (listing.building_name) cells.push(['Estate', escapeHtml(listing.building_name)]);
    if (listing.agent_company) cells.push(['Agency', escapeHtml(listing.agent_company)]);

    const tags = (listing.features || [])
        .filter((t, i, a) => a.indexOf(t) === i)
        .slice(0, 10)
        .map(t => `<span class="tag">${I.award}${escapeHtml(t)}</span>`)
        .join('');

    body.innerHTML = `
        <div class="modal-hero">${hero}</div>
        <div class="modal-head">
            <div class="modal-badges">${badges.join('')}</div>
            <h2 class="modal-title">${escapeHtml(resolveTitle(listing))}</h2>
            ${locParts.length ? `<div class="modal-loc">${I.pin}${escapeHtml(locParts.join(' · '))}</div>` : ''}
        </div>

        <div class="modal-price-block">
            <div class="modal-price">${listing.price ? fullPrice(listing.price) : 'On request'}</div>
            ${listing.price_per_sqft ? `<div class="modal-ppsqft">HK$${listing.price_per_sqft.toLocaleString()} / sqft</div>` : ''}
        </div>

        <div class="modal-grid">
            ${cells.map(([label, value]) => `
                <div class="modal-cell">
                    <div class="modal-cell-label">${label}</div>
                    <div class="modal-cell-value">${value}</div>
                </div>`).join('')}
        </div>

        ${listing.description && listing.description !== listing.title ? `
            <p class="modal-desc">${escapeHtml(listing.description)}</p>` : ''}

        ${tags ? `<div class="modal-tags">${tags}</div>` : ''}

        <div class="modal-actions">
            <a href="${listing.source_url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                View original listing
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
            </a>
            ${listing.agent_company ? `
                <button class="btn btn-outline" onclick="showToast('Listed via ${escapeHtml(listing.agent_company)} — see original listing for contact', 'info')">
                    ${I.src} ${escapeHtml(listing.agent_company)}
                </button>` : ''}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function placeholderHero() {
    return `<div class="modal-hero-placeholder">${I.home}</div>`;
}

function closeModal() {
    document.getElementById('propertyModal').classList.remove('active');
    document.body.style.overflow = '';
}

/* --------------------------------------------------------------------------
   Export
   -------------------------------------------------------------------------- */
function exportCSV() {
    if (filteredListings.length === 0) {
        showToast('No listings to export.', 'error');
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
    showToast(`${filteredListings.length.toLocaleString()} listings exported.`, 'success');
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