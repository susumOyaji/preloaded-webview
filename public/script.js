// App State
const INDICES_CODES = ['^DJI', '998407.O', 'USDJPY=X'];
let stocks = []; // Array of objects: { code: string, broker: string, quantity: number, avgPrice: number }
let settings = {
    apiEndpoint: 'https://preloaded_state.sumitomo0210.workers.dev',
    refreshInterval: 30,
    theme: 'light'
};
let refreshTimer = null;
let editingId = null; // Track which stock is being edited (code + broker)

// DOM Elements
let indicesContainer, watchlistContainer, totalAssetValue, totalGainLoss, emptyState;
let addStockModal, modalTitle, stockInput, brokerInput, quantityInput, priceInput, confirmAddBtn, cancelAddBtn, addStockBtn;
let settingsModal, refreshIntervalInput, themeToggle, saveSettingsBtn, cancelSettingsBtn, settingsBtn;
let refreshBtn, toast;
let jsonDataContainer, jsonDataContent, toggleJsonBtn, toggleJsonText, toggleJsonIcon;

// Initialize
function init() {
    // DOM Selection
    indicesContainer = document.getElementById('indicesContainer');
    watchlistContainer = document.getElementById('watchlistContainer');
    totalAssetValue = document.getElementById('totalAssetValue');
    totalGainLoss = document.getElementById('totalGainLoss');
    emptyState = document.getElementById('emptyState');

    addStockModal = document.getElementById('addStockModal');
    modalTitle = document.getElementById('modalTitle');
    stockInput = document.getElementById('stockInput');
    brokerInput = document.getElementById('brokerInput');
    quantityInput = document.getElementById('quantityInput');
    priceInput = document.getElementById('priceInput');
    confirmAddBtn = document.getElementById('confirmAddBtn');
    cancelAddBtn = document.getElementById('cancelAddBtn');
    addStockBtn = document.getElementById('addStockBtn');

    settingsModal = document.getElementById('settingsModal');

    refreshIntervalInput = document.getElementById('refreshInterval');
    themeToggle = document.getElementById('themeToggle');
    saveSettingsBtn = document.getElementById('saveSettings');
    cancelSettingsBtn = document.getElementById('cancelSettings');
    settingsBtn = document.getElementById('settingsBtn');

    refreshBtn = document.getElementById('refreshBtn');
    toast = document.getElementById('toast');

    jsonDataContainer = document.getElementById('jsonDataContainer');
    jsonDataContent = document.getElementById('jsonDataContent');
    toggleJsonBtn = document.getElementById('toggleJsonBtn');
    toggleJsonText = document.getElementById('toggleJsonText');
    toggleJsonIcon = document.getElementById('toggleJsonIcon');

    loadSettings();

    // Ensure apiEndpoint is set to the default if it was empty in localStorage
    if (!settings.apiEndpoint) {
        settings.apiEndpoint = 'https://preloaded_state.sumitomo0210.workers.dev';
        saveSettings();
    }

    loadStocks();
    applyTheme();
    setupEventListeners();

    // Initial Fetch
    fetchData();
    startAutoRefresh();
}

function setupEventListeners() {
    // Add Stock Modal
    if (addStockBtn) {
        addStockBtn.addEventListener('click', () => {
            openAddStockModal();
        });
    }

    if (cancelAddBtn) cancelAddBtn.addEventListener('click', () => addStockModal.classList.remove('active'));

    if (confirmAddBtn) confirmAddBtn.addEventListener('click', handleAddStock);

    // Allow Enter key to submit in any field
    [stockInput, brokerInput, quantityInput, priceInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleAddStock();
            });
        }
    });

    // Settings Modal
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {

            refreshIntervalInput.value = settings.refreshInterval;
            themeToggle.checked = settings.theme === 'dark';
            settingsModal.classList.add('active');
        });
    }

    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', handleSaveSettings);

    // Refresh
    if (refreshBtn) refreshBtn.addEventListener('click', fetchData);

    // JSON Toggle
    if (toggleJsonBtn) {
        toggleJsonBtn.addEventListener('click', () => {
            const isHidden = jsonDataContainer.classList.contains('hidden');
            if (isHidden) {
                jsonDataContainer.classList.remove('hidden');
                toggleJsonText.textContent = 'Hide';
                toggleJsonIcon.classList.add('rotated');
            } else {
                jsonDataContainer.classList.add('hidden');
                toggleJsonText.textContent = 'Show';
                toggleJsonIcon.classList.remove('rotated');
            }
        });
    }

    // Close modals on backdrop click
    window.addEventListener('click', (e) => {
        if (e.target === addStockModal) addStockModal.classList.remove('active');
        if (e.target === settingsModal) settingsModal.classList.remove('active');
    });
}

