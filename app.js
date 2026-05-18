"use strict";

const PERIOD_ORDER = ["ALL", "5Y", "3Y", "1Y"];
const GRADE_ORDER = ["Best", "Good", "Normal", "Bad"];
const THEME_STORAGE_KEY = "etfDashboardTheme";
const METRIC_LABELS = {
  totalReturn: "총수익률 (Total Return)",
  cagr: "연복리수익률 (CAGR)",
  mdd: "최대낙폭 (MDD)",
  sharpe: "샤프지수 (Sharpe)",
  calmar: "칼마지수 (Calmar)",
  exposure: "투자노출도 (Exposure)",
  tradeCount: "거래수 (Trades)",
  profitFactor: "수익팩터 (Profit Factor)",
  expectancy: "기대값 (Expectancy)",
  firstDate: "거래시작일 (first_date)",
  lastDate: "거래종료일 (last_date)"
};

let rawRows = [];
let groupedItems = [];
let activeStrategy = null;

const dom = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    cacheDom();
    initializeTheme();
    bindEvents();
    showStatus("Yahoo Finance 데이터를 불러오는 중입니다...");

    const dataResult = await loadJson();
    const json = dataResult.json;

    rawRows = normalizeInput(json);
    validateRows(rawRows);
    groupedItems = buildGroupedItems(rawRows);
    updateDataSourceMeta(dataResult.lastModified);

    const strategies = getStrategies(groupedItems);
    if (strategies.length === 0) {
      throw new Error("No strategy data found.");
    }

    activeStrategy = strategies[0];

    renderStrategyTabs(strategies);
    renderDashboard();
    hideStatus();
  } catch (error) {
    console.error("[ETF Dashboard Error]", error);
    showError(error);
  }
}

function cacheDom() {
  [
    "statusBox",
    "themeToggle",
    "themeToggleLabel",
    "dataSourceName",
    "lastUpdated",
    "strategyTabs",
    "searchInput",
    "gradeFilter",
    "signalFilter",
    "sortSelect",
    "kpiCards",
    "totalEtfCount",
    "bestCount",
    "goodCount",
    "normalCount",
    "badCount",
    "gradeRatio",
    "buyCount",
    "holdCount",
    "sellCount",
    "signalRatio",
    "tableTitle",
    "tableBody",
    "detailDrawer",
    "closeDrawer",
    "overlay",
    "detailTicker",
    "detailSub",
    "detailBadges",
    "periodSummaryCards",
    "periodCompareChart",
    "detailBody"
  ].forEach(function (id) {
    dom[id] = document.getElementById(id);
  });

  const missingIds = Object.keys(dom).filter(function (id) {
    return !dom[id];
  });

  if (missingIds.length > 0) {
    throw new Error("Missing required element(s) in index.html: " + missingIds.join(", "));
  }
}

function bindEvents() {
  dom.searchInput.addEventListener("input", renderDashboard);
  dom.gradeFilter.addEventListener("change", renderDashboard);
  dom.signalFilter.addEventListener("change", renderDashboard);
  dom.sortSelect.addEventListener("change", renderDashboard);
  dom.closeDrawer.addEventListener("click", closeDrawer);
  dom.overlay.addEventListener("click", closeDrawer);
  dom.themeToggle.addEventListener("click", toggleTheme);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeDrawer();
    }
  });
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
    // Theme persistence is optional when storage is unavailable.
  }
}

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";
  const isDark = normalized === "dark";

  document.documentElement.dataset.theme = normalized;
  dom.themeToggle.setAttribute("aria-pressed", String(isDark));
  dom.themeToggle.setAttribute(
    "aria-label",
    isDark ? "라이트 모드로 전환 (Switch to light mode)" : "다크 모드로 전환 (Switch to dark mode)"
  );
  dom.themeToggleLabel.textContent = isDark ? "라이트 (Light)" : "다크 (Dark)";
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
      throw new Error(
        "브라우저가 data.json을 읽으려면 HTTP 서버로 실행해야 합니다. " +
        "이 폴더에서 `python -m http.server 8000`을 실행한 뒤 http://localhost:8000 으로 접속하세요."
      );
    }

    throw error;
  }
}

function updateDataSourceMeta(lastModified) {
  dom.dataSourceName.textContent = "Yahoo Finance";
  dom.lastUpdated.textContent = "마지막 업데이트 (Last updated): " + formatLastUpdated(lastModified);
}

