/* ============================================================
   主控：渲染 + 动作分发
   每个会改变状态的动作，都会同时写下"谁在什么时候做的"。
   ============================================================ */

['quiz', 'awk', 'myPrefs'].forEach(k => { if (!S[k]) S[k] = structuredClone(SEED[k]); });

const stamp = () => `今天 ${NOW}`;
const mySrc = () => ({ via:'member', by:ME, at:stamp() });

function render() {
  document.getElementById('view').innerHTML = VIEWS[S.tab]();

  document.getElementById('nav').innerHTML = TABS.map(t => {
    const b = badge(t.id);
    return `<button class="nv" data-act="go" data-tab="${t.id}" ${S.tab === t.id ? 'aria-current="page"' : ''}>
      ${svg(t.icon)}${t.label}${b ? `<span class="dot">${b}</span>` : ''}</button>`;
  }).join('');

  document.getElementById('tabbar').innerHTML = TABS.map(t => {
    const b = badge(t.id);
    return `<button data-act="go" data-tab="${t.id}" ${S.tab === t.id ? 'aria-current="page"' : ''}>
      ${svg(t.icon)}<span>${t.label}</span>${b ? `<span class="dot">${b}</span>` : ''}</button>`;
  }).join('');

  const roster = MEMBERS.filter(m => !S.movedOut.includes(m.id));
  document.getElementById('roster').innerHTML =
    roster.map(m => av(m.id, 'sm' + (statusOf(m.id) === 'in' ? '' : ' out'))).join('') +
    `<span class="rmore">${living().length} 位成员</span>`;
  document.getElementById('demoPanel').hidden = !S.demoPanel;

  const markSvg = svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>');
  document.getElementById('markA').innerHTML = markSvg;
  document.getElementById('markB').innerHTML = markSvg;
  document.getElementById('hName').textContent = HOUSE.name;
  document.getElementById('hNameM').textContent = HOUSE.name;
  document.getElementById('hOrg').textContent = HOUSE.org;
  document.getElementById('hOrgM').textContent = HOUSE.org;
  document.getElementById('meName').textContent = mem(ME).name;
  document.getElementById('topFaces').innerHTML = roster.map(m => av(m.id, 'sm')).join('');
  save();
}

let toastT;
function toast(msg) {
  const el = document.getElementById('toast');
  el.innerHTML = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3400);
}
function goTo(tab, sub) { S.tab = tab; S.sub = sub || null; render(); window.scrollTo({ top: 0 }); }

ov().addEventListener('click', e => { if (e.target === ov()) closeSheet(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !ov().hidden) closeSheet();
  if (e.key === 'Enter' && e.target.id === 'butlerIn') { butlerSheet(e.target.value); e.target.value = ''; }
});

