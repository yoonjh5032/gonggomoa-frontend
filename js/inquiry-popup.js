(function() {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function() {
    var openBtn = document.getElementById('inquiry-float-btn');
    var modal = document.getElementById('inquiry-modal');
    var closeBackdrop = document.getElementById('inquiry-modal-close');
    var closeBtn = document.getElementById('inquiry-close-btn');
    var cancelBtn = document.getElementById('inquiry-cancel-btn');
    var form = document.getElementById('inquiry-form');

    if (!openBtn || !modal) return;

    function showMessage(type, msg) {
      if (typeof Feedback !== 'undefined' && Feedback[type]) {
        Feedback[type](msg);
      } else {
        alert(msg);
      }
    }

    function fillLoggedInUser() {
      try {
        var raw = localStorage.getItem('gm_user');
        if (!raw || !form) return;
        var user = JSON.parse(raw);
        var nameInput = form.querySelector('input[name="name"]');
        var emailInput = form.querySelector('input[name="email"]');
        var phoneInput = form.querySelector('input[name="phone"]');

        if (nameInput && !nameInput.value) nameInput.value = user.nickname || '';
        if (emailInput && !emailInput.value) emailInput.value = user.email || '';
        if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
      } catch (e) {}
    }

    function openModal() {
      fillLoggedInUser();
      modal.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }

    openBtn.addEventListener('click', openModal);
    if (closeBackdrop) closeBackdrop.addEventListener('click', closeModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.style.display !== 'none') {
        closeModal();
      }
    });

    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();

        var category = (form.querySelector('[name="category"]') || {}).value || '';
        var name = (form.querySelector('[name="name"]') || {}).value || '';
        var email = (form.querySelector('[name="email"]') || {}).value || '';
        var title = (form.querySelector('[name="title"]') || {}).value || '';
        var message = (form.querySelector('[name="message"]') || {}).value || '';
        var agree = (form.querySelector('[name="agree"]') || {}).checked;

        if (!name.trim() || !email.trim() || !title.trim() || !message.trim()) {
          showMessage('error', '이름, 이메일, 제목, 문의 내용을 입력해주세요.');
          return;
        }

        if (!agree) {
          showMessage('info', '개인정보 수집 및 이용 동의가 필요합니다.');
          return;
        }

        console.log('[문의 임시 저장]', {
          category: category,
          name: name.trim(),
          email: email.trim(),
          title: title.trim(),
          message: message.trim()
        });

        showMessage('success', '문의 팝업 UI 연결 완료. 다음 단계에서 API와 연결하면 실제 접수됩니다.');
        form.reset();
        fillLoggedInUser();
        closeModal();
      });
    }
  });
})();