function formatLastUpdated(lastModified) {
  const date = lastModified ? new Date(lastModified) : null;

  if (!date || !Number.isFinite(date.getTime())) {
    return "알 수 없음 (Unknown)";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short"
  }).format(date);
}

function normalizeInput(json) {
  if (Array.isArray(json)) {
    return json.map(normalizeRow);
  }

  if (json && Array.isArray(json.items)) {
    return json.items.map(normalizeRow);
  }

  throw new Error("data.json은 배열 또는 items 배열을 가진 객체여야 합니다.");
}

function normalizeRow(row) {
  const ticker = read(row, ["Ticker", "ticker", "TICKER"]);
  const category = read(row, ["Category", "category", "CATEGORY"]);
  const strategy = read(row, ["strategy", "Strategy", "STRATEGY"]);
  const period = normalizePeriod(read(row, ["period", "Period", "PERIOD"]));

  return {
    ticker: cleanText(ticker),
    category: cleanText(category),
    strategy: cleanText(strategy),
    period: period,
    firstDate: normalizeDate(read(row, ["first_date", "firstDate", "First Date", "first date"])),
    lastDate: normalizeDate(read(row, ["last_date", "lastDate", "Last Date", "last date"])),
    totalReturn: toNumber(read(row, ["Total Return", "totalReturn", "total_return", "Return", "return"])),
    cagr: toNumber(read(row, ["CAGR", "cagr"])),
    sharpe: toNumber(read(row, ["Sharpe", "sharpe"])),
    mdd: toNumber(read(row, ["MDD", "mdd"])),
    calmar: toNumber(read(row, ["Calmar", "calmar"])),
    exposure: toNumber(read(row, ["exposure_ratio", "exposure", "Exposure", "exposureRatio"])),
    tradeCount: toNumber(read(row, ["trade_count", "tradeCount", "Trades", "trades", "trade count"])),
    profitFactor: toNumber(read(row, ["profit factor", "profit_factor", "profitFactor", "Profit Factor", "PF", "pf"])),
    expectancy: toNumber(read(row, ["expectancy", "Expectancy", "exp", "Exp"])),
    grade: normalizeGrade(read(row, ["Grade", "grade"])),
    signal: normalizeSignal(read(row, ["signal", "Signal"]))
  };
}

function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("data.json에 데이터 row가 없습니다.");
  }

  const missing = [];

  rows.forEach(function (row, index) {
    if (!row.ticker) missing.push("row " + index + ": Ticker 누락");
    if (!row.category) missing.push("row " + index + ": Category 누락");
    if (!row.strategy) missing.push("row " + index + ": strategy 누락");
    if (!row.period) missing.push("row " + index + ": period 누락");
  });

  if (missing.length > 0) {
    throw new Error("필수 컬럼 문제:\n" + missing.slice(0, 15).join("\n"));
  }

  const hasOneYear = rows.some(function (row) {
    return row.period === "1Y";
  });

  if (!hasOneYear) {
    throw new Error("period 값이 1Y인 row가 최소 1개 필요합니다.");
  }
}

function buildGroupedItems(rows) {
  const map = new Map();

  rows.forEach(function (row) {
    const key = row.ticker + "__" + row.strategy;

    if (!map.has(key)) {
      map.set(key, {
        key: key,
        ticker: row.ticker,
        category: row.category,
        strategy: row.strategy,
        periods: {}
      });
    }

    map.get(key).periods[row.period] = row;
  });

  return Array.from(map.values());
}

function getStrategies(items) {
  return Array.from(
    new Set(
      items.map(function (item) {
        return item.strategy;
      }).filter(Boolean)
    )
  ).sort();
}

function renderStrategyTabs(strategies) {
  dom.strategyTabs.innerHTML = "";

  strategies.forEach(function (strategy) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "strategy-tab" + (strategy === activeStrategy ? " active" : "");
    button.textContent = "Strategy " + strategy;

    button.addEventListener("click", function () {
      activeStrategy = strategy;
      renderStrategyTabs(strategies);
      renderDashboard();
      closeDrawer();
    });

    dom.strategyTabs.appendChild(button);
  });
}

function renderDashboard() {
  const data = getVisibleData();

  dom.tableTitle.textContent = "전략 " + activeStrategy + " - 최근 1년 성과 (Latest 1Y Performance)";

  renderKpiCards(data);
  renderGradeDistribution(data);
  renderSignalDistribution(data);
  renderTable(data);
}