/* ============================================================
   动作分发
   ============================================================ */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;

  switch (act) {

  /* ---- 导航 ---- */
  case 'go': goTo(el.dataset.tab, el.dataset.sub); break;
  case 'close': closeSheet(); break;
  case 'seg': S.segment = el.dataset.k; render(); break;
  case 'togglePrefs': S.showAllPrefs = !S.showAllPrefs; render(); break;
  case 'demoPanel': S.demoPanel = !S.demoPanel; render(); break;
  case 'reset': S = structuredClone(SEED); render(); toast('演示数据已重置'); break;

  /* ---- 值日：完成即写一条完成记录，责任分布由这些记录统计 ---- */
  case 'doneTask': {
    const t = S.tasks.find(x => x.id === id);
    t.done = true; t.doneAt = stamp(); t.deferred = null;
    S.completions.unshift([t.task, ME, '今天']);
    logFeed(ME, `完成了值日「${t.task}」`);
    render(); toast(`「${t.task}」已完成，已记入完成记录`);
    break;
  }
  case 'undoTask': {
    const t = S.tasks.find(x => x.id === id);
    t.done = false; t.doneAt = null;
    const i = S.completions.findIndex(c => c[0] === t.task && c[1] === ME && c[2] === '今天');
    if (i >= 0) S.completions.splice(i, 1);
    render(); break;
  }
  case 'deferTask': deferSheet(id); break;
  case 'doDefer': {
    const t = S.tasks.find(x => x.id === sheetEl().dataset.tid);
    const k = el.dataset.k;
    if (k === 'swap') {
      const c = sheetEl().dataset.cand;
      if (c) {
        t.who = c; t.deferred = `由 ${mem(ME).name} 换给 ${mem(c).name}，等待对方确认`;
        logFeed('sys', `${mem(ME).name} 发起了「${t.task}」的换班，推荐 ${mem(c).name}`);
        closeSheet(); render(); toast(`已向 ${mem(c).name} 发起换班请求`);
      }
    } else {
      t.due = '顺延到明天';
      t.deferred = k === 'away' ? '今天不在家，已顺延' : '今天较忙，已顺延';
      logFeed('sys', `「${t.task}」顺延到明天`);
      closeSheet(); render(); toast('已顺延到明天，不会记为未完成');
    }
    break;
  }
  case 'newTask': taskSheet(); break;
  case 'doTask': {
    const task = document.getElementById('nt').value.trim();
    if (!task) { toast('先写一下任务内容'); return; }
    S.tasks.push({ id:'t' + Date.now(), task, who:document.getElementById('nw').value,
      due:document.getElementById('nd').value, done:false, temp:true });
    logFeed(ME, `加了一个临时任务「${task}」`);
    closeSheet(); render(); toast('已加入本周任务，不会变成固定任务');
    break;
  }

  /* ---- 公共物品 ---- */
  case 'inc': { const s = S.supplies.find(x => x.id === id); s.qty++; s.max = Math.max(s.max, s.qty); s.src = mySrc(); render(); break; }
  case 'dec': { const s = S.supplies.find(x => x.id === id); s.qty = Math.max(0, s.qty - 1); s.src = mySrc(); render(); break; }
  case 'setStock': setStockSheet(id); break;
  case 'doSetStock': {
    const s = S.supplies.find(x => x.id === sheetEl().dataset.sid);
    const q = Math.max(0, parseInt(document.getElementById('sq').value) || 0);
    s.qty = q; s.max = Math.max(s.max, q); s.src = mySrc();
    logFeed(ME, `把${s.name}库存更新为 <b>${q} ${s.unit}</b>`);
    closeSheet(); render();
    toast(isLow(s) ? `${s.name}已低于约定的 ${s.min} ${s.unit}，首页会出现补充提醒` : `${s.name}已更新为 ${q} ${s.unit}`);
    break;
  }
  case 'setState': {
    const s = S.supplies.find(x => x.id === id);
    s.state = el.dataset.v; s.src = mySrc();
    logFeed(ME, `把${s.name}的状态更新为 <b>${s.state}</b>`);
    render();
    toast(isLow(s) ? `${s.name}标记为${s.state}，首页会出现补充提醒` : `${s.name}已更新为${s.state}`);
    break;
  }
  case 'restock': restockSheet(id); break;
  case 'doRestock': {
    const s = S.supplies.find(x => x.id === sheetEl().dataset.sid);
    const a = parseFloat(document.getElementById('ra').value) || 0;
    const q = s.mode === 'count' ? Math.max(1, parseInt(document.getElementById('rq').value) || 1) : 0;
    const st = s.mode === 'state' ? sheetEl().querySelector('#rs button[aria-pressed="true"]').dataset.v : null;
    applyPurchase(s, q, a, null, st);
    closeSheet(); render();
    toast(a > 0 ? `${s.name}已补充 · 账单新增 ${yuan(a)}，${perLabel(S.bills[0])}` : `${s.name}已补充`);
    break;
  }
  case 'borrow': {
    const s = S.supplies.find(x => x.id === id);
    logFeed(ME, `登记借用了 ${mem(s.owner).name} 的${s.name}`);
    render(); toast(s.rule.startsWith('可直接') ? '已登记借用，用完清洗放回' : `已向 ${mem(s.owner).name} 发出询问`);
    break;
  }
  case 'newThing': thingSheet(); break;
  case 'doThing': {
    const name = document.getElementById('tn').value.trim();
    if (!name) { toast('先写一下物品名称'); return; }
    const w = sheetEl().querySelector('#tw button[aria-pressed="true"]').dataset.v;
    const zone = document.getElementById('tz').value.trim();
    S.supplies.push(w === 'private'
      ? { id:'s' + Date.now(), kind:'private', name, owner:ME, zone: zone || '未标注位置', src:mySrc() }
      : { id:'s' + Date.now(), kind:'lend', name, owner:ME, src:mySrc(),
          rule: w === 'free' ? '可直接使用，用后清洗放回' : '使用前问一声' });
    S.segment = w === 'private' ? 'private' : 'lend';
    logFeed(ME, `登记了自己的物品「${name}」`);
    closeSheet(); render();
    toast(w === 'private' ? '已登记为私人物品，其他人只会看到这是私人区域' : '已登记为可借物品，室友能看到你写的使用方式');
    break;
  }
  case 'delThing': S.supplies = S.supplies.filter(x => x.id !== id); render(); toast('已删除'); break;

  /* ---- 公共空间 ---- */
  case 'confirmZones': {
    const pr = S.zoneProposal;
    pr.items.forEach(it => {
      const sp = S.spaces.find(x => x.id === it.sp);
      const pub = sp.zones.findIndex(z => z.o === 'public');
      const zone = { n:it.n, o:pr.who, pending:true };
      if (pub >= 0) sp.zones.splice(pub, 0, zone); else sp.zones.push(zone);
      sp.src = { via:'shared', at:TODAY };
    });
    pr.confirmed = true;
    logFeed('sys', `全员确认了 ${mem(pr.who).name} 的公共空间分区`);
    render(); toast(`已为 ${mem(pr.who).name} 分配 4 处分区，${mem(pr.who).joined}起生效`);
    break;
  }
  case 'redivide':
    toast('重新划分需要全员确认。当前分区是 6月2日 大家一起定的，改动会进入「正在讨论」。');
    break;

  /* ---- 访客：每次登记都是一条记录，次数由记录累计 ---- */
  case 'newVisit': visitSheet(false); break;
  case 'doVisit': {
    const on = sheetEl().querySelector('#vo button[aria-pressed="true"]').dataset.v === '1';
    const host = document.getElementById('vh').value;
    const guest = document.getElementById('vg').value.trim() || '朋友';
    const date = document.getElementById('vd').value;
    const time = document.getElementById('vw').value.trim() || '未填时间';
    const nights = on ? Math.max(1, parseInt(document.getElementById('vn').value) || 1) : 0;
    const had = nightsOf(host);
    S.visits.unshift({ id:'v' + Date.now(), host, guest, date, time, overnight:on,
      nights: on ? nights : 0, week:true, src:mySrc() });
    const o = overnightRule();
    const over = on && had + nights > o.limit;
    if (over) S.visitAsks.push({ id:'va' + Date.now(), host,
      text:`希望${guest}本周再留宿 ${nights} 晚`, replies:{} });
    logFeed(ME, `登记了访客：${date} ${time}${on ? ` · 留宿 ${nights} 晚` : ''}`);
    closeSheet(); render();
    toast(over ? `本周登记共 ${had + nights} 晚，超过约定的 ${o.limit} 晚，已向室友发出征询`
        : on ? `已登记，本周共 ${had + nights} 晚，仍在约定之内`
        : '已登记，室友会看到这次到访');
    break;
  }
  case 'visitOk': {
    const a = S.visitAsks.find(x => x.id === id);
    S.visits.unshift({ id:'v' + Date.now(), host:a.host, guest:'朋友', date:'今天', time:'经室友同意',
      overnight:true, nights:1, week:true, src:{ via:'member', by:a.host, at:stamp() } });
    S.visitAsks = S.visitAsks.filter(x => x.id !== id);
    logFeed(ME, `同意了 ${mem(a.host).name} 的额外留宿`);
    render(); toast('已同意，这一晚已记入本周登记');
    break;
  }
  case 'visitTalk': {
    const a = S.visitAsks.find(x => x.id === id);
    S.topics.push({ id:'tp' + Date.now(), title:'访客留宿频率', done:false,
      detail:'由一次额外留宿请求引发。当前约定：同一访客每周最多留宿 2 晚。', votes:{ [ME]:'想讨论一下' } });
    S.visitAsks = S.visitAsks.filter(x => x.id !== id);
    logFeed('sys', '「访客留宿频率」已提到家里一起讨论');
    goTo('talk'); toast('已放到家里一起讨论，不会显示是谁提出的');
    break;
  }

  /* ---- 离家 ---- */
  case 'newAway': awaySheet(); break;
  case 'doAway2': {
    const from = document.getElementById('af').value.trim();
    const to = document.getElementById('at').value.trim();
    const days = Math.max(1, parseInt(document.getElementById('ad').value) || 1);
    addAway(from, to, days);
    closeSheet(); render(); toast(`已登记离家 ${from} — ${to}，值日与分摊会基于这条记录调整`);
    break;
  }
  case 'cancelAway': case 'cancelAwayMe': {
    const a = id ? S.away.find(x => x.id === id) : awayOf(ME);
    if (a) { a.active = false; logFeed(ME, '提前结束了离家登记'); }
    render(); toast('已恢复在住状态');
    break;
  }

  /* ---- 洗衣机 ---- */
  case 'washStart': washSheet(); break;
  case 'doWash':
    startWash(parseInt(el.dataset.m)); closeSheet(); render();
    toast(`已登记使用中，预计 ${S.laundry.endsAt} 结束`); break;
  case 'doWashCustom': {
    const m = Math.max(5, Math.min(240, parseInt(document.getElementById('wm').value) || 45));
    startWash(m); closeSheet(); render();
    toast(`已登记使用中，预计 ${S.laundry.endsAt} 结束`); break;
  }
  case 'washDone':
    logFeed(ME, '取出了衣物，洗衣机已释放');
    S.laundry = { user:null, startedAt:null, minutes:0, endsAt:null, notifyMe:false, src:null };
    render(); toast('洗衣机已标记为空闲'); break;
  case 'notifyWash':
    S.laundry.notifyMe = true; render();
    toast('洗衣机结束时会私下提醒你，不会打扰其他人'); break;

  /* ---- 报修：住户提交，之后由机构回传进度 ---- */
  case 'newRepair': repairSheet(); break;
  case 'doRepair': {
    const place = document.getElementById('rpp').value;
    const desc = document.getElementById('rpd').value.trim();
    if (!desc) { toast('简单描述一下问题'); return; }
    const rid = 'rp' + Date.now();
    S.repairs.unshift({ id:rid, place, desc, by:ME, timeline:[{ s:'已提交', at:stamp(), via:'member' }] });
    logFeed(ME, `提交了报修：${desc}`);
    closeSheet(); goTo('life', 'facility');
    toast('报修单已提交，相寓受理后状态会自动同步回来');
    setTimeout(() => {
      const r = S.repairs.find(x => x.id === rid);
      if (r && r.timeline.length === 1) {
        r.timeline.push({ s:'管家已受理', at:stamp(), via:'platform' });
        logFeed('sys', `相寓已受理报修：${r.desc}`);
        render(); toast(`${HOUSE.steward}已受理，稍后会安排上门时间`);
      }
    }, 2800);
    break;
  }

  /* ---- 账单 ---- */
  case 'settle': {
    const b = S.bills.find(x => x.id === id); b.settled = true;
    logFeed(ME, `将「${b.title}」标记为已结清`);
    render(); toast(`「${b.title}」已结清`);
    break;
  }
  case 'unsettle': S.bills.find(x => x.id === id).settled = false; render(); break;
  case 'newBill': billSheet(); break;
  case 'doBill': {
    const title = document.getElementById('bt').value.trim() || '公共费用';
    const amount = parseFloat(document.getElementById('ba').value) || 0;
    if (amount <= 0) { toast('请填写大于 0 的金额'); document.getElementById('ba').focus(); return; }
    const payer = document.getElementById('bp').value;
    const method = document.getElementById('bm').value;
    const people = [...sheetEl().querySelectorAll('#bw button[aria-pressed="true"]')].map(b => b.dataset.m);
    const bill = { id:'b' + Date.now(), title, note:'', amount, payer, people, method, settled:false,
      date:TODAY, src:{ via:'manual', by:ME, at:stamp() } };
    if (method === 'days') {
      const rows = people.map(pid => {
        const off = S.away.filter(x => x.who === pid).reduce((n, x) => n + x.days, 0);
        return { pid, days: 30 - off };
      });
      const tot = rows.reduce((n, r) => n + r.days, 0) || 1;
      bill.shares = {}; rows.forEach(r => bill.shares[r.pid] = Math.round(amount * r.days / tot * 100) / 100);
    }
    S.bills.unshift(bill);
    logFeed(payer, `记了一笔 <b>${title} ${yuan(amount)}</b>`);
    closeSheet(); goTo('bill');
    toast(`已记录「${title}」 · ${METHOD_TEXT[method]}`);
    break;
  }
  case 'applyFair': {
    const fd = fairByDays();
    const bill = { id:'b' + Date.now(), title:S.utilityForecast.title, note:'按登记在住天数',
      amount:S.utilityForecast.amount, payer:ME, people:living().map(m => m.id), method:'days',
      settled:false, date:TODAY, shares:{}, src:{ via:'manual', by:ME, at:stamp() } };
    fd.rows.forEach(r => bill.shares[r.id] = r.amount);
    S.bills.unshift(bill); S.fairApplied = true;
    logFeed('sys', `${S.utilityForecast.title}改为按登记在住天数计算，已由全员确认`);
    render(); toast(`已采用：${fd.rows.map(r => mem(r.id).name + ' ' + yuan(r.amount)).join(' · ')}`);
    break;
  }
  case 'keepEven': {
    S.fairApplied = true;
    S.bills.unshift({ id:'b' + Date.now(), title:S.utilityForecast.title, note:'维持平均分摊',
      amount:S.utilityForecast.amount, payer:ME, people:living().map(m => m.id), method:'even',
      settled:false, date:TODAY, src:{ via:'manual', by:ME, at:stamp() } });
    logFeed('sys', `${S.utilityForecast.title}维持平均分摊`);
    render(); toast('已维持平均分摊。分摊方式由你们决定，系统不会替你们更改。');
    break;
  }

  /* ---- 共识 ---- */
  case 'agreeTopic': {
    const t = S.topics.find(x => x.id === id);
    t.votes = t.votes || {}; t.votes[ME] = '同意';
    const full = Object.keys(t.votes).length >= living().length;
    if (full) finishTopic(t);
    render(); toast(full ? '全员已表态，已成为共同约定' : '已记录你的意见');
    break;
  }
  case 'discussTopic': {
    const t = S.topics.find(x => x.id === id);
    t.votes = t.votes || {}; t.votes[ME] = '想讨论一下';
    render(); toast('已记录。想讨论不是反对，只是需要再聊聊。');
    break;
  }
  case 'discussLin': {
    const d = linDiff();
    d.diff.forEach(x => S.topics.push({ id:'tp' + Date.now() + x.k, title:`${x.label}（${d.lin.name} 入住后）`,
      done:false, detail:`现在家里是 ${x.house}，${d.lin.name} 的偏好是 ${x.lin}。${SUGGESTION[x.k] || ''}`,
      votes:{ [ME]:'同意' }, prefKey:x.k }));
    S.linDiscussed = true;
    logFeed('sys', `${d.lin.name} 入住前的 ${d.diff.length} 项差异已进入讨论`);
    goTo('talk'); toast(`已发起 ${d.diff.length} 个议题，其余 ${d.same.length} 项保持不变`);
    break;
  }
  case 'acceptSuggest': {
    const k = el.dataset.k;
    S.topics.push({ id:'tp' + Date.now(), title:PREF_KEYS.find(p => p.k === k).label, done:false,
      detail:SUGGESTION[k], votes:{ [ME]:'同意' }, prefKey:k });
    logFeed('sys', `「${PREF_KEYS.find(p => p.k === k).label}」的建议已提交全员确认`);
    goTo('talk'); toast('已提交全员确认，三人同意后成为共同约定');
    break;
  }
  case 'editSuggest': toast('可以在「正在讨论」里继续修改措辞，达成一致后再形成约定'); break;

  /* ---- 入住共识问卷 ---- */
  case 'startQuiz': S.quiz = { step:0, answers:{} }; quizSheet(); break;
  case 'quizPick': S.quiz.answers[QUIZ[S.quiz.step].k] = el.dataset.v; quizSheet(); break;
  case 'quizBack': S.quiz.step--; quizSheet(); break;
  case 'quizNext':
    if (S.quiz.step === QUIZ.length - 1) {
      S.myPrefs = { ...S.myPrefs, ...S.quiz.answers };
      S.onboardDone[ME] = TODAY;
      logFeed(ME, '更新了自己的生活偏好');
      closeSheet(); goTo('talk', 'onboard');
      toast('已更新。已经形成约定的部分不会自动改变，需要重新讨论。');
    } else { S.quiz.step++; quizSheet(); }
    break;

  /* ---- 不好开口 ---- */
  case 'awkward': S.awk = { step:0, cat:'', text:'', focus:'', way:'rule' }; awkwardSheet(); break;
  case 'awkCat': S.awk.cat = el.dataset.k; S.awk.step = 1; awkwardSheet(); break;
  case 'awkFill': document.getElementById('awkText').value = el.dataset.text; break;
  case 'awkAnalyze': {
    const v = document.getElementById('awkText').value.trim();
    if (!v) { toast('先说说发生了什么'); return; }
    S.awk.text = v;
    S.awk.readCat = detectCat(v) || S.awk.cat;
    S.awk.step = 2; awkwardSheet();
    break;
  }
  case 'awkFocus': S.awk.focus = el.dataset.k; S.awk.step = 3; awkwardSheet(); break;
  case 'awkGo': S.awk.way = el.dataset.w; S.awk.step = 4; awkwardSheet(); break;
  case 'awkBack': S.awk.step = Math.max(0, S.awk.step - 1); awkwardSheet(); break;
  case 'awkSubmit': {
    const a = S.awk;
    const existing = ruleFor(a.focus);
    const gap = gapFor(a.focus);
    if (a.way === 'private') {
      closeSheet(); render(); toast('已私下发送。家里动态中不会留下记录。');
    } else if (a.way === 'remind') {
      logFeed('sys', `按共同约定发出提醒：${existing.title}`);
      const ex = S.issues.find(i => i.rule === existing.id);
      if (ex) { ex.count++; ex.level = Math.max(ex.level, 1); }
      else S.issues.unshift({ id:'i' + Date.now(), cat:a.readCat || a.cat, rule:existing.id,
        title:existing.title, level:1, count:1, window:'最近 7 天',
        note:'已按现有约定发出中立提醒，暂不需要新增约定。',
        src:{ via:'derived', note:'由 1 次系统提醒记录生成' }, follow:'remind' });
      closeSheet(); goTo('talk', 'issue');
      toast('提醒已私下发出，不指向任何人。这件事已有约定，没有新增约定。');
    } else if (a.way === 'clarify') {
      S.topics.push({ id:'tp' + Date.now(), title:'重新确认：' + existing.title, done:false,
        detail:`${existing.desc}${gap ? ' 当前情况：' + gap.text : ''}`,
        votes:{ [ME]:'同意' }, revisit:existing.id });
      logFeed('sys', `「${existing.title}」进入重新确认`);
      closeSheet(); goTo('talk');
      toast('已发起重新确认，不会新增约定，只修改现有这一条');
    } else {
      S.topics.push({ id:'tp' + Date.now(), title:a.focus, done:false,
        detail: AWK_SUGGEST[a.focus] || `关于${a.focus}的约定，等待大家一起确认。`,
        votes:{ [ME]:'同意' } });
      logFeed('sys', `新增讨论议题「${a.focus}」`);
      closeSheet(); goTo('talk');
      toast('已发起讨论，不会显示是谁提出的');
    }
    break;
  }

  /* ---- 居住问题：记录之后必须有去向 ---- */
  case 'issueFollow': {
    const it = S.issues.find(x => x.id === id), k = el.dataset.k;
    const rule = S.rules.find(r => r.id === it.rule);
    it.follow = k;
    if (k === 'remind') { it.level = Math.max(it.level, 2); logFeed('sys', `按共同约定就「${it.title}」发出了一次私下提醒`); }
    if (k === 'discuss') {
      it.level = 4;
      S.topics.push({ id:'tp' + Date.now(), title:'重新确认：' + (rule ? rule.title : it.title), done:false,
        detail: rule ? rule.desc : it.note, votes:{ [ME]:'同意' }, revisit: rule && rule.id });
      logFeed('sys', `「${it.title}」已提到家里一起讨论`);
    }
    if (k === 'steward') { it.level = 5; render(); stewardSheet(); return; }
    render();
    toast(k === 'self' ? '已留存，只有你能看到' : k === 'remind' ? '提醒已私下发出，不点名' : '已放到家里一起讨论');
    break;
  }
  case 'clarifyRule': clarifySheet(id); break;
  case 'clarifyPick': el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); break;
  case 'doClarify': {
    const picked = [...sheetEl().querySelectorAll('.opt[aria-pressed="true"]')].map(b => b.textContent.trim());
    const it = S.issues.find(x => x.id === sheetEl().dataset.iid);
    const rule = S.rules.find(r => r.id === it.rule);
    if (picked.length) rule.desc = picked.join('、') + '。';
    it.level = 1; it.count = 0; it.follow = 'discuss';
    it.note = '标准已重新明确，正在等待全员确认。';
    S.topics.push({ id:'tp' + Date.now(), title:'重新确认：' + rule.title, done:false,
      detail:rule.desc, votes:{ [ME]:'同意' }, revisit:rule.id });
    logFeed('sys', `「${rule.title}」的标准被重新明确，等待全员确认`);
    closeSheet(); goTo('talk'); toast('已发起重新确认，问题记录回到第 1 级');
    break;
  }
  case 'stewardBrief': stewardSheet(); break;
  case 'doSteward':
    closeSheet();
    logFeed('sys', `向${HOUSE.steward}提交了一份协调摘要`);
    render(); toast(`协调摘要已提交给${HOUSE.steward}（演示环境不会真正发送）`);
    break;
  case 'safety': safetySheet(); break;
  case 'safeAct': {
    const T = { record:'事件记录已保存在你的私人空间，其他室友看不到，也不会出现在家里动态中。',
                platform:`正在为你接通${HOUSE.org.split(' · ')[0]}与${HOUSE.steward}（演示环境不会真正拨出）。`,
                contact:'正在联系你设置的紧急联系人（演示环境不会真正拨出）。',
                police:'紧急情况请直接拨打 110。演示环境不会代你拨号。' };
    toast(T[el.dataset.k]);
    break;
  }

  /* ---- 搬出（流程预览） ---- */
  case 'moveChk': {
    if (!S.moveout) S.moveout = JSON.parse(JSON.stringify(defaultMoveout()));
    const it = S.moveout.items.find(x => x.id === id);
    it.done = !it.done; render();
    break;
  }

  /* ---- 管家 ---- */
  case 'butlerGo': {
    const inp = document.getElementById('butlerIn');
    butlerSheet(inp.value); inp.value = '';
    break;
  }
  case 'butlerFill': {
    const inp = document.getElementById('butlerIn');
    if (inp) { inp.value = el.dataset.text; inp.focus(); }
    butlerSheet(el.dataset.text);
    break;
  }
  case 'doStock': {
    const p = S.pending;
    const s = S.supplies.find(x => x.id === p.supply.id);
    if (p.qty != null) { s.qty = p.qty; s.max = Math.max(s.max, p.qty); }
    else s.state = p.state;
    s.src = mySrc();
    logFeed(ME, `把${s.name}更新为 <b>${supplyText(s)}</b>`);
    closeSheet(); goTo('life', 'supply');
    toast(isLow(s) ? `${s.name}已低于约定水位，首页出现补充提醒` : `${s.name}已更新为 ${supplyText(s)}`);
    break;
  }
  case 'doBuy': {
    const p = S.pending;
    let s = p.supply && S.supplies.find(x => x.id === p.supply.id);
    if (!s) {
      s = { id:'s' + Date.now(), kind:'public', mode:'count', name:p.name, qty:0, min:1,
            unit:p.unit, max:p.qty * 2, src:mySrc() };
      S.supplies.push(s);
    }
    applyPurchase(s, p.qty, p.amount, p.people, null, 'butler');
    closeSheet(); goTo('bill');
    toast(`${s.name}更新为 ${supplyText(s)}，账单新增 ${yuan(p.amount)}，${perLabel(S.bills[0])}`);
    break;
  }
  case 'doAway': {
    const p = S.pending;
    addAway(p.from, p.to, p.days);
    closeSheet(); goTo('life', 'away');
    toast(`已登记离家 ${p.from} — ${p.to}，值日与水电分摊会基于这条记录调整`);
    break;
  }
  }
});

