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

    collectorLogs: {
      page: 1,
      limit: 20,
      key: 'all',
      status: 'all',
      triggerType: 'all',
      from: '',
      to: '',
      q: '',
      items: [],
      selectedId: null,
      pagination: null,
      summary: null
    },

    visitorDays: 14,
    collectorActionLoading: {}
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

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function fmtDate(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return date.getFullYear() + '-' +
      pad2(date.getMonth() + 1) + '-' +
      pad2(date.getDate()) + ' ' +
      pad2(date.getHours()) + ':' +
      pad2(date.getMinutes());
  }

  function fmtDateSeconds(value) {
    if (!value) return '-';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);

    return date.getFullYear() + '-' +
      pad2(date.getMonth() + 1) + '-' +
      pad2(date.getDate()) + ' ' +
      pad2(date.getHours()) + ':' +
      pad2(date.getMinutes()) + ':' +
      pad2(date.getSeconds());
  }

  function fmtDuration(ms) {
    var value = Number(ms || 0);
    if (!value || value < 1000) return '-';

    var seconds = Math.round(value / 1000);
    if (seconds < 60) return seconds + '초';

    var minutes = Math.floor(seconds / 60);
    var remainSeconds = seconds % 60;
    if (minutes < 60) {
      return minutes + '분' + (remainSeconds ? ' ' + remainSeconds + '초' : '');
    }

    var hours = Math.floor(minutes / 60);
    var remainMinutes = minutes % 60;
    return hours + '시간' + (remainMinutes ? ' ' + remainMinutes + '분' : '');
  }

  function prettyJson(value) {
    if (value === null || value === undefined || value === '') return '-';

    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return String(value);
    }
  }

  function notifySuccess(message) {
    if (typeof Feedback !== 'undefined' && Feedback && typeof Feedback.success === 'function') {
      Feedback.success(message || '처리되었습니다.');
      return;
    }
    alert(message || '처리되었습니다.');
  }

  function notifyError(message) {
    if (typeof Feedback !== 'undefined' && Feedback && typeof Feedback.error === 'function') {
      Feedback.error(message || '오류가 발생했습니다.');
      return;
    }
    alert(message || '오류가 발생했습니다.');
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

  function getApiBase() {
    if (typeof PublicAPI !== 'undefined' && PublicAPI && PublicAPI.API_BASE) {
      return String(PublicAPI.API_BASE).replace(/\/$/, '');
    }
    return '/api';
  }

  function getAdminToken() {
    try {
      return localStorage.getItem('gm_token') || '';
    } catch (err) {
      return '';
    }
  }

  async function adminRequest(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var token = getAdminToken();
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    var resp = await fetch(getApiBase() + '/admin' + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });

    var data = {};
    try {
      data = await resp.json();
    } catch (err) {
      data = {};
    }

    if (!resp.ok) {
      throw new Error(data.error || '관리자 요청 처리에 실패했습니다.');
    }

    return data;
  }

  function queueDashboardRefresh(delays) {
    (delays || []).forEach(function(delay) {
      setTimeout(function() {
        if (state.currentSection === 'dashboard') {
          loadDashboard();
        }
        if (state.currentSection === 'collector-logs') {
          loadCollectorLogs();
        }
      }, delay);
    });
  }

  async function runCollectorAction(key) {
    if (!key || state.collectorActionLoading[key]) return;

    state.collectorActionLoading[key] = true;
    renderCollectorStatus((state.dashboard && state.dashboard.collectorStatus) || {});

    try {
      var resp = await adminRequest('POST', '/collectors/' + encodeURIComponent(key) + '/run', {});

      if (!state.dashboard) state.dashboard = {};
      if (!state.dashboard.summary) state.dashboard.summary = {};

      if (resp.collectorStatus) {
        state.dashboard.collectorStatus = resp.collectorStatus;

        var items = Array.isArray(resp.collectorStatus.items) ? resp.collectorStatus.items : [];
        state.dashboard.summary.collectorsEnabled = items.filter(function(item) { return item.enabled; }).length;
        state.dashboard.summary.collectorsRunning = items.filter(function(item) { return item.running; }).length;
        renderDashboardSummary(state.dashboard.summary);
      }

      if (Array.isArray(resp.recentCollectorLogs)) {
        state.dashboard.recentCollectorLogs = resp.recentCollectorLogs;
      }

      renderCollectorStatus(state.dashboard.collectorStatus || {});
      renderCollectorRunLogs(state.dashboard.recentCollectorLogs || []);

      if (resp.started) {
        notifySuccess(resp.message || '수동 실행을 시작했습니다.');
      } else {
        notifyError(resp.message || '수동 실행을 시작할 수 없습니다.');
      }

      if (state.currentSection === 'collector-logs') {
        loadCollectorLogs();
      }

      queueDashboardRefresh(resp.started ? [1000, 3000, 7000] : [1000]);
    } catch (err) {
      notifyError(err.message || '수동 실행 요청 실패');
    } finally {
      delete state.collectorActionLoading[key];
      renderCollectorStatus((state.dashboard && state.dashboard.collectorStatus) || {});
    }
  }

  function showSection(name) {
    state.currentSection = name;

    document.querySelectorAll('.admin-section').forEach(function(section) {
      section.style.display = section.dataset.section === name ? 'block' : 'none';
    });

    document.querySelectorAll('.admin-menu-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.section === name);
    });

    if (name === 'dashboard') loadDashboard();
    if (name === 'collector-logs') loadCollectorLogs();
    if (name === 'members') loadUsers();
    if (name === 'stats') loadVisitorStats();
    if (name === 'inquiries') loadInquiries();
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

    if ($('dash-collectors-enabled')) {
      $('dash-collectors-enabled').textContent = (summary.collectorsEnabled || 0).toLocaleString();
    }

    if ($('dash-collectors-running')) {
      $('dash-collectors-running').textContent = (summary.collectorsRunning || 0).toLocaleString();
    }
  }

  function monitorStatusLabel(item) {
    if (!item || item.enabled === false) {
      return { text: '비활성', className: 'admin-status admin-status-received' };
    }

    if (item.running) {
      return { text: '실행 중', className: 'admin-status admin-status-in_progress' };
    }

    if (item.lastErrorAt && (!item.lastSuccessAt || new Date(item.lastErrorAt) > new Date(item.lastSuccessAt))) {
      return { text: '최근 오류', className: 'admin-status admin-status-received' };
    }

    return { text: '정상', className: 'admin-status admin-status-done' };
  }

  function summarizeCollectorResult(item) {
    var result = item && item.lastResult;
    var parts = [];

    if (result && typeof result === 'object') {
      if (result.new !== undefined) parts.push('신규 ' + result.new);
      if (result.updated !== undefined) parts.push('갱신 ' + result.updated);
      if (result.errors !== undefined) parts.push('에러 ' + result.errors);
      if (result.parsed !== undefined) parts.push('파싱 ' + result.parsed);
      if (result.kept !== undefined) parts.push('유지 ' + result.kept);
      if (result.newCount !== undefined) parts.push('신규 ' + result.newCount);
      if (result.updatedCount !== undefined) parts.push('갱신 ' + result.updatedCount);
      if (result.errorCount !== undefined) parts.push('에러 ' + result.errorCount);
      if (result.parsedCount !== undefined) parts.push('파싱 ' + result.parsedCount);
      if (result.deleted !== undefined) parts.push('삭제 ' + result.deleted);
    }

    if (!parts.length && item && item.lastSkippedReason) {
      parts.push('건너뜀 ' + item.lastSkippedReason);
    }

    return parts.length ? parts.join(' / ') : '-';
  }

  function collectorTriggerLabel(value) {
    return {
      manual: '수동',
      scheduled: '자동',
      startup: '기동',
      maintenance: '정리'
    }[value] || value || '-';
  }

  function collectorRunStatusMeta(log) {
    if (!log) return { text: '-', className: 'admin-status admin-status-received' };

    if (log.status === 'success') {
      return { text: '성공', className: 'admin-status admin-status-done' };
    }
    if (log.status === 'error') {
      return { text: '오류', className: 'admin-status admin-status-received' };
    }
    if (log.status === 'skipped') {
      return { text: '건너뜀', className: 'admin-status admin-status-in_progress' };
    }
    return { text: '시작', className: 'admin-status admin-status-in_progress' };
  }

  function summarizeCollectorLogResult(log) {
    if (!log) return '-';

    if (log.status === 'skipped') {
      return log.skip_reason ? ('건너뜀 · ' + log.skip_reason) : '건너뜀';
    }

    if (log.status === 'error') {
      return log.error_message || '실행 오류';
    }

    var result = log.result;
    var parts = [];

    if (result && typeof result === 'object') {
      if (result.new !== undefined) parts.push('신규 ' + result.new);
      if (result.updated !== undefined) parts.push('갱신 ' + result.updated);
      if (result.errors !== undefined) parts.push('에러 ' + result.errors);
      if (result.parsed !== undefined) parts.push('파싱 ' + result.parsed);
      if (result.kept !== undefined) parts.push('유지 ' + result.kept);
      if (result.newCount !== undefined) parts.push('신규 ' + result.newCount);
      if (result.updatedCount !== undefined) parts.push('갱신 ' + result.updatedCount);
      if (result.errorCount !== undefined) parts.push('에러 ' + result.errorCount);
      if (result.parsedCount !== undefined) parts.push('파싱 ' + result.parsedCount);
      if (result.deleted !== undefined) parts.push('삭제 ' + result.deleted);
    }

    return parts.length ? parts.join(' / ') : '-';
  }

  function collectorActorLabel(log) {
    if (!log) return '-';

    if (log.trigger_type !== 'manual') {
      return '시스템';
    }

    var name = log.actor_name || '';
    var email = log.actor_email || '';
    var role = log.actor_role || '';

    if (name && email) {
      return name + ' (' + email + ')' + (role ? ' · ' + role : '');
    }

    if (email) {
      return email + (role ? ' · ' + role : '');
    }

    if (name) {
      return name + (role ? ' · ' + role : '');
    }

    if (log.actor_user_id) {
      return '관리자 #' + log.actor_user_id;
    }

    return '관리자';
  }

  function renderCollectorStatus(payload) {
    var wrap = $('dashboard-collector-status');
    var updatedEl = $('collector-status-updated');

    if (!wrap) return;

    var items = payload && Array.isArray(payload.items) ? payload.items : [];

    if (updatedEl) {
      updatedEl.textContent = payload && payload.generatedAt ? ('업데이트: ' + fmtDate(payload.generatedAt)) : '-';
    }

    if (!items.length) {
      wrap.innerHTML = '<div class="admin-empty">수집 상태 데이터가 없습니다.</div>';
      return;
    }

    wrap.innerHTML =
      '<div class="admin-table-wrap">' +
        '<table class="admin-table">' +
          '<thead><tr><th>대상</th><th>상태</th><th>최근 작업</th><th>최근 결과</th><th>마지막 성공</th><th>최근 오류</th><th>실행</th></tr></thead>' +
          '<tbody>' +
            items.map(function(item) {
              var status = monitorStatusLabel(item);
              var lastJob = item.lastJob
                ? '<strong>' + esc(item.lastJob) + '</strong>'
                  + '<div class="admin-table-sub">시작: ' + esc(fmtDate(item.lastStartedAt)) + '</div>'
                  + '<div class="admin-table-sub">종료: ' + esc(fmtDate(item.lastFinishedAt)) + ' · 소요 ' + esc(fmtDuration(item.lastDurationMs)) + '</div>'
                : '-';

              var lastError = item.lastErrorMessage
                ? '<div style="max-width:260px;word-break:break-word;">' + esc(item.lastErrorMessage) + '</div>'
                  + '<div class="admin-table-sub">' + esc(fmtDate(item.lastErrorAt)) + '</div>'
                : '-';

              var schedules = Array.isArray(item.schedules) && item.schedules.length
                ? item.schedules.join(', ')
                : '-';

              var isRunnable = item.kind === 'collector';
              var isLoading = !!state.collectorActionLoading[item.key];
              var disabled = !isRunnable || item.enabled === false || item.running || isLoading;
              var buttonLabel = isLoading ? '요청 중...' : (item.running ? '실행 중' : '수동 실행');
              var actionHtml = isRunnable
                ? '<button class="admin-primary-btn" data-run-collector="' + esc(item.key) + '" ' + (disabled ? 'disabled' : '') + '>' + esc(buttonLabel) + '</button>'
                : '-';

              return '<tr>' +
                '<td><strong>' + esc(item.label || item.key) + '</strong><div class="admin-table-sub">' + esc(item.key || '-') + ' · ' + esc(schedules) + '</div></td>' +
                '<td><span class="' + status.className + '">' + esc(status.text) + '</span></td>' +
                '<td>' + lastJob + '</td>' +
                '<td>' + esc(summarizeCollectorResult(item)) + '</td>' +
                '<td>' + esc(fmtDate(item.lastSuccessAt)) + '</td>' +
                '<td>' + lastError + '</td>' +
                '<td>' + actionHtml + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';

    wrap.querySelectorAll('button[data-run-collector]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        runCollectorAction(btn.getAttribute('data-run-collector'));
      });
    });
  }

  function renderCollectorRunLogs(list) {
    var wrap = $('dashboard-collector-logs');
    var updatedEl = $('collector-log-updated');

    if (!wrap) return;

    if (updatedEl) {
      updatedEl.textContent = list && list.length
        ? ('최신: ' + fmtDate(list[0].createdAt || list[0].updatedAt || list[0].finished_at || list[0].started_at))
        : '-';
    }

    if (!list || !list.length) {
      wrap.innerHTML = '<div class="admin-empty">최근 수집 실행 이력이 없습니다.</div>';
      return;
    }

    wrap.innerHTML =
      '<div class="admin-table-wrap">' +
        '<table class="admin-table">' +
          '<thead><tr><th>시각</th><th>대상</th><th>유형</th><th>상태</th><th>실행자</th><th>작업</th><th>결과/오류</th></tr></thead>' +
          '<tbody>' +
            list.map(function(log) {
              var status = collectorRunStatusMeta(log);
              var whenText = fmtDate(log.finished_at || log.started_at || log.createdAt);
              var jobText = '<strong>' + esc(log.job_name || '-') + '</strong>' +
                '<div class="admin-table-sub">소요 ' + esc(fmtDuration(log.duration_ms)) + '</div>';
              var resultText = summarizeCollectorLogResult(log);

              return '<tr>' +
                '<td>' + esc(whenText) + '</td>' +
                '<td><strong>' + esc(log.collector_label || log.collector_key || '-') + '</strong><div class="admin-table-sub">' + esc(log.collector_key || '-') + '</div></td>' +
                '<td>' + esc(collectorTriggerLabel(log.trigger_type)) + '</td>' +
                '<td><span class="' + status.className + '">' + esc(status.text) + '</span></td>' +
                '<td style="max-width:220px;word-break:break-word;">' + esc(collectorActorLabel(log)) + '</td>' +
                '<td>' + jobText + '</td>' +
                '<td style="max-width:320px;word-break:break-word;">' + esc(resultText) + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
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

      if ($('dashboard-collector-status')) {
        $('dashboard-collector-status').innerHTML = '<div class="admin-empty">불러오는 중...</div>';
      }
      if ($('dashboard-collector-logs')) {
        $('dashboard-collector-logs').innerHTML = '<div class="admin-empty">불러오는 중...</div>';
      }

      var resp = await PublicAPI.getAdminDashboard();
      state.dashboard = resp;

      renderDashboardSummary(resp.summary || {});
      renderCollectorStatus(resp.collectorStatus || {});
      renderCollectorRunLogs(resp.recentCollectorLogs || []);
      renderDashboardRecentUsers(resp.recentUsers || []);
      renderDashboardRecentInquiries(resp.recentInquiries || []);
    } catch (err) {
      $('dashboard-recent-users').innerHTML = '<div class="admin-empty">' + esc(err.message || '대시보드를 불러오지 못했습니다.') + '</div>';
      $('dashboard-recent-inquiries').innerHTML = '<div class="admin-empty">데이터를 불러오지 못했습니다.</div>';

      if ($('dashboard-collector-status')) {
        $('dashboard-collector-status').innerHTML = '<div class="admin-empty">수집 상태를 불러오지 못했습니다.</div>';
      }
      if ($('dashboard-collector-logs')) {
        $('dashboard-collector-logs').innerHTML = '<div class="admin-empty">실행 이력을 불러오지 못했습니다.</div>';
      }
      if ($('collector-status-updated')) {
        $('collector-status-updated').textContent = '-';
      }
      if ($('collector-log-updated')) {
        $('collector-log-updated').textContent = '-';
      }

      notifyError(err.message || '대시보드 조회 실패');
    }
  }

  /* ─────────────────────────────
     Collector logs
  ───────────────────────────── */
  function syncCollectorLogFilterInputs() {
    if ($('collector-log-key-filter')) $('collector-log-key-filter').value = state.collectorLogs.key;
    if ($('collector-log-status-filter')) $('collector-log-status-filter').value = state.collectorLogs.status;
    if ($('collector-log-trigger-filter')) $('collector-log-trigger-filter').value = state.collectorLogs.triggerType;
    if ($('collector-log-from')) $('collector-log-from').value = state.collectorLogs.from || '';
    if ($('collector-log-to')) $('collector-log-to').value = state.collectorLogs.to || '';
    if ($('collector-log-search')) $('collector-log-search').value = state.collectorLogs.q || '';
  }

  function readCollectorLogFiltersFromInputs() {
    state.collectorLogs.key = $('collector-log-key-filter') ? $('collector-log-key-filter').value : 'all';
    state.collectorLogs.status = $('collector-log-status-filter') ? $('collector-log-status-filter').value : 'all';
    state.collectorLogs.triggerType = $('collector-log-trigger-filter') ? $('collector-log-trigger-filter').value : 'all';
    state.collectorLogs.from = $('collector-log-from') ? $('collector-log-from').value.trim() : '';
    state.collectorLogs.to = $('collector-log-to') ? $('collector-log-to').value.trim() : '';
    state.collectorLogs.q = $('collector-log-search') ? $('collector-log-search').value.trim() : '';
  }

  function buildCollectorLogQuery() {
    var qs = new URLSearchParams();
    qs.set('page', state.collectorLogs.page);
    qs.set('limit', state.collectorLogs.limit);

    if (state.collectorLogs.key) qs.set('key', state.collectorLogs.key);
    if (state.collectorLogs.status) qs.set('status', state.collectorLogs.status);
    if (state.collectorLogs.triggerType) qs.set('trigger_type', state.collectorLogs.triggerType);
    if (state.collectorLogs.from) qs.set('from', state.collectorLogs.from);
    if (state.collectorLogs.to) qs.set('to', state.collectorLogs.to);
    if (state.collectorLogs.q) qs.set('q', state.collectorLogs.q);

    return qs.toString();
  }

  function renderCollectorLogSummary(summary, pagination) {
    summary = summary || {};
    pagination = pagination || { total: 0 };

    if ($('clog-total')) $('clog-total').textContent = (summary.total || 0).toLocaleString();
    if ($('clog-success')) $('clog-success').textContent = (summary.success || 0).toLocaleString();
    if ($('clog-error')) $('clog-error').textContent = (summary.error || 0).toLocaleString();
    if ($('clog-skipped')) $('clog-skipped').textContent = (summary.skipped || 0).toLocaleString();
    if ($('collector-log-total-text')) $('collector-log-total-text').textContent = '총 ' + ((pagination.total || 0).toLocaleString()) + '건';
  }

  function renderCollectorLogTable(items) {
    var tbody = $('collector-log-tbody');

    if (!tbody) return;

    if (!items || !items.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="admin-empty">조회된 실행 이력이 없습니다.</div></td></tr>';
      return;
    }

    tbody.innerHTML = items.map(function(item) {
      var selected = item.id === state.collectorLogs.selectedId ? ' selected' : '';
      var status = collectorRunStatusMeta(item);
      var resultText = summarizeCollectorLogResult(item);
      var whenText = fmtDate(item.finished_at || item.started_at || item.createdAt);

      return '<tr class="admin-table-row' + selected + '" data-id="' + item.id + '">' +
        '<td>' + item.id + '</td>' +
        '<td>' + esc(whenText) + '</td>' +
        '<td><strong>' + esc(item.collector_label || item.collector_key || '-') + '</strong><div class="admin-table-sub">' + esc(item.collector_key || '-') + '</div></td>' +
        '<td>' + esc(collectorTriggerLabel(item.trigger_type)) + '</td>' +
        '<td><span class="' + status.className + '">' + esc(status.text) + '</span></td>' +
        '<td style="max-width:220px;word-break:break-word;">' + esc(collectorActorLabel(item)) + '</td>' +
        '<td><strong>' + esc(item.job_name || '-') + '</strong><div class="admin-table-sub">소요 ' + esc(fmtDuration(item.duration_ms)) + '</div></td>' +
        '<td style="max-width:320px;word-break:break-word;">' + esc(resultText) + '</td>' +
      '</tr>';
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(function(row) {
      row.addEventListener('click', function() {
        state.collectorLogs.selectedId = Number(row.dataset.id);
        renderCollectorLogTable(state.collectorLogs.items);
        loadCollectorLogDetail(state.collectorLogs.selectedId);
      });
    });
  }

  function renderCollectorLogPagination(pagination) {
    var wrap = $('collector-log-pagination');
    if (!wrap) return;

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
        state.collectorLogs.page = Number(btn.dataset.page);
        loadCollectorLogs();
      });
    });
  }

  function renderCollectorLogDetail(item) {
    var panel = $('collector-log-detail');
    if (!panel) return;

    if (!item) {
      panel.innerHTML = '<div class="admin-empty">좌측 목록에서 실행 이력을 선택하세요.</div>';
      return;
    }

    var status = collectorRunStatusMeta(item);
    var resultText = summarizeCollectorLogResult(item);

    panel.innerHTML =
      '<div class="admin-detail-head">' +
        '<div>' +
          '<div class="admin-detail-id">실행 이력 #' + item.id + '</div>' +
          '<h3>' + esc(item.collector_label || item.collector_key || '-') + '</h3>' +
        '</div>' +
        '<span class="' + status.className + '">' + esc(status.text) + '</span>' +
      '</div>' +

      '<div class="admin-detail-grid">' +
        '<div><span>수집기 키</span><strong>' + esc(item.collector_key || '-') + '</strong></div>' +
        '<div><span>실행 유형</span><strong>' + esc(collectorTriggerLabel(item.trigger_type)) + '</strong></div>' +
        '<div><span>작업명</span><strong>' + esc(item.job_name || '-') + '</strong></div>' +
        '<div><span>종류</span><strong>' + esc(item.kind || '-') + '</strong></div>' +
        '<div><span>시작 시각</span><strong>' + esc(fmtDateSeconds(item.started_at || item.createdAt)) + '</strong></div>' +
        '<div><span>종료 시각</span><strong>' + esc(fmtDateSeconds(item.finished_at || item.updatedAt)) + '</strong></div>' +
        '<div><span>소요 시간</span><strong>' + esc(fmtDuration(item.duration_ms)) + '</strong></div>' +
        '<div><span>실행자</span><strong>' + esc(collectorActorLabel(item)) + '</strong></div>' +
      '</div>' +

      '<div class="admin-detail-block">' +
        '<span>결과 요약</span>' +
        '<div class="admin-detail-meta" style="margin-top:10px;">' + esc(resultText) + '</div>' +
      '</div>' +

      '<div class="admin-detail-block">' +
        '<span>오류 / 스킵 사유</span>' +
        '<div class="admin-detail-meta" style="margin-top:10px;">' +
          '오류: ' + esc(item.error_message || '-') + '<br>' +
          '건너뜀: ' + esc(item.skip_reason || '-') +
        '</div>' +
      '</div>' +

      '<div class="admin-detail-block">' +
        '<span>실행자 상세</span>' +
        '<div class="admin-detail-meta" style="margin-top:10px;">' +
          'user_id: ' + esc(item.actor_user_id || '-') + '<br>' +
          'name: ' + esc(item.actor_name || '-') + '<br>' +
          'email: ' + esc(item.actor_email || '-') + '<br>' +
          'role: ' + esc(item.actor_role || '-') +
        '</div>' +
      '</div>' +

      '<div class="admin-detail-block">' +
        '<span>결과 JSON</span>' +
        '<pre class="admin-detail-message" style="white-space:pre-wrap;">' + esc(prettyJson(item.result)) + '</pre>' +
      '</div>' +

      '<div class="admin-detail-block">' +
        '<span>request_payload JSON</span>' +
        '<pre class="admin-detail-message" style="white-space:pre-wrap;">' + esc(prettyJson(item.request_payload)) + '</pre>' +
      '</div>' +

      '<div class="admin-detail-block">' +
        '<span>metadata JSON</span>' +
        '<pre class="admin-detail-message" style="white-space:pre-wrap;">' + esc(prettyJson(item.metadata)) + '</pre>' +
      '</div>';
  }

  async function loadCollectorLogDetail(id) {
    if (!id) {
      renderCollectorLogDetail(null);
      return;
    }

    try {
      var resp = await adminRequest('GET', '/collectors/logs/' + encodeURIComponent(id));
      renderCollectorLogDetail(resp.item || null);
    } catch (err) {
      $('collector-log-detail').innerHTML = '<div class="admin-empty">' + esc(err.message || '실행 이력 상세를 불러오지 못했습니다.') + '</div>';
    }
  }

  async function loadCollectorLogs() {
    try {
      syncCollectorLogFilterInputs();

      if ($('collector-log-loading')) $('collector-log-loading').style.display = 'block';
      if ($('collector-log-empty-top')) $('collector-log-empty-top').textContent = '';

      var resp = await adminRequest('GET', '/collectors/logs?' + buildCollectorLogQuery());

      state.collectorLogs.items = resp.data || [];
      state.collectorLogs.pagination = resp.pagination || null;
      state.collectorLogs.summary = resp.summary || null;

      if (!state.collectorLogs.selectedId && state.collectorLogs.items.length) {
        state.collectorLogs.selectedId = state.collectorLogs.items[0].id;
      }

      if (
        state.collectorLogs.selectedId &&
        !state.collectorLogs.items.some(function(item) { return item.id === state.collectorLogs.selectedId; })
      ) {
        state.collectorLogs.selectedId = state.collectorLogs.items.length ? state.collectorLogs.items[0].id : null;
      }

      renderCollectorLogSummary(resp.summary || {}, resp.pagination || {});
      renderCollectorLogTable(state.collectorLogs.items);
      renderCollectorLogPagination(resp.pagination || {});
      if (state.collectorLogs.selectedId) {
        loadCollectorLogDetail(state.collectorLogs.selectedId);
      } else {
        renderCollectorLogDetail(null);
      }
    } catch (err) {
      $('collector-log-tbody').innerHTML = '<tr><td colspan="8"><div class="admin-empty">' + esc(err.message || '실행 이력을 불러오지 못했습니다.') + '</div></td></tr>';
      $('collector-log-detail').innerHTML = '<div class="admin-empty">수집기 실행 이력 API 연결 상태를 확인해주세요.</div>';
      notifyError(err.message || '수집 실행 이력 조회 실패');
    } finally {
      if ($('collector-log-loading')) $('collector-log-loading').style.display = 'none';
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

        notifySuccess(resp.message || '회원 정보가 저장되었습니다.');
      } catch (err) {
        notifyError(err.message || '회원 정보 저장 실패');
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
      notifyError(err.message || '회원 목록 조회 실패');
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
      notifyError(err.message || '문의 목록 조회 실패');
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
      $('vis-daily').innerHTML = '<div class="admin-empty">불러오는 중...</div>';
      $('vis-top-pages').innerHTML = '<div class="admin-empty">불러오는 중...</div>';
      $('vis-recent').innerHTML = '<div class="admin-empty">불러오는 중...</div>';

      var resp = await PublicAPI.getAdminVisitorStats(state.visitorDays);

      renderVisitorSummary(resp.summary || {});
      renderVisitorDaily(resp.daily || []);
      renderTopPages(resp.topPages || []);
      renderRecentVisits(resp.recent || []);
    } catch (err) {
      $('vis-daily').innerHTML = '<div class="admin-empty">' + esc(err.message || '방문 통계를 불러오지 못했습니다.') + '</div>';
      $('vis-top-pages').innerHTML = '<div class="admin-empty">데이터를 불러오지 못했습니다.</div>';
      $('vis-recent').innerHTML = '<div class="admin-empty">데이터를 불러오지 못했습니다.</div>';
      notifyError(err.message || '방문 통계 조회 실패');
    }
  }

  /* ─────────────────────────────
     Event bindings
  ───────────────────────────── */
  function bindMenuEvents() {
    document.querySelectorAll('.admin-menu-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showSection(btn.dataset.section);
      });
    });
  }

  function bindMemberEvents() {
    if ($('member-role-filter')) {
      $('member-role-filter').addEventListener('change', function() {
        state.users.role = this.value;
        state.users.page = 1;
        loadUsers();
      });
    }

    if ($('member-search-btn')) {
      $('member-search-btn').addEventListener('click', function() {
        state.users.q = $('member-search').value.trim();
        state.users.page = 1;
        loadUsers();
      });
    }

    if ($('member-search')) {
      $('member-search').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          state.users.q = $('member-search').value.trim();
          state.users.page = 1;
          loadUsers();
        }
      });
    }
  }

  function bindInquiryEvents() {
    if ($('inq-status-filter')) {
      $('inq-status-filter').addEventListener('change', function() {
        state.inquiries.status = this.value;
        state.inquiries.page = 1;
        loadInquiries();
      });
    }

    if ($('inq-search-btn')) {
      $('inq-search-btn').addEventListener('click', function() {
        state.inquiries.q = $('inq-search').value.trim();
        state.inquiries.page = 1;
        loadInquiries();
      });
    }

    if ($('inq-search')) {
      $('inq-search').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          state.inquiries.q = $('inq-search').value.trim();
          state.inquiries.page = 1;
          loadInquiries();
        }
      });
    }
  }

  function bindCollectorLogEvents() {
    if ($('collector-log-search-btn')) {
      $('collector-log-search-btn').addEventListener('click', function() {
        readCollectorLogFiltersFromInputs();
        state.collectorLogs.page = 1;
        loadCollectorLogs();
      });
    }

    if ($('collector-log-reset-btn')) {
      $('collector-log-reset-btn').addEventListener('click', function() {
        state.collectorLogs.page = 1;
        state.collectorLogs.key = 'all';
        state.collectorLogs.status = 'all';
        state.collectorLogs.triggerType = 'all';
        state.collectorLogs.from = '';
        state.collectorLogs.to = '';
        state.collectorLogs.q = '';
        syncCollectorLogFilterInputs();
        loadCollectorLogs();
      });
    }

    ['collector-log-key-filter', 'collector-log-status-filter', 'collector-log-trigger-filter'].forEach(function(id) {
      if ($(id)) {
        $(id).addEventListener('change', function() {
          readCollectorLogFiltersFromInputs();
          state.collectorLogs.page = 1;
          loadCollectorLogs();
        });
      }
    });

    ['collector-log-from', 'collector-log-to'].forEach(function(id) {
      if ($(id)) {
        $(id).addEventListener('change', function() {
          readCollectorLogFiltersFromInputs();
          state.collectorLogs.page = 1;
          loadCollectorLogs();
        });
      }
    });

    if ($('collector-log-search')) {
      $('collector-log-search').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          readCollectorLogFiltersFromInputs();
          state.collectorLogs.page = 1;
          loadCollectorLogs();
        }
      });
    }
  }

  function fillProfile(user) {
    if (!user) return;

    var nickname = user.nickname || user.name || '관리자';
    var email = user.email || '-';

    if ($('header-nickname')) $('header-nickname').textContent = nickname;
    if ($('admin-name')) $('admin-name').textContent = nickname;
    if ($('admin-email')) $('admin-email').textContent = email;
  }

  async function bootstrap() {
    try {
      if (typeof PublicAuth !== 'undefined' && PublicAuth && typeof PublicAuth.updateHeader === 'function') {
        PublicAuth.updateHeader();
      }

      var currentUser = null;

      if (typeof PublicAuth !== 'undefined' && PublicAuth && typeof PublicAuth.getUser === 'function') {
        currentUser = PublicAuth.getUser();
      }

      if (!currentUser) {
        window.location.href = '/';
        return;
      }

      if (currentUser.role !== 'admin') {
        notifyError('관리자만 접근할 수 있습니다.');
        window.location.href = '/';
        return;
      }

      state.me = currentUser;
      fillProfile(currentUser);

      bindMenuEvents();
      bindMemberEvents();
      bindInquiryEvents();
      bindCollectorLogEvents();

      showSection('dashboard');
    } catch (err) {
      notifyError(err.message || '관리자 페이지 초기화에 실패했습니다.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