function getVisibleData() {
  const keyword = dom.searchInput.value.trim().toLowerCase();
  const grade = dom.gradeFilter.value;
  const signal = dom.signalFilter.value;
  const sort = dom.sortSelect.value;

  const data = groupedItems
    .filter(function (item) {
      return item.strategy === activeStrategy && item.periods["1Y"];
    })
    .filter(function (item) {
      const oneY = item.periods["1Y"];
      const matchesKeyword =
        !keyword ||
        item.ticker.toLowerCase().indexOf(keyword) >= 0 ||
        item.category.toLowerCase().indexOf(keyword) >= 0;
      const matchesGrade = grade === "ALL" || oneY.grade === grade;
      const matchesSignal = signal === "ALL" || oneY.signal === signal;

      return matchesKeyword && matchesGrade && matchesSignal;
    });

  data.sort(function (a, b) {
    const a1 = a.periods["1Y"];
    const b1 = b.periods["1Y"];

    if (sort === "return_desc") return b1.totalReturn - a1.totalReturn;
    if (sort === "sharpe_desc") return b1.sharpe - a1.sharpe;
    if (sort === "mdd_desc") return b1.mdd - a1.mdd;
    if (sort === "calmar_desc") return b1.calmar - a1.calmar;
    if (sort === "pf_desc") return b1.profitFactor - a1.profitFactor;

    return b1.cagr - a1.cagr;
  });

  return data;
}

function renderKpiCards(data) {
  const metrics = [
    metric(METRIC_LABELS.totalReturn, "percent", "평균 총수익률 (Average total return)", data, "totalReturn"),
    metric(METRIC_LABELS.cagr, "percent", "평균 연복리수익률 (Average annualized return)", data, "cagr"),
    metric(METRIC_LABELS.mdd, "percent", "평균 최대낙폭 (Average max drawdown)", data, "mdd"),
    metric(METRIC_LABELS.sharpe, "number", "위험 대비 수익 (Risk-adjusted return)", data, "sharpe"),
    metric(METRIC_LABELS.calmar, "number", "CAGR / MDD", data, "calmar"),
    metric(METRIC_LABELS.profitFactor, "number", "총이익 / 총손실 (Gross profit / gross loss)", data, "profitFactor"),
    metric(METRIC_LABELS.expectancy, "number", "거래당 기대값 (Expected value per trade)", data, "expectancy")
  ];

  dom.kpiCards.innerHTML = metrics.map(function (item) {
    const cls = numberClass(item.value);

    return ""
      + '<div class="kpi-card">'
      + '<span>' + escapeHtml(item.label) + '</span>'
      + '<strong class="' + cls + '">' + formatByType(item.value, item.type) + '</strong>'
      + '<small>' + escapeHtml(item.note) + '</small>'
      + '</div>';
  }).join("");
}

function metric(label, type, note, data, key) {
  return {
    label: label,
    type: type,
    note: note,
    value: average(data, function (item) {
      return item.periods["1Y"][key];
    })
  };
}

function renderGradeDistribution(data) {
  const total = data.length;
  const counts = {};

  GRADE_ORDER.forEach(function (grade) {
    counts[grade] = countBy(data, function (item) {
      return item.periods["1Y"].grade === grade;
    });
  });

  dom.totalEtfCount.textContent = String(total);
  dom.bestCount.textContent = String(counts.Best);
  dom.goodCount.textContent = String(counts.Good);
  dom.normalCount.textContent = String(counts.Normal);
  dom.badCount.textContent = String(counts.Bad);

  dom.gradeRatio.innerHTML = ratioHtml(
    GRADE_ORDER.map(function (grade) {
      return ["ratio-" + grade.toLowerCase(), counts[grade]];
    })
  );
}

function renderSignalDistribution(data) {
  const buy = countBy(data, function (item) {
    return item.periods["1Y"].signal === "BUY";
  });
  const hold = countBy(data, function (item) {
    return item.periods["1Y"].signal === "HOLD";
  });
  const sell = countBy(data, function (item) {
    return item.periods["1Y"].signal === "SELL";
  });

  dom.buyCount.textContent = String(buy);
  dom.holdCount.textContent = String(hold);
  dom.sellCount.textContent = String(sell);

  dom.signalRatio.innerHTML = ratioHtml([
    ["ratio-buy", buy],
    ["ratio-hold", hold],
    ["ratio-sell", sell]
  ]);
}

