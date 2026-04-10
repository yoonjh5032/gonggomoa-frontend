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

export function createUsersTab({ api, feedback }) {
  const state = {
    mounted: false,
    loading: false,
    page: 1,
    limit: 12,
    role: 'all',
    q: '',
    items: [],
    selectedId: null,
    summary: null,
    pagination: null,
    detail: null
  };

  let root;

  function template() {
    return `
      <section class="admin-section-shell">
        <div class="admin-filterbar">
          <input id="users-search" class="admin-input" type="text" placeholder="이메일, 닉네임, 회사명 검색" />
          <select id="users-role" class="admin-select">
            <option value="all">전체 권한</option>
            <option value="admin">관리자</option>
            <option value="user">일반 회원</option>
          </select>
          <button type="button" class="admin-btn" id="users-search-btn">조회</button>
        </div>

        <div id="users-summary" class="admin-stat-grid" style="margin-top:16px;"></div>

        <div class="admin-two-pane" style="margin-top:20px;">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h3>회원 목록</h3>
              <span id="users-total-text" class="admin-panel-meta"></span>
            </div>
            <div class="admin-panel-body">
              <div class="admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>권한</th>
                      <th>회원 정보</th>
                      <th>회사/연락처</th>
                      <th>가입일</th>
                    </tr>
                  </thead>
                  <tbody id="users-tbody">
                    <tr><td colspan="5"><div class="admin-empty">불러오는 중...</div></td></tr>
                  </tbody>
                </table>
              </div>
              <div id="users-pagination" class="admin-pagination"></div>
            </div>
          </section>

          <aside class="admin-panel">
            <div class="admin-panel-head">
              <h3>회원 상세</h3>
            </div>
            <div id="users-detail" class="admin-panel-body">
              <div class="admin-empty">좌측 목록에서 회원을 선택하세요.</div>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderSummary() {
    const summary = state.summary || {};
    root.querySelector('#users-summary').innerHTML = `
      <article class="admin-stat-card"><div class="admin-stat-label">전체 회원</div><strong class="admin-stat-value">${Number(summary.total || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">관리자</div><strong class="admin-stat-value">${Number(summary.admin || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">일반 회원</div><strong class="admin-stat-value">${Number(summary.user || 0).toLocaleString()}</strong></article>
    `;
  }

  function renderTable() {
    const tbody = root.querySelector('#users-tbody');

    if (!state.items.length) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="admin-empty">조회된 회원이 없습니다.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = state.items.map((item) => {
      const selected = item.id === state.selectedId ? 'selected' : '';
      return `
        <tr class="admin-table-row ${selected}" data-id="${item.id}">
          <td>${item.id}</td>
          <td>${esc(item.role || '-')}</td>
          <td>
            <strong>${esc(item.nickname || '-')}</strong>
            <div class="admin-table-sub">${esc(item.email || '-')}</div>
          </td>
          <td>
            ${esc(item.company || '-')}
            <div class="admin-table-sub">${esc(item.phone || '-')}</div>
          </td>
          <td>${esc(fmtDate(item.createdAt))}</td>
        </tr>
      `;
    }).join('');
  }

  function renderDetail() {
    const detailEl = root.querySelector('#users-detail');

    if (!state.detail) {
      detailEl.innerHTML = `<div class="admin-empty">선택된 회원 정보가 없습니다.</div>`;
      return;
    }

    const user = state.detail.user || state.detail;

    detailEl.innerHTML = `
      <div class="admin-detail-grid">
        <div><span>ID</span><strong>${esc(user.id)}</strong></div>
        <div><span>권한</span><strong>${esc(user.role || '-')}</strong></div>
        <div><span>닉네임</span><strong>${esc(user.nickname || '-')}</strong></div>
        <div><span>이메일</span><strong>${esc(user.email || '-')}</strong></div>
        <div><span>회사명</span><strong>${esc(user.company || '-')}</strong></div>
        <div><span>연락처</span><strong>${esc(user.phone || '-')}</strong></div>
        <div><span>가입일</span><strong>${esc(fmtDate(user.createdAt))}</strong></div>
      </div>

      <div class="admin-detail-block" style="margin-top:16px;">
        <span>관심 키워드</span>
        <div class="admin-detail-message">${esc((user.keywords || []).join(', ') || '-')}</div>
      </div>
    `;
  }

  async function loadDetail(id) {
    try {
      state.detail = await api.getAdminUserDetail(id);
      renderDetail();
    } catch (err) {
      console.error('[USERS_DETAIL_LOAD]', err);
      feedback.error(err.message || '회원 상세를 불러오지 못했습니다.');
    }
  }

  async function loadList() {
    if (state.loading) return;
    state.loading = true;

    try {
      const resp = await api.getAdminUsers({
        page: state.page,
        limit: state.limit,
        role: state.role,
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

      root.querySelector('#users-total-text').textContent =
        `총 ${Number(state.pagination?.total || 0).toLocaleString()}건`;

      root.querySelector('#users-pagination').innerHTML = renderPagination(state.pagination);

      if (state.selectedId) {
        await loadDetail(state.selectedId);
      } else {
        state.detail = null;
        renderDetail();
      }
    } catch (err) {
      console.error('[USERS_LIST_LOAD]', err);
      feedback.error(err.message || '회원 목록을 불러오지 못했습니다.');
      root.querySelector('#users-tbody').innerHTML =
        `<tr><td colspan="5"><div class="admin-error">${esc(err.message || '오류')}</div></td></tr>`;
    } finally {
      state.loading = false;
    }
  }

  function bindEvents() {
    root.querySelector('#users-search-btn').addEventListener('click', async () => {
      state.q = root.querySelector('#users-search').value.trim();
      state.role = root.querySelector('#users-role').value;
      state.page = 1;
      await loadList();
    });

    root.querySelector('#users-search').addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      state.q = root.querySelector('#users-search').value.trim();
      state.role = root.querySelector('#users-role').value;
      state.page = 1;
      await loadList();
    });

    root.querySelector('#users-role').addEventListener('change', async () => {
      state.role = root.querySelector('#users-role').value;
      state.page = 1;
      await loadList();
    });

    root.querySelector('#users-tbody').addEventListener('click', async (event) => {
      const row = event.target.closest('[data-id]');
      if (!row) return;

      state.selectedId = Number(row.dataset.id);
      renderTable();
      await loadDetail(state.selectedId);
    });

    root.querySelector('#users-pagination').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-page]');
      if (!button) return;

      state.page = Number(button.dataset.page);
      await loadList();
    });
  }

  return {
    key: 'users',

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
