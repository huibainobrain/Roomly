/* ============================================================
   主控：渲染 + 动作分发
   ============================================================ */

['quiz', 'awk', 'myPrefs'].forEach(k => { if (!S[k]) S[k] = structuredClone(SEED[k]); });

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
    roster.map(m => av(m.id, 'sm' + (statusOf(m.id) === 'home' ? '' : ' out'))).join('') +
    `<span class="rmore">${homeCount()} 人在家</span>`;
  document.getElementById('demoPanel').hidden = !S.demoPanel;

  const markSvg = svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>');
  document.getElementById('markA').innerHTML = markSvg;
  document.getElementById('markB').innerHTML = markSvg;
  document.getElementById('hName').textContent = HOUSE.name;
  document.getElementById('hNameM').textContent = HOUSE.name;
  document.getElementById('hOrg').textContent = HOUSE.org;
  document.getElementById('hOrgM').textContent = HOUSE.org;
  document.getElementById('meName').textContent = mem(ME).name;
  document.getElementById('topFaces').innerHTML =
    MEMBERS.filter(m => !S.movedOut.includes(m.id)).map(m => av(m.id, 'sm')).join('');
  save();
}

let toastT;
function toast(msg) {
  const el = document.getElementById('toast');
  el.innerHTML = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 3200);
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

  /* ---- 值日 ---- */
  case 'doneTask': {
    const t = S.tasks.find(x => x.id === id); t.done = true; t.deferred = null;
    logFeed(ME, `完成了值日「${t.task}」`);
    render(); toast(`「${t.task}」已完成`);
    break;
  }
  case 'undoTask': S.tasks.find(x => x.id === id).done = false; render(); break;
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

  /* ---- 公共物品 ---- */
  case 'inc': { const s = S.supplies.find(x => x.id === id); s.qty++; s.max = Math.max(s.max, s.qty); render(); break; }
  case 'dec': { const s = S.supplies.find(x => x.id === id); s.qty = Math.max(0, s.qty - 1); render(); break; }
  case 'restock': restockSheet(id); break;
  case 'doRestock': {
    const s = S.supplies.find(x => x.id === sheetEl().dataset.sid);
    const q = Math.max(1, parseInt(document.getElementById('rq').value) || 1);
    const a = parseFloat(document.getElementById('ra').value) || 0;
    applyPurchase(s, q, a);
    closeSheet(); render();
    toast(a > 0 ? `${s.name} +${q} ${s.unit} · 账单已新增 ${yuan(a)}，每人 ${yuan(a / living().length)}`
                : `${s.name} +${q} ${s.unit}`);
    break;
  }
  case 'borrow': {
    const s = S.supplies.find(x => x.id === id);
    logFeed(ME, `登记借用了 ${mem(s.owner).name} 的${s.name}`);
    render(); toast(s.rule.startsWith('可直接') ? `已登记借用，用完清洗放回` : `已向 ${mem(s.owner).name} 发出询问`);
    break;
  }

  /* ---- 访客 ---- */
  case 'newVisit': visitSheet(false); break;
  case 'doVisit': {
    const on = sheetEl().querySelector('#vo button[aria-pressed="true"]').dataset.v === '1';
    const guest = document.getElementById('vg').value.trim() || '朋友';
    const when = document.getElementById('vw').value.trim() || '今晚';
    if (on) S.nights[ME]++;
    const over = on && S.nights[ME] > 2;
    S.visits.unshift({ id:'v' + Date.now(), host:ME, guest, when, overnight:on,
      status: over ? '待室友回应' : '已告知' });
    if (over) S.visitAsks.push({ id:'va' + Date.now(), host:ME,
      text:`希望${guest}本周额外留宿 1 晚`, nights:S.nights[ME], replies:{} });
    logFeed(ME, `登记了访客：${when}${on ? ' · 留宿' : ''}`);
    closeSheet(); render();
    toast(over ? '这次登记超过现在的约定，已向室友发出征询' : on ? '已登记，符合现在的约定' : '已登记，室友会看到今晚有访客');
    break;
  }
  case 'visitOk': {
    const a = S.visitAsks.find(x => x.id === id);
    logFeed(ME, `同意了 ${mem(a.host).name} 的额外留宿`);
    S.visitAsks = S.visitAsks.filter(x => x.id !== id);
    S.visits.forEach(v => { if (v.host === a.host && v.status === '待室友回应') v.status = '已同意'; });
    render(); toast('已回应');
    break;
  }
  case 'visitTalk': {
    const a = S.visitAsks.find(x => x.id === id);
    S.topics.push({ id:'tp' + Date.now(), title:'访客留宿频率', done:false,
      detail:`由一次额外留宿请求引发。当前约定：同一访客每周最多留宿 2 晚。`, votes:{ [ME]:'想讨论一下' } });
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
    closeSheet(); render(); toast(`已登记离家 ${from} — ${to}，值日与分摊已同步调整`);
    break;
  }
  case 'cancelAway': case 'cancelAwayMe': {
    const a = id ? S.away.find(x => x.id === id) : S.away.find(x => x.who === ME && x.active);
    if (a) { a.active = false; logFeed(ME, '提前结束了离家状态'); }
    render(); toast('已恢复在家状态');
    break;
  }

  /* ---- 共享设施 ---- */
  case 'notifyWash': S.laundry.notifyMe = true; render(); toast('洗衣机结束时会提醒你，不会打扰到其他人'); break;
  case 'useWash':
    if (S.laundry.user === ME) { S.laundry.user = null; S.laundry.idleMinutes = 0; logFeed(ME, '取出了衣物，洗衣机已释放'); toast('洗衣机已释放'); }
    else { S.laundry.user = ME; S.laundry.endsAt = '22:30'; S.laundry.notifyMe = false; logFeed(ME, '开始使用洗衣机'); toast('已登记使用中，预计 22:30 结束'); }
    render(); break;

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
    const bill = { id:'b' + Date.now(), title, note:'', amount, payer, people, method, settled:false, date:TODAY };
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
    const bill = { id:'b' + Date.now(), title:S.utilityForecast.title, note:'按实际居住天数',
      amount:S.utilityForecast.amount, payer:ME, people:living().map(m => m.id), method:'days',
      settled:false, date:TODAY, shares:{} };
    fd.rows.forEach(r => bill.shares[r.id] = r.amount);
    S.bills.unshift(bill); S.fairApplied = true;
    logFeed('sys', `${S.utilityForecast.title}改为按实际居住天数计算，已由全员确认`);
    render(); toast(`已采用按天数方案：${fd.rows.map(r => mem(r.id).name + ' ' + yuan(r.amount)).join(' · ')}`);
    break;
  }
  case 'keepEven': {
    S.fairApplied = true;
    const n = living().length;
    S.bills.unshift({ id:'b' + Date.now(), title:S.utilityForecast.title, note:'维持平均分摊',
      amount:S.utilityForecast.amount, payer:ME, people:living().map(m => m.id), method:'even',
      settled:false, date:TODAY });
    logFeed('sys', `${S.utilityForecast.title}维持平均分摊，每人 ${yuan(S.utilityForecast.amount / n)}`);
    render(); toast('已维持平均分摊。分摊方式由你们决定，系统不会替你们更改。');
    break;
  }

  /* ---- 共识 ---- */
  case 'agreeTopic': {
    const t = S.topics.find(x => x.id === id);
    t.votes = t.votes || {}; t.votes[ME] = '同意';
    if (Object.keys(t.votes).length >= living().length) finishTopic(t);
    render(); toast(Object.keys(t.votes).length >= living().length ? '全员已表态，已成为共同约定' : '已记录你的意见');
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
  case 'editSuggest': toast('可以在「正在讨论」里继续修改措辞，达成一致后再形成规则'); break;

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
      toast('已更新。已经形成规则的部分不会自动改变，需要重新讨论。');
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
      closeSheet(); render();
      toast('已私下发送。家里动态中不会留下记录。');

    } else if (a.way === 'remind') {
      /* 已有约定就不再造新规则，只按约定发中立提醒并记入问题记录 */
      logFeed('sys', `按共同约定发出提醒：${existing.title}`);
      const ex = S.issues.find(i => i.rule === existing.id);
      if (ex) { ex.count++; ex.level = Math.max(ex.level, 1); }
      else S.issues.unshift({ id:'i' + Date.now(), cat:a.readCat || a.cat, rule:existing.id,
        title:existing.title, level:1, count:1, window:'最近 7 天',
        note:'已按现有约定发出中立提醒，暂不需要新增规则。' });
      closeSheet(); goTo('talk', 'issue');
      toast('提醒已发出，不指向任何人。这件事已有约定，没有新增规则。');

    } else if (a.way === 'clarify') {
      S.topics.push({ id:'tp' + Date.now(), title:'重新确认：' + existing.title, done:false,
        detail:`${existing.desc}${gap ? ' 当前情况：' + gap.text : ''}`,
        votes:{ [ME]:'同意' }, revisit:existing.id });
      logFeed('sys', `「${existing.title}」进入重新确认`);
      closeSheet(); goTo('talk');
      toast('已发起重新确认，不会新增规则，只修改现有这一条');

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

  /* ---- 居住问题 / 管家 / 安全 ---- */
  case 'clarifyRule': clarifySheet(id); break;
  case 'clarifyPick': el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); break;
  case 'doClarify': {
    const picked = [...sheetEl().querySelectorAll('.opt[aria-pressed="true"]')].map(b => b.textContent.trim());
    const it = S.issues.find(x => x.id === sheetEl().dataset.iid);
    const rule = S.rules.find(r => r.id === it.rule);
    if (picked.length) rule.desc = picked.join('、') + '。';
    it.level = 1; it.count = 0; it.note = '标准已重新明确，正在等待全员确认。';
    S.topics.push({ id:'tp' + Date.now(), title:'重新明确：' + rule.title, done:false,
      detail:rule.desc, votes:{ [ME]:'同意' } });
    logFeed('sys', `「${rule.title}」的标准被重新明确，等待全员确认`);
    closeSheet(); goTo('talk'); toast('已发起重新确认，问题记录回到第 1 级');
    break;
  }
  case 'stewardBrief': stewardSheet(); break;
  case 'doSteward':
    closeSheet(); toast(`协调摘要已提交给${HOUSE.steward}（演示环境不会真正发送）`);
    logFeed('sys', `向${HOUSE.steward}提交了一份协调摘要`);
    render(); break;
  case 'safety': safetySheet(); break;
  case 'safeAct': {
    const T = { record:'事件记录已保存在你的私人空间，其他室友看不到，也不会出现在 家里动态中。',
                platform:`正在为你接通${HOUSE.org.split(' · ')[0]}与${HOUSE.steward}（演示环境不会真正拨出）。`,
                contact:'正在联系你设置的紧急联系人（演示环境不会真正拨出）。',
                police:'紧急情况请直接拨打 110。演示环境不会代你拨号。' };
    toast(T[el.dataset.k]);
    break;
  }

  /* ---- 搬出 ---- */
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
  case 'doBuy': {
    const p = S.pending;
    let s = p.supply && S.supplies.find(x => x.id === p.supply.id);
    if (!s) {
      s = { id:'s' + Date.now(), kind:'public', name:p.name, qty:0, min:1, unit:p.unit, max:p.qty * 2 };
      S.supplies.push(s);
    }
    applyPurchase(s, p.qty, p.amount, p.people);
    closeSheet(); goTo('bill');
    toast(`${s.name}库存更新为 ${s.qty} ${s.unit}，账单新增 ${yuan(p.amount)}，每人 ${yuan(p.amount / p.people.length)}`);
    break;
  }
  case 'doAway': {
    const p = S.pending;
    addAway(p.from, p.to, p.days);
    closeSheet(); goTo('life', 'away');
    toast(`已登记离家 ${p.from} — ${p.to}，值日与水电分摊已同步调整`);
    break;
  }
  }
});

