"use strict";

const THEME_STORAGE_KEY = "stockDashboardTheme";
const LOCAL_DASHBOARD_URL = "http://127.0.0.1:8765/";
const ALL_FILTER = "__ALL__";
const MAIN_PERIOD = "10y";
const PERIOD_DETAIL_ORDER = ["1y", "3y", "5y", "10y"];
const DATASET_MAIN_PERIODS = {
  ETF: "10y",
  NASDAQ: "5y",
  SP500: "5y",
  KRX: "5y"
};
const DATASET_PERIOD_DETAIL_ORDERS = {
  ETF: ["1y", "3y", "5y", "10y"],
  NASDAQ: ["1y", "3y", "5y"],
  SP500: ["1y", "3y", "5y"],
  KRX: ["1y", "3y", "5y"]
};
const DATASET_ALLOWED_PERIODS = {
  NASDAQ: new Set(["1y", "3y", "5y"]),
  SP500: new Set(["1y", "3y", "5y"]),
  KRX: new Set(["1y", "3y", "5y"])
};
const HIDDEN_COLUMNS_BY_DATASET = {
  NASDAQ: new Set(["Trend"]),
  SP500: new Set(["Trend"]),
  KRX: new Set(["Trend"])
};
const DATASET_KEYS = ["ETF", "NASDAQ", "SP500", "KRX"];
const GRADE_ORDER = ["Best", "Good", "Normal", "Bad"];
const PREFERRED_DEFAULT_PERIODS = [MAIN_PERIOD, "total", "all", "5y", "3y", "1y"];
const PREFERRED_DEFAULT_PERIODS_BY_DATASET = {
  ETF: ["10y", "total", "all", "5y", "3y", "1y"],
  NASDAQ: ["5y", "3y", "1y"],
  SP500: ["5y", "3y", "1y"],
  KRX: ["5y", "3y", "1y"]
};
const MAX_GROUP_DISTRIBUTION_ITEMS = 5;
const PERCENT_COLUMNS = new Set(["Total Return", "CAGR", "MDD"]);
const KNOWN_NUMERIC_COLUMNS = new Set([
  "Total Return",
  "CAGR",
  "Sharpe",
  "MDD",
  "Calmar",
  "Return",
  "Score",
  "Score1",
  "Score2",
  "Score3"
]);
const DETAIL_METRIC_COLUMNS = [
  "Total Return",
  "CAGR",
  "Sharpe",
  "MDD",
  "Calmar",
  "Return",
  "Score",
  "Score1",
  "Score2",
  "Score3"
];
const DATE_COLUMNS = new Set(["first_date", "last_date"]);
const TEXT_DEFAULT_ASC_COLUMNS = new Set(["Ticker", "Name", "Category", "Sector", "Industry", "first_date", "last_date"]);
const ROUTING_COLUMNS = new Set([
  "asset_type",
  "Asset Type",
  "AssetType",
  "assetType",
  "dataset",
  "Dataset",
  "type",
  "Type",
  "market",
  "Market"
]);
const DEFAULT_COLUMNS = [
  "Ticker",
  "Category",
  "period",
  "first_date",
  "last_date",
  "Total Return",
  "CAGR",
  "Sharpe",
  "MDD",
  "Calmar",
  "Grade",
  "Score1",
  "Score2",
  "Score3"
];
const EQUITY_DEFAULT_COLUMNS = [
  "Ticker",
  "Sector",
  "Industry",
  "period",
  "first_date",
  "last_date",
  "Total Return",
  "CAGR",
  "Sharpe",
  "MDD",
  "Calmar",
  "Grade",
  "Return"
];
const DEFAULT_COLUMNS_BY_DATASET = {
  ETF: DEFAULT_COLUMNS,
  NASDAQ: EQUITY_DEFAULT_COLUMNS,
  SP500: EQUITY_DEFAULT_COLUMNS,
  KRX: EQUITY_DEFAULT_COLUMNS
};
const COLUMN_LABELS = {
  Ticker: "티커",
  Name: "종목명",
  Category: "카테고리",
  Sector: "섹터",
  Industry: "산업",
  period: "기간",
  first_date: "거래시작일",
  last_date: "거래종료일",
  "Total Return": "총수익률",
  CAGR: "연평균수익률",
  Sharpe: "샤프지수",
  MDD: "최대낙폭",
  Calmar: "칼마지수",
  Grade: "등급",
  Return: "수익률",
  Trend: "추세",
  Score: "점수",
  Score1: "점수1",
  Score2: "점수2",
  Score3: "점수3"
};
const DATASET_META = {
  ETF: {
    label: "ETF",
    tableLabel: "ETF",
    title: "ETF 성과 대시보드",
    description: "Yahoo Finance 기준 기간별 ETF 성과와 등급을 확인합니다.",
    emptyText: "ETF 데이터가 없습니다."
  },
  NASDAQ: {
    label: "나스닥",
    tableLabel: "나스닥",
    title: "나스닥 성과 대시보드",
    description: "Yahoo Finance 기준 기간별 나스닥 종목 성과와 등급을 확인합니다.",
    emptyText: "나스닥 데이터가 없습니다. data.json에 NASDAQ 배열을 추가하면 표시됩니다."
  },
  SP500: {
    label: "S&P500",
    tableLabel: "S&P500",
    title: "S&P500 성과 대시보드",
    description: "Yahoo Finance 기준 기간별 S&P500 종목 성과와 등급을 확인합니다.",
    emptyText: "S&P500 데이터가 없습니다. data.json에 SP500 배열을 추가하면 표시됩니다."
  },
  KRX: {
    label: "KRX",
    tableLabel: "KRX",
    title: "KRX 성과 대시보드",
    description: "Yahoo Finance 기준 기간별 KRX 종목 성과와 등급을 확인합니다.",
    emptyText: "KRX 데이터가 없습니다. data.json에 KRX 배열을 추가하면 표시됩니다."
  }
};

let rowsByDataset = {
  ETF: [],
  NASDAQ: [],
  SP500: [],
  KRX: []
};
let marketItems = [];
let activeDataset = "ETF";
let rawRows = [];
let columns = DEFAULT_COLUMNS.slice();
let visibleRows = [];
let tableSort = {
  key: "CAGR",
  direction: "desc"
};
let defaultPeriod = MAIN_PERIOD;

const dom = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    cacheDom();
    if (redirectFileProtocolToLocalServer()) {
      return;
    }
    initializeTheme();
    bindEvents();
    showStatus("Yahoo Finance 데이터를 불러오는 중입니다...");

    const dataResult = await loadJson();
    rowsByDataset = normalizeDatasets(dataResult.json);
    marketItems = normalizeMarketItems(dataResult.json);

    updateDataSourceMeta(dataResult.lastModified);
    renderMarketOverview();
    activateDataset("ETF", false);
    hideStatus();
  } catch (error) {
    console.error("[Dashboard Error]", error);
    showError(error);
  }
}

