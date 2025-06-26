(() => {
  // ページ読み込み時に値を復元し、変更があれば保存
  document.addEventListener('DOMContentLoaded', () => {
    const ctrls = document.querySelectorAll('.savecontrol');
    ctrls.forEach(ctrl => {
      const key = `save_${ctrl.id}`;
      let stored = localStorage.getItem(key);

      // 保存済みの値をコントロールに反映
      const restore = () => {
        if (stored !== null) {
          if (ctrl.type === 'checkbox') {
            ctrl.checked = stored === 'true';
          } else if (ctrl.tagName.toLowerCase() === 'select') {
            const exists = Array.from(ctrl.options).some(opt => opt.value === stored);
            if (exists) {
              ctrl.value = stored;
            }
          } else {
            ctrl.value = stored;
          }
        }
      };

      restore();

      // select要素は後からoptionが追加されることがある
      if (ctrl.tagName.toLowerCase() === 'select') {
        const observer = new MutationObserver(() => {
          restore();
          if (ctrl.value === stored) {
            observer.disconnect();
          }
        });
        observer.observe(ctrl, { childList: true });
      }

      // 値が変化したら保存
      const save = () => {
        const value = ctrl.type === 'checkbox' ? ctrl.checked : ctrl.value;
        stored = value.toString();
        localStorage.setItem(key, stored);
      };
      ctrl.addEventListener('change', save);
      ctrl.addEventListener('input', save);
    });
  });
})();