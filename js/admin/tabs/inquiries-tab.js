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

export function createInquiriesTab({ api, feedback }) {
  const state = {
    mounted: false,
    loading: false,
    saving: false,
    detailLoading: false,
    detailError: '',
    page: 1,
    limit: 12,
    status: 'all',
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
          <input id="inquiries-search" class="admin-input" type="text" placeholder="이름, 이메일, 제목, 내용 검색" />
          <select id="inquiries-status" class="admin-select">
            <option value="all">전체 상태</option>
            <option value="received">접수</option>
            <option value="in_progress">처리 중</option>
            <option value="done">완료</option>
          </select>
          <button type="button" class="admin-btn" id="inquiries-search-btn">조회</button>
        </div>

        <div id="inquiries-summary" class="admin-stat-grid" style="margin-top:16px;"></div>

        <div class="admin-two-pane" style="margin-top:20px;">
          <section class="admin-panel">
            <div class="admin-panel-head">
              <h3>문의 목록</h3>
              <span id="inquiries-total-text" class="admin-panel-meta"></span>
            </div>
            <div class="admin-panel-body">
              <div class="admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>상태</th>
                      <th>유형</th>
                      <th>제목</th>
                      <th>작성자</th>
                      <th>등록일</th>
                    </tr>
                  </thead>
                  <tbody id="inquiries-tbody">
                    <tr><td colspan="6"><div class="admin-empty">불러오는 중...</div></td></tr>
                  </tbody>
                </table>
              </div>
              <div id="inquiries-pagination" class="admin-pagination"></div>
            </div>
          </section>

          <aside class="admin-panel">
            <div class="admin-panel-head">
              <h3>문의 상세</h3>
            </div>
            <div id="inquiries-detail" class="admin-panel-body">
              <div class="admin-empty">좌측 목록에서 문의를 선택하세요.</div>
            </div>
          </aside>
        </div>
      </section>
    `;
  }

  function renderSummary() {
    const summary = state.summary || {};
    root.querySelector('#inquiries-summary').innerHTML = `
      <article class="admin-stat-card"><div class="admin-stat-label">전체 문의</div><strong class="admin-stat-value">${Number(summary.total || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">접수</div><strong class="admin-stat-value">${Number(summary.received || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">처리 중</div><strong class="admin-stat-value">${Number(summary.in_progress || 0).toLocaleString()}</strong></article>
      <article class="admin-stat-card"><div class="admin-stat-label">완료</div><strong class="admin-stat-value">${Number(summary.done || 0).toLocaleString()}</strong></article>
    `;
  }

  function renderTable() {
    const tbody = root.querySelector('#inquiries-tbody');

    if (!state.items.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="admin-empty">조회된 문의가 없습니다.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = state.items.map((item) => {
      const selected = item.id === state.selectedId ? 'selected' : '';
      return `
        <tr class="admin-table-row ${selected}" data-id="${item.id}">
          <td>${item.id}</td>
          <td>${esc(item.status || '-')}</td>
          <td>${esc(item.category || '-')}</td>
          <td>
            <strong>${esc(item.title || '-')}</strong>
            <div class="admin-table-sub">${esc(item.messagePreview || '')}</div>
          </td>
          <td>
            ${esc(item.name || '-')}
            <div class="admin-table-sub">${esc(item.email || '-')}</div>
          </td>
          <td>${esc(fmtDate(item.createdAt))}</td>
        </tr>
      `;
    }).join('');
  }

  function bindDetailEvents() {
    const saveBtn = root.querySelector('#inquiry-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveDetail);

    const retryBtn = root.querySelector('#inquiry-detail-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        if (!state.selectedId) return;
        await loadDetail(state.selectedId);
      });
    }
  }

  function renderDetail() {
    const el = root.querySelector('#inquiries-detail');

    if (state.detailLoading) {
      el.innerHTML = `<div class="admin-empty">문의 상세를 불러오는 중...</div>`;
      return;
    }

    if (state.detailError) {
      el.innerHTML = `
        <div class="admin-error" style="display:grid;gap:12px;">
          <div>${esc(state.detailError)}</div>
          <button type="button" class="admin-btn" id="inquiry-detail-retry-btn">다시 시도</button>
        </div>
      `;
      bindDetailEvents();
      return;
    }

    if (!state.detail) {
      el.innerHTML = `<div class="admin-empty">선택된 문의가 없습니다.</div>`;
      return;
    }

    const item = state.detail.inquiry || state.detail;

    el.innerHTML = `
      <div class="admin-detail-head">
        <div>
          <div class="admin-detail-id">문의 #${esc(item.id)}</div>
          <h3>${esc(item.title || '-')}</h3>
        </div>
        <span class="admin-status admin-status-${esc(item.status || 'received')}">
          ${esc(item.status || '-')}
        </span>
      </div>

      <div class="admin-detail-grid">
        <div><span>이름</span><strong>${esc(item.name || '-')}</strong></div>
        <div><span>이메일</span><strong>${esc(item.email || '-')}</strong></div>
        <div><span>연락처</span><strong>${esc(item.phone || '-')}</strong></div>
        <div><span>유형</span><strong>${esc(item.category || '-')}</strong></div>
        <div><span>등록일</span><strong>${esc(fmtDate(item.createdAt))}</strong></div>
        <div><span>처리일</span><strong>${esc(fmtDate(item.processedAt))}</strong></div>
      </div>

      <div class="admin-detail-block" style="margin-top:16px;">
        <span>문의 내용</span>
        <div class="admin-detail-message">${esc(item.message || '').replace(/\n/g, '<br>')}</div>
      </div>

      <div class="admin-detail-block" style="margin-top:16px;">
        <span>접속 정보</span>
        <div class="admin-detail-meta">
          페이지: ${esc(item.pageUrl || item.page_url || '-')}<br />
          리퍼러: ${esc(item.referrer || '-')}<br />
          처리자: ${esc(item.processedByUser?.nickname || item.processedBy || '-')}
        </div>
      </div>

      <div class="admin-detail-block" style="margin-top:20px;">
        <span>처리 상태</span>
        <div class="admin-form-grid" style="display:grid;gap:10px;margin-top:10px;">
          <select id="inquiry-status-select" class="admin-select">
            <option value="received" ${item.status === 'received' ? 'selected' : ''}>접수</option>
            <option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>처리 중</option>
            <option value="done" ${item.status === 'done' ? 'selected' : ''}>완료</option>
          </select>

          <textarea id="inquiry-admin-memo" class="admin-textarea" rows="4" placeholder="처리 메모를 입력하세요.">${esc(item.adminMemo || '')}</textarea>

          <button type="button" class="admin-btn" id="inquiry-save-btn" ${state.saving ? 'disabled' : ''}>
            ${state.saving ? '저장 중...' : '상태 저장'}
          </button>
        </div>
      </div>
    `;

    bindDetailEvents();
  }

  async function loadDetail(id) {
    state.detailLoading = true;
    state.detailError = '';
    renderDetail();

    try {
      state.detail = await api.getAdminInquiryDetail(id);
    } catch (err) {
      console.error('[INQUIRY_DETAIL_LOAD]', err);
      state.detail = null;
      state.detailError = err.message || '문의 상세를 불러오지 못했습니다.';
    } finally {
      state.detailLoading = false;
      renderDetail();
    }
  }

  async function saveDetail() {
    if (!state.selectedId || state.saving) return;

    const status = root.querySelector('#inquiry-status-select')?.value || 'received';
    const adminMemo = root.querySelector('#inquiry-admin-memo')?.value?.trim() || '';

    try {
      state.saving = true;
      renderDetail();

      await api.updateAdminInquiry(state.selectedId, { status, adminMemo });
      feedback.success('문의 상태가 저장되었습니다.');
      await loadList();
      await loadDetail(state.selectedId);
    } catch (err) {
      console.error('[INQUIRY_SAVE]', err);
      feedback.error(err.message || '문의 상태 저장에 실패했습니다.');
    } finally {
      state.saving = false;
      renderDetail();
    }
  }

  async function loadList() {
    if (state.loading) return;
    state.loading = true;

    try {
      const resp = await api.getAdminInquiries({
        page: state.page,
        limit: state.limit,
        status: state.status,
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

      root.querySelector('#inquiries-total-text').textContent = `총 ${Number(state.pagination?.total || 0).toLocaleString()}건`;
      root.querySelector('#inquiries-pagination').innerHTML = renderPagination(state.pagination);

      if (state.selectedId) {
        await loadDetail(state.selectedId);
      } else {
        state.detail = null;
        state.detailError = '';
        renderDetail();
      }
    } catch (err) {
      console.error('[INQUIRIES_LIST_LOAD]', err);
      feedback.error(err.message || '문의 목록을 불러오지 못했습니다.');
      root.querySelector('#inquiries-tbody').innerHTML = `<tr><td colspan="6"><div class="admin-error">${esc(err.message || '오류')}</div></td></tr>`;
    } finally {
      state.loading = false;
    }
  }

  function bindEvents() {
    root.querySelector('#inquiries-search-btn').addEventListener('click', async () => {
      state.q = root.querySelector('#inquiries-search').value.trim();
      state.status = root.querySelector('#inquiries-status').value;
      state.page = 1;
      await loadList();
    });

    root.querySelector('#inquiries-search').addEventListener('keydown', async (event) => {
      if (event.key !== 'Enter') return;
      state.q = root.querySelector('#inquiries-search').value.trim();
      state.status = root.querySelector('#inquiries-status').value;
      state.page = 1;
      await loadList();
    });

    root.querySelector('#inquiries-status').addEventListener('change', async () => {
      state.status = root.querySelector('#inquiries-status').value;
      state.page = 1;
      await loadList();
    });

    root.querySelector('#inquiries-tbody').addEventListener('click', async (event) => {
      const row = event.target.closest('[data-id]');
      if (!row) return;

      state.selectedId = Number(row.dataset.id);
      renderTable();
      await loadDetail(state.selectedId);
    });

    root.querySelector('#inquiries-pagination').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-page]');
      if (!button) return;

      state.page = Number(button.dataset.page);
      await loadList();
    });
  }

  return {
    key: 'inquiries',

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
