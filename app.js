
const DATA_FILE = './dashboard_data.json';

const state = {
  raw: null,
  items: [],
  filtered: [],
  selectedIndex: null,
  sortBy: 'rank_desc',
  theme: localStorage.getItem('etf-dashboard-theme') || 'dark',
  activeStrategy: 'ret_60d',
};

const metricHelp = {
  cagr: '연복리수익률. 높을수록 장기 누적성과가 좋습니다.',
  sharpe: '변동성 대비 수익 효율. 높을수록 효율적입니다.',
  sortino: '하방변동성 대비 수익 효율. 손실 구간에 더 민감합니다.',
  calmar: 'CAGR / MDD. 낙폭 대비 수익성입니다.',
  mdd: '최대낙폭. 절대값이 작을수록 방어력이 좋습니다.',
  volatility: '총 변동성. 낮을수록 흔들림이 적습니다.',
  downside_volatility: '하락 구간 변동성. 낮을수록 하락 스트레스가 적습니다.',
  win_rate: '전략 승률. 높을수록 더 자주 수익 구간이 발생했습니다.',
  turnover: '회전율. 높을수록 거래 빈도와 비용 민감도가 커집니다.',
};

const labels = {
  ret_5d: '5D', ret_20d: '20D', ret_60d: '60D', ret_120d: '120D', ret_240d: '240D'
};

const $ = (id) => document.getElementById(id);

function applyTheme() {
  document.body.dataset.theme = state.theme;
  $('themeToggleBtn').textContent = state.theme === 'dark' ? '🌙' : '☀️';
}

function persistTheme() {
  localStorage.setItem('etf-dashboard-theme', state.theme);
}

async function loadData() {
  const res = await fetch(DATA_FILE, { cache: 'no-store' });
  if (!res.ok) throw new Error('dashboard_data.json 로드 실패');
  state.raw = await res.json();
  state.items = state.raw.data || [];
  renderMeta();
  renderFilterOptions();
  applyFilters();
}

function renderMeta() {
  const meta = state.raw.metadata;
  $('metaRow').innerHTML = `
    <span class="meta-chip">기준일: ${meta.asof_date}</span>
    <span class="meta-chip">업데이트: ${meta.updated_at}</span>
    <span class="meta-chip">전략: ${meta.lookbacks.map(x => x.label).join(' · ')}</span>
    <span class="meta-chip">검증지표: ${meta.validation_metrics.length}개</span>
  `;

  const cards = [
    {
      label: '전체 ETF 수',
      value: meta.summary_cards.universe_count,
      sub: '현재 대시보드 기준 유니버스'
    },
    {
      label: '평균 총점',
      value: meta.summary_cards.avg_total_score,
      sub: '5개 전략 점수 평균'
    },
    {
      label: '가장 많이 선택된 최고 전략',
      value: meta.summary_cards.dominant_best_strategy,
      sub: 'ETF별 최적 전략 빈도 기준'
    },
    {
      label: '현재 1위 ETF',
      value: meta.summary_cards.top_etf,
      sub: '총점 기준 상위 ETF'
    }
  ];

  $('summaryCards').innerHTML = cards.map(card => `
    <div class="card summary-card">
      <div class="label">${card.label}</div>
      <div class="value">${card.value}</div>
      <div class="sub">${card.sub}</div>
    </div>
  `).join('');
}

function renderFilterOptions() {
  const assetSet = [...new Set(state.items.map(x => x.asset_class))].sort();
  const bestSet = [...new Set(state.items.map(x => x.best_strategy))];

  $('assetFilter').innerHTML = '<option value="">전체</option>' + assetSet.map(v => `<option value="${v}">${v}</option>`).join('');
  $('bestStrategyFilter').innerHTML = '<option value="">전체</option>' + bestSet.map(v => `<option value="${v}">${v}</option>`).join('');
}

function gradePasses(itemGrade, filterGrade) {
  if (!filterGrade) return true;
  const order = ['A', 'B', 'C', 'D', 'E'];
  return order.indexOf(itemGrade) <= order.indexOf(filterGrade);
}