/* ============================================================
   共用的业务动作
   ============================================================ */
function applyPurchase(s, qty, amount, people) {
  const ppl = people || living().map(m => m.id);
  s.qty += qty;
  s.max = Math.max(s.max, s.qty);
  if (amount > 0) {
    S.bills.unshift({ id:'b' + Date.now(), title:s.name, note:`补充 ${qty} ${s.unit}`,
      amount, payer:ME, people:ppl, method:'even', settled:false, date:TODAY });
    logFeed(ME, `补充了${s.name} <b>+${qty} ${s.unit}</b>，并记了一笔 <b>${yuan(amount)}</b> 的公共支出`);
  } else {
    logFeed(ME, `补充了${s.name} <b>+${qty} ${s.unit}</b>`);
  }
}

function addAway(from, to, days) {
  S.away = S.away.filter(a => !(a.who === ME && a.active));
  S.away.push({ id:'aw' + Date.now(), who:ME, from, to, days, active:true });
  S.tasks.forEach(t => {
    if (t.who === ME && !t.done) t.note = `${from}—${to} 离家，已暂缓`;
  });
  logFeed(ME, `登记了离家：${from} — ${to}`);
}

function finishTopic(t) {
  t.done = true;
  /* 重新确认的议题只更新原规则，不会多出一条内容相近的新规则 */
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

/* 搬出是流程预览，主角是当前用户，不涉及任何其他成员 */
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