/* ============================================================
   共用业务动作
   ============================================================ */
function applyPurchase(s, qty, amount, people, state, via) {
  const ppl = people || living().map(m => m.id);
  if (s.mode === 'count') { s.qty += qty; s.max = Math.max(s.max, s.qty); }
  else if (state) s.state = state;
  s.src = mySrc();
  if (amount > 0) {
    S.bills.unshift({ id:'b' + Date.now(), title:s.name,
      note: s.mode === 'count' ? `补充 ${qty} ${s.unit}` : `补充至${state || s.state}`,
      amount, payer:ME, people:ppl, method:'even', settled:false, date:TODAY,
      src:{ via: via || 'supply', by:ME, at:stamp() } });
    logFeed(ME, `补充了${s.name}，并记了一笔 <b>${yuan(amount)}</b> 的公共支出`);
  } else {
    logFeed(ME, `补充了${s.name}，当前 <b>${supplyText(s)}</b>`);
  }
}

function addAway(from, to, days) {
  S.away = S.away.filter(a => !(a.who === ME && a.active));
  S.away.push({ id:'aw' + Date.now(), who:ME, from, to, days, active:true, src:mySrc() });
  logFeed(ME, `登记了离家：${from} — ${to}`);
}

function startWash(minutes) {
  const [h, m] = NOW.split(':').map(Number);
  const end = new Date(2026, 8, 12, h, m + minutes);
  const hh = String(end.getHours()).padStart(2, '0'), mm = String(end.getMinutes()).padStart(2, '0');
  S.laundry = { user:ME, startedAt:NOW, minutes, endsAt:`${hh}:${mm}`, notifyMe:false,
    src:{ via:'member', by:ME, at:`今天 ${NOW} 点了开始使用，选择 ${minutes} 分钟` } };
  logFeed(ME, `开始使用洗衣机，预计 ${S.laundry.endsAt} 结束`);
}

