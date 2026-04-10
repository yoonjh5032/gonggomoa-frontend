/* ═══════════════════════════════════════════════════════════
   js/public-api.js — 백엔드 API 통신 모듈
════════════════════════════════════════════════════════════ */
const PublicAPI = (function() {
  'use strict';

  const API_BASE = String(window.__PUBLIC_API_BASE__ || '/api').replace(/\/$/, '');
  const API_TIMEOUT_MS = Math.max(parseInt(window.__PUBLIC_API_TIMEOUT_MS__, 10) || 15000, 3000);

  function getToken() {
    return localStorage.getItem('gm_token') || '';
  }

  function buildError(message, meta) {
    const err = new Error(message || '요청 처리 중 오류가 발생했습니다.');
    err.name = 'PublicApiError';
    Object.assign(err, meta || {});
    return err;
  }

  function readJsonSafely(resp) {
    return resp.json().catch(function() { return {}; });
  }

  function classifyHttpError(resp, data, preview) {
    const baseMessage = data.error || data.message || '';

    if (resp.status === 400) {
      return buildError(baseMessage || '요청 값이 올바르지 않습니다. 입력 조건을 다시 확인해주세요.', {
        status: resp.status,
        retryable: false,
        code: 'bad_request'
      });
    }

    if (resp.status === 401) {
      return buildError('로그인이 필요합니다. 다시 로그인 후 시도해주세요.', {
        status: resp.status,
        retryable: false,
        code: 'unauthorized'
      });
    }

    if (resp.status === 403) {
      return buildError('접근 권한이 없습니다. 관리자 권한 또는 로그인 상태를 확인해주세요.', {
        status: resp.status,
        retryable: false,
        code: 'forbidden'
      });
    }

    if (resp.status === 404) {
      return buildError(baseMessage || '요청한 데이터를 찾을 수 없습니다.', {
        status: resp.status,
        retryable: false,
        code: 'not_found'
      });
    }

    if (resp.status === 429) {
      return buildError('요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.', {
        status: resp.status,
        retryable: true,
        code: 'rate_limited'
      });
    }

    if (resp.status >= 500) {
      return buildError(baseMessage || '서버가 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해주세요.', {
        status: resp.status,
        retryable: true,
        code: 'server_error'
      });
    }

    return buildError(baseMessage || '요청 처리에 실패했습니다.', {
      status: resp.status,
      retryable: resp.status >= 500,
      code: 'request_failed',
      preview: preview || ''
    });
  }

  async function request(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const token = getToken();
    if (token) {
      opts.headers.Authorization = 'Bearer ' + token;
    }

    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }

    let controller = null;
    let timeoutId = null;

    if (typeof AbortController !== 'undefined') {
      controller = new AbortController();
      opts.signal = controller.signal;
      timeoutId = setTimeout(function() {
        controller.abort();
      }, API_TIMEOUT_MS);
    }

    let resp;
    try {
      resp = await fetch(API_BASE + path, opts);
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      if (err && err.name === 'AbortError') {
        throw buildError('응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.', {
          status: 0,
          retryable: true,
          code: 'timeout'
        });
      }

      throw buildError('네트워크 연결을 확인한 뒤 다시 시도해주세요.', {
        status: 0,
        retryable: true,
        code: 'network_error',
        cause: err
      });
    }

    if (timeoutId) clearTimeout(timeoutId);

    const contentType = String(resp.headers.get('content-type') || '');

    if (!contentType.includes('application/json')) {
      const rawText = await resp.text().catch(function() { return ''; });
      const preview = rawText ? rawText.slice(0, 160) : '';

      throw buildError(
        'API 응답 형식이 올바르지 않습니다. 프록시 또는 서버 설정을 확인해주세요.'
        + (preview ? ' (' + preview.replace(/\s+/g, ' ').trim() + ')' : ''),
        {
          status: resp.status,
          retryable: resp.status >= 500,
          code: 'invalid_content_type',
          preview: preview
        }
      );
    }

    const data = await readJsonSafely(resp);

    if (!resp.ok) {
      throw classifyHttpError(resp, data, '');
    }

    return data;
  }

  async function getNotices(params) {
    params = params || {};
    const qs = new URLSearchParams();

    if (params.q) qs.set('q', params.q);
    if (params.source) qs.set('source', params.source);
    if (params.type) qs.set('type', params.type);
    if (params.sortBy) qs.set('sortBy', params.sortBy);
    if (params.daysLeft) qs.set('daysLeft', params.daysLeft);
    if (params.deadline) qs.set('deadline', params.deadline);

    if (params.keywords) {
      const keywordList = Array.isArray(params.keywords)
        ? params.keywords
        : String(params.keywords).split(',');

      const cleaned = keywordList
        .map(function(v) { return String(v || '').trim(); })
        .filter(Boolean);

      if (cleaned.length) {
        qs.set('keywords', cleaned.join(','));
      }
    }

    if (params.limit) qs.set('limit', params.limit);
    if (params.page) qs.set('page', params.page);

    return request('GET', '/notices?' + qs.toString());
  }

  async function getStats() {
    return request('GET', '/notices/stats');
  }

  async function getNoticesByMonth(year, month) {
    return request('GET', '/notices/calendar/' + year + '/' + month);
  }

  async function getNotice(id) {
    return request('GET', '/notices/' + encodeURIComponent(id));
  }

  async function createInquiry(data) {
    return request('POST', '/inquiries', data);
  }

  async function getAdminInquiries(params) {
    params = params || {};
    const qs = new URLSearchParams();

    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);

    return request('GET', '/admin/inquiries?' + qs.toString());
  }

  async function getAdminDashboard() {
    return request('GET', '/admin/dashboard');
  }

  async function getAdminUsers(params) {
    params = params || {};
    const qs = new URLSearchParams();

    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.role) qs.set('role', params.role);
    if (params.q) qs.set('q', params.q);

    return request('GET', '/admin/users?' + qs.toString());
  }

  async function getAdminUser(id) {
    return request('GET', '/admin/users/' + encodeURIComponent(id));
  }

  async function updateAdminUser(id, data) {
    return request('PATCH', '/admin/users/' + encodeURIComponent(id), data);
  }

  async function trackPageView(data) {
    return request('POST', '/analytics/pageview', data);
  }

  async function getAdminVisitorStats(days) {
    const qs = new URLSearchParams();
    if (days) qs.set('days', days);

    return request(
      'GET',
      '/analytics/visitor-stats' + (qs.toString() ? '?' + qs.toString() : '')
    );
  }

  return {
    API_BASE,
    API_TIMEOUT_MS,
    request,
    getNotices,
    getStats,
    getNoticesByMonth,
    getNotice,
    createInquiry,
    getAdminInquiries,
    getAdminDashboard,
    getAdminUsers,
    getAdminUser,
    updateAdminUser,
    trackPageView,
    getAdminVisitorStats
  };
})();

window.PublicAPI = PublicAPI;
