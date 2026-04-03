// Expense & Budget Visualizer – app logic

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

const STORAGE_KEYS = {
  transactions: 'ebv_transactions',
  categories: 'ebv_categories',
};

// ─── State ────────────────────────────────────────────────────────────────────

/**
 * Central application state. All mutations must go through setState().
 * @type {{ transactions: object[], categories: string[], sortOrder: string, summaryVisible: boolean }}
 */
const state = {
  transactions: [],
  categories: [],
  sortOrder: '',
  summaryVisible: false,
};

// ─── Storage ──────────────────────────────────────────────────────────────────

/**
 * Persist transactions to localStorage.
 * Shows a non-blocking warning banner if the storage quota is exceeded.
 * @param {object[]} transactions
 */
function saveTransactions(transactions) {
  try {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showStorageWarning();
    } else {
      throw err;
    }
  }
}

/**
 * Persist categories to localStorage.
 * Shows a non-blocking warning banner if the storage quota is exceeded.
 * @param {string[]} categories
 */
function saveCategories(categories) {
  try {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
  } catch (err) {
    if (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      showStorageWarning();
    } else {
      throw err;
    }
  }
}

/**
 * Load transactions from localStorage.
 * Falls back to an empty array if the key is missing or the JSON is invalid.
 * @returns {object[]}
 */
function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.transactions);
    if (raw === null) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('ebv: failed to parse transactions from localStorage – falling back to []', err);
    return [];
  }
}

/**
 * Load categories from localStorage.
 * Falls back to DEFAULT_CATEGORIES if the key is missing or the JSON is invalid.
 * @returns {string[]}
 */
function loadCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.categories);
    if (raw === null) return [...DEFAULT_CATEGORIES];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('ebv: failed to parse categories from localStorage – falling back to defaults', err);
    return [...DEFAULT_CATEGORIES];
  }
}

// ─── State management ─────────────────────────────────────────────────────────

/**
 * Populate the central state object from localStorage on app start.
 */
function loadState() {
  state.transactions = loadTransactions();
  state.categories = loadCategories();
  state.sortOrder = '';
  state.summaryVisible = false;
}

/**
 * Merge updates into state, persist affected slices to localStorage,
 * then trigger a full UI re-render.
 * @param {Partial<typeof state>} updates
 */
function setState(updates) {
  Object.assign(state, updates);

  if ('transactions' in updates) {
    saveTransactions(state.transactions);
  }
  if ('categories' in updates) {
    saveCategories(state.categories);
  }

  renderAll();
}

// ─── UI ──────────────────────────────────────────────────────────────────────

