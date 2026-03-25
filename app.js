/* ---------- STORAGE HELPERS ---------- */
const DB = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

/* ---------- SHA‑256 (for password hashing) ---------- */
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- INIT ---------- */
async function init() {
  // ensure we have a default user Daniel / daniel123
  if (!DB.get('users')) {
    const hash = await sha256('daniel123');
    DB.set('users', [{ username: 'Daniel', passHash: hash }]);
  }
  if (!DB.get('clients')) DB.set('clients', []);
  if (!DB.get('logs'))    DB.set('logs', []);
}
init().then(() => {
  // nothing else needed here; login screen is shown by default
});

/* ---------- SESSION ---------- */
let session = { user: null };

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showAlert(id, msg, type = 'err') {
  const el = document.getElementById(id);
  el.className = `alert alert-${type} show`;
  el.textContent = msg;
}
function hideAlert(id) { document.getElementById(id).classList.remove('show'); }

/* ---------- LOGIN ---------- */
async function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  if (!u || !p) { showAlert('alertLogin', 'Unesite korisničko ime i lozinku.'); return; }
  const users = DB.get('users') || [];
  const hash = await sha256(p);
  const user = users.find(x => x.username === u && x.passHash === hash);
  if (!user) { showAlert('alertLogin', 'Pogrešno korisničko ime ili lozinka.'); return; }
  session.user = user.username;
  enterApp();
}

/* ---------- ENTER APP ---------- */
function enterApp() {
  document.getElementById('navUser').textContent = session.user;
  document.getElementById('navAvatar').textContent = session.user[0].toUpperCase();
  document.getElementById('settingsUser').textContent = session.user;
  show('screenApp');
  showTab('tabClients');
  refreshClientSelects();
  renderClientList();
  renderLogTable();
  document.getElementById('logDate').valueAsDate = new Date();
}
function logout() {
  session = { user: null };
  show('screenLogin');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

/* ---------- TABS ---------- */
function showTab(id) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const map = { tabClients: 'btnTabClients', tabLog: 'btnTabLog', tabCharts: 'btnTabCharts', tabSettings: 'btnTabSettings' };
  if (map[id]) document.getElementById(map[id]).classList.add('active');
  if (id === 'tabCharts') renderCharts();
  if (id === 'tabLog')    renderLogTable();
}

/* ---------- CLIENTS ---------- */
function addClient() {
  const first = document.getElementById('newClientFirst').value.trim();
  const last  = document.getElementById('newClientLast').value.trim();
  const birth = parseInt(document.getElementById('newClientBirth').value);
  const height = parseInt(document.getElementById('newClientHeight').value);
  const weight = parseFloat(document.getElementById('newClientWeight').value);
  if (!first || !last || isNaN(birth) || isNaN(height) || isNaN(weight)) {
    showAlert('alertClient', 'Popunite sva polja za novog klijenta.'); return;
  }
  const clients = DB.get('clients');
  if (clients.find(c => c.first === first && c.last === last)) {
    showAlert('alertClient', 'Klijent već postoji.'); return;
  }
  const bmi = (weight / ((height/100)*(height/100))).toFixed(1);
  clients.push({
    id: Date.now(),
    first,
    last,
    birthYear: birth,
    height,
    weight,
    bmi: parseFloat(bmi)
  });
  DB.set('clients', clients);
  // reset form
  document.getElementById('newClientFirst').value = '';
  document.getElementById('newClientLast').value  = '';
  document.getElementById('newClientBirth').value = '';
  document.getElementById('newClientHeight').value = '';
  document.getElementById('newClientWeight').value = '';
  hideAlert('alertClient');
  refreshClientSelects();
  renderClientList();
}
function renderClientList() {
  const clients = DB.get('clients') || [];
  const logs    = DB.get('logs') || [];
  const el      = document.getElementById('clientList');
  if (!clients.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem;text-align:center;padding:20px;">Nema klijenata. Dodajte prvog klijenta gore.</p>';
    return;
  }
  el.innerHTML = clients.map(c => {
    const count = logs.filter(l => l.clientId === c.id).length;
    const lastLog = logs.filter(l => l.clientId === c.id)
                        .sort((a,b)=>b.date.localeCompare(a.date))[0];
    const bmiTxt = c.bmi ? `${c.bmi} kg/m²` : '—';
    return `
      <div class="client-item" onclick="openClientModal(${c.id})">
        <div>
          <div class="client-name">👤 ${c.first} ${c.last}</div>
          <div class="client-meta">
            ${count} unos(a) ${lastLog ? '· Poslednji: ' + lastLog.date : '· Nema unosa'} ·
            BMI: ${bmiTxt}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="badge">${count}</span>
          <button class="del-btn" onclick="event.stopPropagation();deleteClient(${c.id})">🗑</button>
        </div>
      </div>`;
  }).join('');
}
function deleteClient(id) {
  if (!confirm('Obrisati klijenta i sve njegove unose?')) return;
  let clients = DB.get('clients');
  let logs    = DB.get('logs');
  clients = clients.filter(c => c.id !== id);
  logs    = logs.filter(l => l.clientId !== id);
  DB.set('clients', clients);
  DB.set('logs', logs);
  refreshClientSelects();
  renderClientList();
  renderLogTable();
}
function refreshClientSelects() {
  const clients = DB.get('clients') || [];
  const opts    = clients.map(c => `<option value="${c.id}">${c.first} ${c.last}</option>`).join('');
  const empty   = '<option value="">— Izaberi klijenta —</option>';
  document.getElementById('logClient').innerHTML   = empty + opts;
  document.getElementById('chartClient').innerHTML = empty + opts;
}

