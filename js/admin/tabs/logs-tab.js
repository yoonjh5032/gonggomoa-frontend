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

function prettyJson(value) {
  if (value == null) return '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch (err) {
    return String(value);
  }
}

function renderPagination(pagination) {
  if (!pagination || pagination.pages <= 1) return '';

  let html = '';
  html += `<button class="admin-page-btn" data-page="${Math.max(1, pagination.page - 1)}" ${pagination.page <= 1 ? 'disabled' : ''}>이전</button>`;

  for (let i = 1; i <= pagination.pages; i += 1) {
    if (i < pagination.page - 2 || i > pagination.page + 2) continue;
    html += `<button class="admin-page-btn ${i === pagination.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  html += `<button class="admin-page-btn" data-page="${Math.min(pagination.pages, pagination.page + 1)}" ${pagination.page >= pagination.pages ? 'disabled' : ''}>다음</button>`;
  return html;
}

export function createLogsTab({ api, feedback }) {
  const state = {
    mounted: false,
    loading: false,
    page: 1,
    limit: 20,
    key: 'all',
    status: 'all',
    triggerType: 'all',
    from: '',
    to: '',
    q: '',
    items: [],
    summary: null,
    pagination: null,
    selectedId: null,
    detail: null
  };

  let root;

  function template() {
    return `
      <section class="admin-section-shell">
        <div class="admin-filterbar admin-filterbar-wide">
          <select id="logs-key" class="admin-select">
            <option value="all">전체 수집기</option>
            <option value="g2b_api">나라장터 API</option>
            <option value="seoul_contract">서울 계약마당</option>
            <option value="local_gov">지자체</option>
          </select>

          <select id="logs-status" class="admin-select">
            <option value="all">전체 상태</option>
            <option value="success">성공</option>
            <option value="failed">실패</option>
            <option value="running">실행 중</option>
          </select>

          <select id="logs-trigger" class="admin-select">
            <option value="all">전체 트리거</option>
            <option value="manual">수동</option>
            <option value="schedule">스케줄</option>
          </select>

          <input id="logs-from" class="admin-input" type="date" />
          <input id="logs-to" class="admin-input" type="date" />
          <input id="logs-search" class="admin-input" type="text" placeholder="검색어 입력" />
          <button type="button" class="admin-btn" id="logs-search-btn">조회</button>
        </div>

        <div id="logs-summary" class="admin-stat-grid" style="margin-top:16px;"></div>

        <div class="admin-two-pane" style="margin-top:20px;">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h3>수집 로그</h3>
              <span id="logs-total-text" class="admin-panel-meta"></span>
            </div>
            <div class="admin-panel-body">
              <div class="admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>수집기</th>
                      <th>상태</th>
                      <th>트리거</th>
                      <th>시작 시각</th>
                      <th>소요 시간</th>
                    </tr>
                  </thead>
                  <tbody id="logs-tbody">
                    <tr><td colspan="6"><div class="admin-empty">불러오는 중...</div></td></tr>
                  </tbody>
                </table>
              </div>
              <div id="logs-pagination" class="admin-pagination"></div>
            </div>
          </section>

          <aside class="admin-panel">
            <div class="admin-panel-head">
              <h3>로그 상세</h3>
            </div>
            <div id="logs-detail" class="admin-panel-body">
              <div class="admin-empty">좌측 목록에서 로그를 선택하세요.</div>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderSummary() {
    const summary = state.summary || {};
    root.querySelector('#logs-summary').innerHTML = `
      <article class="admin-stat-card"><div class="admin-stat-label">전체 실행</div><strong class="admin-stat-value">${Number(summary.total || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">성공</div><strong class="admin-stat-value">${Number(summary.success || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">실패</div><strong class="admin-stat-value">${Number(summary.failed || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">실행 중</div><strong class="admin-stat-value">${Number(summary.running || 0).toLocaleString()}</strong></article>
    `;
  }

  function renderTable() {
    const tbody = root.querySelector('#logs-tbody');

    if (!state.items.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="admin-empty">조회된 로그가 없습니다.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = state.items.map((item) => {
      const selected = item.id === state.selectedId ? 'selected' : '';
      return `
        <tr class="admin-table-row ${selected}" data-id="${item.id}">
          <td>${item.id}</td>
          <td>${esc(item.collectorKey || '-')}</td>
          <td>${esc(item.status || '-')}</td>
          <td>${esc(item.triggerType || '-')}</td>
          <td>${esc(fmtDate(item.startedAt || item.createdAt))}</td>
          <td>${esc(item.durationMs != null ? `${item.durationMs}ms` : '-')}</td>
        </tr>
      `;
    }).join('');
  }

  function renderDetail() {
    const el = root.querySelector('#logs-detail');

    if (!state.detail) {
      el.innerHTML = `<div class="admin-empty">선택된 로그가 없습니다.</div>`;
      return;
    }

    const item = state.detail.log || state.detail;

    el.innerHTML = `
      <div class="admin-detail-grid">
        <div><span>ID</span><strong>${esc(item.id)}</strong></div>
        <div><span>수집기</span><strong>${esc(item.collectorKey || '-')}</strong></div>
        <div><span>상태</span><strong>${esc(item.status || '-')}</strong></div>
        <div><span>트리거</span><strong>${esc(item.triggerType || '-')}</strong></div>
        <div><span>시작</span><strong>${esc(fmtDate(item.startedAt || item.createdAt))}</strong></div>
        <div><span>종료</span><strong>${esc(fmtDate(item.finishedAt))}</strong></div>
      </div>

      <div class="admin-detail-block" style="margin-top:16px;">
        <span>메시지</span>
        <div class="admin-detail-message">${esc(item.message || '-')}</div>
      </div>

      <div class="admin-detail-block" style="margin-top:16px;">
        <span>원본 데이터</span>
        <pre class="admin-pre">${esc(prettyJson(item.payload || item.meta || item))}</pre>
      </div>
    `;
  }

  async function loadDetail(id) {
    try {
      state.detail = await api.getAdminCollectorLogDetail(id);
      renderDetail();
    } catch (err) {
      console.error('[LOG_DETAIL_LOAD]', err);
      feedback.error(err.message || '로그 상세를 불러오지 못했습니다.');
    }
  }

  async function loadList() {
    if (state.loading) return;
    state.loading = true;

    try {
      const resp = await api.getAdminCollectorLogs({
        page: state.page,
        limit: state.limit,
        key: state.key,
        status: state.status,
        triggerType: state.triggerType,
        from: state.from,
        to: state.to,
        q: state.q
      });

      state.items = resp.data || [];
      state.summary = resp.summary || {};
      state.pagination = resp.pagination || null;

      if (!state.selectedId && state.items.length) {
        state.selectedId = state.items[0].id;
      }

      if (state.selectedId && !state.items.some((item) => item.id === state.selectedId)) {
        state.selectedId = state.items[0]?.id || null;
      }

      renderSummary();
      renderTable();

      root.querySelector('#logs-total-text').textContent =
        `총 ${Number(state.pagination?.total || 0).toLocaleString()}건`;
      root.querySelector('#logs-pagination').innerHTML = renderPagination(state.pagination);

      if (state.selectedId) {
        await loadDetail(state.selectedId);
      } else {
        state.detail = null;
        renderDetail();
      }
    } catch (err) {
      console.error('[LOGS_LIST_LOAD]', err);
      feedback.error(err.message || '수집 로그를 불러오지 못했습니다.');
      root.querySelector('#logs-tbody').innerHTML =
        `<tr><td colspan="6"><div class="admin-error">${esc(err.message || '오류')}</div></td></tr>`;
    } finally {
      state.loading = false;
    }
  }

  function bindEvents() {
    root.querySelector('#logs-search-btn').addEventListener('click', async () => {
      state.key = root.querySelector('#logs-key').value;
      state.status = root.querySelector('#logs-status').value;
      state.triggerType = root.querySelector('#logs-trigger').value;
      state.from = root.querySelector('#logs-from').value;
      state.to = root.querySelector('#logs-to').value;
      state.q = root.querySelector('#logs-search').value.trim();
      state.page = 1;
      await loadList();
    });

    root.querySelector('#logs-tbody').addEventListener('click', async (event) => {
      const row = event.target.closest('[data-id]');
      if (!row) return;

      state.selectedId = Number(row.dataset.id);
      renderTable();
      await loadDetail(state.selectedId);
    });

    root.querySelector('#logs-pagination').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-page]');
      if (!button) return;

      state.page = Number(button.dataset.page);
      await loadList();
    });
  }

  return {
    key: 'logs',

    async mount(container) {
      root = container;
      root.innerHTML = template();
      bindEvents();
      state.mounted = true;
      await loadList();
    },

    async activate() {
      if (!state.mounted) return;
    },

    async refresh() {
      await loadList();
    }
  };
}
