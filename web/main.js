// Liquid cards + canvas mesh + API wiring.

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('network-canvas');
  const liquidCards = Array.from(document.querySelectorAll('.liquid-card'));
  const statusSummaryEl = document.getElementById('status-summary');
  const statusDetailEl = document.getElementById('status-detail');
  const detailsCopyEl = document.getElementById('details-copy');
  const registryCopyEl = document.getElementById('registry-copy');
  const statPeersEl = document.getElementById('stat-peers');
  const statIperfEl = document.getElementById('stat-iperf');
  const statRttEl = document.getElementById('stat-rtt');
  const statMtuEl = document.getElementById('stat-mtu');
  const refreshBtn = document.querySelector('.cta');
  const API_BASE = window.API_BASE || 'http://127.0.0.1:8001';

  // Interactive light spot on liquid cards.
  liquidCards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mx', `${x}%`);
      card.style.setProperty('--my', `${y}%`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    });
  });

  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  let nodes = [];
  let providedEdges = null;
  const nodeCount = 12;

  function init() {
    resize();
    nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 10 + Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  function draw(time) {
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);

    // Build edges.
    let edges = [];
    if (providedEdges && providedEdges.length) {
      const map = Object.fromEntries(nodes.map((n) => [n.id, n]));
      edges = providedEdges
        .map(({ aId, bId }) => {
          const a = map[aId];
          const b = map[bId];
          if (!a || !b) return null;
          const dx = (a.x - b.x) * width;
          const dy = (a.y - b.y) * height;
          return { a, b, dist: Math.hypot(dx, dy) };
        })
        .filter(Boolean);
    } else {
      nodes.forEach((n, i) => {
        nodes.forEach((m, j) => {
          if (j <= i) return;
          const dx = (n.x - m.x) * width;
          const dy = (n.y - m.y) * height;
          const dist = Math.hypot(dx, dy);
          if (dist < width * 0.45) edges.push({ a: n, b: m, dist });
        });
      });
    }

    // Draw edges.
    edges.forEach(({ a, b, dist }) => {
      const alpha = Math.max(0, 0.35 - dist / (width * 0.5));
      const grad = ctx.createLinearGradient(a.x * width, a.y * height, b.x * width, b.y * height);
      grad.addColorStop(0, `rgba(78, 208, 255, ${alpha})`);
      grad.addColorStop(1, `rgba(30, 144, 255, ${alpha * 0.9})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x * width, a.y * height);
      ctx.lineTo(b.x * width, b.y * height);
      ctx.stroke();
    });

    // Draw nodes.
    nodes.forEach((n) => {
      const pulse = 1 + Math.sin(time / 800 + n.phase) * 0.08;
      const r = n.r * pulse;
      const cx = n.x * width;
      const cy = n.y * height;

      const radial = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.2, cx, cy, r * 1.4);
      radial.addColorStop(0, 'rgba(255,255,255,0.9)');
      radial.addColorStop(0.25, 'rgba(120, 220, 255, 0.85)');
      radial.addColorStop(0.85, 'rgba(15, 40, 75, 0.8)');
      radial.addColorStop(1, 'rgba(8, 22, 38, 0.9)');

      ctx.fillStyle = radial;
      ctx.shadowColor = 'rgba(78, 208, 255, 0.55)';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  requestAnimationFrame(draw);

  function setNodesFromApi(data) {
    if (!data || !Array.isArray(data.nodes)) return;
    nodes = data.nodes.map((n, i) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      r: 10 + (i % 4) * 2,
      phase: Math.random() * Math.PI * 2,
    }));
    providedEdges = (data.links || []).map((l) => ({ aId: l.source, bId: l.target }));
  }

  function applyStatus(data) {
    if (!data) return;
    const summary = `${data.mesh || 'mesh'} ${data.healthy ? 'healthy' : 'degraded'} • ${data.peer_count ?? '?'} peers`;
    statusSummaryEl && (statusSummaryEl.textContent = summary);

    const svc = data.services || {};
    const serviceText = Object.entries(svc)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    const detail = [
      `Registry ${data.registry?.reachable ? 'reachable' : 'down'}`,
      data.reality?.dest && `Reality ${data.reality.dest}`,
      serviceText && `Services ${serviceText}`,
    ]
      .filter(Boolean)
      .join(' • ');
    statusDetailEl && (statusDetailEl.textContent = detail);

    if (detailsCopyEl) {
      const detailCopy = `Mesh ${data.mesh || 'mesh'} • Reality dest ${data.reality?.dest || 'n/a'} • MTU ${data.mtu || 1400}`;
      detailsCopyEl.textContent = detailCopy;
    }
    if (registryCopyEl) {
      const reg = data.registry || {};
      registryCopyEl.textContent = `Token ${reg.token_valid ? 'valid' : 'invalid'} • Last sync ${reg.last_sync || 'n/a'} • Hosts propagated`;
    }
  }

  function applyStats(data) {
    if (!data) return;
    statPeersEl && (statPeersEl.textContent = data.peers_online);
    statIperfEl && (statIperfEl.textContent = `${data.best_iperf_mbps} Mbps`);
    statRttEl && (statRttEl.textContent = `${data.median_rtt_ms} ms`);
    statMtuEl && (statMtuEl.textContent = data.mtu);
  }

  async function fetchJson(path) {
    const res = await fetch(`${API_BASE}/api/${path}`, { mode: 'cors' });
    if (!res.ok) throw new Error(`API ${path} ${res.status}`);
    return res.json();
  }

  async function refreshSnapshot() {
    try {
      const [statusData, statsData, nodesData] = await Promise.all([
        fetchJson('status'),
        fetchJson('stats'),
        fetchJson('nodes'),
      ]);
      applyStatus(statusData);
      applyStats(statsData);
      setNodesFromApi(nodesData);
    } catch (err) {
      console.warn('API fetch failed, keeping placeholder data', err);
    }
  }

  refreshBtn && refreshBtn.addEventListener('click', refreshSnapshot);
  refreshSnapshot();
});
