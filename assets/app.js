'use strict';
/* VOL.16 《给 Agent 装一块驾驶舱》 — 六枚确定性小样
   共享同一条事件脚本（一次带审批的真实 run 的相对毫秒口径）。无随机、可重放。 */
const RUN = [
  { t: 0,     ev: 'status',        cls: 'ok',   msg: 'status · 已连接网关 hermes · 模型 glm-5.3-flash',
    pay: { event: 'status', gateway: 'hermes', session_id: 's_2043', mode: 'chat', stage: 'connecting', tool_names: ['list_files', 'write_workspace_file'] } },
  { t: 240,   ev: 'thought_delta', cls: '',     msg: 'thought_delta · 先把 notes 目录翻一遍，看上一期的格式……',
    pay: { event: 'thought_delta', text: '先把 notes 目录翻一遍，看上一期周报的格式……' } },
  { t: 1180,  ev: 'tool_call',     cls: '',     msg: 'tool_call · list_files { path: "notes/" }',
    pay: { event: 'tool_call', tool: 'list_files', arguments: { path: 'notes/' } } },
  { t: 2050,  ev: 'tool_result',   cls: 'ok',   msg: 'tool_result · list_files → 3 个文件 · 132ms',
    pay: { event: 'tool_result', tool: 'list_files', ok: true, summary: '3 个文件' } },
  { t: 2400,  ev: 'thought_delta', cls: '',     msg: 'thought_delta · 可以写了。写工作区文件需要人批。',
    pay: { event: 'thought_delta', text: '可以写了。写入工作区文件需要人批，我先递审批。' } },
  { t: 3100,  ev: 'tool_approval', cls: 'warn', msg: 'tool_approval · write_workspace_file · 120s 内有效',
    pay: { event: 'tool_approval', tool: 'write_workspace_file', arguments: { path: 'notes/weekly.md' }, status: 'pending', expires_at: '+120s' } },
  { t: 12500, ev: 'tool_result',   cls: 'ok',   msg: 'tool_result · write_workspace_file → 已写入 1,832 字节',
    pay: { event: 'tool_result', tool: 'write_workspace_file', ok: true, bytes: 1832 } },
  { t: 15300, ev: 'delta',         cls: '',     msg: 'delta · 周报正文流式输出（957 字）',
    pay: { event: 'delta', content: '# 周报 2026-11-17\n……' } },
  { t: 18900, ev: 'done',          cls: 'ok',   msg: 'done · input 2,143 / output 957 / cache_read 11,300',
    pay: { event: 'done', usage: { input: 2143, output: 957, cache_read: 11300 } } },
];
RUN.splice(6, 0, { t: 9400, ev: '(human)', cls: 'warn', msg: '(human) · 审批卡点「允许」→ approved → 线程认领',
  pay: { event: 'tool_execution_decision', decision: 'allow', http: 200 } });
