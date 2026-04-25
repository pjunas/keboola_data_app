// Data App frontend logic

const TABLES = {
  dailySales: 'report_daily_sales',
  revenueByProduct: 'report_revenue_by_product',
  salesByCategory: 'report_sales_by_category',
  lowStock: 'report_low_stock_warning',
  customers: 'report_customer_segments'
};

const charts = {};
const dataCache = {};

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Fetch data from server
async function fetchTable(tableName) {
  if (dataCache[tableName]) return dataCache[tableName];
  
  const res = await fetch(`/api/data/${tableName}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to load ${tableName}: ${err.error}`);
  }
  const json = await res.json();
  dataCache[tableName] = json.data;
  return json.data;
}

// Format currency
function formatCurrency(val) {
  if (val == null || val === '') return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format number
function formatNumber(val) {
  if (val == null || val === '') return '-';
  return parseInt(val).toLocaleString('en-US');
}

// Render simple table
function renderTable(tableEl, data, columns) {
  if (!data || data.length === 0) {
    tableEl.innerHTML = '<tr><td>No data</td></tr>';
    return;
  }
  const head = '<thead><tr>' + columns.map(c => `<th>${c.label}</th>`).join('') + '</tr></thead>';
  const body = '<tbody>' + data.map(row => {
    return '<tr>' + columns.map(c => {
      const val = row[c.field];
      const formatted = c.format ? c.format(val) : (val ?? '-');
      return `<td>${formatted}</td>`;
    }).join('') + '</tr>';
  }).join('') + '</tbody>';
  tableEl.innerHTML = head + body;
}

// Daily Sales tab
async function loadDailySales() {
  const data = await fetchTable(TABLES.dailySales);
  
  const dateRangeEl = document.getElementById('date-range');
  
  function render() {
    const range = dateRangeEl.value;
    let filtered = [...data].sort((a, b) => a.order_date.localeCompare(b.order_date));
    
    if (range !== 'all') {
      const days = parseInt(range);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      filtered = filtered.filter(r => r.order_date >= cutoffStr);
    }
    
    // Chart
    const ctx = document.getElementById('daily-sales-chart');
    if (charts.dailySales) charts.dailySales.destroy();
    charts.dailySales = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filtered.map(r => r.order_date),
        datasets: [{
          label: 'Daily revenue',
          data: filtered.map(r => parseFloat(r.total_revenue) || 0),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } }
      }
    });
    
    // Table
    renderTable(
      document.getElementById('daily-sales-table'),
      filtered.slice().reverse().slice(0, 50),
      [
        { field: 'order_date', label: 'Date' },
        { field: 'order_count', label: 'Orders', format: formatNumber },
        { field: 'unique_customers', label: 'Unique customers', format: formatNumber },
        { field: 'total_units', label: 'Units sold', format: formatNumber },
        { field: 'total_revenue', label: 'Revenue', format: formatCurrency }
      ]
    );
  }
  
  dateRangeEl.addEventListener('change', render);
  render();
}

// Revenue by Product tab
async function loadRevenueByProduct() {
  const data = await fetchTable(TABLES.revenueByProduct);
  
  const topNEl = document.getElementById('top-n');
  const sortByEl = document.getElementById('sort-by');
  
  function render() {
    const topN = topNEl.value;
    const sortBy = sortByEl.value;
    
    let sorted = [...data].sort((a, b) => parseFloat(b[sortBy]) - parseFloat(a[sortBy]));
    if (topN !== 'all') {
      sorted = sorted.slice(0, parseInt(topN));
    }
    
    // Chart (bar, top 10 only for readability)
    const chartData = sorted.slice(0, 10);
    const ctx = document.getElementById('revenue-product-chart');
    if (charts.revenueProduct) charts.revenueProduct.destroy();
    charts.revenueProduct = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.map(r => r.product_name || r.product_id),
        datasets: [{
          label: sortBy === 'total_revenue' ? 'Revenue' : 'Units sold',
          data: chartData.map(r => parseFloat(r[sortBy]) || 0),
          backgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y'
      }
    });
    
    // Table
    renderTable(
      document.getElementById('revenue-product-table'),
      sorted,
      [
        { field: 'product_id', label: 'Product ID' },
        { field: 'product_name', label: 'Name' },
        { field: 'category_name_normalized', label: 'Category' },
        { field: 'order_count', label: 'Orders', format: formatNumber },
        { field: 'total_units_sold', label: 'Units sold', format: formatNumber },
        { field: 'total_revenue', label: 'Revenue', format: formatCurrency }
      ]
    );
  }
  
  topNEl.addEventListener('change', render);
  sortByEl.addEventListener('change', render);
  render();
}