function redirectFileProtocolToLocalServer() {
  if (window.location.protocol !== "file:") {
    return false;
  }

  showStatus("file:// 주소에서는 data.json을 읽을 수 없어 HTTP 서버 주소로 이동합니다...");
  window.location.replace(LOCAL_DASHBOARD_URL);
  return true;
}

function cacheDom() {
  [
    "dashboardTitle",
    "dashboardDescription",
    "statusBox",
    "themeToggle",
    "themeToggleLabel",
    "dataSourceName",
    "lastUpdated",
    "marketOverview",
    "marketCards",
    "assetTabs",
    "searchInput",
    "periodFilter",
    "gradeFilter",
    "sortSelect",
    "resetButton",
    "kpiCards",
    "gradeSummaryText",
    "gradeCounts",
    "gradeRatio",
    "groupDistributionTitle",
    "periodSummaryText",
    "periodCounts",
    "periodRatio",
    "tableTitle",
    "tableSubtitle",
    "rowCount",
    "mainTable",
    "tableHead",
    "tableBody",
    "detailDrawer",
    "closeDrawer",
    "overlay",
    "detailTicker",
    "detailSub",
    "detailBadges",
    "periodSummaryCards",
    "periodMetricBars"
  ].forEach(function (id) {
    dom[id] = document.getElementById(id);
  });

  const missingIds = Object.keys(dom).filter(function (id) {
    return !dom[id];
  });

  if (missingIds.length > 0) {
    throw new Error("index.html에서 필요한 요소를 찾을 수 없습니다: " + missingIds.join(", "));
  }
}

function bindEvents() {
  dom.searchInput.addEventListener("input", function () {
    renderDashboard();
    closeDrawer();
  });
  dom.periodFilter.addEventListener("change", function () {
    renderDashboard();
    closeDrawer();
  });
  dom.gradeFilter.addEventListener("change", function () {
    renderDashboard();
    closeDrawer();
  });
  dom.sortSelect.addEventListener("change", function () {
    const nextSort = parseSortValue(dom.sortSelect.value);

    if (nextSort) {
      tableSort = nextSort;
      renderDashboard();
    }
  });
  dom.resetButton.addEventListener("click", resetFilters);
  dom.themeToggle.addEventListener("click", toggleTheme);
  dom.closeDrawer.addEventListener("click", closeDrawer);
  dom.overlay.addEventListener("click", closeDrawer);
  dom.mainTable.addEventListener("click", handleSortHeaderEvent);
  dom.mainTable.addEventListener("keydown", handleSortHeaderEvent);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeDrawer();
    }
  });
}

function activateDataset(datasetKey, preserveSearch) {
  activeDataset = DATASET_META[datasetKey] ? datasetKey : "ETF";
  rawRows = rowsByDataset[activeDataset] || [];
  columns = inferColumns(rawRows);

  if (!preserveSearch) {
    dom.searchInput.value = "";
  }

  applyDatasetCopy();
  renderAssetTabs();
  setupControls();
  renderTableHead();
  closeDrawer();
  renderDashboard();
}

function applyDatasetCopy() {
  const meta = DATASET_META[activeDataset];

  dom.dashboardTitle.textContent = meta.title;
  dom.dashboardDescription.textContent = meta.description;
  dom.searchInput.placeholder = activeDataset === "ETF"
    ? "티커, 카테고리, 기간, 등급 검색"
    : "티커, 종목명, 섹터, 기간, 등급 검색";
}

function renderMarketOverview() {
  if (!marketItems.length) {
    dom.marketOverview.classList.add("hidden");
    dom.marketCards.innerHTML = "";
    return;
  }

  dom.marketOverview.classList.remove("hidden");
  dom.marketCards.innerHTML = marketItems.map(renderMarketCard).join("");
}

function renderMarketCard(item) {
  const name = marketDisplayName(item);
  const valueText = marketDisplayValue(item);
  const description = marketDisplayDescription(item);
  const useDescriptionBadge = shouldUseMarketDescriptionBadge(item);
  const trend = useDescriptionBadge ? "" : marketDisplayTrend(item);
  const detailText = marketDisplayDetail(item);

  return ""
    + '<article class="market-card ' + (useDescriptionBadge ? "market-unknown" : marketTrendCardClass(trend)) + '">'
    + '<div class="market-card-top">'
    + '<span>' + escapeHtml(name) + '</span>'
    + (useDescriptionBadge ? marketDescriptionBadge(description) : marketTrendBadge(trend))
    + '</div>'
    + '<strong>' + escapeHtml(valueText) + '</strong>'
    + (detailText ? '<div class="market-card-bottom"><small>' + escapeHtml(detailText) + '</small></div>' : "")
    + '</article>';
}

function marketDisplayName(item) {
  const explicitName = cleanText(read(item, ["Name", "name", "Label", "label", "Title", "title"]));
  const ticker = cleanText(read(item, ["Ticker", "ticker", "Symbol", "symbol"]));

  if (explicitName) return explicitName;
  if (ticker === "KQ11") return "코스닥";
  if (ticker === "KS11") return "코스피";
  if (ticker === "^GSPC") return "S&P500";
  if (ticker === "^IXIC") return "나스닥";

  return ticker || "-";
}

function marketDisplaySymbol(item) {
  const ticker = cleanText(read(item, ["Ticker", "ticker", "Symbol", "symbol"]));

  if (ticker === "KQ11") return "KOSDAQ";
  if (ticker === "KS11") return "KOSPI";
  if (ticker === "^GSPC") return "S&P 500";
  if (ticker === "^IXIC") return "NASDAQ Composite";

  return ticker;
}

function marketDisplayValue(item) {
  const adjClose = read(item, ["Adj Close", "adj_close", "AdjClose", "adjClose"]);
  const value = read(item, ["Value", "value", "Close", "close"]);
  const unit = read(item, ["Unit", "unit"]);
  const ticker = cleanText(read(item, ["Ticker", "ticker", "Symbol", "symbol"]));

  if (ticker && !isBlank(adjClose)) {
    return formatMarketValue(adjClose, unit);
  }

  if (!isBlank(value)) {
    return formatMarketValue(value, unit);
  }

  return "-";
}

function marketDisplayState(item) {
  const ticker = cleanText(read(item, ["Ticker", "ticker", "Symbol", "symbol"]));
  const state = cleanText(read(item, ["State", "state", "Status", "status", "description", "Description"]));

  if (!ticker && state) {
    return "";
  }

  if (state === "fear") return "Fear";
  if (state === "greed") return "Greed";

  return state;
}

function marketDisplayDescription(item) {
  return cleanText(read(item, ["description", "Description", "State", "state", "Status", "status"])) || "-";
}

function shouldUseMarketDescriptionBadge(item) {
  const ticker = cleanText(read(item, ["Ticker", "ticker", "Symbol", "symbol"]));
  const description = marketDisplayDescription(item);

  return !ticker && description !== "-";
}

