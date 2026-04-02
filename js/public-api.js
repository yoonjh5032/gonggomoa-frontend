/* ═══════════════════════════════════════════════════════════
   js/public-api.js — 백엔드 API 통신 모듈
═══════════════════════════════════════════════════════════ */
const PublicAPI = (function() {
  'use strict';

  const API_BASE = 'https://port-0-gonggomoa-backend-mncmjkuka041c0e9.sel3.cloudtype.app/api';

  function getToken() {
    return localStorage.getItem('gm_token') || '';
  }

  async function request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body !== undefined) opts.body = JSON.stringify(body);

    const resp = await fetch(API_BASE + path, opts);
    const data = await resp.json().catch(function() { return {}; });

    if (!resp.ok) {
      throw new Error(data.error || '요청 실패');
    }

    return data;
  }

  /* ── 공고 목록 조회 ── */
  async function getNotices(params) {
    params = params || {};
    const qs = new URLSearchParams();

    if (params.q) qs.set('q', params.q);
    if (params.source) qs.set('source', params.source);
    if (params.type) qs.set('type', params.type);
    if (params.sortBy) qs.set('sortBy', params.sortBy);
    if (params.daysLeft) qs.set('daysLeft', params.daysLeft);
    if (params.deadline) qs.set('deadline', params.deadline);
    if (params.limit) qs.set('limit', params.limit);
    if (params.page) qs.set('page', params.page);

    return request('GET', '/notices?' + qs.toString());
  }

  /* ── 통계 ── */
  async function getStats() {
    return request('GET', '/notices/stats');
  }

  /* ── 캘린더 ── */
  async function getNoticesByMonth(year, month) {
    return request('GET', '/notices/calendar/' + year + '/' + month);
  }

  /* ── 공고 상세 ── */
  async function getNotice(id) {
    return request('GET', '/notices/' + id);
  }

  /* ── 문의 접수 ── */
  async function createInquiry(data) {
    return request('POST', '/inquiries', data);
  }

  /* ── 관리자 문의 목록 ── */
  async function getAdminInquiries(params) {
    params = params || {};
    const qs = new URLSearchParams();

    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);

    return request('GET', '/admin/inquiries?' + qs.toString());
  }

  /* ── 관리자 대시보드 ── */
  async function getAdminDashboard() {
    return request('GET', '/admin/dashboard');
  }

  /* ── 관리자 회원 목록 ── */
  async function getAdminUsers(params) {
    params = params || {};
    const qs = new URLSearchParams();

    if (params.page) qs.set('page', params.page);
    if (params.limit) qs.set('limit', params.limit);
    if (params.role) qs.set('role', params.role);
    if (params.q) qs.set('q', params.q);

    return request('GET', '/admin/users?' + qs.toString());
  }

  /* ── 관리자 회원 상세 ── */
  async function getAdminUser(id) {
    return request('GET', '/admin/users/' + encodeURIComponent(id));
  }

  /* ── 관리자 회원 수정 ── */
  async function updateAdminUser(id, data) {
    return request('PATCH', '/admin/users/' + encodeURIComponent(id), data);
  }

  /* ── 페이지뷰 수집 ── */
  async function trackPageView(data) {
    return request('POST', '/analytics/pageview', data);
  }

  /* ── 관리자 방문자 통계 ── */
  async function getAdminVisitorStats(days) {
    const qs = new URLSearchParams();
    if (days) qs.set('days', days);
    return request('GET', '/analytics/visitor-stats' + (qs.toString() ? '?' + qs.toString() : ''));
  }

  return {
    API_BASE,
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
