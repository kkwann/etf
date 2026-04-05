const DATA_URL = "./data/dashboard_data.json";

const FALLBACK_DATA = {
  meta: {
    title: "ETF Scoring Explorer",
    source: "embedded example",
    generated_at: "2026-04-02T20:30:00+09:00",
  },
  columns: ["Ticker", "Name", "method1", "method2", "method3", "method4", "method5", "method6", "total"],
  rows: [
    { Ticker: "QQQ", Name: "Invesco QQQ Trust", method1: 91, method2: 87, method3: 89, method4: 90, method5: 84, method6: 93, total: 89.0 },
    { Ticker: "SOXX", Name: "iShares Semiconductor ETF", method1: 88, method2: 90, method3: 86, method4: 89, method5: 85, method6: 92, total: 88.3 },
    { Ticker: "SCHD", Name: "Schwab U.S. Dividend Equity ETF", method1: 85, method2: 86, method3: 81, method4: 88, method5: 87, method6: 83, total: 85.0 },
    { Ticker: "VTI", Name: "Vanguard Total Stock Market ETF", method1: 81, method2: 79, method3: 82, method4: 80, method5: 77, method6: 84, total: 80.5 },
    { Ticker: "SPY", Name: "SPDR S&P 500 ETF Trust", method1: 78, method2: 76, method3: 79, method4: 81, method5: 75, method6: 80, total: 78.2 },
    { Ticker: "IWM", Name: "iShares Russell 2000 ETF", method1: 72, method2: 74, method3: 70, method4: 73, method5: 71, method6: 69, total: 71.5 },
    { Ticker: "XLK", Name: "Technology Select Sector SPDR Fund", method1: 87, method2: 88, method3: 85, method4: 86, method5: 84, method6: 89, total: 86.5 },
    { Ticker: "VUG", Name: "Vanguard Growth ETF", method1: 83, method2: 82, method3: 84, method4: 85, method5: 80, method6: 86, total: 83.3 }
  ]
};

const state = {
  payload: null,
  search: "",
  sort: "total-desc",
  minScore: 0,
  selectedTicker: null,
};

const AUTO_REFRESH_MS = 10000;

const elements = {
  pageTitle: document.getElementById("page-title"),
  sourceLabel: document.getElementById("source-label"),
  updatedAt: document.getElementById("updated-at"),
  visibleCount: document.getElementById("visible-count"),
  topTicker: document.getElementById("top-ticker"),
  topScore: document.getElementById("top-score"),
  avgScore: document.getElementById("avg-score"),
  searchInput: document.getElementById("search-input"),
  sortSelect: document.getElementById("sort-select"),
  minScoreRange: document.getElementById("min-score-range"),
  minScoreValue: document.getElementById("min-score-value"),
  resetButton: document.getElementById("reset-button"),
  tableHead: document.getElementById("table-head"),
  tableBody: document.getElementById("table-body"),
  detailTicker: document.getElementById("detail-ticker"),
  detailName: document.getElementById("detail-name"),
  detailGrid: document.getElementById("detail-grid"),
};

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(value);
}

function compareRows(left, right) {
  if (state.sort === "ticker-asc") {
    return String(left.Ticker).localeCompare(String(right.Ticker));
  }
  if (state.sort === "ticker-desc") {
    return String(right.Ticker).localeCompare(String(left.Ticker));
  }
  if (state.sort === "total-asc") {
    return Number(left.total || 0) - Number(right.total || 0);
  }
  return Number(right.total || 0) - Number(left.total || 0);
}

function getFilteredRows() {
  const rows = state.payload?.rows || [];
  const query = state.search.trim().toUpperCase();

  return rows
    .filter((row) => {
      const ticker = String(row.Ticker || "").toUpperCase();
      const name = String(row.Name || "").toUpperCase();
      return ticker.includes(query) || name.includes(query);
    })
    .filter((row) => Number(row.total || 0) >= state.minScore)
    .slice()
    .sort(compareRows);
}