function finishTopic(t) {
  t.done = true;
  if (t.revisit) {
    const r = S.rules.find(x => x.id === t.revisit);
    if (r) { r.desc = t.detail; r.since = TODAY; r.by = living().map(m => m.id); }
    logFeed('sys', `「${r ? r.title : t.title}」已重新确认`);
    return;
  }
  S.rules.push({ id:'r' + Date.now(), title:t.title.replace(/（.*?）/, ''), cat:'共识',
    desc:t.detail, by:living().map(m => m.id), since:TODAY, prefKey:t.prefKey });
  logFeed('sys', `「${t.title}」已获全员确认，成为共同约定`);
}

function defaultMoveout() {
  return { who:ME, items:[
    { id:'m1', t:'结清未完成账单', m:'当前待结算 2 笔', done:false },
    { id:'m2', t:'带走私人物品',   m:'02室 · 冰箱上层 · 鞋柜 A 区', done:false },
    { id:'m3', t:'公共资产权益结算', m:'共同购买的电水壶、晾衣架', done:false },
    { id:'m4', t:'清空并清洁分区', m:'交还前恢复原状', done:false },
    { id:'m5', t:'归还钥匙与门禁卡', m:'交回相寓管家', done:false },
    { id:'m6', t:'退出值日轮换',   m:'剩余任务重新分配', done:false }
  ] };
}

render();
