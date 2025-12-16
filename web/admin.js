document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.API_BASE || window.location.origin;
  const tokenInput = document.getElementById('admin-token-requests');
  const loadBtn = document.getElementById('load-requests');
  const tbody = document.getElementById('admin-requests-body');
  const statusEl = document.getElementById('admin-requests-status');

  const fetchJson = async (path, opts = {}) => {
    const res = await fetch(`${API_BASE}${path}`, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const renderRows = (requests) => {
    if (!tbody) return;
    if (!requests.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="muted">Заявок нет</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    requests.forEach((r) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.email}</td>
        <td>${r.comment || ''}</td>
        <td><span class="chip ${r.status}">${r.status}</span></td>
        <td>${r.access_key || ''}</td>
        <td class="actions">
          <button class="ghost" data-action="approve" data-id="${r.id}">Одобрить</button>
          <button class="ghost danger" data-action="decline" data-id="${r.id}">Отклонить</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const loadRequests = async () => {
    if (!loadBtn) return;
    const token = tokenInput?.value?.trim();
    statusEl.textContent = 'Загружаю...';
    try {
      const data = await fetchJson('/api/requests/list', {
        headers: token ? { 'X-Mesh-Admin-Token': token } : {},
      });
      renderRows(data.requests || []);
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = 'Ошибка загрузки заявок';
    }
  };

  tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const token = tokenInput?.value?.trim();
    statusEl.textContent = 'Применяю действие...';
    try {
      await fetchJson(`/api/requests/${id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Mesh-Admin-Token': token } : {}),
        },
      });
      await loadRequests();
      statusEl.textContent = `Готово: ${action}`;
    } catch (err) {
      statusEl.textContent = 'Ошибка применения действия';
    }
  });

  loadBtn?.addEventListener('click', loadRequests);
});
