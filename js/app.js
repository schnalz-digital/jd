let allListings = [];
let filteredListings = [];
let currentPage = 1;
const listingsPerPage = 24;
let currentFilters = {};

const sessionKey = 'hk_property_unlocked';

document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem(sessionKey) === '1') {
        unlockSite();
    }
});

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

function sha256(str) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    
    const utf8 = unescape(encodeURIComponent(str));
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) {
        bytes.push(utf8.charCodeAt(i));
    }
    const originalLength = bytes.length;
    
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) {
        bytes.push(0);
    }
    let hi = Math.floor(originalLength / 0x20000000);
    let lo = (originalLength << 3) >>> 0;
    for (let i = 0; i < 4; i++) {
        bytes.push((hi >>> (24 - i * 8)) & 0xff);
    }
    for (let i = 0; i < 4; i++) {
        bytes.push((lo >>> (24 - i * 8)) & 0xff);
    }
    
    const h0 = 0x6a09e667;
    const h1 = 0xbb67ae85;
    const h2 = 0x3c6ef372;
    const h3 = 0xa54ff53a;
    const h4 = 0x510e527f;
    const h5 = 0x9b05688c;
    const h6 = 0x1f83d9ab;
    const h7 = 0x5be0cd19;
    
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
    let blocks = [];
    for (let i = 0; i < bytes.length / 64; i++) {
        blocks.push(bytes.slice(i * 64, i * 64 + 64));
    }
    
    let a, b, c, d, e, f, g, h;
    
    let A = h0, B = h1, C = h2, D = h3, E = h4, F = h5, G = h6, H = h7;
    
    for (let block of blocks) {
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
        
        A = (A + a) >>> 0;
        B = (B + b) >>> 0;
        C = (C + c) >>> 0;
        D = (D + d) >>> 0;
        E = (E + e) >>> 0;
        F = (F + f) >>> 0;
        G = (G + g) >>> 0;
        H = (H + h) >>> 0;
    }
    
    const result = [A, B, C, D, E, F, G, H]
        .map(num => (num >>> 0).toString(16).padStart(8, '0'))
        .join('');
    
    return result;
}