function renderTable(data) {
  if (data.length === 0) {
    dom.tableBody.innerHTML =
      '<tr>'
      + '<td colspan="15" style="text-align:center; padding:32px; color:#94a3b8;">'
      + '조건에 맞는 ETF가 없습니다. (No ETFs match the current filters.)'
      + '</td>'
      + '</tr>';
    return;
  }

  dom.tableBody.innerHTML = "";

  data.forEach(function (item) {
    const p = item.periods["1Y"];
    const tr = document.createElement("tr");

    tr.innerHTML = ""
      + '<td class="ticker">' + escapeHtml(item.ticker) + '</td>'
      + '<td>' + escapeHtml(item.category) + '</td>'
      + '<td>' + gradeBadge(p.grade) + '</td>'
      + '<td>' + signalBadge(p.signal) + '</td>'
      + '<td>' + escapeHtml(formatDate(p.firstDate)) + '</td>'
      + '<td>' + escapeHtml(formatDate(p.lastDate)) + '</td>'
      + metricCell(p.totalReturn, "percent", 100)
      + metricCell(p.cagr, "percent", 50)
      + metricCell(p.sharpe, "number", 3)
      + metricCell(Math.abs(p.mdd), "percent", 40, p.mdd)
      + '<td class="' + numberClass(p.calmar) + '">' + formatNumber(p.calmar) + '</td>'
      + '<td>' + formatPercent(p.exposure) + '</td>'
      + '<td>' + formatInteger(p.tradeCount) + '</td>'
      + '<td class="' + numberClass(p.profitFactor - 1) + '">' + formatNumber(p.profitFactor) + '</td>'
      + '<td class="' + numberClass(p.expectancy) + '">' + formatNumber(p.expectancy) + '</td>';

    tr.addEventListener("click", function () {
      openDrawer(item);
    });

    dom.tableBody.appendChild(tr);
  });
}

function metricCell(valueForBar, type, max, displayValue) {
  const value = displayValue === undefined ? valueForBar : displayValue;
  const danger = displayValue !== undefined && value < 0;

  return ""
    + '<td class="' + numberClass(value) + ' metric-cell">'
    + formatByType(value, type)
    + miniBar(valueForBar, max, danger)
    + '</td>';
}

function openDrawer(item) {
  const oneY = item.periods["1Y"];

  if (!oneY) {
    return;
  }

  dom.detailTicker.textContent = item.ticker;
  dom.detailSub.textContent = item.category + " - Strategy " + item.strategy;
  dom.detailBadges.innerHTML = gradeBadge(oneY.grade) + signalBadge(oneY.signal);

  renderPeriodSummaryCards(item);
  renderPeriodCompareChart(item);
  renderDetailTable(item);

  dom.detailDrawer.classList.add("open");
  dom.overlay.classList.add("open");
}

function renderPeriodSummaryCards(item) {
  dom.periodSummaryCards.innerHTML = PERIOD_ORDER.map(function (period) {
    const p = item.periods[period];

    if (!p) {
      return "";
    }

    return ""
      + '<div class="period-card">'
      + '<h4>' + escapeHtml(period) + '</h4>'
      + periodDateRow(METRIC_LABELS.firstDate, p.firstDate)
      + periodDateRow(METRIC_LABELS.lastDate, p.lastDate)
      + periodCardRow(METRIC_LABELS.totalReturn, p.totalReturn, "percent")
      + periodCardRow(METRIC_LABELS.cagr, p.cagr, "percent")
      + periodCardRow(METRIC_LABELS.sharpe, p.sharpe, "number")
      + periodCardRow(METRIC_LABELS.mdd, p.mdd, "percent")
      + '</div>';
  }).join("");
}

function periodDateRow(label, value) {
  return ""
    + '<div class="period-card-row date-row">'
    + '<span>' + escapeHtml(label) + '</span>'
    + '<strong>' + escapeHtml(formatDate(value)) + '</strong>'
    + '</div>';
}

function periodCardRow(label, value, type) {
  return ""
    + '<div class="period-card-row">'
    + '<span>' + escapeHtml(label) + '</span>'
    + '<strong class="' + numberClass(value) + '">' + formatByType(value, type) + '</strong>'
    + '</div>';
}

