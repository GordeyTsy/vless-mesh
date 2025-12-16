document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const requestForm = document.getElementById('request-form');
  const loginStatus = document.getElementById('login-status');
  const requestStatus = document.getElementById('request-status');
  const requestListEl = document.getElementById('request-list');
  const adminTokenInput = document.getElementById('admin-token');
  const adminBlock = document.getElementById('admin-block');
  const adminMode = new URLSearchParams(window.location.search).get('admin') === '1';
  // By default talk to same-origin (nginx proxies /api to backend); override with window.API_BASE if needed.
  const API_BASE = window.API_BASE || window.location.origin;
  const dashboard = document.getElementById('dashboard');
  const devicesBody = document.getElementById('devices-body');
  const devicesStatus = document.getElementById('devices-status');
  const refreshDevicesBtn = document.getElementById('refresh-devices');

  const loadRequests = () => {
    try {
      return JSON.parse(localStorage.getItem('meshRequests') || '[]');
    } catch {
      return [];
    }
  };

  const saveRequests = (reqs) => {
    localStorage.setItem('meshRequests', JSON.stringify(reqs));
  };

  const renderRequests = () => {
    if (!requestListEl) return;
    const reqs = loadRequests();
    if (!reqs.length) {
      requestListEl.innerHTML = '<p class="muted">Заявок пока нет.</p>';
      return;
    }
    requestListEl.innerHTML = '';
    reqs.forEach((r, idx) => {
      const item = document.createElement('div');
      item.className = 'request-item';
      item.innerHTML = `
        <div>
          <div class="req-email">${r.email}</div>
          <div class="req-meta">${r.comment || 'Без комментария'}</div>
          ${r.access_key ? `<div class="req-meta">Токен: <code>${r.access_key}</code></div>` : ''}
          <div class="req-meta">Отправлено: ${new Date(r.created).toLocaleString()}</div>
        </div>
        <div class="req-actions">
          <span class="chip ${r.status}">${r.status}</span>
          ${adminMode ? `
            <button class="ghost" data-action="approve" data-idx="${idx}">Одобрить</button>
            <button class="ghost danger" data-action="decline" data-idx="${idx}">Отклонить</button>
          ` : ''}
        </div>
      `;
      requestListEl.appendChild(item);
    });
  };

  const fetchJson = async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const syncRequestsFromApi = async () => {
    if (!adminMode) return;
    try {
      const token = adminTokenInput?.value?.trim();
      const data = await fetchJson('/api/requests/list', {
        headers: token ? { 'X-Mesh-Admin-Token': token } : {},
      });
      saveRequests(data.requests || []);
      renderRequests();
    } catch (err) {
      console.warn('requests sync failed', err);
    }
  };

  requestListEl?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = Number(btn.dataset.idx);
    const reqs = loadRequests();
    const target = reqs[idx];
    if (!target) return;
    try {
      const token = adminTokenInput?.value?.trim();
      await fetchJson(`/api/requests/${target.id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Mesh-Admin-Token': token } : {}),
        },
      });
      await syncRequestsFromApi();
    } catch (err) {
      console.warn('action failed', err);
    }
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const email = formData.get('email');
    const password = formData.get('password');
    loginStatus.textContent = `Проверка доступа для ${email}…`;
    try {
      await fetchJson('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      loginStatus.textContent = 'Успешно: доступ разрешён';
    } catch (err) {
      loginStatus.textContent = 'Нет доступа или неверный токен';
    }
  });

  requestForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(requestForm);
    const email = (formData.get('email') || '').toString().trim();
    const comment = (formData.get('comment') || '').toString().trim();
    try {
      const res = await fetchJson('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, comment }),
      });
      requestStatus.textContent = 'Заявка отправлена. Админ подтвердит в UI.';
      const reqs = loadRequests();
      reqs.push({
        id: res.id,
        email,
        comment,
        status: res.status,
        created: res.created,
      });
      saveRequests(reqs);
      renderRequests();
      requestForm.reset();
    } catch (err) {
      requestStatus.textContent = 'Не удалось отправить заявку';
    }
  });

  if (adminMode && adminBlock) {
    adminBlock.hidden = false;
    syncRequestsFromApi();
  }
  renderRequests();

  async function loadDevices() {
    if (!dashboard) return;
    devicesStatus.textContent = 'Загружаю список...';
    try {
      const data = await fetchJson('/api/nodes');
      const nodes = (data && data.nodes) || [];
      if (!nodes.length) {
        devicesBody.innerHTML = '<tr><td colspan="3" class="muted">Нет данных</td></tr>';
      } else {
        devicesBody.innerHTML = '';
        nodes.forEach((n) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${n.label || n.id || '-'}</td>
            <td>${n.role || '-'}</td>
            <td><span class="chip approved">online</span></td>
          `;
          devicesBody.appendChild(tr);
        });
      }
      dashboard.hidden = false;
      devicesStatus.textContent = '';
    } catch (err) {
      devicesStatus.textContent = 'Ошибка загрузки списка устройств';
    }
  }

  refreshDevicesBtn?.addEventListener('click', loadDevices);

  loginForm?.addEventListener('submit', async (e) => {
    // let existing handler run, then try load devices after a short delay if success
    setTimeout(() => {
      if (loginStatus.textContent && loginStatus.textContent.includes('Успешно')) {
        loadDevices();
      }
    }, 300);
  });
});
