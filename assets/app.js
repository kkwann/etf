const DATA_URL = './dashboard_data.json';
const METHOD_LABELS = {
  method1: 'Momentum',
  method2: 'Risk / Defense',
  method3: 'Trend Quality',
  method4: 'Liquidity / Flow',
  method5: 'Mean Reversion',
  method6: 'Income / Dividend Event'
};
const GRADE_ORDER = ['A', 'B', 'C', 'D'];

const state = {
  rawData: [],
  metadata: {},
  filteredData: [],
  selectedIndex: -1,
  sortKey: 'scores.total_score',
  sortDir: 'desc',
  theme: localStorage.getItem('etf_theme') || 'dark'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  metaAsOf: $('#metaAsOf'),
  metaUpdated: $('#metaUpdated'),
  metaCurrency: $('#metaCurrency'),
  metaModel: $('#metaModel'),
  summaryCards: $('#summaryCards'),
  resultCount: $('#resultCount'),
  searchInput: $('#searchInput'),
  assetFilter: $('#assetFilter'),
  strategyFilter: $('#strategyFilter'),
  dividendFilter: $('#dividendFilter'),
  gradeFilter: $('#gradeFilter'),
  minScoreInput: $('#minScoreInput'),
  activeFilters: $('#activeFilters'),
  tableBody: $('#tableBody'),
  tableEmpty: $('#tableEmpty'),
  detailDrawer: $('#detailDrawer'),
  drawerContent: $('#drawerContent'),
  detailTitle: $('#detailTitle'),
  prevBtn: $('#prevBtn'),
  nextBtn: $('#nextBtn'),
  closeDrawerBtn: $('#closeDrawerBtn'),
  themeToggle: $('#themeToggle'),
  downloadJsonBtn: $('#downloadJsonBtn')
};

init();

async function init() {
  applyTheme(state.theme);
  bindEvents();
  await loadData();
}