const CHAT = { user: '把 notes/ 里这三份记录整理成本周周报。', bot: '整理好了：notes/weekly.md 已写入（1,832 字节）。我把三份记录按「本周完成 / 数据 / 下周计划」归了段，检索那部分列了来源文件。—— 中间那次写入我申请过许可，你批的那张单 120 秒内生效。' };
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function gaugesAt(i){
  // 事件 0..i 的仪表投影（i 为已下发条数-1）
  const g = { run: 'IDLE', tool: '—', gate: '—', tok: '0' };
  const upto = RUN.slice(0, i + 1);
  const has = ev => upto.some(e => e.ev === ev);
  if (!upto.length) return g;
  if (has('done')) { g.run = 'DONE'; const u = RUN[9].pay.usage; g.tok = (u.input + u.output).toLocaleString(); }
  else if (has('delta')) g.run = 'STREAMING';
  else if (has('tool_approval')) g.run = 'AWAITING GATE';
  else if (has('tool_call')) g.run = 'RUNNING';
  else if (has('thought_delta')) g.run = 'THINKING';
  else if (has('status')) g.run = 'CONNECTING';
  const lastTool = [...upto].reverse().find(e => e.ev === 'tool_call');
  const lastRes  = [...upto].reverse().find(e => e.ev === 'tool_result');
  if (lastRes && (!lastTool || lastRes.t > lastTool.t)) g.tool = '—';
  else if (lastTool) g.tool = lastTool.pay.tool;
  if (upto.some(e => e.ev === 'tool_approval')) g.gate = 'PENDING 120s';
  if (upto.some(e => e.ev === '(human)')) g.gate = 'APPROVED';
  if (upto.some(e => e.t >= 12500)) g.gate = '—';
  return g;
}
/* ===== 互动 01 · 盲飞对照台 ===== */
const d1 = {
  timer: null, n: -1,
  reset(){ clearInterval(this.timer); this.timer = null; this.n = -1;
    el('d1-chat').innerHTML = '<div style="color:var(--faint);font-size:13px">—— 还没有消息 ——</div>';
    el('d1-log').innerHTML = ''; el('d1-play').disabled = false;
    el('d1-n').textContent = '0 / 10'; el('d1-see-c').textContent = '2 条（首尾）';
    el('d1-see-d').textContent = '10 条'; el('d1-gatebtn').textContent = '看不到';
    el('d1-gatebtn').className = 'badc';
    const g = gaugesAt(-1); el('d1-run').textContent = g.run; el('d1-tool').textContent = g.tool;
    el('d1-gate').textContent = g.gate; el('d1-tok').textContent = g.tok; },
  paint(){ const i = this.n; const e = RUN[i]; const g = gaugesAt(i);
    el('d1-run').textContent = g.run; el('d1-tool').textContent = g.tool;
    el('d1-gate').textContent = g.gate; el('d1-tok').textContent = g.tok;
    el('d1-n').textContent = (i + 1) + ' / 10';
    el('d1-see-d').textContent = (i + 1) + ' 条';
    const log = el('d1-log');
    log.insertAdjacentHTML('beforeend',
      `<div class="ln ${e.cls}"><span class="ts">[${String(e.t).padStart(6, ' ')}ms]</span><b>${esc(e.ev)}</b> ${esc(e.msg.split('·').slice(1).join('·').trim() || e.ev)}</div>`);
    log.scrollTop = log.scrollHeight;
    if (e.ev === 'status' && !el('d1-user')) {
      el('d1-chat').insertAdjacentHTML('beforeend', `<div class="bubble user" id="d1-user">${esc(CHAT.user)}</div>`);
    }
    if (e.ev === '(human)') { el('d1-gatebtn').textContent = '可点（仅仪表侧）'; el('d1-gatebtn').className = 'okc'; }
    if (e.ev === 'delta') {
      el('d1-chat').insertAdjacentHTML('beforeend', '<div class="bubble bot" id="d1-bot">正在整理……<span class="sig">streaming</span></div>');
    }
    if (e.ev === 'done') {
      const b = el('d1-bot'); if (b) b.innerHTML = esc(CHAT.bot) + '<span class="sig">done · usage 已随收尾事件到达</span>';
      el('d1-see-c').textContent = '2 条（首尾）';
    } },
  step(){ if (this.n >= RUN.length - 1) { clearInterval(this.timer); return; }
    this.n++; this.paint();
    if (this.n >= RUN.length - 1) { clearInterval(this.timer); this.timer = null; el('d1-play').disabled = true; } },
  play(){ if (this.timer) return; if (this.n >= RUN.length - 1) this.reset();
    el('d1-play').disabled = true;
    if (this.n < 0) this.n = -1;
    this.timer = setInterval(() => this.step(), 850); }
};
/* ===== 互动 02 · 事件流总装台 ===== */
const d2 = {
  timer: null, n: -1,
  lit(g){ let k = 0; if (g.run !== 'IDLE') k++; if (g.gate !== '—') k++; if (g.tool !== '—') k++;
    if (el('d2-delta').textContent !== '0 字') k++; if (el('d2-tok').textContent.indexOf('in 0') < 0) k++; return k; },
  reset(){ clearInterval(this.timer); this.timer = null; this.n = -1;
    el('d2-log').innerHTML = ''; el('d2-next').disabled = false; el('d2-auto').disabled = false;
    el('d2-run').textContent = 'IDLE'; el('d2-gate').textContent = '—'; el('d2-tool').textContent = '—';
    el('d2-delta').textContent = '0 字'; el('d2-tok').textContent = 'in 0 / out 0 / cache 0';
    el('d2-payload').textContent = '{ "event": null }'; el('d2-n').textContent = '0 / 10';
    el('d2-lit').textContent = '0 / 5'; el('d2-sse').textContent = 'SSE 在线'; el('d2-sse').className = 'okc'; },
  step(){ if (this.n >= RUN.length - 1) { clearInterval(this.timer); this.timer = null;
      el('d2-auto').disabled = true; return; }
    this.n++; const e = RUN[this.n];
    el('d2-payload').textContent = JSON.stringify(e.pay, null, 1).replace(/\n/g, '⏎');
    el('d2-log').insertAdjacentHTML('beforeend',
      `<div class="ln ${e.cls}"><span class="ts">[${String(e.t).padStart(6, ' ')}ms]</span><b>${esc(e.ev)}</b> ${esc(e.msg.split('·').slice(1).join('·').trim() || e.ev)}</div>`);
    const log = el('d2-log'); log.scrollTop = log.scrollHeight;
    const g = gaugesAt(this.n);
    el('d2-run').textContent = g.run; el('d2-gate').textContent = g.gate; el('d2-tool').textContent = g.tool;
    if (e.ev === 'delta') el('d2-delta').textContent = '957 字';
    if (e.ev === 'done') { const u = e.pay.usage; el('d2-tok').textContent = `in ${u.input.toLocaleString()} / out ${u.output.toLocaleString()} / cache ${u.cache_read.toLocaleString()}`; }
    el('d2-n').textContent = (this.n + 1) + ' / 10';
    el('d2-lit').textContent = this.lit(g) + ' / 5';
    if (e.ev === 'tool_approval') { el('d2-sse').textContent = 'SSE 在线 + 3s 轮询'; }
    if (this.n >= RUN.length - 1) { clearInterval(this.timer); this.timer = null; el('d2-auto').disabled = true; el('d2-next').disabled = true; } },
  next(){ this.step(); },
  auto(){ if (this.timer) return; if (this.n >= RUN.length - 1) this.reset();
    this.timer = setInterval(() => this.step(), 750); }
};
/* ===== 互动 03 · 状态机探照灯 ===== */
const D3_STATES = ['pending','approved','running','succeeded','failed','denied','expired','cancelled'];
const d3 = {
  st: null, rej: 0,
  lamp(){ el('d3-lamps').innerHTML = D3_STATES.map(s => {
    const on = this.st === s; const mid = s === 'pending' || s === 'approved' || s === 'running';
    const end = s === 'denied' || s === 'expired' || s === 'cancelled' || s === 'failed';
    return `<span class="lamp ${on ? (end ? 'end' : mid ? 'mid' : 'on') : ''}">${s}</span>`; }).join(''); },
  term(line, cls){ el('d3-term').insertAdjacentHTML('beforeend', `\n<span class="${cls || ''}">${esc(line)}</span>`); },
  reset(){ this.st = null; this.rej = 0; el('d3-term').innerHTML = '# 点「创建审批单」开始 —— 非法转移会被拒绝并给出原因';
    el('d3-state').textContent = '∅（无审批单）'; el('d3-final').textContent = '—'; el('d3-rej').textContent = '0 次'; this.lamp(); },
  reject(why){ this.rej++; el('d3-rej').textContent = this.rej + ' 次';
    this.term(`✗ 被状态机拒绝：${why}`, 'e'); },
  fire(op){ const s = this.st;
    if (op === 'create') { if (s) return this.reject('已有一张审批单（One immutable approval request）');
      this.st = 'pending'; this.term('POST /tools/executions → 201 · status=pending · expires_at=now+120s', 'ok'); }
    else if (op === 'allow') { if (!s) return this.reject('没有单子可批（decision 端点按 id 过滤，404）');
      if (s !== 'pending') return this.reject(`当前 status=${s}，CAS 只认 status="pending"`); 
      this.st = 'approved'; this.term('POST decision=allow → 200 · CAS 命中 → status=approved（人批了，机器还没拿）', 'ok'); }
    else if (op === 'deny') { if (!s) return this.reject('没有单子可拒');
      if (s !== 'pending') return this.reject(`当前 status=${s}，CAS 只认 status="pending"`); 
      this.st = 'denied'; this.term('POST decision=deny → 200 · error="用户拒绝了工具执行。"（终态）', 'ok'); }
    else if (op === 'claim') { if (s !== 'approved') return this.reject(`认领的 CAS 只认 status="approved"，当前 ${s || '∅'}`);
      this.st = 'running'; this.term('CAS filter(status=approved, decision=allow, expires_at>now, run=running) → update(status="running") 认领成功', 'ok'); }
    else if (op === 'finish') { if (s !== 'running') return this.reject('没有在飞的工具（handler 只对 running 有意义）');
      this.st = 'succeeded'; this.term('handler → {ok:true} → status=succeeded · result 落库（终态）', 'ok'); }
    else if (op === 'expire') { if (s !== 'pending' && s !== 'approved') return this.reject(`reconcile 只修 pending/approved，当前 ${s || '∅'}`);
      this.st = 'expired'; this.term('reconcile: expires_at__lte=now → status=expired · error="审批已过期。"（终态）', 'e'); }
    else if (op === 'cancel') { if (!s || s === 'succeeded' || s === 'failed') return this.reject(`ACTIVE 之外无需取消，当前 ${s || '∅'}`);
      this.st = 'cancelled'; this.term('reconcile: 运行已结束/取消 → status=cancelled · error="运行已取消。"（终态）', 'e'); }
    el('d3-state').textContent = this.st || '∅';
    el('d3-final').textContent = ['succeeded','failed','denied','expired','cancelled'].includes(this.st) ? this.st + '（终态，不可复活）' : '—';
    this.lamp(); }
};
/* ===== 互动 04 · 审批闸门（时钟 1 真秒 = 12 模拟秒） ===== */
const d4 = {
  st: null, t: 0, last: null, claims: 0, rec: 0, timer: null,
  fmt(){ const L = { pending: 'PENDING · 等待审批', approved: 'APPROVED · 已批准', running: 'RUNNING · 执行中',
      succeeded: 'SUCCEEDED · 成功', denied: 'DENIED · 已拒绝', expired: 'EXPIRED · 已过期' };
    const lamp = el('d4-lamp'); lamp.textContent = this.st ? L[this.st] : '∅ 无审批单';
    const k = { pending: 'mid', approved: 'mid', running: 'on', succeeded: 'on', denied: 'end', expired: 'end' };
    lamp.style.background = ''; lamp.style.borderColor = '';
    if (this.st) { const m = { mid: 'var(--orange)', on: 'var(--green)', end: 'var(--red)' }[k[this.st]];
      lamp.style.background = m; lamp.style.borderColor = m; lamp.style.color = '#0a0f14'; } },
  tick(){ this.t += 12; el('d4-ttl').textContent = this.st ? Math.max(0, 120 - this.t) + 's' : '—';
    // reconcile：pending/approved 且过期 → expired
    if ((this.st === 'pending' || this.st === 'approved') && this.t >= 120) {
      this.st = 'expired'; this.rec++; el('d4-rec').textContent = this.rec + ' 次';
      this.log(`[t+${this.t}s] reconcile: expires_at 已过 → status=expired（error="审批已过期。"）`, 'e');
      el('d4-state').textContent = this.st; this.fmt(); }
    // 执行线程：approved → 认领 → running → 下轮 succeeded
    if (this.st === 'approved') { this.st = 'running'; this.claims++;
      el('d4-claims').textContent = this.claims;
      this.log(`[t+${this.t}s] 线程 CAS 认领 → status=running（支票兑现）`, 'ok');
      el('d4-state').textContent = this.st; this.fmt(); }
    else if (this.st === 'running') { this.st = 'succeeded';
      this.log(`[t+${this.t}s] handler → {ok:true} → status=succeeded`, 'ok');
      el('d4-state').textContent = this.st; this.fmt(); } },
  log(line, cls){ el('d4-term').insertAdjacentHTML('beforeend', `\n<span class="${cls || ''}">${esc(line)}</span>`); },
  reset(){ clearInterval(this.timer); this.timer = null; this.st = null; this.t = 0; this.last = null;
    this.claims = 0; this.rec = 0;
    el('d4-term').innerHTML = '# 创建一张单，先随便玩，再看两个经典翻车：重复提交、过期复活';
    el('d4-state').textContent = '∅'; el('d4-code').textContent = '—'; el('d4-claims').textContent = '0';
    el('d4-rec').textContent = '0 次'; el('d4-ttl').textContent = '—';
    el('d4-worker').textContent = '空闲 · 0.1s/轮'; this.fmt(); },
  decide(dec, repeat){ const s = this.st;
    // CAS（approval_views.py 逐条照抄）：pending + 未表态 + 未过期 + 运行存活
    const changed = (s === 'pending' && this.last === null && this.t < 120);
    const same = repeat && this.last === dec && s !== 'expired';
    if (changed) { this.st = (dec === 'allow') ? 'approved' : 'denied'; this.last = dec;
      this.log(`POST decision=${dec} → 200（CAS 命中 → status=${this.st}）`, 'ok');
      if (!this.timer) { this.timer = setInterval(() => this.tick(), 1000);
        el('d4-worker').textContent = '执行线程轮询中 · 0.1s/轮'; } }
    else if (same) { this.log(`POST decision=${dec}（重复）→ 200 —— 重复同一决策是读，不是又一次执行`, 'ok'); }
    else { const why = (s === 'expired') ? '终态 expired 不可复活，连更早的 allow 也不行'
        : (s === 'denied') ? '终态 denied，decision 已落库'
        : (s === null) ? '没有这张单（404）'
        : (repeat && this.last !== dec) ? '与上一次决策顶牛（allow vs deny）→ 409'
        : (s === 'pending' && this.t >= 120) ? '支票已过期'
        : `当前 status=${s}，CAS 不命中`;
      this.log(`POST decision=${dec}${repeat ? '（重复）' : ''} → 409 —— ${why}`, 'e'); }
    el('d4-code').textContent = (changed || same) ? '200' : '409';
    el('d4-state').textContent = this.st || '∅'; this.fmt(); },
  fire(op){ if (op === 'create') { if (this.st) return;
      this.st = 'pending'; this.t = 0; this.last = null;
      if (!this.timer) { this.timer = setInterval(() => this.tick(), 1000);
        el('d4-worker').textContent = '执行线程轮询中 · 0.1s/轮'; }
      this.log('POST /tools/executions → 201 · status=pending · expires_at=+120s · on_event("tool_approval")', 'ok');
      el('d4-ttl').textContent = '120s'; }
    else if (op === 'allow') this.decide('allow', false);
    else if (op === 'deny') this.decide('deny', false);
    else if (op === 'repeat') { if (!this.last) { el('d4-code').textContent = '409';
        this.log('POST decision=?(从没表过态) → 409 —— decision="" 的单子没有「同一决策」可读', 'e'); }
      else this.decide(this.last, true); }
    else if (op === 'skip') { this.t += 30;
      el('d4-ttl').textContent = this.st ? Math.max(0, 120 - this.t) + 's' : '—';
      this.log(`[快进] 时钟 +30s（模拟）`, ''); 
      if ((this.st === 'pending' || this.st === 'approved') && this.t >= 120) { this.st = 'expired';
        this.rec++; el('d4-rec').textContent = this.rec + ' 次';
        this.log(`[t+${this.t}s] reconcile: → status=expired`, 'e'); this.fmt(); } }
    el('d4-state').textContent = this.st || '∅'; }
};
/* ===== 互动 05 · 黑匣子重放台（同一条 run + 一段上游重试） ===== */
const TAPE = [
  { t: '[     0ms]', cls: 'ok',   txt: 'status · gateway=hermes · model=glm-5.3-flash' },
  { t: '[   240ms]', cls: '',     txt: 'thought_delta · 先把 notes 目录翻一遍……' },
  { t: '[  1180ms]', cls: '',     txt: 'tool_call · list_files {path:"notes/"}' },
  { t: '[  2050ms]', cls: 'ok',   txt: 'tool_result · list_files → 3 个文件' },
  { t: '[  2100ms]', cls: '',     txt: 'stream open · relay A（attempt 1）· Authorization: Bearer sk-NQR7tW9x3AbCdEf0' },
  { t: '[2100ms+]', cls: 'warn', txt: 'waiting ×19（合并 1 行 · 38.0s 内无首事件）' },
  { t: '[ 92100ms]', cls: 'err',  txt: 'watchdog · 90s 未产出首个流式事件 → 中止 attempt 1' },
  { t: '[ 93600ms]', cls: '',     txt: '降级链 · relay B（attempt 2）· X-Api-Key: sk-HIDDENVALUE-9x3AbCdEf0' },
  { t: '[103800ms]', cls: 'ok',   txt: 'first token · attempt 2 成功' },
  { t: '[104100ms]', cls: '',     txt: 'thought_delta · 可以写了。写入需要人批。' },
  { t: '[104800ms]', cls: 'warn', txt: 'tool_approval · write_workspace_file · expires_at=+120s' },
  { t: '[116200ms]', cls: '',     txt: '(human) · decision=allow → approved（人审用时 11.4s）' },
  { t: '[116400ms]', cls: 'ok',   txt: 'tool_result · write_workspace_file → 1832 B' },
  { t: '[121500ms]', cls: 'ok',   txt: 'done · input 2,143 / output 957 / cache_read 11,300' },
];
const RAW5 = { event: 'stream_open', relay: 'A', headers: { Authorization: 'Bearer sk-NQR7tW9x3AbCdEf0', 'X-Trace': 'tr_5f2' } };
const RED5 = { event: 'stream_open', relay: 'A', headers: { Authorization: 'Bearer sk-NQR***', 'X-Trace': 'tr_5f2' } };
const RAW8 = { event: 'degrade', relay: 'B', headers: { 'X-Api-Key': 'sk-HIDDENVALUE-9x3AbCdEf0' } };
const RED8 = { event: 'degrade', relay: 'B', headers: { 'X-Api-Key': '[已隐藏]' } };
const d5 = {
  redact: true,
  stateAt(n){ // 前 n 条折叠出的世界
    const run = n === 0 ? '∅' : n <= 1 ? 'CONNECTING' : n <= 6 ? 'THINKING/挂起' : n <= 9 ? 'RUNNING' : n <= 12 ? 'AWAITING GATE→RUNNING' : 'STREAMING';
    const gate = n < 11 ? '∅' : n < 12 ? 'PENDING 120s' : 'APPROVED';
    const tool = n < 3 ? '∅' : n < 4 ? 'list_files' : n < 11 ? '—' : 'write_workspace_file';
    return { run, gate, tool }; },
  frameAt(n){ if (n === 5) return JSON.stringify(this.redact ? RED5 : RAW5, null, 1);
    if (n === 8) return JSON.stringify(this.redact ? RED8 : RAW8, null, 1);
    let txt = TAPE[n - 1].txt;
    if (this.redact) txt = txt.replace(/(Bearer\s+)(\S{6})\S+/g, '$1$2***').replace(/sk-\S{8,}/g, '[已隐藏]');
    return txt; },
  paint(){ const n = +el('d5-slider').value;
    el('d5-idx').textContent = n + ' / 14';
    let html = '';
    for (let i = 0; i < n; i++) { const row = TAPE[i];
      let txt = row.txt;
      if (this.redact) txt = txt.replace(/(Bearer\s+)(\S{6})\S+/g, '$1$2***').replace(/sk-\S{8,}/g, '[已隐藏]');
      html += `<div class="ln ${row.cls}"><span class="ts">${row.t}</span><b>${esc(txt.split('·')[0].trim())}</b> ${esc(txt.split('·').slice(1).join('·').trim() || '')}</div>`; }
    el('d5-tape').innerHTML = html || '<span style="color:var(--faint)">— 拖动滑块 —</span>';
    const s = this.stateAt(n);
    el('d5-run').textContent = s.run; el('d5-gate').textContent = s.gate; el('d5-tool').textContent = s.tool;
    el('d5-merged').textContent = n >= 6 ? '19 → 1 行' : '0 行';
    el('d5-frame').textContent = n === 0 ? '— 拖动滑块 —' : this.frameAt(n);
    el('d5-secrets').textContent = this.redact ? '0（已脱敏）' : (n >= 8 ? '2 处裸奔' : n >= 5 ? '1 处裸奔' : '0'); },
  scrub(v){ this.paint(); },
  toggleRedact(){ this.redact = !this.redact;
    el('d5-redact').textContent = '脱敏：' + (this.redact ? '开' : '关'); this.paint(); },
  reset(){ el('d5-slider').value = 0; this.paint(); }
};
/* ===== 互动 06 · 看门狗 ===== */
const d6 = {
  busy: false,
  reset(){ this.busy = false; el('d6-term').innerHTML = '# 选一种形态按播放 —— 每行 [相对秒]，与 Timeline 同款格式';
    el('d6-try').textContent = '—'; el('d6-verdict').textContent = '—';
    el('d6-ux').textContent = '—'; el('d6-waste').textContent = '0s'; },
  line(t, txt, cls){ el('d6-term').insertAdjacentHTML('beforeend',
    `\n<span class="${cls || ''}">[${t.padStart(6, ' ')}s] ${esc(txt)}</span>`); },
  async play(mode){ if (this.busy) return; this.busy = true; this.reset();
    const wd = el('d6-wd').checked;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const nextTick = () => sleep(520);
    if (mode === 'think') {
      this.line('0.0', '尝试 1 · relay A · 连接建立', '');
      el('d6-try').textContent = 'attempt 1';
      await nextTick(); await nextTick();
      this.line('40.0', 'first token 到达（思考 40s，健康）', 'ok');
      el('d6-verdict').textContent = '零误伤'; el('d6-verdict').className = 'okc';
      await nextTick();
      this.line('48.9', 'done · 正常收尾', 'ok');
      el('d6-ux').textContent = '正常输出'; el('d6-waste').textContent = '0s'; }
    else if (wd) {
      this.line('0.0', '尝试 1 · relay A · 连接建立（TCP 三次握手完成）', '');
      el('d6-try').textContent = 'attempt 1';
      await nextTick(); await nextTick(); await nextTick();
      this.line('90.0', 'watchdog: 90s 未产出首个流式事件 → 抛 RuntimeError · close(源)', 'e');
      el('d6-verdict').textContent = '开火 · 中止本次尝试'; el('d6-verdict').className = 'badc';
      el('d6-waste').textContent = '90s';
      await nextTick();
      this.line('90.1', '降级链 → 尝试 2 · relay B', '');
      el('d6-try').textContent = 'attempt 2';
      await nextTick(); await nextTick();
      this.line('102.4', 'first token · attempt 2 成功', 'ok');
      await nextTick();
      this.line('110.8', 'done', 'ok');
      el('d6-ux').textContent = '中性提示「链路已切换」· 不渲染红色横幅'; }
    else {
      this.line('0.0', '尝试 1 · relay A · 连接建立（一字节不发）', '');
      el('d6-try').textContent = 'attempt 1';
      await nextTick(); await nextTick(); await nextTick(); await nextTick(); await nextTick();
      this.line('240.0', 'read 超时才认输（240s 白等）', 'e');
      el('d6-verdict').textContent = '无看门狗 · 硬熬'; el('d6-verdict').className = 'badc';
      el('d6-waste').textContent = '240s'; el('d6-waste').className = 'hot';
      await nextTick();
      this.line('240.1', '降级链 → 尝试 2 · relay B', '');
      el('d6-try').textContent = 'attempt 2';
      await nextTick(); await nextTick();
      this.line('252.5', 'done（但用户已经等了四分钟）', 'ok');
      el('d6-ux').textContent = '红色错误横幅「生成失败」×1'; }
    this.busy = false; }
};
/* ===== boot ===== */
window.addEventListener('DOMContentLoaded', () => { d1.reset(); d2.reset(); d3.reset(); d4.reset(); d5.paint(); d6.reset(); });