function marketDisplayTrend(item) {
  const explicitTrend = read(item, ["Trend", "trend", "Direction", "direction"]);

  if (!isBlank(explicitTrend)) {
    return normalizeTrend(explicitTrend);
  }

  const description = cleanText(read(item, ["description", "Description"])).toLowerCase();

  if (description.indexOf("fear") >= 0) return "하락";
  if (description.indexOf("greed") >= 0) return "상승";

  return "보합";
}

function marketDisplayDetail(item) {
  const ret1d = parseNumber(read(item, ["ret_1d", "Ret 1D"]));

  return Number.isFinite(ret1d) ? "ret_1d " + formatSignedNumber(ret1d) + "%" : "";
}

function formatMarketValue(value, unit) {
  if (isBlank(value)) {
    return "-";
  }

  const number = parseNumber(value);
  const unitText = cleanText(unit);
  const text = Number.isFinite(number)
    ? number.toLocaleString("ko-KR", {
      minimumFractionDigits: Math.abs(number) >= 100 ? 2 : 0,
      maximumFractionDigits: 2
    })
    : cleanText(value);

  return unitText ? text + unitText : text;
}

function formatMarketChange(change, changePercent) {
  const parts = [];
  const changeNumber = parseNumber(change);
  const percentNumber = parseNumber(changePercent);

  if (Number.isFinite(changeNumber)) {
    parts.push(formatSignedNumber(changeNumber));
  }

  if (Number.isFinite(percentNumber)) {
    parts.push(formatSignedNumber(percentNumber) + "%");
  }

  return parts.join(" / ");
}

function formatSignedNumber(value) {
  const number = parseNumber(value);

  if (!Number.isFinite(number)) {
    return cleanText(value);
  }

  return (number > 0 ? "+" : "") + number.toLocaleString("ko-KR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function marketTrendCardClass(trend) {
  const normalized = normalizeTrend(trend);

  if (normalized === "상승") return "market-up";
  if (normalized === "하락") return "market-down";
  if (normalized === "보합") return "market-flat";

  return "market-unknown";
}

function marketTrendBadge(trend) {
  const normalized = normalizeTrend(trend);
  let className = "trend-unknown";

  if (normalized === "상승") className = "trend-up";
  if (normalized === "하락") className = "trend-down";
  if (normalized === "보합") className = "trend-flat";

  return '<span class="market-trend market-trend-large ' + className + '">' + escapeHtml(normalized) + '</span>';
}

function marketDescriptionBadge(description) {
  return '<span class="market-trend market-description trend-unknown">' + escapeHtml(description || "-") + '</span>';
}

function renderAssetTabs() {
  dom.assetTabs.innerHTML = DATASET_KEYS.map(function (datasetKey) {
    const meta = DATASET_META[datasetKey];
    const isActive = datasetKey === activeDataset;
    const count = countDatasetTickers(datasetKey);

    return ""
      + '<button class="asset-tab' + (isActive ? " active" : "") + '" type="button" data-dataset="' + datasetKey + '" aria-pressed="' + String(isActive) + '">'
      + '<span>' + escapeHtml(meta.label) + '</span>'
      + '<strong>' + count.toLocaleString("ko-KR") + '</strong>'
      + '</button>';
  }).join("");

  dom.assetTabs.querySelectorAll(".asset-tab").forEach(function (button) {
    button.addEventListener("click", function () {
      activateDataset(button.dataset.dataset, false);
    });
  });
}

function countDatasetTickers(datasetKey) {
  const rows = rowsByDataset[datasetKey] || [];
  const tickers = new Set(
    rows.map(function (row) {
      return cleanText(row.Ticker);
    }).filter(Boolean)
  );

  return tickers.size || rows.length;
}

function initializeTheme() {
  const savedTheme = readStoredTheme();
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme || (prefersDark ? "dark" : "light");

  applyTheme(theme);
}

function readStoredTheme() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : "";
  } catch (error) {
    return "";
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  applyTheme(nextTheme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    // Theme persistence is optional.
  }
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  const isDark = normalized === "dark";

  document.documentElement.dataset.theme = normalized;
  dom.themeToggle.setAttribute("aria-pressed", String(isDark));
  dom.themeToggle.setAttribute("aria-label", isDark ? "라이트 모드로 전환" : "다크 모드로 전환");
  dom.themeToggleLabel.textContent = isDark ? "라이트" : "다크";
}

async function loadJson() {
  try {
    const response = await fetch("./data.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("data.json 로딩 실패: HTTP " + response.status);
    }

    return {
      json: await response.json(),
      lastModified: response.headers.get("last-modified")
    };
  } catch (error) {
    if (window.location.protocol === "file:") {
      throw new Error("file:// 주소에서는 data.json을 읽을 수 없습니다. HTTP 서버로 실행한 뒤 " + LOCAL_DASHBOARD_URL + " 로 접속해 주세요.");
    }

    throw error;
  }
}

function normalizeDatasets(json) {
  const datasets = {
    ETF: [],
    NASDAQ: [],
    SP500: [],
    KRX: []
  };

  if (Array.isArray(json)) {
    splitArrayRows(json, datasets);
    return finalizeDatasets(datasets);
  }

  if (!json || typeof json !== "object") {
    throw new Error("data.json은 배열이거나 ETF/NASDAQ/SP500/KRX 배열을 가진 객체여야 합니다.");
  }

  const etfRows = readDatasetArray(json, ["ETF", "etf", "ETFS", "etfs"]);
  const nasdaqRows = readDatasetArray(json, ["NASDAQ", "NASDAQ_STOCK", "NASDAQ_STOCKS", "nasdaq", "nasdaq_stock", "nasdaq_stocks", "나스닥"]);
  const sp500Rows = readDatasetArray(json, ["SP500", "S&P500", "SP_500", "SP500_STOCK", "SP500_STOCKS", "sp500", "s_p_500", "sp_500", "snp500", "SNP500", "S&P500_STOCKS"]);
  const krxRows = readDatasetArray(json, ["KRX", "krx", "KOREA", "korea", "KOREA_STOCK", "KOREA_STOCKS", "한국주식", "국내주식"]);

  if (etfRows.length > 0 || nasdaqRows.length > 0 || sp500Rows.length > 0 || krxRows.length > 0) {
    datasets.ETF = etfRows;
    datasets.NASDAQ = nasdaqRows;
    datasets.SP500 = sp500Rows;
    datasets.KRX = krxRows;
    return finalizeDatasets(datasets);
  }

  if (Array.isArray(json.items)) {
    splitArrayRows(json.items, datasets);
    return finalizeDatasets(datasets);
  }

  throw new Error("data.json에서 ETF, NASDAQ, SP500 또는 KRX 배열을 찾을 수 없습니다.");
}

function finalizeDatasets(datasets) {
  return {
    ETF: prepareRowsForDataset(datasets.ETF || [], "ETF"),
    NASDAQ: prepareRowsForDataset(datasets.NASDAQ || [], "NASDAQ"),
    SP500: prepareRowsForDataset(datasets.SP500 || [], "SP500"),
    KRX: prepareRowsForDataset(datasets.KRX || [], "KRX")
  };
}

