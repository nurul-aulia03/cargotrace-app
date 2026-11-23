(function () {
  'use strict';
  const CITIES = {'Banda Aceh':[5.5483,95.3238],'Jakarta':[-6.2088,106.8456],'Surabaya':[-7.2575,112.7521],'Medan':[3.5952,98.6722],'Makassar':[-5.1477,119.4327],'Batam':[1.0456,104.0305],'Singapore':[1.3521,103.8198],'Rotterdam':[51.9244,4.4777],'Los Angeles':[34.0522,-118.2437],'Shanghai':[31.2304,121.4737],'Dubai':[25.2048,55.2708],'Hamburg':[53.5511,9.9937]};
  const POP = ['Jakarta','Singapore','Rotterdam','Los Angeles','Shanghai','Dubai'];
  const DN = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const API = 'https://api.open-meteo.com/v1/forecast';

  function wmo(c, day) {
    if (c === 0) return day ? ['☀️','Cerah'] : ['🌙','Cerah'];
    if (c === 1) return day ? ['🌤️','Cerah berawan'] : ['🌙','Cerah berawan'];
    if (c === 2) return ['⛅','Berawan sebagian'];
    if (c === 3) return ['☁️','Mendung'];
    if (c === 45 || c === 48) return ['🌫️','Berkabut'];
    if (c >= 51 && c <= 57) return ['🌦️','Gerimis'];
    if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return ['🌧️', c >= 80 ? 'Hujan lebat lokal' : 'Hujan'];
    if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ['❄️','Salju'];
    if (c >= 95) return ['⛈️','Badai petir'];
    return ['🌡️','—'];
  }
  const uvLabel = u => u < 3 ? 'Rendah' : u < 6 ? 'Sedang' : u < 8 ? 'Tinggi' : u < 11 ? 'Sangat tinggi' : 'Ekstrem';
  const r0 = v => Math.round(v);

  function risk(d, hi) {
    const w = d.current.wind_speed_10m, pop = d.hourly.precipitation_probability?.[hi] ?? 0, vis = d.hourly.visibility?.[hi] ?? 1e4, code = d.current.weather_code;
    const s = (w >= 40 ? 2 : w >= 25 ? 1 : 0) + (pop >= 70 ? 2 : pop >= 40 ? 1 : 0) + (vis < 2000 ? 2 : vis < 5000 ? 1 : 0) + (code >= 95 ? 2 : 0);
    return s >= 4 ? ['Tinggi','hi','Pertimbangkan penundaan atau pengalihan rute.']
         : s >= 2 ? ['Sedang','md','Pantau jadwal dan siapkan estimasi ETA ulang.']
         : ['Rendah','lo','Kondisi mendukung operasional pengiriman.'];
  }

  function chart(d, hi) {
    const t = d.hourly.temperature_2m.slice(0, 24), W = 620, H = 200, p = 30, base = H - 38;
    const mn = Math.min(...t) - 1, mx = Math.max(...t) + 1;
    const X = i => p + i * (W - 2 * p) / (t.length - 1), Y = v => base - (v - mn) / (mx - mn) * (base - 36);
    const line = t.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
    const area = line + ` L${X(t.length - 1).toFixed(1)} ${base} L${X(0).toFixed(1)} ${base}Z`;
    let marks = '';
    t.forEach((v, i) => {
      if (i % 3 === 0) marks += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.5" class="cw-dot"/><text x="${X(i).toFixed(1)}" y="${(Y(v) - 10).toFixed(1)}" text-anchor="middle" class="cw-tv">${r0(v)}°</text><text x="${X(i).toFixed(1)}" y="${H - 14}" text-anchor="middle" class="cw-tx">${String(i).padStart(2, '0')}:00</text>`;
    });
    const now = hi >= 0 && hi < t.length ? `<circle cx="${X(hi).toFixed(1)}" cy="${Y(t[hi]).toFixed(1)}" r="6.5" class="cw-now"/>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" class="cw-svg" role="img" aria-label="Grafik suhu per jam hari ini"><defs><linearGradient id="cwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b48af0" stop-opacity=".45"/><stop offset="1" stop-color="#b48af0" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#cwg)"/><path d="${line}" class="cw-ln"/>${marks}${now}</svg>`;
  }

  function view(d, name, pops) {
    const c = d.current, dl = d.daily, hi = Math.max(0, d.hourly.time.findIndex(x => x.slice(0, 13) === c.time.slice(0, 13)));
    const [ic, lb] = wmo(c.weather_code, c.is_day === 1), rk = risk(d, hi);
    const uv = d.hourly.uv_index?.[hi] ?? dl.uv_index_max?.[0] ?? 0, vis = (d.hourly.visibility?.[hi] ?? 0) / 1000, pop = d.hourly.precipitation_probability?.[hi] ?? 0;
    const date = new Date(dl.time[0] + 'T12:00').toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long'});
    const days = dl.time.map((t, i) => {
      const e = wmo(dl.weather_code[i], true)[0], nm = i === 0 ? 'Hari ini' : DN[new Date(t + 'T12:00').getDay()];
      return `<div class="cw-day ${i === 0 ? 'on' : ''}"><small>${nm}</small><span>${e}</span><b>${r0(dl.temperature_2m_max[i])}°</b><em>${r0(dl.temperature_2m_min[i])}°</em><i>💧${dl.precipitation_probability_max?.[i] ?? 0}%</i></div>`;
    }).join('');
    const rows = [['🌡️','Terasa seperti', r0(c.apparent_temperature) + '°C'], ['💧','Kelembapan', c.relative_humidity_2m + '%'], ['🌬️','Kecepatan angin', r0(c.wind_speed_10m) + ' km/jam'],
      ['☀️','Indeks UV', r0(uv) + ' (' + uvLabel(uv) + ')'], ['👁️','Jarak pandang', vis.toFixed(1) + ' km'], ['🧭','Tekanan udara', r0(c.surface_pressure) + ' hPa'],
      ['🌧️','Curah hujan', c.precipitation + ' mm'], ['☔','Peluang hujan', pop + '%']]
      .map(r => `<div class="cw-row"><span>${r[0]} ${r[1]}</span><b>${esc(r[2])}</b></div>`).join('');
    const pp = (Array.isArray(pops) ? pops : []).map((p, i) => {
      const e = wmo(p.current.weather_code, p.current.is_day === 1)[0];
      return `<button class="cw-pop" data-city="${esc(POP[i])}"><span>${e}</span><b>${esc(POP[i])}</b><em>${r0(p.current.temperature_2m)}°</em></button>`;
    }).join('');
    const opts = Object.keys(CITIES).map(k => `<option ${k === name ? 'selected' : ''}>${esc(k)}</option>`).join('') + (CITIES[name] ? '' : `<option selected>${esc(name)}</option>`);
    return `<div class="cw-eyebrow">CargoTrace | Weather Intelligence</div><h2 class="cw-h">Pusat Cuaca</h2><p class="cw-sub">Pemantauan kondisi cuaca dan risiko operasional jalur pengiriman.</p>
    <div class="cw-bar"><input id="cw-q" placeholder="Cari kota, pelabuhan, atau lokasi…" aria-label="Cari lokasi"><button class="cw-btn" id="cw-go">Cari</button><select id="cw-sel" aria-label="Pilih kota operasional">${opts}</select><button class="cw-btn" id="cw-rf">↻ Perbarui</button></div><div class="cw-err" id="cw-err"></div>
    <div class="cw-hero"><div><div class="cw-eyebrow">Cuaca saat ini</div><h3>${esc(name)}</h3><p>${esc(date)}</p><div class="cw-temp">${r0(c.temperature_2m)}<sup>°C</sup></div><div class="cw-cond">${esc(lb)}</div><p class="cw-hl">Tertinggi ${r0(dl.temperature_2m_max[0])}° · Terendah ${r0(dl.temperature_2m_min[0])}° · Terasa ${r0(c.apparent_temperature)}°</p></div>
    <div class="cw-side"><div class="cw-big">${ic}</div><div class="cw-risk ${rk[1]}"><small>Risiko operasional</small><b>${rk[0]}</b><span>${esc(rk[2])}</span></div></div></div>
    <div class="cw-days">${days}</div>
    <div class="cw-grid"><div class="cw-card"><h4>Tren suhu hari ini</h4><div class="cw-sm">Suhu per jam (°C)</div>${chart(d, hi)}</div><div class="cw-card"><h4>Detail cuaca</h4>${rows}</div></div>
    <div class="cw-card"><h4>Lokasi populer</h4><div class="cw-pops">${pp || '<span class="cw-sm">Data lokasi populer tidak tersedia.</span>'}</div></div>`;
  }

  async function get(url) { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  let S = {name: 'Meunasah Cut, Nisam', lat: 5.17, lon: 97.02};
  try { const s = JSON.parse(localStorage.getItem('cw_city')); if (s && s.name && isFinite(s.lat) && isFinite(s.lon)) S = s; } catch (e) {}
  const forecastUrl = () => `${API}?latitude=${S.lat}&longitude=${S.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,surface_pressure,is_day&hourly=temperature_2m,precipitation_probability,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
  const popUrl = () => `${API}?latitude=${POP.map(c => CITIES[c][0]).join(',')}&longitude=${POP.map(c => CITIES[c][1]).join(',')}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const setCity = (name, lat, lon) => { S = {name, lat, lon}; try { localStorage.setItem('cw_city', JSON.stringify(S)); } catch (e) {} };

  async function render(el) {
    el.classList.add('cw');
    const draw = async () => {
      el.innerHTML = '<div class="cw-card cw-ld">Memuat data cuaca…</div>';
      try {
        const [d, pp] = await Promise.all([get(forecastUrl()), get(popUrl()).catch(() => null)]);
        el.innerHTML = view(d, S.name, pp);
        const q = s => el.querySelector(s), err = m => { q('#cw-err').textContent = m; };
        q('#cw-sel').onchange = e => { const c = CITIES[e.target.value]; if (c) { setCity(e.target.value, c[0], c[1]); draw(); } };
        q('#cw-rf').onclick = draw;
        el.querySelectorAll('[data-city]').forEach(b => b.onclick = () => { const c = CITIES[b.dataset.city]; setCity(b.dataset.city, c[0], c[1]); draw(); });
        const search = async () => {
          const v = q('#cw-q').value.trim(); if (!v) return;
          try {
            const g = await get('https://geocoding-api.open-meteo.com/v1/search?count=1&language=id&format=json&name=' + encodeURIComponent(v));
            if (!g.results || !g.results.length) return err('Lokasi tidak ditemukan.');
            const r = g.results[0]; setCity(r.name + (r.country ? ', ' + r.country : ''), r.latitude, r.longitude); draw();
          } catch (e) { err('Pencarian gagal: ' + e.message); }
        };
        q('#cw-go').onclick = search; q('#cw-q').onkeydown = e => { if (e.key === 'Enter') search(); };
      } catch (e) {
        el.innerHTML = `<div class="cw-card"><b>Data cuaca gagal dimuat.</b><p class="cw-sub">${esc(e.message)} — periksa koneksi internet.</p><button class="cw-btn" id="cw-retry">Coba lagi</button></div>`;
        el.querySelector('#cw-retry').onclick = draw;
      }
    };
    return draw();
  }

  // Auto-hook: when the old "Pusat Informasi Cuaca" page appears inside the app, swap in the new design.
  function hook() {
    const OLD = /Lokasi pemantauan|Cuaca saat ini|Kondisi lingkungan|Prakiraan per jam|Pusat Informasi Cuaca/i;
    let busy = false;
    const apply = () => {
      if (busy) return;
      const h = [...document.querySelectorAll('h1,h2,h3')].find(x => /Pusat Informasi Cuaca/i.test(x.textContent) && !x.closest('.cw'));
      if (!h) return;
      busy = true;
      let a = h;
      while (a.parentElement && a.parentElement !== document.body && !a.parentElement.querySelector('header,nav,aside') && !/Dashboard/.test(a.parentElement.textContent)) a = a.parentElement;
      let child = h; while (child.parentElement && child.parentElement !== a) child = child.parentElement;
      if (a === h) { busy = false; return; }
      [...a.children].forEach(c => { if (c !== child && OLD.test(c.textContent)) c.style.display = 'none'; });
      child.innerHTML = ''; child.style.display = '';
      render(child).finally(() => { busy = false; });
    };
    new MutationObserver(() => requestAnimationFrame(apply)).observe(document.body, {childList: true, subtree: true});
    apply();
  }

  if (typeof window !== 'undefined') window.CargoWeather = {render};
  if (typeof document !== 'undefined' && !document.getElementById('cw-standalone')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  }
  if (typeof module !== 'undefined') module.exports = {wmo, risk, chart, view};
})();