// Modal Functions
function openAddStockModal() {
    editingId = null;
    modalTitle.textContent = 'Add Stock';
    stockInput.value = '';
    brokerInput.value = '';
    quantityInput.value = '';
    priceInput.value = '';
    stockInput.disabled = false;
    brokerInput.disabled = false;
    addStockModal.classList.add('active');
    stockInput.focus();
}

function openEditStockModal(code, broker) {
    const stock = stocks.find(s => s.code === code && s.broker === broker);
    if (!stock) return;

    editingId = `${code}|${broker}`;
    modalTitle.textContent = 'Edit Stock';
    stockInput.value = stock.code;
    brokerInput.value = stock.broker || '';
    quantityInput.value = stock.quantity;
    priceInput.value = stock.avgPrice;
    stockInput.disabled = false;
    brokerInput.disabled = false;
    addStockModal.classList.add('active');
    stockInput.focus();
}

// Expose to global scope for HTML onclick
window.openEditStockModal = openEditStockModal;

// Data Management
async function fetchData() {
    // Start loading animation
    if (refreshBtn) {
        refreshBtn.classList.add('loading');
    }

    // Extract unique codes from stock objects
    const stockCodes = [...new Set(stocks.map(s => s.code))];
    const allCodes = [...INDICES_CODES, ...stockCodes];

    if (allCodes.length === 0) {
        renderIndices([]);
        renderWatchlist([]);
        calculatePortfolio([]);
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
        return;
    }

    try {
        let baseUrl = settings.apiEndpoint;

        // Remove trailing slash if present
        if (baseUrl && baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        // Function to fetch a single code with retry
        const fetchSingleCode = async (code) => {
            const url = `${baseUrl}/?code=${encodeURIComponent(code)}`;
            let retries = 3;
            let attempt = 0;

            while (attempt < retries) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        return await response.json();
                    }

                    throw new Error(`Server returned ${response.status}`);
                } catch (err) {
                    attempt++;
                    console.warn(`Fetch attempt ${attempt} for ${code} failed: ${err.message}`);

                    if (attempt >= retries) {
                        console.error(`Final failure for ${code}: ${err.message}`);
                        return null;
                    }

                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
                }
            }
        };

        // Fetch all codes with concurrency limit
        const concurrencyLimit = 2;
        const results = [];

        for (let i = 0; i < allCodes.length; i += concurrencyLimit) {
            const batch = allCodes.slice(i, i + concurrencyLimit);
            const batchResults = await Promise.all(batch.map(code => fetchSingleCode(code)));
            results.push(...batchResults);

            if (i + concurrencyLimit < allCodes.length) {
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        const data = results.filter(r => r !== null).flat();

        // Check if there were any failures
        const failedCount = results.filter(r => r === null).length;
        if (failedCount > 0) {
            showToast(`Failed to fetch ${failedCount} stock(s)`, 'error');
        }

        console.log('API Response:', data);

        // Display JSON data
        if (jsonDataContent) {
            jsonDataContent.textContent = JSON.stringify(data, null, 2);
        }

        // Split data
        const indicesData = data.filter(item => {
            const code = item.code;
            return code && INDICES_CODES.includes(code);
        });

        const watchlistData = data.filter(item => {
            const code = item.code;
            return code && !INDICES_CODES.includes(code);
        });
        console.log('Watchlist Data:', watchlistData);

        renderIndices(indicesData);
        renderWatchlist(watchlistData);
        calculatePortfolio(watchlistData);

    } catch (error) {
        console.error('Fetch error:', error);
        showToast('Failed to fetch data', 'error');
    } finally {
        // Stop loading animation
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
        }
    }
}

