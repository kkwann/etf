const DATA_URL = "./data/dashboard_data.json";
const ALL = "?꾩껜";
const GRADE_ORDER = ["A", "B", "C", "D"];
const METHODS = {
  method1: "Momentum",
  method2: "Risk / Defense",
  method3: "Trend Quality",
  method4: "Liquidity / Flow",
  method5: "Mean Reversion",
  method6: "Income / Dividend Event",
};

const state = {
  rawData: [],
  filteredData: [],
  metadata: {},
  selectedIndex: -1,
  sortKey: "scores.total_score",
  sortDir: "desc",
  theme: localStorage.getItem("etf_theme") || "dark",
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const els = {
  metaAsOf: $("#metaAsOf"),
  metaUpdated: $("#metaUpdated"),
  metaCurrency: $("#metaCurrency"),
  metaModel: $("#metaModel"),
  summaryCards: $("#summaryCards"),
  resultCount: $("#resultCount"),
  searchInput: $("#searchInput"),
  assetFilter: $("#assetFilter"),
  strategyFilter: $("#strategyFilter"),
  dividendFilter: $("#dividendFilter"),
  gradeFilter: $("#gradeFilter"),
  minScoreInput: $("#minScoreInput"),
  activeFilters: $("#activeFilters"),
  tableBody: $("#tableBody"),
  tableEmpty: $("#tableEmpty"),
  detailDrawer: $("#detailDrawer"),
  detailTitle: $("#detailTitle"),
  drawerContent: $("#drawerContent"),
  prevBtn: $("#prevBtn"),
  nextBtn: $("#nextBtn"),
  closeDrawerBtn: $("#closeDrawerBtn"),
  themeToggle: $("#themeToggle"),
  downloadJsonBtn: $("#downloadJsonBtn"),
};

void init();

async function init() {
  applyTheme(state.theme);
  bindEvents();
  await loadData();
}

function bindEvents() {
  ["searchInput", "assetFilter", "strategyFilter", "dividendFilter", "gradeFilter", "minScoreInput"].forEach((key) => {
    els[key].addEventListener(key === "searchInput" || key === "minScoreInput" ? "input" : "change", applyFiltersAndRender);
  });

  $$("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDir = key === "ticker" ? "asc" : "desc";
      }
      renderTable();
    });
  });

  els.themeToggle.addEventListener("click", () => applyTheme(document.body.classList.contains("light") ? "dark" : "light"));
  els.downloadJsonBtn.addEventListener("click", downloadJson);
  els.closeDrawerBtn.addEventListener("click", closeDrawer);
  els.prevBtn.addEventListener("click", () => moveSelection(-1));
  els.nextBtn.addEventListener("click", () => moveSelection(1));

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.matches('[data-close-drawer="true"]')) closeDrawer();
    if (target instanceof HTMLButtonElement && target.dataset.clearFilter) clearFilter(target.dataset.clearFilter);
  });

  document.addEventListener("keydown", (event) => {
    if (!els.detailDrawer.classList.contains("is-open")) return;
    if (event.key === "Escape") closeDrawer();
    if (event.key === "ArrowLeft") moveSelection(-1);
    if (event.key === "ArrowRight") moveSelection(1);
  });
}

async function loadData() {
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.metadata = payload.metadata || {};
    state.rawData = (payload.data || []).map(normalizeItem);
    populateFilters();
    renderMeta();
    applyFiltersAndRender();
  } catch (error) {
    console.error(error);
    els.summaryCards.innerHTML = `
      <article class="summary-card">
        <div class="summary-card__label">?곗씠??濡쒕뵫 ?ㅽ뙣</div>
        <div class="summary-card__value">Error</div>
        <div class="summary-card__sub"><code>data/dashboard_data.json</code> 寃쎈줈???뺤쟻 ?몄뒪???섍꼍???뺤씤??二쇱꽭??</div>
      </article>`;
    els.tableEmpty.classList.remove("hidden");
    els.tableEmpty.textContent = "JSON ?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲?? file:// ????뺤쟻 ?쒕쾭 ?먮뒗 ?뱁샇?ㅽ똿?먯꽌 ?댁뼱 二쇱꽭??";
  }
}

