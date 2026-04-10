/* ═══════════════════════════════════════════════════════════
   js/feedback.js — 토스트 알림 / 확인 모달 유틸
═══════════════════════════════════════════════════════════ */
const Feedback = (function() {
  'use strict';

  function getContainer() {
    var el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.style.cssText = 'position:fixed;top:80px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
      document.body.appendChild(el);
    }
    return el;
  }

  function toast(msg, type, options) {
    type = type || 'info';
    options = options || {};

    var colors = {
      success: { bg:'#d1fae5', border:'#34d399', color:'#065f46', icon:'fa-check-circle' },
      error:   { bg:'#fef2f2', border:'#fca5a5', color:'#991b1b', icon:'fa-exclamation-circle' },
      info:    { bg:'#dbeafe', border:'#93c5fd', color:'#1e40af', icon:'fa-info-circle' },
      warning: { bg:'#fef3c7', border:'#fcd34d', color:'#92400e', icon:'fa-exclamation-triangle' }
    };

    var c = colors[type] || colors.info;
    var el = document.createElement('div');
    var duration = Math.max(options.duration || (type === 'error' ? 5000 : 3200), 1500);

    el.style.cssText = 'pointer-events:auto;padding:12px 18px;border-radius:10px;font-size:.85rem;font-weight:500;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.1);display:flex;align-items:flex-start;gap:8px;animation:slideIn .3s ease;' +
      'background:' + c.bg + ';border:1px solid ' + c.border + ';color:' + c.color + ';max-width:420px;line-height:1.5;';
    el.innerHTML = '<i class="fas ' + c.icon + '" style="margin-top:2px"></i><span>' + msg + '</span>';
    getContainer().appendChild(el);

    setTimeout(function() {
      el.style.animation = 'slideOut .3s ease forwards';
      setTimeout(function() { el.remove(); }, 300);
    }, duration);
  }

  var style = document.createElement('style');
  style.textContent =
    '@keyframes slideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}' +
    '@keyframes slideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(40px)}}';
  document.head.appendChild(style);

  return {
    toast: toast,
    success: function(m, o){ toast(m, 'success', o); },
    error: function(m, o){ toast(m, 'error', o); },
    info: function(m, o){ toast(m, 'info', o); },
    warning: function(m, o){ toast(m, 'warning', o); }
  };
})();
window.Feedback = Feedback;
