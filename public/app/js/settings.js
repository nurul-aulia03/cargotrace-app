(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const LS = {get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} }};
  const tok = () => { try { return sessionStorage.getItem('ct_token') || localStorage.getItem('ct_token') || localStorage.getItem('token') || ''; } catch (e) { return ''; } };
  async function api(method, path, body) {
    const t0 = performance.now();
    const r = await fetch('/api' + path, {method, headers: {Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok()}, body: body ? JSON.stringify(body) : undefined});
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const er = new Error(j && j.errors ? Object.values(j.errors)[0][0] : (j && j.message) || 'Permintaan gagal (' + r.status + ')'); er.status = r.status; er.errors = j && j.errors; throw er; }
    return {data: j, ms: Math.round(performance.now() - t0), date: r.headers.get('date')};
  }
  const IP = {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>', shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>', cloud: '<path d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9"/><path d="m12 12-3 3m3-3 3 3m-3-3v9"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M17.9 17.9A10 10 0 0 1 12 19C6 19 2 12 2 12a18 18 0 0 1 4.1-5M9.9 5.1A9 9 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-2.2 3.2M1 1l22 22"/>',
    check: '<path d="m20 6-11 11-5-5"/>', alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>', logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
  };
  const ic = n => `<svg class="cs-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IP[n] || ''}</svg>`;
  const TABS = [['profil', 'user', 'Profil Saya'], ['sandi', 'lock', 'Kata Sandi'], ['notif', 'bell', 'Notifikasi'], ['sesi', 'shield', 'Sesi & Data'], ['sistem', 'server', 'Sistem']];
  const COUNTRIES = ['Indonesia', 'Malaysia', 'Singapura', 'Brunei Darussalam', 'Thailand', 'Filipina', 'Vietnam', 'Jepang', 'Tiongkok', 'India', 'Australia', 'Belanda', 'Jerman', 'Inggris', 'Amerika Serikat'];
  const ROLE = {admin: 'Administrator', operator: 'Operator Logistik', customer: 'Pelanggan'};
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  const splitName = n => { const p = String(n || '').trim().split(/\s+/); return [p.shift() || '', p.join(' ')]; };
  function strength(p) {
    let s = 0; if (p.length >= 8) s++; if (p.length >= 12) s++; if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(4, p ? Math.max(1, s - (p.length < 8 ? 1 : 0)) : 0);
  }
  const SLBL = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'];

  function fileToAvatar(file) {
    return new Promise((res, rej) => {
      if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return rej(new Error('Format harus PNG, JPG, atau WEBP.'));
      if (file.size > 2 * 1024 * 1024) return rej(new Error('Ukuran foto maksimal 2 MB.'));
      const fr = new FileReader();
      fr.onerror = () => rej(new Error('Gagal membaca file.'));
      fr.onload = () => { const im = new Image(); im.onerror = () => rej(new Error('File gambar tidak valid.'));
        im.onload = () => { const s = 256, c = document.createElement('canvas'), m = Math.min(im.width, im.height), x = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
          g.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, s, s); res(c.toDataURL('image/jpeg', .86)); }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }

  let cur = null;
  function render(el) {
    el.classList.add('cs'); solo(el);
    let tab = LS.get('cs_tab', 'profil'); if (!TABS.some(t => t[0] === tab)) tab = 'profil';
    let user = null, offline = false, saved = null, photo = LS.get('cs_avatar', ''), sys = null, editing = false;
    const local = () => LS.get('cs_profile', {});
    el.innerHTML = `
    <div class="cs-card"><div class="cs-tabs" id="cs-tabs" role="tablist">${TABS.map(t => `<button role="tab" data-t="${t[0]}">${ic(t[1])}${t[2]}</button>`).join('')}</div><div id="cs-body"></div></div><div class="cs-toast" id="cs-toast"></div>`;
    const q = s => el.querySelector(s), body = () => q('#cs-body');
    const toast = (m, bad) => { const t = q('#cs-toast'); if (!t) return; t.textContent = m; t.className = 'cs-toast on' + (bad ? ' bad' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 3200); };
    const row = (l, d, c) => `<div class="cs-row"><div class="cs-l"><b>${l}</b>${d ? `<small>${d}</small>` : ''}</div><div class="cs-c">${c}</div></div>`;
    const tg = (attr, on, label, desc, dis) => `<label class="cs-tg ${dis ? 'dis' : ''}"><span><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span><input type="checkbox" ${attr} ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><i></i></label>`;
    const initials = () => { const [a, b] = splitName((user && user.name) || 'U'); return (a[0] || 'U').toUpperCase() + (b[0] || '').toUpperCase(); };
    const avatar = () => photo ? `<img src="${esc(photo)}" alt="Foto profil">` : `<span>${esc(initials())}</span>`;

    async function loadUser() {
      try { user = (await api('GET', '/user')).data; offline = false; }
      catch (e) { offline = true; user = {name: local().name || 'Admin', email: local().email || '', role: 'admin'}; }
      saved = snapshot(); draw();
    }
    const snapshot = () => { const [f, l] = splitName(user.name); return {first: f, last: l, email: user.email || '', country: local().country || 'Indonesia'}; };


    function pProfileDetails() {
      const role = ROLE[user.role] || user.role || '-';
      const country = (saved && saved.country) || local().country || 'Indonesia';
      let joined = '—';

      if (user.created_at) {
        const d = new Date(user.created_at);
        if (!Number.isNaN(d.getTime())) {
          joined = new Intl.DateTimeFormat('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
          }).format(d);
        }
      }

      return `<section class="cs-profile-hero">
        <div class="cs-profile-top">
          <div class="cs-profile-eyebrow">AKUN CARGOTRACE</div>
          <button class="cs-btn p" id="cs-editprofile">Edit Profil</button>
        </div>
        <div class="cs-profile-identity">
          <div class="cs-profile-avatar">${avatar()}</div>
          <div class="cs-profile-intro">
            <h2 class="cs-profile-name">${esc(user.name || 'Pengguna CargoTrace')}</h2>
            <div class="cs-profile-email">${esc(user.email || 'Email belum tersedia')}</div>
            <span class="cs-role-pill">${esc(role)}</span>
          </div>
        </div>
        ${offline ? '<div class="cs-warn">Data akun belum terhubung ke server.</div>' : ''}
      </section>
      <section class="cs-profile-section">
        <div class="cs-ph"><div><h3>Detail Akun</h3><p class="cs-sub">Informasi akun CargoTrace Anda.</p></div></div>
        <div class="cs-profile-grid">
          <div class="cs-profile-item"><small>Nama Lengkap</small><b>${esc(user.name || '-')}</b></div>
          <div class="cs-profile-item"><small>Alamat Email</small><b>${esc(user.email || '-')}</b></div>
          <div class="cs-profile-item"><small>Peran Akun</small><b>${esc(role)}</b></div>
          <div class="cs-profile-item"><small>Negara</small><b>${esc(country)}</b></div>
          <div class="cs-profile-item"><small>Bergabung Sejak</small><b>${esc(joined)}</b></div>
          <div class="cs-profile-item"><small>Status Profil</small><b>${offline ? 'Mode lokal' : 'Terhubung ke server'}</b></div>
        </div>
      </section>
      <section class="cs-profile-section">
        <div class="cs-ph"><div><h3>Pengelolaan Akun</h3><p class="cs-sub">Kelola informasi dan keamanan akun.</p></div></div>
        <div class="cs-profile-actions">
          <button class="cs-profile-action" data-profile-action="edit"><b>Edit Informasi Profil</b><small>Perbarui nama, email, dan foto profil</small></button>
          <button class="cs-profile-action" data-profile-action="password"><b>Keamanan Kata Sandi</b><small>Ubah kata sandi akun</small></button>
          <button class="cs-profile-action" data-profile-action="notifications"><b>Preferensi Notifikasi</b><small>Atur pemberitahuan CargoTrace</small></button>
          <button class="cs-profile-action" data-profile-action="sessions"><b>Sesi & Data</b><small>Periksa sesi dan data lokal</small></button>
        </div>
      </section>`;
    }

    // ---------- Profil ----------
    function pProfil() {
      const s = saved;
      return `<div class="cs-ph"><div><h3>Informasi Pribadi</h3><p class="cs-sub">Perbarui foto dan detail pribadi Anda di sini.</p></div><div class="cs-btns"><button class="cs-btn" id="cs-cancel" disabled>Batal</button><button class="cs-btn p" id="cs-save" disabled>Simpan Perubahan</button></div></div>
      ${offline ? '<div class="cs-warn">Belum login atau API tidak tersedia. Perubahan hanya tersimpan di browser ini.</div>' : ''}
      ${row('Nama', 'Nama depan dan belakang Anda.', `<div class="cs-two"><input id="f-first" value="${esc(s.first)}" placeholder="Nama depan" autocomplete="given-name"><input id="f-last" value="${esc(s.last)}" placeholder="Nama belakang" autocomplete="family-name"></div><div class="cs-er" id="e-name"></div>`)}
      ${row('Email', 'Dipakai untuk masuk ke akun.', `<input id="f-email" type="email" value="${esc(s.email)}" placeholder="nama@email.com" autocomplete="email"><div class="cs-er" id="e-email"></div>`)}
      ${row('Foto Anda', 'Foto ini ditampilkan di profil Anda.', `<div class="cs-photo"><div class="cs-av" id="cs-av">${avatar()}</div><label class="cs-drop" id="cs-drop" tabindex="0"><span class="cs-up">${ic('cloud')}</span><b>Klik untuk unggah</b> atau seret dan lepas<small>PNG, JPG, atau WEBP (maks. 2 MB)</small><input type="file" id="f-file" accept="image/png,image/jpeg,image/webp" hidden></label></div><div class="cs-ph2">${photo ? '<button class="cs-lk" id="cs-rmph">Hapus foto</button>' : ''}<span class="cs-er" id="e-photo"></span></div>`)}
      ${row('Peran', 'Peran diatur oleh administrator sistem.', `<input value="${esc(ROLE[user.role] || user.role || '-')}" readonly class="ro">`)}
      ${row('Negara', 'Tersimpan di browser ini.', `<select id="f-country">${COUNTRIES.map(c => `<option ${c === s.country ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}`;
    }
    function cur2() { return {first: q('#f-first').value.trim(), last: q('#f-last').value.trim(), email: q('#f-email').value.trim(), country: q('#f-country').value}; }
    function dirty() { if (!q('#f-first')) return; const c = cur2(), s = saved, d = c.first !== s.first || c.last !== s.last || c.email !== s.email || c.country !== s.country; q('#cs-save').disabled = !d; q('#cs-cancel').disabled = !d; }
    async function saveProfile() {
      const c = cur2(); q('#e-name').textContent = ''; q('#e-email').textContent = '';
      const name = (c.first + ' ' + c.last).trim();
      if (!c.first) return (q('#e-name').textContent = 'Nama depan wajib diisi.');
      if (!validEmail(c.email)) return (q('#e-email').textContent = 'Format email tidak valid.');
      const b = q('#cs-save'); b.disabled = true; b.textContent = 'Menyimpan...';
      let msg = 'Profil berhasil disimpan.';
      try { user = (await api('PATCH', '/profile', {name, email: c.email})).data; offline = false; }
      catch (e) {
        if (e.status === 422) { q('#' + (e.errors && e.errors.email ? 'e-email' : 'e-name')).textContent = e.message; b.textContent = 'Simpan Perubahan'; b.disabled = false; return; }
        if (e.status === 404 || e.status === 405 || e.status === 401 || !e.status) { user = Object.assign({}, user, {name, email: c.email}); LS.set('cs_profile', Object.assign(local(), {name, email: c.email})); msg = 'Disimpan di browser ini. Endpoint server belum terpasang atau Anda belum login.'; }
        else { toast(e.message, true); b.textContent = 'Simpan Perubahan'; b.disabled = false; return; }
      }
      LS.set('cs_profile', Object.assign(local(), {country: c.country}));
      saved = snapshot(); editing = false; draw(); toast(msg);
    }

    // ---------- Kata sandi ----------
    function pSandi() {
      const f = (id, l, ac) => `<div class="cs-pw"><input id="${id}" type="password" autocomplete="${ac}" placeholder="${l}"><button type="button" class="cs-eye" data-eye="${id}" aria-label="Tampilkan sandi">${ic('eye')}</button></div>`;
      return `<div class="cs-ph"><div><h3>Ubah Kata Sandi</h3><p class="cs-sub">Gunakan kata sandi yang kuat dan belum dipakai di tempat lain.</p></div><div class="cs-btns"><button class="cs-btn p" id="cs-pwsave" disabled>Perbarui Kata Sandi</button></div></div>
      ${row('Kata sandi saat ini', 'Untuk memastikan ini benar-benar Anda.', f('p-cur', 'Kata sandi saat ini', 'current-password') + '<div class="cs-er" id="e-cur"></div>')}
      ${row('Kata sandi baru', 'Minimal 8 karakter.', f('p-new', 'Kata sandi baru', 'new-password') + '<div class="cs-bar"><i id="cs-sb"></i></div><small class="cs-sl" id="cs-sl"></small><div class="cs-er" id="e-new"></div>')}
      ${row('Ulangi kata sandi baru', '', f('p-cf', 'Ulangi kata sandi baru', 'new-password') + '<div class="cs-er" id="e-cf"></div>')}
      ${row('Persyaratan', '', `<ul class="cs-rl" id="cs-rl"><li data-r="len">Minimal 8 karakter</li><li data-r="case">Huruf besar dan kecil</li><li data-r="num">Mengandung angka</li><li data-r="sym">Mengandung simbol</li></ul>`)}`;
    }
    function pwState() {
      const n = q('#p-new').value, c = q('#p-cur').value, f = q('#p-cf').value, sc = strength(n);
      q('#cs-sb').style.width = (sc * 25) + '%'; q('#cs-sb').className = 's' + sc; q('#cs-sl').textContent = n ? 'Kekuatan: ' + SLBL[sc] : '';
      const ok = {len: n.length >= 8, case: /[a-z]/.test(n) && /[A-Z]/.test(n), num: /\d/.test(n), sym: /[^A-Za-z0-9]/.test(n)};
      el.querySelectorAll('#cs-rl li').forEach(li => li.classList.toggle('ok', !!ok[li.dataset.r]));
      q('#e-cf').textContent = f && f !== n ? 'Konfirmasi tidak sama.' : '';
      q('#cs-pwsave').disabled = !(c && n.length >= 8 && n === f && n !== c);
    }
    async function savePw() {
      const b = q('#cs-pwsave'); ['cur', 'new', 'cf'].forEach(k => { q('#e-' + k).textContent = ''; });
      b.disabled = true; b.textContent = 'Memproses...';
      try { await api('POST', '/profile/password', {current_password: q('#p-cur').value, password: q('#p-new').value, password_confirmation: q('#p-cf').value}); draw(); toast('Kata sandi berhasil diperbarui.'); }
      catch (e) {
        b.textContent = 'Perbarui Kata Sandi';
        if (e.status === 404 || e.status === 405) toast('Fitur ini butuh endpoint server (ProfileController) yang belum terpasang.', true);
        else if (e.status === 401) toast('Sesi berakhir. Silakan login ulang.', true);
        else { q(e.errors && e.errors.current_password ? '#e-cur' : '#e-new').textContent = e.message; }
        pwState();
      }
    }

    // ---------- Notifikasi ----------
    function pNotif() {
      const pr = Object.assign({delay: true, exception: true, status: true, delivered: true}, LS.get('cn_prefs', {})), br = LS.get('cn_browser', false) && window.Notification && Notification.permission === 'granted';
      return `<div class="cs-ph"><div><h3>Preferensi Notifikasi</h3><p class="cs-sub">Pengaturan ini langsung dipakai di halaman Notifikasi.</p></div></div>
      ${row('Jenis notifikasi', 'Pilih peristiwa yang ingin Anda terima.', tg('data-p="delay"', pr.delay, 'Keterlambatan pengiriman', 'ETA melewati jadwal.') + tg('data-p="exception"', pr.exception, 'Pengecualian', 'Masalah seperti bea cukai atau kemacetan pelabuhan.') + tg('data-p="status"', pr.status, 'Perubahan status', 'Dijemput, dalam perjalanan, dan sebagainya.') + tg('data-p="delivered"', pr.delivered, 'Pengiriman terkirim', 'Paket sudah diterima.'))}
      ${row('Metode pemberitahuan', '', tg('data-m="sys"', LS.get('cn_sys', true), 'Pemberitahuan di aplikasi', 'Pesan singkat saat ada notifikasi baru.') + tg('data-m="br"', br, 'Notifikasi browser', !window.Notification ? 'Browser ini tidak mendukung.' : (Notification.permission === 'denied' ? 'Diblokir di pengaturan browser.' : 'Butuh izin dari browser.'), !window.Notification) + tg('', false, 'Email', 'Butuh server surat dan belum tersedia.', true))}`;
    }

    // ---------- Sesi & Data ----------
    const PFX = /^(cn_|cw_|cj_|cs_)/;
    const lsKeys = () => { const o = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (PFX.test(k)) o.push(k); } } catch (e) {} return o; };
    function pSesi() {
      const keys = lsKeys(), kb = keys.reduce((n, k) => n + (localStorage.getItem(k) || '').length, 0) / 1024, t = tok();
      return `<div class="cs-ph"><div><h3>Sesi & Data Lokal</h3><p class="cs-sub">Kontrol sesi login dan data yang tersimpan di browser ini.</p></div></div>
      ${row('Sesi saat ini', 'Akun yang sedang masuk.', `<div class="cs-kv"><div><small>Akun</small>${esc(user.email || user.name || '-')}</div><div><small>Peran</small>${esc(ROLE[user.role] || user.role || '-')}</div><div><small>Token</small>${t ? esc(t.slice(0, 6)) + '••••••' : 'Tidak ada'}</div></div><button class="cs-btn d" id="cs-out">${ic('logout')}Keluar dari sesi ini</button>`)}
      ${row('Data lokal', `${keys.length} item · ${kb.toFixed(1)} KB`, `<p class="cs-sub">Berisi status notifikasi, kota cuaca, kota jam dunia, dan foto profil.</p><div class="cs-btns l"><button class="cs-btn" data-clear="cn_">${ic('bell')}Reset notifikasi</button><button class="cs-btn" data-clear="cw_,cj_">${ic('clock')}Reset cuaca & jam</button><button class="cs-btn d" data-clear="all">${ic('trash')}Hapus semua data lokal</button></div>`)}`;
    }

    // ---------- Sistem ----------
    function pSistem() {
      const mods = [['CargoWeather', 'Cuaca'], ['CargoMap', 'Peta Pengiriman'], ['CargoClock', 'Jam Dunia'], ['CargoNotif', 'Notifikasi'], ['CargoSettings', 'Pengaturan']];
      const st = (ok, t, d) => `<div class="cs-sc ${ok == null ? '' : ok ? 'ok' : 'bad'}"><small>${t}</small><b>${d}</b></div>`;
      return `<div class="cs-ph"><div><h3>Status Sistem</h3><p class="cs-sub">Pemeriksaan koneksi ke server dan modul yang terpasang.</p></div><div class="cs-btns"><button class="cs-btn" id="cs-chk">${ic('refresh')}Periksa ulang</button></div></div>
      <div class="cs-sg" id="cs-sg">${sys ? sys : st(null, 'Memeriksa...', '...')}</div>
      ${row('Modul terpasang', 'Fitur tambahan yang termuat di halaman ini.', `<div class="cs-chips">${mods.map(m => `<span class="${window[m[0]] ? 'ok' : ''}">${ic(window[m[0]] ? 'check' : 'alert')}${m[1]}</span>`).join('')}</div>`)}`;
    }
    async function checkSys() {
      const st = (ok, t, d) => `<div class="cs-sc ${ok == null ? '' : ok ? 'ok' : 'bad'}"><small>${t}</small><b>${d}</b></div>`;
      let h = '';
      try { const r = await api('GET', '/dashboard'); const dv = r.date ? Math.round((new Date(r.date).getTime() - Date.now()) / 1000) : null;
        h = st(true, 'API Laravel', `Terhubung · ${r.ms} ms`) + st(true, 'Database', `${r.data.total} pengiriman`) + st(true, 'Pengguna', esc(ROLE[user.role] || user.role || '-')) + st(dv == null ? null : Math.abs(dv) <= 5, 'Selisih jam server dan perangkat', dv == null ? 'Tidak diketahui' : (Math.abs(dv) <= 1 ? 'Sinkron' : dv + ' detik'));
      } catch (e) { h = st(false, 'API Laravel', e.status === 401 ? 'Belum login' : 'Tidak terhubung') + st(null, 'Database', '-') + st(null, 'Pengguna', '-') + st(null, 'Selisih jam', '-'); }
      sys = h; if (q('#cs-sg')) q('#cs-sg').innerHTML = h;
    }

    // ---------- gambar & event ----------
    function draw() {
      const b = body(); if (!b) return;
      el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === tab));
      if (!user) { b.innerHTML = '<div class="cs-ld">Memuat...</div>'; return; }
      b.innerHTML = tab === 'profil' ? (editing ? pProfil() : pProfileDetails()) : tab === 'sandi' ? pSandi() : tab === 'notif' ? pNotif() : tab === 'sesi' ? pSesi() : pSistem();
      if (tab === 'sistem') checkSys();
    }
    async function setPhoto(file) {
      q('#e-photo').textContent = '';
      try { const d = await fileToAvatar(file); if (!LS.set('cs_avatar', d)) throw new Error('Penyimpanan browser penuh.'); photo = d; draw(); toast('Foto profil diperbarui.'); }
      catch (e) { q('#e-photo').textContent = e.message; }
    }
    el.onclick = async e => {
      const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; if (tab === 'profil') editing = false; LS.set('cs_tab', tab); return draw(); }
      const eye = e.target.closest('[data-eye]'); if (eye) { const i = q('#' + eye.dataset.eye), s = i.type === 'password'; i.type = s ? 'text' : 'password'; eye.innerHTML = ic(s ? 'eyeoff' : 'eye'); return; }
      if (e.target.closest('#cs-editprofile') || e.target.closest('[data-profile-action="edit"]')) { editing = true; return draw(); }
      const pa = e.target.closest('[data-profile-action]');
      if (pa) { const dest = {password:'sandi', notifications:'notif', sessions:'sesi'}[pa.dataset.profileAction]; if (dest) { tab = dest; LS.set('cs_tab', tab); return draw(); } }
      if (e.target.closest('#cs-save')) return saveProfile();
      if (e.target.closest('#cs-cancel')) { editing = false; draw(); return; }
      if (e.target.closest('#cs-rmph')) { e.preventDefault(); LS.del('cs_avatar'); photo = ''; draw(); return toast('Foto dihapus.'); }
      if (e.target.closest('#cs-pwsave')) return savePw();
      if (e.target.closest('#cs-chk')) { sys = null; q('#cs-sg').innerHTML = ''; return checkSys(); }
      if (e.target.closest('#cs-out')) { try { await api('POST', '/logout'); } catch (er) {} try { sessionStorage.clear(); localStorage.removeItem('ct_token'); } catch (er) {} location.reload(); return; }
      const cl = e.target.closest('[data-clear]');
      if (cl) {
        const v = cl.dataset.clear, all = v === 'all', ps = all ? null : v.split(',');
        if (!confirm(all ? 'Hapus SEMUA data lokal (notifikasi, kota, foto profil)? Sesi login tidak terpengaruh.' : 'Reset data ini?')) return;
        lsKeys().filter(k => all || ps.some(p => k.startsWith(p))).forEach(k => LS.del(k)); if (all) photo = ''; draw(); toast('Data lokal dihapus.');
      }
    };
    el.oninput = e => { if (/^f-/.test(e.target.id)) dirty(); else if (/^p-/.test(e.target.id)) pwState(); };
    el.onchange = async e => {
      const t = e.target, d = t.dataset || {};
      if (t.id === 'f-country') return dirty();
      if (t.id === 'f-file' && t.files[0]) return setPhoto(t.files[0]);
      if (d.p) { const pr = LS.get('cn_prefs', {}); pr[d.p] = t.checked; LS.set('cn_prefs', pr); toast('Preferensi disimpan.'); return; }
      if (d.m === 'sys') { LS.set('cn_sys', t.checked); toast('Preferensi disimpan.'); return; }
      if (d.m === 'br') { if (!t.checked) LS.set('cn_browser', false); else { const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); LS.set('cn_browser', p === 'granted'); if (p !== 'granted') toast('Izin notifikasi tidak diberikan.', true); } draw(); }
    };
    ['dragover', 'dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => {
      const dz = e.target.closest && e.target.closest('#cs-drop'); if (!dz) return; e.preventDefault();
      dz.classList.toggle('over', ev === 'dragover'); if (ev === 'drop' && e.dataTransfer.files[0]) setPhoto(e.dataTransfer.files[0]);
    }));
    el.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'cs-drop') { e.preventDefault(); q('#f-file').click(); } };
    draw(); loadUser();
  }

  function solo(el) {
    const clear = c => /rgba\(0, 0, 0, 0\)|transparent/.test(c), b = getComputedStyle(document.body), h = getComputedStyle(document.documentElement);
    if (clear(b.backgroundColor) && clear(h.backgroundColor) && b.backgroundImage === 'none' && h.backgroundImage === 'none') {
      document.documentElement.style.background = '#150f1d'; document.body.style.background = '#150f1d'; document.body.style.margin = '0';
      el.style.cssText += ';max-width:1100px;margin:0 auto;padding:24px';
    }
  }

  function hook() {
    let busy = false;
    const wrapGo = () => {
      if (typeof window.go !== 'function' || window.go.__cs) return;
      const og = window.go;
      const w = async function (v) {
        const r = await og.apply(this, arguments), view = document.getElementById('view');
        if (view) { if (/pengatur|setting/i.test(String(v))) { if (!view.querySelector('.cs-head')) { view.innerHTML = ''; render(view); } } else view.classList.remove('cs'); }
        return r;
      };
      w.__cs = 1; window.go = w;
    };
    wrapGo();
    const findTitle = () => {
      for (const e of document.querySelectorAll('h1,h2,h3,div,span,p')) {
        if (e.children.length || e.closest('.cs,nav,aside')) continue;
        if (!/^(Pengaturan|Settings)$/i.test((e.textContent || '').trim())) continue;
        const r = e.getBoundingClientRect(); if (r.top + window.scrollY < 110 && r.left > 230) return e;
      }
      return null;
    };
    const apply = () => {
      if (busy) return; const t = findTitle(); if (!t) return;
      let host = null;
      for (let x = t; x && x !== document.body; x = x.parentElement) { const n = x.nextElementSibling; if (n && !n.matches('script,style') && (n.children.length || n.offsetHeight > 150)) { host = n; break; } }
      if (!host || host.classList.contains('cs') || host.querySelector('.cs-head')) return;
      busy = true; [...host.children].forEach(c => { c.style.display = 'none'; });
      const box = document.createElement('div'); box.className = 'cs-host'; host.appendChild(box); render(box); setTimeout(() => { busy = false; }, 300);
    };
    new MutationObserver(() => requestAnimationFrame(apply)).observe(document.body, {childList: true, subtree: true});
    apply();
  }

  if (typeof window !== 'undefined') window.CargoSettings = {render};
  if (typeof document !== 'undefined' && document.getElementById('cs-standalone')) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook(); }
  if (typeof module !== 'undefined') module.exports = {strength, validEmail, splitName};
})();