function prepareRowsForDataset(rows, datasetKey) {
  const allowedPeriods = DATASET_ALLOWED_PERIODS[datasetKey];
  const hiddenColumns = HIDDEN_COLUMNS_BY_DATASET[datasetKey] || new Set();

  return sanitizeRows(rows)
    .filter(function (row) {
      if (!allowedPeriods) {
        return true;
      }

      return allowedPeriods.has(cleanText(row.period).toLowerCase());
    })
    .map(function (row) {
      const copy = {};

      Object.keys(row).forEach(function (key) {
        if (!hiddenColumns.has(key)) {
          copy[key] = row[key];
        }
      });

      return copy;
    });
}

function splitStockRowsByIndex(rows) {
  const result = {
    NASDAQ: [],
    SP500: [],
    KRX: []
  };

  sanitizeRows(rows).forEach(function (row) {
    const datasetKey = normalizeDatasetKey(
      read(row, ["Index", "index", "Benchmark", "benchmark", "Market", "market", "Dataset", "dataset"])
    );

    if (datasetKey === "SP500") {
      result.SP500.push(row);
    } else if (datasetKey === "KRX") {
      result.KRX.push(row);
    } else {
      result.NASDAQ.push(row);
    }
  });

  return result;
}

function readDatasetArray(json, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];

    if (Array.isArray(json[key])) {
      return json[key];
    }
  }

  return [];
}

function normalizeMarketItems(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return [];
  }

  return readDatasetArray(json, [
    "MARKET_INDICES",
    "MARKET_INDEXES",
    "market_indices",
    "market_indexes",
    "market",
    "indices"
  ]).map(function (item) {
    return item && typeof item === "object" && !Array.isArray(item) ? item : null;
  }).filter(Boolean);
}

function splitArrayRows(rows, datasets) {
  const cleanRows = sanitizeRows(rows);

  cleanRows.forEach(function (row) {
    const datasetKey = detectDataset(row);
    if (datasets[datasetKey]) {
      datasets[datasetKey].push(row);
    }
  });
}

function sanitizeRows(rows) {
  return rows.filter(function (row) {
    return row && typeof row === "object" && !Array.isArray(row);
  });
}

function detectDataset(row) {
  const explicitValue =
    read(row, ["asset_type", "Asset Type", "AssetType", "assetType", "dataset", "Dataset", "type", "Type"]) ||
    read(row, ["market", "Market"]);
  const normalized = normalizeDatasetKey(explicitValue);

  return normalized || "ETF";
}

function normalizeDatasetKey(value) {
  const text = cleanText(value).toLowerCase().replace(/[\s_-]+/g, "");

  if (!text) {
    return "";
  }

  if (text === "stock" || text === "stocks" || text === "usstock" || text === "usstocks" || text === "미국주식" || text === "usa" || text === "nasdaq" || text === "nasdaqstock" || text === "nasdaqstocks" || text === "ixic" || text === "^ixic" || text === "나스닥") {
    return "NASDAQ";
  }

  if (text === "sp500" || text === "spx" || text === "s&p500" || text === "snp500" || text === "sp500stock" || text === "sp500stocks" || text === "gspc" || text === "^gspc" || text === "s&p" || text === "s&p500지수") {
    return "SP500";
  }

  if (text === "krx" || text === "korea" || text === "koreastock" || text === "koreastocks" || text === "kospi" || text === "kosdaq" || text === "국내주식" || text === "한국주식") {
    return "KRX";
  }

  if (text === "etf" || text === "etfs") {
    return "ETF";
  }

  return "";
}

function updateDataSourceMeta(lastModified) {
  dom.dataSourceName.textContent = "Yahoo Finance";
  dom.lastUpdated.textContent = "마지막 업데이트: " + formatLastUpdated(lastModified);
}

function formatLastUpdated(lastModified) {
  const date = lastModified ? new Date(lastModified) : null;

  if (!date || !Number.isFinite(date.getTime())) {
    return "확인 불가";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
    timeZoneName: "short"
  }).format(date);
}

function setupControls() {
  setupPeriodFilter();
  setupGradeFilter();
  setupSortSelect();
}

function setupPeriodFilter() {
  const periodValues = uniqueValues(rawRows, "period").sort(comparePeriodsForOptions);
  defaultPeriod = chooseDefaultPeriod(periodValues);

  dom.periodFilter.innerHTML = "";
  appendOption(dom.periodFilter, ALL_FILTER, "전체 기간");

  periodValues.forEach(function (value) {
    appendOption(dom.periodFilter, value, labelPeriod(value));
  });

  dom.periodFilter.value = defaultPeriod;
}

function setupGradeFilter() {
  const gradeValues = uniqueValues(rawRows, "Grade");
  const orderedGrades = GRADE_ORDER.filter(function (grade) {
    return gradeValues.indexOf(grade) >= 0;
  });
  const extraGrades = gradeValues
    .filter(function (grade) {
      return orderedGrades.indexOf(grade) < 0;
    })
    .sort(textCompare);

  dom.gradeFilter.innerHTML = "";
  appendOption(dom.gradeFilter, ALL_FILTER, "전체 등급");

  orderedGrades.concat(extraGrades).forEach(function (grade) {
    appendOption(dom.gradeFilter, grade, grade);
  });
}

function setupSortSelect() {
  const defaultKey = columns.indexOf("CAGR") >= 0
    ? "CAGR"
    : columns.indexOf("Total Return") >= 0
      ? "Total Return"
      : columns[0];

  tableSort = {
    key: defaultKey,
    direction: defaultSortDirection(defaultKey)
  };

  dom.sortSelect.innerHTML = "";

  columns.forEach(function (column) {
    ["asc", "desc"].forEach(function (direction) {
      appendOption(
        dom.sortSelect,
        buildSortValue(column, direction),
        columnLabelText(column) + " " + sortDirectionLabel(column, direction)
      );
    });
  });

  syncSortSelect();
}

