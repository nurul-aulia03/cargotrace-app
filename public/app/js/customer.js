(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tok = () => { try { return sessionStorage.getItem('ct_token') || localStorage.getItem('ct_token') || localStorage.getItem('token') || ''; } catch (e) { return ''; } };
  async function api(p) {
    const r = await fetch('/api' + p, {headers: {Accept: 'application/json', Authorization: 'Bearer ' + tok()}});
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const er = new Error((j && j.message) || 'Permintaan gagal (' + r.status + ')'); er.status = r.status; throw er; }
    return j;
  }
  const FLOW = ['CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
  const LBL = {CREATED: 'Dibuat', BOOKED: 'Dipesan', PICKED_UP: 'Dijemput', IN_TRANSIT: 'Dalam perjalanan', DELIVERED: 'Terkirim', EXCEPTION: 'Kendala', NOTE: 'Catatan'};
  const SEVL = {LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi'};
  const fmt = t => t ? new Date(t).toLocaleString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '-';
  const fmtD = t => t ? new Date(t).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'}) : '-';
  const ago = t => { const m = Math.round((Date.now() - new Date(t)) / 6e4); return isNaN(m) ? '' : m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu'; };
  const dstat = s => s.status !== 'DELIVERED' && s.delay && s.delay.delayed ? 'DELAYED' : s.status;
  const SL = {DELAYED: 'Terlambat', CREATED: 'Dibuat', BOOKED: 'Dipesan', PICKED_UP: 'Dijemput', IN_TRANSIT: 'Dalam perjalanan', DELIVERED: 'Terkirim'};
  const badge = s => `<span class="cu-bd ${esc(s)}">${esc(SL[s] || s)}</span>`;
  const pct = st => Math.max(0, FLOW.indexOf(st)) / (FLOW.length - 1) * 100;
  const IP = {
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>', box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    truck: '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>', check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>', back: '<path d="m15 18-6-6 6-6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    right: '<path d="m9 18 6-6-6-6"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/>'
  };
  const ic = n => `<svg class="cu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IP[n] || ''}</svg>`;
  const me = () => { try { return JSON.parse(sessionStorage.getItem('ct_user') || 'null'); } catch (e) { return null; } };

  function stepper(s) {
    const i = FLOW.indexOf(s.status), ev = s.events || [];
    return `<div class="cu-stp">${FLOW.map((f, k) => { const e = ev.find(x => x.event_type === f); return `<div class="cu-s ${k < i || s.status === 'DELIVERED' ? 'done' : k === i ? 'cur' : ''}"><i>${k < i || s.status === 'DELIVERED' ? ic('check') : k + 1}</i><b>${LBL[f]}</b><small>${e ? fmt(e.occurred_at) : 'Belum'}</small></div>`; }).join('')}</div>`;
  }
  function row(s, go) {
    const d = s.delay || {};
    return `<div class="cu-row" data-id="${s.id}" tabindex="0" role="button"><div class="cu-r1"><b>${esc(s.shipment_number)}</b><small>${esc(s.origin && s.origin.name)} <span>to</span> ${esc(s.destination && s.destination.name)}</small></div>
    <div class="cu-r2"><div class="cu-pb"><div style="width:${pct(s.status)}%"></div></div><small>${esc(s.carrier && s.carrier.name)} · ${esc(s.cargo_type)}</small></div>
    <div class="cu-r3"><small>Estimasi tiba</small><b>${fmtD(s.estimated_arrival_at)}</b>${d.delayed && s.status !== 'DELIVERED' ? `<em>+${d.hours} jam</em>` : ''}</div><div>${badge(dstat(s))}</div><div class="cu-go">${ic('right')}</div></div>`;
  }

  let map = null;
  function leaflet() {
    return new Promise(res => {
      if (typeof L !== 'undefined') return res(true);
      const c = document.createElement('link'); c.rel = 'stylesheet'; c.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'; document.head.appendChild(c);
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
    });
  }
  function drop() { if (map) { try { map.remove(); } catch (e) {} map = null; } }

  function mount(el, kind, arg) {
    drop(); el.classList.add('cu'); el.dataset.cu = '1';
    const user = me() || {};
    const state = {q: '', status: '', page: 1, sort: 'created_at-desc'};
    let seq = 0;
    const nav = (k, a) => { kind = k; arg = a; run(); };
    const err = e => { el.innerHTML = `<div class="cu-card cu-er"><b>${e.status === 401 ? 'Sesi berakhir' : 'Data tidak dapat dimuat'}</b><p>${esc(e.message)}${e.status === 401 ? ' Silakan login ulang.' : ' Periksa koneksi lalu coba lagi.'}</p><button class="cu-btn" id="cu-retry">Coba lagi</button></div>`; el.querySelector('#cu-retry').onclick = run; };

    async function dashboard() {
      const [d, l, att] = await Promise.all([api('/dashboard'), api('/shipments?per_page=5&sort=created_at&dir=desc'), api('/shipments?per_page=5&delayed=1')]);
      const active = l.data.filter(s => s.status !== 'DELIVERED').slice(0, 4);
      const det = await Promise.all(active.map(s => api('/shipments/' + s.id).catch(() => null)));
      const exc = []; det.forEach((x, i) => x && (x.exceptions || []).filter(e => e.status !== 'RESOLVED').forEach(e => exc.push({s: active[i], e})));
      const k = (i, t, v, c) => `<div class="cu-kpi ${c}"><span>${ic(i)}</span><div><small>${t}</small><b>${v}</b></div></div>`;
      const bs = d.by_status || {}, tot = Object.values(bs).reduce((a, b) => a + b, 0) || 1;
      const alerts = att.data.map(s => `<div class="cu-al hi" data-id="${s.id}" tabindex="0" role="button">${ic('clock')}<div><b>${esc(s.shipment_number)} terlambat ${s.delay.hours} jam</b><small>Tingkat ${SEVL[s.delay.severity] || ''} · ETA ${fmt(s.estimated_arrival_at)}</small></div></div>`).join('') +
        exc.map(x => `<div class="cu-al md" data-id="${x.s.id}" tabindex="0" role="button">${ic('alert')}<div><b>${esc(String(x.e.type).replace(/_/g, ' '))}</b><small>${esc(x.s.shipment_number)} · ${esc(x.e.status)}</small></div></div>`).join('');
      el.innerHTML = `<div class="cu-head"><div><div class="cu-eb">Portal Pelanggan</div><h2>Halo, ${esc(user.name || 'Pelanggan')}</h2><p>Berikut ringkasan pengiriman Anda hari ini.</p></div>
        <form class="cu-qt" id="cu-qt"><label>${ic('search')}<input id="cu-qi" placeholder="Lacak nomor pengiriman..." aria-label="Lacak nomor pengiriman"></label><button class="cu-btn p">Lacak</button></form></div>
      <div class="cu-kpis">${k('box', 'Total Pengiriman', d.total, 'a') + k('truck', 'Dalam Perjalanan', d.in_transit, 'b') + k('check', 'Terkirim', d.delivered, 'c') + k('clock', 'Terlambat', d.delayed, 'd')}</div>
      <div class="cu-grid"><div class="cu-card"><div class="cu-ch"><h3>Pengiriman Terbaru</h3><button class="cu-lk" data-nav="list">Lihat semua</button></div>${l.data.map(s => row(s)).join('') || '<p class="cu-mut">Belum ada pengiriman.</p>'}</div>
      <div><div class="cu-card"><h3>Perlu Perhatian</h3>${alerts || `<div class="cu-ok">${ic('check')}<span>Tidak ada keterlambatan atau kendala. Semua pengiriman berjalan sesuai jadwal.</span></div>`}</div>
      <div class="cu-card"><h3>Status Pengiriman</h3><div class="cu-seg">${FLOW.map(f => bs[f] ? `<i class="${f}" style="width:${bs[f] / tot * 100}%" title="${LBL[f]}: ${bs[f]}"></i>` : '').join('')}</div><div class="cu-lg">${FLOW.map(f => `<span><i class="${f}"></i>${LBL[f]}<b>${bs[f] || 0}</b></span>`).join('')}</div></div></div></div>`;
      el.querySelector('#cu-qt').onsubmit = async ev => { ev.preventDefault(); const v = el.querySelector('#cu-qi').value.trim(); if (!v) return; try { const r = await api('/shipments?per_page=1&q=' + encodeURIComponent(v)); if (r.data.length) nav('detail', r.data[0].id); else el.querySelector('#cu-qi').setCustomValidity('x'), el.querySelector('#cu-qi').placeholder = 'Nomor tidak ditemukan', el.querySelector('#cu-qi').value = ''; } catch (e) { err(e); } };
    }

    async function list() {
      const [sk, sd] = state.sort.split('-'), p = new URLSearchParams({page: state.page, per_page: 8, sort: sk, dir: sd});
      if (state.q) p.set('q', state.q); if (state.status) p.set('status', state.status);
      const my = ++seq, l = await api('/shipments?' + p); if (my !== seq) return;
      el.innerHTML = `<div class="cu-head"><div><div class="cu-eb">Pengiriman Saya</div><h2>Daftar Pengiriman</h2><p>Pantau status, estimasi tiba, dan riwayat perjalanan setiap pengiriman Anda.</p></div></div>
      <div class="cu-card"><div class="cu-tb"><label class="cu-sr">${ic('search')}<input id="cu-q" placeholder="Cari nomor pengiriman..." value="${esc(state.q)}"></label>
      <select id="cu-st" aria-label="Status"><option value="">Semua status</option>${FLOW.map(f => `<option value="${f}" ${state.status === f ? 'selected' : ''}>${LBL[f]}</option>`).join('')}</select>
      <select id="cu-so" aria-label="Urutkan"><option value="created_at-desc">Terbaru</option><option value="created_at-asc">Terlama</option><option value="estimated_arrival_at-asc">ETA terdekat</option><option value="shipment_number-asc">Nomor A-Z</option></select></div>
      <div id="cu-ls">${l.data.map(s => row(s)).join('') || '<div class="cu-empty">' + ic('box') + '<b>Tidak ada pengiriman</b><p>Coba ubah kata kunci atau filter.</p></div>'}</div>
      <div class="cu-pg"><span>${l.total} pengiriman · halaman ${l.current_page} dari ${l.last_page}</span><button class="cu-btn" id="cu-pp" ${l.current_page <= 1 ? 'disabled' : ''}>Sebelumnya</button><button class="cu-btn" id="cu-pn" ${l.current_page >= l.last_page ? 'disabled' : ''}>Berikutnya</button></div></div>`;
      el.querySelector('#cu-so').value = state.sort;
      let t; el.querySelector('#cu-q').oninput = e => { clearTimeout(t); const v = e.target.value; t = setTimeout(async () => { state.q = v.trim(); state.page = 1; await list(); const i = el.querySelector('#cu-q'); i.focus(); i.setSelectionRange(v.length, v.length); }, 350); };
      el.querySelector('#cu-st').onchange = e => { state.status = e.target.value; state.page = 1; list(); };
      el.querySelector('#cu-so').onchange = e => { state.sort = e.target.value; state.page = 1; list(); };
      el.querySelector('#cu-pp').onclick = () => { state.page--; list(); }; el.querySelector('#cu-pn').onclick = () => { state.page++; list(); };
    }

    async function detail() {
      const s = await api('/shipments/' + arg), E = s.events || [], X = s.exceptions || [], d = s.delay || {}, last = [...E].reverse().find(e => e.latitude != null);
      const late = s.status !== 'DELIVERED' && d.delayed;
      const o = s.order && typeof s.order === 'object' ? s.order : null;
      const OL = [['nama_barang', 'Nama barang'], ['jumlah', 'Jumlah'], ['nama_pengirim', 'Nama pengirim'], ['telepon_pengirim', 'Telepon pengirim'], ['alamat_pengirim', 'Alamat pengirim'], ['nama_penerima', 'Nama penerima'], ['telepon_penerima', 'Telepon penerima'], ['alamat_penerima', 'Alamat penerima'], ['metode_pembayaran', 'Metode pembayaran'], ['status_pembayaran', 'Status pembayaran'], ['biaya_pengiriman', 'Biaya pengiriman'], ['total_pembayaran', 'Total pembayaran']].filter(x => o && o[x[0]] != null && String(o[x[0]]).trim() !== '' && o[x[0]] !== '-');
      const kv = (l, v) => `<div class="cu-kv"><small>${l}</small><b>${v}</b></div>`;
      el.innerHTML = `<div class="cu-head"><div><button class="cu-lk back" id="cu-bk">${ic('back')}Kembali ke daftar</button><div class="cu-eb">Detail Pengiriman</div><h2>${esc(s.shipment_number)}</h2><p class="cu-rt">${ic('pin')}${esc(s.origin.name)} <span>to</span> ${esc(s.destination.name)}</p></div>
        <div class="cu-ha">${badge(dstat(s))}<button class="cu-btn" id="cu-cp">${ic('copy')}Salin nomor</button><button class="cu-btn" onclick="window.print()">${ic('print')}Cetak</button></div></div>
      <div class="cu-card"><div class="cu-eta ${late ? 'late' : 'ok'}"><div>${ic(late ? 'alert' : 'check')}<b>${s.status === 'DELIVERED' ? 'Pengiriman telah diterima' : late ? `Terlambat ${d.hours} jam dari jadwal` : 'Berjalan sesuai jadwal'}</b></div>
        <span>Jadwal tiba <b>${fmt(s.expected_arrival_at)}</b> · ETA terbaru <b>${fmt(s.estimated_arrival_at)}</b></span></div>
        ${late ? `<p class="cu-why">Alasan: ETA melewati jadwal dengan ambang ${d.threshold_hours} jam. Tingkat keterlambatan <b>${SEVL[d.severity] || '-'}</b>.</p>` : ''}${stepper(s)}</div>
      <div class="cu-grid2"><div class="cu-card"><h3>Peta Rute</h3><p class="cu-mut">Titik asal, tujuan, dan lokasi pelacakan.</p><div id="cu-map" class="cu-map"></div></div>
      <div class="cu-card"><h3>Riwayat Perjalanan</h3><p class="cu-mut">Lokasi terakhir: ${esc(last && last.location ? last.location.name : (last ? 'Titik pelacakan' : '-'))}</p><ul class="cu-tl">${[...E].reverse().map(e => `<li class="${e.is_exception ? 'ex' : ''}"><b>${esc(LBL[e.event_type] || e.event_type)}</b><span>${esc(e.description || '')}${e.location && e.location.name ? ' · ' + esc(e.location.name) : ''}</span><small>${fmt(e.occurred_at)} · ${ago(e.occurred_at)}</small></li>`).join('') || '<li><span>Belum ada event.</span></li>'}</ul></div></div>
      <div class="cu-grid3"><div class="cu-card"><h3>Informasi Pengiriman</h3><div class="cu-kvs">${kv('Ekspedisi', esc(s.carrier && s.carrier.name))}${kv('Jenis kargo', esc(s.cargo_type))}${kv('Berat', esc(s.weight_kg) + ' kg')}${s.volume_m3 ? kv('Volume', esc(s.volume_m3) + ' m3') : ''}${kv('Jadwal berangkat', fmt(s.expected_departure_at))}${kv('Jadwal tiba', fmt(s.expected_arrival_at))}</div></div>
      <div class="cu-card"><h3>Informasi Pesanan</h3>${OL.length ? `<div class="cu-kvs">${OL.map(x => kv(x[1], esc(o[x[0]]))).join('')}</div>` : '<p class="cu-mut">Data pesanan belum tersambung ke pengiriman ini. Rincian pengirim, penerima, dan pembayaran akan tampil di sini setelah tersedia.</p>'}</div>
      <div class="cu-card"><h3>Kendala Pengiriman</h3>${X.length ? X.map(x => `<div class="cu-ex ${x.status === 'RESOLVED' ? 'ok' : ''}"><b>${esc(String(x.type).replace(/_/g, ' '))}</b><small>Tingkat ${SEVL[x.severity] || x.severity} · ${x.status === 'RESOLVED' ? 'Selesai ' + fmt(x.resolved_at) : 'Sedang ditangani'} · terdeteksi ${fmt(x.detected_at)}</small></div>`).join('') : `<div class="cu-ok">${ic('check')}<span>Tidak ada kendala pada pengiriman ini.</span></div>`}</div></div>`;
      el.querySelector('#cu-bk').onclick = () => nav('list');
      el.querySelector('#cu-cp').onclick = e => { (navigator.clipboard ? navigator.clipboard.writeText(s.shipment_number) : Promise.reject()).then(() => { e.target.closest('button').lastChild.textContent = 'Tersalin'; }, () => {}); };
      const ok = await leaflet(), box = el.querySelector('#cu-map');
      if (!ok || !box) { if (box) box.innerHTML = '<div class="cu-mut" style="padding:20px">Peta membutuhkan koneksi internet.</div>'; return; }
      map = L.map(box, {
        minZoom: 2,
        maxZoom: 19,
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
        touchZoom: true,
        keyboard: true
      }).setView([20, 0], 2);

      const baseMap = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          minZoom: 2,
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      ).addTo(map);

      baseMap.on('tileerror', () => {
        console.warn('CargoTrace: tile peta gagal dimuat.');
      });
      const validPoint = (lat, lng) =>
        lat !== null && lat !== undefined &&
        lng !== null && lng !== undefined &&
        Number.isFinite(Number(lat)) &&
        Number.isFinite(Number(lng)) &&
        Math.abs(Number(lat)) <= 90 &&
        Math.abs(Number(lng)) <= 180;

      const pts = [];
      const O = [Number(s.origin.latitude), Number(s.origin.longitude)];
      const D = [Number(s.destination.latitude), Number(s.destination.longitude)];

      const originValid = validPoint(s.origin.latitude, s.origin.longitude);
      const destinationValid = validPoint(s.destination.latitude, s.destination.longitude);

      const events = E.filter(e => validPoint(e.latitude, e.longitude));
      const routePoints = [
        ...(originValid ? [O] : []),
        ...events.map(e => [Number(e.latitude), Number(e.longitude)]),
        ...(destinationValid ? [D] : [])
      ];

      L.control.scale({
        metric: true,
        imperial: false,
        position: 'bottomleft'
      }).addTo(map);

      const marker = (position, color, title, description) => {
        const point = L.circleMarker(position, {
          radius: 9,
          color: '#ffffff',
          weight: 2,
          fillColor: color,
          fillOpacity: 1
        }).addTo(map);

        point.bindTooltip(title, {
          direction: 'top',
          offset: [0, -8]
        });

        point.bindPopup(description);
        return point;
      };

      if (routePoints.length >= 2) {
        L.polyline(routePoints, {
          color: '#b48af0',
          weight: 4,
          opacity: 0.95,
          dashArray: '8 7'
        }).addTo(map);
      }

      if (originValid) {
        pts.push(O);
        marker(
          O,
          '#22c55e',
          'Lokasi asal',
          `<div class="cu-map-popup"><b>LOKASI ASAL</b><h4>${esc(s.origin.name || '-')}</h4><small>${O[0].toFixed(5)}, ${O[1].toFixed(5)}</small></div>`
        );
      }

      events.forEach((e, index) => {
        const ll = [Number(e.latitude), Number(e.longitude)];
        pts.push(ll);

        const eventName = LBL[e.event_type] || e.event_type || 'Tracking';
        const locationName = e.location?.name || 'Lokasi tracking';

        marker(
          ll,
          e === last ? '#b48af0' : '#60a5fa',
          locationName,
          `<div class="cu-map-popup"><b>RIWAYAT PERJALANAN ${index + 1}</b><h4>${esc(locationName)}</h4><p>${esc(eventName)}</p><small>${fmt(e.occurred_at)}</small><br><small>${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}</small></div>`
        );
      });

      if (destinationValid) {
        pts.push(D);
        marker(
          D,
          '#f87171',
          'Lokasi tujuan',
          `<div class="cu-map-popup"><b>LOKASI TUJUAN</b><h4>${esc(s.destination.name || '-')}</h4><small>${D[0].toFixed(5)}, ${D[1].toFixed(5)}</small></div>`
        );
      }

      if (pts.length > 1) {
        map.fitBounds(pts, {
          padding: [45, 45],
          maxZoom: 6
        });
      } else if (pts.length === 1) {
        map.setView(pts[0], 10);
      }
    }

    async function run() {
      drop(); el.innerHTML = '<div class="cu-card cu-ld">Memuat...</div>';
      try { await (kind === 'detail' && arg ? detail() : kind === 'list' ? list() : dashboard()); } catch (e) { err(e); return; }
      el.onclick = ev => {
        const n = ev.target.closest('[data-nav]'); if (n) return nav(n.dataset.nav);
        const r = ev.target.closest('[data-id]'); if (r) nav('detail', +r.dataset.id);
      };
      el.onkeydown = ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.dataset && ev.target.dataset.id) { ev.preventDefault(); ev.target.click(); } };
      window.scrollTo && window.scrollTo(0, 0);
    }
    run();
  }

  // ---- penyambungan ke aplikasi (hanya untuk akun customer) ----
  const classify = (v, id) => {
    v = String(v); if (/pesanan|order|notif|cuaca|berita|kurs|jam|peta|pengatur|setting|logout|keluar/i.test(v)) return null;
    // Dashboard menggunakan renderRoleDashboard utama. if (/track|detail/i.test(v)) return id ? 'detail' : 'list';
    if (/pengiriman|shipment|mine|saya/i.test(v)) return 'list'; return null;
  };
  const isCustomer = () => {
    const u = me(); if (u) return u.role === 'customer';
    return [...document.querySelectorAll('div,span,p')].some(e => !e.children.length && /\|\s*customer\s*$/i.test((e.textContent || '').trim()));
  };
  function hook() {
    if (typeof window.go !== 'function' || window.go.__cu) return;
    const og = window.go;
    const w = async function (v, id) {
      const r = await og.apply(this, arguments);
      try { const view = document.getElementById('view'), k = classify(v, id); if (view) { if (k && isCustomer() && tok()) { view.innerHTML = ''; mount(view, k, id); } else view.classList.remove('cu'); } } catch (e) {}
      return r;
    };
    w.__cu = 1; window.go = w;
  }

  function standalone(el) {
    if (tok()) return mount(el, 'dashboard');
    el.innerHTML = `<div class="cu-card cu-login"><h2>Masuk</h2><p class="cu-mut">Login sebagai pelanggan untuk melihat pengiriman Anda.</p><input id="lg-e" type="email" value="customer@cargotrace.test"><input id="lg-p" type="password" value="password"><button class="cu-btn p" id="lg-b">Masuk</button><div class="cu-er2" id="lg-r"></div></div>`;
    el.classList.add('cu');
    el.querySelector('#lg-b').onclick = async () => {
      try { const r = await fetch('/api/login', {method: 'POST', headers: {Accept: 'application/json', 'Content-Type': 'application/json'}, body: JSON.stringify({email: el.querySelector('#lg-e').value, password: el.querySelector('#lg-p').value})}); const j = await r.json(); if (!r.ok) throw new Error(j.message || 'Login gagal'); sessionStorage.setItem('ct_token', j.token); sessionStorage.setItem('ct_user', JSON.stringify(j.user)); mount(el, 'dashboard'); }
      catch (e) { el.querySelector('#lg-r').textContent = e.message; }
    };
  }

  if (typeof window !== 'undefined') window.CargoCustomer = {mount, standalone};
  if (typeof document !== 'undefined' && !document.getElementById('cu-standalone')) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook(); }
  if (typeof module !== 'undefined') module.exports = {classify, pct, dstat};
})();
