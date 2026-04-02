(function() {
  'use strict';

  var state = {
    me: null,
    currentSection: 'dashboard',

    dashboard: null,

    users: {
      page: 1,
      limit: 12,
      role: 'all',
      q: '',
      items: [],
      selectedId: null
    },

    inquiries: {
      page: 1,
      limit: 12,
      status: 'all',
      q: '',
      items: [],
      selectedId: null
    },

    visitorDays: 14
  };

  function $(id) {
    return document.getElementById(id);
  }

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

  function roleLabel(value) {
    return value === 'admin' ? '관리자' : '일반 회원';
  }

  function roleClass(value) {
    return 'admin-status ' + (value === 'admin' ? 'admin-status-done' : 'admin-status-received');
  }

  function showSection(name) {
    state.currentSection = name;

    document.querySelectorAll('.admin-section').forEach(function(section) {
      section.style.display = section.dataset.section === name ? 'block' : 'none';
    });

    document.querySelectorAll('.admin-menu-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.section === name);
    });
  }

  /* ─────────────────────────────
     Dashboard
  ───────────────────────────── */
  function renderDashboardSummary(summary) {
    $('dash-users-total').textContent = (summary.usersTotal || 0).toLocaleString();
    $('dash-users-admin').textContent = (summary.usersAdmin || 0).toLocaleString();
    $('dash-users-normal').textContent = (summary.usersNormal || 0).toLocaleString();
    $('dash-users-today').textContent = (summary.usersToday || 0).toLocaleString();
    $('dash-inquiries-total').textContent = (summary.inquiriesTotal || 0).toLocaleString();
    $('dash-inquiries-received').textContent = (summary.inquiriesReceived || 0).toLocaleString();
    $('dash-visitors-today').textContent = (summary.visitorsToday || 0).toLocaleString();
    $('dash-pageviews-today').textContent = (summary.pageviewsToday || 0).toLocaleString();
  }

  function renderDashboardRecentUsers(list) {
    var wrap = $('dashboard-recent-users');

    if (!list || !list.length) {
      wrap.innerHTML = '<div class="admin-empty">최근 가입 회원이 없습니다.</div>';
      return;
    }

    wrap.innerHTML =
      '<div class="admin-table-wrap">' +
        '<table class="admin-table">' +
          '<thead><tr><th>#</th><th>회원</th><th>권한</th><th>가입일</th></tr></thead>' +
          '<tbody>' +
            list.map(function(item) {
              return '<tr>' +
                '<td>' + item.id + '</td>' +
                '<td><strong>' + esc(item.nickname || '-') + '</strong><div class="admin-table-sub">' + esc(item.email || '-') + '</div></td>' +
                '<td><span class="' + roleClass(item.role) + '">' + roleLabel(item.role) + '</span></td>' +
                '<td>' + esc(fmtDate(item.createdAt)) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
  }

  function renderDashboardRecentInquiries(list) {
    var wrap = $('dashboard-recent-inquiries');

    if (!list || !list.length) {
      wrap.innerHTML = '<div class="admin-empty">최근 문의가 없습니다.</div>';
      return;
    }

    wrap.innerHTML =
      '<div class="admin-table-wrap">' +
        '<table class="admin-table">' +
          '<thead><tr><th>#</th><th>상태</th><th>문의</th><th>등록일</th></tr></thead>' +
          '<tbody>' +
            list.map(function(item) {
              return '<tr>' +
                '<td>' + item.id + '</td>' +
                '<td><span class="' + statusClass(item.status) + '">' + statusLabel(item.status) + '</span></td>' +
                '<td><strong>' + esc(item.title || '-') + '</strong><div class="admin-table-sub">' + esc(item.messagePreview || '') + '</div></td>' +
                '<td>' + esc(fmtDate(item.createdAt)) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
  }

  async function loadDashboard() {
    try {
      $('dashboard-recent-users').innerHTML = '<div class="admin-empty">불러오는 중...</div>';
      $('dashboard-recent-inquiries').innerHTML = '<div class="admin-empty">불러오는 중...</div>';

      var resp = await PublicAPI.getAdminDashboard();
      state.dashboard = resp;

      renderDashboardSummary(resp.summary || {});
      renderDashboardRecentUsers(resp.recentUsers || []);
      renderDashboardRecentInquiries(resp.recentInquiries || []);
    } catch (err) {
      $('dashboard-recent-users').innerHTML = '<div class="admin-empty">' + esc(err.message || '대시보드를 불러오지 못했습니다.') + '</div>';
      $('dashboard-recent-inquiries').innerHTML = '<div class="admin-empty">데이터를 불러오지 못했습니다.</div>';
      if (typeof Feedback !== 'undefined') Feedback.error(err.message || '대시보드 조회 실패');
    }
  }

  /* ─────────────────────────────
     Members
  ───────────────────────────── */
  function renderMemberSummary(summary, pagination) {
    $('mem-total').textContent = (summary.total || 0).toLocaleString();
    $('mem-admin').textContent = (summary.admin || 0).toLocaleString();
    $('mem-user').textContent = (summary.user || 0).toLocaleString();
    $('member-total-text').textContent = '총 ' + ((pagination && pagination.total) || 0).toLocaleString() + '명';
  }

  function renderMembersTable(items) {
    var tbody = $('members-tbody');

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="admin-empty">조회된 회원이 없습니다.</div></td></tr>';
      return;
    }

    tbody.innerHTML = items.map(function(item) {
      var selected = item.id === state.users.selectedId ? ' selected' : '';

      return '<tr class="admin-table-row' + selected + '" data-id="' + item.id + '">' +
        '<td>' + item.id + '</td>' +
        '<td><span class="' + roleClass(item.role) + '">' + roleLabel(item.role) + '</span></td>' +
        '<td><strong>' + esc(item.nickname || '-') + '</strong><div class="admin-table-sub">' + esc(item.email || '-') + '</div></td>' +
        '<td>' + esc(item.company || '-') + '<div class="admin-table-sub">' + esc(item.phone || '-') + '</div></td>' +
        '<td>' + esc(fmtDate(item.createdAt)) + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(function(row) {
      row.addEventListener('click', function() {
        state.users.selectedId = Number(row.dataset.id);
        renderMembersTable(state.users.items);
        loadUserDetail(state.users.selectedId);
      });
    });
  }

  function renderMemberPagination(pagination) {
    var wrap = $('member-pagination');

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
        state.users.page = Number(btn.dataset.page);
        loadUsers();
      });
    });
  }

  function renderMemberDetail(user) {
    var panel = $('member-detail');

    if (!user) {
      panel.innerHTML = '<div class="admin-empty">좌측 목록에서 회원을 선택하세요.</div>';
      return;
    }

    var keywordsText = Array.isArray(user.keywords) ? user.keywords.join(', ') : '';

    panel.innerHTML =
      '<div class="admin-detail-head">' +
        '<div>' +
          '<div class="admin-detail-id">회원 #' + user.id + '</div>' +
          '<h3>' + esc(user.nickname || '-') + '</h3>' +
        '</div>' +
        '<span class="' + roleClass(user.role) + '">' + roleLabel(user.role) + '</span>' +
      '</div>' +

      '<div class="admin-detail-grid">' +
        '<div><span>이메일</span><strong>' + esc(user.email || '-') + '</strong></div>' +
        '<div><span>가입일</span><strong>' + esc(fmtDate(user.createdAt)) + '</strong></div>' +
        '<div><span>즐겨찾기 수</span><strong>' + esc(String(user.bookmarksCount || 0)) + '</strong></div>' +
        '<div><span>키워드 수</span><strong>' + esc(String(user.keywordsCount || 0)) + '</strong></div>' +
      '</div>' +

      '<div class="admin-detail-block">' +
        '<span>회원 수정</span>' +
        '<div style="display:grid;gap:10px;margin-top:10px;">' +

          '<div>' +
            '<div style="font-size:.78rem;color:#6b7280;margin-bottom:6px;">닉네임</div>' +
            '<input id="member-edit-nickname" class="admin-filter-input" type="text" value="' + esc(user.nickname || '') + '">' +
          '</div>' +

          '<div>' +
            '<div style="font-size:.78rem;color:#6b7280;margin-bottom:6px;">회사명</div>' +
            '<input id="member-edit-company" class="admin-filter-input" type="text" value="' + esc(user.company || '') + '">' +
          '</div>' +

          '<div>' +
            '<div style="font-size:.78rem;color:#6b7280;margin-bottom:6px;">연락처</div>' +
            '<input id="member-edit-phone" class="admin-filter-input" type="text" value="' + esc(user.phone || '') + '">' +
          '</div>' +

          '<div>' +
            '<div style="font-size:.78rem;color:#6b7280;margin-bottom:6px;">권한</div>' +
            '<select id="member-edit-role" class="admin-filter-input">' +
              '<option value="user"' + (user.role === 'user' ? ' selected' : '') + '>일반 회원</option>' +
              '<option value="admin"' + (user.role === 'admin' ? ' selected' : '') + '>관리자</option>' +
            '</select>' +
          '</div>' +

          '<div>' +
            '<div style="font-size:.78rem;color:#6b7280;margin-bottom:6px;">관심 키워드 (쉼표 또는 줄바꿈 구분)</div>' +
            '<textarea id="member-edit-keywords" class="admin-filter-input" style="min-height:110px;resize:vertical;">' + esc(keywordsText) + '</textarea>' +
          '</div>' +

          '<div style="display:flex;justify-content:flex-end;">' +
            '<button id="member-save-btn" class="admin-primary-btn"><i class="fas fa-floppy-disk"></i> 저장</button>' +
          '</div>' +

        '</div>' +
      '</div>';

    $('member-save-btn').addEventListener('click', async function() {
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중';

      try {
        var payload = {
          nickname: $('member-edit-nickname').value.trim(),
          company: $('member-edit-company').value.trim(),
          phone: $('member-edit-phone').value.trim(),
          role: $('member-edit-role').value,
          keywords: $('member-edit-keywords').value
        };

        var resp = await PublicAPI.updateAdminUser(user.id, payload);
        var updated = resp.user;

        state.users.items = state.users.items.map(function(item) {
          return item.id === updated.id ? updated : item;
        });

        renderMembersTable(state.users.items);
        renderMemberDetail(updated);
        loadDashboard();

        if (typeof Feedback !== 'undefined') {
          Feedback.success(resp.message || '회원 정보가 저장되었습니다.');
        }
      } catch (err) {
        if (typeof Feedback !== 'undefined') {
          Feedback.error(err.message || '회원 정보 저장 실패');
        } else {
          alert(err.message || '회원 정보 저장 실패');
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-floppy-disk"></i> 저장';
      }
    });
  }

  async function loadUserDetail(id) {
    try {
      var resp = await PublicAPI.getAdminUser(id);
      renderMemberDetail(resp.user || null);
    } catch (err) {
      $('member-detail').innerHTML = '<div class="admin-empty">' + esc(err.message || '회원 상세를 불러오지 못했습니다.') + '</div>';
    }
  }

  async function loadUsers() {
    try {
      $('member-loading').style.display = 'block';
      $('member-empty-top').textContent = '';

      var resp = await PublicAPI.getAdminUsers({
        page: state.users.page,
        limit: state.users.limit,
        role: state.users.role,
        q: state.users.q
      });

      state.users.items = resp.data || [];

      if (!state.users.selectedId && state.users.items.length) {
        state.users.selectedId = state.users.items[0].id;
      }

      if (state.users.selectedId && !state.users.items.some(function(item) { return item.id === state.users.selectedId; })) {
        state.users.selectedId = state.users.items.length ? state.users.items[0].id : null;
      }

      renderMemberSummary(resp.summary || {}, resp.pagination || {});
      renderMembersTable(state.users.items);
      renderMemberPagination(resp.pagination || {});

      if (state.users.selectedId) {
        loadUserDetail(state.users.selectedId);
      } else {
        renderMemberDetail(null);
      }
    } catch (err) {
      $('members-tbody').innerHTML = '<tr><td colspan="5"><div class="admin-empty">' + esc(err.message || '회원 목록을 불러오지 못했습니다.') + '</div></td></tr>';
      $('member-detail').innerHTML = '<div class="admin-empty">회원 API 연결 상태를 확인해주세요.</div>';
      if (typeof Feedback !== 'undefined') Feedback.error(err.message || '회원 목록 조회 실패');
    } finally {
      $('member-loading').style.display = 'none';
    }
  }

  /* ─────────────────────────────
     Inquiries
  ───────────────────────────── */
  function renderInquirySummary(summary) {
    $('inq-total').textContent = (summary.total || 0).toLocaleString();
    $('inq-received').textContent = (summary.received || 0).toLocaleString();
    $('inq-progress').textContent = (summary.in_progress || 0).toLocaleString();
    $('inq-done').textContent = (summary.done || 0).toLocaleString();
  }

  function renderInquiryTable(items) {
    var tbody = $('inquiry-tbody');

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="admin-empty">조회된 문의가 없습니다.</div></td></tr>';
      return;
    }

    tbody.innerHTML = items.map(function(item) {
      var selected = item.id === state.inquiries.selectedId ? ' selected' : '';

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
        state.inquiries.selectedId = Number(row.dataset.id);
        renderInquiryTable(state.inquiries.items);
        renderInquiryDetail();
      });
    });
  }

  function renderInquiryDetail() {
    var panel = $('inquiry-detail');
    var item = state.inquiries.items.find(function(entry) {
      return entry.id === state.inquiries.selectedId;
    }) || state.inquiries.items[0];

    if (!item) {
      panel.innerHTML = '<div class="admin-empty">좌측 목록에서 문의를 선택하세요.</div>';
      return;
    }

    state.inquiries.selectedId = item.id;

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

  function renderInquiryPagination(pagination) {
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
        state.inquiries.page = Number(btn.dataset.page);
        loadInquiries();
      });
    });
  }

  async function loadInquiries() {
    try {
      $('inquiry-loading').style.display = 'block';
      $('inquiry-empty-top').textContent = '';

      var resp = await PublicAPI.getAdminInquiries({
        page: state.inquiries.page,
        limit: state.inquiries.limit,
        status: state.inquiries.status,
        q: state.inquiries.q
      });

      state.inquiries.items = resp.data || [];

      if (!state.inquiries.selectedId && state.inquiries.items.length) {
        state.inquiries.selectedId = state.inquiries.items[0].id;
      }

      if (state.inquiries.selectedId && !state.inquiries.items.some(function(item) { return item.id === state.inquiries.selectedId; })) {
        state.inquiries.selectedId = state.inquiries.items.length ? state.inquiries.items[0].id : null;
      }

      renderInquirySummary(resp.summary || {});
      renderInquiryTable(state.inquiries.items);
      renderInquiryDetail();
      renderInquiryPagination(resp.pagination || {});
      $('inquiry-total-text').textContent = '총 ' + ((resp.pagination && resp.pagination.total) || 0).toLocaleString() + '건';
    } catch (err) {
      $('inquiry-tbody').innerHTML = '<tr><td colspan="6"><div class="admin-empty">' + esc(err.message || '목록을 불러오지 못했습니다.') + '</div></td></tr>';
      $('inquiry-detail').innerHTML = '<div class="admin-empty">관리자 API 연결 상태를 확인해주세요.</div>';
      if (typeof Feedback !== 'undefined') Feedback.error(err.message || '문의 목록 조회 실패');
    } finally {
      $('inquiry-loading').style.display = 'none';
    }
  }

  /* ─────────────────────────────
     Visitor stats
  ───────────────────────────── */
  function renderVisitorSummary(summary) {
    $('vis-today-views').textContent = (summary.todayViews || 0).toLocaleString();
    $('vis-today-visitors').textContent = (summary.todayVisitors || 0).toLocaleString();
    $('vis-total-views').textContent = (summary.totalViews || 0).toLocaleString();
    $('vis-total-visitors').textContent = (summary.totalVisitors || 0).toLocaleString();
  }

  function renderVisitorDaily(daily) {
    var wrap = $('vis-daily');

    if (!daily || !daily.length) {
      wrap.innerHTML = '<div class="admin-empty">집계 데이터가 없습니다.</div>';
      return;
    }

    var maxViews = Math.max.apply(null, daily.map(function(item) { return item.views || 0; }));
    if (!maxViews) maxViews = 1;

    wrap.innerHTML = daily.map(function(item) {
      var ratio = Math.max(6, Math.round(((item.views || 0) / maxViews) * 100));
      return '' +
        '<div style="display:grid;grid-template-columns:90px 1fr 110px;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid #f3f4f6;">' +
          '<strong style="font-size:.82rem;color:#374151;">' + esc(item.date) + '</strong>' +
          '<div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;">' +
            '<div style="width:' + ratio + '%;height:100%;background:linear-gradient(90deg,#2563eb,#60a5fa);"></div>' +
          '</div>' +
          '<span style="font-size:.8rem;color:#6b7280;text-align:right;">PV ' + (item.views || 0) + ' / UV ' + (item.visitors || 0) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderTopPages(list) {
    var wrap = $('vis-top-pages');

    if (!list || !list.length) {
      wrap.innerHTML = '<div class="admin-empty">인기 페이지 데이터가 없습니다.</div>';
      return;
    }

    wrap.innerHTML =
      '<div class="admin-table-wrap">' +
        '<table class="admin-table">' +
          '<thead><tr><th>순위</th><th>경로</th><th>페이지뷰</th></tr></thead>' +
          '<tbody>' +
            list.map(function(item, idx) {
              return '<tr>' +
                '<td>' + (idx + 1) + '</td>' +
                '<td style="word-break:break-all;">' + esc(item.path || '/') + '</td>' +
                '<td>' + (item.views || 0).toLocaleString() + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
  }

  function renderRecentVisits(list) {
    var wrap = $('vis-recent');

    if (!list || !list.length) {
      wrap.innerHTML = '<div class="admin-empty">최근 방문 기록이 없습니다.</div>';
      return;
    }

    wrap.innerHTML =
      '<div class="admin-table-wrap">' +
        '<table class="admin-table">' +
          '<thead><tr><th>시간</th><th>경로</th><th>리퍼러</th><th>세션</th></tr></thead>' +
          '<tbody>' +
            list.map(function(item) {
              return '<tr>' +
                '<td>' + esc(fmtDate(item.createdAt)) + '</td>' +
                '<td style="word-break:break-all;">' + esc(item.path || '/') + '</td>' +
                '<td style="word-break:break-all;">' + esc(item.referrer || '-') + '</td>' +
                '<td>' + esc(item.session_id || '-') + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
  }

  async function loadVisitorStats() {
    try {
      $('vis-daily').innerHTML = '<
