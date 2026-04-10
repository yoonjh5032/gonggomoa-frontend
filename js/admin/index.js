import { createDashboardTab } from './tabs/dashboard-tab.js';
import { createUsersTab } from './tabs/users-tab.js';
import { createInquiriesTab } from './tabs/inquiries-tab.js';
import { createLogsTab } from './tabs/logs-tab.js';

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function getApiBase() {
  if (window.PublicAPI && window.PublicAPI.API_BASE) {
    return String(window.PublicAPI.API_BASE).replace(/\/$/, '');
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
  const headers = { 'Content-Type': 'application/json' };
  const token = getAdminToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBase()}/admin${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || '관리자 API 요청에 실패했습니다.');
  }

  return data;
}

const api = {
  async getAdminDashboard() {
    if (window.PublicAPI?.getAdminDashboard) {
      return window.PublicAPI.getAdminDashboard();
    }
    return adminRequest('GET', '/dashboard');
  },

  async getAdminUsers(params = {}) {
    if (window.PublicAPI?.getAdminUsers) {
      return window.PublicAPI.getAdminUsers(params);
    }
    const qs = new URLSearchParams(params).toString();
    return adminRequest('GET', `/users${qs ? `?${qs}` : ''}`);
  },

  async getAdminUserDetail(id) {
    return adminRequest('GET', `/users/${id}`);
  },

  async updateAdminUser(id, payload) {
    return adminRequest('PATCH', `/users/${id}`, payload);
  },

  async getAdminInquiries(params = {}) {
    if (window.PublicAPI?.getAdminInquiries) {
      return window.PublicAPI.getAdminInquiries(params);
    }
    const qs = new URLSearchParams(params).toString();
    return adminRequest('GET', `/inquiries${qs ? `?${qs}` : ''}`);
  },

  async getAdminInquiryDetail(id) {
    return adminRequest('GET', `/inquiries/${id}`);
  },

  async updateAdminInquiry(id, payload) {
    return adminRequest('PATCH', `/inquiries/${id}`, payload);
  },

  async getAdminCollectorLogs(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return adminRequest('GET', `/collectors/logs${qs ? `?${qs}` : ''}`);
  },

  async getAdminCollectorLogDetail(id) {
    return adminRequest('GET', `/collectors/logs/${id}`);
  }
};

const feedback = {
  success(message) {
    if (window.Feedback?.success) return window.Feedback.success(message);
    alert(message || '처리되었습니다.');
  },
  error(message) {
    if (window.Feedback?.error) return window.Feedback.error(message);
    alert(message || '오류가 발생했습니다.');
  }
};

const shellState = {
  currentTab: 'dashboard',
  mounted: new Set()
};

const pageMeta = {
  dashboard: {
    title: '대시보드',
    desc: '회원, 문의, 수집 현황을 한 화면에서 확인합니다.'
  },
  users: {
    title: '회원',
    desc: '회원 목록과 상세 정보를 조회하고 관리합니다.'
  },
  inquiries: {
    title: '문의',
    desc: '문의 내역을 확인하고 처리 상태를 관리합니다.'
  },
  logs: {
    title: '수집로그',
    desc: '수집 실행 이력과 상세 로그를 확인합니다.'
  }
};

const tabs = {
  dashboard: createDashboardTab({ api, feedback }),
  users: createUsersTab({ api, feedback }),
  inquiries: createInquiriesTab({ api, feedback }),
  logs: createLogsTab({ api, feedback })
};

function setPageMeta(tabKey) {
  const meta = pageMeta[tabKey];
  if (!meta) return;

  $('#admin-page-title').textContent = meta.title;
  $('#admin-page-desc').textContent = meta.desc;
}

function setActiveNav(tabKey) {
  $all('[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabKey);
  });
}

function setActivePanel(tabKey) {
  $all('[data-tab-panel]').forEach((panel) => {
    const active = panel.dataset.tabPanel === tabKey;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
}

async function ensureMounted(tabKey) {
  if (shellState.mounted.has(tabKey)) return;

  const panel = document.querySelector(`[data-tab-panel="${tabKey}"]`);
  if (!panel) {
    throw new Error(`탭 패널을 찾을 수 없습니다: ${tabKey}`);
  }

  await tabs[tabKey].mount(panel);
  shellState.mounted.add(tabKey);
}

async function switchTab(tabKey) {
  if (!tabs[tabKey]) return;

  shellState.currentTab = tabKey;
  setPageMeta(tabKey);
  setActiveNav(tabKey);
  setActivePanel(tabKey);

  await ensureMounted(tabKey);

  if (typeof tabs[tabKey].activate === 'function') {
    await tabs[tabKey].activate();
  }
}

function bindShellEvents() {
  $('#admin-tab-nav').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-tab]');
    if (!button) return;

    await switchTab(button.dataset.tab);
  });

  $('#admin-refresh-btn').addEventListener('click', async () => {
    const tab = tabs[shellState.currentTab];
    if (!tab) return;

    if (typeof tab.refresh === 'function') {
      await tab.refresh();
    }
  });
}

async function boot() {
  try {
    if (window.PublicAuth?.updateHeader) {
      window.PublicAuth.updateHeader();
    }

    bindShellEvents();
    await switchTab('dashboard');
  } catch (err) {
    console.error('[ADMIN_BOOT]', err);
    feedback.error(err.message || '관리자 페이지 초기화에 실패했습니다.');
  }
}

document.addEventListener('DOMContentLoaded', boot);
