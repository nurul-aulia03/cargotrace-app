(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const LS = {get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }};
  const tok = () => { try { return sessionStorage.getItem('ct_token') || localStorage.getItem('ct_token') || localStorage.getItem('token') || ''; } catch (e) { return ''; } };
  async function api(p, options = {}) {
    const headers = {
      Accept: 'application/json',
      Authorization: 'Bearer ' + tok()
    };
    if (options.body) headers['Content-Type'] = 'application/json';

    const r = await fetch('/api' + p, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.status === 204 ? null : r.json();
  }
  const IP = {
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    tick: '<path d="m20 6-11 11-5-5"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    truck: '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    dots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    win: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'
  };
  const ic = n => `<svg class="cn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IP[n] || ''}</svg>`;
  const CATS = {delay: ['clock', 'Keterlambatan'], exception: ['alert', 'Pengecualian'], status: ['box', 'Perubahan status'], delivered: ['check', 'Terkirim']};
  const LBL = {CREATED: 'Dibuat', BOOKED: 'Dipesan', PICKED_UP: 'Dijemput', IN_TRANSIT: 'Dalam perjalanan', DELIVERED: 'Terkirim', NOTE: 'Catatan'};
  const fmt = t => new Date(t).toLocaleString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'});
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu'; };
  const dayKey = t => { const d = new Date(t), n = new Date(); const df = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); return df <= 0 ? 'Hari ini' : df === 1 ? 'Kemarin' : 'Lebih lama'; };
  const SEV = {HIGH: 'high', MEDIUM: 'med', LOW: 'low'};

  /** Turns shipments (+ their detail: events, exceptions) into a notification feed. */
  function build(list, details) {
    const out = [], now = Date.now(), week = 14 * 864e5;
    list.forEach((s, i) => {
      const base = {sid: s.id, no: s.shipment_number, route: (s.origin && s.origin.name) + ' → ' + (s.destination && s.destination.name), carrier: s.carrier && s.carrier.name};
      if (s.status !== 'DELIVERED' && s.delay && s.delay.delayed)
        out.push({...base, id: `delay:${s.id}:${s.delay.severity}`, cat: 'delay', sev: SEV[s.delay.severity] || 'low', t: new Date(s.updated_at || s.estimated_arrival_at).getTime() || now,
          title: `${s.shipment_number} terlambat ${s.delay.hours} jam`, text: `ETA ${fmt(s.estimated_arrival_at)} melewati jadwal ${fmt(s.expected_arrival_at)}. Tingkat keterlambatan ${s.delay.severity}.`});
      const d = details[i]; if (!d) return;
      (d.exceptions || []).forEach(x => {
        const open = x.status !== 'RESOLVED', t = new Date(open ? x.detected_at : (x.resolved_at || x.detected_at)).getTime();
        if (!open && now - t > week) return;
        out.push({...base, id: `exc:${x.id}:${x.status}`, cat: 'exception', sev: open ? (SEV[x.severity] || 'med') : 'ok', t,
          title: `${open ? 'Pengecualian' : 'Pengecualian selesai'}: ${String(x.type).replace(/_/g, ' ')}`, text: `${s.shipment_number} · status ${x.status}${x.description ? ' · ' + x.description : ''}.`});
      });
      (d.events || []).filter(e => !e.is_exception).slice(-3).forEach(e => {
        const t = new Date(e.occurred_at).getTime(); if (now - t > week) return;
        const dv = e.event_type === 'DELIVERED';
        out.push({...base, id: `ev:${e.id}`, cat: dv ? 'delivered' : 'status', sev: dv ? 'ok' : 'info', t,
          title: `${s.shipment_number}: ${LBL[e.event_type] || e.event_type}`, text: `${e.description || ''}${e.location && e.location.name ? ' · ' + e.location.name : ''}`});
      });
    });
    return out.sort((a, b) => b.t - a.t).slice(0, 100);
  }
  async function fetchItems() {
    if (!tok()) throw new Error('no token');

    const result = await api('/notifications');
    const rows = result.data || [];
    const read = LS.get('cn_read', {});

    const items = rows.map(row => {
      const d = row.data || {};
      const status = d.event_type || '';
      const cat = status === 'DELIVERED' ? 'delivered' : 'status';

      if (row.read_at) read[row.id] = 1;
      else delete read[row.id];

      return {
        id: row.id,
        sid: d.shipment_id,
        no: d.shipment_number || '-',
        route: d.route || '-',
        carrier: d.carrier || '-',
        cat,
        sev: status === 'DELIVERED' ? 'ok' : 'info',
        t: new Date(row.created_at || d.occurred_at || Date.now()).getTime(),
        title: d.title || 'Pembaruan Pengiriman',
        text: d.message || d.description || 'Ada pembaruan pada pengiriman Anda.',
        read_at: row.read_at
      };
    });

    LS.set('cn_read', read);
    return items;
  }
  const DEMO = () => { const n = Date.now(), m = x => n - x * 6e4, r = {sid: 0, route: 'Jakarta → Sydney', carrier: 'FastShip'}; return [
    {...r, id: 'd1', cat: 'delay', sev: 'high', t: m(12), no: 'SHP-2026-A1B2C3', title: 'SHP-2026-A1B2C3 terlambat 31.5 jam', text: 'ETA melewati jadwal. Tingkat keterlambatan HIGH.'},
    {...r, id: 'd2', cat: 'exception', sev: 'med', t: m(95), no: 'SHP-2026-D4E5F6', title: 'Pengecualian: PORT CONGESTION', text: 'Antrean sandar di pelabuhan tujuan · status OPEN.'},
    {...r, id: 'd3', cat: 'status', sev: 'info', t: m(260), no: 'SHP-2026-G7H8I9', title: 'SHP-2026-G7H8I9: Dalam perjalanan', text: 'Meninggalkan Singapore.'},
    {...r, id: 'd4', cat: 'delivered', sev: 'ok', t: m(1500), no: 'SHP-2026-J1K2L3', title: 'SHP-2026-J1K2L3: Terkirim', text: 'Diterima di Rotterdam.'},
    {...r, id: 'd5', cat: 'exception', sev: 'ok', t: m(2900), no: 'SHP-2026-M4N5O6', title: 'Pengecualian selesai: CUSTOMS HOLD', text: 'Dokumen bea cukai disetujui.'}]; };

  let cache = null;
  function counts() { const read = LS.get('cn_read', {}), gone = LS.get('cn_gone', {}), pr = LS.get('cn_prefs', {}); return (cache || []).filter(n => !gone[n.id] && pr[n.cat] !== false && !read[n.id]).length; }
  function badge() {
    const n = cache ? counts() : 0;
    [...document.querySelectorAll('span,div,a,button,li')].filter(e => !e.children.length && (e.textContent || '').trim() === 'Notifikasi' && e.getBoundingClientRect().left < 230).forEach(e => {
      const p = e.parentElement; if (!p) return; let b = p.querySelector(':scope > .cn-badge');
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'cn-badge'; p.appendChild(b); }
      b.textContent = n > 99 ? '99+' : n;
    });
  }

  /** If the page itself has no dark background (standalone/test page), give it the CargoTrace dark theme. */
  function solo(el) {
    const clear = c => /rgba\(0, 0, 0, 0\)|transparent/.test(c), b = getComputedStyle(document.body), h = getComputedStyle(document.documentElement);
    if (clear(b.backgroundColor) && clear(h.backgroundColor) && b.backgroundImage === 'none' && h.backgroundImage === 'none') {
      document.documentElement.style.background = '#150f1d'; document.body.style.background = '#150f1d'; document.body.style.margin = '0';
      el.style.cssText += ';max-width:1320px;margin:0 auto;padding:24px';
    }
  }
  const PR = n => n.sev === 'high' ? ['tinggi', 'Prioritas Tinggi'] : n.sev === 'med' ? ['sedang', 'Prioritas Sedang'] : n.sev === 'ok' ? ['selesai', 'Selesai'] : ['rendah', 'Prioritas Rendah'];

  let cur = null;
  function destroy() { if (cur) { clearInterval(cur.iv); cur = null; } }

  function render(el) {
    destroy(); el.classList.add('cn'); solo(el);
    let all = [], demo = false, fCat = 'all', fUn = false, fPr = 'all', query = '', open = null, menu = null, limit = 8, ids = new Set();
    const seen = LS.get('cn_seen', 0);
    const st = () => ({read: LS.get('cn_read', {}), gone: LS.get('cn_gone', {}), pr: Object.assign({delay: true, exception: true, status: true, delivered: true}, LS.get('cn_prefs', {})), sys: LS.get('cn_sys', true)});
    const trim = o => { const k = Object.keys(o); if (k.length > 600) k.slice(0, k.length - 400).forEach(x => delete o[x]); return o; };
    el.innerHTML = `<div class="cn-head"><div class="cn-hi">${ic('bell')}</div><div><h2 class="cn-h">Notifikasi</h2><p class="cn-sub">Pantau peringatan, pengecualian, dan perubahan status pengiriman secara real-time.</p></div></div>
    <div class="cn-sum" id="cn-sum"></div>
    <div class="cn-tb"><label class="cn-search">${ic('search')}<input id="cn-q" placeholder="Cari notifikasi atau nomor pengiriman..." aria-label="Cari notifikasi"></label>
    <label class="cn-sel">${ic('filter')}<select id="cn-cat" aria-label="Kategori"><option value="all">Semua Kategori</option>${Object.keys(CATS).map(k => `<option value="${k}">${CATS[k][1]}</option>`).join('')}</select></label>
    <label class="cn-sel">${ic('layers')}<select id="cn-pri" aria-label="Prioritas"><option value="all">Semua Prioritas</option><option value="tinggi">Prioritas Tinggi</option><option value="sedang">Prioritas Sedang</option><option value="rendah">Prioritas Rendah</option><option value="selesai">Selesai</option></select></label>
    <button class="cn-b p" id="cn-all">${ic('tick')}Tandai Semua Dibaca</button><button class="cn-b sq" id="cn-rf" title="Segarkan" aria-label="Segarkan">${ic('refresh')}</button></div>
    <div class="cn-grid"><div class="cn-lc"><div class="cn-lh"><h3>Daftar Notifikasi</h3><div><span id="cn-cnt"></span><button class="cn-lk" id="cn-clr">Bersihkan yang dibaca</button></div></div><div id="cn-note"></div><div id="cn-list"></div><div id="cn-more"></div></div>
    <aside class="cn-card"><h4>${ic('gear')}Pengaturan Notifikasi</h4><p class="cn-sub">Pilih jenis notifikasi yang ingin ditampilkan.</p><div id="cn-prefs"></div><div class="cn-hr"></div><h5>Metode Pemberitahuan</h5><div id="cn-meth"></div><p class="cn-sub" id="cn-brs"></p></aside></div><div class="cn-toast" id="cn-toast"></div>`;
    const q = s => el.querySelector(s);
    const toast = m => { const t = q('#cn-toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600); };
    const vis = () => { const s = st(); return all.filter(n => !s.gone[n.id] && s.pr[n.cat]); };
    const tg = (key, icon, label, on, extra) => `<label class="cn-tg ${extra && extra.dis ? 'dis' : ''}"><span class="cn-pl">${ic(icon)}${label}</span><input type="checkbox" ${key} ${on ? 'checked' : ''} ${extra && extra.dis ? 'disabled' : ''}><i></i></label>`;

    function draw() {
      if (!q('#cn-list')) return;
      const s = st(), v = vis(), un = v.filter(n => !s.read[n.id]), fresh = seen ? un.filter(n => n.t > seen).length : 0;
      const cnt = k => v.filter(n => n.cat === k && (k !== 'exception' || n.sev !== 'ok')).length;
      const cs = [['unread', 'bell', 'Belum Dibaca', un.length, fUn], ['delay', 'truck', 'Keterlambatan', cnt('delay'), fCat === 'delay'], ['exception', 'alert', 'Pengecualian', cnt('exception'), fCat === 'exception'], ['status', 'box', 'Perubahan Status', cnt('status'), fCat === 'status'], ['delivered', 'check', 'Terkirim', cnt('delivered'), fCat === 'delivered']];
      q('#cn-sum').innerHTML = cs.map(c => `<button class="cn-sc ${c[4] ? 'on' : ''}" data-c="${c[0]}"><span class="cn-st">${ic(c[1])}</span><div><small>${c[2]}</small><b>${c[3]}</b></div>${c[0] === 'unread' && fresh ? `<em class="cn-new">+${fresh}</em>` : ''}</button>`).join('');
      q('#cn-cat').value = fCat; q('#cn-pri').value = fPr;
      q('#cn-prefs').innerHTML = Object.keys(CATS).map(k => tg(`data-p="${k}"`, CATS[k][0], CATS[k][1], s.pr[k])).join('');
      const br = LS.get('cn_browser', false) && window.Notification && Notification.permission === 'granted';
      q('#cn-meth').innerHTML = tg('data-m="sys"', 'bell', 'Notifikasi di Sistem', s.sys) + tg('data-m="mail"', 'mail', 'Email', false, {dis: true}) + tg('data-m="br"', 'win', 'Notifikasi Browser', br);
      q('#cn-brs').textContent = 'Email memerlukan pengaturan server surat dan belum tersedia. ' + (!window.Notification ? 'Browser ini tidak mendukung notifikasi browser.' : Notification.permission === 'denied' ? 'Notifikasi browser diblokir di pengaturan browser.' : '');
      q('#cn-note').innerHTML = demo ? '<div class="cn-warn">Data contoh. Login atau API belum tersedia; notifikasi nyata muncul setelah Anda login.</div>' : '';
      const qq = query.toLowerCase();
      const rows = v.filter(n => (!fUn || !s.read[n.id]) && (fCat === 'all' || n.cat === fCat) && (fPr === 'all' || PR(n)[0] === fPr) && (!qq || (n.title + ' ' + n.text + ' ' + n.no).toLowerCase().includes(qq)));
      const shown = rows.slice(0, limit);
      q('#cn-cnt').textContent = `Menampilkan ${shown.length} dari ${rows.length} notifikasi`;
      q('#cn-more').innerHTML = rows.length > shown.length ? `<button class="cn-b cn-wide" id="cn-mo">Muat lebih banyak (${rows.length - shown.length})</button>` : '';
      if (!rows.length) { q('#cn-list').innerHTML = `<div class="cn-empty">${ic('inbox')}<b>Tidak ada notifikasi</b><p>${v.length ? 'Tidak ada yang cocok dengan filter ini.' : 'Semua beres. Notifikasi baru akan muncul di sini.'}</p></div>`; badge(); return; }
      q('#cn-list').innerHTML = shown.map(n => {
        const u = !s.read[n.id], op = open === n.id, pr = PR(n);
        return `<div class="cn-it ${n.sev} ${u ? 'un' : ''} ${op ? 'op' : ''}" data-id="${esc(n.id)}" tabindex="0" role="button" aria-expanded="${op}">
        <div class="cn-ic c-${n.cat}">${ic(CATS[n.cat][0])}</div><div class="cn-bd"><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div><span class="cn-pri ${pr[0]}">${pr[1]}</span>
        <div class="cn-tm"><time>${ago(n.t)}</time>${u ? '<i class="cn-dot"></i>' : ''}</div>
        <div class="cn-kb"><button class="cn-k" data-k aria-label="Menu aksi">${ic('dots')}</button>${menu === n.id ? `<div class="cn-menu"><button data-a="read">${u ? ic('tick') + 'Tandai dibaca' : ic('undo') + 'Tandai belum dibaca'}</button><button data-a="open">${ic('pin')}Buka pengiriman</button><button data-a="copy">${ic('copy')}Salin nomor</button><button data-a="del" class="d">${ic('trash')}Hapus</button></div>` : ''}</div>
        ${op ? `<div class="cn-dt"><div><small>Rute</small>${esc(n.route || '-')}</div><div><small>Ekspedisi</small>${esc(n.carrier || '-')}</div><div><small>Waktu</small>${fmt(n.t)}</div><div><small>Kategori</small>${CATS[n.cat][1]}</div></div>` : ''}</div>`;
      }).join('');
      badge();
    }
    async function refresh(manual) {
      let items;
      try {
        items = await fetchItems();
        demo = false;
      } catch (e) {
        items = [];
        demo = false;
        console.error('Gagal mengambil notifikasi database:', e);
        if (manual) toast('Gagal memuat notifikasi. Periksa login dan koneksi API.');
      }
      const fresh = all.length ? items.filter(n => !ids.has(n.id)) : [];
      all = items; cache = items; ids = new Set(items.map(n => n.id)); draw();
      if (fresh.length && !demo) {
        const s = st(), nw = fresh.filter(n => !s.gone[n.id] && s.pr[n.cat] && !s.read[n.id]);
        if (nw.length) { if (s.sys) toast(`${nw.length} notifikasi baru`); if (LS.get('cn_browser', false) && window.Notification && Notification.permission === 'granted') try { new Notification('CargoTrace', {body: nw[0].title}); } catch (e) {} }
      } else if (manual) toast('Notifikasi diperbarui');
    }
    const byId = id => all.find(n => n.id === id);
    const act = async (n, a) => {
      try {
        if (a === 'read') {
          if (!LS.get('cn_read', {})[n.id]) {
            await api('/notifications/' + encodeURIComponent(n.id) + '/read', {method: 'PATCH'});
            const r = LS.get('cn_read', {});
            r[n.id] = 1;
            LS.set('cn_read', r);
            toast('Notifikasi ditandai dibaca');
          }
        }
        else if (a === 'del') {
          await api('/notifications/' + encodeURIComponent(n.id), {method: 'DELETE'});
          all = all.filter(x => x.id !== n.id);
          cache = all;
          open = null;
          toast('Notifikasi dihapus');
        }
        else if (a === 'copy') {
          (navigator.clipboard ? navigator.clipboard.writeText(n.no) : Promise.reject())
            .then(() => toast('Nomor disalin: ' + n.no), () => toast(n.no));
        }
        else if (a === 'open') {
          try {
            if (typeof go === 'function' && n.sid) {
              go('tracking', n.sid);
              return;
            }
          } catch (er) {}
          toast('Buka Pengiriman dan cari ' + n.no);
        }
      } catch (e) {
        toast('Aksi gagal. Periksa koneksi API.');
        console.error(e);
      }

      menu = null;
      draw();
    };
    el.onclick = e => {
      const c = e.target.closest('[data-c]');
      if (c) { const k = c.dataset.c; if (k === 'unread') fUn = !fUn; else fCat = fCat === k ? 'all' : k; limit = 8; return draw(); }
      if (e.target.closest('#cn-mo')) { limit += 8; return draw(); }
      const it = e.target.closest('.cn-it');
      if (!e.target.closest('.cn-kb') && menu) { menu = null; if (!it) draw(); }
      if (!it) return;
      const n = byId(it.dataset.id); if (!n) return;
      if (e.target.closest('[data-k]')) { menu = menu === n.id ? null : n.id; return draw(); }
      const a = e.target.closest('[data-a]'); if (a) return act(n, a.dataset.a);
      open = open === n.id ? null : n.id;
      menu = null;
      if (!LS.get('cn_read', {})[n.id]) {
        api('/notifications/' + encodeURIComponent(n.id) + '/read', {method: 'PATCH'})
          .then(() => {
            const r = LS.get('cn_read', {});
            r[n.id] = 1;
            LS.set('cn_read', r);
            draw();
          })
          .catch(e => console.error('Gagal menandai notifikasi:', e));
      }
      draw();
    };
    el.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('cn-it')) { e.preventDefault(); e.target.click(); } else if (e.key === 'Escape' && menu) { menu = null; draw(); } };
    el.onchange = async e => {
      const t = e.target, d = t.dataset || {};
      if (d.p) { const pr = LS.get('cn_prefs', {}); pr[d.p] = t.checked; LS.set('cn_prefs', pr); return draw(); }
      if (d.m === 'sys') { LS.set('cn_sys', t.checked); return draw(); }
      if (d.m === 'br') {
        if (!window.Notification) return draw();
        if (!t.checked) LS.set('cn_browser', false); else { const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); LS.set('cn_browser', p === 'granted'); }
        return draw();
      }
      if (t.id === 'cn-cat') { fCat = t.value; limit = 8; draw(); } else if (t.id === 'cn-pri') { fPr = t.value; limit = 8; draw(); }
    };
    q('#cn-q').oninput = e => { query = e.target.value.trim(); limit = 8; draw(); const i = q('#cn-q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    q('#cn-all').onclick = async () => {
      try {
        await api('/notifications/read-all', {method: 'POST'});
        const r = LS.get('cn_read', {});
        vis().forEach(n => { r[n.id] = 1; });
        LS.set('cn_read', trim(r));
        draw();
        toast('Semua ditandai dibaca');
      } catch (e) {
        toast('Gagal memperbarui notifikasi');
      }
    };
    q('#cn-clr').onclick = async () => {
      const s = st();
      const targets = vis().filter(n => s.read[n.id]);

      try {
        await Promise.all(targets.map(n =>
          api('/notifications/' + encodeURIComponent(n.id), {method: 'DELETE'})
        ));
        const ids = new Set(targets.map(n => n.id));
        all = all.filter(n => !ids.has(n.id));
        cache = all;
        draw();
        toast(targets.length + ' notifikasi dibersihkan');
      } catch (e) {
        toast('Gagal membersihkan notifikasi');
      }
    };
    q('#cn-rf').onclick = () => refresh(true);
    refresh().then(() => LS.set('cn_seen', Date.now()));
    cur = {iv: setInterval(() => { if (!el.isConnected || !el.querySelector('#cn-list')) return destroy(); refresh(); }, 60000)};
  }

  function hook() {
    let busy = false;
    const findTitle = () => {
      for (const e of document.querySelectorAll('h1,h2,h3,div,span,p')) {
        if (e.children.length || e.closest('.cn,nav,aside')) continue;
        if (!/^(Notifikasi|Pusat Notifikasi)$/i.test((e.textContent || '').trim())) continue;
        const r = e.getBoundingClientRect(); if (r.top + window.scrollY < 110 && r.left > 230) return e;
      }
      return null;
    };
    const apply = () => {
      if (busy) return; const t = findTitle(); if (!t) return;
      let host = null;
      for (let x = t; x && x !== document.body; x = x.parentElement) { const n = x.nextElementSibling; if (n && !n.matches('script,style') && (n.children.length || n.offsetHeight > 150)) { host = n; break; } }
      if (!host || host.classList.contains('cn') || host.querySelector('.cn-eyebrow')) return;
      busy = true;
      [...host.children].forEach(c => { c.style.display = 'none'; });
      const box = document.createElement('div'); box.className = 'cn-host'; host.appendChild(box); render(box); setTimeout(() => { busy = false; }, 300);
    };
    new MutationObserver(() => requestAnimationFrame(apply)).observe(document.body, {childList: true, subtree: true});
    const wrapGo = () => {
      if (typeof window.go !== 'function' || window.go.__cn) return;
      const og = window.go;
      const w = async function (v) {
        const r = await og.apply(this, arguments), view = document.getElementById('view');
        if (view) { if (/notif/i.test(String(v))) { if (!view.querySelector('.cn-eyebrow')) { view.innerHTML = ''; render(view); } } else view.classList.remove('cn'); }
        return r;
      };
      w.__cn = 1; window.go = w;
    };
    wrapGo();
    apply();
    // background poll so the sidebar badge works before the page is opened
    const bg = () => { if (!tok() || document.querySelector('.cn')) return; fetchItems().then(i => { cache = i; badge(); }).catch(() => {}); };
    setTimeout(bg, 1500); setInterval(bg, 60000);
  }

  if (typeof window !== 'undefined') window.CargoNotif = {render, destroy};
  if (typeof document !== 'undefined' && document.getElementById('cn-standalone')) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook(); }
  if (typeof module !== 'undefined') module.exports = {build, dayKey, ago};
})();