function normalizeItem(item) {
  const scores = item.scores || {};
  const summary = item.summary || {};
  const features = item.features || {};
  return {
    ...item,
    rank: n(scores.rank ?? item.rank ?? 999),
    scores: {
      method1: n(scores.method1),
      method2: n(scores.method2),
      method3: n(scores.method3),
      method4: n(scores.method4),
      method5: n(scores.method5),
      method6: n(scores.method6),
      total_score: n(scores.total_score),
      grade: scores.grade || "D",
      rank: n(scores.rank ?? item.rank ?? 999),
    },
    summary: {
      best_for: summary.best_for || "-",
      comment: summary.comment || "-",
      risk_note: summary.risk_note || "-",
      tags: Array.isArray(summary.tags) ? summary.tags : splitPipe(summary.tags),
      signal_badges: Array.isArray(summary.signal_badges) ? summary.signal_badges : splitPipe(summary.signal_badges),
    },
    features: {
      ret_5d: n(features.ret_5d),
      ret_20d: n(features.ret_20d),
      ret_60d: n(features.ret_60d),
      ret_120d: n(features.ret_120d),
      ret_240d: n(features.ret_240d),
      vol_20d_ann: n(features.vol_20d_ann),
      vol_60d_ann: n(features.vol_60d_ann),
      downside_vol_20d_ann: n(features.downside_vol_20d_ann),
      drawdown_60d: n(features.drawdown_60d),
      ma_gap_20: n(features.ma_gap_20),
      ma_gap_50: n(features.ma_gap_50),
      ma_gap_200: n(features.ma_gap_200),
      rsi_14: n(features.rsi_14),
      bb_z_20: n(features.bb_z_20),
      dist_yield_ttm: n(features.dist_yield_ttm),
      dist_ttm: n(features.dist_ttm),
      total_distribution: n(features.total_distribution),
      trading_value: n(features.trading_value),
      avg_trading_value_20d: n(features.avg_trading_value_20d),
      avg_volume_20d: n(features.avg_volume_20d),
      volume_ratio_20d: n(features.volume_ratio_20d),
      obv: n(features.obv),
      obv_ma_20: n(features.obv_ma_20),
      exdiv_gap_rate: n(features.exdiv_gap_rate),
      div_drop_ratio: n(features.div_drop_ratio),
      is_dividend_event: Boolean(features.is_dividend_event),
      ma_20: n(features.ma_20),
      ma_50: n(features.ma_50),
      ma_200: n(features.ma_200),
      hh_20: n(features.hh_20),
      hh_60: n(features.hh_60),
      hh_120: n(features.hh_120),
    },
  };
}

function renderMeta() {
  els.metaAsOf.textContent = state.metadata.asof_date || "-";
  els.metaUpdated.textContent = formatDateTime(state.metadata.updated_at);
  els.metaCurrency.textContent = state.metadata.currency || "-";
  els.metaModel.textContent = state.metadata.scoring_model?.name || "-";
}

function populateFilters() {
  fillSelect(els.assetFilter, [ALL, ...unique(state.rawData.map((item) => item.asset_class))]);
  fillSelect(els.strategyFilter, [ALL, ...unique(state.rawData.map((item) => item.strategy_family))]);
  fillSelect(els.dividendFilter, [ALL, ...unique(state.rawData.map((item) => item.dividend_frequency))]);
  fillSelect(els.gradeFilter, [ALL, ...GRADE_ORDER]);
}

