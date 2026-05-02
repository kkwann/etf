const BLOCKS = [
  ["momentum_block_score", "모멘텀"],
  ["trend_block_score", "추세"],
  ["volatility_block_score", "변동성"],
  ["liquidity_block_score", "유동성"],
  ["dividend_block_score", "배당"],
  ["risk_recovery_block_score", "리스크/회복"],
];

const INDICATOR_GROUPS = {
  "모멘텀": [
    ["ret_20d_score", "ret_20d"],
    ["ret_60d_score", "ret_60d"],
    ["ret_120d_score", "ret_120d"],
    ["ram_60_score", "ram_60"],
    ["ram_120_score", "ram_120"],
  ],
  "추세": [
    ["adj_ma200_diff_score", "adj_ma200_diff"],
    ["ma50_ma200_diff_score", "ma50_ma200_diff"],
  ],
  "변동성": [
    ["vol_20d_score", "vol_20d"],
    ["vol_60d_score", "vol_60d"],
    ["pct_b_20_score", "pct_b_20"],
    ["vol_spike_score", "vol_spike"],
  ],
  "유동성": [
    ["dollar_volume_ma20_score", "dollar_volume_ma20"],
    ["volume_ma20_score", "volume_ma20"],
  ],
  "배당": [
    ["dividend_yield_score", "dividend_yield"],
    ["dividend_growth_score", "dividend_growth"],
    ["dividend_cv_score", "dividend_cv"],
  ],
  "리스크/회복": [
    ["current_drawdown_score", "current_drawdown"],
    ["max_drawdown_score", "max_drawdown"],
    ["recovery_days_score", "recovery_days"],
  ],
};

const SIGNAL_ROWS = [
  ["ret_20d", "ret_20d_signal", "20일 수익률"],
  ["ret_60d", "ret_60d_signal", "60일 수익률"],
  ["ret_120d", "ret_120d_signal", "120일 수익률"],
  ["ram_60", "ram_60_signal", "RAM 60"],
  ["ram_120", "ram_120_signal", "RAM 120"],
  ["adj_ma200_diff", "adj_ma200_signal", "가격/MA200"],
  ["ma50_ma200_diff", "ma50_ma200_signal", "MA50/MA200"],
  ["pct_b_20", "pct_b_signal", "%B 20"],
  ["vol_spike", "vol_spike_signal", "Vol Spike"],
  ["volume_ma20", "volume_signal", "20일 평균 거래량"],
  ["dollar_volume_ma20", "dollar_volume_signal", "20일 평균 거래대금"],
  ["current_drawdown", "drawdown_signal", "현재 Drawdown"],
];

const state = {
  rows: [],
  ranking: [],
  signals: [],
  selectedTicker: null,
  sortKey: "final_score",
  sortDir: "desc",
};

const $ = (id) => document.getElementById(id);

function n(value, digits = 1) {
  const x = Number(value);
  if (!Number.isFinite(x)) return "-";
  return x.toFixed(digits);
}

function pct(value, digits = 1) {
  const x = Number(value);
  if (!Number.isFinite(x)) return "-";
  return `${(x * 100).toFixed(digits)}%`;
}

function compact(value) {
  const x = Number(value);
  if (!Number.isFinite(x)) return "-";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(x);
}

function formatMetric(key, value) {
  if (value === null || value === undefined || value === "") return "-";
  const x = Number(value);
  if (!Number.isFinite(x)) return String(value);

  if (
    key.includes("ret_") ||
    key.includes("ram_") === false && key.includes("diff") ||
    key.includes("drawdown") ||
    key.includes("dividend_yield") ||
    key.includes("dividend_growth")
  ) {
    return pct(x, 2);
  }

  if (key.includes("vol_")) return pct(x, 2);
  if (key.includes("dollar_volume")) return `$${compact(x)}`;
  if (key.includes("volume")) return compact(x);
  if (key.includes("pct_b")) return n(x, 2);
  if (key.includes("spike")) return n(x, 2);
  if (key.includes("recovery_days")) return `${Math.round(x)}일`;
  if (key.includes("cv")) return n(x, 2);
  return n(x, 2);
}

function decisionClass(decision) {
  return `decision-${decision || "WAIT"}`;
}

function decisionBadge(decision) {
  const d = decision || "WAIT";
  return `<span class="decision-badge ${decisionClass(d)}">${d}</span>`;
}

