(function () {
  'use strict';
  const HOME = {name: 'Meunasah Cut, Nisam', country: 'Aceh Utara, Indonesia', tz: 'Asia/Jakarta', lat: 5.17, lon: 97.02, home: true};
  const BASE = [
    ['Jakarta','Indonesia','Asia/Jakarta',-6.21,106.85],['Singapore','Singapura','Asia/Singapore',1.35,103.82],['Shanghai','Tiongkok','Asia/Shanghai',31.23,121.47],
    ['Hong Kong','Tiongkok','Asia/Hong_Kong',22.32,114.17],['Tokyo','Jepang','Asia/Tokyo',35.68,139.69],['Sydney','Australia','Australia/Sydney',-33.87,151.21],
    ['Dubai','Uni Emirat Arab','Asia/Dubai',25.2,55.27],['Rotterdam','Belanda','Europe/Amsterdam',51.92,4.48],['Hamburg','Jerman','Europe/Berlin',53.55,9.99],
    ['London','Inggris','Europe/London',51.51,-0.13],['New York','Amerika Serikat','America/New_York',40.71,-74.01],['Los Angeles','Amerika Serikat','America/Los_Angeles',34.05,-118.24]
  ].map(a => ({name: a[0], country: a[1], tz: a[2], lat: a[3], lon: a[4]}));
  const ZN = {'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT'};
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');

  const fm = {};
  function P(tz, ms) {
    const f = fm[tz] || (fm[tz] = new Intl.DateTimeFormat('en-GB', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'}));
    const o = {}; f.formatToParts(new Date(ms)).forEach(p => { o[p.type] = p.value; });
    return {y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second};
  }
  const off = (tz, ms) => { const p = P(tz, ms); return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000) / 6e4); };
  const fmtOff = m => 'UTC' + (m < 0 ? '-' : '+') + Math.floor(Math.abs(m) / 60) + (Math.abs(m) % 60 ? ':' + pad(Math.abs(m) % 60) : '');
  const dayDiff = (a, b) => Math.round((Date.UTC(a.y, a.mo - 1, a.d) - Date.UTC(b.y, b.mo - 1, b.d)) / 864e5);
  const dateLabel = p => new Date(Date.UTC(p.y, p.mo - 1, p.d)).toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
  const diffLabel = m => (m < 0 ? '-' : '+') + Math.floor(Math.abs(m) / 60) + 'j' + (Math.abs(m) % 60 ? ' ' + Math.abs(m) % 60 + 'm' : '');
  function zonedToMs(tz, y, mo, d, h, mi) { const g0 = Date.UTC(y, mo - 1, d, h, mi); let g = g0 - off(tz, g0) * 6e4; g = g0 - off(tz, g) * 6e4; return g; }
  const tzOk = tz => { try { new Intl.DateTimeFormat('en', {timeZone: tz}); return true; } catch (e) { return false; } };

  function wmo(c, day) {
    if (c === 0) return day ? ['☀️','Cerah'] : ['🌙','Cerah']; if (c === 1) return day ? ['🌤️','Cerah berawan'] : ['🌙','Cerah berawan'];
    if (c === 2) return ['⛅','Berawan sebagian']; if (c === 3) return ['☁️','Mendung']; if (c === 45 || c === 48) return ['🌫️','Berkabut'];
    if (c >= 51 && c <= 57) return ['🌦️','Gerimis']; if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return ['🌧️','Hujan'];
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ['❄️','Salju']; if (c >= 95) return ['⛈️','Badai petir']; return ['🌡️','—'];
  }

  function loadExtra() {
    try {
      const a = JSON.parse(localStorage.getItem('cj_extra') || '[]');
      return (Array.isArray(a) ? a : []).filter(c => c && typeof c.name === 'string' && typeof c.tz === 'string' && isFinite(c.lat) && isFinite(c.lon) && tzOk(c.tz)).slice(0, 12).map(c => ({name: c.name, country: String(c.country || ''), tz: c.tz, lat: +c.lat, lon: +c.lon, extra: true}));
    } catch (e) { return []; }
  }
  const saveExtra = x => { try { localStorage.setItem('cj_extra', JSON.stringify(x)); } catch (e) {} };

  let cur = null;
  function destroy() { if (cur) { clearTimeout(cur.t); cur = null; } }

  function render(el) {
    destroy(); el.classList.add('cj');
    const extra = loadExtra(), list = [HOME, ...BASE, ...extra], wxc = {};
    let sel = 0, h24 = true, prev = '';
    el.innerHTML = `<div class="cj-eyebrow">CargoTrace | World Time</div><h2 class="cj-h">Jam Dunia</h2><p class="cj-sub">Waktu real-time di kampung Anda dan kota-kota penting jalur logistik dunia.</p>
    <div class="cj-hero" id="cj-hero"><div class="cj-top"><div><h3 id="cj-city"></h3><p id="cj-date"></p></div><div class="cj-btns"><button id="cj-12" title="Ganti format 12/24 jam">24 jam</button><button id="cj-fs" title="Layar penuh">⛶</button></div></div>
    <div class="cj-ap" id="cj-ap"></div><div class="cj-dg" id="cj-dg">${[0,1,':',2,3,':',4,5].map(x => x === ':' ? '<i class="cj-col"></i>' : `<div class="cj-d"><span>0</span></div>`).join('')}</div>
    <div class="cj-foot"><div class="cj-wx" id="cj-wx"></div><div class="cj-wd" id="cj-wd"></div></div></div>
    <div class="cj-tabs"><button class="on" data-tab="clk">🕒 Jam Dunia</button><button data-tab="cv">🔁 Konverter Waktu</button></div>
    <div id="cj-clk"><div class="cj-bar"><input id="cj-q" placeholder="Tambah kota (mis. Busan, Mumbai, Jeddah)…" aria-label="Tambah kota"><button class="cj-btn" id="cj-add">+ Tambah</button><span class="cj-err" id="cj-err"></span></div>
    <div class="cj-grid" id="cj-grid"></div></div>
    <div class="cj-cv" id="cj-cv" hidden><h4>Konverter Waktu</h4><p class="cj-sub">Pilih kota dan jam, lihat jam yang sama di semua kota. Klik baris untuk menjadikannya jam utama.</p><div class="cj-bar"><select id="cj-cs" aria-label="Kota asal"></select><input type="datetime-local" id="cj-cdt" aria-label="Tanggal dan jam"><button class="cj-btn" id="cj-cn">Sekarang</button></div><div id="cj-cl"></div></div><p class="cj-note">Waktu mengikuti jam perangkat Anda dan basis data zona waktu internasional (otomatis menyesuaikan waktu musim panas). Akurat selama jam perangkat benar.</p>`;
    const q = s => el.querySelector(s), digits = [...el.querySelectorAll('.cj-d')];

    function paintWx(j) {
      const wx = q('#cj-wx'), wd = q('#cj-wd'), d = j && j.current;
      if (!j) { wx.innerHTML = '<span class="cj-mut">Memuat cuaca…</span>'; wd.innerHTML = ''; return; }
      if (j === 'err') { wx.innerHTML = '<span class="cj-mut">Cuaca tidak tersedia</span>'; wd.innerHTML = ''; return; }
      const [ic, lb] = wmo(d.weather_code, d.is_day === 1);
      wx.innerHTML = `<span class="cj-ic">${ic}</span><div><b>${Math.round(d.temperature_2m)}°</b><small>${esc(lb)}</small></div>`;
      wd.innerHTML = `Terasa seperti: ${Math.round(d.apparent_temperature)}°<br>Angin: ${d.wind_speed_10m} km/jam<br>Kelembapan: ${d.relative_humidity_2m}%${j.daily && j.daily.sunrise ? '<br>Terbit ' + j.daily.sunrise[0].slice(11, 16) + ' · Terbenam ' + j.daily.sunset[0].slice(11, 16) : ''}<br><em>Diperbarui: ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}</em>`;
    }
    async function loadWx(c) {
      const k = c.lat + ',' + c.lon, hit = wxc[k];
      if (hit && Date.now() - hit.t < 6e5) return paintWx(hit.d);
      paintWx(null);
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=sunrise,sunset&timezone=auto`);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json(); wxc[k] = {t: Date.now(), d};
        if (list[sel] === c) paintWx(d);
      } catch (e) { if (list[sel] === c) paintWx('err'); }
    }
    function drawMeta() {
      const c = list[sel], now = Date.now(), p = P(c.tz, now), o = off(c.tz, now);
      q('#cj-city').innerHTML = esc(c.name) + (c.country ? `<small>${esc(c.country)}</small>` : '');
      q('#cj-date').textContent = dateLabel(p) + ' · ' + fmtOff(o) + (ZN[c.tz] ? ' (' + ZN[c.tz] + ')' : '');
      loadWx(c);
    }
    function drawGrid() {
      q('#cj-grid').innerHTML = list.map((c, i) => `<div class="cj-card ${i === sel ? 'on' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${esc(c.name)}"><div><b>${esc(c.name)}</b><small>${esc(c.country)}</small><em data-d="${i}"></em></div><div class="cj-ct"><span data-t="${i}"></span><small data-o="${i}"></small>${c.extra ? `<button class="cj-x" data-x="${i}" title="Hapus">×</button>` : ''}</div></div>`).join('');
    }
    function tick() {
      const now = Date.now(), c = list[sel], p = P(c.tz, now);
      const hh = h24 ? p.h : (p.h % 12 || 12), s = pad(hh) + pad(p.mi) + pad(p.s);
      q('#cj-ap').textContent = h24 ? '' : (p.h >= 12 ? 'PM' : 'AM');
      digits.forEach((d, i) => { const sp = d.firstChild; if (sp.textContent !== s[i]) { sp.textContent = s[i]; if (prev) { d.classList.remove('flip'); void d.offsetWidth; d.classList.add('flip'); } } });
      prev = s;
      const home = P(HOME.tz, now), homeOff = off(HOME.tz, now);
      list.forEach((x, i) => {
        const px = P(x.tz, now), o = off(x.tz, now), dd = dayDiff(px, home);
        const t = el.querySelector(`[data-t="${i}"]`); if (!t) return;
        t.textContent = pad(px.h) + ':' + pad(px.mi);
        el.querySelector(`[data-d="${i}"]`).textContent = (dd === 0 ? 'Hari ini' : dd > 0 ? 'Besok' : 'Kemarin') + ' · ' + dateLabel(px).replace(/ \d{4}$/, '');
        el.querySelector(`[data-o="${i}"]`).textContent = diffLabel(o - homeOff) + ' · ' + fmtOff(o);
      });
      q('#cj-date').textContent = dateLabel(p) + ' · ' + fmtOff(off(c.tz, now)) + (ZN[c.tz] ? ' (' + ZN[c.tz] + ')' : '');
    }
    const inVal = (tz, ms) => { const p = P(tz, ms); return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`; };
    function drawCv(reset) {
      const cs = q('#cj-cs'), keep = cs.value;
      cs.innerHTML = list.map((c, i) => `<option value="${i}">${esc(c.name)}</option>`).join('');
      cs.value = keep && list[+keep] ? keep : '0';
      if (reset || !q('#cj-cdt').value) q('#cj-cdt').value = inVal(list[+cs.value].tz, Date.now());
      const m = q('#cj-cdt').value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/); if (!m) return;
      const src = list[+cs.value], ms = zonedToMs(src.tz, +m[1], +m[2], +m[3], +m[4], +m[5]), sp = P(src.tz, ms);
      q('#cj-cl').innerHTML = list.map((c, i) => { const p = P(c.tz, ms), dd = dayDiff(p, sp), o = off(c.tz, ms);
        return `<div class="cj-cvrow ${i === +cs.value ? 'src' : ''}" data-r="${i}" tabindex="0" role="button"><b>${esc(c.name)}</b><span>${pad(p.h)}:${pad(p.mi)}</span><small>${dd === 0 ? 'Hari yang sama' : dd > 0 ? 'Besok' : 'Kemarin'} · ${esc(dateLabel(p).replace(/ \d{4}$/, ''))} · ${fmtOff(o)}</small></div>`; }).join('');
    }
    const showTab = t => { el.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); q('#cj-clk').hidden = t !== 'clk'; q('#cj-cv').hidden = t !== 'cv'; if (t === 'cv') drawCv(true); };
    const err = m => { q('#cj-err').textContent = m || ''; };
    async function add() {
      const v = q('#cj-q').value.trim(); err(); if (!v) return;
      if (extra.length >= 12) return err('Maksimal 12 kota tambahan.');
      try {
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=id&format=json&name=' + encodeURIComponent(v));
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const g = ((await r.json()).results || [])[0];
        if (!g || !g.timezone || !tzOk(g.timezone)) return err('Kota tidak ditemukan.');
        if (list.some(x => x.name === g.name && x.tz === g.timezone)) return err('Kota sudah ada di daftar.');
        const c = {name: g.name, country: [g.admin1, g.country].filter(Boolean).join(', '), tz: g.timezone, lat: g.latitude, lon: g.longitude, extra: true};
        extra.push(c); saveExtra(extra); list.push(c); sel = list.length - 1; q('#cj-q').value = ''; prev = ''; drawGrid(); drawMeta(); tick();
      } catch (e) { err('Pencarian gagal: ' + e.message); }
    }
    el.onclick = e => {
      const tb = e.target.closest('[data-tab]'); if (tb) return showTab(tb.dataset.tab);
      const rw = e.target.closest('[data-r]'); if (rw) { sel = +rw.dataset.r; prev = ''; drawGrid(); drawMeta(); tick(); showTab('clk'); q('#cj-hero').scrollIntoView({behavior: 'smooth', block: 'center'}); return; }
      const x = e.target.closest('[data-x]');
      if (x) { const i = +x.dataset.x, c = list[i]; list.splice(i, 1); const k = extra.indexOf(c); if (k >= 0) { extra.splice(k, 1); saveExtra(extra); } if (sel >= list.length || sel === i) sel = 0; else if (sel > i) sel--; prev = ''; drawGrid(); drawMeta(); tick(); return; }
      const c = e.target.closest('[data-i]'); if (c) { sel = +c.dataset.i; prev = ''; drawGrid(); drawMeta(); tick(); }
    };
    el.onkeydown = e => { if (e.key === 'Enter' && e.target.id === 'cj-q') add(); else if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && (e.target.dataset.i || e.target.dataset.r)) { e.preventDefault(); e.target.click(); } };
    q('#cj-add').onclick = add;
    q('#cj-cs').onchange = () => drawCv(true); q('#cj-cdt').onchange = () => drawCv(false); q('#cj-cn').onclick = () => drawCv(true);
    q('#cj-12').onclick = e => { h24 = !h24; e.target.textContent = h24 ? '24 jam' : '12 jam'; prev = ''; tick(); };
    q('#cj-fs').onclick = () => { const h = q('#cj-hero'); if (document.fullscreenElement) document.exitFullscreen(); else if (h.requestFullscreen) h.requestFullscreen(); };
    drawGrid(); drawMeta(); tick();
    cur = {t: 0};
    const me = cur, loop = () => { if (cur !== me) return; if (!el.isConnected) return destroy(); tick(); me.t = setTimeout(loop, 1000 - (Date.now() % 1000) + 5); };
    me.t = setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
  }

  // Auto-hook: detect the "Jam Dunia" page from the title in the top bar, hide the old content and mount the new one.
  function hook() {
    let busy = false;
    const findTitle = () => {
      for (const e of document.querySelectorAll('h1,h2,h3,div,span,p')) {
        if (e.children.length || e.closest('.cj,nav,aside')) continue;
        if (!/^(Jam Dunia|Waktu Dunia|World Clock)$/i.test((e.textContent || '').trim())) continue;
        const r = e.getBoundingClientRect();
        if (r.top + window.scrollY < 110 && r.left > 230) return e;
      }
      return null;
    };
    const apply = () => {
      if (busy) return;
      const t = findTitle(); if (!t) return;
      let host = null;
      for (let x = t; x && x !== document.body; x = x.parentElement) {
        const n = x.nextElementSibling;
        if (n && !n.matches('script,style') && (n.children.length || n.offsetHeight > 150)) { host = n; break; }
      }
      if (!host || host.querySelector('.cj')) return;
      busy = true;
      [...host.children].forEach(c => { c.style.display = 'none'; });
      const box = document.createElement('div'); box.className = 'cj-host'; host.appendChild(box);
      render(box); setTimeout(() => { busy = false; }, 300);
    };
    new MutationObserver(() => requestAnimationFrame(apply)).observe(document.body, {childList: true, subtree: true});
    apply();
  }

  if (typeof window !== 'undefined') window.CargoClock = {render, destroy};
  if (typeof document !== 'undefined' && document.getElementById('cj-standalone')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  }
  if (typeof module !== 'undefined') module.exports = {P, off, fmtOff, dayDiff, dateLabel, diffLabel, zonedToMs};
})();