/** Trigger a full re-render of all UI sections. */
function renderAll() {
  renderBalance();
  renderList();
  renderChart();
  renderSummary();
  renderCategoryOptions();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Show a non-blocking storage-warning banner.
 * Creates the element once; subsequent calls are no-ops.
 */
function showStorageWarning() {
  if (document.getElementById('storage-warning')) return;
  const banner = document.createElement('div');
  banner.id = 'storage-warning';
  banner.textContent =
    'Storage quota exceeded – some data may not have been saved. ' +
    'Consider deleting old transactions to free up space.';
  document.body.prepend(banner);
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate the fields for a new transaction.
 * Requirements: 1.3, 1.4
 * @param {string} name
 * @param {*} amount
 * @param {string} category
 * @returns {{ valid: boolean, error: string }}
 */
function validateTransaction(name, amount, category) {
  if (!name || String(name).trim() === '') {
    return { valid: false, error: 'Item name is required.' };
  }
  const num = Number(amount);
  if (amount === '' || amount === null || amount === undefined || isNaN(num) || num <= 0) {
    return { valid: false, error: 'Amount must be a positive number.' };
  }
  if (!category || String(category).trim() === '') {
    return { valid: false, error: 'Please select a category.' };
  }
  return { valid: true, error: '' };
}

/**
 * Validate a new category name against the existing list.
 * Requirements: 6.5
 * @param {string} name
 * @param {string[]} existingCategories
 * @returns {{ valid: boolean, error: string }}
 */
function validateCategory(name, existingCategories) {
  if (!name || String(name).trim() === '') {
    return { valid: false, error: 'Category name cannot be empty.' };
  }
  const lower = String(name).trim().toLowerCase();
  const duplicate = existingCategories.some(c => c.toLowerCase() === lower);
  if (duplicate) {
    return { valid: false, error: 'Category already exists.' };
  }
  return { valid: true, error: '' };
}

// ─── Transaction handlers ─────────────────────────────────────────────────────

/**
 * Handle the transaction form submit event.
 * Requirements: 1.2, 1.3, 1.4, 1.5, 5.1
 * @param {Event} event
 */
function handleAddTransaction(event) {
  event.preventDefault();

  const name = document.getElementById('item-name').value;
  const amount = document.getElementById('item-amount').value;
  const category = document.getElementById('item-category').value;

  const { valid, error } = validateTransaction(name, amount, category);

  const formError = document.getElementById('form-error');

  if (!valid) {
    formError.textContent = error;
    return;
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Date.now().toString() + Math.random().toString(36).slice(2);

  const newTransaction = {
    id,
    name: name.trim(),
    amount: Math.round(parseFloat(amount) * 100) / 100,
    category,
    timestamp: Date.now(),
  };

  setState({ transactions: [...state.transactions, newTransaction] });

  formError.textContent = '';
  document.getElementById('transaction-form').reset();
}

/**
 * Handle deleting a transaction by id.
 * Requirements: 2.3, 5.2
 * @param {string} id
 */
function handleDeleteTransaction(id) {
  const filtered = state.transactions.filter(t => t.id !== id);
  setState({ transactions: filtered });
}

// ─── Balance ──────────────────────────────────────────────────────────────────

/**
 * Sum all transaction amounts and return the total rounded to 2 decimal places.
 * Requirements: 3.2, 3.3, 3.4
 * @param {object[]} transactions
 * @returns {number}
 */
function computeBalance(transactions) {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Format a number as a GBP currency string (e.g. £12.50).
 * Requirements: 3.4
 * @param {number} n
 * @returns {string}
 */
function formatCurrency(n) {
  return '£' + n.toFixed(2);
}

/**
 * Render the current balance into the #balance-amount element.
 * Requirements: 3.1, 3.2, 3.3
 */
function renderBalance() {
  const el = document.getElementById('balance-amount');
  if (!el) return;
  el.textContent = formatCurrency(computeBalance(state.transactions));
}

// ─── Transaction list ─────────────────────────────────────────────────────────

/**
 * Return a new sorted copy of the transactions array.
 * Requirements: 8.1, 8.2, 8.3, 8.4
 * @param {object[]} transactions
 * @param {string} sortOrder  '' | 'amount-asc' | 'amount-desc' | 'category-asc'
 * @returns {object[]}
 */
function sortTransactions(transactions, sortOrder) {
  const copy = [...transactions];
  switch (sortOrder) {
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'category-asc':
      return copy.sort((a, b) =>
        a.category.toLowerCase().localeCompare(b.category.toLowerCase())
      );
    default:
      // '' or unknown – preserve insertion order (ascending by timestamp)
      return copy.sort((a, b) => a.timestamp - b.timestamp);
  }
}

/**
 * Render the transaction list into #transaction-list.
 * Requirements: 2.1, 2.2, 2.4
 */
function renderList() {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  const sorted = sortTransactions(state.transactions, state.sortOrder);

  if (sorted.length === 0) {
    list.innerHTML = '<li class="empty-state">No transactions recorded yet.</li>';
    return;
  }

  list.innerHTML = sorted
    .map(
      t => `<li>
  <span class="transaction-name">${t.name}</span>
  <span class="transaction-amount">${formatCurrency(t.amount)}</span>
  <span class="transaction-category">${t.category}</span>
  <button type="button" data-id="${t.id}" class="delete-btn" aria-label="Delete ${t.name}">Delete</button>
</li>`
    )
    .join('');
}

// Wire delete via event delegation (registered once)
document.getElementById('transaction-list').addEventListener('click', function (event) {
  const id = event.target.dataset.id;
  if (id) {
    handleDeleteTransaction(id);
  }
});

/**
 * Handle sort-control change: update state.sortOrder and re-render.
 * Requirements: 8.1, 8.2
 */
function handleSortChange() {
  const value = document.getElementById('sort-control').value;
  setState({ sortOrder: value });
}

// ─── Chart ───────────────────────────────────────────────────────────────────

let chartInstance = null;

const CHART_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#9966FF', '#FF9F40', '#C9CBCF', '#E7E9ED',
];

/**
 * Aggregate transaction amounts by category.
 * Requirements: 4.1, 4.2
 * @param {object[]} transactions
 * @returns {{ labels: string[], data: number[] }}
 */
function buildChartData(transactions) {
  const totals = {};
  for (const t of transactions) {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  }
  const labels = Object.keys(totals);
  const data = labels.map(label => Math.round(totals[label] * 100) / 100);
  return { labels, data };
}

/**
 * Render (or update) the spending pie chart.
 * Requirements: 4.2, 4.3, 4.4
 */
function renderChart() {
  const canvas = document.getElementById('spending-chart');
  const placeholder = document.getElementById('chart-placeholder');

  if (typeof window.Chart === 'undefined') {
    canvas.style.display = 'none';
    placeholder.style.display = '';
    placeholder.textContent = 'Chart unavailable – could not load Chart.js.';
    return;
  }

  if (state.transactions.length === 0) {
    canvas.style.display = 'none';
    placeholder.style.display = '';
    placeholder.textContent = 'No data to display. Add a transaction to see your spending chart.';
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  placeholder.style.display = 'none';
  canvas.style.display = '';

  const { labels, data } = buildChartData(state.transactions);
  const backgroundColors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = backgroundColors;
    chartInstance.update();
  } else {
    chartInstance = new window.Chart(canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: backgroundColors,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
        },
      },
    });
  }
}

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * Render the category options into the #item-category select element.
 * Preserves the first placeholder option and rebuilds the rest from state.
 * Requirements: 6.1, 6.2, 6.4
 */
