/* ═══════════════════════════════════════════════════════════
   js/public-auth.js — 인증(로그인/회원가입/로그아웃) 모듈
═══════════════════════════════════════════════════════════ */
const PublicAuth = (function() {
  'use strict';

  const TOKEN_KEY = 'gm_token';
  const USER_KEY  = 'gm_user';
  const ADMIN_EMAIL = 'yacoomo@kakao.com';
  const ADMIN_PAGE_HREF = '/admin.html';

  /* ── 토큰 관리 ── */
  function getToken()  { return localStorage.getItem(TOKEN_KEY) || ''; }
  function getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch(e) { return null; } }
  function isLoggedIn(){ return !!getToken(); }

  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function isAdminUser(user) {
    if (!user) return false;
    var email = String(user.email || '').trim().toLowerCase();
    return user.role === 'admin' || email === ADMIN_EMAIL;
  }

  function ensureAdminLink(user) {
    var nav = document.querySelector('.pub-nav');
    if (!nav) return;

    var adminLink = document.getElementById('header-admin-link');

    if (!isAdminUser(user)) {
      if (adminLink) adminLink.style.display = 'none';
      return;
    }

    if (!adminLink) {
      adminLink = document.createElement('a');
      adminLink.id = 'header-admin-link';
      adminLink.className = 'pub-nav-link';
      adminLink.href = ADMIN_PAGE_HREF;
      adminLink.innerHTML = '<i class="fas fa-shield-halved"></i> 관리자 페이지';
      nav.appendChild(adminLink);
    }

    adminLink.href = ADMIN_PAGE_HREF;
    adminLink.style.display = 'inline-flex';

    var path = window.location.pathname || '';
    if (path.endsWith('/public/admin.html') || path.endsWith('/admin.html')) {
      adminLink.classList.add('nav-active');
    } else {
      adminLink.classList.remove('nav-active');
    }
  }

  /* ── 회원가입 ── */
  async function register(data) {
    const resp = await PublicAPI.request('POST', '/auth/register', data);
    saveSession(resp.token, resp.user);
    return resp;
  }

  /* ── 로그인 ── */
  async function login(email, password) {
    const resp = await PublicAPI.request('POST', '/auth/login', { email, password });
    saveSession(resp.token, resp.user);
    return resp;
  }

  /* ── 로그아웃 ── */
  function logout() {
    clearSession();
    window.location.href = '/';
  }

  /* ── 내 정보 ── */
  async function getMe() {
    return PublicAPI.request('GET', '/auth/me');
  }

  async function updateMe(data) {
    const resp = await PublicAPI.request('PUT', '/auth/me', data);
    if (resp.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(resp.user));
    }
    return resp;
  }

  async function changePassword(currentPassword, newPassword) {
    return PublicAPI.request('PUT', '/auth/password', { currentPassword, newPassword });
  }

  /* ── 즐겨찾기 ── */
  async function toggleBookmark(noticeId) {
    return PublicAPI.request('POST', '/auth/bookmark/' + noticeId);
  }

  /* ── 헤더 UI 업데이트 ── */
  function updateHeader() {
    var guestGroup = document.getElementById('header-guest-group');
    var userGroup  = document.getElementById('header-user-group');
    var nicknameEl = document.getElementById('header-nickname');

    if (isLoggedIn()) {
      var user = getUser();

      if (guestGroup) guestGroup.style.display = 'none';
      if (userGroup)  userGroup.style.display  = 'flex';
      if (nicknameEl && user) nicknameEl.textContent = user.nickname || '사용자';

      ensureAdminLink(user);
    } else {
      if (guestGroup) guestGroup.style.display = 'flex';
      if (userGroup)  userGroup.style.display  = 'none';

      var adminLink = document.getElementById('header-admin-link');
      if (adminLink) adminLink.style.display = 'none';
    }
  }

  return {
    getToken, getUser, isLoggedIn,
    register, login, logout,
    getMe, updateMe, changePassword,
    toggleBookmark,
    updateHeader
  };
})();
window.PublicAuth = PublicAuth;