/* ---------- LOGS ---------- */
document.getElementById('logProgress').addEventListener('input', function () {
  document.getElementById('progPreview').style.width = (Math.min(100, Math.max(0, this.value || 0))) + '%';
});
function addLog() {
  const clientId = parseInt(document.getElementById('logClient').value);
  const exercise = document.getElementById('logExercise').value;
  const date     = document.getElementById('logDate').value;
  const reps     = parseInt(document.getElementById('logReps').value);
  const weight   = parseFloat(document.getElementById('logWeight').value) || null;
  if (!clientId || !date || !reps || isNaN(reps)) {
    showAlert('alertLog', 'Popunite sva obavezna polja (klijent, datum, ponavljanja).'); return;
  }

  // ----- calculate progress % (needs at least two entries for same client+exercise) -----
  const allLogs = DB.get('logs') || [];
  const same = allLogs.filter(l => l.clientId === clientId && l.exercise === exercise)
                      .sort((a,b)=>a.date.localeCompare(b.date));
  let progress = 0;
  if (same.length >= 2) {
    const first = same[0];
    const latest = same[same.length-1];
    const firstVal  = (first.weight ?? 0) * first.reps;
    const latestVal = (latest.weight ?? 0) * latest.reps;
    const pct = ((latestVal - firstVal) / firstVal) * 100;
    progress = Math.max(0, Math.min(100, Math.round(pct)));
  }

  // ----- store log -----
  const newLog = { id: Date.now(), clientId, exercise, date, reps, weight, progress };
  allLogs.push(newLog);
  DB.set('logs', allLogs);

  hideAlert('alertLog');
  showAlert('alertLog', '✅ Unos sačuvan!', 'ok');
  setTimeout(() => hideAlert('alertLog'), 2000);

  // reset form (progress will be set to 0)
  document.getElementById('logReps').value     = '';
  document.getElementById('logWeight').value   = '';
  document.getElementById('logProgress').value = '0';
  document.getElementById('progPreview').style.width = '0%';
  renderLogTable();
  renderClientList();
}
function renderLogTable() {
  const logs    = DB.get('logs') || [];
  const clients = DB.get('clients') || [];
  const tbody   = document.getElementById('logTableBody');
  const recent  = [...logs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);">Nema unosa.</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map(l => {
    const c    = clients.find(x => x.id === l.clientId);
    const name = c ? `${c.first} ${c.last}` : '?';
    const color = l.progress >= 70 ? 'var(--accent2)' : l.progress >= 40 ? 'var(--warn)' : 'var(--danger)';
    return `
      <tr>
        <td>${name}</td>
        <td>${l.exercise}</td>
        <td>${l.date}</td>
        <td>${l.reps}</td>
        <td>${l.weight ?? '—'}</td>
        <td><span style="color:${color}">${l.progress}%</span></td>
        <td><button class="del-btn" onclick="deleteLog(${l.id})">🗑</button></td>
      </tr>`;
  }).join('');
}
function deleteLog(id) {
  if (!confirm('Obrisati ovaj unos?')) return;
  const logs = DB.get('logs').filter(l => l.id !== id);
  DB.set('logs', logs);
  renderLogTable();
  renderClientList();
}

