"use strict";

const THEME_STORAGE_KEY = "etfDashboardTheme";
const ALL_FILTER = "__ALL__";
const MAIN_PERIOD = "10y";
const PERIOD_DETAIL_ORDER = ["1y", "3y", "5y", "10y"];
const GRADE_ORDER = ["Best", "Good", "Normal", "Bad"];
const PREFERRED_DEFAULT_PERIODS = [MAIN_PERIOD, "total", "all", "5y", "3y", "1y"];
const PERCENT_COLUMNS = new Set(["Total Return", "CAGR", "MDD"]);
const KNOWN_NUMERIC_COLUMNS = new Set(["Total Return", "CAGR", "Sharpe", "MDD", "Calmar"]);
const DETAIL_METRIC_COLUMNS = ["Total Return", "CAGR", "Sharpe", "MDD", "Calmar"];
const DATE_COLUMNS = new Set(["first_date", "last_date"]);
const TEXT_DEFAULT_ASC_COLUMNS = new Set(["Ticker", "Category", "first_date", "last_date"]);
const COLUMN_LABELS = {
  Ticker: "티커",
  Category: "카테고리",
  period: "기간",
  first_date: "거래시작일",
  last_date: "거래종료일",
  "Total Return": "총수익률",
  CAGR: "연평균수익률",
  Sharpe: "샤프지수",
  MDD: "최대낙폭",
  Calmar: "칼마지수",
  Grade: "등급"
};

let rawRows = [];
let columns = [];
let visibleRows = [];
let tableSort = {
  key: "",
  direction: "asc"
};
let defaultPeriod = ALL_FILTER;

const dom = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    cacheDom();
    initializeTheme();
    bindEvents();
    showStatus("Yahoo Finance 데이터를 불러오는 중입니다...");

    const dataResult = await loadJson();
    rawRows = normalizeInput(dataResult.json);
    columns = inferColumns(rawRows);
    validateData(rawRows, columns);

    updateDataSourceMeta(dataResult.lastModified);
    setupControls();
    renderTableHead();
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
    "searchInput",
    "periodFilter",
    "gradeFilter",
    "sortSelect",
    "resetButton",
    "kpiCards",
    "gradeSummaryText",
    "gradeCounts",
    "gradeRatio",
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
    // Storage can be unavailable in private or restricted browser contexts.
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
      throw new Error(
        "브라우저 보안 정책 때문에 file:// 주소에서는 data.json을 읽을 수 없습니다. " +
        "이 폴더에서 HTTP 서버로 실행한 뒤 접속해 주세요."
      );
    }

    throw error;
  }
}

function normalizeInput(json) {
  const rows = Array.isArray(json)
    ? json
    : json && Array.isArray(json.items)
      ? json.items
      : null;

  if (!rows) {
    throw new Error("data.json은 배열이거나 items 배열을 가진 객체여야 합니다.");
  }

  return rows.filter(function (row) {
    return row && typeof row === "object" && !Array.isArray(row);
  });
}

function inferColumns(rows) {
  const seen = new Set();
  const result = [];

  rows.forEach(function (row) {
    Object.keys(row).forEach(function (key) {
      if (!seen.has(key)) {
        seen.add(key);
        result.push(key);
      }
    });
  });

  return result;
}

function validateData(rows, columnList) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("data.json에 표시할 행이 없습니다.");
  }

  if (!Array.isArray(columnList) || columnList.length === 0) {
    throw new Error("data.json에서 컬럼을 찾을 수 없습니다.");
  }
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
  renderPeriodDistribution(getFilteredRows({ ignorePeriod: true }));
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
  const period = dom.periodFilter.value;
  const grade = dom.gradeFilter.value;
  const periodText = period === ALL_FILTER ? "전체 기간" : labelPeriod(period);
  const gradeText = grade === ALL_FILTER ? "전체 등급" : grade;
  const tickerCount = countUnique(visibleRows, "Ticker");

  dom.tableTitle.textContent = periodText + " ETF 성과";
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