async function loadData() {
  try {
    const res = await fetch(`${DATA_URL}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    state.metadata = payload.metadata || {};
    state.rawData = (payload.data || []).map(normalizeEtf);
    populateFilters();
    renderMeta();
    applyFiltersAndRender();
  } catch (error) {
    console.error(error);
    els.summaryCards.innerHTML = `<article class="summary-card"><div class="summary-card__label">데이터 로딩 실패</div><div class="summary-card__value">Error</div><div class="summary-card__sub">dashboard_data.json을 읽지 못했습니다. GitHub Pages 또는 로컬 서버 환경에서 실행하세요.</div></article>`;
    els.tableEmpty.classList.remove('hidden');
    els.tableEmpty.textContent = '데이터를 불러오지 못했습니다. JSON 경로와 파일 구조를 확인하세요.';
  }
}

function normalizeEtf(item) {
  const scores = item.scores || {};
  const summary = item.summary || {};
  const features = item.features || {};
  return {
    ...item,
    rank: scores.rank ?? item.rank ?? 999,
    scores: {
      method1: num(scores.method1),
      method2: num(scores.method2),
      method3: num(scores.method3),
      method4: num(scores.method4),
      method5: num(scores.method5),
      method6: num(scores.method6),
      total_score: num(scores.total_score),
      grade: scores.grade || 'D',
      rank: scores.rank ?? item.rank ?? 999
    },
    summary: {
      best_for: summary.best_for || '-',
      comment: summary.comment || '-',
      risk_note: summary.risk_note || '-',
      tags: Array.isArray(summary.tags) ? summary.tags : splitPipe(summary.tags),
      signal_badges: Array.isArray(summary.signal_badges) ? summary.signal_badges : splitPipe(summary.signal_badges)
    },
    features: {
      ...features,
      ret_5d: num(features.ret_5d),
      ret_20d: num(features.ret_20d),
      ret_60d: num(features.ret_60d),
      ret_120d: num(features.ret_120d),
      ret_240d: num(features.ret_240d),
      vol_20d_ann: num(features.vol_20d_ann),
      vol_60d_ann: num(features.vol_60d_ann),
      downside_vol_20d_ann: num(features.downside_vol_20d_ann),
      drawdown_60d: num(features.drawdown_60d),
      ma_gap_20: num(features.ma_gap_20),
      ma_gap_50: num(features.ma_gap_50),
      ma_gap_200: num(features.ma_gap_200),
      rsi_14: num(features.rsi_14),
      bb_z_20: num(features.bb_z_20),
      dist_yield_ttm: num(features.dist_yield_ttm),
      dist_ttm: num(features.dist_ttm),
      total_distribution: num(features.total_distribution),
      trading_value: num(features.trading_value),
      avg_trading_value_20d: num(features.avg_trading_value_20d),
      avg_volume_20d: num(features.avg_volume_20d),
      volume_ratio_20d: num(features.volume_ratio_20d),
      obv: num(features.obv),
      obv_ma_20: num(features.obv_ma_20),
      exdiv_gap_rate: num(features.exdiv_gap_rate),
      div_drop_ratio: num(features.div_drop_ratio),
      is_dividend_event: !!features.is_dividend_event,
      ma_20: num(features.ma_20),
      ma_50: num(features.ma_50),
      ma_200: num(features.ma_200),
      hh_20: num(features.hh_20),
      hh_60: num(features.hh_60),
      hh_120: num(features.hh_120)
    }
  };
}

function bindEvents() {
  els.searchInput.addEventListener('input', applyFiltersAndRender);
  els.assetFilter.addEventListener('change', applyFiltersAndRender);
  els.strategyFilter.addEventListener('change', applyFiltersAndRender);
  els.dividendFilter.addEventListener('change', applyFiltersAndRender);
  els.gradeFilter.addEventListener('change', applyFiltersAndRender);
  els.minScoreInput.addEventListener('input', applyFiltersAndRender);

  $$('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = key === 'ticker' ? 'asc' : 'desc';
      }
      renderTable();
    });
  });

  els.themeToggle.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('light') ? 'dark' : 'light';
    applyTheme(nextTheme);
  });

  els.downloadJsonBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ metadata: state.metadata, data: state.rawData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard_data.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  els.closeDrawerBtn.addEventListener('click', closeDrawer);
  els.prevBtn.addEventListener('click', () => moveSelection(-1));
  els.nextBtn.addEventListener('click', () => moveSelection(1));
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.matches('[data-close-drawer="true"]')) {
      closeDrawer();
    }
    if (target instanceof HTMLButtonElement && target.dataset.clearFilter) {
      clearFilter(target.dataset.clearFilter);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!els.detailDrawer.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeDrawer();
    if (e.key === 'ArrowRight') moveSelection(1);
    if (e.key === 'ArrowLeft') moveSelection(-1);
  });
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.classList.toggle('light', theme === 'light');
  localStorage.setItem('etf_theme', theme);
  els.themeToggle.textContent = theme === 'light' ? '☀️ 라이트모드' : '🌙 다크모드';
}

function renderMeta() {
  els.metaAsOf.textContent = state.metadata.asof_date || '-';
  els.metaUpdated.textContent = formatDateTime(state.metadata.updated_at);
  els.metaCurrency.textContent = state.metadata.currency || '-';
  els.metaModel.textContent = state.metadata.scoring_model?.name || '-';
}

function populateFilters() {
  fillSelect(els.assetFilter, ['전체', ...uniqueValues(state.rawData.map((d) => d.asset_class))]);
  fillSelect(els.strategyFilter, ['전체', ...uniqueValues(state.rawData.map((d) => d.strategy_family))]);
  fillSelect(els.dividendFilter, ['전체', ...uniqueValues(state.rawData.map((d) => d.dividend_frequency))]);
  fillSelect(els.gradeFilter, ['전체', ...GRADE_ORDER]);
}

function fillSelect(selectEl, values) {
  selectEl.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join('');
}

function applyFiltersAndRender() {
  const q = els.searchInput.value.trim().toLowerCase();
  const asset = els.assetFilter.value;
  const strategy = els.strategyFilter.value;
  const dividend = els.dividendFilter.value;
  const grade = els.gradeFilter.value;
  const minScore = num(els.minScoreInput.value);

  state.filteredData = state.rawData.filter((item) => {
    const haystack = [
      item.ticker,
      item.name,
      item.asset_class,
      item.strategy_family,
      item.summary.best_for,
      item.summary.comment,
      item.summary.risk_note,
      ...(item.summary.tags || []),
      ...(item.summary.signal_badges || [])
    ].join(' ').toLowerCase();

    const gradePass = grade === '전체' || gradeRank(item.scores.grade) <= gradeRank(grade);
    return (!q || haystack.includes(q)) &&
      (asset === '전체' || item.asset_class === asset) &&
      (strategy === '전체' || item.strategy_family === strategy) &&
      (dividend === '전체' || item.dividend_frequency === dividend) &&
      gradePass &&
      item.scores.total_score >= minScore;
  });

  renderActiveFilters();
  renderSummaryCards();
  renderTable();

  if (state.selectedIndex >= 0) {
    const selected = state.filteredData[state.selectedIndex];
    if (!selected) closeDrawer();
  }
}

function renderActiveFilters() {
  const pills = [];
  if (els.searchInput.value.trim()) pills.push(makePill(`검색: ${els.searchInput.value.trim()}`, 'search'));
  if (els.assetFilter.value !== '전체') pills.push(makePill(`자산군: ${els.assetFilter.value}`, 'asset'));
  if (els.strategyFilter.value !== '전체') pills.push(makePill(`전략군: ${els.strategyFilter.value}`, 'strategy'));
  if (els.dividendFilter.value !== '전체') pills.push(makePill(`배당주기: ${els.dividendFilter.value}`, 'dividend'));
  if (els.gradeFilter.value !== '전체') pills.push(makePill(`최소 등급: ${els.gradeFilter.value}`, 'grade'));
  if (num(els.minScoreInput.value) > 0) pills.push(makePill(`최소 총점: ${els.minScoreInput.value}`, 'minScore'));
  els.activeFilters.innerHTML = pills.join('');
}

function makePill(label, key) {
  return `<span class="filter-pill">${label} <button type="button" data-clear-filter="${key}" aria-label="${label} 제거">×</button></span>`;
}

function clearFilter(key) {
  if (key === 'search') els.searchInput.value = '';
  if (key === 'asset') els.assetFilter.value = '전체';
  if (key === 'strategy') els.strategyFilter.value = '전체';
  if (key === 'dividend') els.dividendFilter.value = '전체';
  if (key === 'grade') els.gradeFilter.value = '전체';
  if (key === 'minScore') els.minScoreInput.value = 0;
  applyFiltersAndRender();
}

function renderSummaryCards() {
  const data = state.filteredData;
  const top = sortData([...data], 'scores.total_score', 'desc')[0];
  const avgScore = avg(data.map((d) => d.scores.total_score));
  const avgYield = avg(data.map((d) => d.features.dist_yield_ttm));
  const avgVol = avg(data.map((d) => d.features.vol_20d_ann));
  const dividendEvents = data.filter((d) => d.features.is_dividend_event).length;

  const cards = [
    {
      label: '표시 ETF 수',
      value: `${data.length}`,
      sub: `전체 유니버스 ${state.rawData.length}개 중 현재 필터 통과 종목 수`
    },
    {
      label: '평균 총점',
      value: fmt(avgScore, 1),
      sub: '현재 화면에 표시된 ETF들의 총점 평균'
    },
    {
      label: '상위 ETF',
      value: top ? top.ticker : '-',
      sub: top ? `${top.name} · 총점 ${fmt(top.scores.total_score, 1)} · 등급 ${top.scores.grade}` : '데이터 없음'
    },
    {
      label: '평균 TTM 분배수익률',
      value: `${fmt(avgYield, 2)}%`,
      sub: '인컴 관점에서 현재 화면 ETF의 평균 수준'
    },
    {
      label: '배당 이벤트 발생 ETF',
      value: `${dividendEvents}`,
      sub: `현재 데이터 기준 ${data.length ? fmt(dividendEvents / data.length * 100, 1) : '0.0'}%`
    },
    {
      label: '평균 20D 변동성',
      value: `${fmt(avgVol, 1)}%`,
      sub: '단기 흔들림 정도의 평균값'
    },
    {
      label: '상위 3개 평균 3M 수익률',
      value: `${fmt(avg(sortData([...data], 'features.ret_60d', 'desc').slice(0,3).map(d => d.features.ret_60d)), 1)}%`,
      sub: '모멘텀 상위권 ETF들의 최근 3개월 수익률 평균'
    },
    {
      label: '평균 Drawdown 60D',
      value: `${fmt(avg(data.map((d) => d.features.drawdown_60d)), 1)}%`,
      sub: '최근 60일 기준 고점 대비 낙폭 평균'
    },
    {
      label: '평균 거래대금(20D)',
      value: compactMoney(avg(data.map((d) => d.features.avg_trading_value_20d))),
      sub: '실거래 적합성을 보기 위한 유동성 체감 지표'
    },
    {
      label: '운영 방식',
      value: '정적 웹',
      sub: 'index.html은 고정, dashboard_data.json만 교체'
    }
  ];

  els.summaryCards.innerHTML = cards.map((card) => `
    <article class="summary-card">
      <div class="summary-card__label">${card.label}</div>
      <div class="summary-card__value">${card.value}</div>
      <div class="summary-card__sub">${card.sub}</div>
    </article>
  `).join('');
}

function renderTable() {
  const rows = sortData([...state.filteredData], state.sortKey, state.sortDir);
  state.filteredData = rows;
  els.resultCount.textContent = String(rows.length);
  els.tableEmpty.classList.toggle('hidden', rows.length !== 0);

  els.tableBody.innerHTML = rows.map((item, index) => `
    <tr data-index="${index}">
      <td><span class="rank-chip">#${item.scores.rank}</span></td>
      <td>
        <div class="ticker-cell">${item.ticker}<small>${item.name}</small></div>
      </td>
      <td>${item.asset_class}</td>
      <td>${item.strategy_family}</td>
      <td>${fmt(item.scores.total_score, 1)}</td>
      <td><span class="grade-badge grade-${item.scores.grade}">${item.scores.grade}</span></td>
      <td class="${numClass(item.features.ret_60d)}">${fmtSigned(item.features.ret_60d, 1)}%</td>
      <td>${fmt(item.features.vol_20d_ann, 1)}%</td>
      <td>${fmt(item.features.dist_yield_ttm, 2)}%</td>
      <td>$${fmt(item.close, 2)}</td>
    </tr>
  `).join('');

  $$('#tableBody tr').forEach((tr) => {
    tr.addEventListener('click', () => openDrawer(Number(tr.dataset.index)));
  });
}

function openDrawer(index) {
  state.selectedIndex = index;
  const item = state.filteredData[index];
  if (!item) return;
  els.detailTitle.textContent = `${item.ticker} 상세 분석`;
  els.drawerContent.innerHTML = renderDetail(item);
  els.detailDrawer.classList.add('is-open');
  els.detailDrawer.setAttribute('aria-hidden', 'false');
  updateNavButtons();
}

function closeDrawer() {
  els.detailDrawer.classList.remove('is-open');
  els.detailDrawer.setAttribute('aria-hidden', 'true');
  state.selectedIndex = -1;
}

function moveSelection(direction) {
  if (!state.filteredData.length) return;
  let next = state.selectedIndex + direction;
  if (next < 0) next = 0;
  if (next >= state.filteredData.length) next = state.filteredData.length - 1;
  openDrawer(next);
}

function updateNavButtons() {
  els.prevBtn.disabled = state.selectedIndex <= 0;
  els.nextBtn.disabled = state.selectedIndex >= state.filteredData.length - 1;
}

function renderDetail(item) {
  const f = item.features;
  const s = item.scores;
  const summary = item.summary;
  const scoreRows = ['method1', 'method2', 'method3', 'method4', 'method5', 'method6']
    .map((key) => `
      <div class="bar-row">
        <span>${METHOD_LABELS[key] || key}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${clamp(s[key], 0, 100)}%"></div></div>
        <strong>${fmt(s[key], 1)}</strong>
      </div>
    `).join('');

  return `
    <section class="detail-block detail-hero">
      <div class="detail-title">
        <div>
          <div class="eyebrow">${item.asset_class} · ${item.strategy_family}</div>
          <h3>${item.ticker}</h3>
          <p>${item.name}</p>
        </div>
        <div class="tag-list">
          <span class="grade-badge grade-${s.grade}">등급 ${s.grade}</span>
          <span class="chip">Rank #${s.rank}</span>
          <span class="chip">${item.dividend_frequency}</span>
          <span class="chip">${item.region}</span>
        </div>
      </div>
      <div class="detail-stats">
        ${miniStat('총점', fmt(s.total_score, 1))}
        ${miniStat('종가', `$${fmt(item.close, 2)}`)}
        ${miniStat('AUM', `$${fmt(item.aum_billion, 1)}B`)}
        ${miniStat('보수', `${fmt(item.expense_ratio, 2)}%`)}
      </div>
    </section>

    <section class="score-grid">
      <article class="detail-block">
        <div class="section-head"><div><h2>점수 구성</h2><p>method1~6 점수로 ETF 전략 적합도를 설명합니다.</p></div></div>
        <div class="scorebars">${scoreRows}</div>
      </article>
      <article class="detail-block">
        <div class="section-head"><div><h2>해석 요약</h2><p>점수와 피처를 한 줄 해석으로 압축했습니다.</p></div></div>
        <div class="metric-list">
          <div class="metric-item"><span>추천 용도</span><strong>${summary.best_for}</strong></div>
          <div class="metric-item"><span>코멘트</span><strong>${summary.comment}</strong></div>
          <div class="metric-item"><span>리스크</span><strong>${summary.risk_note}</strong></div>
        </div>
        <div style="height:12px"></div>
        <div class="tag-list">${(summary.tags || []).map((tag) => `<span class="chip">${tag}</span>`).join('')}</div>
        <div style="height:12px"></div>
        <div class="badge-list">${(summary.signal_badges || []).map((tag) => `<span class="chip">${tag}</span>`).join('')}</div>
      </article>
    </section>

    <section class="detail-grid">
      ${metricCard('수익률 / 모멘텀', [
        ['5D 수익률', `${fmtSigned(f.ret_5d, 1)}%`, numClass(f.ret_5d)],
        ['20D 수익률', `${fmtSigned(f.ret_20d, 1)}%`, numClass(f.ret_20d)],
        ['60D 수익률', `${fmtSigned(f.ret_60d, 1)}%`, numClass(f.ret_60d)],
        ['120D 수익률', `${fmtSigned(f.ret_120d, 1)}%`, numClass(f.ret_120d)],
        ['240D 수익률', `${fmtSigned(f.ret_240d, 1)}%`, numClass(f.ret_240d)]
      ])}

      ${metricCard('변동성 / 리스크', [
        ['20D 연환산 변동성', `${fmt(f.vol_20d_ann, 1)}%`],
        ['60D 연환산 변동성', `${fmt(f.vol_60d_ann, 1)}%`],
        ['20D 하방 변동성', `${fmt(f.downside_vol_20d_ann, 1)}%`],
        ['60D Drawdown', `${fmtSigned(f.drawdown_60d, 1)}%`, numClass(f.drawdown_60d)],
        ['배당 이벤트 여부', f.is_dividend_event ? 'True' : 'False']
      ])}

      ${metricCard('추세 / 이동평균', [
        ['MA 20', `$${fmt(f.ma_20, 2)}`],
        ['MA 50', `$${fmt(f.ma_50, 2)}`],
        ['MA 200', `$${fmt(f.ma_200, 2)}`],
        ['MA Gap 20', `${fmtSigned(f.ma_gap_20, 1)}%`, numClass(f.ma_gap_20)],
        ['MA Gap 50', `${fmtSigned(f.ma_gap_50, 1)}%`, numClass(f.ma_gap_50)],
        ['MA Gap 200', `${fmtSigned(f.ma_gap_200, 1)}%`, numClass(f.ma_gap_200)],
        ['HH 20', `$${fmt(f.hh_20, 2)}`],
        ['HH 60', `$${fmt(f.hh_60, 2)}`],
        ['HH 120', `$${fmt(f.hh_120, 2)}`]
      ])}

      ${metricCard('유동성 / 수급', [
        ['당일 거래대금', compactMoney(f.trading_value)],
        ['20D 평균 거래대금', compactMoney(f.avg_trading_value_20d)],
        ['20D 평균 거래량', compactInteger(f.avg_volume_20d)],
        ['거래량 비율', `${fmt(f.volume_ratio_20d, 2)}x`],
        ['OBV', compactInteger(f.obv)],
        ['OBV MA 20', compactInteger(f.obv_ma_20)]
      ])}

      ${metricCard('평균회귀 / 과열·과매도', [
        ['RSI 14', fmt(f.rsi_14, 1)],
        ['BB Z 20', fmtSigned(f.bb_z_20, 2), numClass(-f.bb_z_20)],
        ['Ex-div Gap', `${fmtSigned(f.exdiv_gap_rate, 2)}%`, numClass(f.exdiv_gap_rate)],
        ['Div Drop Ratio', fmt(f.div_drop_ratio, 2)],
        ['반전 해석', meanReversionText(f)]
      ])}

      ${metricCard('배당 / 인컴', [
        ['총 분배금', `$${fmt(f.total_distribution, 2)}`],
        ['TTM 분배금', `$${fmt(f.dist_ttm, 2)}`],
        ['TTM 분배수익률', `${fmt(f.dist_yield_ttm, 2)}%`],
        ['인컴 해석', incomeText(f)]
      ])}
    </section>

    <p class="footer-note">이 화면은 예시 구조입니다. 실운영 시에는 pandas DataFrame(flat)을 주기적으로 갱신한 뒤, 같은 JSON 스키마로 변환해 <code>dashboard_data.json</code>만 덮어쓰는 방식이 가장 관리하기 쉽습니다.</p>
  `;
}

function metricCard(title, items) {
  return `
    <article class="metric-card">
      <h4>${title}</h4>
      <div class="metric-list">
        ${items.map(([label, value, cls = '']) => `
          <div class="metric-item">
            <span>${label}</span>
            <strong class="${cls}">${value}</strong>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

function miniStat(label, value) {
  return `
    <div class="stat-mini">
      <div class="stat-mini__label">${label}</div>
      <div class="stat-mini__value">${value}</div>
    </div>
  `;
}

function sortData(data, key, dir = 'desc') {
  const factor = dir === 'asc' ? 1 : -1;
  return data.sort((a, b) => {
    const av = deepValue(a, key);
    const bv = deepValue(b, key);
    if (typeof av === 'string' || typeof bv === 'string') {
      return String(av).localeCompare(String(bv), 'ko') * factor;
    }
    return (num(av) - num(bv)) * factor;
  });
}

function deepValue(obj, path) {
  return path.split('.').reduce((acc, cur) => acc?.[cur], obj);
}

function uniqueValues(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko'));
}

function gradeRank(grade) {
  const idx = GRADE_ORDER.indexOf(grade);
  return idx >= 0 ? idx : GRADE_ORDER.length;
}

function splitPipe(value) {
  if (!value) return [];
  return String(value).split('|').map((s) => s.trim()).filter(Boolean);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function avg(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0;
}

function fmt(value, digits = 1) {
  return num(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function fmtSigned(value, digits = 1) {
  const n = num(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${fmt(n, digits)}`;
}

function compactMoney(value) {
  const n = num(value);
  if (n >= 1e9) return `$${fmt(n / 1e9, 2)}B`;
  if (n >= 1e6) return `$${fmt(n / 1e6, 2)}M`;
  if (n >= 1e3) return `$${fmt(n / 1e3, 1)}K`;
  return `$${fmt(n, 0)}`;
}

function compactInteger(value) {
  const n = num(value);
  if (n >= 1e9) return `${fmt(n / 1e9, 2)}B`;
  if (n >= 1e6) return `${fmt(n / 1e6, 2)}M`;
  if (n >= 1e3) return `${fmt(n / 1e3, 1)}K`;
  return fmt(n, 0);
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function numClass(value) {
  if (num(value) > 0) return 'num-up';
  if (num(value) < 0) return 'num-down';
  return '';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, num(value)));
}

function meanReversionText(f) {
  if (f.rsi_14 < 30 || f.bb_z_20 <= -2) return '과매도 반등 후보 가능성';
  if (f.rsi_14 > 70 || f.bb_z_20 >= 2) return '단기 과열 구간 가능성';
  return '중립 구간';
}

function incomeText(f) {
  if (f.dist_yield_ttm >= 8) return '고인컴 성격이 강하지만 함정 여부 확인 필요';
  if (f.dist_yield_ttm >= 3) return '중간 수준 인컴 ETF';
  return '인컴보다 성장/추세 비중이 큰 ETF';
}