/* ---------- CHARTS ---------- */
let charts = {};
function renderCharts() {
  const clientId = parseInt(document.getElementById('chartClient').value);
  const exercise = document.getElementById('chartExercise').value;
  if (!clientId) return;
  const logs = (DB.get('logs') || [])
    .filter(l => l.clientId === clientId && l.exercise === exercise)
    .sort((a,b)=>a.date.localeCompare(b.date));
  const labels   = logs.map(l => l.date);
  const progress = logs.map(l => l.progress);
  const weights  = logs.map(l => l.weight ?? 0);
  const reps     = logs.map(l => l.reps);
  const GRID = 'rgba(255,255,255,0.06)';
  const TICK = '#64748b';
  const baseOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: GRID }, ticks: { color: TICK, maxTicksLimit: 7 } },
      y: { grid: { color: GRID }, ticks: { color: TICK } },
    },
  };
  const build = (id, color, data, unit) => {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: color,
          fill: true,
          tension: 0.35,
        }],
      },
      options: {
        ...baseOpts,
        plugins: {
          ...baseOpts.plugins,
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y}${unit}` } },
        },
      },
    });
  };
  build('chartProgress', '#4f8ef7', progress, '%');
  build('chartWeight',   '#34d399', weights,  ' kg');
  build('chartReps',     '#fbbf24', reps,     ' reps');
}

/* ---------- CLIENT MODAL ---------- */
function openClientModal(cid) {
  const clients = DB.get('clients') || [];
  const logs    = DB.get('logs') || [];
  const c = clients.find(x => x.id === cid);
  if (!c) return;
  const cLogs = logs.filter(l => l.clientId === cid).sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('modalClientName').textContent = `👤 ${c.first} ${c.last}`;
  const avgProg = cLogs.length
    ? Math.round(cLogs.reduce((s,l)=>s+l.progress,0)/cLogs.length)
    : 0;
  const maxKg = cLogs.filter(l=>l.weight).reduce((m,l)=>Math.max(m,l.weight),0);
  document.getElementById('modalStats').innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;min-width:100px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:var(--accent)">${cLogs.length}</div>
        <div style="font-size:0.72rem;color:var(--muted);">UKUPNO TRENINGA</div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;min-width:100px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:var(--accent2)">${avgProg}%</div>
        <div style="font-size:0.72rem;color:var(--muted);">PROSEČAN PROGRESS</div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;min-width:100px;text-align:center;">
        <div style="font-size:1.4rem;font-weight:700;color:var(--warn)">${maxKg||'—'} ${maxKg?'kg':''}</div>
        <div style="font-size:0.72rem;color:var(--muted);">MAX TEŽINA</div>
      </div>
    </div>`;
  document.getElementById('modalTableBody').innerHTML = cLogs.length
    ? cLogs.map(l => {
        const color = l.progress >= 70 ? 'var(--accent2)' : l.progress >= 40 ? 'var(--warn)' : 'var(--danger)';
        return `<tr><td>${l.exercise}</td><td>${l.date}</td><td>${l.reps}</td><td>${l.weight ?? '—'}</td><td style="color:${color}">${l.progress}%</td></tr>`;
      }).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--muted);">Nema unosa.</td></tr>';
  document.getElementById('clientModal').classList.add('open');
}
function closeModal() { document.getElementById('clientModal').classList.remove('open'); }
document.getElementById('clientModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

/* ---------- CHANGE PASSWORD ---------- */
async function changePassword() {
  const oldP = document.getElementById('oldPass').value;
  const newP = document.getElementById('newPass').value;
  const conP = document.getElementById('confirmPass').value;
  if (!oldP || !newP || !conP) { showAlert('alertSettings', 'Popunite sva polja.'); return; }
  if (newP !== conP)            { showAlert('alertSettings', 'Nove lozinke se ne podudaraju.'); return; }
  if (newP.length < 6)          { showAlert('alertSettings', 'Lozinka mora imati najmanje 6 karaktera.'); return; }
  const users   = DB.get('users');
  const idx     = users.findIndex(u => u.username === session.user);
  const oldHash = await sha256(oldP);
  if (users[idx].passHash !== oldHash) { showAlert('alertSettings', 'Pogrešna trenutna lozinka.'); return; }
  users[idx].passHash = await sha256(newP);
  DB.set('users', users);
  showAlert('alertSettings', '✅ Lozinka uspešno promenjena!', 'ok');
  document.getElementById('oldPass').value     = '';
  document.getElementById('newPass').value     = '';
  document.getElementById('confirmPass').value = '';
}

/* ---------- KEYBOARD SHORTCUTS ---------- */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const active = document.querySelector('.screen.active')?.id;
  if (active === 'screenLogin') doLogin();
});