// Sales by Category tab
async function loadSalesByCategory() {
  const data = await fetchTable(TABLES.salesByCategory);
  const sorted = [...data].sort((a, b) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue));
  
  const ctx = document.getElementById('sales-category-chart');
  if (charts.salesCategory) charts.salesCategory.destroy();
  charts.salesCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(r => r.category_name || r.category_name_normalized),
      datasets: [{
        data: sorted.map(r => parseFloat(r.total_revenue) || 0),
        backgroundColor: [
          '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#9333ea',
          '#0891b2', '#ca8a04', '#db2777', '#65a30d', '#7c3aed',
          '#0369a1', '#be123c', '#15803d', '#a16207', '#6366f1',
          '#059669', '#c2410c', '#7e22ce', '#0e7490', '#b91c1c'
        ]
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
  
  renderTable(
    document.getElementById('sales-category-table'),
    sorted,
    [
      { field: 'category_name', label: 'Category' },
      { field: 'order_count', label: 'Orders', format: formatNumber },
      { field: 'total_units_sold', label: 'Units sold', format: formatNumber },
      { field: 'total_revenue', label: 'Revenue', format: formatCurrency }
    ]
  );
}

// Low Stock tab
async function loadLowStock() {
  const data = await fetchTable(TABLES.lowStock);
  const showOnlyWarnings = document.getElementById('show-only-warnings');
  
  function render() {
    let filtered = [...data];
    if (showOnlyWarnings.checked) {
      filtered = filtered.filter(r => r.needs_reorder === 'true' || r.needs_reorder === true);
    }
    filtered.sort((a, b) => parseFloat(a.current_stock) - parseFloat(b.current_stock));
    
    renderTable(
      document.getElementById('low-stock-table'),
      filtered,
      [
        { field: 'product_id', label: 'Product ID' },
        { field: 'product_name', label: 'Name' },
        { field: 'category_name_normalized', label: 'Category' },
        { field: 'initial_stock', label: 'Initial stock', format: formatNumber },
        { field: 'units_in_carts', label: 'In carts', format: formatNumber },
        { field: 'current_stock', label: 'Current stock', format: formatNumber },
        { field: 'reorder_threshold', label: 'Threshold', format: formatNumber },
        { field: 'needs_reorder', label: 'Reorder?', format: v => (v === 'true' || v === true) ? 'YES' : 'no' }
      ]
    );
  }
  
  showOnlyWarnings.addEventListener('change', render);
  render();
}

// Customer Segments tab
async function loadCustomers() {
  const data = await fetchTable(TABLES.customers);
  
  const total = data.length;
  const newCount = data.filter(r => r.customer_type === 'New').length;
  const returningCount = data.filter(r => r.customer_type === 'Returning').length;
  
  document.getElementById('kpi-total-customers').textContent = formatNumber(total);
  document.getElementById('kpi-new').textContent = formatNumber(newCount);
  document.getElementById('kpi-returning').textContent = formatNumber(returningCount);
  
  const ctx = document.getElementById('customers-chart');
  if (charts.customers) charts.customers.destroy();
  charts.customers = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['New', 'Returning'],
      datasets: [{
        data: [newCount, returningCount],
        backgroundColor: ['#2563eb', '#16a34a']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// Initial load
async function init() {
  const loading = document.getElementById('loading');
  loading.classList.remove('hidden');
  
  try {
    await Promise.all([
      loadDailySales(),
      loadRevenueByProduct(),
      loadSalesByCategory(),
      loadLowStock(),
      loadCustomers()
    ]);
  } catch (err) {
    console.error(err);
    alert('Error loading data: ' + err.message);
  } finally {
    loading.classList.add('hidden');
  }
}

init();
