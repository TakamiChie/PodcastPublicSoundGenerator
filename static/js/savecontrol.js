document.addEventListener('DOMContentLoaded', () => {
  const ctrls = document.querySelectorAll('.savecontrol');
  ctrls.forEach(ctrl => {
    const key = `save_${ctrl.id}`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      if (ctrl.type === 'checkbox') {
        ctrl.checked = stored === 'true';
      } else {
        ctrl.value = stored;
      }
    }
    const save = () => {
      const value = ctrl.type === 'checkbox' ? ctrl.checked : ctrl.value;
      localStorage.setItem(key, value);
    };
    ctrl.addEventListener('change', save);
    ctrl.addEventListener('input', save);
  });
});
