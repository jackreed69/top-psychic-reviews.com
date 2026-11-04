/* Pause Practice (AI): репетиція складних моментів сесії. Потік від Cloudflare Worker (OpenRouter).
   Локально (є порт у адресі) Worker береться з 127.0.0.1:8851; на проді запит іде на той самий домен. */
(function () {
  'use strict';
  var root = document.getElementById('pp-app');
  if (!root) return;
  var API = (location.port ? 'http://127.0.0.1:8851' : '') + '/api/pause-practice/';
  var $ = function (s) { return root.querySelector(s); };
  var el = {
    booth: $('#pp-booth'), start: $('#pp-start'), thread: $('#pp-thread'), ctx: $('#pp-ctx'), tell: $('#pp-tell'),
    pause: $('#pp-pause'), pauseBox: $('#pp-pause-box'), starters: $('#pp-starters'), reply: $('#pp-reply'),
    text: $('#pp-text'), count: $('#pp-count'), send: $('#pp-send'), status: $('#pp-status'), who: $('#pp-who'),
    pin: $('#pp-pin'), fill: $('#pp-fill'), coach: $('#pp-coach'), scores: $('#pp-scores'), rewrite: $('#pp-rewrite'),
    next: $('#pp-next'), actions: $('#pp-actions'), again: $('#pp-again'), other: $('#pp-other'), copy: $('#pp-copy'),
    toneIn: $('#pp-tone'), toneNow: $('#pp-tone-now'), momentName: $('#pp-moment-name')
  };
  var TONES = ['Very gentle', 'Warm and polite', 'Balanced and steady', 'Firm and direct', 'Very firm and brief'];
  var busy = false, st = null;

  function val(name) { var c = root.querySelector('input[name="' + name + '"]:checked'); return c ? c.value : ''; }
  function setStatus(msg, err) {
    el.status.className = 'pp-status' + (err ? ' err' : '');
    if (msg === '...') { el.status.innerHTML = '<span class="pp-dots" aria-hidden="true"><span></span><span></span><span></span></span> Working on it'; }
    else { el.status.textContent = msg || ''; }
  }
  function pressure(p) { // p: 0..100 (100 = highest pressure)
    el.fill.style.width = (100 - p) + '%';
    el.pin.style.left = p + '%';
  }
  function bubble(cls, who, text) {
    var d = document.createElement('div');
    d.className = 'pp-msg pp-msg--' + cls;
    var s = document.createElement('small'); s.textContent = who;
    var t = document.createElement('div'); t.textContent = text;
    d.appendChild(s); d.appendChild(t);
    el.thread.appendChild(d);
    return d;
  }
  function parse(buf) {
    var out = { scores: {}, starters: [] };
    buf.split(/\r?\n/).forEach(function (line) {
      var p = line.trim().split('|');
      if (p.length < 2) return;
      var k = p[0].replace(/[^A-Z]/g, '');
      var rest = p.slice(1).join('|').trim();
      if (k === 'SCORE' && p.length >= 4) {
        var n = parseInt(p[2], 10);
        if (n >= 1 && n <= 5) out.scores[p[1].trim().toLowerCase()] = { n: n, why: p.slice(3).join('|').trim() };
      } else if (k === 'STARTER') { if (rest) out.starters.push(rest); }
      else if (rest) { out[k.toLowerCase()] = rest; }
    });
    return out;
  }
  // Читає SSE; повертає {text, cut}. onText викликається на кожному фрагменті.
  function run(payload, onText) {
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || 'Something went wrong.'); }, function () { throw new Error('Something went wrong.'); });
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '', text = '', cut = false;
      function pump() {
        return reader.read().then(function (x) {
          if (x.done) return { text: text, cut: cut };
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            var chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            if (chunk.indexOf('data:') !== 0) continue;
            var d = chunk.slice(5).trim();
            if (d === '[DONE]') continue;
            try { var o = JSON.parse(d); if (o.t) { text += o.t; onText(text); } if (o.cut) cut = true; } catch (e) { /* пропуск */ }
          }
          return pump();
        });
      }
      return pump();
    });
  }
  // Один автоматичний повтор, якщо потік обірвано або бракує потрібних рядків.
  function runWithRetry(payload, onText, complete) {
    return run(payload, onText).then(function (res) {
      if (!res.cut && complete(parse(res.text))) return res;
      setStatus('The line was cut short. Trying once more...');
      return run(payload, onText).then(function (r2) {
        if (!complete(parse(r2.text))) throw new Error('The coach could not finish this round.');
        return r2;
      });
    });
  }
  function lock(on) { busy = on; el.start.disabled = on; el.send.disabled = on; }
  function fail(e) {
    lock(false);
    setStatus((e && e.message) || 'Something went wrong. Please try again.', true);
  }

  function renderScene(p) {
    if (p.context) el.ctx.textContent = p.context;
    var line = p.line || '';
    var cur = el.thread.querySelector('.pp-msg--live');
    if (line) {
      if (!cur) { cur = bubble('them', 'Practice reader (fictional)', line); cur.classList.add('pp-msg--live'); }
      else cur.lastChild.textContent = line;
    }
    if (p.tell) { el.tell.hidden = false; el.tell.textContent = 'The pressure move: ' + p.tell; }
    if (p.pause) { el.pauseBox.hidden = false; el.pause.textContent = p.pause; }
  }
  function startScene() {
    if (busy) return;
    var moment = val('pp-moment');
    if (!moment) { setStatus('Pick a moment to practise first.', true); return; }
    st = { moment: moment, voice: val('pp-voice'), tone: parseInt(el.toneIn.value, 10), line: '', turns: 0, last: null };
    el.booth.hidden = false;
    el.thread.innerHTML = ''; el.ctx.textContent = ''; el.tell.hidden = true; el.pauseBox.hidden = true;
    el.starters.innerHTML = ''; el.reply.hidden = true; el.coach.hidden = true; el.actions.hidden = true;
    el.text.value = ''; el.count.textContent = '0 / 300'; pressure(0);
    var vname = root.querySelector('input[name="pp-voice"]:checked').getAttribute('data-name');
    el.who.textContent = 'Coach: ' + vname + ' (AI)';
    el.momentName.textContent = root.querySelector('input[name="pp-moment"]:checked').getAttribute('data-title');
    lock(true); setStatus('...');
    el.booth.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var body = { mode: 'scene', voice: st.voice, moment: st.moment, tone: st.tone };
    runWithRetry(body, function (t) { renderScene(parse(t)); }, function (p) { return p.line && p.line.length > 20 && p.starters.length; })
      .then(function (res) {
        var p = parse(res.text);
        renderScene(p); st.line = p.line;
        p.starters.slice(0, 2).forEach(function (s) {
          var b = document.createElement('button'); b.type = 'button'; b.textContent = s; b.setAttribute('data-nebula-preserve', '1');
          b.addEventListener('click', function () { el.text.value = s; el.count.textContent = s.length + ' / 300'; el.text.focus(); });
          el.starters.appendChild(b);
        });
        pressure(78); el.reply.hidden = false; lock(false); setStatus('Your turn. Say it in your own words.');
      }).catch(fail);
  }
  function sendReply() {
    if (busy || !st) return;
    var reply = el.text.value.replace(/\s+/g, ' ').trim();
    if (reply.length < 3) { setStatus('Write at least a few words first.', true); return; }
    lock(true); setStatus('...');
    bubble('you', 'You', reply);
    el.reply.hidden = true; el.coach.hidden = true;
    var body = { mode: 'feedback', voice: st.voice, moment: st.moment, tone: st.tone, line: st.line, reply: reply };
    runWithRetry(body, function () { /* показ після завершення */ }, function (p) { return p.scores.calm && p.scores.clear && p.scores.open && p.pushback && p.rewrite; })
      .then(function (res) {
        var p = parse(res.text), sum = 0;
        el.scores.innerHTML = '';
        [['calm', 'Calm'], ['clear', 'Clear'], ['open', 'Open']].forEach(function (k) {
          var s = p.scores[k[0]]; sum += s.n;
          var dt = document.createElement('dt'); dt.textContent = k[1];
          var dd = document.createElement('dd'); var bar = document.createElement('div'); bar.className = 'pp-bar';
          for (var i = 1; i <= 5; i++) { var b = document.createElement('i'); if (i <= s.n) b.className = 'on'; bar.appendChild(b); }
          dd.appendChild(bar);
          var sm = document.createElement('small'); sm.textContent = s.why;
          el.scores.appendChild(dt); el.scores.appendChild(dd); el.scores.appendChild(sm);
        });
        el.rewrite.querySelector('span').textContent = p.rewrite;
        el.next.textContent = p.next ? 'If it happens a third time: ' + p.next : '';
        el.coach.hidden = false;
        bubble('them', 'Practice reader (fictional)', p.pushback);
        st.last = { line: p.pushback, rewrite: p.rewrite }; st.turns++;
        pressure(Math.round(78 - (sum / 15) * 62 + (st.turns > 1 ? 4 : 0)));
        el.actions.hidden = false; lock(false); setStatus('');
        el.coach.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }).catch(function (e) { el.reply.hidden = false; fail(e); });
  }
  el.send.addEventListener('click', sendReply);
  el.start.addEventListener('click', startScene);
  el.text.addEventListener('input', function () { el.count.textContent = el.text.value.length + ' / 300'; });
  el.toneIn.addEventListener('input', function () { el.toneNow.textContent = TONES[parseInt(el.toneIn.value, 10) - 1]; });
  el.toneNow.textContent = TONES[parseInt(el.toneIn.value, 10) - 1];
  // Ще один раунд: відповідь на «пушбек» читача.
  el.again.addEventListener('click', function () {
    if (!st || !st.last || busy) return;
    st.line = st.last.line; el.text.value = ''; el.count.textContent = '0 / 300';
    el.starters.innerHTML = ''; el.reply.hidden = false; el.actions.hidden = true; el.coach.hidden = true;
    pressure(70); setStatus('Round ' + (st.turns + 1) + '. Answer the last line.'); el.text.focus();
  });
  el.other.addEventListener('click', function () {
    el.booth.hidden = true; st = null; setStatus('');
    var f = root.querySelector('.pp-moments'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  el.copy.addEventListener('click', function () {
    if (!st || !st.last) return;
    var t = st.last.rewrite;
    var done = function () { el.copy.textContent = 'Copied'; setTimeout(function () { el.copy.textContent = 'Copy my line'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { /* ігноруємо */ });
  });
})();