function booleanBadge(value) {
  const v = Number(value) === 1 ? 1 : 0;
  return `<span class="boolean-badge boolean-${v}">${v ? "PASS" : "FAIL"}</span>`;
}

function normalizeRow(rankingRow, signalRow) {
  return {
    ...rankingRow,
    ...(signalRow || {}),
    Ticker: rankingRow.Ticker || signalRow?.Ticker,
    final_decision: signalRow?.final_decision || rankingRow.final_decision || "WAIT",
    decision_reason: signalRow?.decision_reason || rankingRow.decision_reason || "",
  };
}

async function loadData() {
  const response = await fetch("./data.json", { cache: "no-store" });
  if (!response.ok) throw new Error("data.json을 불러오지 못했습니다.");
  const data = await response.json();

  state.ranking = data.ranking || [];
  state.signals = data.signals || [];

  const signalMap = new Map(state.signals.map((x) => [String(x.Ticker), x]));
  state.rows = state.ranking.map((r) => normalizeRow(r, signalMap.get(String(r.Ticker))));

  const fallbackSignals = state.signals.filter((s) => !state.ranking.some((r) => String(r.Ticker) === String(s.Ticker)));
  fallbackSignals.forEach((s) => state.rows.push(normalizeRow({}, s)));

  const signalDate = data.meta?.signal_date || state.rows[0]?.signal_date || "-";
  const generatedAt = data.meta?.generated_at || "-";
  $("signalDate").textContent = signalDate;
  $("generatedAt").textContent = `생성: ${generatedAt}`;

  render();
  if (state.rows.length > 0) {
    selectTicker(state.rows[0].Ticker);
  }
}

function filteredRows() {
  const q = $("searchInput").value.trim().toUpperCase();
  const decision = $("decisionFilter").value;
  const scoreFilter = $("scoreFilter").value;

  return state.rows.filter((row) => {
    const tickerOk = !q || String(row.Ticker || "").toUpperCase().includes(q);
    const decisionOk = decision === "ALL" || row.final_decision === decision;

    let scoreOk = true;
    if (scoreFilter === "FIRST") scoreOk = row.first_filter_pass === true || row.first_filter_pass === 1;
    if (scoreFilter === "70") scoreOk = Number(row.final_score) >= 70;
    if (scoreFilter === "60") scoreOk = Number(row.final_score) >= 60;

    return tickerOk && decisionOk && scoreOk;
  });
}

function sortedRows(rows) {
  const key = state.sortKey;
  const dir = state.sortDir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];

    const an = Number(av);
    const bn = Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn)) return (an - bn) * dir;

    return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
  });
}

function renderSummary(rows) {
  const buy = rows.filter((r) => r.final_decision === "BUY").length;
  const hold = rows.filter((r) => r.final_decision === "HOLD").length;
  const sell = rows.filter((r) => r.final_decision === "SELL").length;
  const avg = rows.reduce((acc, r) => acc + (Number(r.final_score) || 0), 0) / Math.max(rows.length, 1);

  $("summaryCards").innerHTML = `
    <div class="summary-card"><span class="label">표시 ETF</span><strong>${rows.length}</strong></div>
    <div class="summary-card"><span class="label">BUY</span><strong>${buy}</strong></div>
    <div class="summary-card"><span class="label">HOLD</span><strong>${hold}</strong></div>
    <div class="summary-card"><span class="label">SELL</span><strong>${sell}</strong></div>
    <div class="summary-card"><span class="label">평균 최종점수</span><strong>${n(avg, 1)}</strong></div>
  `;
}

function renderTable(rows) {
  const body = $("rankingBody");
  body.innerHTML = rows.map((row) => `
    <tr data-ticker="${row.Ticker}" class="${row.Ticker === state.selectedTicker ? "active" : ""}">
      <td>${row.final_rank ? Math.round(Number(row.final_rank)) : "-"}</td>
      <td class="ticker-cell">${row.Ticker || "-"}</td>
      <td><span class="score-pill">${n(row.final_score, 1)}</span></td>
      <td>${n(row.momentum_block_score, 1)}</td>
      <td>${n(row.trend_block_score, 1)}</td>
      <td>${n(row.volatility_block_score, 1)}</td>
      <td>${n(row.liquidity_block_score, 1)}</td>
      <td>${n(row.dividend_block_score, 1)}</td>
      <td>${n(row.risk_recovery_block_score, 1)}</td>
      <td>${decisionBadge(row.final_decision)}</td>
    </tr>
  `).join("");

  body.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => selectTicker(tr.dataset.ticker));
  });
}