function applyFilters() {
  const search = $('searchInput').value.trim().toLowerCase();
  const asset = $('assetFilter').value;
  const grade = $('gradeFilter').value;
  const best = $('bestStrategyFilter').value;
  const minScore = Number($('minScoreRange').value);
  $('minScoreValue').textContent = minScore;

  state.filtered = state.items.filter(item => {
    const hitSearch = !search || [item.ticker, item.name, item.style].join(' ').toLowerCase().includes(search);
    const hitAsset = !asset || item.asset_class === asset;
    const hitGrade = gradePasses(item.grade, grade);
    const hitBest = !best || item.best_strategy === best;
    const hitMin = item.total_score >= minScore;
    return hitSearch && hitAsset && hitGrade && hitBest && hitMin;
  });

  sortItems();
  renderTable();
  updateSelectionAfterFilter();
}

function sortItems() {
  const key = $('sortFilter').value;
  state.sortBy = key;
  const copy = [...state.filtered];

  const compareText = (a, b, field) => String(a[field]).localeCompare(String(b[field]));

  copy.sort((a, b) => {
    switch (key) {
      case 'score_desc': return b.total_score - a.total_score;
      case 'score_asc': return a.total_score - b.total_score;
      case 'ticker_asc': return compareText(a, b, 'ticker');
      case 'best_strategy': return String(a.best_strategy).localeCompare(String(b.best_strategy));
      case 'rank_desc':
      default: return a.rank - b.rank;
    }
  });

  state.filtered = copy;
}

function renderTable() {
  const body = $('tableBody');
  if (!state.filtered.length) {
    body.innerHTML = `<tr><td colspan="9" class="dim">조건에 맞는 ETF가 없습니다.</td></tr>`;
    return;
  }

  body.innerHTML = state.filtered.map((item, index) => `
    <tr data-index="${index}">
      <td>
        <div class="name-block">
          <strong>${item.ticker}</strong>
          <span class="dim">${item.name}</span>
        </div>
      </td>
      <td><span class="score-pill">${item.total_score}</span></td>
      <td><span class="grade-pill grade-${item.grade}">${item.grade}</span></td>
      <td><span class="strategy-pill">${item.best_strategy}</span></td>
      <td>${item.scores.ret_5d}</td>
      <td>${item.scores.ret_20d}</td>
      <td>${item.scores.ret_60d}</td>
      <td>${item.scores.ret_120d}</td>
      <td>${item.scores.ret_240d}</td>
    </tr>
  `).join('');

  [...body.querySelectorAll('tr[data-index]')].forEach(row => {
    row.addEventListener('click', () => selectByFilteredIndex(Number(row.dataset.index)));
  });
}

function updateSelectionAfterFilter() {
  if (!state.filtered.length) {
    state.selectedIndex = null;
    $('drawerEmpty').classList.remove('hidden');
    $('detailDrawer').classList.remove('active');
    return;
  }
  if (state.selectedIndex === null || state.selectedIndex >= state.filtered.length) {
    selectByFilteredIndex(0);
  } else {
    renderDetail();
  }
}

function selectByFilteredIndex(index) {
  state.selectedIndex = index;
  renderDetail();
}

function renderDetail() {
  const item = state.filtered[state.selectedIndex];
  if (!item) return;

  $('drawerEmpty').classList.add('hidden');
  $('detailDrawer').classList.add('active');

  $('detailTitle').textContent = `${item.ticker} · ${item.name}`;
  $('detailSubline').textContent = `${item.asset_class} · ${item.style} · ${item.region}`;

  $('detailKpis').innerHTML = [
    ['총점', item.total_score],
    ['등급', item.grade],
    ['최고 전략', item.best_strategy],
    ['랭크', `#${item.rank}`],
  ].map(([label, value]) => `
    <div class="kpi">
      <div class="k-label">${label}</div>
      <div class="k-value">${value}</div>
    </div>
  `).join('');

  $('summaryNotes').innerHTML = `
    <div class="note"><strong>한 줄 요약</strong>${item.summary}</div>
    <div class="note"><strong>적합한 용도</strong>${item.fit_for} · 보수 ${item.expense_ratio}% · 종가 ${item.close}</div>
    <div class="note"><strong>태그</strong><div class="tag-row">${item.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div></div>
  `;

  const scoreRows = Object.entries(labels).map(([key, label]) => {
    const score = item.scores[key];
    return `
      <div class="score-bar-row">
        <div><strong>${label}</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${score}%"></div></div>
        <div style="text-align:right;">${score}</div>
      </div>
    `;
  });
  $('scoreBars').innerHTML = scoreRows.join('');

  if (!item.strategies[state.activeStrategy]) state.activeStrategy = 'ret_60d';
  renderStrategyTabs(item);
  renderStrategySection(item, state.activeStrategy);

  $('prevBtn').disabled = state.selectedIndex <= 0;
  $('nextBtn').disabled = state.selectedIndex >= state.filtered.length - 1;
}