function fillSelect(el, values) {
  el.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function applyFiltersAndRender() {
  const query = els.searchInput.value.trim().toLowerCase();
  const asset = els.assetFilter.value;
  const strategy = els.strategyFilter.value;
  const dividend = els.dividendFilter.value;
  const grade = els.gradeFilter.value;
  const minScore = n(els.minScoreInput.value);

  state.filteredData = state.rawData.filter((item) => {
    const text = [
      item.ticker, item.name, item.asset_class, item.strategy_family,
      item.summary.best_for, item.summary.comment, item.summary.risk_note,
      ...item.summary.tags, ...item.summary.signal_badges,
    ].join(" ").toLowerCase();

    return (!query || text.includes(query)) &&
      (asset === ALL || item.asset_class === asset) &&
      (strategy === ALL || item.strategy_family === strategy) &&
      (dividend === ALL || item.dividend_frequency === dividend) &&
      (grade === ALL || gradeRank(item.scores.grade) <= gradeRank(grade)) &&
      item.scores.total_score >= minScore;
  });

  renderActiveFilters();
  renderSummary();
  renderTable();
  if (state.selectedIndex >= 0 && !state.filteredData[state.selectedIndex]) closeDrawer();
}

function renderActiveFilters() {
  const pills = [];
  if (els.searchInput.value.trim()) pills.push(pill(`寃?? ${els.searchInput.value.trim()}`, "search"));
  if (els.assetFilter.value !== ALL) pills.push(pill(`?먯궛援? ${els.assetFilter.value}`, "asset"));
  if (els.strategyFilter.value !== ALL) pills.push(pill(`?꾨왂援? ${els.strategyFilter.value}`, "strategy"));
  if (els.dividendFilter.value !== ALL) pills.push(pill(`諛곕떦二쇨린: ${els.dividendFilter.value}`, "dividend"));
  if (els.gradeFilter.value !== ALL) pills.push(pill(`理쒖냼 ?깃툒: ${els.gradeFilter.value}`, "grade"));
  if (n(els.minScoreInput.value) > 0) pills.push(pill(`理쒖냼 珥앹젏: ${els.minScoreInput.value}`, "minScore"));
  els.activeFilters.innerHTML = pills.join("");
}

function pill(label, key) {
  return `<span class="filter-pill">${label} <button type="button" data-clear-filter="${key}" aria-label="${label} ?쒓굅">횞</button></span>`;
}

function clearFilter(key) {
  if (key === "search") els.searchInput.value = "";
  if (key === "asset") els.assetFilter.value = ALL;
  if (key === "strategy") els.strategyFilter.value = ALL;
  if (key === "dividend") els.dividendFilter.value = ALL;
  if (key === "grade") els.gradeFilter.value = ALL;
  if (key === "minScore") els.minScoreInput.value = "0";
  applyFiltersAndRender();
}

function renderSummary() {
  const items = state.filteredData;
  const top = sort([...items], "scores.total_score", "desc")[0];
  const cards = [
    ["?쒖떆 ETF ??, `${items.length}`, `?꾩껜 ${state.rawData.length}媛?以??꾩옱 ?꾪꽣瑜??듦낵??醫낅ぉ ??],
    ["?됯퇏 珥앹젏", f(avg(items.map((item) => item.scores.total_score)), 1), "?꾩옱 ?붾㈃???쒖떆??ETF?ㅼ쓽 珥앹젏 ?됯퇏"],
    ["?곸쐞 ETF", top ? top.ticker : "-", top ? `${top.name} 쨌 珥앹젏 ${f(top.scores.total_score, 1)} 쨌 ?깃툒 ${top.scores.grade}` : "?곗씠???놁쓬"],
    ["?됯퇏 TTM 遺꾨같?섏씡瑜?, `${f(avg(items.map((item) => item.features.dist_yield_ttm)), 2)}%`, "?몄뺨 愿???됯퇏"],
    ["諛곕떦 ?대깽??ETF", `${items.filter((item) => item.features.is_dividend_event).length}`, "?꾩옱 ?꾪꽣 寃곌낵 湲곗? 諛곕떦 ?대깽??諛쒖깮 ??],
    ["?됯퇏 20D 蹂?숈꽦", `${f(avg(items.map((item) => item.features.vol_20d_ann)), 1)}%`, "?④린 蹂?숈꽦 ?됯퇏"],
    ["?곸쐞 3媛??됯퇏 3M ?섏씡瑜?, `${f(avg(sort([...items], "features.ret_60d", "desc").slice(0, 3).map((item) => item.features.ret_60d)), 1)}%`, "理쒓렐 60???섏씡瑜??곸쐞 ETF ?됯퇏"],
    ["?됯퇏 嫄곕옒?湲?20D)", money(avg(items.map((item) => item.features.avg_trading_value_20d))), "理쒓렐 ?됯퇏 嫄곕옒?湲?],
    ["?댁쁺 諛⑹떇", "?뺤쟻 ??, "HTML? 怨좎젙?섍퀬 JSON留?援먯껜"],
  ];

  els.summaryCards.innerHTML = cards.map(([label, value, sub]) => `
    <article class="summary-card">
      <div class="summary-card__label">${label}</div>
      <div class="summary-card__value">${value}</div>
      <div class="summary-card__sub">${sub}</div>
    </article>`).join("");
}

function renderTable() {
  const rows = sort([...state.filteredData], state.sortKey, state.sortDir);
  state.filteredData = rows;
  els.resultCount.textContent = String(rows.length);
  els.tableEmpty.classList.toggle("hidden", rows.length !== 0);
  els.tableBody.innerHTML = rows.map((item, index) => `
    <tr data-index="${index}">
      <td><span class="rank-chip">#${item.scores.rank}</span></td>
      <td><div class="ticker-cell">${item.ticker}<small>${item.name}</small></div></td>
      <td>${item.asset_class}</td>
      <td>${item.strategy_family}</td>
      <td>${f(item.scores.total_score, 1)}</td>
      <td><span class="grade-badge grade-${item.scores.grade}">${item.scores.grade}</span></td>
      <td class="${numClass(item.features.ret_60d)}">${signed(item.features.ret_60d, 1)}%</td>
      <td>${f(item.features.vol_20d_ann, 1)}%</td>
      <td>${f(item.features.dist_yield_ttm, 2)}%</td>
      <td>$${f(item.close, 2)}</td>
    </tr>`).join("");
  $$("#tableBody tr").forEach((row) => row.addEventListener("click", () => openDrawer(Number(row.dataset.index))));
}

function openDrawer(index) {
  state.selectedIndex = index;
  const item = state.filteredData[index];
  if (!item) return;
  const s = item.scores;
  const t = item.summary;
  const x = item.features;
  els.detailTitle.textContent = `${item.ticker} ?곸꽭 遺꾩꽍`;
  els.drawerContent.innerHTML = `
    <section class="detail-block detail-hero">
      <div class="detail-title">
        <div>
          <div class="eyebrow">${item.asset_class} 쨌 ${item.strategy_family}</div>
          <h3>${item.ticker}</h3>
          <p>${item.name}</p>
        </div>
        <div class="tag-list">
          <span class="grade-badge grade-${s.grade}">?깃툒 ${s.grade}</span>
          <span class="chip">Rank #${s.rank}</span>
          <span class="chip">${item.dividend_frequency}</span>
          <span class="chip">${item.region}</span>
        </div>
      </div>
      <div class="detail-stats">
        ${mini("珥앹젏", f(s.total_score, 1))}
        ${mini("醫낃?", `$${f(item.close, 2)}`)}
        ${mini("AUM", `$${f(item.aum_billion, 1)}B`)}
        ${mini("蹂댁닔", `${f(item.expense_ratio, 2)}%`)}
      </div>
    </section>
    <section class="score-grid">
      <article class="detail-block">
        <div class="section-head"><div><h2>?먯닔 援ъ꽦</h2><p>method1~6 ?먯닔濡?ETF ?꾨왂 ?곹빀?꾨? ?붿빟?⑸땲??</p></div></div>
        <div class="scorebars">${Object.keys(METHODS).map((key) => `
          <div class="bar-row">
            <span>${METHODS[key]}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, n(s[key])))}%"></div></div>
            <strong>${f(s[key], 1)}</strong>
          </div>`).join("")}
        </div>
      </article>
      <article class="detail-block">
        <div class="section-head"><div><h2>?댁꽍 ?붿빟</h2><p>?먯닔? 肄붾찘?몃? ?④퍡 蹂닿퀬 ?깃꺽??鍮좊Ⅴ寃??뚯븙?⑸땲??</p></div></div>
        <div class="metric-list">
          <div class="metric-item"><span>異붿쿇 ?⑸룄</span><strong>${t.best_for}</strong></div>
          <div class="metric-item"><span>肄붾찘??/span><strong>${t.comment}</strong></div>
          <div class="metric-item"><span>由ъ뒪??/span><strong>${t.risk_note}</strong></div>
        </div>
        <div style="height:12px"></div>
        <div class="tag-list">${t.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
        <div style="height:12px"></div>
        <div class="badge-list">${t.signal_badges.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
      </article>
    </section>
    <section class="detail-grid">
      ${card("?섏씡瑜?/ 紐⑤찘?", [
        ["5D ?섏씡瑜?, `${signed(x.ret_5d, 1)}%`, numClass(x.ret_5d)],
        ["20D ?섏씡瑜?, `${signed(x.ret_20d, 1)}%`, numClass(x.ret_20d)],
        ["60D ?섏씡瑜?, `${signed(x.ret_60d, 1)}%`, numClass(x.ret_60d)],
        ["120D ?섏씡瑜?, `${signed(x.ret_120d, 1)}%`, numClass(x.ret_120d)],
        ["240D ?섏씡瑜?, `${signed(x.ret_240d, 1)}%`, numClass(x.ret_240d)],
      ])}
      ${card("蹂?숈꽦 / 由ъ뒪??, [
        ["20D ?고솚??蹂?숈꽦", `${f(x.vol_20d_ann, 1)}%`],
        ["60D ?고솚??蹂?숈꽦", `${f(x.vol_60d_ann, 1)}%`],
        ["20D ?섎씫 蹂?숈꽦", `${f(x.downside_vol_20d_ann, 1)}%`],
        ["60D Drawdown", `${signed(x.drawdown_60d, 1)}%`, numClass(x.drawdown_60d)],
        ["諛곕떦 ?대깽???щ?", x.is_dividend_event ? "True" : "False"],
      ])}
      ${card("異붿꽭 / ?대룞?됯퇏", [
        ["MA 20", `$${f(x.ma_20, 2)}`], ["MA 50", `$${f(x.ma_50, 2)}`], ["MA 200", `$${f(x.ma_200, 2)}`],
        ["MA Gap 20", `${signed(x.ma_gap_20, 1)}%`, numClass(x.ma_gap_20)],
        ["MA Gap 50", `${signed(x.ma_gap_50, 1)}%`, numClass(x.ma_gap_50)],
        ["MA Gap 200", `${signed(x.ma_gap_200, 1)}%`, numClass(x.ma_gap_200)],
        ["HH 20", `$${f(x.hh_20, 2)}`], ["HH 60", `$${f(x.hh_60, 2)}`], ["HH 120", `$${f(x.hh_120, 2)}`],
      ])}
      ${card("?좊룞??/ ?섍툒", [
        ["?뱀씪 嫄곕옒?湲?, money(x.trading_value)],
        ["20D ?됯퇏 嫄곕옒?湲?, money(x.avg_trading_value_20d)],
        ["20D ?됯퇏 嫄곕옒??, integer(x.avg_volume_20d)],
        ["嫄곕옒??鍮꾩쑉", `${f(x.volume_ratio_20d, 2)}x`],
        ["OBV", integer(x.obv)],
        ["OBV MA 20", integer(x.obv_ma_20)],
      ])}
      ${card("?됯퇏?뚭? / 怨쇱뿴쨌怨쇰ℓ??, [
        ["RSI 14", f(x.rsi_14, 1)],
        ["BB Z 20", signed(x.bb_z_20, 2), numClass(-x.bb_z_20)],
        ["Ex-div Gap", `${signed(x.exdiv_gap_rate, 2)}%`, numClass(x.exdiv_gap_rate)],
        ["Div Drop Ratio", f(x.div_drop_ratio, 2)],
        ["諛섏쟾 ?댁꽍", meanText(x)],
      ])}
      ${card("諛곕떦 / ?몄뺨", [
        ["珥?遺꾨같湲?, `$${f(x.total_distribution, 2)}`],
        ["TTM 遺꾨같湲?, `$${f(x.dist_ttm, 2)}`],
        ["TTM 遺꾨같?섏씡瑜?, `${f(x.dist_yield_ttm, 2)}%`],
        ["?몄뺨 ?댁꽍", incomeText(x)],
      ])}
    </section>
    <p class="footer-note">?댄썑 ?ㅼ젣 ?곗씠?곕룄 媛숈? JSON ?ㅽ궎留덈줈 蹂?섑빐 <code>dashboard_data.json</code>留?援먯껜?섎㈃ 媛숈? HTML??洹몃?濡??ъ슜?????덉뒿?덈떎.</p>`;
  els.detailDrawer.classList.add("is-open");
  els.detailDrawer.setAttribute("aria-hidden", "false");
  els.prevBtn.disabled = index <= 0;
  els.nextBtn.disabled = index >= state.filteredData.length - 1;
}

function closeDrawer() {
  els.detailDrawer.classList.remove("is-open");
  els.detailDrawer.setAttribute("aria-hidden", "true");
  state.selectedIndex = -1;
}

function moveSelection(step) {
  if (!state.filteredData.length) return;
  const next = Math.max(0, Math.min(state.filteredData.length - 1, state.selectedIndex + step));
  openDrawer(next);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify({ metadata: state.metadata, data: state.rawData }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dashboard_data.json";
  link.click();
  URL.revokeObjectURL(url);
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle("light", theme === "light");
  localStorage.setItem("etf_theme", theme);
  els.themeToggle.textContent = theme === "light" ? "?쇱씠??紐⑤뱶" : "?ㅽ겕 紐⑤뱶";
}

function card(title, rows) {
  return `<article class="metric-card"><h4>${title}</h4><div class="metric-list">${rows.map(([label, value, cls = ""]) => `
    <div class="metric-item"><span>${label}</span><strong class="${cls}">${value}</strong></div>`).join("")}</div></article>`;
}

function mini(label, value) {
  return `<div class="stat-mini"><div class="stat-mini__label">${label}</div><div class="stat-mini__value">${value}</div></div>`;
}

function sort(list, key, dir) {
  const factor = dir === "asc" ? 1 : -1;
  return list.sort((a, b) => {
    const av = deep(a, key);
    const bv = deep(b, key);
    return (typeof av === "string" || typeof bv === "string" ? String(av).localeCompare(String(bv), "ko") : n(av) - n(bv)) * factor;
  });
}

function deep(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function splitPipe(value) {
  return value ? String(value).split("|").map((item) => item.trim()).filter(Boolean) : [];
}

function gradeRank(grade) {
  const index = GRADE_ORDER.indexOf(grade);
  return index < 0 ? GRADE_ORDER.length : index;
}

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + n(value), 0) / values.length : 0;
}

function f(value, digits) {
  return n(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function signed(value, digits) {
  const num = n(value);
  return `${num > 0 ? "+" : ""}${f(num, digits)}`;
}

function money(value) {
  const num = n(value);
  if (num >= 1e9) return `$${f(num / 1e9, 2)}B`;
  if (num >= 1e6) return `$${f(num / 1e6, 2)}M`;
  if (num >= 1e3) return `$${f(num / 1e3, 1)}K`;
  return `$${f(num, 0)}`;
}

function integer(value) {
  const num = n(value);
  if (num >= 1e9) return `${f(num / 1e9, 2)}B`;
  if (num >= 1e6) return `${f(num / 1e6, 2)}M`;
  if (num >= 1e3) return `${f(num / 1e3, 1)}K`;
  return f(num, 0);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function numClass(value) {
  return n(value) > 0 ? "num-up" : n(value) < 0 ? "num-down" : "";
}

function meanText(item) {
  if (item.rsi_14 < 30 || item.bb_z_20 <= -2) return "怨쇰ℓ???댄썑 諛섎벑 媛?μ꽦";
  if (item.rsi_14 > 70 || item.bb_z_20 >= 2) return "?④린 怨쇱뿴 援ш컙 媛?μ꽦";
  return "以묐┰ 援ш컙";
}

function incomeText(item) {
  if (item.dist_yield_ttm >= 8) return "怨좎씤而??깃꺽??媛뺥븯吏留?吏??媛?μ꽦 ?뺤씤 ?꾩슂";
  if (item.dist_yield_ttm >= 3) return "以묎컙 ?섏????몄뺨 ETF";
  return "?몄뺨蹂대떎 ?깆옣 ?먮뒗 異붿꽭 鍮꾩쨷????ETF";
}
