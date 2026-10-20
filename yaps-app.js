/* YAPSTech - accounts + orders (shared by every page)
 * Live mode  : Supabase auth + Postgres (set keys in yaps-config.js)
 * Demo mode  : browser-only storage when no keys are set
 */
(function () {
  'use strict';
  var CFG = window.YAPS_CONFIG || {};
  var LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  var sb = null, booting = null;

  /* ---------- helpers ---------- */
  function ls(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function ss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmt(n) { return 'UGX ' + Number(n).toLocaleString('en-US'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fail(m) { throw new Error(m); }
  function ref() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'YT-'; for (var i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }

  function toast(msg, bad) {
    var t = document.getElementById('ya-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'ya-toast'; t.setAttribute('role', 'status');
      t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);z-index:600;background:#0a1d5c;border:1px solid #2fd0ff;color:#fff;padding:10px 16px;border-radius:999px;font:500 .85rem Poppins,system-ui,sans-serif;max-width:90vw;text-align:center';
      document.body.appendChild(t);
    }
    t.style.borderColor = bad ? '#ff2b43' : '#2fd0ff'; t.textContent = msg; t.style.display = '';
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, 3500);
  }

  /* ---------- boot ---------- */
  function boot() {
    if (booting) return booting;
    booting = new Promise(function (res) {
      if (!LIVE) return res();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
      s.onload = function () {
        try { sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); } catch (e) { sb = null; }
        res();
      };
      s.onerror = function () { res(); };
      document.head.appendChild(s);
    });
    return booting;
  }
  function need() { if (LIVE && !sb) fail('Could not reach the account service. Check your connection and try again.'); }

  function norm(u) {
    if (!u) return null;
    var m = u.user_metadata || {};
    return { id: u.id, email: u.email, name: m.name || u.name || '', phone: m.phone || u.phone || '' };
  }

  /* ---------- demo-mode crypto (browser only) ---------- */
  function hash(pw, salt) {
    if (!(window.crypto && crypto.subtle)) fail('This browser cannot create accounts securely. Please use a modern browser over HTTPS.');
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, k, 256);
    }).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); });
  }
  function rid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---------- auth ---------- */
  var A = {
    live: LIVE,
    ready: boot,

    user: function () {
      return boot().then(function () {
        if (LIVE) {
          if (!sb) return null;
          return sb.auth.getSession().then(function (r) { return norm(r.data && r.data.session && r.data.session.user); });
        }
        var id = ls('yaps_session', null), u = ls('yaps_users', []).filter(function (x) { return x.id === id; })[0];
        return u ? { id: u.id, email: u.email, name: u.name, phone: u.phone } : null;
      });
    },

    signUp: function (o) {
      var email = (o.email || '').trim().toLowerCase();
      if (!o.name || o.name.trim().length < 2) fail('Please enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) fail('Please enter a valid email address.');
      if (!o.password || o.password.length < 8) fail('Password must be at least 8 characters.');
      return boot().then(function () {
        need();
        if (LIVE) {
          return sb.auth.signUp({ email: email, password: o.password, options: { data: { name: o.name.trim(), phone: (o.phone || '').trim() }, emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, 'account.html') } }).then(function (r) {
            if (r.error) fail(r.error.message);
            return { needsConfirm: !r.data.session, user: norm(r.data.user) };
          });
        }
        var users = ls('yaps_users', []);
        if (users.some(function (x) { return x.email === email; })) fail('An account with this email already exists. Please sign in.');
        var salt = rid();
        return hash(o.password, salt).then(function (h) {
          var u = { id: rid(), email: email, name: o.name.trim(), phone: (o.phone || '').trim(), salt: salt, hash: h };
          users.push(u); ss('yaps_users', users); ss('yaps_session', u.id);
          changed();
          return { needsConfirm: false, user: norm(u) };
        });
      });
    },

    signIn: function (email, password) {
      email = (email || '').trim().toLowerCase();
      if (!email || !password) fail('Enter your email and password.');
      return boot().then(function () {
        need();
        if (LIVE) {
          return sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
            if (r.error) fail(/confirm/i.test(r.error.message) ? 'Please confirm your email first - check your inbox.' : 'Wrong email or password.');
            return norm(r.data.user);
          });
        }
        var u = ls('yaps_users', []).filter(function (x) { return x.email === email; })[0];
        if (!u) fail('Wrong email or password.');
        return hash(password, u.salt).then(function (h) {
          if (h !== u.hash) fail('Wrong email or password.');
          ss('yaps_session', u.id); changed();
          return norm(u);
        });
      });
    },

    signOut: function () {
      return boot().then(function () {
        if (LIVE && sb) return sb.auth.signOut();
        try { localStorage.removeItem('yaps_session'); } catch (e) {}
      }).then(changed);
    },

    updateProfile: function (o) {
      return boot().then(function () {
        need();
        if (LIVE) return sb.auth.updateUser({ data: { name: (o.name || '').trim(), phone: (o.phone || '').trim() } }).then(function (r) { if (r.error) fail(r.error.message); changed(); });
        var users = ls('yaps_users', []), id = ls('yaps_session', null);
        users.forEach(function (u) { if (u.id === id) { u.name = (o.name || '').trim(); u.phone = (o.phone || '').trim(); } });
        ss('yaps_users', users); changed();
      });
    },

    resetPassword: function (email) {
      email = (email || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) fail('Enter your email address first.');
      return boot().then(function () {
        if (!LIVE) fail('Password reset needs the live account service. In demo mode, create a new account.');
        need();
        return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(function (r) { if (r.error) fail(r.error.message); });
      });
    },

    setPassword: function (pw) {
      if (!pw || pw.length < 8) fail('Password must be at least 8 characters.');
      return boot().then(function () { need(); return sb.auth.updateUser({ password: pw }).then(function (r) { if (r.error) fail(r.error.message); }); });
    },

    onRecovery: function (cb) {
      boot().then(function () { if (sb) sb.auth.onAuthStateChange(function (ev) { if (ev === 'PASSWORD_RECOVERY') cb(); }); });
    },

    /* ---------- orders ---------- */
    createOrder: function (o) {
      return A.user().then(function (u) {
        if (!u) fail('Please sign in to place an order.');
        var items = o.items.map(function (i) { return { n: i.n, p: i.p, q: i.q }; });
        var total = items.reduce(function (a, i) { return a + i.p * i.q; }, 0);
        var row = { items: items, total: total, name: o.name, phone: o.phone, district: o.district, address: o.address, payment: o.payment, notes: o.notes || '' };
        if (LIVE) {
          row.user_id = u.id;
          return sb.from('orders').insert(row).select().single().then(function (r) {
            if (r.error) fail('Could not save your order: ' + r.error.message);
            return r.data;
          });
        }
        row.id = rid(); row.ref = ref(); row.status = 'pending'; row.created_at = new Date().toISOString(); row.user_id = u.id;
        var all = ls('yaps_orders', []); all.push(row); ss('yaps_orders', all);
        return row;
      });
    },

    myOrders: function () {
      return A.user().then(function (u) {
        if (!u) return [];
        if (LIVE) return sb.from('orders').select('*').order('created_at', { ascending: false }).then(function (r) { if (r.error) fail(r.error.message); return r.data || []; });
        return ls('yaps_orders', []).filter(function (x) { return x.user_id === u.id; }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      });
    },

    toast: toast, fmt: fmt, esc: esc, cfg: CFG,
    cart: function () { return ls('yaps_cart', []); },
    clearCart: function () { ss('yaps_cart', []); },
    wa: function (t) { return 'https://wa.me/' + (CFG.WHATSAPP || '256784729944') + '?text=' + encodeURIComponent(t); }
  };

  /* ---------- header account icon ---------- */
  var USER_SVG = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  function changed() { A.user().then(paint); try { document.dispatchEvent(new CustomEvent('yaps:auth')); } catch (e) {} }

  function paint(u) {
    [].forEach.call(document.querySelectorAll('a.ib[aria-label="Account"]'), function (a) {
      a.href = 'account.html'; a.classList.remove('hide-s');
      a.title = u ? 'Hi, ' + (u.name || u.email) : 'Sign in / Create account';
      a.setAttribute('data-in', u ? '1' : '');
    });
    [].forEach.call(document.querySelectorAll('.ya-dr-txt'), function (el) {
      el.innerHTML = u ? '<b>My Account</b><small>Hi ' + esc((u.name || '').split(' ')[0] || 'there') + ' - orders &amp; profile</small>' : '<b>Sign in / Sign up</b><small>Create an account to shop online</small>';
    });
  }

  function wire() {
    var hr = document.querySelector('header .hr');
    if (hr && !hr.querySelector('a.ib[aria-label="Account"]')) {
      var a = document.createElement('a');
      a.className = 'ib'; a.setAttribute('aria-label', 'Account'); a.href = 'account.html'; a.innerHTML = USER_SVG;
      var cart = hr.querySelector('a.ib[aria-label="Cart"]');
      hr.insertBefore(a, cart || hr.querySelector('.burger'));
    }
    var nav = document.getElementById('nav');
    if (nav && !nav.querySelector('[data-ya]')) {
      var n = document.createElement('a'); n.href = 'account.html'; n.textContent = 'Account'; n.setAttribute('data-ya', '1');
      if (/account\.html$/.test(location.pathname)) n.className = 'on';
      nav.appendChild(n);
    }
    var cta = document.querySelector('.drawer .dr-cta');
    if (cta && !document.querySelector('.drawer .ya-dr')) {
      var d = document.createElement('a'); d.className = 'dr-item blue ya-dr'; d.href = 'account.html';
      d.innerHTML = '<span style="flex:none;width:clamp(58px,17vw,74px);height:clamp(58px,17vw,74px);border-radius:18px;background:#0b2a8a;border:1.5px solid #2a7bff;display:flex;align-items:center;justify-content:center"><span style="width:48%;height:48%;display:block">' + USER_SVG + '</span></span><span class="dr-txt ya-dr-txt"></span><span class="dr-go"><svg class="i" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></span>';
      cta.parentNode.insertBefore(d, cta);
    }
    [].forEach.call(document.querySelectorAll('footer'), function (f) {
      var ql = [].filter.call(f.querySelectorAll('h6'), function (h) { return /quick links/i.test(h.textContent); })[0];
      if (ql && !f.querySelector('[data-ya-f]')) { var l = document.createElement('a'); l.href = 'account.html'; l.textContent = 'My Account'; l.setAttribute('data-ya-f', '1'); ql.parentNode.appendChild(l); }
    });
    socials();
    changed();
  }

  /* social icons: link to configured profiles, hide when none is set (no dead buttons) */
  function socials() {
    var S = CFG.SOCIAL || {}, MAP = { facebook: 'facebook', f: 'facebook', x: 'x', twitter: 'x', instagram: 'instagram', '\u25ce': 'instagram', linkedin: 'linkedin', 'in': 'linkedin', youtube: 'youtube', '\u25b6': 'youtube' };
    [].forEach.call(document.querySelectorAll('.soc a, .soc span, a[aria-label="Facebook"], a[aria-label="X"], a[aria-label="Instagram"], a[aria-label="LinkedIn"], a[aria-label="YouTube"]'), function (el) {
      var key = MAP[(el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase()];
      if (!key) return;
      var url = S[key];
      if (!url) { el.style.display = 'none'; return; }
      var a = el;
      if (el.tagName !== 'A') { a = document.createElement('a'); a.className = el.className; a.innerHTML = el.innerHTML; a.setAttribute('aria-label', key); el.parentNode.replaceChild(a, el); }
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

  /* validation errors thrown before a promise exists become rejections */
  ['signUp', 'signIn', 'resetPassword', 'setPassword'].forEach(function (k) {
    var f = A[k];
    A[k] = function () { try { return Promise.resolve(f.apply(A, arguments)); } catch (e) { return Promise.reject(e); } };
  });

  window.YAPSApp = A;
})();

/* ---------- PWA: service worker + Install App button ---------- */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return;
  var KEY = 'yaps_install_hidden', ev = null, bar = null;
  function hidden() { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 7 * 864e5; } catch (e) { return false; } }
  function hide(remember) { if (bar) { bar.remove(); bar = null; } if (remember) { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} } }
  function show(text, onClick) {
    if (bar || hidden()) return;
    bar = document.createElement('div');
    bar.setAttribute('style', 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:99999;display:flex;align-items:center;gap:6px;background:#0b1640;border:1px solid #ff3d6e;border-radius:999px;padding:6px 8px 6px 16px;box-shadow:0 6px 24px rgba(0,0,0,.5);font:600 14px system-ui,sans-serif;color:#fff;max-width:92vw');
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = text;
    b.setAttribute('style', 'background:none;border:0;color:#fff;font:inherit;cursor:pointer;padding:6px 4px');
    b.onclick = onClick;
    var x = document.createElement('button');
    x.type = 'button'; x.textContent = '\u00d7'; x.setAttribute('aria-label', 'Dismiss');
    x.setAttribute('style', 'background:#ffffff22;border:0;color:#fff;width:28px;height:28px;border-radius:50%;font-size:18px;line-height:1;cursor:pointer');
    x.onclick = function () { hide(true); };
    bar.appendChild(b); bar.appendChild(x); document.body.appendChild(bar);
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); ev = e;
    show('\u2B07 Install YAPSTech App', function () {
      if (!ev) return;
      ev.prompt();
      ev.userChoice.then(function () { ev = null; hide(false); });
    });
  });
  window.addEventListener('appinstalled', function () { hide(false); });
  /* iPhone/iPad Safari has no install event - show how-to instead */
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (ios) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        show('\u2B07 Install: tap Share, then Add to Home Screen', function () { hide(true); });
      }, 2500);
    });
  }
})();

/* ---------- offline notice ---------- */
(function () {
  'use strict';
  var n = null;
  function set() {
    if (!document.body) return;
    if (!navigator.onLine && !n) {
      n = document.createElement('div');
      n.textContent = "You're offline \u2014 showing saved pages. Orders and sign-in need internet.";
      n.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:99998;background:#ff3d6e;color:#fff;text-align:center;font:600 13px system-ui,sans-serif;padding:6px 10px');
      document.body.appendChild(n);
    } else if (navigator.onLine && n) { n.remove(); n = null; }
  }
  window.addEventListener('online', set); window.addEventListener('offline', set);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', set); else set();
})();
