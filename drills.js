/* drills.js — Kopfrechen-Drills fuer die "5 Fragen des Tages" (Mathe-Lernwelt).
   Jede Aufgabe ist Multiple Choice mit 4 Optionen: die richtige Loesung + 3 Ablenker aus TYPISCHEN
   Fehlern (Zehnerpotenz daneben, Kehrwert vergessen, Vorzeichen, Prozent als 1,3 statt 1,03 ...).
   Kein Freitext — ein Eingabeformat kann so nie faelschlich als Fehler zaehlen.
   Garantie je Aufgabe: 4 Optionen mit paarweise VERSCHIEDENEM WERT, keine davon wertgleich mit der
   Loesung ausser der richtigen (gleichwertige "nur anders geschriebene" Ablenker sind ausgeschlossen).
   Rueckgabe-Form wie eine Pool-Frage: {id, q, a:[4], r, why, knr, kapitel, art:'drill', gen}. */
(function () {
  'use strict';

  // ---------- Zufall (fuer Tests per Seed reproduzierbar) ----------
  function makeRng(seed) {
    if (seed === undefined || seed === null) return Math.random;
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function ri(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffle(rng, arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

  // ---------- Exakte Brueche ----------
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
  function R(n, d) { if (d === undefined) d = 1; if (d === 0) return null; if (d < 0) { n = -n; d = -d; } var g = gcd(n, d); return { n: n / g, d: d / g }; }
  function add(x, y) { return R(x.n * y.d + y.n * x.d, x.d * y.d); }
  function sub(x, y) { return R(x.n * y.d - y.n * x.d, x.d * y.d); }
  function mul(x, y) { return R(x.n * y.n, x.d * y.d); }
  function div(x, y) { return y.n === 0 ? null : R(x.n * y.d, x.d * y.n); }
  function key(x) { return x.n + '/' + x.d; }
  function isDecimal(x) { var d = x.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; }
  // Anzahl Nachkommastellen eines endlichen Dezimalbruchs (kleinstes p mit 10^p durch den Nenner teilbar)
  function decimals(x) { var p = 0, t = 1; while ((t % x.d) !== 0 && p < 12) { p++; t *= 10; } return p; }

  var MINUS = '−', THIN = ' ';
  function group(intStr) { return intStr.length > 4 ? intStr.replace(/\B(?=(\d{3})+(?!\d))/g, THIN) : intStr; }
  // Zahl deutsch: Ganzzahl / Dezimalzahl mit Komma; null, wenn kein endlicher Dezimalbruch
  function deNum(x) {
    if (!isDecimal(x)) return null;
    var neg = x.n < 0, n = Math.abs(x.n), p = decimals(x), scaled = n * Math.pow(10, p) / x.d;
    var s = String(Math.round(scaled));
    while (s.length <= p) s = '0' + s;
    var ip = p ? s.slice(0, s.length - p) : s, fp = p ? s.slice(s.length - p) : '';
    return (neg ? MINUS : '') + group(ip) + (fp ? ',' + fp : '');
  }
  function deFrac(x) { var s = (x.n < 0 ? MINUS : '') + Math.abs(x.n); return x.d === 1 ? s : s + '/' + x.d; }
  function deInt(n) { return (n < 0 ? MINUS : '') + group(String(Math.abs(n))); }
  function signed(n, lead) { // fuer Terme: " + 3" / " − 3"
    return (n < 0 ? ' ' + MINUS + ' ' : ' + ') + Math.abs(n);
  }

  // ---------- Optionen bauen: richtig + 3 Ablenker, Werte paarweise verschieden ----------
  function build(rng, correct, cands, keyFn, showFn) {
    var seen = {}; seen[keyFn(correct)] = true;
    var out = [];
    for (var i = 0; i < cands.length && out.length < 3; i++) {
      var c = cands[i];
      if (c === null || c === undefined) continue;
      var k = keyFn(c);
      if (k === null || seen[k]) continue;
      var shown = showFn(c);
      if (shown === null) continue;
      seen[k] = true;
      out.push(shown);
    }
    if (out.length < 3) return null;
    var right = showFn(correct);
    if (right === null) return null;
    var opts = shuffle(rng, out.concat([right]));
    return { a: opts, r: opts.indexOf(right) };
  }
  function numKey(x) { return x ? key(x) : null; }

  // ---------- Generatoren ----------
  var G = {};

  // 1) Einheiten — Zehnerpotenz-Treppe (+ Zeit mit Faktor 60)
  var UNITS = {
    laenge: { mm: 1, cm: 10, dm: 100, m: 1000, km: 1000000 },
    flaeche: { 'mm²': 1, 'cm²': 100, 'dm²': 10000, 'm²': 1000000 },
    volumen: { ml: 1, 'cm³': 1, l: 1000, 'dm³': 1000, 'm³': 1000000 },
    zeit: { s: 1, min: 60, h: 3600 }
  };
  var UNIT_PAIRS = {
    laenge: [['km', 'm'], ['km', 'dm'], ['m', 'cm'], ['m', 'mm'], ['dm', 'cm'], ['cm', 'm'], ['mm', 'cm'], ['m', 'km'], ['cm', 'dm']],
    flaeche: [['m²', 'dm²'], ['m²', 'cm²'], ['dm²', 'cm²'], ['cm²', 'mm²'], ['cm²', 'dm²'], ['dm²', 'm²']],
    volumen: [['l', 'ml'], ['m³', 'l'], ['dm³', 'l'], ['l', 'cm³'], ['ml', 'l'], ['m³', 'dm³'], ['cm³', 'l']],
    zeit: [['h', 'min'], ['min', 's'], ['h', 's'], ['min', 'h']]
  };
  G.einheiten = {
    label: 'Einheiten umrechnen', knr: 17, grundwissen: true,
    make: function (rng) {
      var art = pick(rng, ['laenge', 'laenge', 'flaeche', 'volumen', 'zeit']);
      var pair = pick(rng, UNIT_PAIRS[art]);
      var f = UNITS[art], von = pair[0], nach = pair[1];
      var v = pick(rng, [R(ri(rng, 2, 40)), R(ri(rng, 2, 40)), R(ri(rng, 11, 99), 10), R(pick(rng, [1, 3, 5, 7, 9]), 4), R(ri(rng, 2, 9), 10)]);
      var res = mul(v, R(f[von], f[nach]));
      if (!isDecimal(res) || decimals(res) > 3 || res.n / res.d > 5e8) return null;
      var ten = R(10), hund = R(100);
      var cands = [mul(res, ten), div(res, ten), mul(res, hund), div(res, hund)];
      var extra = '';
      if (art === 'zeit') {
        var step = f[von] / f[nach];               // 60 oder 3600 (bzw. 1/60 bei min -> h)
        cands = [];
        if (von === 'min' && nach === 'h') {
          if (v.d !== 1) return null;              // nur ganze Minuten, z. B. 90 min
          var hh = Math.floor(v.n / 60), rest = v.n % 60;
          // typischer Fehler: 1 h 30 min als "1,30 h" geschrieben; dazu Zehner-/Hunderter-Denken
          cands = [R(hh * 100 + rest, 100), div(v, R(100)), div(v, R(10)), mul(v, R(60))];
        } else {
          if (v.d !== 1) {
            // 2,5 h als "2 h 50 min" gelesen -> 170 min (Nachkommastellen fuer Minuten/Sekunden gehalten)
            var whole = Math.floor(v.n / v.d), fd = (deNum(sub(v, R(whole))).split(',')[1] + '0').slice(0, 2);
            cands.push(R(whole * step + parseInt(fd, 10) * (step / 60)));
          }
          // "1 h = 100 min"-Denken, Zehnerfehler, falsche Richtung
          cands.push(mul(v, R(100)), mul(v, R(10)), div(res, R(60)), mul(res, R(60)));
        }
      }
      if (art === 'flaeche') {
        // haeufigster Fehler: mit dem Laengen-Faktor (10 statt 100 je Stufe) umgerechnet
        var stufen = Math.round(Math.log(f[von] / f[nach]) / Math.log(100));
        var lin = mul(v, R(Math.pow(10, Math.max(stufen, 0)), Math.pow(10, Math.max(-stufen, 0))));
        cands.unshift(lin);
        extra = ' Bei Flächen ist jeder Schritt der Einheiten-Treppe Faktor 100, nicht 10.';
      }
      var opts = build(rng, res, cands, numKey, function (x) { var s = deNum(x); return s === null || decimals(x) > 4 ? null : s + ' ' + nach; });
      if (!opts) return null;
      var faktor = R(f[von], f[nach]);
      var fs = faktor.d === 1 ? ('· ' + deInt(faktor.n)) : (': ' + deInt(faktor.d));
      return {
        q: 'Rechne um: ' + deNum(v) + ' ' + von + ' = ? ' + nach,
        a: opts.a, r: opts.r,
        why: '1 ' + von + ' = ' + deNum(R(f[von], f[nach])) + ' ' + nach + ', also ' + deNum(v) + ' ' + von + ' ' + fs + ' = ' + deNum(res) + ' ' + nach + '.' + extra
      };
    }
  };

  // 2) Brueche — Ergebnis immer vollstaendig gekuerzt
  function properFrac(rng) { var d = ri(rng, 2, 9), n = ri(rng, 1, d - 1); while (gcd(n, d) !== 1) n = ri(rng, 1, d - 1); return R(n, d); }
  G.brueche = {
    label: 'Bruchrechnen', knr: 4, grundwissen: true,
    make: function (rng) {
      var op = pick(rng, ['div', 'mul', 'add', 'sub', 'kuerzen']);
      var showF = function (x) { return x && x.n > 0 ? deFrac(x) : null; };
      if (op === 'kuerzen') {
        var q = ri(rng, 2, 9), p = ri(rng, 1, q - 1); while (gcd(p, q) !== 1) p = ri(rng, 1, q - 1);
        var g = ri(rng, 2, 9), n = p * g, m = q * g, res = R(p, q);
        var cands = [{ n: p, d: m }, { n: n, d: q }, { n: q, d: p }, R(p + 1, q), R(p, q + 1)];
        var o = build(rng, res, cands, function (x) { return key(R(x.n, x.d)); }, function (x) { var y = R(x.n, x.d); return deFrac(y); });
        if (!o) return null;
        return { q: 'Kürze vollständig: ' + n + '/' + m, a: o.a, r: o.r,
          why: 'Größter gemeinsamer Teiler von ' + n + ' und ' + m + ' ist ' + g + ': ' + n + ' : ' + g + ' = ' + p + ', ' + m + ' : ' + g + ' = ' + q + ' → ' + deFrac(res) + '.' };
      }
      var x = properFrac(rng), y = properFrac(rng);
      var a = x.n, b = x.d, c = y.n, d = y.d;
      var res, cands, sym, why;
      if (op === 'div') {
        res = div(x, y); sym = ':';
        cands = [mul(x, y), R(b * c, a * d), R(a * d + 1, b * c), R(a * d, b * c + 1)];
        why = 'Durch einen Bruch teilen = mit dem Kehrwert malnehmen: ' + deFrac(x) + ' · ' + d + '/' + c + ' = ' + (a * d) + '/' + (b * c) + ' = ' + deFrac(res) + '.';
      } else if (op === 'mul') {
        res = mul(x, y); sym = '·';
        cands = [R(a * d, b * c), R(a + c, b + d), R(a * c, b + d), R(a * c + 1, b * d)];
        why = 'Zähler mal Zähler, Nenner mal Nenner: ' + (a * c) + '/' + (b * d) + ' = ' + deFrac(res) + '.';
      } else if (op === 'add') {
        if (b === d) return null;
        res = add(x, y); sym = '+';
        var l = b * d / gcd(b, d);
        cands = [R(a + c, b + d), R(a + c, l), mul(x, y), R(res.n + 1, res.d)];
        why = 'Hauptnenner ' + l + ': ' + (a * l / b) + '/' + l + ' + ' + (c * l / d) + '/' + l + ' = ' + (a * l / b + c * l / d) + '/' + l + ' = ' + deFrac(res) + '.';
      } else {
        if (b === d || a * d <= c * b) return null;
        res = sub(x, y); sym = MINUS;
        var l2 = b * d / gcd(b, d);
        cands = [R(Math.abs(a - c), Math.abs(b - d)), R(Math.abs(a - c), l2), add(x, y), R(res.n + 1, res.d)];
        why = 'Hauptnenner ' + l2 + ': ' + (a * l2 / b) + '/' + l2 + ' ' + MINUS + ' ' + (c * l2 / d) + '/' + l2 + ' = ' + (a * l2 / b - c * l2 / d) + '/' + l2 + ' = ' + deFrac(res) + '.';
      }
      var o2 = build(rng, res, cands, numKey, showF);
      if (!o2) return null;
      return { q: 'Berechne: ' + deFrac(x) + ' ' + sym + ' ' + deFrac(y), a: o2.a, r: o2.r, why: why };
    }
  };

  // 3) Prozent — Prozentwert und Grundwert
  G.prozent = {
    label: 'Prozentrechnen', knr: 4, grundwissen: true,
    make: function (rng) {
      var p = pick(rng, [5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75]);
      var G0 = 20 * ri(rng, 1, 20);
      var W = R(p * G0, 100);
      if (!isDecimal(W) || decimals(W) > 1) return null;
      var show = function (x) { var s = x && x.n > 0 ? deNum(x) : null; return s && decimals(x) <= 2 ? s + ' €' : null; };
      if (rng() < 0.5) {
        var o = build(rng, W, [mul(W, R(10)), div(W, R(10)), sub(R(G0), W), add(R(G0), W)], numKey, show);
        if (!o) return null;
        return { q: 'Wie viel sind ' + p + ' % von ' + G0 + ' €?', a: o.a, r: o.r,
          why: p + ' % = ' + p + '/100, also ' + G0 + ' € · ' + p + ' : 100 = ' + deNum(W) + ' €.' };
      }
      var o2 = build(rng, R(G0), [mul(W, R(p, 100)), R(G0 * 10), R(G0, 10), add(W, R(p))], numKey, show);
      if (!o2) return null;
      return { q: deNum(W) + ' € sind ' + p + ' % des Grundwerts. Wie groß ist der Grundwert?', a: o2.a, r: o2.r,
        why: '1 % sind ' + deNum(W) + ' € : ' + p + ' = ' + deNum(R(W.n, W.d * p)) + ' €, also 100 % = ' + G0 + ' €.' };
    }
  };

  // 4) Wachstumsfaktor aus Prozentsatz
  G.faktor = {
    label: 'Wachstumsfaktor', knr: 19, grundwissen: false,
    make: function (rng) {
      var p = pick(rng, [2, 3, 4, 5, 6, 7, 8, 12, 15, 20, 25, 30]);
      var up = rng() < 0.6;
      var res = up ? R(100 + p, 100) : R(100 - p, 100);
      var cands = up
        ? [R(10 + p, 10), R(p, 100), R(100 - p, 100), R(1 + p)]
        : [R(100 + p, 100), R(p, 100), (10 - p > 0 ? R(10 - p, 10) : null), R(100 - p, 10)];
      var o = build(rng, res, cands, numKey, function (x) { return x && x.n > 0 ? deNum(x) : null; });
      if (!o) return null;
      return {
        q: up ? 'Ein Bestand wächst jedes Jahr um ' + p + ' %. Wachstumsfaktor q = ?' : 'Ein Bestand nimmt jedes Jahr um ' + p + ' % ab. Faktor q = ?',
        a: o.a, r: o.r,
        why: 'q = 1 ' + (up ? '+' : MINUS) + ' ' + p + '/100 = ' + deNum(res) + (up ? ' — nicht 1,' + p + ' (das wären +' + (p * 10) + ' %).' : '.')
      };
    }
  };

  // 5) Potenzen
  var SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sup(n) { return String(n).split('').map(function (ch) { return SUP[ch]; }).join(''); }
  G.potenzen = {
    label: 'Potenzen', knr: 4, grundwissen: true,
    make: function (rng) {
      var art = pick(rng, ['wert', 'wert', 'negativ', 'klammer']);
      if (art === 'wert') {
        var pairs = [[2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [2, 9], [2, 10], [3, 2], [3, 3], [3, 4], [3, 5], [4, 2], [4, 3], [5, 2], [5, 3], [5, 4], [6, 2], [7, 2], [10, 4], [10, 5]];
        var pr = pick(rng, pairs), b = pr[0], e = pr[1], res = R(Math.pow(b, e));
        var o = build(rng, res, [R(b * e), R(Math.pow(e, b)), R(Math.pow(b, e - 1)), R(Math.pow(b, e + 1))], numKey, function (x) { return deInt(x.n); });
        if (!o) return null;
        return { q: 'Berechne: ' + b + sup(e), a: o.a, r: o.r, why: b + sup(e) + ' heißt ' + e + '-mal die ' + b + ' malnehmen = ' + deInt(res.n) + ' (nicht ' + b + ' · ' + e + ').' };
      }
      if (art === 'negativ') {
        var k = ri(rng, 1, 4), res2 = R(1, Math.pow(10, k));
        var o2 = build(rng, res2, [R(-Math.pow(10, k)), R(1, Math.pow(10, k + 1)), R(1, Math.pow(10, k - 1)), R(-10 * k)], numKey, function (x) { return deNum(x); });
        if (!o2) return null;
        return { q: 'Berechne: 10' + sup(-k), a: o2.a, r: o2.r, why: 'Negativer Exponent = Kehrwert: 10' + sup(-k) + ' = 1/10' + sup(k) + ' = ' + deNum(res2) + '. Das Minus macht die Zahl NICHT negativ.' };
      }
      var bb = pick(rng, [2, 3, 5, 10]), m = ri(rng, 2, 4), n = ri(rng, 2, 3), ex = m * n;
      var o3 = build(rng, ex, [m + n, Math.pow(m, n), ex + 1, ex - 1], function (x) { return String(x); }, function (x) { return x > 0 ? bb + sup(x) : null; });
      if (!o3) return null;
      return { q: 'Schreibe als eine Potenz: (' + bb + sup(m) + ')' + sup(n), a: o3.a, r: o3.r,
        why: 'Potenz einer Potenz: Exponenten malnehmen, ' + m + ' · ' + n + ' = ' + ex + ' → ' + bb + sup(ex) + ' (nicht addieren).' };
    }
  };

  // 6) Wurzeln
  G.wurzeln = {
    label: 'Wurzeln', knr: 5, grundwissen: true,
    make: function (rng) {
      if (rng() < 0.7) {
        var k = ri(rng, 3, 15), n = k * k;
        var o = build(rng, R(k), [R(n, 2), R(k + 1), R(k - 1), R(2 * k)], numKey, function (x) { return isDecimal(x) ? deNum(x) : null; });
        if (!o) return null;
        return { q: 'Berechne: √' + n, a: o.a, r: o.r, why: k + ' · ' + k + ' = ' + n + ', also √' + n + ' = ' + k + '.' };
      }
      var kk = ri(rng, 2, 9), rad = R(kk * kk, 100), res = R(kk, 10);
      var o2 = build(rng, res, [R(kk, 100), R(kk), R(kk * kk, 200), R(kk + 1, 10)], numKey, function (x) { return deNum(x); });
      if (!o2) return null;
      return { q: 'Berechne: √' + deNum(rad), a: o2.a, r: o2.r,
        why: deNum(res) + ' · ' + deNum(res) + ' = ' + deNum(rad) + ', also √' + deNum(rad) + ' = ' + deNum(res) + ' (Kommastellen halbieren sich beim Wurzelziehen).' };
    }
  };

  // 7) Lineare Gleichung a·x + b = c
  function linTerm(a, b) { return (a === 1 ? '' : a === -1 ? MINUS : (a < 0 ? MINUS + Math.abs(a) : String(a))) + 'x' + (b === 0 ? '' : signed(b)); }
  G.gleichung = {
    label: 'Gleichungen lösen', knr: 7, grundwissen: true,
    make: function (rng) {
      var a = ri(rng, 2, 9), x = ri(rng, -9, 12), b = ri(rng, -20, 20);
      if (x === 0 || b === 0) return null;
      var c = a * x + b;
      var cands = [((c + b) % a === 0) ? (c + b) / a : null, c - b, -x, x + 1, x - 1];
      var o = build(rng, x, cands, function (v) { return String(v); }, function (v) { return 'x = ' + deInt(v); });
      if (!o) return null;
      return { q: 'Löse: ' + linTerm(a, b) + ' = ' + deInt(c), a: o.a, r: o.r,
        why: (b > 0 ? MINUS + ' ' + b : '+ ' + Math.abs(b)) + ' auf beiden Seiten: ' + a + 'x = ' + deInt(c - b) + '; dann : ' + a + ' → x = ' + deInt(x) + '.' };
    }
  };

  // 8) Ausklammern k·p·x + k·q  ->  k(px + q)
  function inner(u, v) { return (u === 1 ? '' : String(u)) + 'x' + signed(v); }
  G.ausklammern = {
    label: 'Ausklammern', knr: 6, grundwissen: true,
    make: function (rng) {
      var k = ri(rng, 2, 9), p = ri(rng, 1, 6), q = ri(rng, 1, 9) * (rng() < 0.35 ? -1 : 1);
      if (gcd(p, q) !== 1) return null;
      var A = k * p, B = k * q;
      var corr = [k, p, q];
      var cands = [[k, p, k * q], [k * p, 1, q], [k, p, -q], [k, p + 1, q], [p, k, q]];
      var o = build(rng, corr, cands, function (t) { return (t[0] * t[1]) + '|' + (t[0] * t[2]); }, function (t) { return t[1] > 0 && t[2] !== 0 ? t[0] + '(' + inner(t[1], t[2]) + ')' : null; });
      if (!o) return null;
      return { q: 'Klammere den größten gemeinsamen Faktor aus: ' + A + 'x' + signed(B), a: o.a, r: o.r,
        why: 'ggT von ' + A + ' und ' + Math.abs(B) + ' ist ' + k + ': ' + A + 'x : ' + k + ' = ' + (p === 1 ? '' : p) + 'x, ' + deInt(B) + ' : ' + k + ' = ' + deInt(q) + ' → ' + k + '(' + inner(p, q) + '). Probe durch Ausmultiplizieren.' };
    }
  };

  // 9) Binomische Formel (x ± a)²
  function poly(A, B, C) { // x²-Polynom, A immer 1
    var s = 'x²';
    if (B !== 0) s += (B < 0 ? ' ' + MINUS + ' ' : ' + ') + (Math.abs(B) === 1 ? '' : Math.abs(B)) + 'x';
    if (C !== 0) s += (C < 0 ? ' ' + MINUS + ' ' : ' + ') + Math.abs(C);
    return s;
  }
  G.binom = {
    label: 'Binomische Formeln', knr: 4, grundwissen: true,
    make: function (rng) {
      var a = ri(rng, 1, 9), s = rng() < 0.5 ? 1 : -1;
      var corr = [1, 2 * a * s, a * a];
      var cands = [[1, 0, a * a], [1, a * s, a * a], [1, 0, -a * a], [1, 2 * a * s, -a * a], [1, -2 * a * s, a * a]];
      var o = build(rng, corr, cands, function (t) { return t.join('|'); }, function (t) { return poly(t[0], t[1], t[2]); });
      if (!o) return null;
      return { q: 'Multipliziere aus: (x ' + (s > 0 ? '+' : MINUS) + ' ' + a + ')²', a: o.a, r: o.r,
        why: (s > 0 ? '1.' : '2.') + ' binomische Formel: x² ' + (s > 0 ? '+' : MINUS) + ' 2·' + a + '·x + ' + a + '² = ' + poly(corr[0], corr[1], corr[2]) + ' — das Mittelglied nicht vergessen.' };
    }
  };

  // 10) Lineare Funktion: Steigung aus zwei Punkten / Funktionswert
  function pt(x, y) { return '(' + deInt(x) + ' | ' + deInt(y) + ')'; }
  G.steigung = {
    label: 'Steigung aus zwei Punkten', knr: 11, grundwissen: false,
    make: function (rng) {
      var m = pick(rng, [R(-3), R(-2), R(-1), R(-1, 2), R(1, 2), R(1), R(2), R(3), R(4)]);
      var dx = m.d === 2 ? pick(rng, [2, 4]) : ri(rng, 1, 4), x1 = m.d === 2 ? 2 * ri(rng, -2, 1) : ri(rng, -3, 3), t = ri(rng, -4, 4);
      var x2 = x1 + dx, y1 = (m.n * x1) / m.d + t, y2 = (m.n * x2) / m.d + t, dy = y2 - y1;
      var cands = [dy !== 0 ? R(dx, dy) : null, R(-m.n, m.d), R(dy), (x1 + x2) !== 0 ? R(y1 + y2, x1 + x2) : null, R(dy, dx + 1)];
      var o = build(rng, m, cands, numKey, function (x) { return deFrac(x); });
      if (!o) return null;
      return { q: 'Gerade durch A' + pt(x1, y1) + ' und B' + pt(x2, y2) + '. Steigung m = ?', a: o.a, r: o.r,
        why: 'm = (y₂ ' + MINUS + ' y₁) : (x₂ ' + MINUS + ' x₁) = ' + deInt(dy) + ' : ' + dx + ' = ' + deFrac(m) + ' — „hoch durch rüber", nicht umgekehrt.' };
    }
  };
  G.ywert = {
    label: 'Funktionswert berechnen', knr: 11, grundwissen: false,
    make: function (rng) {
      var m = ri(rng, -5, 5), t = ri(rng, -9, 9), x = ri(rng, -5, 5);
      if (m === 0 || t === 0 || x === 0 || m === 1) return null;
      var res = m * x + t;
      var o = build(rng, res, [m * x - t, m * (x + t), (m + t) * x, m + x + t], function (v) { return String(v); }, function (v) { return deInt(v); });
      if (!o) return null;
      return { q: 'f(x) = ' + linTerm(m, t) + '. Wie groß ist f(' + deInt(x) + ')?', a: o.a, r: o.r,
        why: 'Einsetzen: ' + deInt(m) + ' · ' + (x < 0 ? '(' + deInt(x) + ')' : x) + signed(t) + ' = ' + deInt(m * x) + signed(t) + ' = ' + deInt(res) + '.' };
    }
  };

  // 11) Scheitelpunkt aus der Scheitelpunktform
  G.scheitel = {
    label: 'Scheitelpunkt ablesen', knr: 13, grundwissen: false,
    make: function (rng) {
      var a = pick(rng, [-2, -1, 2, 3]), d = ri(rng, -5, 5), e = ri(rng, -6, 6);
      if (d === 0 || e === 0 || Math.abs(d) === Math.abs(e)) return null;
      var corr = [d, e];
      var o = build(rng, corr, [[-d, e], [d, -e], [e, d], [-d, -e]], function (t) { return t.join('|'); }, function (t) { return 'S' + pt(t[0], t[1]); });
      if (!o) return null;
      var term = (a === 1 ? '' : a === -1 ? MINUS : (a < 0 ? MINUS + Math.abs(a) : a)) + '(x ' + (d > 0 ? MINUS : '+') + ' ' + Math.abs(d) + ')²' + signed(e);
      return { q: 'f(x) = ' + term + '. Wo liegt der Scheitelpunkt?', a: o.a, r: o.r,
        why: 'Aus a(x ' + MINUS + ' d)² + e liest man S(d | e) ab. Hier steht (x ' + (d > 0 ? MINUS : '+') + ' ' + Math.abs(d) + ') — also d = ' + deInt(d) + ' (Vorzeichen umdrehen!), e = ' + deInt(e) + ' → S' + pt(d, e) + '.' };
    }
  };

  // 12) Zufall: fairer Wuerfel / zwei Muenzwuerfe (Laplace)
  var WUERFEL = [
    { t: 'Augenzahl gerade', f: function (z) { return z % 2 === 0; } },
    { t: 'Augenzahl ist eine Primzahl', f: function (z) { return z === 2 || z === 3 || z === 5; } },
    { t: 'Augenzahl durch 3 teilbar', f: function (z) { return z % 3 === 0; } },
    { t: 'keine 6', f: function (z) { return z !== 6; } }
  ];
  G.wuerfel = {
    label: 'Laplace-Wahrscheinlichkeit', knr: 18, grundwissen: false,
    make: function (rng) {
      var r0 = rng();
      if (r0 < 0.25) {
        var mind = rng() < 0.5;
        var res = mind ? R(3, 4) : R(1, 4);
        var cands = mind ? [R(1, 2), R(2, 3), R(1, 4)] : [R(1, 2), R(1, 3), R(3, 4)];
        var o = build(rng, res, cands, numKey, deFrac);
        if (!o) return null;
        return { q: 'Faire Münze, zweimal geworfen: P(' + (mind ? 'mindestens einmal Kopf' : 'zweimal Kopf') + ') = ?', a: o.a, r: o.r,
          why: 'Ergebnisse KK, KZ, ZK, ZZ — vier gleich wahrscheinliche. ' + (mind ? 'Mindestens einmal Kopf: 3 davon → 3/4.' : 'Zweimal Kopf: nur KK → 1/4.') };
      }
      var ev, k;
      if (r0 < 0.6) { k = ri(rng, 1, 4); ev = { t: 'Augenzahl größer als ' + k, f: function (z) { return z > k; } }; }
      else if (r0 < 0.75) { k = ri(rng, 2, 5); ev = { t: 'Augenzahl höchstens ' + k, f: function (z) { return z <= k; } }; }
      else ev = pick(rng, WUERFEL);
      var cnt = 0; for (var z = 1; z <= 6; z++) if (ev.f(z)) cnt++;
      var res2 = R(cnt, 6);
      var cands2 = [R(6 - cnt, 6), R(cnt, 6 - cnt), R(cnt + 1, 6), R(1, cnt), R(cnt - 1, 6)];
      var o2 = build(rng, res2, cands2, numKey, function (x) { return x && x.n > 0 && x.n <= x.d ? deFrac(x) : null; });
      if (!o2) return null;
      return { q: 'Fairer Würfel, einmal geworfen: P(' + ev.t + ') = ?', a: o2.a, r: o2.r,
        why: 'Günstige Augenzahlen: ' + cnt + ' von 6 → ' + cnt + '/6' + (res2.d !== 6 ? ' = ' + deFrac(res2) : '') + '.' };
    }
  };

  // ---------- Oeffentliche API ----------
  var KAPITEL_TITEL = { 4: 'Rechnen mit Brüchen', 5: 'Reelle Zahlen & Wurzeln', 6: 'Termumformungen', 7: 'Lineare Gleichungen',
    11: 'Funktionen', 13: 'Quadratische Funktionen', 17: 'Längen, Flächen & Volumina', 18: 'Zufall & Wahrscheinlichkeit', 19: 'Wachstum & Zerfall' };
  var counter = 0;
  function generate(name, rng) {
    var g = G[name];
    rng = rng || Math.random;
    for (var tries = 0; tries < 200; tries++) {
      var d = g.make(rng);
      if (d) {
        counter++;
        d.id = 'drill:' + name + ':' + counter;
        d.gen = name; d.art = 'drill'; d.knr = g.knr;
        d.kapitel = KAPITEL_TITEL[g.knr] || ''; d.titel = g.label; d.teil = 'Rechen-Drill';
        return d;
      }
    }
    throw new Error('Drill-Generator ' + name + ' liefert nach 200 Versuchen nichts');
  }
  window.FF_DRILLS = {
    names: Object.keys(G),
    info: function (name) { var g = G[name]; return { label: g.label, knr: g.knr, grundwissen: g.grundwissen }; },
    makeRng: makeRng,
    generate: generate
  };
})();