function renderCategoryOptions() {
  const select = document.getElementById('item-category');
  if (!select) return;

  // Remove all options except the first placeholder
  while (select.options.length > 1) {
    select.remove(1);
  }

  for (const category of state.categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  }
}

/**
 * Handle adding a new custom category.
 * Requirements: 6.2, 6.3, 6.5
 */
function handleAddCategory() {
  const input = document.getElementById('new-category');
  const errorEl = document.getElementById('category-error');
  const name = input.value;

  const { valid, error } = validateCategory(name, state.categories);

  if (!valid) {
    errorEl.textContent = error;
    return;
  }

  setState({ categories: [...state.categories, name.trim()] });

  errorEl.textContent = '';
  input.value = '';
}

// ─── Monthly summary ───────────────────────────────────────────────────────────

/**
 * Group transactions by calendar month/year and compute totals.
 * Requirements: 7.1, 7.2, 7.3
 * @param {object[]} transactions
 * @returns {{ monthKey: string, label: string, total: number, byCategory: object }[]}
 */
function buildMonthlySummary(transactions) {
  const buckets = {};

  for (const t of transactions) {
    const date = new Date(t.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!buckets[monthKey]) {
      buckets[monthKey] = {
        monthKey,
        label: date.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
        total: 0,
        byCategory: {},
      };
    }

    buckets[monthKey].total = Math.round((buckets[monthKey].total + t.amount) * 100) / 100;
    buckets[monthKey].byCategory[t.category] =
      Math.round(((buckets[monthKey].byCategory[t.category] || 0) + t.amount) * 100) / 100;
  }

  return Object.values(buckets).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

/**
 * Render the monthly summary into #summary-content.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
function renderSummary() {
  const content = document.getElementById('summary-content');
  if (!content) return;

  if (!state.summaryVisible) return;

  if (state.transactions.length === 0) {
    content.innerHTML = '<p class="empty-state">No transactions available.</p>';
    return;
  }

  const months = buildMonthlySummary(state.transactions);

  content.innerHTML = months
    .map(({ label, total, byCategory }) => {
      const categoryItems = Object.entries(byCategory)
        .map(([cat, amount]) => `<li><span>${cat}</span><span>${formatCurrency(amount)}</span></li>`)
        .join('');
      return `<article>
  <h3>${label}</h3>
  <p class="month-total">Total: ${formatCurrency(total)}</p>
  <ul>${categoryItems}</ul>
</article>`;
    })
    .join('');
}

/**
 * Toggle the monthly summary visibility.
 * Requirements: 7.4, 7.5
 */
function handleToggleSummary() {
  const newVisible = !state.summaryVisible;
  setState({ summaryVisible: newVisible });

  const btn = document.getElementById('toggle-summary');
  const content = document.getElementById('summary-content');

  if (btn) {
    btn.textContent = newVisible ? 'Hide Monthly Summary' : 'Show Monthly Summary';
    btn.setAttribute('aria-expanded', String(newVisible));
  }

  if (content) {
    if (newVisible) {
      content.removeAttribute('hidden');
    } else {
      content.setAttribute('hidden', '');
    }
  }
}

// ─── Init ───

function init() {
  loadState();
  renderAll();
  document.getElementById('transaction-form').addEventListener('submit', handleAddTransaction);
  document.getElementById('sort-control').addEventListener('change', handleSortChange);
  document.getElementById('add-category-btn').addEventListener('click', handleAddCategory);
  document.getElementById('toggle-summary').addEventListener('click', handleToggleSummary);
}

document.addEventListener('DOMContentLoaded', init);
