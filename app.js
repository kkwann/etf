"use strict";

const PERIOD_ORDER = ["ALL", "5Y", "3Y", "1Y"];

let rawRows = [];
let groupedItems = [];
let activeStrategy = null;

const dom = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    cacheDom();
    bindEvents();
    showStatus("Loading data.json...");

    const json = await loadJson();

    rawRows = normalizeInput(json);
    validateRows(rawRows);
    groupedItems = buildGroupedItems(rawRows);

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
    "strategyTabs",
    "searchInput",
    "gradeFilter",
    "signalFilter",
    "sortSelect",
    "kpiCards",
    "totalEtfCount",
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

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeDrawer();
    }
  });
}

async function loadJson() {
  try {
    const response = await fetch("./data.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Failed to load data.json: HTTP " + response.status);
    }

    return await response.json();
  } catch (error) {
    if (window.location.protocol === "file:") {
      throw new Error(
        "The dashboard must be served over HTTP so the browser can load data.json. " +
        "Run `python -m http.server 8000` in this folder, then open http://localhost:8000."
      );
    }

    throw error;
  }
}

function normalizeInput(json) {
  if (Array.isArray(json)) {
    return json.map(normalizeRow);
  }

  if (json && Array.isArray(json.items)) {
    return json.items.map(normalizeRow);
  }

  throw new Error("data.json must be an array or an object with an items array.");
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
    throw new Error("data.json does not contain any rows.");
  }

  const missing = [];

  rows.forEach(function (row, index) {
    if (!row.ticker) missing.push("row " + index + ": missing Ticker");
    if (!row.category) missing.push("row " + index + ": missing Category");
    if (!row.strategy) missing.push("row " + index + ": missing strategy");
    if (!row.period) missing.push("row " + index + ": missing period");
  });

  if (missing.length > 0) {
    throw new Error("Required column issue(s):\n" + missing.slice(0, 15).join("\n"));
  }

  const hasOneYear = rows.some(function (row) {
    return row.period === "1Y";
  });

  if (!hasOneYear) {
    throw new Error("At least one row with period equal to 1Y is required.");
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

  dom.tableTitle.textContent = "Strategy " + activeStrategy + " - Latest 1Y Performance";

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
    metric("Return", "percent", "Average total return", data, "totalReturn"),
    metric("CAGR", "percent", "Average annualized return", data, "cagr"),
    metric("MDD", "percent", "Average max drawdown", data, "mdd"),
    metric("Sharpe", "number", "Risk-adjusted return", data, "sharpe"),
    metric("Calmar", "number", "CAGR divided by MDD", data, "calmar"),
    metric("Profit Factor", "number", "Gross profit / gross loss", data, "profitFactor"),
    metric("Expectancy", "number", "Expected value per trade", data, "expectancy")
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
  const good = countBy(data, function (item) {
    return item.periods["1Y"].grade === "Good";
  });
  const normal = countBy(data, function (item) {
    return item.periods["1Y"].grade === "Normal";
  });
  const bad = countBy(data, function (item) {
    return item.periods["1Y"].grade === "Bad";
  });

  dom.totalEtfCount.textContent = String(total);
  dom.goodCount.textContent = String(good);
  dom.normalCount.textContent = String(normal);
  dom.badCount.textContent = String(bad);

  dom.gradeRatio.innerHTML = ratioHtml([
    ["ratio-good", good],
    ["ratio-normal", normal],
    ["ratio-bad", bad]
  ]);
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
      + '<td colspan="13" style="text-align:center; padding:32px; color:#94a3b8;">'
      + 'No ETFs match the current filters.'
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
      + periodCardRow("Return", p.totalReturn, "percent")
      + periodCardRow("CAGR", p.cagr, "percent")
      + periodCardRow("Sharpe", p.sharpe, "number")
      + periodCardRow("MDD", p.mdd, "percent")
      + '</div>';
  }).join("");
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
    dom.periodCompareChart.innerHTML = '<p style="color:#94a3b8;">No period data is available.</p>';
    return;
  }

  const chartMetrics = [
    { key: "totalReturn", label: "Total Return", type: "percent", mode: "positive" },
    { key: "cagr", label: "CAGR", type: "percent", mode: "positive" },
    { key: "sharpe", label: "Sharpe", type: "number", mode: "positive" },
    { key: "mdd", label: "MDD", type: "percent", mode: "absolute" },
    { key: "calmar", label: "Calmar", type: "number", mode: "positive" },
    { key: "profitFactor", label: "Profit Factor", type: "number", mode: "positive" },
    { key: "expectancy", label: "Expectancy", type: "number", mode: "positive" }
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

  if (normalized === "Good") {
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
      '<strong>Data loading or rendering error</strong><br>'
      + escapeHtml(error.message).replace(/\n/g, "<br>")
      + '<br><br>'
      + 'Check these items:'
      + '<br>1. index.html, style.css, app.js, and data.json are in the same folder'
      + '<br>2. data.json has at least one row with period equal to 1Y'
      + '<br>3. If the address starts with file://, run the local HTTP server';
  }

  if (dom.tableBody) {
    dom.tableBody.innerHTML =
      '<tr>'
      + '<td colspan="13" style="text-align:center; padding:32px; color:#fecaca;">'
      + 'Failed to load data'
      + '</td>'
      + '</tr>';
  }
}