function renderPeriodDistribution(rows) {
  if (columns.indexOf("period") < 0) {
    dom.periodSummaryText.textContent = "period 컬럼이 없습니다.";
    dom.periodCounts.innerHTML = "";
    dom.periodRatio.innerHTML = "";
    return;
  }

  const counts = countByValue(rows, "period", cleanText);
  const periods = Array.from(counts.keys()).sort(comparePeriodsForOptions);
  const total = rows.length;

  dom.periodSummaryText.textContent =
    total.toLocaleString("ko-KR") + "개 행 기준 · " +
    periods.length.toLocaleString("ko-KR") + "개 기간";
  dom.periodCounts.innerHTML = periods.map(function (period) {
    return renderCountCard([labelPeriod(period), counts.get(period), "period"]);
  }).join("");
  dom.periodRatio.innerHTML = renderRatio(
    periods.map(function (period, index) {
      return ["ratio-period-" + ((index % 4) + 1), counts.get(period) || 0];
    })
  );
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
    dom.tableBody.innerHTML =
      '<tr><td class="empty-cell" colspan="' + columns.length + '">조건에 맞는 데이터가 없습니다.</td></tr>';
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
  const category = cleanText(row.Category);
  const periodRows = getTickerPeriodRows(row);
  const mainRow = findPeriodRow(periodRows, MAIN_PERIOD) || row;
  const availablePeriods = periodRows.map(function (periodRow) {
    return labelPeriod(periodRow.period);
  }).join(" · ");

  dom.detailTicker.textContent = ticker;
  dom.detailSub.textContent = [category, availablePeriods].filter(Boolean).join(" · ") || "-";
  dom.detailBadges.innerHTML =
    (columns.indexOf("Grade") >= 0 ? gradeBadge(mainRow.Grade) : "") +
    (columns.indexOf("period") >= 0 ? periodBadge(MAIN_PERIOD) : "");

  renderPeriodSummaryCards(periodRows);
  renderPeriodMetricBars(periodRows);

  dom.detailDrawer.classList.add("open");
  dom.overlay.classList.add("open");
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
      return PERIOD_DETAIL_ORDER.indexOf(cleanText(candidate.period).toLowerCase()) >= 0;
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
  const index = PERIOD_DETAIL_ORDER.indexOf(cleanText(period).toLowerCase());

  return index >= 0 ? index : PERIOD_DETAIL_ORDER.length;
}

function renderPeriodSummaryCards(periodRows) {
  dom.periodSummaryCards.innerHTML = PERIOD_DETAIL_ORDER.map(function (period) {
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
  const rowsByPeriod = PERIOD_DETAIL_ORDER.map(function (period) {
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

  const lowerMap = new Map(
    periodValues.map(function (period) {
      return [period.toLowerCase(), period];
    })
  );

  for (let i = 0; i < PREFERRED_DEFAULT_PERIODS.length; i += 1) {
    const period = lowerMap.get(PREFERRED_DEFAULT_PERIODS[i]);

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
  } else if (column === "Category" || column === "Grade" || column === "period") {
    classes.push("text-cell");
  }

  if (isNumericColumn(column)) {
    classes.push(numberClass(value));
  }

  return classes.join(" ");
}

function numberClassForColumn(column, value) {
  return isNumericColumn(column) ? numberClass(value) : "";
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

function gradeBadge(value) {
  const normalized = normalizeGrade(value) || "Unknown";
  let className = "grade-unknown";

  if (normalized === "Best") className = "grade-best";
  if (normalized === "Good") className = "grade-good";
  if (normalized === "Normal") className = "grade-normal";
  if (normalized === "Bad") className = "grade-bad";

  return '<span class="grade-pill ' + className + '">' + escapeHtml(normalized) + '</span>';
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