function renderPeriodCompareChart(item) {
  const available = PERIOD_ORDER.map(function (period) {
    return {
      period: period,
      row: item.periods[period]
    };
  }).filter(function (entry) {
    return entry.row;
  });

  if (available.length === 0) {
    dom.periodCompareChart.innerHTML = '<p style="color:#94a3b8;">기간 데이터가 없습니다. (No period data is available.)</p>';
    return;
  }

  const chartMetrics = [
    { key: "totalReturn", label: METRIC_LABELS.totalReturn, type: "percent", mode: "positive" },
    { key: "cagr", label: METRIC_LABELS.cagr, type: "percent", mode: "positive" },
    { key: "sharpe", label: METRIC_LABELS.sharpe, type: "number", mode: "positive" },
    { key: "mdd", label: METRIC_LABELS.mdd, type: "percent", mode: "absolute" },
    { key: "calmar", label: METRIC_LABELS.calmar, type: "number", mode: "positive" },
    { key: "profitFactor", label: METRIC_LABELS.profitFactor, type: "number", mode: "positive" },
    { key: "expectancy", label: METRIC_LABELS.expectancy, type: "number", mode: "positive" }
  ];

  dom.periodCompareChart.innerHTML = chartMetrics.map(function (chartMetric) {
    const maxValue = getMaxVisualValue(available, chartMetric);

    const rowsHtml = available.map(function (entry) {
      const rawValue = toNumber(entry.row[chartMetric.key]);
      const visualValue = getVisualValue(rawValue, chartMetric.mode);
      const width = clamp((visualValue / maxValue) * 100, 3, 100);
      const isMdd = chartMetric.key === "mdd";

      return ""
        + '<div class="compare-row">'
        + '<div class="compare-period">' + escapeHtml(entry.period) + '</div>'
        + '<div class="compare-track">'
        + '<div class="compare-fill ' + (isMdd ? "negative-fill" : "") + '" style="width:' + width + '%"></div>'
        + '</div>'
        + '<div class="compare-value ' + numberClass(rawValue) + '">'
        + formatByType(rawValue, chartMetric.type)
        + '</div>'
        + '</div>';
    }).join("");

    return ""
      + '<div class="compare-block">'
      + '<h4>' + escapeHtml(chartMetric.label) + '</h4>'
      + rowsHtml
      + '</div>';
  }).join("");
}

function getMaxVisualValue(available, chartMetric) {
  const values = available.map(function (entry) {
    return getVisualValue(toNumber(entry.row[chartMetric.key]), chartMetric.mode);
  });

  return Math.max.apply(null, values.concat([1]));
}

function getVisualValue(rawValue, mode) {
  if (mode === "absolute") {
    return Math.abs(rawValue);
  }

  return Math.max(rawValue, 0);
}

function renderDetailTable(item) {
  dom.detailBody.innerHTML = PERIOD_ORDER.map(function (period) {
    const p = item.periods[period];

    if (!p) {
      return "";
    }

    return ""
      + '<tr>'
      + '<td><strong>' + escapeHtml(period) + '</strong></td>'
      + '<td>' + escapeHtml(formatDate(p.firstDate)) + '</td>'
      + '<td>' + escapeHtml(formatDate(p.lastDate)) + '</td>'
      + '<td class="' + numberClass(p.totalReturn) + '">' + formatPercent(p.totalReturn) + '</td>'
      + '<td class="' + numberClass(p.cagr) + '">' + formatPercent(p.cagr) + '</td>'
      + '<td class="' + numberClass(p.sharpe) + '">' + formatNumber(p.sharpe) + '</td>'
      + '<td class="' + numberClass(p.mdd) + '">' + formatPercent(p.mdd) + '</td>'
      + '<td class="' + numberClass(p.calmar) + '">' + formatNumber(p.calmar) + '</td>'
      + '<td>' + formatPercent(p.exposure) + '</td>'
      + '<td>' + formatInteger(p.tradeCount) + '</td>'
      + '<td class="' + numberClass(p.profitFactor - 1) + '">' + formatNumber(p.profitFactor) + '</td>'
      + '<td class="' + numberClass(p.expectancy) + '">' + formatNumber(p.expectancy) + '</td>'
      + '</tr>';
  }).join("");
}

function closeDrawer() {
  dom.detailDrawer.classList.remove("open");
  dom.overlay.classList.remove("open");
}

function gradeBadge(grade) {
  const normalized = normalizeGrade(grade);
  let cls = "grade-unknown";

  if (normalized === "Best") {
    cls = "grade-best";
  } else if (normalized === "Good") {
    cls = "grade-good";
  } else if (normalized === "Normal") {
    cls = "grade-normal";
  } else if (normalized === "Bad") {
    cls = "grade-bad";
  }

  return '<span class="grade-pill ' + cls + '">' + escapeHtml(normalized) + '</span>';
}

