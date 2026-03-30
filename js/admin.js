(function() {
  'use strict';

  var state = {
    page: 1,
    limit: 12,
    status: 'all',
    q: '',
    items: [],
    selectedId: null,
    me: null
  };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0') + ' ' +
      String(date.getHours()).padStart(2, '0') + ':' +
      String(date.getMinutes()).padStart(2, '0');
  }

  function categoryLabel(value) {
    return {
      general: '일반 문의',
      service: '서비스 이용',
      advertisement: '광고/제휴',
      bug: '오류 제보',
      partnership: '협업 제안',
      other: '기타'
    }[value] || value || '-';
  }

  function statusLabel(value) {
    return {
      received: '접수',
      in_progress: '처리 중',
      done: '완료'
    }[value] || value || '-';
  }

  function statusClass(value) {
    return 'admin-status admin-status-' + (value || 'received');
  }

  function showSection(name) {
    document.querySelectorAll('.admin-section').forEach(function(section) {
      section.style.display = section.dataset.section === name ? 'block' : 'none';
    });
    document.querySelectorAll('.admin-menu-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.section === name);
    });
  }

  function renderSummary(summary) {
    $('inq-total').textContent = (summary.total || 0).toLocaleString();
    $('inq-received').textContent = (summary.received || 0).toLocaleString();
    $('inq-progress').textContent = (summary.in_progress || 0).toLocaleString();
    $('inq-done').textContent = (summary.done || 0).toLocaleString();
  }

  function renderTable(items) {
    var tbody = $('inquiry-tbody');
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="admin-empty">조회된 문의가 없습니다.</div></td></tr>';
      return;
    }

    tbody.innerHTML = items.map(function(item) {
      var selected = item.id === state.selectedId ? ' selected' : '';
      return '<tr class="admin-table-row' + selected + '" data-id="' + item.id + '">' +
        '<td>' + item.id + '</td>' +
        '<td><span class="' + statusClass(item.status) + '">' + statusLabel(item.status) + '</span></td>' +
        '<td>' + esc(categoryLabel(item.category)) + '</td>' +
        '<td><strong>' + esc(item.title || '') + '</strong><div class="admin-table-sub">' + esc(item.messagePreview || '') + '</div></td>' +
        '<td>' + esc(item.name || '') + '<div class="admin-table-sub">' + esc(item.email || '') + '</div></td>' +
        '<td>' + esc(fmtDate(item.createdAt)) + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(function(row) {
      row.addEventListener('click', function() {
        state.selectedId = Number(row.dataset.id);
        renderTable(state.items);
        renderDetail();
      });
    });
  }

  function renderDetail() {
    var panel = $('inquiry-detail');
    var item = state.items.find(function(entry) { return entry.id === state.selectedId; }) || state.items[0];

    if (!item) {
      panel.innerHTML = '<div class="admin-empty">좌측 목록에서 문의를 선택하세요.</div>';
      return;
    }

    state.selectedId = item.id;

    panel.innerHTML =
      '<div class="admin-detail-head">' +
        '<div>' +
          '<div class="admin-detail-id">문의 #' + item.id + '</div>' +
          '<h3>' + esc(item.title || '') + '</h3>' +
        '</div>' +
        '<span class="' + statusClass(item.status) + '">' + statusLabel(item.status) + '</span>' +
      '</div>' +
      '<div class="admin-detail-grid">' +
        '<div><span>유형</span><strong>' + esc(categoryLabel(item.category)) + '</strong></div>' +
        '<div><span>등록일</span><strong>' + esc(fmtDate(item.createdAt)) + '</strong></div>' +
        '<div><span>이름</span><strong>' + esc(item.name || '-') + '</strong></div>' +
        '<div><span>이메일</span><strong>' + esc(item.email || '-') + '</strong></div>' +
        '<div><span>연락처</span><strong>' + esc(item.phone || '-') + '</strong></div>' +
        '<div><span>회원 연결</span><strong>' + esc(item.user ? ((item.user.nickname || '-') + ' / #' + item.user.id) : '비회원') + '</strong></div>' +
      '</div>' +
      '<div class="admin-detail-block"><span>문의 내용</span><div class="admin-detail-message">' + esc(item.message || '').replace(/\n/g, '<br>') + '</div></div>' +
      '<div class="admin-detail-block"><span>접속 정보</span><div class="admin-detail-meta">페이지: ' + esc(item.page_url || '-') + '<br>리퍼러: ' + esc(item.referrer || '-') + '<br>브라우저: ' + esc(item.user_agent || '-') + '</div></div>';
  }

  function renderPagination(pagination) {
    var wrap = $('inquiry-pagination');
    if (!pagination || pagination.pages <= 1) {
      wrap.innerHTML = '';
      return;
    }

    var html = '';
    html += '<button class="admin-page-btn" data-page="' + Math.max(1, pagination.page - 1) + '" ' + (pagination.page <= 1 ? 'disabled' : '') + '>이전</button>';
    for (var i = 1; i <= pagination.pages; i++) {
      if (i < pagination.page - 2 || i > pagination.page + 2) continue;
      html += '<button class="admin-page-btn' + (i === pagination.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    html += '<button class="admin-page-btn" data-page="' + Math.min(pagination.pages, pagination.page + 1) + '" ' + (pagination.page >= pagination.pages ? 'disabled' : '') + '>다음</button>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('button[data-page]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        state.page = Number(btn.dataset.page);
        loadInquiries();
      });
    });
  }

  async function loadInquiries() {
    try {
      $('inquiry-loading').style.display = 'block';
      $('inquiry-empty-top').textContent = '';

      var resp = await PublicAPI.getAdminInquiries({
        page: state.page,
        limit: state.limit,
        status: state.status,
        q: state.q
      });

      state.items = resp.data || [];
      if (!state.selectedId && state.items.length) state.selectedId = state.items[0].id;
      if (state.selectedId && !state.items.some(function(item) { return item.id === state.selectedId; })) {
        state.selectedId = state.items.length ? state.items[0].id : null;
      }

      renderSummary(resp.summary || {});
      renderTable(state.items);
      renderDetail();
      renderPagination(resp.pagination || {});
      $('inquiry-total-text').textContent = '총 ' + ((resp.pagination && resp.pagination.total) || 0).toLocaleString() + '건';
    } catch (err) {
      $('inquiry-tbody').innerHTML = '<tr><td colspan="6"><div class="admin-empty">' + esc(err.message || '목록을 불러오지 못했습니다.') + '</div></td></tr>';
      $('inquiry-detail').innerHTML = '<div class="admin-empty">관리자 API 연결 상태를 확인해주세요.</div>';
      if (typeof Feedback !== 'undefined') Feedback.error(err.message || '문의 목록 조회 실패');
    } finally {
      $('inquiry-loading').style.display = 'none';
    }
  }

  async function boot() {
    if (!PublicAuth.isLoggedIn()) {
      window.location.href = 'login.html';
      return;
    }

    try {
      var meResp = await PublicAuth.getMe();
      var me = meResp.user || null;
      state.me = me;

      if (!me || me.role !== 'admin') {
        alert('관리자만 접근할 수 있습니다.');
        window.location.href = '/';
        return;
      }

      PublicAuth.updateHeader();
      $('admin-name').textContent = me.nickname || me.email || '관리자';
      $('admin-email').textContent = me.email || '';

      document.querySelectorAll('.admin-menu-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          showSection(btn.dataset.section);
          if (btn.dataset.section === 'inquiries') loadInquiries();
        });
      });

      $('inq-status-filter').addEventListener('change', function() {
        state.status = this.value;
        state.page = 1;
        loadInquiries();
      });

      $('inq-search-btn').addEventListener('click', function() {
        state.q = $('inq-search').value.trim();
        state.page = 1;
        loadInquiries();
      });

      $('inq-search').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          state.q = $('inq-search').value.trim();
          state.page = 1;
          loadInquiries();
        }
      });

      showSection('inquiries');
      loadInquiries();
    } catch (err) {
      alert(err.message || '관리자 정보를 확인할 수 없습니다.');
      window.location.href = 'login.html';
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