// Rendering
function renderIndices(data) {
    if (!indicesContainer) return;
    indicesContainer.innerHTML = '';
    const sortedData = INDICES_CODES.map(code =>
        data.find(item => (item.code === code || item.data?.code === code))
    ).filter(Boolean);

    sortedData.forEach(item => {
        indicesContainer.appendChild(createCard(item, true));
    });
}

function renderWatchlist(data) {
    if (!watchlistContainer) return;
    watchlistContainer.innerHTML = '';

    if (stocks.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    // Create a lookup map for API data by code
    const apiDataMap = {};
    data.forEach(item => {
        if (item.code) {
            apiDataMap[item.code] = item;
        }
    });

    // Group stocks by broker
    const groupedByBroker = {};
    stocks.forEach(stock => {
        const brokerKey = stock.broker || 'Other';
        if (!groupedByBroker[brokerKey]) {
            groupedByBroker[brokerKey] = [];
        }
        const apiData = apiDataMap[stock.code];
        groupedByBroker[brokerKey].push({ ...stock, apiData });
    });

    // Sort broker names: non-empty first, then 'Other'
    const brokerNames = Object.keys(groupedByBroker).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
    });
    console.log('groupedByBroker:', groupedByBroker);

    // Render each broker group with horizontal grid
    brokerNames.forEach(brokerName => {
        console.log(`Rendering broker: ${brokerName}, stocks:`, groupedByBroker[brokerName]);
        // Create broker header
        const brokerHeader = document.createElement('div');
        brokerHeader.style.cssText = 'margin-top: 24px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--primary); font-size: 1.1rem; font-weight: 500; color: var(--primary);';
        brokerHeader.textContent = brokerName;
        watchlistContainer.appendChild(brokerHeader);

        // Create horizontal grid for this broker's stocks
        const brokerGrid = document.createElement('div');
        brokerGrid.className = 'watchlist-grid';
        brokerGrid.style.marginBottom = '16px';

        groupedByBroker[brokerName].forEach(item => {
            console.log(`Creating card for:`, item);
            const card = createCard(item, false);
            console.log(`Card created:`, card);
            brokerGrid.appendChild(card);
        });

        watchlistContainer.appendChild(brokerGrid);
    });
}