function appendOption(select, value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function inferColumns(rows) {
  const seen = new Set();
  const result = [];
  const hiddenColumns = HIDDEN_COLUMNS_BY_DATASET[activeDataset] || new Set();

  rows.forEach(function (row) {
    Object.keys(row).forEach(function (key) {
      if (!ROUTING_COLUMNS.has(key) && !hiddenColumns.has(key) && !seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    });
  });

  return result.length > 0 ? result : defaultColumnsForDataset(activeDataset);
}

function defaultColumnsForDataset(datasetKey) {
  const defaultColumns = DEFAULT_COLUMNS_BY_DATASET[datasetKey] || DEFAULT_COLUMNS;

  return defaultColumns.slice();
}

function renderTableHead() {
  const tr = document.createElement("tr");

  columns.forEach(function (column) {
    const th = document.createElement("th");
    const label = columnLabelParts(column);

    th.dataset.sortKey = column;
    th.tabIndex = 0;
    th.innerHTML = escapeHtml(label.ko) + "<br><span>" + escapeHtml(label.en) + "</span>";
    tr.appendChild(th);
  });

  dom.tableHead.innerHTML = "";
  dom.tableHead.appendChild(tr);
}

function renderDashboard() {
  visibleRows = getFilteredRows();
  visibleRows.sort(compareRows);

  updateTableCopy();
  updateSortHeaders();
  renderKpiCards(visibleRows);
  renderGradeDistribution(visibleRows);
  renderGroupDistribution(visibleRows);
  renderTable(visibleRows);
}

function getFilteredRows(options) {
  const ignorePeriod = options && options.ignorePeriod;
  const keyword = dom.searchInput.value.trim().toLowerCase();
  const period = dom.periodFilter.value;
  const grade = dom.gradeFilter.value;

  return rawRows.filter(function (row) {
    const matchesKeyword = !keyword || columns.some(function (column) {
      return cleanText(row[column]).toLowerCase().indexOf(keyword) >= 0;
    });
    const matchesPeriod =
      ignorePeriod ||
      period === ALL_FILTER ||
      cleanText(row.period) === period;
    const matchesGrade =
      grade === ALL_FILTER ||
      normalizeGrade(row.Grade) === grade;

    return matchesKeyword && matchesPeriod && matchesGrade;
  });
}

function updateTableCopy() {
  const meta = DATASET_META[activeDataset];
  const period = dom.periodFilter.value;
  const grade = dom.gradeFilter.value;
  const periodText = period === ALL_FILTER ? "전체 기간" : labelPeriod(period);
  const gradeText = grade === ALL_FILTER ? "전체 등급" : grade;
  const tickerCount = countUnique(visibleRows, "Ticker");

  dom.tableTitle.textContent = periodText + " " + meta.tableLabel + " 성과";
  dom.tableSubtitle.textContent =
    columns.length + "개 JSON 컬럼 기준 · " + gradeText + " · " +
    tickerCount.toLocaleString("ko-KR") + "개 티커";
  dom.rowCount.textContent = visibleRows.length.toLocaleString("ko-KR") + " rows";
}

function renderKpiCards(rows) {
  const numericColumns = columns.filter(function (column) {
    return isNumericColumn(column);
  });

  if (numericColumns.length === 0) {
    dom.kpiCards.innerHTML = "";
    return;
  }

  dom.kpiCards.innerHTML = numericColumns.map(function (column) {
    const value = average(rows, column);
    const valueHtml = value == null ? "-" : formatCellValue(column, value);

    return ""
      + '<article class="kpi-card">'
      + '<span>' + escapeHtml(columnLabelText(column)) + '</span>'
      + '<strong class="' + numberClass(value) + '">' + escapeHtml(valueHtml) + '</strong>'
      + '</article>';
  }).join("");
}

function renderGradeDistribution(rows) {
  if (columns.indexOf("Grade") < 0) {
    dom.gradeSummaryText.textContent = "Grade 컬럼이 없습니다.";
    dom.gradeCounts.innerHTML = "";
    dom.gradeRatio.innerHTML = "";
    return;
  }

  const counts = countByValue(rows, "Grade", normalizeGrade);
  const total = rows.length;
  const cards = [["전체", total, "total"]].concat(
    GRADE_ORDER.map(function (grade) {
      return [grade, counts.get(grade) || 0, grade.toLowerCase()];
    })
  );

  dom.gradeSummaryText.textContent =
    total.toLocaleString("ko-KR") + "개 행 기준 · " +
    countUnique(rows, "Ticker").toLocaleString("ko-KR") + "개 티커";
  dom.gradeCounts.innerHTML = cards.map(renderCountCard).join("");
  dom.gradeRatio.innerHTML = renderRatio(
    GRADE_ORDER.map(function (grade) {
      return ["ratio-" + grade.toLowerCase(), counts.get(grade) || 0];
    })
  );
}

function renderGroupDistribution(rows) {
  const config = activeDataset === "ETF"
    ? { title: "카테고리 분포", column: "Category", fallback: "", unit: "개 카테고리" }
    : { title: "산업 분포", column: "Industry", fallback: "Sector", unit: "개 산업" };
  const column = columns.indexOf(config.column) >= 0
    ? config.column
    : columns.indexOf(config.fallback) >= 0
      ? config.fallback
      : "";

  dom.groupDistributionTitle.textContent = config.title;

  if (!column) {
    dom.periodSummaryText.textContent = config.column + " 컬럼이 없습니다.";
    dom.periodCounts.innerHTML = "";
    dom.periodRatio.innerHTML = "";
    return;
  }

  const counts = countUniqueTickersByValue(rows, column);
  const groups = limitedDistributionGroups(counts, MAX_GROUP_DISTRIBUTION_ITEMS);
  const totalTickers = countUnique(rows, "Ticker");
  const groupCount = counts.size;
  const shownCount = Math.min(groupCount, MAX_GROUP_DISTRIBUTION_ITEMS);

  dom.periodSummaryText.textContent =
    totalTickers.toLocaleString("ko-KR") + "개 티커 기준 · " +
    groupCount.toLocaleString("ko-KR") + config.unit + " 중 상위 " +
    shownCount.toLocaleString("ko-KR") + "개" +
    (groups.length > shownCount ? " + 기타" : "");
  dom.periodCounts.innerHTML = groups.map(function (group) {
    return renderCountCard([group.label, group.count, "period " + group.cardClass]);
  }).join("");
  dom.periodRatio.innerHTML = renderRatio(
    groups.map(function (group) {
      return ["ratio-period-" + group.ratioClass, group.count || 0];
    })
  );
}

function limitedDistributionGroups(counts, limit) {
  const sorted = Array.from(counts.keys()).sort(function (a, b) {
    const diff = counts.get(b) - counts.get(a);
    return diff !== 0 ? diff : textCompare(a, b);
  });
  const top = sorted.slice(0, limit).map(function (group, index) {
    return {
      label: group,
      count: counts.get(group) || 0,
      cardClass: "group-" + (index + 1),
      ratioClass: String(index + 1)
    };
  });
  const otherCount = sorted.slice(limit).reduce(function (sum, group) {
    return sum + (counts.get(group) || 0);
  }, 0);

  if (otherCount > 0) {
    top.push({
      label: "기타",
      count: otherCount,
      cardClass: "group-other",
      ratioClass: "other"
    });
  }

  return top;
}

function renderCountCard(card) {
  const label = card[0];
  const count = card[1];
  const className = card[2];

  return ""
    + '<div class="count-card ' + escapeHtml(className) + '">'
    + '<span>' + escapeHtml(label) + '</span>'
    + '<strong>' + Number(count || 0).toLocaleString("ko-KR") + '</strong>'
    + '</div>';
}

function renderRatio(items) {
  const total = items.reduce(function (sum, item) {
    return sum + item[1];
  }, 0);

  if (total <= 0) {
    return "";
  }

  return items.map(function (item) {
    const width = (item[1] / total) * 100;
    return '<div class="' + escapeHtml(item[0]) + '" style="width:' + width + '%"></div>';
  }).join("");
}

function renderTable(rows) {
  if (rows.length === 0) {
    const message = rawRows.length === 0
      ? DATASET_META[activeDataset].emptyText
      : "조건에 맞는 데이터가 없습니다.";

    dom.tableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="' + columns.length + '">' + escapeHtml(message) + '</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  rows.forEach(function (row) {
    const tr = document.createElement("tr");

    tr.addEventListener("click", function () {
      openDrawer(row);
    });

    columns.forEach(function (column) {
      const td = document.createElement("td");
      const value = row[column];

      td.className = cellClass(column, value);

      if (column === "Grade") {
        td.innerHTML = gradeBadge(value);
      } else if (column === "Trend") {
        td.innerHTML = trendBadge(value);
      } else if (column === "period") {
        td.innerHTML = periodBadge(value);
      } else {
        td.textContent = formatCellValue(column, value);
      }

      tr.appendChild(td);
    });

    fragment.appendChild(tr);
  });

  dom.tableBody.innerHTML = "";
  dom.tableBody.appendChild(fragment);
}

function openDrawer(row) {
  const ticker = cleanText(row.Ticker) || "-";
  const category = cleanText(row.Category || row.Sector || row.Industry);
  const periodRows = getTickerPeriodRows(row);
  const mainPeriod = getMainPeriod();
  const mainRow = findPeriodRow(periodRows, mainPeriod) || row;
  const availablePeriods = periodRows.map(function (periodRow) {
    return labelPeriod(periodRow.period);
  }).join(" · ");

  dom.detailTicker.textContent = ticker;
  dom.detailSub.textContent = [DATASET_META[activeDataset].label, category, availablePeriods].filter(Boolean).join(" · ") || "-";
  dom.detailBadges.innerHTML =
    (columns.indexOf("Grade") >= 0 ? gradeBadge(mainRow.Grade) : "") +
    (columns.indexOf("Trend") >= 0 ? trendBadge(mainRow.Trend) : "") +
    (columns.indexOf("period") >= 0 ? periodBadge(mainPeriod) : "");

  renderPeriodSummaryCards(periodRows);
  renderPeriodMetricBars(periodRows);

  dom.detailDrawer.classList.add("open");
  dom.overlay.classList.add("open");
}

function getMainPeriod() {
  return DATASET_MAIN_PERIODS[activeDataset] || MAIN_PERIOD;
}

function getDetailPeriodOrder() {
  return DATASET_PERIOD_DETAIL_ORDERS[activeDataset] || PERIOD_DETAIL_ORDER;
}

function getTickerPeriodRows(row) {
  const ticker = cleanText(row.Ticker);
  const category = cleanText(row.Category);

  return rawRows
    .filter(function (candidate) {
      const sameTicker = cleanText(candidate.Ticker) === ticker;
      const sameCategory = !category || cleanText(candidate.Category) === category;

      return sameTicker && sameCategory;
    })
    .filter(function (candidate) {
      return getDetailPeriodOrder().indexOf(cleanText(candidate.period).toLowerCase()) >= 0;
    })
    .sort(function (a, b) {
      return detailPeriodIndex(a.period) - detailPeriodIndex(b.period);
    });
}

function findPeriodRow(rows, period) {
  const normalized = cleanText(period).toLowerCase();

  return rows.find(function (row) {
    return cleanText(row.period).toLowerCase() === normalized;
  });
}

function detailPeriodIndex(period) {
  const detailPeriodOrder = getDetailPeriodOrder();
  const index = detailPeriodOrder.indexOf(cleanText(period).toLowerCase());

  return index >= 0 ? index : detailPeriodOrder.length;
}

function renderPeriodSummaryCards(periodRows) {
  dom.periodSummaryCards.innerHTML = getDetailPeriodOrder().map(function (period) {
    const row = findPeriodRow(periodRows, period);

    if (!row) {
      return ""
        + '<article class="period-card missing">'
        + '<h4>' + escapeHtml(labelPeriod(period)) + '</h4>'
        + '<p>데이터 없음</p>'
        + '</article>';
    }

    return ""
      + '<article class="period-card">'
      + '<h4>' + escapeHtml(labelPeriod(period)) + '</h4>'
      + periodCardRow("거래시작일", row.first_date)
      + periodCardRow("거래종료일", row.last_date)
      + '<div class="period-card-row">'
      + '<span>등급</span>'
      + '<strong>' + gradeBadge(row.Grade) + '</strong>'
      + '</div>'
      + (columns.indexOf("Trend") >= 0
        ? '<div class="period-card-row"><span>추세</span><strong>' + trendBadge(row.Trend) + '</strong></div>'
        : "")
      + '</article>';
  }).join("");
}

function periodCardRow(label, value) {
  return ""
    + '<div class="period-card-row">'
    + '<span>' + escapeHtml(label) + '</span>'
    + '<strong>' + escapeHtml(cleanText(value) || "-") + '</strong>'
    + '</div>';
}

function renderPeriodMetricBars(periodRows) {
  const metrics = DETAIL_METRIC_COLUMNS.filter(function (metric) {
    return columns.indexOf(metric) >= 0;
  });

  if (periodRows.length === 0 || metrics.length === 0) {
    dom.periodMetricBars.innerHTML = '<div class="empty-detail">표시할 기간별 지표가 없습니다.</div>';
    return;
  }

  dom.periodMetricBars.innerHTML = metrics.map(function (metric) {
    return renderMetricBlock(metric, periodRows);
  }).join("");
}

function renderMetricBlock(metric, periodRows) {
  const rowsByPeriod = getDetailPeriodOrder().map(function (period) {
    return {
      period: period,
      row: findPeriodRow(periodRows, period)
    };
  });
  const values = rowsByPeriod
    .map(function (entry) {
      return entry.row ? parseNumber(entry.row[metric]) : NaN;
    })
    .filter(Number.isFinite);
  const maxValue = Math.max.apply(null, values.map(function (value) {
    return Math.abs(value);
  }).concat([1]));

  return ""
    + '<article class="metric-block">'
    + '<h4>' + escapeHtml(columnLabelText(metric)) + '</h4>'
    + rowsByPeriod.map(function (entry) {
      return renderMetricPeriodRow(metric, entry.period, entry.row, maxValue);
    }).join("")
    + '</article>';
}

function renderMetricPeriodRow(metric, period, row, maxValue) {
  if (!row) {
    return ""
      + '<div class="metric-period-row missing">'
      + '<span class="metric-period-label">' + escapeHtml(labelPeriod(period)) + '</span>'
      + '<div class="metric-track"></div>'
      + '<strong class="metric-value">-</strong>'
      + '</div>';
  }

  const value = parseNumber(row[metric]);
  const width = Number.isFinite(value)
    ? clamp((Math.abs(value) / maxValue) * 100, 4, 100)
    : 0;
  const fillClass = metricBarClass(metric, value);

  return ""
    + '<div class="metric-period-row">'
    + '<span class="metric-period-label">' + escapeHtml(labelPeriod(period)) + '</span>'
    + '<div class="metric-track">'
    + '<div class="metric-fill ' + fillClass + '" style="width:' + width + '%"></div>'
    + '</div>'
    + '<strong class="metric-value ' + numberClass(value) + '">' + escapeHtml(formatCellValue(metric, value)) + '</strong>'
    + '</div>';
}

function metricBarClass(metric, value) {
  if (metric === "MDD") {
    return "danger";
  }

  return parseNumber(value) < 0 ? "danger" : "good";
}

function closeDrawer() {
  dom.detailDrawer.classList.remove("open");
  dom.overlay.classList.remove("open");
}

function handleSortHeaderEvent(event) {
  const th = event.target.closest("th[data-sort-key]");

  if (!th || !dom.mainTable.contains(th)) {
    return;
  }

  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") {
    return;
  }

  event.preventDefault();
  applyHeaderSort(th.dataset.sortKey);
}

function applyHeaderSort(key) {
  if (!key) {
    return;
  }

  if (tableSort.key === key) {
    tableSort.direction = tableSort.direction === "asc" ? "desc" : "asc";
  } else {
    tableSort = {
      key: key,
      direction: defaultSortDirection(key)
    };
  }

  syncSortSelect();
  renderDashboard();
}

function updateSortHeaders() {
  dom.tableHead.querySelectorAll("th[data-sort-key]").forEach(function (th) {
    const isActive = th.dataset.sortKey === tableSort.key;

    th.classList.toggle("sorted", isActive);
    th.classList.toggle("sort-asc", isActive && tableSort.direction === "asc");
    th.classList.toggle("sort-desc", isActive && tableSort.direction === "desc");
    th.setAttribute(
      "aria-sort",
      isActive
        ? tableSort.direction === "asc" ? "ascending" : "descending"
        : "none"
    );
  });
}

function compareRows(a, b) {
  const direction = tableSort.direction === "asc" ? 1 : -1;
  const key = tableSort.key;
  const aValue = a[key];
  const bValue = b[key];
  const missingCompare = compareMissing(aValue, bValue);

  if (missingCompare !== 0) {
    return missingCompare;
  }

  let result = 0;

  if (key === "Grade") {
    result = gradeRank(aValue) - gradeRank(bValue);
  } else if (key === "Trend") {
    result = trendRank(aValue) - trendRank(bValue);
  } else if (key === "period") {
    result = periodRank(aValue) - periodRank(bValue);
  } else if (isDateColumn(key)) {
    result = dateValue(aValue) - dateValue(bValue);
  } else if (isNumericColumn(key)) {
    result = numberValue(aValue) - numberValue(bValue);
  } else {
    result = textCompare(cleanText(aValue), cleanText(bValue));
  }

  if (result !== 0) {
    return result * direction;
  }

  return textCompare(cleanText(a.Ticker), cleanText(b.Ticker));
}

function compareMissing(a, b) {
  const aMissing = isBlank(a);
  const bMissing = isBlank(b);

  if (aMissing && bMissing) {
    return 0;
  }

  if (aMissing) {
    return 1;
  }

  if (bMissing) {
    return -1;
  }

  return 0;
}

function defaultSortDirection(column) {
  if (column === "Grade") {
    return "asc";
  }

  if (column === "period") {
    return "desc";
  }

  if (TEXT_DEFAULT_ASC_COLUMNS.has(column)) {
    return "asc";
  }

  return isNumericColumn(column) ? "desc" : "asc";
}

function syncSortSelect() {
  dom.sortSelect.value = buildSortValue(tableSort.key, tableSort.direction);
}

function buildSortValue(column, direction) {
  return encodeURIComponent(column) + "|" + direction;
}

function parseSortValue(value) {
  const parts = String(value || "").split("|");

  if (parts.length !== 2) {
    return null;
  }

  const key = decodeURIComponent(parts[0]);
  const direction = parts[1] === "desc" ? "desc" : "asc";

  if (columns.indexOf(key) < 0) {
    return null;
  }

  return { key: key, direction: direction };
}

function resetFilters() {
  dom.searchInput.value = "";
  dom.periodFilter.value = defaultPeriod;
  dom.gradeFilter.value = ALL_FILTER;
  tableSort = {
    key: columns.indexOf("CAGR") >= 0 ? "CAGR" : columns[0],
    direction: columns.indexOf("CAGR") >= 0 ? "desc" : defaultSortDirection(columns[0])
  };

  syncSortSelect();
  closeDrawer();
  renderDashboard();
}

function uniqueValues(rows, column) {
  if (columns.indexOf(column) < 0) {
    return [];
  }

  return Array.from(
    new Set(
      rows.map(function (row) {
        return cleanText(row[column]);
      }).filter(Boolean)
    )
  );
}

function countByValue(rows, column, normalizer) {
  const counts = new Map();
  const normalize = normalizer || cleanText;

  rows.forEach(function (row) {
    const value = normalize(row[column]);

    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return counts;
}

function countUniqueTickersByValue(rows, column) {
  const groups = new Map();

  rows.forEach(function (row) {
    const group = cleanText(row[column]) || "미분류";
    const ticker = cleanText(row.Ticker) || JSON.stringify(row);

    if (!groups.has(group)) {
      groups.set(group, new Set());
    }

    groups.get(group).add(ticker);
  });

  return new Map(
    Array.from(groups.entries()).map(function (entry) {
      return [entry[0], entry[1].size];
    })
  );
}

function countUnique(rows, column) {
  if (columns.indexOf(column) < 0) {
    return 0;
  }

  return new Set(
    rows.map(function (row) {
      return cleanText(row[column]);
    }).filter(Boolean)
  ).size;
}

function chooseDefaultPeriod(periodValues) {
  if (periodValues.length === 0) {
    return ALL_FILTER;
  }

  const preferredPeriods = PREFERRED_DEFAULT_PERIODS_BY_DATASET[activeDataset] || PREFERRED_DEFAULT_PERIODS;
  const lowerMap = new Map(
    periodValues.map(function (period) {
      return [period.toLowerCase(), period];
    })
  );

  for (let i = 0; i < preferredPeriods.length; i += 1) {
    const period = lowerMap.get(preferredPeriods[i]);

    if (period) {
      return period;
    }
  }

  return periodValues[0];
}

function comparePeriodsForOptions(a, b) {
  const rankA = periodRank(a);
  const rankB = periodRank(b);

  if (rankA !== rankB) {
    return rankB - rankA;
  }

  return textCompare(a, b);
}

function periodRank(value) {
  const text = cleanText(value).toLowerCase();

  if (text === "total" || text === "all") {
    return 100000;
  }

  const yearMatch = text.match(/^(\d+(?:\.\d+)?)\s*y/);

  if (yearMatch) {
    return Number(yearMatch[1]) * 100;
  }

  const monthMatch = text.match(/^(\d+(?:\.\d+)?)\s*m/);

  if (monthMatch) {
    return Number(monthMatch[1]) * 8;
  }

  return 0;
}

function labelPeriod(value) {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  if (lower === "total" || lower === "all") {
    return "전체 기간";
  }

  const yearMatch = lower.match(/^(\d+(?:\.\d+)?)\s*y$/);

  if (yearMatch) {
    return yearMatch[1] + "년";
  }

  const monthMatch = lower.match(/^(\d+(?:\.\d+)?)\s*m$/);

  if (monthMatch) {
    return monthMatch[1] + "개월";
  }

  return text;
}

function columnLabelParts(column) {
  return {
    ko: COLUMN_LABELS[column] || column,
    en: column
  };
}

function columnLabelText(column) {
  const label = columnLabelParts(column);

  return label.ko === label.en ? label.en : label.ko + " (" + label.en + ")";
}

function sortDirectionLabel(column, direction) {
  if (column === "Grade") {
    return direction === "asc" ? "높은 등급 순" : "낮은 등급 순";
  }

  if (isNumericColumn(column) || column === "period") {
    return direction === "asc" ? "낮은 순" : "높은 순";
  }

  return direction === "asc" ? "오름차순" : "내림차순";
}

function cellClass(column, value) {
  const classes = [];

  if (column === "Ticker") {
    classes.push("ticker", "text-cell");
  } else if (column === "Name" || column === "Category" || column === "Sector" || column === "Industry" || column === "Grade" || column === "Trend" || column === "period") {
    classes.push("text-cell");
  }

  if (isNumericColumn(column)) {
    classes.push(numberClass(value));
  }

  return classes.join(" ");
}

function isNumericColumn(column) {
  if (KNOWN_NUMERIC_COLUMNS.has(column)) {
    return true;
  }

  if (!rawRows.length || isDateColumn(column) || column === "Ticker") {
    return false;
  }

  const sample = rawRows.slice(0, 80).filter(function (row) {
    return !isBlank(row[column]);
  });

  return sample.length > 0 && sample.every(function (row) {
    return Number.isFinite(parseNumber(row[column]));
  });
}

function isDateColumn(column) {
  return DATE_COLUMNS.has(column) || /date/i.test(column);
}

function formatCellValue(column, value) {
  if (isBlank(value)) {
    return "-";
  }

  if (PERCENT_COLUMNS.has(column)) {
    return formatPercent(value);
  }

  if (isNumericColumn(column)) {
    return formatNumber(value);
  }

  return cleanText(value);
}

function formatPercent(value) {
  const number = parseNumber(value);

  return Number.isFinite(number) ? number.toFixed(2) + "%" : cleanText(value);
}

function formatNumber(value) {
  const number = parseNumber(value);

  return Number.isFinite(number) ? number.toFixed(2) : cleanText(value);
}

function average(rows, column) {
  const values = rows
    .map(function (row) {
      return parseNumber(row[column]);
    })
    .filter(Number.isFinite);

  if (values.length === 0) {
    return null;
  }

  return values.reduce(function (sum, value) {
    return sum + value;
  }, 0) / values.length;
}

function normalizeGrade(value) {
  const text = cleanText(value).toLowerCase();

  if (text === "best") return "Best";
  if (text === "good") return "Good";
  if (text === "normal") return "Normal";
  if (text === "bad") return "Bad";

  return cleanText(value);
}

function gradeRank(value) {
  const normalized = normalizeGrade(value);
  const index = GRADE_ORDER.indexOf(normalized);

  return index >= 0 ? index : GRADE_ORDER.length;
}

function normalizeTrend(value) {
  const text = cleanText(value);
  const lower = text.toLowerCase();

  if (text === "상승" || lower === "up" || lower === "rising" || lower === "bullish") {
    return "상승";
  }

  if (text === "하락" || lower === "down" || lower === "falling" || lower === "bearish") {
    return "하락";
  }

  if (text === "보합" || text === "중립" || lower === "flat" || lower === "neutral" || lower === "sideways") {
    return "보합";
  }

  return text || "Unknown";
}

function trendRank(value) {
  const normalized = normalizeTrend(value);

  if (normalized === "상승") return 3;
  if (normalized === "보합") return 2;
  if (normalized === "하락") return 1;

  return 0;
}

function gradeBadge(value) {
  const normalized = normalizeGrade(value) || "Unknown";
  let className = "grade-unknown";

  if (normalized === "Best") className = "grade-best";
  if (normalized === "Good") className = "grade-good";
  if (normalized === "Normal") className = "grade-normal";
  if (normalized === "Bad") className = "grade-bad";

  return '<span class="grade-pill ' + className + '">' + escapeHtml(normalized) + '</span>';
}

function trendBadge(value) {
  const normalized = normalizeTrend(value);
  let className = "trend-unknown";

  if (normalized === "상승") className = "trend-up";
  if (normalized === "보합") className = "trend-flat";
  if (normalized === "하락") className = "trend-down";

  return '<span class="trend-pill ' + className + '">' + escapeHtml(normalized) + '</span>';
}

function periodBadge(value) {
  return '<span class="period-pill">' + escapeHtml(labelPeriod(value)) + '</span>';
}

function numberClass(value) {
  const number = parseNumber(value);

  if (!Number.isFinite(number) || number === 0) {
    return "neutral";
  }

  return number > 0 ? "positive" : "negative";
}

function numberValue(value) {
  const number = parseNumber(value);

  return Number.isFinite(number) ? number : 0;
}

function dateValue(value) {
  const time = Date.parse(cleanText(value));

  return Number.isFinite(time) ? time : 0;
}

function parseNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN;
  }

  if (isBlank(value)) {
    return NaN;
  }

  const number = Number(String(value).replace(/%/g, "").replace(/,/g, "").trim());

  return Number.isFinite(number) ? number : NaN;
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(Math.max(number, min), max);
}

function read(row, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];

    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return row[key];
    }
  }

  return "";
}

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function isBlank(value) {
  return value === null || value === undefined || cleanText(value) === "";
}

function textCompare(a, b) {
  return cleanText(a).localeCompare(cleanText(b), "ko-KR", {
    numeric: true,
    sensitivity: "base"
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showStatus(message) {
  dom.statusBox.classList.remove("hidden", "error");
  dom.statusBox.textContent = message;
}

function hideStatus() {
  dom.statusBox.classList.add("hidden");
  dom.statusBox.textContent = "";
}

function showError(error) {
  const message = error && error.message ? error.message : String(error);

  if (dom.statusBox) {
    dom.statusBox.classList.remove("hidden");
    dom.statusBox.classList.add("error");
    dom.statusBox.innerHTML =
      '<strong>데이터 로딩 또는 화면 렌더링 오류</strong><br>' +
      escapeHtml(message).replace(/\n/g, "<br>");
  }

  if (dom.tableBody) {
    dom.tableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="' + Math.max(columns.length, 1) + '">데이터를 표시할 수 없습니다.</td></tr>';
  }
}
