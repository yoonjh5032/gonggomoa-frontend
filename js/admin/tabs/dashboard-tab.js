function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderSummaryCard(label, value) {
  return `
    <article class="admin-stat-card">
      <div class="admin-stat-label">${esc(label)}</div>
      <strong class="admin-stat-value">${Number(value || 0).toLocaleString()}</strong>
    </article>
  `;
}

function renderMiniList(items, emptyText, rowRenderer) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<div class="admin-empty">${esc(emptyText)}</div>`;
  }
  return `<div class="admin-mini-list">${items.map(rowRenderer).join('')}</div>`;
}

export function createDashboardTab({ api, feedback }) {
  const state = {
    loaded: false,
    loading: false,
    data: null
  };

  let root;

  function template() {
    return `
      <section class="admin-section-shell">
        <div id="dashboard-summary" class="admin-stat-grid"></div>

        <div class="admin-grid-2" style="margin-top:20px;">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h3>운영 경보</h3>
            </div>
            <div id="dashboard-collector-alerts" class="admin-panel-body">
              <div class="admin-empty">불러오는 중...</div>
            </div>
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head">
              <h3>수집/운영 상태</h3>
            </div>
            <div id="dashboard-collector-status" class="admin-panel-body">
              <div class="admin-empty">불러오는 중...</div>
            </div>
          </section>
        </div>

        <div class="admin-grid-3" style="margin-top:20px;">
          <section class="admin-panel">
            <div class="admin-panel-head"><h3>최근 수집 실행 이력</h3></div>
            <div id="dashboard-recent-logs" class="admin-panel-body"></div>
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><h3>최근 가입 회원</h3></div>
            <div id="dashboard-recent-users" class="admin-panel-body"></div>
          </section>

          <section class="admin-panel">
            <div class="admin-panel-head"><h3>최근 문의</h3></div>
            <div id="dashboard-recent-inquiries" class="admin-panel-body"></div>
          </section>
        </div>
      </section>
    `;
  }

  function render() {
    const data = state.data || {};
    const summary = data.summary || {};
    const alerts = data.collectorAlerts || {};
    const collectorStatus = data.collectorStatus || {};
    const recentLogs = data.recentCollectorLogs || [];
    const recentUsers = data.recentUsers || [];
    const recentInquiries = data.recentInquiries || [];

    root.querySelector('#dashboard-summary').innerHTML = [
      renderSummaryCard('전체 회원', summary.totalUsers),
      renderSummaryCard('관리자', summary.adminUsers),
      renderSummaryCard('일반 회원', summary.normalUsers),
      renderSummaryCard('전체 문의', summary.totalInquiries),
      renderSummaryCard('신규 문의', summary.receivedInquiries),
      renderSummaryCard('오늘 방문자', summary.todayVisitors),
      renderSummaryCard('오늘 페이지뷰', summary.todayViews),
      renderSummaryCard('24시간 오류', summary.collectorErrors24h)
    ].join('');

    root.querySelector('#dashboard-collector-alerts').innerHTML = `
      <div class="admin-kv-list">
        <div><span>장기 실행 경보</span><strong>${Number(alerts.runningTooLong || 0).toLocaleString()}</strong></div>
        <div><span>최근 오류</span><strong>${Number(alerts.recentErrors || 0).toLocaleString()}</strong></div>
      </div>
    `;

    root.querySelector('#dashboard-collector-status').innerHTML = `
      <div class="admin-kv-list">
        <div><span>활성 수집기</span><strong>${Number(collectorStatus.enabledCount || 0).toLocaleString()}</strong></div>
        <div><span>현재 실행 중</span><strong>${Number(collectorStatus.runningCount || 0).toLocaleString()}</strong></div>
      </div>
    `;

    root.querySelector('#dashboard-recent-logs').innerHTML = renderMiniList(
      recentLogs,
      '최근 수집 이력이 없습니다.',
      (item) => `
        <div class="admin-mini-row">
          <strong>${esc(item.collectorKey || '-')}</strong>
          <span>${esc(item.status || '-')}</span>
          <small>${esc(fmtDate(item.createdAt))}</small>
        </div>
      `
    );

    root.querySelector('#dashboard-recent-users').innerHTML = renderMiniList(
      recentUsers,
      '최근 가입 회원이 없습니다.',
      (item) => `
        <div class="admin-mini-row">
          <strong>${esc(item.nickname || '-')}</strong>
          <span>${esc(item.email || '-')}</span>
          <small>${esc(fmtDate(item.createdAt))}</small>
        </div>
      `
    );

    root.querySelector('#dashboard-recent-inquiries').innerHTML = renderMiniList(
      recentInquiries,
      '최근 문의가 없습니다.',
      (item) => `
        <div class="admin-mini-row">
          <strong>${esc(item.title || '-')}</strong>
          <span>${esc(item.name || '-')}</span>
          <small>${esc(fmtDate(item.createdAt))}</small>
        </div>
      `
    );
  }

  async function load() {
    if (state.loading) return;

    state.loading = true;
    try {
      state.data = await api.getAdminDashboard();
      state.loaded = true;
      render();
    } catch (err) {
      console.error('[DASHBOARD_TAB_LOAD]', err);
      feedback.error(err.message || '대시보드 데이터를 불러오지 못했습니다.');
      root.innerHTML = `<div class="admin-error">대시보드 로딩 실패: ${esc(err.message || '')}</div>`;
    } finally {
      state.loading = false;
    }
  }

  return {
    key: 'dashboard',

    async mount(container) {
      root = container;
      root.innerHTML = template();
      await load();
    },

    async activate() {
      if (!state.loaded) {
        await load();
      }
    },

    async refresh() {
      await load();
    }
  };
}