function render() {
  const rows = sortedRows(filteredRows());
  renderSummary(rows);
  renderTable(rows);
}

function selectTicker(ticker) {
  state.selectedTicker = ticker;
  const row = state.rows.find((r) => String(r.Ticker) === String(ticker));
  if (!row) return;

  document.querySelectorAll("tbody tr").forEach((tr) => {
    tr.classList.toggle("active", tr.dataset.ticker === String(ticker));
  });

  $("detailEmpty").classList.add("hidden");
  $("detailContent").classList.remove("hidden");

  $("detailTicker").textContent = row.Ticker;
  $("detailDecision").outerHTML = `<span id="detailDecision" class="decision-badge ${decisionClass(row.final_decision)}">${row.final_decision || "WAIT"}</span>`;
  $("detailFinalScore").textContent = n(row.final_score, 1);
  $("detailRank").textContent = row.final_rank ? Math.round(Number(row.final_rank)) : "-";
  $("detailReliability").textContent = n(row.reliability, 2);

  renderBlockScores(row);
  renderIndicatorScores(row);
  renderSignals(row);

  $("decisionReason").textContent = row.decision_reason || "-";
}

function renderBlockScores(row) {
  $("blockScores").innerHTML = BLOCKS.map(([key, label]) => {
    const value = Number(row[key]);
    const width = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    return `
      <div class="score-row">
        <div class="score-row-head">
          <strong>${label}</strong>
          <span>${n(value, 1)}</span>
        </div>
        <div class="bar"><span style="width:${width}%"></span></div>
      </div>
    `;
  }).join("");
}

function renderIndicatorScores(row) {
  $("indicatorScores").innerHTML = Object.entries(INDICATOR_GROUPS).map(([group, items]) => {
    const itemHtml = items.map(([key, label]) => {
      const value = Number(row[key]);
      const width = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
      return `
        <div class="indicator-item">
          <div>
            <div class="indicator-name">${label}</div>
            <div class="bar"><span style="width:${width}%"></span></div>
          </div>
          <strong>${n(value, 1)}</strong>
        </div>
      `;
    }).join("");

    return `
      <div class="indicator-group">
        <h4>${group}</h4>
        ${itemHtml}
      </div>
    `;
  }).join("");
}

function renderSignals(row) {
  $("signalSummary").innerHTML = `
    <div class="signal-card"><span>모멘텀</span><strong>${row.momentum_signal_count ?? "-"} / 5</strong></div>
    <div class="signal-card"><span>추세</span>${booleanBadge(row.trend_signal)}</div>
    <div class="signal-card"><span>변동성</span>${booleanBadge(row.volatility_signal)}</div>
    <div class="signal-card"><span>유동성</span>${booleanBadge(row.liquidity_signal)}</div>
    <div class="signal-card"><span>리스크</span>${booleanBadge(row.risk_signal)}</div>
    <div class="signal-card"><span>1차 필터</span>${booleanBadge(row.first_filter_pass ? 1 : 0)}</div>
  `;

  $("signalTable").innerHTML = SIGNAL_ROWS.map(([valueKey, signalKey, label]) => {
    const value = formatMetric(valueKey, row[valueKey]);
    const sig = row[signalKey];
    return `
      <div class="mini-row">
        <span>${label}</span>
        <strong>${value}</strong>
        ${booleanBadge(sig)}
      </div>
    `;
  }).join("");
}

function attachEvents() {
  $("searchInput").addEventListener("input", render);
  $("decisionFilter").addEventListener("change", render);
  $("scoreFilter").addEventListener("change", render);

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "Ticker" || key === "final_decision" ? "asc" : "desc";
      }
      render();
    });
  });
}

attachEvents();
loadData().catch((err) => {
  console.error(err);
  $("rankingBody").innerHTML = `
    <tr>
      <td colspan="10">
        data.json을 불러오지 못했습니다. GitHub Pages 같은 정적 서버에서 실행하거나 data.json 경로를 확인하세요.
      </td>
    </tr>
  `;
});