function renderSummary() {
  const payload = state.payload;
  const rows = getFilteredRows();
  const topRow = rows[0];
  const avg = rows.length ? rows.reduce((sum, row) => sum + Number(row.total || 0), 0) / rows.length : 0;

  elements.pageTitle.textContent = payload?.meta?.title || "ETF Scoring Explorer";
  elements.sourceLabel.textContent = payload?.meta?.source || "example";
  elements.updatedAt.textContent = payload?.meta?.generated_at || "-";
  elements.visibleCount.textContent = String(rows.length);
  elements.topTicker.textContent = topRow?.Ticker || "-";
  elements.topScore.textContent = topRow ? formatNumber(topRow.total) : "-";
  elements.avgScore.textContent = rows.length ? formatNumber(avg) : "-";
  elements.minScoreValue.textContent = String(state.minScore);
}

function renderTable() {
  const columns = state.payload?.columns || [];
  const rows = getFilteredRows();

  elements.tableHead.innerHTML = `<tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr>`;

  if (!rows.length) {
    elements.tableBody.innerHTML = `<tr><td colspan="${columns.length || 9}">No ETFs match the current search and filter.</td></tr>`;
    return;
  }

  elements.tableBody.innerHTML = rows
    .map((row) => {
      const cells = columns.map((column) => {
        if (column === "Ticker") {
          return `<td class="ticker-cell">${row[column]}</td>`;
        }
        if (column === "Name") {
          return `<td class="name-cell">${row[column]}</td>`;
        }
        if (column === "total") {
          return `<td class="score-cell"><span class="score-chip">${formatNumber(row[column])}</span></td>`;
        }
        return `<td>${formatNumber(row[column])}</td>`;
      }).join("");

      const activeClass = state.selectedTicker === row.Ticker ? "active" : "";
      return `<tr class="clickable-row ${activeClass}" data-ticker="${row.Ticker}">${cells}</tr>`;
    })
    .join("");

  Array.from(elements.tableBody.querySelectorAll("tr[data-ticker]")).forEach((tableRow) => {
    tableRow.addEventListener("click", () => {
      state.selectedTicker = tableRow.dataset.ticker;
      renderTable();
      renderDetail();
    });
  });
}

function renderDetail() {
  const selected = getFilteredRows().find((row) => row.Ticker === state.selectedTicker);

  if (!selected) {
    elements.detailTicker.textContent = "-";
    elements.detailName.textContent = "Select a row in the table.";
    elements.detailGrid.innerHTML = "";
    return;
  }

  elements.detailTicker.textContent = selected.Ticker;
  elements.detailName.textContent = selected.Name || "";

  const metricKeys = ["method1", "method2", "method3", "method4", "method5", "method6", "total"];
  elements.detailGrid.innerHTML = metricKeys
    .map((key) => {
      const numericValue = Number(selected[key] || 0);
      return `
        <div class="detail-item">
          <span>${key}</span>
          <strong>${formatNumber(selected[key])}</strong>
          <div class="detail-bar"><span style="width:${Math.max(0, Math.min(100, numericValue))}%"></span></div>
        </div>
      `;
    })
    .join("");
}

function syncSelection() {
  const rows = getFilteredRows();
  const exists = rows.some((row) => row.Ticker === state.selectedTicker);
  if (!exists) {
    state.selectedTicker = rows[0]?.Ticker || null;
  }
}

function rerender() {
  syncSelection();
  renderSummary();
  renderTable();
  renderDetail();
}

async function loadData() {
  try {
    const response = await fetch(`${DATA_URL}?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    state.payload = await response.json();
  } catch (error) {
    state.payload = FALLBACK_DATA;
    console.error(error);
  }

  rerender();
}

window.setInterval(() => {
  loadData();
}, AUTO_REFRESH_MS);

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value || "";
  rerender();
});

elements.sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  rerender();
});

elements.minScoreRange.addEventListener("input", (event) => {
  state.minScore = Number(event.target.value || 0);
  rerender();
});

elements.resetButton.addEventListener("click", () => {
  state.search = "";
  state.sort = "total-desc";
  state.minScore = 0;
  elements.searchInput.value = "";
  elements.sortSelect.value = state.sort;
  elements.minScoreRange.value = "0";
  rerender();
});

loadData();
