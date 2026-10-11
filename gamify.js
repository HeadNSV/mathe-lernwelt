/* gamify.js — Mathe-Lernwelt Gamification-Layer (XP / Level / Streak / Widget / Gating / Intuitions-Regler)
   Additiv & non-invasiv: aendert KEINEN bestehenden Deck-/Labor-/Quiz-Code. Faellt bei Ladefehler
   (Skript fehlt/bricht) komplett aus dem Weg -- jede Seite funktioniert exakt wie ohne dieses Skript.
   Alle Keys unter dem Namespace lw_mathe_* (verhindert Bleed mit anderen Lernwelten auf demselben
   Hosting-Origin, falls Chemie/Physik/Englisch spaeter eine eigene Kopie einbinden). */
(function () {
  'use strict';
  try {

    var NS = 'lw_mathe_';
    function K(k) { return NS + k; }

    // ---------- Storage-Helfer ----------
    function getStr(k, d) { try { var v = localStorage.getItem(K(k)); return v === null ? d : v; } catch (e) { return d; } }
    function setStr(k, v) { try { localStorage.setItem(K(k), v); } catch (e) {} }
    function getNum(k, d) { var v = getStr(k, null); var n = v === null ? d : parseFloat(v); return isNaN(n) ? d : n; }
    function setNum(k, v) { setStr(k, String(v)); }
    function getJSON(k, d) { try { var v = getStr(k, null); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
    function setJSON(k, v) { try { setStr(k, JSON.stringify(v)); } catch (e) {} }

    // ---------- Level ----------
    var LEVELS = [0, 100, 250, 500, 1000, 1750, 2750];
    var NAMES = ['Kadett', 'Fähnrich', 'Lieutenant', 'Commander', 'Captain', 'Admiral'];
    function levelInfo(xpVal) {
      var i = 0;
      while (i < LEVELS.length && xpVal >= LEVELS[i]) i++;
      i--;
      if (i < NAMES.length) {
        var next = (i + 1 < LEVELS.length) ? LEVELS[i + 1] : null;
        return { name: NAMES[i], idx: i, floor: LEVELS[i], next: next };
      }
      // jenseits von Admiral: Prestige-Sterne, Wachstum weiter mit Faktor ~1.8
      var star = 0, thr = LEVELS[LEVELS.length - 1], nextThr = thr;
      while (xpVal >= nextThr) { thr = nextThr; star++; nextThr = Math.round(nextThr * 1.8); }
      return { name: 'Admiral' + (star > 1 ? ' ✦' + (star - 1) : ''), idx: NAMES.length - 1 + star, floor: thr, next: nextThr };
    }

    // ---------- XP / Streak ----------
    function xp() { return getNum('xp', 0); }
    function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function bumpStreak() {
      var s = getJSON('streak', { count: 0, lastDay: '' });
      var today = new Date(), todayKey = dayKey(today);
      if (s.lastDay === todayKey) return s;
      var y = new Date(today); y.setDate(y.getDate() - 1);
      s.count = (s.lastDay === dayKey(y)) ? (s.count || 0) + 1 : 1;
      s.lastDay = todayKey;
      setJSON('streak', s);
      return s;
    }
    function addXP(amount, src) {
      var cur = xp() + amount;
      setNum('xp', cur);
      var log = getJSON('xp_log', []);
      log.push({ ts: Date.now(), src: src, amt: amount });
      if (log.length > 200) log = log.slice(log.length - 200);
      setJSON('xp_log', log);
      bumpStreak();
      refreshWidget();
      return cur;
    }

    // ---------- Award-API ----------
    var AMOUNTS = { quiz_first: 10, quiz_retry: 4, mission: 15, deck_done: 20, mischquiz_done: 25, estimate: 8, finale: 50 };
    var sessionAwarded = {}; // in-memory, session-scoped: verhindert Spam beim Slider-Ziehen, erlaubt Wiederholung nach Reload
    function pathKey() { return location.pathname.replace(/[^a-zA-Z0-9]/g, '_'); }
    function permaKey(kind) { return 'done_' + kind + '_' + pathKey(); }
    window.lwAward = function (kind, subId) {
      subId = subId || '';
      if (kind === 'mission') {
        var mk = kind + '_' + subId;
        if (sessionAwarded[mk]) return false;
        sessionAwarded[mk] = true;
        addXP(AMOUNTS.mission, 'Labor-Mission' + (subId ? (' ' + subId) : ''));
        return true;
      }
      if (kind === 'deck_done' || kind === 'mischquiz_done') {
        var pk = permaKey(kind);
        if (getStr(pk, '') === '1') return false;
        setStr(pk, '1');
        addXP(AMOUNTS[kind], kind === 'deck_done' ? 'Deck abgeschlossen' : 'Mischquiz abgeschlossen');
        return true;
      }
      if (kind === 'finale') {
        if (getStr('done_finale', '') === '1') return false;
        setStr('done_finale', '1');
        addXP(AMOUNTS.finale, 'Lernbereich 1 komplett! 🏁');
        return true;
      }
      if (kind === 'estimate') { addXP(AMOUNTS.estimate, 'Intuitions-Regler getroffen'); return true; }
      if (kind === 'quiz_first') { addXP(AMOUNTS.quiz_first, 'Quiz richtig (1. Versuch)'); return true; }
      if (kind === 'quiz_retry') { addXP(AMOUNTS.quiz_retry, 'Quiz richtig (später)'); return true; }
      return false;
    };

    // ---------- Quiz-Beobachtung (nicht-invasiv: MutationObserver auf .quizopt-Klassenwechsel) ----------
    function initQuizObserver() {
      var mo = new MutationObserver(function (records) {
        var containers = new Map();
        records.forEach(function (r) {
          if (r.type !== 'attributes' || r.attributeName !== 'class') return;
          var el = r.target;
          if (!el.classList || !el.classList.contains('quizopt')) return;
          var box = el.closest('.quizq');
          if (!box) return;
          if (!containers.has(box)) containers.set(box, { wrong: false, correct: false });
          var info = containers.get(box);
          if (el.classList.contains('wrong')) info.wrong = true;
          if (el.classList.contains('correct')) info.correct = true;
        });
        containers.forEach(function (info, box) {
          if (box.dataset.lwAwarded) return;
          if (!info.correct) return;
          box.dataset.lwAwarded = '1';
          window.lwAward(info.wrong ? 'quiz_retry' : 'quiz_first');
        });
      });
      mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    // ---------- Deck-Abschluss (#pos erreicht "N / N") ----------
    function initDeckCompletionWatcher() {
      var posEl = document.getElementById('pos');
      if (!posEl) return;
      function check() {
        var m = /^(\d+)\s*\/\s*(\d+)$/.exec((posEl.textContent || '').trim());
        if (!m) return;
        // Zuletzt gelernt (seit 08.10.2026): Ort + Folie + Zeit — die Startseite zeigt daraus "Weiter bei ...".
        setJSON('last', { path: location.pathname, title: (document.title || '').slice(0, 80), pos: m[1] + '/' + m[2], ts: Date.now() });
        if (m[1] === m[2]) window.lwAward('deck_done');
      }
      new MutationObserver(check).observe(posEl, { childList: true, characterData: true, subtree: true });
      check();
    }

    // ---------- Mischquiz-Abschluss (#result bekommt .show, Score in #scoreBig) ----------
    function initMischquizWatcher() {
      var resultEl = document.getElementById('result'), scoreEl = document.getElementById('scoreBig');
      if (!resultEl || !scoreEl) return;
      function check() {
        if (!resultEl.classList.contains('show')) return;
        var m = /(\d+)\s*\/\s*(\d+)/.exec(scoreEl.textContent || '');
        if (!m) return;
        var right = parseInt(m[1], 10), total = parseInt(m[2], 10);
        if (total > 0 && (right / total) >= 0.6) window.lwAward('mischquiz_done');
      }
      new MutationObserver(check).observe(resultEl, { attributes: true, attributeFilter: ['class'] });
      new MutationObserver(check).observe(scoreEl, { childList: true, characterData: true, subtree: true });
    }

    // ---------- Namens-Begruessung auf der Titelfolie (DOM-Append, ersetzt nichts) ----------
    function applyNameGreeting() {
      var name = getStr('name', '');
      if (!name) return;
      var titleSlide = document.querySelector('.slide.center');
      if (!titleSlide) return;
      var marker = titleSlide.querySelector('.lwGreet');
      var text = 'Bereit, ' + name + '?';
      if (marker) { marker.textContent = text; return; }
      var p = document.createElement('p');
      p.className = 'lwGreet accent';
      p.style.marginTop = '10px';
      p.textContent = text;
      titleSlide.appendChild(p);
    }

    // ---------- Index-Integration (Name-Eingabe + Statuszeile, nur auf index.html) ----------
    function initIndexExtras() {
      var grid = document.getElementById('grid'), prog = document.querySelector('.prog');
      if (!grid || !prog) return;
      if (!document.getElementById('lwIndexName')) {
        var row = document.createElement('div');
        row.id = 'lwIndexName';
        row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0 4px;font-size:13.5px;color:#9aa4b2;';
        row.innerHTML = '<label for="lwIndexNameInput">Dein Name (optional):</label>' +
          '<input id="lwIndexNameInput" maxlength="24" style="background:#151b24;border:1px solid #2a3038;color:#e6edf3;border-radius:6px;padding:4px 8px;font-size:13.5px;width:150px;" value="' + getStr('name', '').replace(/"/g, '&quot;') + '"/>';
        prog.parentNode.insertBefore(row, prog);
        document.getElementById('lwIndexNameInput').addEventListener('change', function (e) {
          setStr('name', e.target.value.trim().slice(0, 24));
          renderIndexLine();
        });
      }
      if (!document.getElementById('lwIndexLine')) {
        var line = document.createElement('div');
        line.id = 'lwIndexLine';
        line.style.cssText = 'font-size:13.5px;color:#9aa4b2;margin:-10px 0 18px;';
        prog.parentNode.insertBefore(line, prog.nextSibling);
      }
      renderIndexLine();
    }
    function renderIndexLine() {
      var line = document.getElementById('lwIndexLine');
      if (!line) return;
      var name = getStr('name', ''), curXp = xp();
      if (curXp <= 0 && !name) { line.textContent = ''; return; }
      var li = levelInfo(curXp), streak = getJSON('streak', { count: 0, lastDay: '' });
      line.textContent = (name ? (name + ' · ') : '') + 'Level ' + (li.idx + 1) + ' (' + li.name + ') · ' + curXp + ' XP' + (streak.count > 0 ? (' · 🔥' + streak.count) : '');
    }

    // ---------- Widget: Pille + Overlay ----------
    function injectStyle() {
      var css = '#lwPill{position:fixed;right:14px;bottom:46px;z-index:9999;background:rgba(21,27,36,0.92);' +
        'border:1px solid #2a3038;border-radius:999px;padding:6px 14px;font:600 13px system-ui,sans-serif;' +
        'color:#e6edf3;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 2px 10px rgba(0,0,0,.35);user-select:none;}' +
        '#lwPill:hover{background:rgba(31,38,48,0.96);}' +
        '#lwPill .lvl{color:#f2a63c;font-weight:700;}' +
        '#lwOverlay{position:fixed;inset:0;background:rgba(8,10,14,0.85);z-index:10000;display:none;align-items:center;justify-content:center;padding:6vh 5vw;}' +
        '#lwOverlay.show{display:flex;}' +
        '#lwCard{max-width:420px;width:100%;background:#151b24;border:1px solid #2a3038;border-radius:14px;padding:22px 24px;color:#e6edf3;font-family:system-ui,sans-serif;max-height:82vh;overflow:auto;}' +
        '#lwCard h3{margin:0 0 10px;color:#f2a63c;font-size:18px;}' +
        '#lwCard .lwBarOuter{height:8px;background:#1f2630;border-radius:99px;overflow:hidden;margin:8px 0 4px;}' +
        '#lwCard .lwBarInner{height:100%;background:linear-gradient(90deg,#2e7d5b,#3dbb7a);}' +
        '#lwCard .lwSub{color:#9aa4b2;font-size:12.5px;margin-bottom:14px;}' +
        '#lwLog{font-size:12.5px;color:#9aa4b2;max-height:140px;overflow:auto;margin:10px 0;padding:8px 10px;background:#0e131b;border-radius:8px;border:1px solid #2a3038;}' +
        '#lwLog div{padding:2px 0;}' +
        '.lwToggleRow{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid #2a3038;font-size:13.5px;}' +
        '.lwToggleRow:first-of-type{border-top:none;}' +
        '.lwSwitch{width:38px;height:20px;border-radius:99px;background:#2a3038;position:relative;cursor:pointer;flex:none;}' +
        '.lwSwitch.on{background:#3dbb7a;}' +
        '.lwSwitch i{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#e6edf3;transition:left .15s;}' +
        '.lwSwitch.on i{left:20px;}' +
        '#lwCloseBtn{margin-top:14px;width:100%;background:#1f2630;color:#e6edf3;border:1px solid #2a3038;border-radius:8px;padding:9px;font-size:14px;cursor:pointer;}' +
        '#lwNameRow{display:flex;gap:8px;align-items:center;margin:8px 0 4px;font-size:13.5px;color:#9aa4b2;}' +
        '#lwNameRow input{background:#0e131b;border:1px solid #2a3038;color:#e6edf3;border-radius:6px;padding:5px 9px;font-size:13.5px;width:140px;}' +
        '.lwEstBox{background:#151b24;border:1px solid #2a3038;border-radius:10px;padding:12px 16px;margin-top:10px;}' +
        '.lwEstBox .lwEstQ{font-size:min(2.1vw,16.5px);color:#e6edf3;margin-bottom:8px;}' +
        '.lwEstBox input[type=range]{width:100%;}' +
        '.lwEstBox .lwEstVal{color:#f2a63c;font-weight:700;text-align:center;font-size:15px;margin:4px 0;}' +
        '.lwEstBox button{background:#f2a63c;color:#12100a;font-weight:700;border:0;border-radius:8px;padding:7px 16px;font-size:13.5px;cursor:pointer;margin-top:6px;}' +
        '.lwEstBox button:disabled{opacity:0.5;cursor:default;}' +
        '.lwEstFeedback{margin-top:8px;font-size:13.5px;color:#9aa4b2;min-height:18px;}' +
        '.lwGateHint{position:fixed;left:50%;bottom:46px;transform:translateX(-50%);z-index:9998;background:#3d2a12;border:1px solid #f2a63c;color:#ffe3b3;padding:7px 16px;border-radius:8px;font-size:13.5px;display:none;box-shadow:0 2px 10px rgba(0,0,0,.4);white-space:nowrap;}' +
        '.lwGateHint.show{display:block;}';
      var st = document.createElement('style');
      st.textContent = css;
      document.head.appendChild(st);
    }
    function renderPill() {
      var pill = document.getElementById('lwPill');
      if (!pill) return;
      if (getStr('hidden', '0') === '1') { pill.style.display = 'none'; return; }
      pill.style.display = 'flex';
      var li = levelInfo(xp()), streak = getJSON('streak', { count: 0, lastDay: '' });
      pill.innerHTML = '<span class="lvl">' + li.name + '</span><span>' + xp() + ' XP</span>' + (streak.count > 0 ? ('<span>🔥' + streak.count + '</span>') : '');
    }
    function refreshWidget() { renderPill(); renderIndexLine(); renderOverlayIfOpen(); }
    function buildOverlay() {
      var ov = document.createElement('div');
      ov.id = 'lwOverlay';
      ov.innerHTML = '<div id="lwCard"></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay(); });
      return ov;
    }
    function renderCard() {
      var card = document.getElementById('lwCard');
      if (!card) return;
      var curXp = xp(), li = levelInfo(curXp), streak = getJSON('streak', { count: 0, lastDay: '' });
      var pctNext = li.next ? Math.max(0, Math.min(100, Math.round((curXp - li.floor) / (li.next - li.floor) * 100))) : 100;
      var log = getJSON('xp_log', []).slice(-10).reverse();
      var name = getStr('name', '');
      var logHtml = log.length ? log.map(function (l) { return '<div>' + (l.amt > 0 ? '+' : '') + l.amt + ' XP — ' + l.src + '</div>'; }).join('') : '<div>Noch keine Einträge.</div>';
      card.innerHTML =
        '<h3>' + li.name + '</h3>' +
        '<div class="lwSub">' + curXp + ' XP' + (li.next ? (' · noch ' + (li.next - curXp) + ' bis zum nächsten Level') : ' · höchster Rang erreicht') + ' · 🔥 ' + (streak.count || 0) + ' Tag' + ((streak.count || 0) === 1 ? '' : 'e') + ' Streak</div>' +
        '<div class="lwBarOuter"><div class="lwBarInner" style="width:' + pctNext + '%"></div></div>' +
        '<div id="lwNameRow"><label for="lwCardNameInput">Name:</label><input id="lwCardNameInput" maxlength="24" placeholder="optional" value="' + name.replace(/"/g, '&quot;') + '"/></div>' +
        '<div id="lwLog">' + logHtml + '</div>' +
        '<div class="lwToggleRow"><span>🎓 Lern-Modus (Quiz-Gating)</span><div class="lwSwitch ' + (getStr('gate', '0') === '1' ? 'on' : '') + '" id="lwGateSwitch"><i></i></div></div>' +
        '<div class="lwToggleRow"><span>👁 Gamification ausblenden</span><div class="lwSwitch ' + (getStr('hidden', '0') === '1' ? 'on' : '') + '" id="lwHideSwitch"><i></i></div></div>' +
        '<button id="lwCloseBtn">Schließen</button>';
      document.getElementById('lwCardNameInput').addEventListener('change', function (e) {
        setStr('name', e.target.value.trim().slice(0, 24));
        applyNameGreeting();
        renderIndexLine();
      });
      document.getElementById('lwGateSwitch').onclick = function () {
        var on = getStr('gate', '0') !== '1';
        setStr('gate', on ? '1' : '0');
        renderCard();
      };
      document.getElementById('lwHideSwitch').onclick = function () {
        var on = getStr('hidden', '0') !== '1';
        setStr('hidden', on ? '1' : '0');
        renderPill();
        renderCard();
      };
      document.getElementById('lwCloseBtn').onclick = closeOverlay;
    }
    function openOverlay() {
      var ov = document.getElementById('lwOverlay') || buildOverlay();
      renderCard();
      ov.classList.add('show');
    }
    function closeOverlay() {
      var ov = document.getElementById('lwOverlay');
      if (ov) ov.classList.remove('show');
    }
    function renderOverlayIfOpen() {
      var ov = document.getElementById('lwOverlay');
      if (ov && ov.classList.contains('show')) renderCard();
    }
    function initWidget() {
      if (window.self !== window.top) return; // keine Pille in eingebetteten Labor-Iframes
      var pill = document.createElement('div');
      pill.id = 'lwPill';
      document.body.appendChild(pill);
      pill.onclick = openOverlay;
      renderPill();
    }

    // ---------- Optionales Gating ("Lern-Modus", Standard AUS) ----------
    function gateActive() { return getStr('gate', '0') === '1'; }
    function activeQuizProgress() {
      var slide = document.querySelector('.slide.active');
      if (!slide) return null;
      var boxes = Array.prototype.slice.call(slide.querySelectorAll('.quizq'));
      if (!boxes.length) return null;
      var answered = boxes.filter(function (b) {
        return b.querySelector('.quizopt:disabled') || b.querySelector('.quizwhy.show');
      }).length;
      return { total: boxes.length, answered: answered };
    }
    function gateBlocks() {
      if (!gateActive()) return false;
      var prog = activeQuizProgress();
      if (!prog) return false;
      return (prog.answered / prog.total) < 0.6;
    }
    var gateHintEl = null;
    function showGateHint() {
      if (!gateHintEl) {
        gateHintEl = document.createElement('div');
        gateHintEl.className = 'lwGateHint';
        gateHintEl.textContent = '🎓 Lern-Modus: erst kurz das Quiz — oder Lern-Modus im XP-Widget ausschalten.';
        document.body.appendChild(gateHintEl);
      }
      gateHintEl.classList.add('show');
      clearTimeout(gateHintEl._t);
      gateHintEl._t = setTimeout(function () { gateHintEl.classList.remove('show'); }, 2600);
    }
    function initGating() {
      window.addEventListener('keydown', function (e) {
        if ((e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') && gateBlocks()) {
          e.stopImmediatePropagation();
          e.preventDefault();
          showGateHint();
        }
      }, true);
      var nextBtn = document.getElementById('next');
      if (nextBtn) {
        nextBtn.addEventListener('click', function (e) {
          if (gateBlocks()) {
            e.stopImmediatePropagation();
            e.preventDefault();
            showGateHint();
          }
        }, true);
      }
    }

    // ---------- Intuitions-Regler (Vorwissen aktivieren) ----------
    window.lwEstimate = function (containerId, opts) {
      var el = document.getElementById(containerId);
      if (!el) return;
      opts = opts || {};
      var min = ('min' in opts) ? opts.min : 0;
      var max = ('max' in opts) ? opts.max : 100;
      var korrekt = opts.korrekt;
      var toleranz = ('toleranz' in opts) ? opts.toleranz : 0;
      var einheit = opts.einheit || '';
      var labels = opts.labels || null;
      var start = ('start' in opts) ? opts.start : Math.round((min + max) / 2);
      el.className = (el.className ? el.className + ' ' : '') + 'lwEstBox';
      function displayVal(v) { return labels ? labels[v - min] : (v + (einheit ? (' ' + einheit) : '')); }
      el.innerHTML =
        '<div class="lwEstQ">🤔 ' + opts.frage + '</div>' +
        '<input type="range" min="' + min + '" max="' + max + '" value="' + start + '" step="1" id="' + containerId + '_r"/>' +
        '<div class="lwEstVal" id="' + containerId + '_v">' + displayVal(start) + '</div>' +
        '<button id="' + containerId + '_btn">Auflösen ▸</button>' +
        '<div class="lwEstFeedback" id="' + containerId + '_fb"></div>';
      var range = document.getElementById(containerId + '_r');
      var valEl = document.getElementById(containerId + '_v');
      var btn = document.getElementById(containerId + '_btn');
      var fb = document.getElementById(containerId + '_fb');
      range.addEventListener('input', function () { valEl.textContent = displayVal(parseInt(range.value, 10)); });
      var resolved = false;
      btn.onclick = function () {
        if (resolved) return;
        resolved = true;
        var guess = parseInt(range.value, 10);
        var diff = Math.abs(guess - korrekt);
        var nearBand = Math.max(2, Math.round((max - min) * 0.1));
        range.disabled = true;
        btn.disabled = true;
        var msg;
        if (diff <= toleranz) {
          msg = '🎯 Voll getroffen! ' + (opts.begruendung || '') + ' +8 XP';
          window.lwAward && window.lwAward('estimate');
        } else if (diff <= toleranz + nearBand) {
          msg = '👀 Nah dran — es sind eigentlich ' + displayVal(korrekt) + '. ' + (opts.begruendung || '');
        } else {
          msg = '😮 Überraschung: es sind eigentlich ' + displayVal(korrekt) + '. ' + (opts.begruendung || '');
        }
        fb.textContent = msg;
      };
    };

    // ---------- Init ----------
    injectStyle();
    initWidget();
    initIndexExtras();
    applyNameGreeting();
    initQuizObserver();
    initDeckCompletionWatcher();
    initMischquizWatcher();
    initGating();

  } catch (e) { /* fail-open: nie das umgebende Deck stoeren */ }
})();