function createCard(item, isIndex) {
    // Handle both index data and watchlist data
    let code, name, priceStr, changeRaw, changeRateRaw, updateTime, data;

    if (isIndex) {
        // Index: CodeResult object with { code, data, error }
        code = item.code;
        data = item.data || {};
    } else {
        // Watchlist: { code, broker, quantity, avgPrice, apiData }
        code = item.code;
        const apiData = item.apiData;
        data = (apiData && apiData.data) || {};
    }

    const broker = isIndex ? '' : (item.broker || '');
    name = data.name || code;
    priceStr = data.price || '0';
    changeRaw = data.price_change || '0';
    changeRateRaw = data.price_change_rate || '0.00';
    updateTime = data.update_time || '';

    // Determine currency symbol based on code
    let currencySymbol = '¥'; // Default to Yen
    if (code === 'USDJPY=X') {
        currencySymbol = '¥'; // USDJPY shows yen per dollar
    } else if (code.startsWith('^') || code.includes('USD')) {
        currencySymbol = '$'; // US indices
    } else if (code.endsWith('.T') || code.endsWith('.O')) {
        currencySymbol = '¥'; // Japanese stocks
    }

    // Normalize numeric change values and determine sign/absolute for display
    const parseNumber = (v) => {
        if (v === null || v === undefined) return 0;
        const s = String(v).replace(/,/g, '').trim();
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
    };

    const changeNum = parseNumber(changeRaw);
    const changeRateNum = parseNumber(changeRateRaw);

    const isPositive = changeNum >= 0;
    const colorClass = isPositive ? 'text-success' : 'text-danger';
    const sign = isPositive ? '+' : '-';
    const change = Math.abs(changeNum).toLocaleString();
    const changeRate = Math.abs(changeRateNum).toFixed(2);

    const card = document.createElement('div');
    card.className = 'stock-card';

    let actionButtonsHtml = '';
    let portfolioHtml = '';
    let updateTimeHtml = '';
    let brokerHtml = '';

    if (!isIndex) {
        // Escape broker name for onclick
        const brokerEscaped = broker.replace(/'/g, "\\'");

        actionButtonsHtml = `
            <div class="stock-actions">
                <button class="action-btn" onclick="openEditStockModal('${code}', '${brokerEscaped}')" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
                </button>
                <button class="action-btn" onclick="removeStock('${code}', '${brokerEscaped}')" title="Remove">
                    <svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                </button>
            </div>
        `;

        // Show broker name if present (only in card, not in header since we have group headers)
        if (broker) {
            brokerHtml = `<div style="font-size: 0.75rem; color: var(--on-surface-variant); margin-top: 2px;">${broker}</div>`;
        }

        // Calculate individual gain/loss if quantity > 0
        if (item.quantity > 0) {
            const currentPrice = parseFloat(priceStr.replace(/,/g, '')) || 0;
            const gainLoss = (currentPrice - item.avgPrice) * item.quantity;
            const gainLossPercent = item.avgPrice > 0 ? ((currentPrice - item.avgPrice) / item.avgPrice) * 100 : 0;

            const glColorClass = gainLoss >= 0 ? 'text-success' : 'text-danger';
            const glPrefix = gainLoss >= 0 ? '+' : '';

            portfolioHtml = `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--outline); font-size: 0.75rem; color: var(--on-surface-variant);">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Qty: ${item.quantity}</span>
                        <span>Avg: ${currencySymbol}${item.avgPrice.toLocaleString()}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-top:4px;">
                        <span style="font-weight:500;">G/L:</span>
                        <span class="${glColorClass}" style="font-weight:500;">
                            ${glPrefix}${currencySymbol}${Math.round(gainLoss).toLocaleString()} (${glPrefix}${gainLossPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
            `;
        }
    }

    // Add update time display
    if (updateTime) {
        updateTimeHtml = `
            <div style="margin-top: 8px; font-size: 0.7rem; color: var(--outline); text-align: right;">
                ${updateTime}
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="stock-name" title="${name}">${name}</div>
                <div class="stock-code">${code}</div>
                ${brokerHtml}
            </div>
            ${actionButtonsHtml}
        </div>
        <div class="card-body" style="flex-direction: column; align-items: stretch;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div class="current-price">${currencySymbol}${priceStr}</div>
                <div class="change-info">
                    <span class="${colorClass}">${sign}${change}</span>
                    <span class="${colorClass}">(${sign}${changeRate}%)</span>
                </div>
            </div>
            ${portfolioHtml}
            ${updateTimeHtml}
        </div>
    `;
    return card;
}

// Portfolio Calculation
function calculatePortfolio(apiDataList) {
    if (!totalAssetValue || !totalGainLoss) return;

    // Create a lookup map for API data by code
    const apiDataMap = {};
    apiDataList.forEach(item => {
        if (item.code) {
            apiDataMap[item.code] = item;
        }
    });

    let totalAsset = 0;
    let totalInvestment = 0;

    stocks.forEach(stock => {
        if (stock.quantity > 0) {
            const apiItem = apiDataMap[stock.code];
            const priceStr = (apiItem && apiItem.data && apiItem.data.price) || '0';
            const currentPrice = parseFloat(priceStr.replace(/,/g, '')) || 0;

            totalAsset += currentPrice * stock.quantity;
            totalInvestment += stock.avgPrice * stock.quantity;
        }
    });

    const totalGainLossVal = totalAsset - totalInvestment;
    const totalGainLossPercent = totalInvestment > 0 ? (totalGainLossVal / totalInvestment) * 100 : 0;

    const glColorClass = totalGainLossVal >= 0 ? 'text-success' : 'text-danger';
    const glPrefix = totalGainLossVal >= 0 ? '+' : '';

    totalAssetValue.textContent = `¥${Math.round(totalAsset).toLocaleString()}`;
    totalGainLoss.innerHTML = `
        <span class="${glColorClass}" style="display:flex; align-items:center; gap:4px;">
            ${glPrefix}¥${Math.round(totalGainLossVal).toLocaleString()} 
            <span style="font-size:0.875rem;">(${glPrefix}${totalGainLossPercent.toFixed(2)}%)</span>
        </span>
    `;
}

// Actions
function handleAddStock() {
    const code = stockInput.value.trim().toUpperCase();
    const broker = brokerInput.value.trim();
    const quantity = parseInt(quantityInput.value) || 0;
    const avgPrice = parseFloat(priceInput.value) || 0;

    if (!code) return;

    if (editingId) {
        // Editing existing stock
        const [oldCode, oldBroker] = editingId.split('|');
        const existingIndex = stocks.findIndex(s => s.code === oldCode && s.broker === oldBroker);

        if (existingIndex !== -1) {
            // Remove old entry
            stocks.splice(existingIndex, 1);
        }

        // Check if new code+broker already exists
        const newExists = stocks.findIndex(s => s.code === code && s.broker === broker);
        if (newExists !== -1) {
            // Update existing entry
            stocks[newExists] = { code, broker, quantity, avgPrice };
            showToast('Stock merged and updated');
        } else {
            // Add as new entry
            stocks.push({ code, broker, quantity, avgPrice });
            showToast('Stock updated');
        }
    } else {
        // Adding new stock
        const existingIndex = stocks.findIndex(s => s.code === code && s.broker === broker);

        if (existingIndex !== -1) {
            // Update existing
            stocks[existingIndex] = { code, broker, quantity, avgPrice };
            showToast('Stock updated');
        } else {
            // Add new
            stocks.push({ code, broker, quantity, avgPrice });
            showToast('Stock added');
        }
    }

    saveStocks();
    addStockModal.classList.remove('active');
    editingId = null;
    fetchData();
}

function removeStock(code, broker) {
    stocks = stocks.filter(s => !(s.code === code && s.broker === broker));
    saveStocks();
    fetchData(); // Re-render
    showToast('Stock removed');
}
// Expose to global scope for HTML onclick
window.removeStock = removeStock;

function handleSaveSettings() {

    settings.refreshInterval = parseInt(refreshIntervalInput.value);
    settings.theme = themeToggle.checked ? 'dark' : 'light';

    saveSettings();
    applyTheme();
    settingsModal.classList.remove('active');

    startAutoRefresh(); // Restart timer
    fetchData(); // Refresh data
    showToast('Settings saved');
}

// Utils
function showToast(msg, type = 'success') {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show';
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(fetchData, settings.refreshInterval * 1000);
}

// Storage
function saveStocks() {
    localStorage.setItem('stocks_v3', JSON.stringify(stocks));
}

function loadStocks() {
    // Try loading v3 format first (with broker)
    const savedV3 = localStorage.getItem('stocks_v3');
    if (savedV3) {
        try {
            stocks = JSON.parse(savedV3);
            return;
        } catch (e) { console.error('Error loading v3 stocks', e); }
    }

    // Fallback/Migration from v2 (without broker)
    const savedV2 = localStorage.getItem('stocks_v2');
    if (savedV2) {
        try {
            const oldStocks = JSON.parse(savedV2);
            if (Array.isArray(oldStocks) && oldStocks.length > 0) {
                // Migrate: add broker field
                stocks = oldStocks.map(stock => ({ ...stock, broker: stock.broker || '' }));
                saveStocks(); // Save as v3
                return;
            }
        } catch (e) { console.error('Error loading v2 stocks', e); }
    }

    // Fallback/Migration from v1 (simple array of strings)
    const savedV1 = localStorage.getItem('stocks');
    if (savedV1) {
        try {
            const oldStocks = JSON.parse(savedV1);
            if (Array.isArray(oldStocks) && oldStocks.length > 0 && typeof oldStocks[0] === 'string') {
                // Migrate
                stocks = oldStocks.map(code => ({ code, broker: '', quantity: 0, avgPrice: 0 }));
                saveStocks(); // Save as v3
                return;
            }
        } catch (e) { console.error('Error loading v1 stocks', e); }
    }

    // Default if nothing found
    stocks = [];
}

function saveSettings() {
    localStorage.setItem('settings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