function signalBadge(signal) {
  const normalized = normalizeSignal(signal);
  let cls = "signal-hold";

  if (normalized === "BUY") {
    cls = "signal-buy";
  } else if (normalized === "SELL") {
    cls = "signal-sell";
  }

  return '<span class="signal-pill ' + cls + '">' + escapeHtml(normalized) + '</span>';
}

function miniBar(value, max, danger) {
  const safeMax = max > 0 ? max : 1;
  const width = clamp((Math.max(toNumber(value), 0) / safeMax) * 100, 3, 100);
  const dangerClass = danger ? "red" : "";

  return ""
    + '<div class="cell-bar">'
    + '<div class="cell-fill ' + dangerClass + '" style="width:' + width + '%"></div>'
    + '</div>';
}

function ratioHtml(items) {
  const total = items.reduce(function (sum, item) {
    return sum + item[1];
  }, 0);

  if (total <= 0) {
    return "";
  }

  return items.map(function (item) {
    const className = item[0];
    const count = item[1];
    const width = (count / total) * 100;

    return '<div class="' + className + '" style="width:' + width + '%"></div>';
  }).join("");
}

function read(row, keys) {
  if (!row || typeof row !== "object") {
    return "";
  }

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

function normalizeDate(value) {
  return cleanText(value);
}

function formatDate(value) {
  return cleanText(value) || "-";
}

function normalizePeriod(value) {
  const v = cleanText(value).toUpperCase();

  if (v === "TOTAL" || v === "ALL") return "ALL";
  if (v === "5Y" || v === "5YR" || v === "5YEAR" || v === "5 YEARS") return "5Y";
  if (v === "3Y" || v === "3YR" || v === "3YEAR" || v === "3 YEARS") return "3Y";
  if (v === "1Y" || v === "1YR" || v === "1YEAR" || v === "1 YEAR") return "1Y";

  return v;
}

function normalizeGrade(value) {
  const v = cleanText(value).toLowerCase();

  if (v === "best") return "Best";
  if (v === "good") return "Good";
  if (v === "normal") return "Normal";
  if (v === "bad") return "Bad";

  return cleanText(value) || "Unknown";
}

function normalizeSignal(value) {
  const v = cleanText(value).toUpperCase();

  if (v === "BUY") return "BUY";
  if (v === "SELL") return "SELL";
  if (v === "HOLD") return "HOLD";

  return v || "HOLD";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value).replace(/%/g, "").replace(/,/g, "").trim();
  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
}

function average(data, selector) {
  if (!Array.isArray(data) || data.length === 0) {
    return 0;
  }

  const values = data.map(selector).map(toNumber).filter(Number.isFinite);

  if (values.length === 0) {
    return 0;
  }

  return values.reduce(function (sum, value) {
    return sum + value;
  }, 0) / values.length;
}

function countBy(data, predicate) {
  return data.filter(predicate).length;
}

function formatByType(value, type) {
  if (type === "percent") {
    return formatPercent(value);
  }

  return formatNumber(value);
}

function formatPercent(value) {
  return toNumber(value).toFixed(2) + "%";
}

function formatNumber(value) {
  return toNumber(value).toFixed(2);
}

function formatInteger(value) {
  return Math.round(toNumber(value)).toLocaleString("en-US");
}

function numberClass(value) {
  const number = toNumber(value);

  if (number > 0) return "positive";
  if (number < 0) return "negative";

  return "neutral";
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(Math.max(number, min), max);
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
  if (dom.statusBox) {
    dom.statusBox.classList.remove("hidden");
    dom.statusBox.classList.add("error");

    dom.statusBox.innerHTML =
      '<strong>데이터 로딩 또는 렌더링 오류 (Data loading or rendering error)</strong><br>'
      + escapeHtml(error.message).replace(/\n/g, "<br>")
      + '<br><br>'
      + '확인사항 (Check these items):'
      + '<br>1. index.html, style.css, app.js, data.json이 같은 폴더에 있는지 확인'
      + '<br>2. data.json에 period 값이 1Y인 row가 최소 1개 이상 있는지 확인'
      + '<br>3. 주소가 file:// 로 시작하면 로컬 HTTP 서버로 실행';
  }

  if (dom.tableBody) {
    dom.tableBody.innerHTML =
      '<tr>'
      + '<td colspan="15" style="text-align:center; padding:32px; color:#fecaca;">'
      + '데이터 로딩 실패 (Failed to load data)'
      + '</td>'
      + '</tr>';
  }
}
