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
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(API_BASE + path, opts);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '요청 실패');
    return data;
  }

  async function getNotices(params) {
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

  async function getStats() {
    return request('GET', '/notices/stats');
  }

  async function getNoticesByMonth(year, month) {
    return request('GET', '/notices/calendar/' + year + '/' + month);
  }

  async function getNotice(id) {
    return request('GET', '/notices/' + id);
  }

  return {
    API_BASE,
    request,
    getNotices,
    getStats,
    getNoticesByMonth,
    getNotice
  };
})();
