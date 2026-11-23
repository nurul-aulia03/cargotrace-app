const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const FLOW = ['CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
const EXC = ['CUSTOMS_HOLD', 'WEATHER_DELAY', 'PORT_CONGESTION', 'DAMAGED', 'MISROUTED', 'DOCUMENTATION_ISSUE'];
const NAV_ADMIN = [
  { title: 'Dashboard', items: [
    ['dashboard', 'DB', 'Dashboard']
  ]},
  { title: 'PESANAN', items: [
    ['orders', 'OR', 'Manajemen Pesanan']
  ]},
  { title: 'OPERASIONAL', items: [
    ['shipments', 'SH', 'Data Pengiriman'],
    ['tracking', 'TR', 'Pelacakan Pengiriman'],
    ['exceptions', 'EX', 'Pengecualian']
  ]},
  { title: 'MANAJEMEN', items: [
    ['carriers', 'CA', 'Perusahaan Ekspedisi'],
    ['locations', 'LO', 'Lokasi'],
    ['users', 'US', 'Pengguna']
  ]},
  { title: 'ANALISIS', items: [
    ['reports', 'RP', 'Laporan'],
    ['audit', 'AL', 'Audit Logs']
  ]},
  { title: 'INFORMASI EKSTERNAL', items: [
    ['weather', 'CW', 'Cuaca'],
    ['currency', 'KR', 'Kurs Mata Uang'],
    ['news', 'BD', 'Berita Dunia'],
    ['worldclock', 'JW', 'Jam Dunia']
  ]},
  { title: 'SISTEM', items: [
    ['notifications', 'NT', 'Notifikasi'],
    ['settings', 'ST', 'Pengaturan']
  ]}
];

const NAV_OPERATOR = [
  { title: 'Dashboard', items: [
    ['dashboard', 'DB', 'Dashboard Operasional']
  ]},
  { title: 'PESANAN', items: [
    ['orders', 'OR', 'Manajemen Pesanan']
  ]},
  { title: 'OPERASIONAL', items: [
    ['shipments', 'SH', 'Data Pengiriman'],
    ['tracking', 'TR', 'Pelacakan Pengiriman'],
    ['exceptions', 'EX', 'Pengecualian']
  ]},
  { title: 'REFERENSI', items: [
    ['carriers', 'CA', 'Perusahaan Ekspedisi']
  ]},
  { title: 'INFORMASI', items: [
    ['weather', 'CW', 'Informasi Cuaca']
  ]},
  { title: 'SISTEM', items: [
    ['notifications', 'NT', 'Notifikasi'],
    ['settings', 'ST', 'Pengaturan']
  ]}
];

const NAV_CUSTOMER = [
  { title: 'Dashboard', items: [
    ['dashboard', 'DB', 'Dashboard Saya']
  ]},

  { title: 'LAYANAN PESANAN', items: [
    ['orders', 'OR', 'Pesanan Saya']
  ]},

  { title: 'PENGIRIMAN SAYA', items: [
    ['shipments', 'SH', 'Pengiriman Saya']
  ]},

  { title: 'INFORMASI', items: [
    ['notifications', 'NT', 'Notifikasi']
  ]},

  { title: 'AKUN', items: [
    ['settings', 'ST', 'Profil & Pengaturan']
  ]}
];

function isAdmin() {
  return user?.role === 'admin';
}

function isOperator() {
  return user?.role === 'operator';
}

function isCustomer() {
  return user?.role === 'customer';
}

function isStaff() {
  return isAdmin() || isOperator();
}

function getNavigation() {
  if (isAdmin()) return NAV_ADMIN;
  if (isOperator()) return NAV_OPERATOR;
  if (isCustomer()) return NAV_CUSTOMER;
  return [];
}

let token = sessionStorage.getItem('ct_token');
let user = JSON.parse(sessionStorage.getItem('ct_user') || 'null');
let charts = [];
let map = null;
let page = 1;
let exceptionFilters = { q: '', type: '', severity: '', status: '' };
let filters = {
  q: '',
  status: '',
  carrier_id: '',
  origin_id: '',
  destination_id: '',
  from: '',
  to: '',
  delayed: false
};
let searchTimer = null;

const fmt = (value) => value
  ? new Date(value).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  : '-';

const badge = (status) => `<span class="status-badge ${esc(status)}">${esc(status).replaceAll('_', ' ')}</span>`;
const shipmentStatus = (shipment) =>
  shipment.status !== 'DELIVERED' && shipment.delay?.delayed ? 'DELAYED' : shipment.status;

async function api(path, options = {}) {
  const response = await fetch('/api' + path, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let result = null;
  try { result = await response.json(); } catch (_) {}

  if (response.status === 401 && token && path !== '/login') {
    logout();
    throw new Error('Sesi berakhir. Silakan masuk kembali.');
  }

  if (!response.ok) {
    throw new Error(
      result?.errors ? Object.values(result.errors)[0][0] :
      (result?.message || `Permintaan gagal (${response.status})`)
    );
  }
  return result;
}

function cleanup() {
  charts.forEach((chart) => chart.destroy());
  charts = [];
  if (map) {
    map.remove();
    map = null;
  }
  if (window.CargoClock) {
    window.CargoClock.destroy();
  }  if (window.CargoNotif) {
    window.CargoNotif.destroy();
  }
}

function logout() {
  token = null;
  user = null;
  sessionStorage.clear();
  cleanup();
  renderLogin();
}

function renderLogin() {
  $('#side').hidden = true;
  $('#who').textContent = '';
  $('#title').textContent = 'CargoTrace';

  $('#view').innerHTML = `
    <section class="login-shell">

      <div class="login-welcome">
        <div class="welcome-brand">
          <span class="welcome-logo">CT</span>
          <span>CargoTrace</span>
        </div>

        <div class="welcome-content">
          <p class="welcome-eyebrow">GLOBAL LOGISTICS PLATFORM</p>

          <h1>Selamat Datang<br>di CargoTrace.</h1>

          <p class="welcome-description">
            Kelola dan pantau seluruh aktivitas pengiriman
            dalam satu platform terintegrasi. Dapatkan
            visibilitas perjalanan dan informasi status
            pengiriman dengan lebih mudah dan efisien.
          </p>

          <div class="login-visual">
            <div class="visual-top">
              <span>SHIPMENT OVERVIEW</span>
              <span class="live-indicator">LIVE VISIBILITY</span>
            </div>

            <div class="route-visual">
              <div class="route-point">
                <span class="route-dot origin-dot"></span>
                <div>
                  <small>ORIGIN</small>
                  <strong>Jakarta</strong>
                </div>
              </div>

              <div class="route-line"></div>

              <div class="route-point">
                <span class="route-dot destination-dot"></span>
                <div>
                  <small>DESTINATION</small>
                  <strong>Global Routes</strong>
                </div>
              </div>
            </div>

            <div class="visual-footer">
              <span>Integrated Shipment Monitoring</span>
              <span>01 / 03</span>
            </div>
          </div>
        </div>

        <div class="welcome-footer">
          Connecting Routes, Delivering Trust.
          <span>CargoTrace Logistics System</span>
        </div>
      </div>

      <div class="login-form-area">
        <div class="login-panel">

          <div class="form-heading">
            <span class="form-tag">ACCOUNT ACCESS</span>
            <h2>Masuk ke Akun Anda</h2>
            <p>
              Silakan masuk untuk mengakses sistem
              manajemen dan pemantauan pengiriman.
            </p>
          </div>

          <form id="loginForm">

            <label for="em">Alamat Email</label>
            <input
              id="em"
              type="email"
              value="admin@cargotrace.test"
              placeholder="Masukkan alamat email"
              autocomplete="username"
              required
            >

            <label for="pw">Kata Sandi</label>
            <input
              id="pw"
              type="password"
              value="password"
              placeholder="Masukkan kata sandi"
              autocomplete="current-password"
              required
            >

            <div class="login-options">
              <span>Pastikan data akun Anda benar.</span>
              <span>Secure Access</span>
            </div>

            <button
              class="button-primary button-wide"
              id="lg"
              type="submit"
            >
              Masuk ke CargoTrace
              <span aria-hidden="true">&rarr;</span>
            </button>

            <div class="error-message" id="le"></div>
          </form>

          <div class="form-bottom">
            <span>&copy; 2026 CargoTrace</span>
            <span>Logistics Management System</span>
          </div>

        </div>
      </div>

    </section>`;

  const submit = async (event) => {
    event.preventDefault();

    const button = $('#lg');
    button.disabled = true;
    button.textContent = 'Memproses...';

    try {
      const result = await api('/login', {
        method: 'POST',
        body: {
          email: $('#em').value,
          password: $('#pw').value
        }
      });

      token = result.token;
      user = result.user;

      sessionStorage.setItem('ct_token', token);
      sessionStorage.setItem('ct_user', JSON.stringify(user));

      show();

    } catch (error) {
      $('#le').textContent = error.message;
      button.disabled = false;
      button.innerHTML = 'Masuk ke CargoTrace <span aria-hidden="true">&rarr;</span>';
    }
  };

  $('#loginForm').addEventListener('submit', submit);
}
function show() {
  if (!token) return renderLogin();
  $('#side').hidden = false;
  $('#who').textContent = user ? `${user.name} | ${user.role}` : '';

  const savedView = sessionStorage.getItem('ct_last_view');
  const allowedViews = getNavigation().flatMap(group => group.items.map(item => item[0]));
  const initialView = savedView && allowedViews.includes(savedView) ? savedView : 'dashboard';

  go(initialView);
}

const expandedNavGroups = new Set();

function renderNavigation(active) {
  const groups = getNavigation().map((group, index) => {
    const activeGroup = group.items.some(([key]) =>
      key === active || (key === 'shipments' && active === 'tracking')
    );
    const isDashboard = group.items[0][0] === 'dashboard';
    const open = isDashboard || activeGroup || expandedNavGroups.has(index);

    return `
      <section class="nav-group">
        ${isDashboard ? '' : `
          <button class="nav-group-title" type="button" data-group="${index}">
            <span>${group.title}</span>
            <span class="nav-chevron">${open ? '-' : '+'}</span>
          </button>`}
        <div class="nav-group-items" data-items="${index}" ${open ? '' : 'hidden'}>
          ${group.items.map(([key, icon, label]) => `
            <a href="#" data-v="${key}" class="${key === active ? 'on' : ''}">
              <span class="nav-icon">${icon}</span><span>${label}</span>
            </a>`).join('')}
        </div>
      </section>`;
  }).join('');

  $('#nav').innerHTML = groups;

  $('#nav').querySelectorAll('[data-group]').forEach((button) => {
    button.onclick = () => {
      const items = $('#nav').querySelector(`[data-items="${button.dataset.group}"]`);
      const closed = items.hasAttribute('hidden');
      const groupIndex = Number(button.dataset.group);

      if (closed) {
        expandedNavGroups.add(groupIndex);
      } else {
        expandedNavGroups.delete(groupIndex);
      }

      items.toggleAttribute('hidden', !closed);
      button.querySelector('.nav-chevron').textContent = closed ? '-' : '+';
    };
  });

  $('#nav').querySelectorAll('a[data-v]').forEach((link) => {
    link.onclick = (event) => {
      event.preventDefault();
      go(link.dataset.v);
    };
  });
}
async function go(view, id) {
  if (token && getNavigation().flatMap(group => group.items).some(item => item[0] === view)) {
    sessionStorage.setItem('ct_last_view', view);
  }
  cleanup();
  const navItem = getNavigation().flatMap((group) => group.items).find((item) => item[0] === view);
  $('#title').textContent = navItem ? navItem[2] : 'Tracking';
  renderNavigation(view);
  $('#view').innerHTML = '<div class="loading-card">Memuat data CargoTrace...</div>';

  try {
    await V[view](id);
  } catch (error) {
    $('#view').innerHTML = `<div class="card error-card">${esc(error.message)}</div>`;
  }
}

function shipmentRows(list) {
  return list.map((shipment) => `
    <tr class="clickable-row" data-id="${shipment.id}">
      <td><strong class="shipment-number">${esc(shipment.shipment_number)}</strong></td>
      <td>${esc(shipment.customer?.name || '-')}</td>
      <td>${esc(shipment.carrier?.name || '-')}</td>
      <td>${esc(shipment.origin?.name || '-')}</td>
      <td>${esc(shipment.destination?.name || '-')}</td>
      <td>${fmt(shipment.estimated_arrival_at)}</td>
      <td>${badge(shipmentStatus(shipment))}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty-cell">Belum ada data pengiriman.</td></tr>';
}

const TABLE_HEAD = `
  <thead><tr>
    <th>Nomor pengiriman</th><th>Pelanggan</th><th>Ekspedisi</th>
    <th>Asal</th><th>Tujuan</th><th>Estimasi tiba</th><th>Status</th>
  </tr></thead>`;

function bindShipmentRows(target = 'tracking') {
  document.querySelectorAll('tr.clickable-row').forEach((row) => {
    row.onclick = () => go(target, Number(row.dataset.id));
  });
}

function renderCharts(data) {
  if (typeof Chart === 'undefined') return;

  const statusData = data.by_status || {};
  const carrierData = data.by_carrier || {};

  if ($('#statusChart')) {
    charts.push(new Chart($('#statusChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(statusData).map((status) => status.replaceAll('_', ' ')),
        datasets: [{
          data: Object.values(statusData),
          backgroundColor: '#B88BD4', borderColor: '#D6A6D9',
          borderRadius: 6,
          maxBarThickness: 34
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#B9AABD' } },
          y: { beginAtZero: true, ticks: { precision: 0, color: '#A99CAF' }, grid: { color: 'rgba(190,160,205,.13)' } }
        }
      }
    }));
  }

  if ($('#carrierChart')) {
    charts.push(new Chart($('#carrierChart'), {
      type: 'doughnut',
      data: {
        labels: Object.keys(carrierData),
        datasets: [{
          data: Object.values(carrierData),
          backgroundColor: ['#A875C8', '#D6A6D9', '#805092', '#C18BB8', '#665078'],
          borderWidth: 2, borderColor: '#1C1722',
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16, color: '#C9BBD1' } } }
      }
    }));
  }
}

async function renderDashboardMap(shipments) {
  const message = $('#mapMessage');
  const container = $('#dashboardMap');

  if (!container) return;

  if (typeof L === 'undefined') {
    message.textContent = 'Leaflet tidak dapat dimuat.';
    return;
  }

  try {
    if (container._cargoAnimations) {
      container._cargoAnimations.forEach(cancelAnimationFrame);
    }

    if (container._cargoMap) {
      container._cargoMap.remove();
    }

    container.innerHTML = '';

    // Peta geografis melebar, fokus awal Indonesia.
    const mapView = L.map(container, {
      scrollWheelZoom: true,
      zoomControl: true,
      worldCopyJump: false,
      preferCanvas: true
    }).setView([-2.5, 118], 4);

    container._cargoMap = mapView;
    container._cargoAnimations = [];

    // Esri World Topographic Map: relief, negara, kota, jalan.
    L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 17,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
      }
    ).addTo(mapView);

    const flags = {
      indonesia: '[ID]',
      singapore: '[SG]',
      germany: '[DE]',
      australia: '[AU]',
      netherlands: '[NL]',
      'united states': '[US]',
      usa: '[US]',
      japan: '[JP]',
      china: '[CN]',
      malaysia: '[MY]',
      thailand: '[TH]',
      france: '[FR]',
      italy: '[IT]',
      spain: '[ES]',
      portugal: '[PT]',
      norway: '[NO]',
      'united kingdom': '[UK]'
    };

    const flagFor = country =>
      flags[String(country || '').trim().toLowerCase()] || '[--]';

    const validPoint = (lat, lng) =>
      lat !== null && lng !== null &&
      lat !== undefined && lng !== undefined &&
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lng)) &&
      Math.abs(Number(lat)) <= 90 &&
      Math.abs(Number(lng)) <= 180;

    const details = await Promise.allSettled(
      (shipments || []).map(s => api('/shipments/' + s.id))
    );

    let originCount = 0;
    let destinationCount = 0;
    let trackingCount = 0;

    details.forEach(result => {
      if (result.status !== 'fulfilled') return;

      const shipment = result.value;
      const origin = shipment.origin;
      const destination = shipment.destination;

      const addPlace = (place, kind) => {
        if (!place || !validPoint(place.latitude, place.longitude)) return;

        const point = [
          Number(place.latitude),
          Number(place.longitude)
        ];

        const isOrigin = kind === 'origin';

        const marker = L.circleMarker(point, {
          radius: 7,
          color: '#ffffff',
          weight: 2,
          fillColor: isOrigin ? '#20a77a' : '#e46e83',
          fillOpacity: 1
        }).addTo(mapView);

        const label =
          flagFor(place.country) + ' ' +
          (place.name || 'Lokasi') + ' - ' +
          (place.country || 'Negara tidak diketahui');

        marker.bindTooltip(label, {
          direction: 'top',
          offset: [0, -8]
        });

        marker.bindPopup(`
          <strong>${isOrigin ? 'LOKASI ASAL' : 'LOKASI TUJUAN'}</strong><br>
          ${esc(label)}<br>
          Pengiriman: ${esc(shipment.shipment_number || '-')}<br>
          Status: ${esc(shipment.status || '-')}
        `);

        if (isOrigin) originCount++;
        else destinationCount++;
      };

      addPlace(origin, 'origin');
      addPlace(destination, 'destination');

      // Garis rute statis, tanpa animasi kendaraan.
      L.polyline(
        [
          [Number(origin.latitude), Number(origin.longitude)],
          [Number(destination.latitude), Number(destination.longitude)]
        ],
        {
          color: '#278fc4',
          weight: 3,
          opacity: 0.9,
          lineCap: 'round'
        }
      ).addTo(mapView);

      (shipment.events || []).forEach(event => {
        if (!validPoint(event.latitude, event.longitude)) return;

        trackingCount++;

        L.circleMarker(
          [Number(event.latitude), Number(event.longitude)],
          {
            radius: 4,
            color: '#ffffff',
            weight: 1,
            fillColor: '#258acb',
            fillOpacity: 1
          }
        ).addTo(mapView).bindPopup(`
          <strong>${esc(shipment.shipment_number || '-')}</strong><br>
          ${esc(event.event_type || 'Tracking')}<br>
          ${fmt(event.occurred_at)}
        `);
      });
    });

    L.control.scale({
      imperial: false,
      metric: true,
      position: 'bottomleft'
    }).addTo(mapView);

    // Jangan fitBounds ke seluruh dunia.
    // Dashboard selalu dibuka dari wilayah Indonesia.
    mapView.setView([-2.5, 118], 4);

    message.textContent =
      `Peta geografis aktif | ${originCount} lokasi asal | ` +
      `${destinationCount} lokasi tujuan | ${trackingCount} titik tracking. ` +
      `Klik titik untuk melihat detail.`;

    setTimeout(() => mapView.invalidateSize(), 250);

  } catch (error) {
    console.error('CargoTrace dashboard map:', error);
    message.textContent = 'Peta gagal dimuat: ' + error.message;
  }
}
function showToast(message) {
  const oldToast = document.querySelector('.ct-toast');
  if (oldToast) oldToast.remove();

  const toast = document.createElement('div');
  toast.className = 'ct-toast';
  toast.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = 'ct-toast-icon';
  icon.textContent = 'OK';

  const text = document.createElement('span');
  text.textContent = message;

  toast.append(icon, text);
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
async function openShipmentForm() {
  const wrap = document.querySelector('#shipmentFormWrap');
  if (!wrap) return;

  wrap.hidden = false;
  wrap.innerHTML = '<article class="card">Memuat data formulir...</article>';

  try {
    const [users, carriers, locations] = await Promise.all([
      api('/users'),
      api('/carriers'),
      api('/locations')
    ]);

    const customers = users.filter(user => user.role === 'customer');

    const options = (items, label) =>
      items.map(item => `<option value="${item.id}">${esc(label(item))}</option>`).join('');

    wrap.innerHTML = `
      <article class="card">
        <div class="section-heading">
          <div><h3>Tambah Pengiriman</h3>
          <p>Lengkapi informasi pengiriman baru.</p></div>
          <button type="button" class="button-secondary" id="cancelShipment">Tutup</button>
        </div>

        <form id="shipmentCreateForm">
          <div class="shipment-form-grid">
            <label>Pelanggan
              <select name="customer_id" required>
                <option value="">Pilih pelanggan</option>
                ${options(customers, item => item.name)}
              </select>
            </label>

            <label>Perusahaan ekspedisi
              <select name="carrier_id" required>
                <option value="">Pilih ekspedisi</option>
                ${options(carriers, item => item.name)}
              </select>
            </label>

            <label>Lokasi asal
              <select name="origin_id" required>
                <option value="">Pilih lokasi asal</option>
                ${options(locations, item => item.name)}
              </select>
            </label>

            <label>Lokasi tujuan
              <select name="destination_id" required>
                <option value="">Pilih lokasi tujuan</option>
                ${options(locations, item => item.name)}
              </select>
            </label>

            <label>Jenis kargo
              <input name="cargo_type" maxlength="60" required placeholder="Contoh: Elektronik">
            </label>

            <label>Berat (kg)
              <input name="weight_kg" type="number" min="0.01" step="0.01" required>
            </label>

            <label>Volume (m3)
              <input name="volume_m3" type="number" min="0" step="0.01">
            </label>

            <label>Jadwal keberangkatan
              <input name="expected_departure_at" type="datetime-local" required>
            </label>

            <label>Estimasi tiba
              <input name="expected_arrival_at" type="datetime-local" required>
            </label>
          </div>

          <p id="shipmentFormMessage" class="muted"></p>
          <button type="submit" class="button-primary">Simpan Pengiriman</button>
        </form>
      </article>

      `;

    document.querySelector('#cancelShipment').onclick = () => {
      wrap.hidden = true;
      wrap.innerHTML = '';
    };

    document.querySelector('#shipmentCreateForm').onsubmit = async event => {
      event.preventDefault();

      const form = event.currentTarget;
      const data = new FormData(form);
      const departure = data.get('expected_departure_at');
      const arrival = data.get('expected_arrival_at');
      const message = document.querySelector('#shipmentFormMessage');

      if (data.get('origin_id') === data.get('destination_id')) {
        message.textContent = 'Lokasi asal dan tujuan tidak boleh sama.';
        return;
      }

      if (new Date(arrival) <= new Date(departure)) {
        message.textContent = 'Estimasi tiba harus setelah jadwal keberangkatan.';
        return;
      }

      const body = {
        customer_id: Number(data.get('customer_id')),
        carrier_id: Number(data.get('carrier_id')),
        origin_id: Number(data.get('origin_id')),
        destination_id: Number(data.get('destination_id')),
        cargo_type: data.get('cargo_type').trim(),
        weight_kg: Number(data.get('weight_kg')),
        expected_departure_at: departure.replace('T', ' ') + ':00',
        expected_arrival_at: arrival.replace('T', ' ') + ':00'
      };

      if (data.get('volume_m3') !== '') {
        body.volume_m3 = Number(data.get('volume_m3'));
      }

      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      message.textContent = 'Menyimpan pengiriman...';

      try {
        const created = await api('/shipments', {
          method: 'POST',
          body
        });

        showToast('Pengiriman berhasil disimpan: ' + created.shipment_number);

        page = 1;
        filters.q = '';
        filters.status = '';
        await go('shipments');
      } catch (error) {
        message.textContent = error.message;
        submit.disabled = false;
      }
    };
  } catch (error) {
    wrap.innerHTML = `<article class="card error-card">${esc(error.message)}</article>`;
  }
}
async function renderRoleDashboard(role) {
  const [data, shipmentPage] = await Promise.all([
    api('/dashboard'),
    api('/shipments?per_page=5')
  ]);

  const customer = role === 'customer';
  const kpi = (icon, label, value, tone) => `
    <article class="card kpi-card">
      <div class="kpi-icon ${tone}">${icon}</div>
      <div class="kpi-copy">
        <span>${label}</span>
        <strong>${value ?? 0}</strong>
      </div>
    </article>`;

  const title = customer ? 'Dashboard Saya' : 'Dashboard Operasional';
  const description = customer
    ? 'Pantau status dan perjalanan seluruh pengiriman milik Anda.'
    : 'Kelola aktivitas operasional dan pantau pengiriman CargoTrace.';

  $('#view').innerHTML = `
    <section class="welcome-row dashboard-welcome">
      <div class="dashboard-welcome-copy">
        <p class="eyebrow">CARGOTRACE | ${customer ? 'CUSTOMER PORTAL' : 'OPERATIONS CENTER'}</p>
        <h2>Selamat datang, ${esc(user?.name || 'Pengguna')}!</h2>
        <p class="muted">${description}</p>
      </div>
      <div class="date-chip">
        ${new Date().toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </div>
    </section>

    <section class="kpi-grid">
      ${kpi('01', 'Total pengiriman', data.total, 'blue')}
      ${kpi('02', 'Dalam perjalanan', data.in_transit, 'cyan')}
      ${kpi('03', 'Terkirim', data.delivered, 'green')}
      ${kpi('04', 'Terlambat', data.delayed, 'orange')}
      ${!customer ? kpi('!', 'Pengecualian aktif', data.open_exceptions, 'red') : ''}

    </section>

    ${!customer ? `
      <section class="analytics-grid">
        <article class="card chart-card">
          <div class="section-heading">
            <div>
              <h3>Status pengiriman</h3>
              <p>Distribusi berdasarkan status terkini</p>
            </div>
          </div>
          <div class="chart-area"><canvas id="statusChart"></canvas></div>
        </article>

        <article class="card chart-card">
          <div class="section-heading">
            <div>
              <h3>Perusahaan ekspedisi</h3>
              <p>Proporsi pengiriman per carrier</p>
            </div>
          </div>
          <div class="chart-area"><canvas id="carrierChart"></canvas></div>
        </article>
      </section>

      <article class="card map-card">
        <div class="section-heading map-heading">
          <div>
            <p class="eyebrow">LIVE VISIBILITY</p>
            <h3>Peta pengiriman</h3>
            <p>Lokasi berdasarkan koordinat event tracking yang tersimpan.</p>
          </div>
          <span class="map-tag"><i></i> PETA TOPOGRAFI</span>
        </div>
        <div id="dashboardMap" class="dashboard-map"></div>
        <div class="map-legend">
          <span><i class="legend-origin"></i> Lokasi asal</span>
          <span><i class="legend-destination"></i> Lokasi tujuan</span>
          <span><i class="legend-tracking"></i> Titik tracking</span>
        </div>
        <div id="mapMessage" class="map-message">Memuat titik tracking...</div>
      </article>
    ` : ''}

    <article class="card table-card">
      <div class="section-heading">
        <div>
          <h3>${customer ? 'Riwayat pengiriman saya' : 'Pengiriman terbaru'}</h3>
          <p>${customer ? 'Pantau perkembangan pengiriman Anda.' : 'Pantau aktivitas pengiriman terbaru.'}</p>
        </div>
        <button class="button-secondary" id="allShipments">
          ${customer ? 'Lihat pengiriman saya' : 'Lihat semua'}
        </button>
      </div>
      <div class="table-wrap">
        <table>
          ${TABLE_HEAD}
          <tbody>${shipmentRows(shipmentPage.data || [])}</tbody>
        </table>
      </div>
    </article>
  `;

  if (!customer) {
    renderCharts(data);
    await renderDashboardMap(shipmentPage.data || []);
  }

  bindShipmentRows();
  $('#allShipments').onclick = () => go('shipments');
}

function kpi(icon, label, value, tone) {
  return `
    <article class="card kpi-card">
      <div class="kpi-icon ${tone}">${icon}</div>
      <div class="kpi-copy">
        <span>${label}</span>
        <strong>${value ?? 0}</strong>
      </div>
    </article>`;
}
const V = {
  async settings() {
    const root = document.querySelector('#view');
    if (!window.CargoSettings || typeof window.CargoSettings.render !== 'function') {
      throw new Error('Modul Pengaturan gagal dimuat.');
    }
    window.CargoSettings.render(root);
  },
  async dashboard() {
    if (isOperator()) {
      return renderRoleDashboard('operator');
    }

    if (isCustomer()) {
      return renderRoleDashboard('customer');
    }

    const [data, shipmentPage] = await Promise.all([
      api('/dashboard'),
      api('/shipments?per_page=5')
    ]);

    const kpi = (icon, label, value, tone) => `
      <article class="card kpi-card">
        <div class="kpi-icon ${tone}">${icon}</div>
        <div class="kpi-copy"><span>${label}</span><strong>${value}</strong></div>
      </article>

      `;

    $('#view').innerHTML = `
      <section class="welcome-row dashboard-welcome">
        <div class="dashboard-welcome-copy"><p class="eyebrow">CARGOTRACE | CONTROL CENTER</p><h2>Ringkasan operasional</h2>
        <p class="muted">Pantau aktivitas pengiriman dan performa logistik dalam satu tempat.</p></div>
        <div class="date-chip">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </section>

      <section class="kpi-grid">
        ${kpi('01', 'Total pengiriman', data.total ?? 0, 'blue')}
        ${kpi('02', 'Dalam perjalanan', data.in_transit ?? 0, 'cyan')}
        ${kpi('03', 'Terkirim', data.delivered ?? 0, 'green')}
        ${kpi('04', 'Terlambat', data.delayed ?? 0, 'orange')}
        ${kpi('!', 'Pengecualian aktif', data.open_exceptions ?? 0, 'red')}
      </section>

      <section class="analytics-grid">
        <article class="card chart-card">
          <div class="section-heading"><div><h3>Status pengiriman</h3><p>Distribusi berdasarkan status terkini</p></div></div>
          <div class="chart-area"><canvas id="statusChart"></canvas></div>
        </article>
        <article class="card chart-card">
          <div class="section-heading"><div><h3>Perusahaan ekspedisi</h3><p>Proporsi pengiriman per carrier</p></div></div>
          <div class="chart-area"><canvas id="carrierChart"></canvas></div>
        </article>
      </section>

      <article class="card map-card">
        <div class="section-heading map-heading">
          <div><p class="eyebrow">LIVE VISIBILITY</p><h3>Peta pengiriman</h3>
          <p>Lokasi berdasarkan koordinat event tracking yang tersimpan.</p></div>
          <span class="map-tag"><i></i> PETA TOPOGRAFI</span>
        </div>
        <div id="dashboardMap" class="dashboard-map"></div>
        <div class="map-legend">
          <span><i class="legend-origin"></i> Lokasi asal</span>
          <span><i class="legend-destination"></i> Lokasi tujuan</span>
          <span><i class="legend-tracking"></i> Titik tracking</span>
        </div>
        <div id="mapMessage" class="map-message">Memuat titik tracking...</div>
      </article>

      <article class="card table-card">
        <div class="section-heading"><div><h3>Pengiriman terbaru</h3><p>Pilih baris untuk melihat detail perjalanan.</p></div>
          <button class="button-secondary" id="allShipments">Lihat semua</button></div>
        <div class="table-wrap"><table>${TABLE_HEAD}<tbody>${shipmentRows(shipmentPage.data || [])}</tbody></table></div>
      </article>

      `;

    renderCharts(data);
    await renderDashboardMap(shipmentPage.data || []);
    bindShipmentRows();
    $('#allShipments').onclick = () => go('shipments');
  },

  async orders() {
    const staff = isStaff();
    const requests = [api('/orders?per_page=50')];

    if (staff) {
      requests.push(api('/carriers'));
      requests.push(api('/locations'));
    }

    const [result, carriers = [], locations = []] = await Promise.all(requests);
    const orders = result.data || [];

    const money = value => new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', maximumFractionDigits: 0
    }).format(Number(value || 0));

    const rows = orders.length ? orders.map(o => `
      <tr>
        <td><strong>${esc(o.order_number)}</strong><small style="display:block">${fmt(o.created_at)}</small></td>
        ${staff ? `<td>${esc(o.customer?.name || '-')}</td>` : ''}
        <td><strong>${esc(o.item_name)}</strong><small style="display:block">${o.quantity} barang · ${o.weight_kg} kg</small></td>
        <td>${esc(o.sender_name)} → ${esc(o.recipient_name)}</td>
        <td>${badge(o.order_status)}</td>
        <td>${esc(o.carrier?.name || '-')}</td>
        <td>${money(o.total_amount)}</td>
        <td>
          <button class="button-secondary" data-order="detail" data-id="${o.id}">Detail</button>
          ${staff && o.order_status === 'PENDING' ? `
            <button class="button-primary" data-order="approve" data-id="${o.id}">Proses</button>
            <button class="button-secondary" data-order="reject" data-id="${o.id}">Tolak</button>
          ` : ''}
          ${!staff && o.order_status === 'PENDING' ? `
            <button class="button-secondary" data-order="cancel" data-id="${o.id}">Batalkan</button>
          ` : ''}
          ${o.shipment_id ? `<button class="button-secondary" data-order="tracking" data-id="${o.shipment_id}">Lihat Pengiriman</button>` : ''}
        </td>
      </tr>
    `).join('') : `<tr><td colspan="${staff ? 8 : 7}" style="text-align:center;padding:25px">Belum ada pesanan.</td></tr>`;

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">ORDER MANAGEMENT</p>
          <h2>${staff ? 'Manajemen Pesanan' : 'Buat Pesanan'}</h2>
          <p class="muted">${staff ? 'Kelola dan proses permintaan pengiriman pelanggan.' : 'Buat pesanan dan pantau status pengiriman barangmu.'}</p>
        </div>
      </section>

      ${!staff ? `
        <article class="card table-card" style="margin-bottom:20px">
          <div class="section-heading"><div><h3>Formulir Pesanan Baru</h3><p class="muted">Lengkapi informasi barang, pengirim, dan penerima.</p></div></div>
          <form id="customerOrderForm">
            <div class="shipment-filter-grid">
              <div><label>Nama Barang *</label><input name="item_name" required maxlength="150"></div>
              <div><label>Jumlah *</label><input name="quantity" type="number" min="1" required></div>
              <div><label>Berat (kg) *</label><input name="weight_kg" type="number" min="0.01" step="0.01" required></div>
              <div><label>Nilai Barang (Rp)</label><input name="item_value" type="number" min="0"></div>
              <div><label>Pembayaran</label><select name="payment_method"><option value="">Pilih pembayaran</option><option value="TRANSFER">Transfer</option><option value="CASH">Tunai</option><option value="COD">COD</option></select></div>
            </div>
            <div style="margin-top:15px"><label>Deskripsi Barang</label><textarea name="item_description" rows="2"></textarea></div>
            <div class="shipment-filter-grid" style="margin-top:15px">
              <div><label>Nama Pengirim *</label><input name="sender_name" required></div>
              <div><label>Telepon Pengirim *</label><input name="sender_phone" required></div>
              <div><label>Nama Penerima *</label><input name="recipient_name" required></div>
              <div><label>Telepon Penerima *</label><input name="recipient_phone" required></div>
              <div><label>Alamat Pengirim *</label><textarea name="sender_address" rows="3" required></textarea></div>
              <div><label>Alamat Penerima *</label><textarea name="recipient_address" rows="3" required></textarea></div>
            </div>
            <div style="margin-top:15px"><label>Catatan</label><textarea name="notes" rows="2"></textarea></div>
            <button class="button-primary" id="submitOrder" type="submit" style="margin-top:15px">+ Kirim Pesanan</button>
          </form>
        </article>
      ` : `
        <section class="kpi-grid">
          <article class="card kpi-card"><div class="kpi-copy"><span>Total Pesanan</span><strong>${orders.length}</strong></div></article>
          <article class="card kpi-card"><div class="kpi-copy"><span>Menunggu</span><strong>${orders.filter(o => o.order_status === 'PENDING').length}</strong></div></article>
          <article class="card kpi-card"><div class="kpi-copy"><span>Disetujui</span><strong>${orders.filter(o => o.order_status === 'APPROVED').length}</strong></div></article>
          <article class="card kpi-card"><div class="kpi-copy"><span>Ditolak</span><strong>${orders.filter(o => o.order_status === 'REJECTED').length}</strong></div></article>
        </section>
      `}

      <article class="card table-card" style="margin-top:20px">
        <div class="section-heading"><div><p class="eyebrow">ORDER DATABASE</p><h3>${staff ? 'Daftar Seluruh Pesanan' : 'Riwayat Pesanan Saya'}</h3><p class="muted">${orders.length} pesanan ditemukan.</p></div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Nomor Pesanan</th>${staff ? '<th>Pelanggan</th>' : ''}<th>Barang</th><th>Pengirim → Penerima</th><th>Status</th><th>Ekspedisi</th><th>Total</th><th>Aksi</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </article>
      <div id="orderApprovalModal" hidden></div>
    `;

    const customerForm = $('#customerOrderForm');
    if (customerForm) {
      customerForm.onsubmit = async event => {
        event.preventDefault();
        const submit = $('#submitOrder');
        submit.disabled = true;
        submit.textContent = 'Mengirim...';

        const body = Object.fromEntries(new FormData(customerForm).entries());
        body.quantity = Number(body.quantity);
        body.weight_kg = Number(body.weight_kg);
        body.item_value = Number(body.item_value || 0);

        try {
          const response = await api('/orders', { method: 'POST', body });
          showToast(response.message || 'Pesanan berhasil dibuat.');
          await go('orders');
        } catch (error) {
          showToast('Gagal membuat pesanan: ' + error.message);
          submit.disabled = false;
          submit.textContent = '+ Kirim Pesanan';
        }
      };
    }

    document.querySelectorAll('[data-order]').forEach(button => {
      button.onclick = async () => {
        const id = button.dataset.id;
        const action = button.dataset.order;

        if (action === 'detail') return go('orderDetail', id);

        if (action === 'tracking') return go('tracking', id);

        if (action === 'cancel') {
          if (!confirm('Batalkan pesanan ini?')) return;
          try {
            const r = await api(`/orders/${id}/cancel`, { method: 'POST' });
            showToast(r.message || 'Pesanan dibatalkan.');
            await go('orders');
          } catch (e) { showToast(e.message); }
          return;
        }

        if (action === 'reject') {
          const reason = prompt('Masukkan alasan penolakan:');
          if (!reason?.trim()) return;
          try {
            const r = await api(`/orders/${id}/reject`, {
              method: 'POST', body: { reason: reason.trim() }
            });
            showToast(r.message || 'Pesanan ditolak.');
            await go('orders');
          } catch (e) { showToast(e.message); }
          return;
        }

        if (action === 'approve') {
          const modal = $('#orderApprovalModal');
          modal.hidden = false;
          modal.innerHTML = `
            <article class="card table-card" style="margin:20px 0;padding:20px">
              <h3>Proses Persetujuan Pesanan</h3>
              <form id="approveOrderForm">
                <div class="shipment-filter-grid">
                  <div><label>Ekspedisi *</label><select name="carrier_id" required><option value="">Pilih ekspedisi</option>${carriers.map(c => `<option value="${c.id}">${esc(c.name)} (${esc(c.mode || '-')})</option>`).join('')}</select></div>
                  <div><label>Lokasi Asal *</label><select name="origin_id" required><option value="">Pilih asal</option>${locations.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>
                  <div><label>Lokasi Tujuan *</label><select name="destination_id" required><option value="">Pilih tujuan</option>${locations.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></div>
                </div>
                <div style="display:flex;gap:10px;margin-top:15px">
                  <button class="button-primary" type="submit">Setujui dan Buat Pengiriman</button>
                  <button class="button-secondary" type="button" id="closeApproval">Batal</button>
                </div>
              </form>
            </article>

      `;

          $('#closeApproval').onclick = () => {
            modal.hidden = true;
            modal.innerHTML = '';
          };

          $('#approveOrderForm').onsubmit = async event => {
            event.preventDefault();
            const body = Object.fromEntries(new FormData(event.currentTarget).entries());
            body.carrier_id = Number(body.carrier_id);
            body.origin_id = Number(body.origin_id);
            body.destination_id = Number(body.destination_id);

            const submit = event.currentTarget.querySelector('[type="submit"]');
            submit.disabled = true;

            try {
              const r = await api(`/orders/${id}/approve`, { method: 'POST', body });
              showToast(r.message || 'Pesanan disetujui dan pengiriman dibuat.');
              await go('orders');
            } catch (e) {
              showToast('Gagal menyetujui: ' + e.message);
              submit.disabled = false;
            }
          };
        }
      };
    });
  },
  async orderDetail(id) {
    const order = await api('/orders/' + id);

    const money = value => value === null || value === undefined
      ? 'Menunggu penawaran'
      : new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          maximumFractionDigits: 0
        }).format(Number(value || 0));

    const field = (label, value) => `
      <div class="order-detail-item">
        <span>${label}</span>
        <strong>${esc(value ?? '-')}</strong>
      </div>`;

    const shipment = order.shipment || null;

    $('#view').innerHTML = `
      <style>
        .order-detail-grid {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:14px;
          margin-top:18px;
        }
        .order-detail-item {
          padding:16px;
          border:1px solid rgba(207,160,231,.16);
          border-radius:12px;
          background:rgba(255,255,255,.035);
          min-width:0;
        }
        .order-detail-item span {
          display:block;
          color:#b9a9c4;
          font-size:12px;
          margin-bottom:8px;
        }
        .order-detail-item strong {
          display:block;
          color:#fff;
          font-size:14px;
          line-height:1.5;
          overflow-wrap:anywhere;
        }
        .order-detail-section {
          margin-top:20px;
          padding:22px;
        }
        .order-detail-section h3 {
          margin-bottom:6px;
        }
        .order-detail-actions {
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:20px;
        }
        @media(max-width:850px) {
          .order-detail-grid {
            grid-template-columns:repeat(2,minmax(0,1fr));
          }
        }
        @media(max-width:520px) {
          .order-detail-grid {
            grid-template-columns:1fr;
          }
        }
      </style>

      <section class="welcome-row">
        <div>
          <p class="eyebrow">ORDER MANAGEMENT</p>
          <h2>Detail Pesanan</h2>
          <p class="muted">Informasi lengkap pesanan dan pembayaran Anda.</p>
        </div>
        <button class="button-secondary" id="backToOrders">Kembali</button>
      </section>

      <article class="card order-detail-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">INFORMASI PESANAN</p>
            <h3>${esc(order.order_number)}</h3>
            <p class="muted">Dibuat ${fmt(order.created_at)}</p>
          </div>
          ${badge(order.order_status)}
        </div>
        <div class="order-detail-grid">
          ${field('Nama barang', order.item_name)}
          ${field('Jumlah barang', order.quantity)}
          ${field('Berat barang', order.weight_kg == null ? '-' : order.weight_kg + ' kg')}
          ${field('Nilai barang', money(order.item_value))}
          ${field('Metode pembayaran', order.payment_method)}
          ${field('Status pembayaran', order.payment_status)}
        </div>
      </article>

      <article class="card order-detail-section">
        <h3>Informasi Pengirim</h3>
        <div class="order-detail-grid">
          ${field('Nama pengirim', order.sender_name)}
          ${field('Telepon pengirim', order.sender_phone)}
          ${field('Alamat pengirim', order.sender_address)}
        </div>
      </article>

      <article class="card order-detail-section">
        <h3>Informasi Penerima</h3>
        <div class="order-detail-grid">
          ${field('Nama penerima', order.recipient_name)}
          ${field('Telepon penerima', order.recipient_phone)}
          ${field('Alamat penerima', order.recipient_address)}
        </div>
      </article>

      <article class="card order-detail-section">
        <h3>Informasi Pengiriman dan Biaya</h3>
        <div class="order-detail-grid">
          ${field('Perusahaan ekspedisi', order.carrier?.name)}
          ${field('Lokasi asal', order.origin?.name || order.sender_address)}
          ${field('Lokasi tujuan', order.destination?.name || order.recipient_address)}
          ${field('Biaya pengiriman', money(order.shipping_cost))}
          ${field('Total pembayaran', money(order.total_amount))}
          ${field('Nomor pengiriman', shipment?.shipment_number)}
        </div>
        <p class="muted" style="margin-top:14px">
          Biaya yang belum ditentukan akan menunggu proses penawaran logistik.
        </p>
      </article>

      <article class="card order-detail-section">
        <h3>Catatan Pesanan</h3>
        <p class="muted" style="white-space:pre-wrap;margin-top:12px">${esc(order.notes || 'Tidak ada catatan.')}</p>
      </article>

      <div class="order-detail-actions">
        ${order.shipment_id ? `
          <button class="button-primary" id="trackOrderDetail">Lacak Pengiriman</button>
        ` : ''}
        ${!isStaff() && order.order_status === 'PENDING' ? `
          <button class="button-secondary" id="cancelOrderDetail">Batalkan Pesanan</button>
        ` : ''}
        <button class="button-secondary" id="backToOrdersBottom">Kembali ke Pesanan</button>
      </div>
    `;

    $('#backToOrders').onclick = () => go('orders');
    $('#backToOrdersBottom').onclick = () => go('orders');

    const trackButton = $('#trackOrderDetail');
    if (trackButton) {
      trackButton.onclick = () => go('tracking', order.shipment_id);
    }

    const cancelButton = $('#cancelOrderDetail');
    if (cancelButton) {
      cancelButton.onclick = async () => {
        if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;

        cancelButton.disabled = true;

        try {
          const result = await api(`/orders/${id}/cancel`, {
            method: 'POST'
          });
          showToast(result.message || 'Pesanan berhasil dibatalkan.');
          await go('orders');
        } catch (error) {
          showToast(error.message);
          cancelButton.disabled = false;
        }
      };
    }
  },
  async shipments(id) {
    if (id) {
      if (isCustomer()) return go('tracking', id);
      const shipment = await api('/shipments/' + id);

      $('#view').innerHTML = `
        <section class="welcome-row">
          <div>
            <p class="eyebrow">SHIPMENT MANAGEMENT</p>
            <h2>Detail Data Pengiriman</h2>
            <p class="muted">Informasi administrasi dan data pengiriman.</p>
          </div>
          <button class="button-secondary" id="backShipments">Kembali ke Data Pengiriman</button>
        </section>

        <article class="card table-card">
          <div class="section-heading">
            <div><h3>${esc(shipment.shipment_number || '-')}</h3>
            <p class="muted">Informasi utama pengiriman</p></div>
            ${badge(shipmentStatus(shipment))}
          </div>
          <style>
.shipment-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 24px;
}
.shipment-detail-grid > div {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 9px;
  min-height: 82px;
  padding: 15px 17px;
  border: 1px solid rgba(207,160,231,.16);
  border-radius: 12px;
  background: rgba(255,255,255,.035);
}
.shipment-detail-grid span {
  display: block;
  color: #b9a9c4;
  font-size: 12px;
}
.shipment-detail-grid strong {
  display: block;
  color: #fff;
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
@media(max-width:900px) {
  .shipment-detail-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
}
@media(max-width:520px) {
  .shipment-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
<div class="shipment-detail-grid">
            <div><span class="muted">Pelanggan</span><strong>${esc(shipment.customer?.name || '-')}</strong></div>
            <div><span class="muted">Ekspedisi</span><strong>${esc(shipment.carrier?.name || '-')}</strong></div>
            <div><span class="muted">Lokasi asal</span><strong>${esc(shipment.origin?.name || '-')}</strong></div>
            <div><span class="muted">Lokasi tujuan</span><strong>${esc(shipment.destination?.name || '-')}</strong></div>
            <div><span class="muted">Jenis kargo</span><strong>${esc(shipment.cargo_type || '-')}</strong></div>
            <div><span class="muted">Berat</span><strong>${esc(shipment.weight_kg ?? '-')} kg</strong></div>
            <div><span class="muted">Estimasi tiba</span><strong>${fmt(shipment.estimated_arrival_at)}</strong></div>
            <div><span class="muted">Dibuat</span><strong>${fmt(shipment.created_at)}</strong></div>
          </div>
          <div style="margin-top:24px">
            <button class="button-primary" id="openShipmentTracking">Lihat Pelacakan Pengiriman</button>
          </div>
        </article>

      `;

      $('#backShipments').onclick = () => go('shipments');
      $('#openShipmentTracking').onclick = () => go('tracking', id);
      return;
    }
    const params = new URLSearchParams({ page, per_page: 8 });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== false && value != null) {
        params.set(key, value === true ? '1' : value);
      }
    });

    const [result, stats, carriers, locations] = await Promise.all([
      api('/shipments?' + params),
      api('/dashboard'),
      api('/carriers'),
      api('/locations')
    ]);

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">OPERATIONS MANAGEMENT</p>
          <h2>Data Pengiriman</h2>
          <p class="muted">Pantau, cari, dan kelola seluruh aktivitas pengiriman CargoTrace.</p>
        </div>
        ${isStaff() ? '<button class="button-primary" id="addShipment">+ Tambah Pengiriman</button>' : ''}
      </section>

      <section class="kpi-grid shipment-kpi-grid">
        ${kpi('01', 'Total Pengiriman', stats.total ?? 0, 'blue')}
        ${kpi('02', 'Dalam Perjalanan', stats.in_transit ?? 0, 'cyan')}
        ${kpi('03', 'Terkirim', stats.delivered ?? 0, 'green')}
        ${kpi('04', 'Terlambat', stats.delayed ?? 0, 'orange')}
      </section>

      <div id="shipmentFormWrap" hidden></div>

      <article class="card table-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">SHIPMENT CONTROL</p>
            <h3>Filter dan Pencarian</h3>
            <p class="muted">Gunakan filter untuk menemukan pengiriman tertentu.</p>
          </div>
        </div>

        <div class="shipment-filter-grid">
          <input id="fq" placeholder="Cari nomor pengiriman..." value="${esc(filters.q)}">

          <select id="fs">
            <option value="">Semua status</option>
            ${FLOW.map(status => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${status.replaceAll('_', ' ')}</option>`).join('')}
          </select>

          <select id="fc">
            <option value="">Semua ekspedisi</option>
            ${carriers.map(item => `<option value="${item.id}" ${String(filters.carrier_id) === String(item.id) ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
          </select>

          <select id="fo">
            <option value="">Semua lokasi asal</option>
            ${locations.map(item => `<option value="${item.id}" ${String(filters.origin_id) === String(item.id) ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
          </select>

          <select id="fd">
            <option value="">Semua lokasi tujuan</option>
            ${locations.map(item => `<option value="${item.id}" ${String(filters.destination_id) === String(item.id) ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}
          </select>

          <div class="shipment-filter-field">
            <label for="ffrom">Estimasi tiba dari</label>
            <input type="date" id="ffrom" value="${esc(filters.from)}" style="width:100%;margin-top:5px">
          </div>

          <div class="shipment-filter-field">
            <label for="fto">Estimasi tiba sampai</label>
            <input type="date" id="fto" value="${esc(filters.to)}" style="width:100%;margin-top:5px">
          </div>

          <label class="shipment-delayed-filter">
            <input type="checkbox" id="fdelayed" ${filters.delayed ? 'checked' : ''} style="width:auto">
            Hanya pengiriman terlambat
          </label>
        </div>

        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px">
          <span class="muted">Delay rate: <strong>${stats.delay_rate_percent ?? 0}%</strong></span>
          <button class="button-secondary" id="resetShipmentFilters">Reset Filter</button>
        </div>

        <div class="section-heading">
          <div>
            <h3>Daftar Pengiriman</h3>
            <p class="muted">Menampilkan ${result.data?.length ?? 0} dari ${result.total ?? 0} pengiriman.</p>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            ${TABLE_HEAD}
            <tbody>
              ${shipmentRows(result.data || [])}
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <span>${result.total ?? 0} pengiriman · Halaman ${result.current_page ?? 1}/${result.last_page ?? 1}</span>
          <div>
            <button class="button-secondary" id="pp" ${result.current_page <= 1 ? 'disabled' : ''}>Sebelumnya</button>
            <button class="button-secondary" id="pn" ${result.current_page >= result.last_page ? 'disabled' : ''}>Berikutnya</button>
          </div>
        </div>
      </article>

      `;

    const applyFilters = () => {
      filters.q = $('#fq').value.trim();
      filters.status = $('#fs').value;
      filters.carrier_id = $('#fc').value;
      filters.origin_id = $('#fo').value;
      filters.destination_id = $('#fd').value;
      filters.from = $('#ffrom').value;
      filters.to = $('#fto').value;
      filters.delayed = $('#fdelayed').checked;
      page = 1;
      V.shipments();
    };

    $('#fq').oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applyFilters, 350);
    };

    ['fs', 'fc', 'fo', 'fd', 'ffrom', 'fto', 'fdelayed'].forEach(id => {
      $('#' + id).onchange = applyFilters;
    });

    $('#resetShipmentFilters').onclick = () => {
      filters = {
        q: '',
        status: '',
        carrier_id: '',
        origin_id: '',
        destination_id: '',
        from: '',
        to: '',
        delayed: false
      };
      page = 1;
      V.shipments();
    };

    $('#pp').onclick = () => {
      page--;
      V.shipments();
    };

    $('#pn').onclick = () => {
      page++;
      V.shipments();
    };

    if (isStaff()) {
      $('#addShipment').onclick = openShipmentForm;
    }

    bindShipmentRows('shipments');
  },
  async tracking(id) {
    if (!id) {
      const params = new URLSearchParams({ page, per_page: 10 });
      if (filters.q) params.set('q', filters.q);
      if (filters.status) params.set('status', filters.status);

      const result = await api('/shipments?' + params);

      $('#view').innerHTML = `
        <section class="welcome-row">
          <div>
            <p class="eyebrow">TRACKING</p>
            <h2>Pelacakan Pengiriman</h2>
            <p class="muted">Pilih nomor pengiriman untuk melihat detail perjalanan, lokasi, dan riwayat tracking.</p>
          </div>
        </section>
        <article class="card table-card">
          <div class="filter-row">
            <input id="trackingSearch" placeholder="Cari nomor pengiriman..." value="${esc(filters.q)}">
            <select id="trackingStatus">
              <option value="">Semua status</option>
              ${FLOW.map(status => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${status.replaceAll('_', ' ')}</option>`).join('')}
            </select>
          </div>
          <div class="table-wrap">
            <table>${TABLE_HEAD}<tbody>${shipmentRows(result.data || [])}</tbody></table>
          </div>
          <div class="pagination">
            <span>${result.total} pengiriman · halaman ${result.current_page}/${result.last_page}</span>
            <div>
              <button class="button-secondary" id="trackingPrev" ${result.current_page <= 1 ? 'disabled' : ''}>Sebelumnya</button>
              <button class="button-secondary" id="trackingNext" ${result.current_page >= result.last_page ? 'disabled' : ''}>Berikutnya</button>
            </div>
          </div>
        </article>

      `;

      $('#trackingSearch').oninput = event => {
        clearTimeout(searchTimer);
        const value = event.target.value;
        searchTimer = setTimeout(() => {
          filters.q = value;
          page = 1;
          go('tracking');
        }, 350);
      };

      $('#trackingStatus').onchange = event => {
        filters.status = event.target.value;
        page = 1;
        go('tracking');
      };

      $('#trackingPrev').onclick = () => {
        page--;
        go('tracking');
      };

      $('#trackingNext').onclick = () => {
        page++;
        go('tracking');
      };

      bindShipmentRows();
      return;
    }

    const [shipment, locations, orderResult] = await Promise.all([
      api('/shipments/' + id),
      isStaff() ? api('/locations') : Promise.resolve([]),
      isCustomer() ? api('/orders?per_page=50') : Promise.resolve(null)
    ]);

    const linkedOrder = orderResult?.data?.find(
      order => Number(order.shipment_id) === Number(id)
    ) || null;

    const events = shipment.events || [];
    const latestEvent = [...events]
      .filter(event => event.occurred_at)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))[0];
    const last = [...events].reverse().find((event) => event.latitude != null);
    const index = FLOW.indexOf(shipment.status);
    const next = FLOW[index + 1];
    const delay = shipment.delay || {};

    $('#title').textContent = shipment.shipment_number;
    $('#view').innerHTML = `
      <section class="welcome-row"><div><p class="eyebrow">SHIPMENT DETAIL</p><h2>${esc(shipment.shipment_number)}</h2>
      <p class="muted">${esc(shipment.origin?.name || '-')} → ${esc(shipment.destination?.name || '-')}</p></div><div><button class="button-secondary" id="bk">Kembali ke daftar</button> ${badge(shipmentStatus(shipment))}</div></section>
      ${isCustomer() ? `
        <article class="card" style="padding:22px;margin-bottom:20px">
          <p class="eyebrow">INFORMASI PESANAN CUSTOMER</p>
          <h3>${esc(linkedOrder?.order_number || 'Informasi pesanan')}</h3>
          <div class="shipment-detail-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
            <div><span>Nama barang</span><strong>${esc(linkedOrder?.item_name || shipment.cargo_type || '-')}</strong></div>
            <div><span>Jumlah</span><strong>${esc(linkedOrder?.quantity ?? '-')}</strong></div>
            <div><span>Nama pengirim</span><strong>${esc(linkedOrder?.sender_name || '-')}</strong></div>
            <div><span>Telepon pengirim</span><strong>${esc(linkedOrder?.sender_phone || '-')}</strong></div>
            <div><span>Alamat pengirim</span><strong>${esc(linkedOrder?.sender_address || '-')}</strong></div>
            <div><span>Nama penerima</span><strong>${esc(linkedOrder?.recipient_name || '-')}</strong></div>
            <div><span>Telepon penerima</span><strong>${esc(linkedOrder?.recipient_phone || '-')}</strong></div>
            <div><span>Alamat penerima</span><strong>${esc(linkedOrder?.recipient_address || '-')}</strong></div>
            <div><span>Metode pembayaran</span><strong>${esc(linkedOrder?.payment_method || '-')}</strong></div>
            <div><span>Status pembayaran</span><strong>${esc(linkedOrder?.payment_status || '-')}</strong></div>
            <div><span>Biaya pengiriman</span><strong>${linkedOrder?.shipping_cost == null ? 'Menunggu penawaran' : new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(linkedOrder.shipping_cost))}</strong></div>
            <div><span>Total pembayaran</span><strong>${linkedOrder?.total_amount == null ? 'Menunggu penawaran' : new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(linkedOrder.total_amount))}</strong></div>
          </div>
          ${!linkedOrder ? '<p class="muted">Data pesanan terkait belum ditemukan.</p>' : ''}
        </article>
      ` : ''}
      <section class="detail-grid">
        <article class="card"><p class="eyebrow">INFORMASI PENGIRIMAN</p><div class="detail-line"><span>Ekspedisi</span><strong>${esc(shipment.carrier?.name || '-')}</strong></div>
        <div class="detail-line"><span>Jenis kargo</span><strong>${esc(shipment.cargo_type || '-')}</strong></div>
        <div class="detail-line"><span>Berat</span><strong>${esc(shipment.weight_kg)} kg</strong></div>
        <div class="detail-line"><span>Estimasi tiba</span><strong>${fmt(shipment.estimated_arrival_at)}</strong></div>
        ${delay.delayed && shipment.status !== 'DELIVERED' ? `<div class="notice-warning">Pengiriman terlambat: ${esc(delay.reason || 'Perlu pemeriksaan')}.</div>` : ''}</article>
        <article class="card"><p class="eyebrow">PROGRES</p><div class="progress-list">${FLOW.map((status, i) => `<div class="progress-step ${i <= index ? 'complete' : ''}"><i></i><span>${status.replaceAll('_', ' ')}</span></div>`).join('')}</div></article>
      </section>
      <section class="detail-grid tracking-grid">
        <article class="card"><div class="section-heading"><div><h3>Peta rute</h3><p>Lokasi dari event tracking</p></div></div><div id="trackingMap" class="tracking-map"></div></article>
        <article class="card"><h3>Riwayat perjalanan</h3><p class="muted">Urutan aktivitas pengiriman</p>
          <ul class="timeline">${events.map((event) => `<li class="${event.is_exception ? 'exception' : ''}"><strong>${esc((event.event_type || '').replaceAll('_', ' '))}</strong><p>${esc(event.description || '')}</p><small>${fmt(event.occurred_at)}</small></li>`).join('') || '<li>Belum ada event tracking.</li>'}</ul>
          <h3 class="subheading">Pengecualian</h3>${(shipment.exceptions || []).map((item) => `<div class="exception-row">${badge(item.status)} ${badge(item.severity)} ${esc(item.type)}
            ${isStaff() && item.status !== 'RESOLVED' ? `<button class="button-secondary" data-x="${item.id}" data-n="${item.status === 'OPEN' ? 'INVESTIGATING' : 'RESOLVED'}">${item.status === 'OPEN' ? 'Investigasi' : 'Selesaikan'}</button>` : ''}</div>`).join('') || '<p class="muted">Tidak ada pengecualian.</p>'}
        </article>
      </section>
      ${isStaff() ? `<article class="card operator-card"><h3>Aksi operator</h3><div class="operator-grid">
        <div><label>Tambah event tracking</label><select id="et">${next ? `<option>${next}</option>` : ''}<option>NOTE</option></select>
          <label>Lokasi</label><select id="el">${locations.map((location) => `<option value="${location.id}">${esc(location.name)}</option>`).join('')}</select>
          <label>Deskripsi</label><input id="ed" maxlength="120"><button class="button-primary" id="ea">Tambah event</button></div>
        <div><label>Jenis pengecualian</label><select id="xt">${EXC.map((type) => `<option>${type}</option>`).join('')}</select>
          <label>Tingkat keparahan</label><select id="xs"><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select>
          <button class="button-secondary" id="xa">Laporkan pengecualian</button></div></div><div class="error-message" id="er"></div></article>` : ''}`;

    $('#view').querySelectorAll('.progress-step').forEach((step, i) => {
      if (i === index) step.classList.add('current');
    });

    if (typeof L !== 'undefined') {
      map = L.map('trackingMap', {
        scrollWheelZoom: true,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelPxPerZoomLevel: 60
      }).setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17, attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">PETA TOPOGRAFI</a>'
      }).addTo(map);

      const points = events.filter((event) =>
        event.latitude != null && event.longitude != null
      ).map((event) => [Number(event.latitude), Number(event.longitude)]);

      events.filter((event) => event.latitude != null && event.longitude != null)
        .forEach((event) => {
          L.circleMarker([Number(event.latitude), Number(event.longitude)], {
            radius: event === last ? 8 : 6, color: '#fff', weight: 2,
            fillColor: event === last ? '#d9535d' : '#2878a8', fillOpacity: 1
          }).addTo(map).bindPopup(`<strong>${esc(event.event_type)}</strong><br>${fmt(event.occurred_at)}`);
        });

      if (points.length > 1) L.polyline(points, { color: '#2878a8', weight: 4 }).addTo(map);
      if (points.length) map.fitBounds(points, { padding: [45, 45], maxZoom: 14, animate: false });
      setTimeout(() => map && map.invalidateSize(), 150);
    }

    $('#bk').onclick = () => go('tracking');

    if (isStaff()) {
      const run = async (action) => {
        try { await action(); go('tracking', id); }
        catch (error) { $('#er').textContent = error.message; }
      };
      $('#ea').onclick = () => run(() => api(`/shipments/${id}/tracking`, {
        method: 'POST',
        body: {
          event_type: $('#et').value,
          location_id: Number($('#el').value),
          description: $('#ed').value || null
        }
      }));
      $('#xa').onclick = () => run(() => api(`/shipments/${id}/exceptions`, {
        method: 'POST', body: { type: $('#xt').value, severity: $('#xs').value }
      }));
      document.querySelectorAll('[data-x]').forEach((button) => {
        button.onclick = () => run(() => api('/exceptions/' + button.dataset.x, {
          method: 'PATCH', body: { status: button.dataset.n }
        }));
      });
    }
  },


  async exceptions() {
    const params = new URLSearchParams({ page: String(page) });

    Object.entries(exceptionFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const result = await api('/exceptions?' + params.toString());
    const items = result.data || [];

    const rows = items.map(item => `
      <tr>
        <td><strong>${esc(item.shipment?.shipment_number || '-')}</strong></td>
        <td>${esc((item.type || '-').replaceAll('_', ' '))}</td>
        <td>${badge(item.severity)}</td>
        <td>${badge(item.status)}</td>
        <td>${fmt(item.detected_at)}</td>
        <td>${esc(item.description || 'Belum ada deskripsi')}</td>
        <td>
          <div class="action-group">
            <button class="button-secondary" data-exception-detail="${item.id}">Detail</button>
            ${isStaff() && item.status === 'OPEN'
              ? `<button class="button-secondary" data-exception-id="${item.id}" data-next-status="INVESTIGATING">Investigasi</button>`
              : ''}
            ${isStaff() && ['OPEN', 'INVESTIGATING'].includes(item.status)
              ? `<button class="button-primary" data-exception-id="${item.id}" data-next-status="RESOLVED">Selesaikan</button>`
              : ''}
          </div>
        </td>
      </tr>
    `).join('');

    const countStatus = status =>
      items.filter(item => item.status === status).length;

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">OPERATIONS MONITORING</p>
          <h2>Pengecualian Pengiriman</h2>
          <p class="muted">Pantau masalah dan tindak lanjut pada seluruh pengiriman.</p>
        </div>
      </section>

      <section class="kpi-grid">
        <article class="card kpi-card">
          <div class="kpi-icon red">!</div>
          <div class="kpi-copy"><span>Total pengecualian</span><strong>${result.total || 0}</strong></div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-icon orange">OP</div>
          <div class="kpi-copy"><span>Perlu ditangani</span><strong>${countStatus('OPEN')}</strong><small>Pada halaman ini</small></div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-icon blue">IN</div>
          <div class="kpi-copy"><span>Sedang investigasi</span><strong>${countStatus('INVESTIGATING')}</strong><small>Pada halaman ini</small></div>
        </article>
        <article class="card kpi-card">
          <div class="kpi-icon green">OK</div>
          <div class="kpi-copy"><span>Selesai</span><strong>${countStatus('RESOLVED')}</strong><small>Pada halaman ini</small></div>
        </article>
      </section>

      <article class="card table-card">
        <div class="section-heading">
          <div>
            <h3>Daftar pengecualian</h3>
            <p>Temukan dan pantau masalah pengiriman berdasarkan kriteria.</p>
          </div>
        </div>

        <div class="exception-filter-grid">
          <input id="exceptionSearch" value="${esc(exceptionFilters.q)}"
            placeholder="Cari nomor pengiriman atau deskripsi...">

          <select id="exceptionType">
            <option value="">Semua jenis masalah</option>
            ${['CUSTOMS_HOLD','WEATHER_DELAY','PORT_CONGESTION','DAMAGED','MISROUTED','DOCUMENTATION_ISSUE'].map(type =>
              `<option value="${type}" ${exceptionFilters.type === type ? 'selected' : ''}>${type.replaceAll('_', ' ')}</option>`
            ).join('')}
          </select>

          <select id="exceptionSeverity">
            <option value="">Semua keparahan</option>
            ${['LOW','MEDIUM','HIGH'].map(value =>
              `<option value="${value}" ${exceptionFilters.severity === value ? 'selected' : ''}>${value}</option>`
            ).join('')}
          </select>

          <select id="exceptionStatus">
            <option value="">Semua status</option>
            ${['OPEN','INVESTIGATING','RESOLVED'].map(value =>
              `<option value="${value}" ${exceptionFilters.status === value ? 'selected' : ''}>${value}</option>`
            ).join('')}
          </select>

          <div class="exception-filter-actions">
            <button class="button-primary" id="applyExceptionFilters">Cari</button>
            <button class="button-secondary" id="resetExceptionFilters">Reset</button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Nomor pengiriman</th>
              <th>Jenis masalah</th>
              <th>Keparahan</th>
              <th>Status</th>
              <th>Waktu kejadian</th>
              <th>Deskripsi</th>
              <th>Tindakan</th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="7" class="empty-cell">Tidak ada pengecualian yang cocok dengan filter.</td></tr>'}</tbody>
          </table>
        </div>

        <div class="pagination">
          <span>${result.total || 0} data | Halaman ${result.current_page || 1}/${result.last_page || 1}</span>
          <div>
            <button class="button-secondary" id="exceptionPrev" ${!result.prev_page_url ? 'disabled' : ''}>Sebelumnya</button>
            <button class="button-secondary" id="exceptionNext" ${!result.next_page_url ? 'disabled' : ''}>Berikutnya</button>
          </div>
        </div>
      </article>

      `;

    const applyExceptionFilters = () => {
      exceptionFilters = {
        q: $('#exceptionSearch').value.trim(),
        type: $('#exceptionType').value,
        severity: $('#exceptionSeverity').value,
        status: $('#exceptionStatus').value
      };
      page = 1;
      go('exceptions');
    };

    $('#applyExceptionFilters').onclick = applyExceptionFilters;

    $('#exceptionSearch').onkeydown = event => {
      if (event.key === 'Enter') applyExceptionFilters();
    };

    $('#resetExceptionFilters').onclick = () => {
      exceptionFilters = { q: '', type: '', severity: '', status: '' };
      page = 1;
      go('exceptions');
    };

    document.querySelectorAll('[data-exception-id]').forEach(button => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          await api('/exceptions/' + button.dataset.exceptionId, {
            method: 'PATCH',
            body: { status: button.dataset.nextStatus }
          });
          showToast('Status pengecualian berhasil diperbarui.');
          await go('exceptions');
        } catch (error) {
          button.disabled = false;
          showToast('Gagal memperbarui: ' + error.message);
        }
      };
    });

    document.querySelectorAll('[data-exception-detail]').forEach(button => {
      button.onclick = async () => {
        const item = items.find(x => String(x.id) === button.dataset.exceptionDetail);
        if (!item) return;

        button.disabled = true;

        try {
          const data = await api('/exceptions/' + item.id + '/history');
          const detail = data.exception || item;
          const shipment = detail.shipment || item.shipment || {};
          const history = Array.isArray(data.history) ? data.history : [];

          const formatDate = value => {
            if (!value) return 'Belum tersedia';
            const date = new Date(value);
            return Number.isNaN(date.getTime())
              ? esc(value)
              : esc(date.toLocaleString('id-ID', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                }));
          };

          const actionLabel = action => ({
            'exception:create': 'Pengecualian dibuat',
            'exception:INVESTIGATING': 'Pengecualian mulai diinvestigasi',
            'exception:RESOLVED': 'Pengecualian diselesaikan'
          }[action] || String(action || 'Aktivitas').replaceAll('_', ' '));

          document.querySelector('#exceptionDetailModal')?.remove();

          const modal = document.createElement('div');
          modal.id = 'exceptionDetailModal';
          modal.className = 'exception-modal';

          modal.innerHTML = `
            <div class="exception-modal-panel">
              <div class="exception-modal-header">
                <div>
                  <p class="eyebrow">EXCEPTION MANAGEMENT</p>
                  <h2>Detail Pengecualian</h2>
                  <p class="muted">
                    Pengiriman ${esc(shipment.shipment_number || '-')}
                  </p>
                </div>
                <button type="button"
                  class="exception-modal-close"
                  aria-label="Tutup">&times;</button>
              </div>

              <div class="exception-detail-grid">
                <div class="exception-detail-item">
                  <small>Nomor Pengiriman</small>
                  <strong>${esc(shipment.shipment_number || '-')}</strong>
                </div>
                <div class="exception-detail-item">
                  <small>Pelanggan</small>
                  <strong>${esc(shipment.customer?.name || '-')}</strong>
                </div>
                <div class="exception-detail-item">
                  <small>Jenis Pengecualian</small>
                  <strong>${esc(detail.type || '-').replaceAll('_', ' ')}</strong>
                </div>
                <div class="exception-detail-item">
                  <small>Tingkat Keparahan</small>
                  <strong>${esc(detail.severity || '-')}</strong>
                </div>
                <div class="exception-detail-item">
                  <small>Status</small>
                  <strong>${badge(detail.status || '-')}</strong>
                </div>
                <div class="exception-detail-item">
                  <small>Terdeteksi Pada</small>
                  <strong>${formatDate(detail.detected_at)}</strong>
                </div>
                <div class="exception-detail-item">
                  <small>Diselesaikan Pada</small>
                  <strong>${formatDate(detail.resolved_at)}</strong>
                </div>
                <div class="exception-detail-item">
                  <small>Perusahaan Pengiriman</small>
                  <strong>${esc(shipment.carrier?.name || '-')}</strong>
                </div>
              </div>

              <div class="exception-detail-description">
                <h4>Deskripsi Pengecualian</h4>
                <p>${esc(detail.description || 'Belum ada deskripsi.')}</p>
              </div>

              <div class="exception-history">
                <h3>Riwayat Aktivitas</h3>
                ${history.length ? history.map(entry => `
                  <div class="exception-history-item">
                    <strong>${esc(actionLabel(entry.action))}</strong>
                    <p>Pengguna: ${esc(entry.user?.name || 'Sistem')}</p>
                    <p>Email: ${esc(entry.user?.email || '-')}</p>
                    <time>${formatDate(entry.created_at)}</time>
                  </div>
                `).join('') : `
                  <div class="exception-history-empty">
                    Belum ada riwayat aktivitas yang tercatat.
                  </div>
                `}
              </div>
            </div>
          `;

          $('#view').appendChild(modal);

          const closeModal = () => {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
          };

          const handleEscape = event => {
            if (event.key === 'Escape') closeModal();
          };

          modal.querySelector('.exception-modal-close').onclick = closeModal;
          modal.onclick = event => {
            if (event.target === modal) closeModal();
          };

          document.addEventListener('keydown', handleEscape);

        } catch (error) {
          showToast('Gagal memuat detail pengecualian: ' + error.message);
        } finally {
          button.disabled = false;
        }
      };
    });

    $('#exceptionPrev').onclick = () => {
      page--;
      go('exceptions');
    };

    $('#exceptionNext').onclick = () => {
      page++;
      go('exceptions');
    };
  },
  async locations() {
    const locations = await api('/locations');
    const isAdmin = user?.role === 'admin';

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">LOCATION MANAGEMENT</p>
          <h2>Manajemen Lokasi</h2>
          <p class="muted">Kelola lokasi asal, tujuan, dan koordinat pengiriman.</p>
        </div>
      </section>

      ${isAdmin ? `
        <article class="card">
          <h3>Tambah Lokasi Baru</h3>
          <form id="locationForm">
            <div class="form-grid">
              <label>Nama lokasi
                <input name="name" required maxlength="120" placeholder="Contoh: Medan">
              </label>
              <label>Negara
                <input name="country" maxlength="60" placeholder="Contoh: Indonesia">
              </label>
              <label>Latitude
                <input name="latitude" type="number" step="any" min="-90" max="90" required placeholder="3.5952">
              </label>
              <label>Longitude
                <input name="longitude" type="number" step="any" min="-180" max="180" required placeholder="98.6722">
              </label>
            </div>
            <button type="submit" class="button-primary">Simpan Lokasi</button>
          </form>
        </article>
        <article class="card location-map-card">
          <div class="section-heading">
            <div>
              <h3>Peta Lokasi</h3>
              <p>Pilih lokasi untuk melihat posisi geografisnya.</p>
            </div>
            <span class="status-badge">OPENSTREETMAP</span>
          </div>
          <div id="locationMap" class="location-map"></div>
          <p id="locationMapInfo" class="muted">Menampilkan seluruh lokasi dengan koordinat valid.</p>
        </article>
      ` : ''}

      <article class="card table-card">
        <div class="section-heading">
          <div>
            <h3>Daftar Lokasi</h3>
            <p>Seluruh lokasi yang terdaftar di CargoTrace.</p>
          </div>
          <span class="status-badge">${locations.length} LOKASI</span>
        </div>

        <div class="location-search">
          <input id="locationSearch" type="search" placeholder="Cari nama lokasi atau negara...">
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama Lokasi</th>
                <th>Negara</th>
                <th>Latitude</th>
                <th>Longitude</th>
                ${isAdmin ? '<th>Aksi</th>' : ''}
              </tr>
            </thead>
            <tbody id="locationRows">
              ${locations.map(location => `
                <tr>
                  <td><strong>${esc(location.name)}</strong></td>
                  <td>${esc(location.country || '-')}</td>
                  <td>${esc(location.latitude)}</td>
                  <td>${esc(location.longitude)}</td>
                  ${isAdmin ? `
                    <td class="location-actions">
                      <button type="button" class="location-edit" data-id="${location.id}">Edit</button>
                      <button type="button" class="location-delete" data-id="${location.id}">Hapus</button>
                    </td>
                  ` : ''}
                </tr>
              `).join('') || `<tr><td colspan="${isAdmin ? 5 : 4}">Belum ada data lokasi.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;

    if (typeof L !== 'undefined' && $('#locationMap')) {
      if (map) {
        map.remove();
        map = null;
      }

      map = L.map('locationMap', {
        scrollWheelZoom: true,
        zoomSnap: 0.25,
        zoomDelta: 0.25,
        wheelPxPerZoomLevel: 120,
        wheelDebounceTime: 80,
        doubleClickZoom: true
      }).setView([20, 0], 2);

      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'Tiles (c) Esri'
      }).addTo(map);

      const validLocations = locations.filter(location =>
        Number.isFinite(Number(location.latitude)) &&
        Number.isFinite(Number(location.longitude)) &&
        location.latitude !== null && location.longitude !== null &&
        Number(location.latitude) >= -90 && Number(location.latitude) <= 90 &&
        Number(location.longitude) >= -180 && Number(location.longitude) <= 180
      );

      const markers = new Map();

      validLocations.forEach(location => {
        const marker = L.marker([
          Number(location.latitude),
          Number(location.longitude)
        ]).addTo(map);

        marker.bindPopup(
          '<strong>' + esc(location.name) + '</strong><br>' +
          esc(location.country || '-') + '<br>' +
          Number(location.latitude).toFixed(5) + ', ' +
          Number(location.longitude).toFixed(5)
        );

        markers.set(String(location.id), marker);
      });

      // GLOBAL LOGISTICS NETWORK
      let shipmentRouteCount = 0;
      const transportCounts = { air: 0, sea: 0, road: 0 };

      const transportConfig = mode => {
        const value = String(mode || '').toLowerCase();

        if (value.includes('air')) {
          return { type: 'air', color: '#9b7bff', label: 'Air Freight' };
        }
        if (value.includes('sea') || value.includes('ocean')) {
          return { type: 'sea', color: '#20b8d5', label: 'Sea Freight' };
        }
        if (value.includes('road')) {
          return { type: 'road', color: '#f0a43a', label: 'Road Freight' };
        }
        return { type: 'road', color: '#a78bfa', label: mode || 'Transportasi' };
      };

      const vehicleSvg = type => {
        const common = 'width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"';

        if (type === 'air') {
          return `<svg ${common}>
            <defs><linearGradient id="planePaint" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#b9c9e8"/></linearGradient></defs>
            <path d="M7 34L27 29 42 8Q45 4 48 7L43 27 57 32Q61 34 57 37L42 38 34 55Q32 59 29 55L27 40 10 42Q5 42 7 34Z" fill="url(#planePaint)" stroke="#536985" stroke-width="1.5"/>
            <path d="M13 35L43 30" stroke="#8e6bff" stroke-width="3" stroke-linecap="round"/>
            <path d="M28 39L33 51" stroke="#8e6bff" stroke-width="2"/>
          </svg>`;
        }

        if (type === 'sea') {
          return `<svg ${common}>
            <path d="M5 39H59L51 51Q49 55 43 55H19Q12 54 9 49Z" fill="#155b83" stroke="#d9f4ff" stroke-width="2"/>
            <path d="M14 22H29V37H14Z" fill="#f3f5fa" stroke="#6d8095"/>
            <path d="M30 17H45V37H30Z" fill="#e7a44c" stroke="#795e42"/>
            <path d="M46 24H54V37H46Z" fill="#f3f5fa" stroke="#6d8095"/>
            <path d="M8 43H55" stroke="#4bd1e5" stroke-width="3"/>
            <path d="M17 13V22M34 9V17M49 16V24" stroke="#fff" stroke-width="2"/>
          </svg>`;
        }

        return `<svg ${common}>
          <path d="M5 19H39V44H5Z" fill="#f3f5fa" stroke="#63758d" stroke-width="1.5"/>
          <path d="M39 27H50L59 37V44H39Z" fill="#268bc2" stroke="#174c70" stroke-width="1.5"/>
          <path d="M45 30H50L55 37H45Z" fill="#c9efff"/>
          <path d="M9 23H35V39H9Z" fill="#8c70ed"/>
          <circle cx="17" cy="47" r="6" fill="#202637" stroke="#dce5f3" stroke-width="2"/>
          <circle cx="48" cy="47" r="6" fill="#202637" stroke="#dce5f3" stroke-width="2"/>
          <path d="M5 43H59" stroke="#f4b64b" stroke-width="2"/>
        </svg>`;
      };

      try {
        const shipmentResponse = await api('/shipments?per_page=50');
        const shipments = Array.isArray(shipmentResponse)
          ? shipmentResponse
          : (shipmentResponse?.data || []);

        shipments.forEach(shipment => {
          const origin = shipment.origin;
          const destination = shipment.destination;

          if (!origin || !destination) return;

          const originLat = Number(origin.latitude);
          const originLng = Number(origin.longitude);
          const destinationLat = Number(destination.latitude);
          const destinationLng = Number(destination.longitude);

          if (
            !Number.isFinite(originLat) || !Number.isFinite(originLng) ||
            !Number.isFinite(destinationLat) || !Number.isFinite(destinationLng) ||
            origin.latitude === null || origin.longitude === null ||
            destination.latitude === null || destination.longitude === null
          ) return;

          const transport = transportConfig(shipment.carrier?.mode);
          transportCounts[transport.type]++;
          shipmentRouteCount++;

          // Curved visual connection between origin and destination
          const dx = destinationLng - originLng;
          const dy = destinationLat - originLat;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const bend = Math.min(distance * 0.16, 13);
          const controlLat = (originLat + destinationLat) / 2 + (dx >= 0 ? bend : -bend);
          const controlLng = (originLng + destinationLng) / 2 - (dy >= 0 ? bend : -bend);

          const routePoints = [];
          for (let i = 0; i <= 40; i++) {
            const t = i / 40;
            const inverse = 1 - t;
            const lat =
              inverse * inverse * originLat +
              2 * inverse * t * controlLat +
              t * t * destinationLat;
            const lng =
              inverse * inverse * originLng +
              2 * inverse * t * controlLng +
              t * t * destinationLng;
            routePoints.push([lat, lng]);
          }

          L.polyline(routePoints, {
            color: transport.color,
            weight: 3,
            opacity: 0.85,
            dashArray: '8, 9',
            lineCap: 'round'
          }).addTo(map);

          const middle = routePoints[Math.floor(routePoints.length / 2)];

          const transportIcon = L.divIcon({
            className: 'cargo-real-vehicle',
            html: `<div class="cargo-real-vehicle__body cargo-real-vehicle--${transport.type}">
              ${vehicleSvg(transport.type)}
            </div>`,
            iconSize: [54, 54],
            iconAnchor: [27, 27]
          });

          const transportMarker = L.marker(middle, {
            icon: transportIcon,
            zIndexOffset: 500
          }).addTo(map);

          transportMarker.bindPopup(`
            <div class="cargo-route-popup">
              <strong>${esc(shipment.shipment_number || 'Pengiriman')}</strong>
              <p>${esc(transport.label)}</p>
              <p>Ekspedisi: ${esc(shipment.carrier?.name || '-')}</p>
              <p>Status: ${esc(shipment.status || '-').replaceAll('_', ' ')}</p>
              <p>Asal: ${esc(origin.name || '-')}</p>
              <p>Tujuan: ${esc(destination.name || '-')}</p>
            </div>
          `);
        });

        const legend = L.control({ position: 'topright' });
        legend.onAdd = () => {
          const div = L.DomUtil.create('div', 'cargo-map-legend');
          div.innerHTML = `
            <div class="cargo-map-legend__title">JARINGAN LOGISTIK</div>
            <div class="cargo-map-legend__item"><i class="air"></i> Pesawat <b>${transportCounts.air}</b></div>
            <div class="cargo-map-legend__item"><i class="sea"></i> Kapal <b>${transportCounts.sea}</b></div>
            <div class="cargo-map-legend__item"><i class="road"></i> Truk <b>${transportCounts.road}</b></div>
            <div class="cargo-map-legend__total">${shipmentRouteCount} rute pengiriman</div>
          `;
          L.DomEvent.disableClickPropagation(div);
          return div;
        };
        legend.addTo(map);

        $('#locationMapInfo').textContent =
          `${validLocations.length} lokasi dan ${shipmentRouteCount} rute pengiriman dari database ditampilkan pada peta.`;

      } catch (error) {
        $('#locationMapInfo').textContent =
          'Data lokasi tersedia, tetapi rute pengiriman gagal dimuat: ' + error.message;
      }
      if (validLocations.length === 1) {
        map.setView([
          Number(validLocations[0].latitude),
          Number(validLocations[0].longitude)
        ], 10);
      } else if (validLocations.length > 1) {
        const bounds = L.latLngBounds(
          validLocations.map(location => [
            Number(location.latitude),
            Number(location.longitude)
          ])
        );
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 10 });
      }


      $('#locationRows').querySelectorAll('tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', event => {
          if (event.target.closest('button')) return;

          const cells = row.querySelectorAll('td');
          const name = cells[0]?.textContent.trim();
          const location = validLocations.find(item => item.name === name);
          if (!location) return;

          const marker = markers.get(String(location.id));
          if (marker) {
            map.setView(marker.getLatLng(), 11);
            marker.openPopup();
          }
        });
      });

      const locationForm = $('#locationForm');
      if (locationForm) {
        const latitude = locationForm.elements.latitude;
        const longitude = locationForm.elements.longitude;
        let previewMarker = null;

        const updatePreview = () => {
          const lat = Number(latitude.value);
          const lng = Number(longitude.value);

          if (!latitude.value || !longitude.value ||
              !Number.isFinite(lat) || !Number.isFinite(lng) ||
              lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return;
          }

          if (previewMarker) {
            previewMarker.setLatLng([lat, lng]);
          } else {
            previewMarker = L.marker([lat, lng]).addTo(map);
          }

          previewMarker.bindPopup('Pratinjau lokasi baru').openPopup();
          map.setView([lat, lng], 10);
          $('#locationMapInfo').textContent =
            'Pratinjau koordinat: ' + lat.toFixed(5) + ', ' + lng.toFixed(5);
        };

        latitude.addEventListener('input', updatePreview);
        longitude.addEventListener('input', updatePreview);
      }

      setTimeout(() => map?.invalidateSize(), 150);
    }

    const search = $('#locationSearch');
    search.addEventListener('input', () => {
      const keyword = search.value.toLowerCase().trim();
      $('#locationRows').querySelectorAll('tr').forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(keyword);
      });
    });

    if (isAdmin) {
      $('#locationForm').onsubmit = async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const body = {
          name: data.get('name').trim(),
          country: data.get('country').trim() || null,
          latitude: Number(data.get('latitude')),
          longitude: Number(data.get('longitude'))
        };

        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;

        try {
          await api('/locations', { method: 'POST', body });
          showToast('Lokasi berhasil ditambahkan.');
          await go('locations');
        } catch (error) {
          submit.disabled = false;
          showToast('Gagal menyimpan lokasi: ' + error.message);
        }
      };

      $('#locationRows').querySelectorAll('.location-edit').forEach(button => {
        button.onclick = () => {
          const location = locations.find(item => String(item.id) === button.dataset.id);
          if (!location) return;

          document.querySelector('#locationEditModal')?.remove();

          const modal = document.createElement('div');
          modal.id = 'locationEditModal';
          modal.className = 'location-modal';
          modal.innerHTML = `
            <div class="location-modal-panel">
              <div class="location-modal-header">
                <div>
                  <p class="eyebrow">LOCATION MANAGEMENT</p>
                  <h3>Edit Data Lokasi</h3>
                  <p class="muted">Perbarui informasi lokasi dan koordinat.</p>
                </div>
                <button type="button" class="location-modal-close">&times;</button>
              </div>
              <form id="locationEditForm">
                <div class="form-grid">
                  <label>Nama lokasi<input name="name" required maxlength="120"></label>
                  <label>Negara<input name="country" maxlength="60"></label>
                  <label>Latitude<input name="latitude" type="number" step="any" min="-90" max="90" required></label>
                  <label>Longitude<input name="longitude" type="number" step="any" min="-180" max="180" required></label>
                </div>
                <div class="location-modal-actions">
                  <button type="button" class="location-cancel">Batal</button>
                  <button type="submit" class="button-primary">Simpan Perubahan</button>
                </div>
              </form>
            </div>`;

          $('#view').appendChild(modal);

          const form = modal.querySelector('#locationEditForm');
          form.elements.name.value = location.name || '';
          form.elements.country.value = location.country || '';
          form.elements.latitude.value = location.latitude ?? '';
          form.elements.longitude.value = location.longitude ?? '';

          const close = () => modal.remove();
          modal.querySelector('.location-modal-close').onclick = close;
          modal.querySelector('.location-cancel').onclick = close;

          form.onsubmit = async event => {
            event.preventDefault();
            const data = new FormData(form);
            const body = {
              name: data.get('name').trim(),
              country: data.get('country').trim() || null,
              latitude: Number(data.get('latitude')),
              longitude: Number(data.get('longitude'))
            };

            if (!body.name || !Number.isFinite(body.latitude) ||
                body.latitude < -90 || body.latitude > 90 ||
                !Number.isFinite(body.longitude) ||
                body.longitude < -180 || body.longitude > 180) {
              showToast('Periksa kembali data lokasi.');
              return;
            }

            const submit = form.querySelector('button[type="submit"]');
            submit.disabled = true;

            try {
              await api('/locations/' + location.id, { method: 'PUT', body });
              close();
              showToast('Lokasi berhasil diperbarui.');
              await go('locations');
            } catch (error) {
              submit.disabled = false;
              showToast('Gagal mengedit lokasi: ' + error.message);
            }
          };
        };
      });
      $('#locationRows').querySelectorAll('.location-delete').forEach(button => {
        button.onclick = async () => {
          const location = locations.find(item => String(item.id) === button.dataset.id);
          if (!location) return;

          const confirmed = await new Promise(resolve => {
            const modal = document.createElement('div');
            modal.className = 'location-modal';
            modal.innerHTML = `
              <div class="location-modal-panel location-confirm-panel">
                <div class="location-modal-header">
                  <div>
                    <p class="eyebrow">KONFIRMASI PENGHAPUSAN</p>
                    <h3>Hapus Lokasi?</h3>
                    <p class="muted">Apakah kamu yakin ingin menghapus lokasi ini?</p>
                  </div>
                  <button type="button" class="location-modal-close">&times;</button>
                </div>
                <div class="location-delete-info">
                  <strong>${esc(location.name)}</strong>
                  <span>${esc(location.country || '-')}</span>
                </div>
                <div class="location-modal-actions">
                  <button type="button" class="location-cancel">Batal</button>
                  <button type="button" class="location-confirm-delete">Ya, Hapus</button>
                </div>
              </div>`;

            $('#view').appendChild(modal);

            const finish = value => {
              modal.remove();
              resolve(value);
            };

            modal.querySelector('.location-modal-close').onclick = () => finish(false);
            modal.querySelector('.location-cancel').onclick = () => finish(false);
            modal.querySelector('.location-confirm-delete').onclick = () => finish(true);
            modal.onclick = event => {
              if (event.target === modal) finish(false);
            };
          });

          if (!confirmed) return;

          try {
            await api('/locations/' + location.id, { method: 'DELETE' });
            showToast('Lokasi berhasil dihapus.');
            await go('locations');
          } catch (error) {
            showToast('Gagal menghapus lokasi: ' + error.message);
          }
        };
      });
    }
  },
  async users() {
    const users = await api('/users');

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">USER MANAGEMENT</p>
          <h2>Manajemen Pengguna</h2>
          <p class="muted">Kelola dan pantau pengguna yang terdaftar di CargoTrace.</p>
        </div>
      </section>

      <div class="user-summary-grid">
        <article class="card user-summary-card">
          <span class="user-summary-label">TOTAL PENGGUNA</span>
          <strong>${users.length}</strong>
          <span class="muted">Pengguna terdaftar</span>
        </article>
        <article class="card user-summary-card">
          <span class="user-summary-label">ADMINISTRATOR</span>
          <strong>${users.filter(u => u.role === 'admin').length}</strong>
          <span class="muted">Pengelola sistem</span>
        </article>
        <article class="card user-summary-card">
          <span class="user-summary-label">OPERATOR</span>
          <strong>${users.filter(u => u.role === 'operator').length}</strong>
          <span class="muted">Petugas operasional</span>
        </article>
        <article class="card user-summary-card">
          <span class="user-summary-label">CUSTOMER</span>
          <strong>${users.filter(u => u.role === 'customer').length}</strong>
          <span class="muted">Pengguna layanan</span>
        </article>
      </div>

      <article class="card table-card">
        <div class="section-heading">
          <div>
            <h3>Daftar Pengguna</h3>
            <p>Informasi akun dan hak akses pengguna.</p>
          </div>
          <span class="status-badge">${users.length} PENGGUNA</span>
        </div>

        <div class="location-search">
          <input id="userSearch" type="search" placeholder="Cari nama atau email pengguna...">
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Nama Pengguna</th>
                <th>Email</th>
                <th>Hak Akses</th>
              </tr>
            </thead>
            <tbody id="userRows">
              ${users.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${esc(item.name)}</strong></td>
                  <td>${esc(item.email)}</td>
                  <td>
                    <span class="user-role role-${esc(item.role)}">
                      ${esc(item.role).toUpperCase()}
                    </span>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="4">Belum ada pengguna.</td></tr>'}
            </tbody>
          </table>
        </div>
      </article>
    `;

    $('#userSearch').addEventListener('input', event => {
      const keyword = event.target.value.toLowerCase().trim();
      $('#userRows').querySelectorAll('tr').forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(keyword);
      });
    });
  },
  async reports() {
    const [stats, shipmentPage] = await Promise.all([
      api('/dashboard'),
      api('/shipments?per_page=50')
    ]);

    const shipments = shipmentPage.data || [];
    const statuses = Object.entries(stats.by_status || {});
    const carriers = Object.entries(stats.by_carrier || {});

    const statusColors = {
      CREATED: '#8b9bb0',
      BOOKED: '#a78bfa',
      PICKED_UP: '#3b82b8',
      IN_TRANSIT: '#287fae',
      DELIVERED: '#26966b',
      CANCELLED: '#d65b63',
      DELAYED: '#e87991'
    };

    const statusLabel = value =>
      String(value || '-').replaceAll('_', ' ');

    const statusTotal = statuses.reduce(
      (sum, item) => sum + Number(item[1]), 0
    );

    const dateKey = value => {
      if (!value) return '';
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? ''
        : date.toISOString().slice(0, 10);
    };

    const escapeCsv = value =>
      '"' + String(value ?? '').replaceAll('"', '""') + '"';

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">REPORT & ANALYTICS</p>
          <h2>Laporan Pengiriman</h2>
          <p class="muted">Ringkasan dan analisis operasional pengiriman CargoTrace.</p>
        </div>
      </section>

      <div class="report-kpi-grid">
        <article class="card report-kpi">
          <span class="report-kpi-label">TOTAL PENGIRIMAN</span>
          <strong>${stats.total ?? 0}</strong>
          <span class="muted">Seluruh pengiriman tercatat</span>
        </article>
        <article class="card report-kpi">
          <span class="report-kpi-label">DALAM PERJALANAN</span>
          <strong>${stats.in_transit ?? 0}</strong>
          <span class="muted">Pengiriman sedang berjalan</span>
        </article>
        <article class="card report-kpi">
          <span class="report-kpi-label">TELAH DIKIRIM</span>
          <strong>${stats.delivered ?? 0}</strong>
          <span class="muted">Pengiriman selesai</span>
        </article>
        <article class="card report-kpi">
          <span class="report-kpi-label">PENGIRIMAN TERLAMBAT</span>
          <strong>${stats.delayed ?? 0}</strong>
          <span class="muted">Tingkat keterlambatan ${stats.delay_rate_percent ?? 0}%</span>
        </article>
      </div>

      <div class="report-analysis-grid">
        <article class="card report-panel">
          <div class="section-heading">
            <div><h3>Distribusi Status</h3>
            <p>Jumlah pengiriman berdasarkan status.</p></div>
          </div>
          ${statuses.length ? statuses.map(([status, total]) => {
            const percent = statusTotal ? Number(total) / statusTotal * 100 : 0;
            return `
              <div class="report-bar-item">
                <div class="report-bar-heading">
                  <span>${esc(statusLabel(status))}</span>
                  <strong>${total}</strong>
                </div>
                <div class="report-bar-track">
                  <div class="report-bar-fill"
                    style="width:${percent}%;background:${statusColors[status] || '#3289b9'}"></div>
                </div>
              </div>`;
          }).join('') : '<p class="muted">Belum ada data status.</p>'}
        </article>

        <article class="card report-panel">
          <div class="section-heading">
            <div><h3>Performa Ekspedisi</h3>
            <p>Jumlah pengiriman per perusahaan ekspedisi.</p></div>
          </div>
          ${carriers.length ? carriers.map(([name, total]) => {
            const percent = stats.total ? Number(total) / stats.total * 100 : 0;
            return `
              <div class="report-bar-item">
                <div class="report-bar-heading">
                  <span>${esc(name)}</span><strong>${total}</strong>
                </div>
                <div class="report-bar-track">
                  <div class="report-bar-fill carrier-fill" style="width:${percent}%"></div>
                </div>
              </div>`;
          }).join('') : '<p class="muted">Belum ada data ekspedisi.</p>'}
        </article>
      </div>

      <div class="report-alert-row">
        <article class="card report-alert-card" id="openExceptionsReport" role="button" tabindex="0" title="Klik untuk melihat pengecualian terbuka" style="cursor:pointer;">
          <span class="report-alert-icon">!</span>
          <div>
            <strong>${stats.open_exceptions ?? 0} Pengecualian Terbuka</strong>
            <p class="muted">Pengiriman yang masih membutuhkan penanganan.</p>
          </div>
        </article>
      </div>

      <article class="card table-card">
        <div class="section-heading">
          <div>
            <h3>Data Pengiriman</h3>
            <p>Gunakan filter untuk mencari dan mengunduh laporan.</p>
          </div>
          <button class="button-primary" id="exportReport">Unduh CSV / Excel</button>
        </div>

        <div class="filter-row">
          <input id="reportSearch" placeholder="Cari nomor pengiriman atau pelanggan...">
          <select id="reportStatus">
            <option value="">Semua status</option>
            ${FLOW.map(s => `<option value="${s}">${statusLabel(s)}</option>`).join('')}
          </select>
          <input type="date" id="reportFrom" title="Tanggal mulai">
          <input type="date" id="reportTo" title="Tanggal akhir">
          <button class="button-secondary" id="resetReport">Reset Filter</button>
        </div>

        <div class="section-heading">
          <p class="muted" id="reportCount"></p>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>NOMOR PENGIRIMAN</th>
                <th>PELANGGAN</th>
                <th>EKSPEDISI</th>
                <th>ASAL</th>
                <th>TUJUAN</th>
                <th>TANGGAL</th>
                <th>STATUS</th>
                <th>DETAIL</th>
              </tr>
            </thead>
            <tbody id="reportRows"></tbody>
          </table>
        </div>
      </article>
    `;

    let filtered = [...shipments];
    let selectedCarrier = '';
    let selectedDelayed = false;

    const renderRows = () => {
      const keyword = $('#reportSearch').value.toLowerCase().trim();
      const status = $('#reportStatus').value;
      const from = $('#reportFrom').value;
      const to = $('#reportTo').value;

      filtered = shipments.filter(item => {
        const searchText = [
          item.shipment_number,
          item.customer?.name,
          item.carrier?.name
        ].join(' ').toLowerCase();

        const date = dateKey(item.created_at);
        const actualStatus = shipmentStatus(item);

        return (!keyword || searchText.includes(keyword)) &&
          (!status || actualStatus === status) &&
          (!selectedCarrier || item.carrier?.name === selectedCarrier) &&
          (!selectedDelayed || actualStatus === 'DELAYED' || item.delay?.is_delayed === true) &&
          (!from || (date && date >= from)) &&
          (!to || (date && date <= to));
      });

      $('#reportCount').textContent =
        `${filtered.length} dari ${shipments.length} pengiriman ditemukan.`;

      $('#reportRows').innerHTML = filtered.map(item => `
        <tr>
          <td><strong>${esc(item.shipment_number || '-')}</strong></td>
          <td>${esc(item.customer?.name || '-')}</td>
          <td>${esc(item.carrier?.name || '-')}</td>
          <td>${esc(item.origin?.name || '-')}</td>
          <td>${esc(item.destination?.name || '-')}</td>
          <td>${fmt(item.created_at)}</td>
          <td><span class="report-status">${esc(statusLabel(shipmentStatus(item)))}</span></td>
          <td>
            <button class="button-secondary" data-report-detail="${item.id}">
              Detail
            </button>
          </td>
        </tr>
      `).join('') ||
        '<tr><td colspan="8">Tidak ada data yang sesuai filter.</td></tr>';
    };

    ['reportSearch', 'reportStatus', 'reportFrom', 'reportTo']
      .forEach(id => {
        const element = $('#' + id);
        element.addEventListener(
          id === 'reportSearch' ? 'input' : 'change',
          renderRows
        );
      });

    $('#resetReport').onclick = () => {
      $('#reportSearch').value = '';
      $('#reportStatus').value = '';
      $('#reportFrom').value = '';
      $('#reportTo').value = '';
      selectedCarrier = '';
      selectedDelayed = false;
      renderRows();
    };

    $('#exportReport').onclick = () => {
      const headers = [
        'Nomor Pengiriman', 'Pelanggan', 'Ekspedisi',
        'Asal', 'Tujuan', 'Tanggal', 'Status'
      ];

      const rows = filtered.map(item => [
        item.shipment_number,
        item.customer?.name,
        item.carrier?.name,
        item.origin?.name,
        item.destination?.name,
        fmt(item.created_at),
        shipmentStatus(item)
      ]);

      const csv = '\uFEFF' + [
        headers.map(escapeCsv).join(','),
        ...rows.map(row => row.map(escapeCsv).join(','))
      ].join('\r\n');

      const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'laporan-cargotrace.csv';
      link.click();
      URL.revokeObjectURL(url);
      showToast('Laporan CSV berhasil disiapkan.');
    };

    $('#reportRows').addEventListener('click', event => {
      const button = event.target.closest('[data-report-detail]');
      if (!button) return;

      const item = shipments.find(
        row => String(row.id) === String(button.dataset.reportDetail)
      );

      if (!item) {
        showToast('Data pengiriman tidak ditemukan.');
        return;
      }

      const fields = [
        ['Nomor Pengiriman', item.shipment_number],
        ['Nama Pelanggan', item.customer?.name],
        ['Email Pelanggan', item.customer?.email],
        ['Perusahaan Ekspedisi', item.carrier?.name],
        ['Asal Pengiriman', item.origin?.name],
        ['Negara Asal', item.origin?.country],
        ['Tujuan Pengiriman', item.destination?.name],
        ['Negara Tujuan', item.destination?.country],
        ['Jenis Kargo', item.cargo_type],
        ['Berat', item.weight_kg != null ? item.weight_kg + ' kg' : null],
        ['Volume', item.volume_m3 != null ? item.volume_m3 + ' m3' : null],
        ['Tanggal Dibuat', item.created_at ? fmt(item.created_at) : null],
        ['Estimasi Keberangkatan', item.expected_departure_at ? fmt(item.expected_departure_at) : null],
        ['Estimasi Tiba', item.estimated_arrival_at ? fmt(item.estimated_arrival_at) : (item.expected_arrival_at ? fmt(item.expected_arrival_at) : null)],
        ['Status Pengiriman', statusLabel(item.status)]
      ];

      const rows = fields.map(([label, value]) => `
        <tr>
          <th style="text-align:left;padding:11px;border-bottom:1px solid rgba(211,174,231,.20);width:38%;color:#d5b8e8">${esc(label)}</th>
          <td style="padding:11px;border-bottom:1px solid rgba(211,174,231,.20);color:#fff5ff">${esc(value ?? '-')}</td>
        </tr>
      `).join('');

      const modal = document.createElement('div');
      modal.id = 'reportDetailModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(10,7,18,.78);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto;';

      modal.innerHTML = `
        <section style="background:linear-gradient(145deg,#281b32,#17111f);color:#f8efff;width:min(760px,100%);max-height:90vh;overflow:auto;border-radius:14px;padding:30px;box-shadow:0 20px 70px #0008;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:2px solid #bd8add;padding-bottom:18px;">
            <div>
              <div style="font-size:12px;font-weight:800;letter-spacing:2px;color:#8952a5;">CARGOTRACE</div>
              <h2 style="margin:8px 0 3px;font-size:23px;">Laporan Detail Pengiriman</h2>
              <div style="font-size:13px;color:#c6b5d2;">Dokumen informasi pengiriman</div>
            </div>
            <span style="background:#543568;color:#f1d8ff;padding:9px 13px;border-radius:8px;font-size:12px;font-weight:800;">${esc(statusLabel(item.status))}</span>
          </div>

          <h3 style="margin:22px 0 5px;font-size:19px;">${esc(item.shipment_number || '-')}</h3>
          <p style="font-size:13px;color:#c6b5d2;margin:0 0 18px;">${esc(item.origin?.name || "-")} - ${esc(item.destination?.name || "-")}</p>

          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tbody>${rows}</tbody>
          </table>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px;">
            <button type="button" id="closeReportDetail" style="padding:11px 18px;border:1px solid #765b83;border-radius:8px;background:#302238;color:#f5eaff;cursor:pointer;">Tutup</button>
            <button type="button" id="printReportDetail" style="padding:11px 18px;border:0;border-radius:8px;background:#8050a0;color:#fff;font-weight:700;cursor:pointer;">Cetak / Simpan PDF</button>
          </div>
        </section>
      `;

      document.body.appendChild(modal);

      const closeModal = () => modal.remove();

      modal.querySelector('#closeReportDetail').onclick = closeModal;

      modal.addEventListener('click', event => {
        if (event.target === modal) closeModal();
      });

      modal.querySelector('#printReportDetail').onclick = () => {
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
          showToast('Izinkan pop-up browser untuk mencetak laporan.');
          return;
        }

        const printRows = fields.map(([label, value]) => `
          <tr>
            <th>${esc(label)}</th>
            <td>${esc(value ?? '-')}</td>
          </tr>
        `).join('');

        const printHtml = `
          <!DOCTYPE html>
          <html lang="id">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Laporan ${esc(item.shipment_number)}</title>
            <style>
              * { box-sizing: border-box; }
              body {
                font-family: Arial, sans-serif;
                color: #202033;
                background: #fff;
                padding: 35px;
                max-width: 850px;
                margin: auto;
              }
              .brand {
                color: #8050a0;
                font-size: 14px;
                font-weight: 800;
                letter-spacing: 3px;
              }
              h1 { font-size: 25px; margin: 12px 0 5px; }
              .subtitle { color: #64748b; font-size: 13px; }
              .shipment {
                margin-top: 28px;
                padding: 17px;
                background: #f5eff9;
                border-left: 4px solid #9868b4;
                border-radius: 6px;
              }
              .shipment strong { font-size: 19px; }
              .shipment p { margin: 7px 0 0; color: #475569; }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 24px;
                font-size: 13px;
              }
              th, td {
                padding: 12px;
                border: 1px solid #e2e8f0;
                text-align: left;
                color: #202033;
                background: #fff;
                overflow-wrap: anywhere;
              }
              th {
                width: 38%;
                background: #f4f0f7;
                color: #59446a;
                font-weight: 700;
              }
              .note {
                margin-top: 25px;
                padding: 14px;
                background: #f5f1f8;
                border-radius: 6px;
                font-size: 12px;
                color: #51445c;
              }
              .footer {
                margin-top: 35px;
                padding-top: 12px;
                border-top: 1px solid #ddd;
                font-size: 11px;
                color: #64748b;
                text-align: center;
              }
              @page { size: A4; margin: 15mm; }
              @media print {
                body { padding: 0; }
                tr { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="brand">CARGOTRACE</div>
            <h1>Laporan Detail Pengiriman</h1>
            <div class="subtitle">Dokumen informasi pengiriman</div>

            <div class="shipment">
              <strong>${esc(item.shipment_number || '-')}</strong>
              <p>${esc(item.origin?.name || "-")} - ${esc(item.destination?.name || "-")}</p>
              <p>Status: ${esc(statusLabel(item.status))}</p>
            </div>

            <table>
              <tbody>${printRows}</tbody>
            </table>

            <div class="footer">
              CargoTrace - Global Shipment Visibility & Tracking Platform
            </div>
          </body>
          </html>
        `;

        printWindow.document.open();
        printWindow.document.write(printHtml);
        printWindow.document.close();

        // Tutup tab cetak setelah pengguna selesai atau membatalkan dialog.
        printWindow.addEventListener('afterprint', () => {
          if (!printWindow.closed) printWindow.close();
          window.focus();
        });

        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 800);
      };
    });

    // Interaksi empat kartu ringkasan
    const reportCards = $('#view').querySelectorAll('.report-kpi');

    const applyReportFilter = (type) => {
      selectedCarrier = '';
      selectedDelayed = false;
      $('#reportStatus').value = '';

      if (type === 'transit') $('#reportStatus').value = 'IN_TRANSIT';
      if (type === 'delivered') $('#reportStatus').value = 'DELIVERED';
      if (type === 'delayed') selectedDelayed = true;

      renderRows();
      $('#reportRows').closest('.table-card').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    };

    ['all', 'transit', 'delivered', 'delayed'].forEach((type, index) => {
      const card = reportCards[index];
      if (!card) return;

      card.style.cursor = 'pointer';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      card.addEventListener('click', () => applyReportFilter(type));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          applyReportFilter(type);
        }
      });
    });

    // Interaksi grafik distribusi status
    const reportPanels = $('#view').querySelectorAll('.report-panel');

    if (reportPanels[0]) {
      reportPanels[0].querySelectorAll('.report-bar-item')
        .forEach((bar, index) => {
          const status = statuses[index]?.[0];
          if (!status) return;

          bar.style.cursor = 'pointer';
          bar.title = 'Klik untuk melihat pengiriman ' + statusLabel(status);

          bar.addEventListener('click', () => {
            selectedCarrier = '';
            selectedDelayed = false;
            $('#reportStatus').value = status;
            renderRows();
            $('#reportRows').closest('.table-card').scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          });
        });
    }

    // Interaksi grafik performa ekspedisi
    if (reportPanels[1]) {
      reportPanels[1].querySelectorAll('.report-bar-item')
        .forEach((bar, index) => {
          const carrierName = carriers[index]?.[0];
          if (!carrierName) return;

          bar.style.cursor = 'pointer';
          bar.title = 'Klik untuk melihat pengiriman ' + carrierName;

          bar.addEventListener('click', () => {
            selectedCarrier = carrierName;
            selectedDelayed = false;
            $('#reportStatus').value = '';
            renderRows();
            $('#reportRows').closest('.table-card').scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          });
        });
    }
    const openExceptionsCard = $('#openExceptionsReport');

    const showOpenExceptions = () => {
      exceptionFilters = {
        q: '',
        type: '',
        severity: '',
        status: 'ACTIVE'
      };
      page = 1;
      go('exceptions');
    };

    openExceptionsCard.addEventListener('click', showOpenExceptions);
    openExceptionsCard.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showOpenExceptions();
      }
    });

    renderRows();
  },  async audit() {
    const result = await api('/audit-logs');
    const logs = result.data || [];

    const today = new Date().toDateString();
    const todayCount = logs.filter(item =>
      new Date(item.created_at).toDateString() === today
    ).length;

    const actions = [...new Set(logs.map(item => item.action).filter(Boolean))];

    const formatDate = value => value
      ? new Date(value).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short'
        })
      : '-';

    const actionLabel = action => String(action || '-')
      .replaceAll('_', ' ')
      .toUpperCase();

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">SYSTEM ACTIVITY</p>
          <h2>Audit Logs</h2>
          <p class="muted">Riwayat aktivitas dan perubahan data dalam sistem CargoTrace.</p>
        </div>
      </section>

      <div class="audit-summary-grid">
        <article class="card audit-summary-card">
          <span class="audit-summary-label">TOTAL AKTIVITAS</span>
          <strong>${result.total ?? logs.length}</strong>
          <span class="muted">Seluruh catatan aktivitas</span>
        </article>
        <article class="card audit-summary-card">
          <span class="audit-summary-label">AKTIVITAS HARI INI</span>
          <strong>${todayCount}</strong>
          <span class="muted">Pada halaman yang dimuat</span>
        </article>
        <article class="card audit-summary-card">
          <span class="audit-summary-label">JENIS AKTIVITAS</span>
          <strong>${actions.length}</strong>
          <span class="muted">Jenis tindakan tercatat</span>
        </article>
      </div>

      <article class="card table-card">
        <div class="section-heading">
          <div>
            <h3>Riwayat Aktivitas</h3>
            <p>Catatan tindakan pengguna dalam sistem.</p>
          </div>
          <span class="status-badge">${logs.length} CATATAN DIMUAT</span>
        </div>

        <div class="audit-filters">
          <input id="auditSearch" type="search" placeholder="Cari pengguna, aktivitas, atau data...">
          <select id="auditActionFilter">
            <option value="">Semua aktivitas</option>
            ${actions.map(action => `
              <option value="${esc(action)}">${esc(actionLabel(action))}</option>
            `).join('')}
          </select>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>WAKTU</th>
                <th>PENGGUNA</th>
                <th>AKTIVITAS</th>
                <th>JENIS DATA</th>
                <th>ID DATA</th>
                <th>DETAIL</th>
              </tr>
            </thead>
            <tbody id="auditRows">
              ${logs.map(item => `
                <tr>
                  <td>${esc(formatDate(item.created_at))}</td>
                  <td>
                    <strong>${esc(item.user?.name || 'Pengguna tidak tersedia')}</strong>
                    <div class="muted">${esc(item.user?.email || '')}</div>
                  </td>
                  <td><span class="audit-action">${esc(actionLabel(item.action))}</span></td>
                  <td>${esc(item.entity_type || '-')}</td>
                  <td>#${esc(item.entity_id)}</td>
                  <td><button type="button" class="btn-secondary audit-detail-btn" data-audit-id="${esc(item.id)}">Detail</button></td>
                </tr>
              `).join('') || '<tr><td colspan="6">Belum ada aktivitas tercatat.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="audit-pagination">
          <span class="muted">Halaman ${result.current_page || 1} dari ${result.last_page || 1}</span>
          <div>
            <button id="auditPrev" ${!result.prev_page_url ? 'disabled' : ''}>Sebelumnya</button>
            <button id="auditNext" ${!result.next_page_url ? 'disabled' : ''}>Berikutnya</button>
          </div>
        </div>
      </article>
    `;

    const applyAuditFilter = () => {
      const keyword = $('#auditSearch').value.toLowerCase().trim();
      const action = $('#auditActionFilter').value;

      $('#auditRows').querySelectorAll('tr').forEach(row => {
        const matchesText = row.textContent.toLowerCase().includes(keyword);
        const matchesAction = !action || row.querySelector('.audit-action')?.textContent === actionLabel(action);
        row.hidden = !(matchesText && matchesAction);
      });
    };

    $('#auditRows').addEventListener('click', event => {
      const button = event.target.closest('.audit-detail-btn');
      if (!button) return;

      const item = logs.find(log => String(log.id) === button.dataset.auditId);
      if (!item) return;

      const modal = document.createElement('div');
      modal.id = 'auditDetailModal';
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(10,12,25,.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';

      const field = (label, value) => `
        <div style="padding:12px 0;border-bottom:1px solid rgba(150,150,180,.2)">
          <div class="muted" style="font-size:12px;margin-bottom:5px">${label}</div>
          <strong style="overflow-wrap:anywhere">${esc(value ?? '-')}</strong>
        </div>`;

      modal.innerHTML = `
        <section class="card" style="width:min(560px,100%);max-height:85vh;overflow:auto;padding:24px;background:var(--card,#211d35);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div>
              <p class="eyebrow">SYSTEM ACTIVITY</p>
              <h3 style="margin:0">Detail Aktivitas</h3>
            </div>
            <button type="button" id="closeAuditDetail">Tutup ×</button>
          </div>
          <div style="margin-top:18px">
            ${field('Waktu aktivitas', formatDate(item.created_at))}
            ${field('Nama pengguna', item.user?.name || 'Pengguna tidak tersedia')}
            ${field('Email pengguna', item.user?.email || '-')}
            ${field('Tindakan', actionLabel(item.action))}
            ${field('Jenis data', item.entity_type || '-')}
            ${field('ID data', item.entity_id ?? '-')}
            ${field('ID aktivitas', item.id)}
          </div>
          <p class="muted" style="font-size:12px;margin-top:16px">
            Detail perubahan sebelum dan sesudah tindakan tidak tersedia pada catatan aktivitas ini.
          </p>
        </section>`;

      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelector('#closeAuditDetail').onclick = close;
      modal.addEventListener('click', event => {
        if (event.target === modal) close();
      });
    });

    $('#auditSearch').oninput = applyAuditFilter;
    $('#auditActionFilter').onchange = applyAuditFilter;

    $('#auditPrev').onclick = () => {
      if (result.prev_page_url) go('audit', result.current_page - 1);
    };

    $('#auditNext').onclick = () => {
      if (result.next_page_url) go('audit', result.current_page + 1);
    };
  },
  async weather() {
    const root = document.createElement('div');
    root.id = 'cargoWeatherRoot';
    $('#view').innerHTML = '';
    $('#view').appendChild(root);

    if (!window.CargoWeather || typeof window.CargoWeather.render !== 'function') {
      root.innerHTML = '<p>Modul cuaca belum berhasil dimuat.</p>';
      return;
    }

    await window.CargoWeather.render(root);
  },
  async news() {
    const categories = {
      semua: 'Semua Berita',
      logistik: 'Logistik',
      transportasi: 'Transportasi',
      ekonomi: 'Ekonomi',
      nasional: 'Nasional',
      dunia: 'Dunia',
      teknologi: 'Teknologi'
    };

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">INFORMASI EKSTERNAL</p>
          <h2>Berita Dunia</h2>
          <p class="muted">Informasi terbaru seputar logistik, transportasi, dan perdagangan internasional.</p>
        </div>
      </section>

      <article class="card" style="padding:22px;margin-bottom:20px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
          <div style="flex:1;min-width:220px">
            <label for="newsCategory">Kategori berita</label>
            <select id="newsCategory" class="form-control" style="width:100%;padding:12px;border:1px solid #dbe3ed;border-radius:9px;margin-top:8px">
              ${Object.entries(categories).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </div>
          <div style="flex:2;min-width:220px">
            <label for="newsSearch">Cari berita</label>
            <input id="newsSearch" type="text" class="form-control" placeholder="Masukkan kata kunci berita..." style="width:100%;padding:12px;border:1px solid #dbe3ed;border-radius:9px;margin-top:8px">
          </div>
          <button class="btn btn-primary" id="newsRefresh" type="button">Perbarui Berita</button>
        </div>
      </article>

      <div id="newsInfo" class="card" style="padding:16px;margin-bottom:18px">
        <p class="muted">Memuat berita terbaru...</p>
      </div>
      <div id="newsList" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px">
        <article class="card" style="padding:22px">Memuat berita...</article>
      </div>`;

    let articles = [];

    const renderNews = () => {
      const keyword = $('#newsSearch').value.trim().toLowerCase();

      const filtered = articles.filter(item =>
        `${item.title || ''} ${item.description || ''} ${item.author || ''}`
          .toLowerCase().includes(keyword)
      );

      if (!filtered.length) {
        $('#newsList').innerHTML = `
          <article class="card" style="padding:28px;grid-column:1/-1">
            <h3>Berita tidak ditemukan</h3>
            <p class="muted">Coba kata kunci pencarian lainnya.</p>
          </article>`;
        return;
      }

      $('#newsList').innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px">
          ${filtered.map(item => {
            const link = typeof item.link === 'string' && /^https?:\/\//i.test(item.link)
              ? item.link : '';

            const title = esc(item.title || 'Tanpa judul');
            const source = esc(item.author || item.source || 'Sumber berita');

            const description = esc(
              (item.description || 'Baca informasi selengkapnya dari sumber berita.')
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .slice(0, 180)
            );

            const imageUrl = item.thumbnail || '';
            const image = /^https?:\/\//i.test(imageUrl) ? imageUrl : '';

            const date = item.pubDate && !Number.isNaN(new Date(item.pubDate).getTime())
              ? new Date(item.pubDate).toLocaleDateString('id-ID', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })
              : 'Tanggal tidak tersedia';

            return `
              <article class="card" style="overflow:hidden;display:flex;flex-direction:column;min-width:0">
                <div style="height:180px;background:linear-gradient(135deg,#382449,#172e4d);overflow:hidden">
                  ${image
                    ? `<img src="${esc(image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`
                    : `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#d9b5ed;font-size:25px;font-weight:800;letter-spacing:3px">CARGOTRACE</div>`
                  }
                </div>
                <div style="padding:19px;display:flex;flex-direction:column;gap:11px;flex:1">
                  <p class="eyebrow" style="margin:0">${source}</p>
                  <h3 style="font-size:17px;line-height:1.5;margin:0">${title}</h3>
                  <p class="muted" style="font-size:12px;margin:0">${date}</p>
                  <p style="font-size:13px;line-height:1.7;opacity:.8;margin:0">${description}</p>
                  ${link
                    ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="text-align:center;text-decoration:none;margin-top:auto">Baca Berita Lengkap</a>`
                    : `<span class="muted" style="font-size:12px;margin-top:auto">Tautan tidak tersedia</span>`
                  }
                </div>
              </article>`;
          }).join('')}
        </div>`;
    };    const loadNews = async () => {
      const category = $('#newsCategory').value;

      $('#newsInfo').innerHTML =
        '<p class="muted">Sedang mengambil berita terbaru...</p>';
      $('#newsList').innerHTML =
        '<article class="card" style="padding:22px">Memuat berita...</article>';

      const refreshButton = $('#newsRefresh');
      refreshButton.disabled = true;
      refreshButton.textContent = 'Memuat...';

      try {
        const data = await api('/news?category=' + encodeURIComponent(category) + '&limit=40');

        if (!data || !Array.isArray(data.items)) {
          throw new Error('Format data berita dari server tidak valid.');
        }

        articles = data.items.map(item => ({
          title: item.title || 'Tanpa judul',
          description: item.summary || '',
          author: item.source || 'Sumber berita',
          source: item.source || 'Sumber berita',
          link: item.link || '',
          thumbnail: item.image || '',
          pubDate: item.published_at || ''
        }));

        $('#newsInfo').innerHTML = `
          <p class="eyebrow">BERITA TERBARU</p>
          <strong>${articles.length} berita ditemukan</strong>
          <p class="muted" style="font-size:12px;margin-top:5px">
            Kategori: ${esc(category)} | Sumber: Google News melalui CargoTrace
          </p>`;

        renderNews();

      } catch (error) {
        articles = [];

        $('#newsInfo').innerHTML = `
          <p style="color:#dc3545">${esc(error.message)}</p>
          <p class="muted">Server belum berhasil mengambil berita. Silakan coba kembali.</p>`;

        $('#newsList').innerHTML = `
          <article class="card" style="padding:24px;grid-column:1/-1">
            Berita belum dapat dimuat.
          </article>`;
      } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Perbarui Berita';
      }
    };
    $('#newsCategory').onchange = loadNews;
    $('#newsSearch').oninput = renderNews;
    $('#newsRefresh').onclick = loadNews;
    await loadNews();
  },
  async currency() {
    const currencies = [
      ['IDR', 'Rupiah Indonesia'],
      ['USD', 'Dolar Amerika'],
      ['EUR', 'Euro'],
      ['SGD', 'Dolar Singapura'],
      ['JPY', 'Yen Jepang'],
      ['GBP', 'Poundsterling'],
      ['AUD', 'Dolar Australia'],
      ['MYR', 'Ringgit Malaysia'],
      ['CNY', 'Yuan China'],
      ['THB', 'Baht Thailand'],
      ['KRW', 'Won Korea']
    ];

    $('#view').innerHTML = `
      <section class="welcome-row">
        <div>
          <p class="eyebrow">INFORMASI EKSTERNAL</p>
          <h2>Kurs Mata Uang</h2>
          <p class="muted">Pantau dan konversi nilai tukar mata uang internasional.</p>
        </div>
      </section>

      <article class="card" style="padding:24px;margin-bottom:20px">
        <p class="eyebrow">KONVERSI MATA UANG</p>
        <h3 style="margin:8px 0 16px">Konversi mata uang</h3>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px">
          <div>
            <label for="currencyAmount">Jumlah</label>
            <input id="currencyAmount" type="number" min="0" step="any" value="100000"
              class="form-control" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #dbe3ed;border-radius:9px;margin-top:7px">
          </div>
          <div>
            <label for="currencyFrom">Dari mata uang</label>
            <select id="currencyFrom" class="form-control"
              style="width:100%;padding:12px;border:1px solid #dbe3ed;border-radius:9px;margin-top:7px">
              ${currencies.map(([code, name]) => `<option value="${code}" ${code === 'IDR' ? 'selected' : ''}>${code} - ${name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label for="currencyTo">Ke mata uang</label>
            <select id="currencyTo" class="form-control"
              style="width:100%;padding:12px;border:1px solid #dbe3ed;border-radius:9px;margin-top:7px">
              ${currencies.map(([code, name]) => `<option value="${code}" ${code === 'USD' ? 'selected' : ''}>${code} - ${name}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px">
          <button class="btn btn-primary" id="currencyConvert" type="button">Konversi Sekarang</button>
          <button class="btn btn-primary" id="currencySwap" type="button">Tukar Mata Uang</button>
          <button class="btn" id="currencyRefresh" type="button">Perbarui Kurs</button>
        </div>
      </article>

      <article class="card" id="currencyInfo" style="padding:24px;margin-bottom:20px">
        <p class="muted">Menyiapkan data kurs...</p>
      </article>

      <article class="card" style="padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px">
          <div>
            <h3>Daftar nilai tukar</h3>
            <p class="muted">Nilai tukar berdasarkan data referensi terbaru yang tersedia.</p>
          </div>
          <span class="badge">Kurs Internasional</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Kode</th><th>Nama mata uang</th><th>Nilai terhadap IDR</th></tr>
            </thead>
            <tbody id="currencyRows">
              <tr><td colspan="3">Memuat data kurs...</td></tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="card" style="padding:24px;margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h3>Riwayat Konversi</h3>
            <p class="muted">Daftar hasil konversi yang pernah dilakukan.</p>
          </div>
          <button class="btn" id="currencyHistoryClear" type="button">Hapus Riwayat</button>
        </div>
        <div class="table-wrap" style="margin-top:16px">
          <table>
            <thead><tr><th>Tanggal</th><th>Jumlah Awal</th><th>Hasil Konversi</th></tr></thead>
            <tbody id="currencyHistoryRows">
              <tr><td colspan="3">Belum ada riwayat konversi.</td></tr>
            </tbody>
          </table>
        </div>
      </article>`;

    let rates = { IDR: 1 };
    let rateDate = '';

    const formatNumber = (value, digits = 4) =>
      Number(value).toLocaleString('id-ID', { maximumFractionDigits: digits });

    const renderConversion = () => {
      const amount = Number($('#currencyAmount').value);
      const from = $('#currencyFrom').value;
      const to = $('#currencyTo').value;

      if (!Number.isFinite(amount) || amount < 0) {
        $('#currencyInfo').innerHTML = '<p style="color:#dc3545">Masukkan jumlah uang yang valid.</p>';
        return;
      }

      if (!rates[from] || !rates[to]) {
        $('#currencyInfo').innerHTML = '<p class="muted">Kurs belum tersedia. Silakan perbarui data kurs.</p>';
        return;
      }

      const result = amount / rates[from] * rates[to];

      $('#currencyInfo').innerHTML = `
        <p class="eyebrow">HASIL KONVERSI</p>
        <h2 style="font-size:28px;color:#f8fafc;margin:8px 0">
          ${formatNumber(result, 6)} ${to}
        </h2>
        <p class="muted">${formatNumber(amount, 6)} ${from} = ${formatNumber(result, 6)} ${to}</p>
        <p class="muted" style="font-size:12px;margin-top:10px">
          Tanggal data kurs: ${esc(rateDate || "Belum tersedia")} | Sumber: Frankfurter API
        </p>`;
    };

    let conversionHistory = [];
    try {
      conversionHistory = JSON.parse(localStorage.getItem('ct_currency_history') || '[]');
      if (!Array.isArray(conversionHistory)) conversionHistory = [];
    } catch (error) {
      conversionHistory = [];
    }

    const renderHistory = () => {
      const target = $('#currencyHistoryRows');
      if (!target) return;

      target.innerHTML = conversionHistory.length
        ? conversionHistory.map(item => `
            <tr>
              <td>${esc(new Date(item.date).toLocaleString('id-ID'))}</td>
              <td>${formatNumber(item.amount, 6)} ${esc(item.from)}</td>
              <td><strong>${formatNumber(item.result, 6)} ${esc(item.to)}</strong></td>
            </tr>
          `).join('')
        : '<tr><td colspan="3">Belum ada riwayat konversi.</td></tr>';
    };

    const saveConversion = () => {
      const amount = Number($('#currencyAmount').value);
      const from = $('#currencyFrom').value;
      const to = $('#currencyTo').value;

      if (!Number.isFinite(amount) || amount <= 0 || !rates[from] || !rates[to]) {
        renderConversion();
        return;
      }

      const result = amount / rates[from] * rates[to];

      conversionHistory.unshift({
        date: new Date().toISOString(),
        amount,
        from,
        to,
        result
      });

      conversionHistory = conversionHistory.slice(0, 50);
      localStorage.setItem('ct_currency_history', JSON.stringify(conversionHistory));
      renderConversion();
      renderHistory();
    };
    const renderTable = () => {
      $('#currencyRows').innerHTML = currencies.map(([code, name]) => `
        <tr>
          <td><strong>${code}</strong></td>
          <td>${name}</td>
          <td>${code === 'IDR' ? '1' : rates[code] ? formatNumber(1 / rates[code], 8) + ' IDR' : 'Tidak tersedia'}</td>
        </tr>
      `).join('');
    };

    const loadCurrency = async () => {
      const refreshButton = $('#currencyRefresh');
      refreshButton.disabled = true;
      refreshButton.textContent = 'Memperbarui...';

      $('#currencyInfo').innerHTML = '<p class="muted">Sedang mengambil data kurs terbaru...</p>';
      $('#currencyRows').innerHTML = '<tr><td colspan="3">Memuat data kurs...</td></tr>';

      try {
        const quotes = currencies.filter(([code]) => code !== 'IDR').map(([code]) => code).join(',');
        const response = await fetch(
          `https://api.frankfurter.dev/v2/rates?base=IDR&quotes=${quotes}`
        );

        if (!response.ok) throw new Error('Server kurs tidak dapat dihubungi.');

        const data = await response.json();
        const newRates = { IDR: 1 };

        data.forEach(item => {
          newRates[item.quote] = item.rate;
        });

        if (Object.keys(newRates).length < 3) {
          throw new Error('Data kurs yang diterima tidak lengkap.');
        }

        rates = newRates;
        rateDate = data[0]?.date || '';

        renderTable();
        renderConversion();
      } catch (error) {
        $('#currencyInfo').innerHTML = `
          <p style="color:#dc3545">Gagal mengambil data kurs.</p>
          <p class="muted">${esc(error.message)}</p>
          <p class="muted">Periksa koneksi internet, kemudian tekan Perbarui Kurs.</p>`;
        $('#currencyRows').innerHTML = '<tr><td colspan="3">Data kurs belum tersedia.</td></tr>';
      } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Perbarui Kurs';
      }
    };

    $('#currencyConvert').onclick = saveConversion;

    $('#currencySwap').onclick = () => {
      const from = $('#currencyFrom');
      const to = $('#currencyTo');
      const previous = from.value;
      from.value = to.value;
      to.value = previous;
      renderConversion();
    };

    $('#currencyHistoryClear').onclick = () => {
      if (!conversionHistory.length) return;
      if (!confirm('Hapus seluruh riwayat konversi?')) return;
      conversionHistory = [];
      localStorage.removeItem('ct_currency_history');
      renderHistory();
    };

    renderHistory();
    $('#currencyRefresh').onclick = loadCurrency;
    $('#currencyAmount').oninput = renderConversion;
    $('#currencyFrom').onchange = renderConversion;
    $('#currencyTo').onchange = renderConversion;

    await loadCurrency();
  },
  async worldclock() {
    if (!window.CargoClock || typeof window.CargoClock.render !== 'function') {
      throw new Error('Komponen Jam Dunia belum berhasil dimuat.');
    }

    const root = document.createElement('section');
    root.id = 'cargotrace-worldclock';
    $('#view').innerHTML = '';
    $('#view').appendChild(root);
    window.CargoClock.render(root);
  },
  async notifications() {
    if (!window.CargoNotif || typeof window.CargoNotif.render !== 'function') {
      throw new Error('Modul Notifikasi belum berhasil dimuat.');
    }

    const root = document.createElement('div');
    root.id = 'cargoNotificationsRoot';
    $('#view').innerHTML = '';
    $('#view').appendChild(root);
    window.CargoNotif.render(root);
  },
  async carriers() {
    const carriers = await api('/carriers');
    $('#view').innerHTML = `
      <section class="welcome-row"><div><p class="eyebrow">PARTNERS</p><h2>Perusahaan ekspedisi</h2>
      <p class="muted">Daftar penyedia layanan logistik yang terhubung.</p></div></section>
      <article class="card table-card"><div class="table-wrap"><table>
        <thead><tr><th>Nama perusahaan</th><th>Moda transportasi</th><th>Kontak</th></tr></thead>
        <tbody>${carriers.map((carrier) => `<tr><td><strong>${esc(carrier.name)}</strong></td><td>${esc(carrier.mode)}</td><td>${esc(carrier.contact)}</td></tr>`).join('') || '<tr><td colspan="3">Belum ada data ekspedisi.</td></tr>'}</tbody>
      </table></div></article>`;
  }
};

$('#out').onclick = () => {
  api('/logout', { method: 'POST' }).catch(() => {});
  logout();
};

show();



