async function refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="refresh-icon spinning">↻</span> Refreshing...';
    
    await loadListings();
    
    btn.disabled = false;
    btn.innerHTML = '<span class="refresh-icon">↻</span> Refresh';
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFilters();
    });

    document.querySelectorAll('.bedroom-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.bedroom-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    document.getElementById('propertyModal').addEventListener('click', (e) => {
        if (e.target.id === 'propertyModal') closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

async function loadListings() {
    try {
        const cacheBuster = `?t=${Date.now()}`;
        const response = await fetch(`listings.json${cacheBuster}`);
        if (!response.ok) throw new Error('No data file');
        
        const data = await response.json();
        allListings = data.listings || [];
        
        const lastCrawl = data.last_crawl ? new Date(data.last_crawl).toLocaleString() : 'never';
        showToast(`Loaded ${allListings.length} listings · updated ${lastCrawl}`, 'info');
        
        updateStats(data.stats);
        updateLastCrawl(data.last_crawl);
        applyFilters();
    } catch (error) {
        console.error('Error loading listings:', error);
        showToast('No listing data found yet', 'error');
        document.getElementById('listingsGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⏳</div>
                <div class="empty-state-title">No listings yet</div>
                <div class="empty-state-text">The automated crawler runs every 2 hours. Check back soon.</div>
            </div>
        `;
    }
}

function updateStats(stats) {
    const totalEl = document.getElementById('totalListings');
    if (totalEl) {
        totalEl.textContent = `${allListings.length} listings`;
    }
}

function updateLastCrawl(lastCrawl) {
    const el = document.getElementById('lastCrawl');
    if (el && lastCrawl) {
        const d = new Date(lastCrawl);
        const ago = Math.floor((Date.now() - d.getTime()) / 60000);
        let label;
        if (ago < 60) label = `${ago}m ago`;
        else if (ago < 1440) label = `${Math.floor(ago / 60)}h ago`;
        else label = d.toLocaleDateString();
        el.textContent = `updated ${label}`;
    }
}

function applyFilters() {
    currentFilters = {
        search: document.getElementById('searchInput').value.toLowerCase(),
        sources: Array.from(document.querySelectorAll('#sourceFilters input:checked')).map(cb => cb.value),
        district: document.getElementById('districtFilter').value,
        minPrice: parseFloat(document.getElementById('minPrice').value) * 1000000 || null,
        maxPrice: parseFloat(document.getElementById('maxPrice').value) * 1000000 || null,
        bedrooms: document.querySelector('.bedroom-btn.active')?.dataset.value || '',
        propertyType: document.getElementById('typeFilter').value,
        sortBy: document.getElementById('sortFilter').value,
        newOnly: document.getElementById('newOnlyFilter').checked
    };

    filteredListings = allListings.filter(listing => {
        if (!currentFilters.sources.includes(listing.source)) return false;
        
        if (currentFilters.district && listing.district !== currentFilters.district) return false;
        
        if (currentFilters.minPrice && listing.price && listing.price < currentFilters.minPrice) return false;
        if (currentFilters.maxPrice && listing.price && listing.price > currentFilters.maxPrice) return false;
        
        if (currentFilters.bedrooms !== '') {
            const bed = parseInt(currentFilters.bedrooms);
            if (bed === 4) {
                if (!listing.bedrooms || listing.bedrooms < 4) return false;
            } else {
                if (listing.bedrooms !== bed) return false;
            }
        }
        
        if (currentFilters.propertyType && listing.property_type !== currentFilters.propertyType) return false;
        
        if (currentFilters.newOnly && !listing.is_new) return false;
        
        if (currentFilters.search) {
            const searchStr = `${listing.title} ${listing.address || ''} ${listing.building_name || ''} ${listing.description || ''}`.toLowerCase();
            if (!searchStr.includes(currentFilters.search)) return false;
        }
        
        return true;
    });

    sortListings();
    currentPage = 1;
    renderListings();
}

function sortListings() {
    filteredListings.sort((a, b) => {
        switch (currentFilters.sortBy) {
            case 'date_crawled':
                return (b.date_crawled || '').localeCompare(a.date_crawled || '');
            case 'price_asc':
                return (a.price || Infinity) - (b.price || Infinity);
            case 'price_desc':
                return (b.price || 0) - (a.price || 0);
            case 'sqft_desc':
                return (b.sqft || 0) - (a.sqft || 0);
            case 'price_per_sqft_asc':
                return (a.price_per_sqft || Infinity) - (b.price_per_sqft || Infinity);
            default:
                return 0;
        }
    });
}

function renderListings() {
    const grid = document.getElementById('listingsGrid');
    const start = (currentPage - 1) * listingsPerPage;
    const end = start + listingsPerPage;
    const pageListings = filteredListings.slice(start, end);

    document.getElementById('resultsCount').textContent = 
        `Showing ${start + 1}-${Math.min(end, filteredListings.length)} of ${filteredListings.length} listings`;

    if (pageListings.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-title">No matches found</div>
                <div class="empty-state-text">Try adjusting your filters</div>
            </div>
        `;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    grid.innerHTML = pageListings.map(listing => createListingCard(listing)).join('');
    renderPagination();
}

function createListingCard(listing) {
    const imageHtml = listing.images && listing.images.length > 0
        ? `<img src="${listing.images[0]}" alt="${listing.title}" class="listing-image" onerror="this.outerHTML='<div class=\\'listing-image-placeholder\\'>🏠</div>'">`
        : `<div class="listing-image-placeholder">🏠</div>`;

    const badges = [];
    if (listing.is_new) badges.push('<span class="badge badge-new">New</span>');
    if (listing.price_changed) {
        const icon = listing.previous_price && listing.price > listing.previous_price ? '↑' : '↓';
        const cls = listing.previous_price && listing.price > listing.previous_price ? 'badge-price-up' : 'badge-price-down';
        badges.push(`<span class="badge ${cls}">Price ${icon}</span>`);
    }
    badges.push(`<span class="badge badge-source">${listing.source}</span>`);

    const price = listing.price 
        ? `HKD $${formatPrice(listing.price)}`
        : 'Price on request';

    const pricePerSqft = listing.price_per_sqft
        ? `@$${listing.price_per_sqft.toLocaleString()}/sqft`
        : '';

    const bedrooms = listing.bedrooms !== null && listing.bedrooms !== undefined
        ? `<span class="listing-detail"><span class="listing-detail-icon">🛏️</span>${listing.bedrooms === 0 ? 'Studio' : listing.bedrooms + ' Bed'}</span>`
        : '';

    const bathrooms = listing.bathrooms
        ? `<span class="listing-detail"><span class="listing-detail-icon">🚿</span>${listing.bathrooms} Bath</span>`
        : '';

    const sqft = listing.sqft
        ? `<span class="listing-detail"><span class="listing-detail-icon">📐</span>${listing.sqft.toLocaleString()} sqft</span>`
        : '';

    const location = listing.district
        ? `<span class="listing-location">📍 ${formatDistrict(listing.district)}</span>`
        : '';

    const dateStr = listing.date_crawled
        ? new Date(listing.date_crawled).toLocaleDateString()
        : '';

    return `
        <div class="listing-card ${listing.is_new ? 'new' : ''} ${listing.price_changed ? 'price-changed' : ''}" 
             onclick="openModal('${listing.id}')">
            <div style="position: relative;">
                ${imageHtml}
                <div class="listing-badges">${badges.join('')}</div>
            </div>
            <div class="listing-content">
                <div class="listing-header">
                    <div>
                        <div class="listing-price">${price}</div>
                        ${pricePerSqft ? `<div class="listing-price-per-sqft">${pricePerSqft}</div>` : ''}
                    </div>
                </div>
                <div class="listing-title">${escapeHtml(listing.title)}</div>
                <div class="listing-details">
                    ${bedrooms}
                    ${bathrooms}
                    ${sqft}
                </div>
                ${location}
                <div class="listing-meta">
                    <span class="listing-source">${listing.source}</span>
                    <span>${dateStr}</span>
                </div>
            </div>
        </div>
    `;
}

function formatPrice(price) {
    if (price >= 1000000000) {
        return (price / 1000000000).toFixed(2) + 'B';
    }
    if (price >= 1000000) {
        return (price / 1000000).toFixed(2) + 'M';
    }
    if (price >= 1000) {
        return (price / 1000).toFixed(0) + 'K';
    }
    return price.toFixed(0);
}

function formatDistrict(district) {
    const districts = {
        'hong_kong_island': 'Hong Kong Island',
        'kowloon': 'Kowloon',
        'new_territories': 'New Territories',
        'outlying_islands': 'Outlying Islands'
    };
    return districts[district] || district;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderPagination() {
    const totalPages = Math.ceil(filteredListings.length / listingsPerPage);
    const pagination = document.getElementById('pagination');

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    
    html += `<button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) html += `<span class="pagination-btn" style="border: none; cursor: default;">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="pagination-btn" style="border: none; cursor: default;">...</span>`;
        html += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;

    pagination.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredListings.length / listingsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderListings();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(listingId) {
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) return;

    const modal = document.getElementById('propertyModal');
    const body = document.getElementById('modalBody');

    const imageHtml = listing.images && listing.images.length > 0
        ? `<img src="${listing.images[0]}" alt="${listing.title}" class="modal-image" onerror="this.style.display='none'">`
        : '';

    const price = listing.price 
        ? `HKD $${formatPrice(listing.price)}`
        : 'Price on request';

    body.innerHTML = `
        ${imageHtml}
        <h2 class="modal-title">${escapeHtml(listing.title)}</h2>
        <div class="modal-price">${price}</div>
        
        <div class="modal-details">
            <div class="modal-detail">
                <span class="modal-detail-label">Size</span>
                <span class="modal-detail-value">${listing.sqft ? listing.sqft.toLocaleString() + ' sqft' : 'N/A'}</span>
            </div>
            <div class="modal-detail">
                <span class="modal-detail-label">Price/sqft</span>
                <span class="modal-detail-value">${listing.price_per_sqft ? '$' + listing.price_per_sqft.toLocaleString() : 'N/A'}</span>
            </div>
            <div class="modal-detail">
                <span class="modal-detail-label">Bedrooms</span>
                <span class="modal-detail-value">${listing.bedrooms !== null ? (listing.bedrooms === 0 ? 'Studio' : listing.bedrooms) : 'N/A'}</span>
            </div>
            <div class="modal-detail">
                <span class="modal-detail-label">Bathrooms</span>
                <span class="modal-detail-value">${listing.bathrooms || 'N/A'}</span>
            </div>
            <div class="modal-detail">
                <span class="modal-detail-label">District</span>
                <span class="modal-detail-value">${listing.district ? formatDistrict(listing.district) : 'N/A'}</span>
            </div>
            <div class="modal-detail">
                <span class="modal-detail-label">Type</span>
                <span class="modal-detail-value">${listing.property_type ? listing.property_type.replace('_', ' ').toUpperCase() : 'N/A'}</span>
            </div>
            <div class="modal-detail">
                <span class="modal-detail-label">Floor Level</span>
                <span class="modal-detail-value">${listing.floor_level || 'N/A'}</span>
            </div>
            <div class="modal-detail">
                <span class="modal-detail-label">Source</span>
                <span class="modal-detail-value">${listing.source}</span>
            </div>
        </div>

        ${listing.description ? `<div class="modal-description">${escapeHtml(listing.description)}</div>` : ''}

        ${listing.features && listing.features.length > 0 ? `
            <div class="modal-features">
                ${listing.features.map(f => `<span class="feature-tag">${escapeHtml(f)}</span>`).join('')}
            </div>
        ` : ''}

        <div class="modal-actions">
            <a href="${listing.source_url}" target="_blank" rel="noopener noreferrer" class="btn btn-view">
                View Original Listing →
            </a>
            ${listing.agent_contact ? `
                <button class="btn btn-contact" onclick="copyContact('${listing.agent_contact}')">
                    📞 Copy Contact
                </button>
            ` : ''}
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('propertyModal').classList.remove('active');
    document.body.style.overflow = '';
}

function copyContact(contact) {
    navigator.clipboard.writeText(contact).then(() => {
        showToast('Contact copied to clipboard!', 'success');
    });
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('districtFilter').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('sortFilter').value = 'date_crawled';
    document.getElementById('newOnlyFilter').checked = false;
    
    document.querySelectorAll('#sourceFilters input').forEach(cb => cb.checked = true);
    document.querySelectorAll('.bedroom-btn').forEach(b => b.classList.remove('active'));
    
    applyFilters();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('hidden');
}

function exportCSV() {
    if (filteredListings.length === 0) {
        showToast('No listings to export', 'error');
        return;
    }

    const headers = ['Title', 'Price (HKD)', 'District', 'Bedrooms', 'Bathrooms', 'Size (sqft)', 'Price/sqft', 'Type', 'Source', 'URL'];
    
    const rows = filteredListings.map(l => [
        `"${(l.title || '').replace(/"/g, '""')}"`,
        l.price || '',
        l.district || '',
        l.bedrooms !== null ? l.bedrooms : '',
        l.bathrooms || '',
        l.sqft || '',
        l.price_per_sqft || '',
        l.property_type || '',
        l.source || '',
        l.source_url || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `hk-property-listings-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast(`Exported ${filteredListings.length} listings`, 'success');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