function renderStrategyTabs(item) {
  $('strategyTabs').innerHTML = Object.entries(labels).map(([key, label]) => `
    <button class="tab-btn ${state.activeStrategy === key ? 'active' : ''}" data-key="${key}">${label}</button>
  `).join('');

  [...$('strategyTabs').querySelectorAll('.tab-btn')].forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeStrategy = btn.dataset.key;
      renderStrategyTabs(item);
      renderStrategySection(item, state.activeStrategy);
    });
  });
}

function renderStrategySection(item, key) {
  const strat = item.strategies[key];
  const groups = strat.group_scores;
  $('groupScores').innerHTML = [
    ['수익성', groups.profitability, 'CAGR, Win Rate, Calmar 기반'],
    ['리스크 통제', groups.risk_control, 'MDD, 변동성, 하방변동성 기반'],
    ['효율성', groups.efficiency, 'Sharpe, Sortino, Turnover 기반'],
  ].map(([label, value, help]) => `
    <div class="group-box">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      <div class="dim">${help}</div>
    </div>
  `).join('');

  $('metricsGrid').innerHTML = Object.entries(strat.metrics).map(([metric, value]) => {
    const suffix = metric === 'mdd' || metric.includes('volatility') || metric === 'cagr' || metric === 'win_rate' || metric === 'turnover' ? '%' : '';
    const show = metric === 'mdd' ? `${value}%` : `${value}${suffix}`;
    return `
      <div class="metric">
        <div class="m-label">${prettyMetric(metric)}</div>
        <div class="m-value">${show}</div>
        <div class="m-help">${metricHelp[metric]}</div>
      </div>
    `;
  }).join('');

  $('strategyNotes').innerHTML = `
    <div class="note"><strong>전략 요약</strong>${strat.commentary.summary}</div>
    <div class="note"><strong>해석 포인트</strong>${strat.commentary.headline}</div>
    <div class="note"><strong>유의사항</strong>${strat.commentary.risk_note}</div>
  `;
}

function prettyMetric(metric) {
  const map = {
    cagr: 'CAGR',
    sharpe: 'Sharpe',
    sortino: 'Sortino',
    calmar: 'Calmar',
    mdd: 'MDD',
    volatility: 'Volatility',
    downside_volatility: 'Downside Vol',
    win_rate: 'Win Rate',
    turnover: 'Turnover'
  };
  return map[metric] || metric;
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state.raw, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dashboard_data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  ['searchInput', 'assetFilter', 'gradeFilter', 'bestStrategyFilter', 'sortFilter', 'minScoreRange']
    .forEach(id => $(id).addEventListener(id === 'searchInput' ? 'input' : 'change', applyFilters));

  $('themeToggleBtn').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    persistTheme();
  });
  $('downloadJsonBtn').addEventListener('click', downloadJson);
  $('prevBtn').addEventListener('click', () => {
    if (state.selectedIndex > 0) selectByFilteredIndex(state.selectedIndex - 1);
  });
  $('nextBtn').addEventListener('click', () => {
    if (state.selectedIndex < state.filtered.length - 1) selectByFilteredIndex(state.selectedIndex + 1);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  bindEvents();
  try {
    await loadData();
  } catch (error) {
    console.error(error);
    document.querySelector('.app').innerHTML = `<div class="card panel"><h2>데이터 로드 실패</h2><p>${error.message}</p></div>`;
  }
});
