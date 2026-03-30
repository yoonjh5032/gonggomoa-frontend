(function() {
  'use strict';

  if (typeof PublicAPI === 'undefined' || !PublicAPI.trackPageView) return;

  var KEY = 'gm_session_id';
  var sessionId = localStorage.getItem(KEY);

  if (!sessionId) {
    sessionId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(KEY, sessionId);
  }

  var pageKey = 'pv_once_' + window.location.pathname + window.location.search;

  if (sessionStorage.getItem(pageKey)) return;
  sessionStorage.setItem(pageKey, '1');

  PublicAPI.trackPageView({
    path: window.location.pathname + window.location.search,
    title: document.title || '',
    referrer: document.referrer || '',
    sessionId: sessionId
  }).catch(function() {});
})();
