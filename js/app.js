/* ============================================================
   主控：渲染 + 动作分发
   每个会改变状态的动作，都会同时写下"谁在什么时候做的"。
   ============================================================ */

['quiz', 'awk', 'myPrefs'].forEach(k => { if (!S[k]) S[k] = structuredClone(SEED[k]); });

const stamp = () => `${relDn(dnNow())} ${nowHM()}`;
const mySrc = () => ({ via:'member', by:ME, at:stamp() });

function render() {
  /* 时间可能被推进过：先把过期的例外、请求、试行收掉，再渲染 */
  sweepAll();
  /* 各页总览用宽版心，子页面保持 880px */
  document.querySelector('.wrap').classList.toggle('wide', S.tab === 'home' || S.tab === 'bill' || ((S.tab === 'life' || S.tab === 'talk' || S.tab === 'me') && !S.sub));
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

  /* 住所卡：在住的才算"在住"，即将入住 / 待结清的分开说 */
  const roster = household(), inc = incomingMember(), settling = settlingMembers();
  document.getElementById('roster').innerHTML =
    roster.map(m => av(m.id, 'sm' + (statusOf(m.id) === 'in' ? '' : ' out'))).join('') +
    `<span class="rmore">${memberCountText()}</span>`;
  document.getElementById('demoPanel').hidden = !S.demoPanel;
  /* 演示身份：每个生命周期阶段的人都能切过去看，页面会按他的状态给权限 */
  document.getElementById('idList').innerHTML = MEMBERS.map(m =>
    `<button data-act="switchMe" data-k="${m.id}" aria-pressed="${m.id === ME}">${av(m.id, 'sm')}${m.name}${membership(m.id) !== 'active' ? `<small>${MEMBERSHIP_TEXT[membership(m.id)]}</small>` : ''}</button>`).join('');
  document.getElementById('demoLin').hidden = !inc;

  const markSvg = svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>');
  document.getElementById('markA').innerHTML = markSvg;
  document.getElementById('markB').innerHTML = markSvg;
  document.getElementById('hName').textContent = HOUSE.name;
  document.getElementById('hNameM').textContent = HOUSE.name;
  document.getElementById('hOrg').textContent = HOUSE.org;
  document.getElementById('hOrgM').textContent = HOUSE.org;
  document.getElementById('meName').textContent = mem(ME).name;
  document.getElementById('topFaces').innerHTML = roster.map(m => av(m.id, 'sm')).join('');
  /* 演示控制台和情境引导条都挂在页面外层，不占页面版面 */
  document.getElementById('dock').innerHTML = scenarioBar() + demoDock();
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
/* 动作需要的权限：不是在住成员点了这些，只会得到一句说明，不会产生数据 */
const ACTION_CAP = { newBill:'bills', butlerGo:'butler', butlerFill:'butler', newVisit:'visits', newAway:'away', newTask:'tasks',
  washStart:'laundry', notifyWash:'laundry', restock:'supplies', inc:'supplies', dec:'supplies', setStock:'supplies', setState:'supplies',
  newRepair:'feed', newThing:'supplies', borrow:'supplies', awkward:'talk', reqAgree:'requests', reqDecline:'requests', reqDiscuss:'requests',
  confirmZones:'spaces', redivide:'spaces', zoneSwap:'spaces', doneTask:'tasks', deferTask:'tasks',
  proposeSplit:'bills', cancelSplit:'bills', editBill:'bills', newException:'visits', doException:'visits',
  payClaim:'pay', payConfirm:'pay', payConfirmAll:'pay', payUndo:'pay',
  proposalEdit:'talk', holdTopic:'talk', reopenTopic:'talk', trialTopic:'talk', endTrial:'talk', reqToTopic:'talk' };
const GATE_TEXT = { pending:'入住之后就能用这个功能。入住前只能看与你入住有关的事。',
  moved_out_pending_settlement:'你已经搬出，不再参与家里的事务；历史账单结清之前还可以在账单页处理付款。',
  ended:'你的成员关系已经结束，这个家的事务不再向你开放。' };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (ACTION_CAP[act] && !can(ACTION_CAP[act])) { toast(GATE_TEXT[membership(ME)]); return; }

  switch (act) {

  /* ---- 导航 ---- */
  case 'go': closeSheet(); goTo(el.dataset.tab, el.dataset.sub); break;
  case 'close': closeSheet(); break;
  case 'seg': S.segment = el.dataset.k; render(); break;
  case 'togglePrefs': S.showAllPrefs = !S.showAllPrefs; render(); break;
  case 'demoPanel': S.demoPanel = !S.demoPanel; render(); break;
  case 'dock': S.dock = !S.dock; render(); break;

  /* ---- 演示时间 ---- */
  case 'timeAdv': {
    const k = el.dataset.k, d = dnNow();
    const target = k === 'week' ? weekEndDn(d) + 1 : k === 'month' ? monthEndDn(d) : d + 1;
    advanceTo(target, k);
    break;
  }
  case 'timeReset': {
    S.clock = { day:0, hm:'21:05' }; syncClock();
    logFeed('sys', '演示时间回到起点');
    render(); toast('演示时间已回到 9月12日 21:05。数据保持现在的样子，只有时间回去了。');
    break;
  }

  /* ---- 情境体验 ---- */
  case 'scEnter': enterScenario(el.dataset.k); break;
  case 'scExit': exitScenario(); break;
  case 'scReset': { const k = S.scenario && S.scenario.key; if (k) enterScenario(k); break; }
  case 'scNext': case 'scPrev': {
    const sc = SCENARIOS[S.scenario.key];
    const i = Math.max(0, Math.min(sc.steps.length - 1, S.scenario.step + (act === 'scNext' ? 1 : -1)));
    S.scenario.step = i;
    const st = sc.steps[i];
    if (st.tab) { S.tab = st.tab; S.sub = st.sub || null; }
    render(); window.scrollTo({ top:0 });
    break;
  }
  case 'scAs': {
    ME = el.dataset.k; S.me = ME; S.sub = S.sub;
    render(); toast(`已切换到 ${mem(ME).name} 的视角`);
    break;
  }

  /* ---- 站内消息（演示）---- */
  case 'readMsg': {
    const m = S.messages.find(x => x.id === id);
    if (m) m.read[ME] = stamp();
    render(); break;
  }
  case 'readAllMsg': { myMessages().forEach(m => { if (!m.read[ME]) m.read[ME] = stamp(); }); render(); toast('都标为已读了'); break; }
  case 'delMsg': { S.messages = S.messages.filter(x => x.id !== id); render(); toast('已删除这条消息'); break; }
  case 'reset': S = structuredClone(SEED); S.seedVersion = SEED_VERSION; ME = S.me; syncClock(); ensureLinTopics(); render(); toast('演示数据和演示时间都回到了起点'); break;
  case 'switchMe': {
    ME = el.dataset.k; S.me = ME; S.demoPanel = false; S.sub = null;
    UI.noteFor = null; UI.editFor = null;
    render(); toast(`已切换到 ${mem(ME).name} 的视角（${MEMBERSHIP_TEXT[membership(ME)]}），页面按他的身份显示`);
    break;
  }
  /* 租房中介侧的变更由平台推送，住户不能自己改 */
  case 'syncPlatform': {
    const lin = mem('lin');
    const joined = lin.joined === '9月20日' ? '9月25日' : '9月20日';
    S.leaseOverride.lin = { joined, lease:{ via:'platform', at:stamp() } };
    logFeed('sys', `租房中介更新了 ${lin.name} 的入住日期：${joined}`);
    render(); toast(`租房中介已同步：${lin.name} 改为 ${joined} 入住，相关页面已全部更新`);
    break;
  }
  /* 租约生效由机构推送：pending → active，之后才参与任务、新账单和完整的家里事务 */
  case 'activateMember': {
    const m = incomingMember(); if (!m) break;
    S.activated.push(m.id);
    S.spaces.forEach(sp => sp.zones.forEach(z => { if (z.o === m.id) delete z.pending; }));
    logFeed('sys', `租房中介同步：${m.name} 已入住 ${m.room}，成为正式成员`);
    render(); toast(`${m.name} 已转为在住成员：从现在起参与值日、新公共费用和全部讨论`);
    break;
  }
  /* 搬出：机构确认退租之后进入"待结清"——不再参与新的事务，但历史账要算完 */
  case 'confirmMoveout': {
    const who = ME, rec = { who, at:stamp(), zones:[], tasks:[] };
    S.spaces.forEach(sp => sp.zones.forEach(z => { if (z.o === who) { rec.zones.push({ sp:sp.id, n:z.n }); z.o = 'public'; z.freed = who; } }));
    S.settling.push(who);
    const others = living();
    S.tasks.forEach(t => { if (t.who === who && !t.done && others.length) {
      const c = others.map(m => ({ id:m.id, load:S.tasks.filter(x => x.who === m.id && !x.done).length })).sort((a, b) => a.load - b.load)[0].id;
      rec.tasks.push({ id:t.id }); t.who = c; t.deferred = `${mem(who).name} 已搬出，转给 ${mem(c).name}`; } });
    cancelRequests(r => r.from === who || r.to === who || (r.need || []).includes(who), `${mem(who).name} 已搬出，本次请求已取消`);
    S.away.forEach(a => { if (a.who === who) a.cancelled = true; });
    /* 他名下还没批准的例外、还没确认的分摊方案一起收尾 */
    S.exceptions.forEach(e => { if (e.host === who && e.status === 'pending') e.status = 'cancelled'; });
    if (S.splitPlan && S.splitPlan.status === 'pending' && S.splitPlan.people.includes(who)) {
      const r = S.requests.find(x => x.id === S.splitPlan.reqId);
      if (r && reqOpen(r)) { r.status = 'cancelled'; r.note = '参与人变化，方案需要重新提'; r.resolvedAt = stamp(); }
      S.splitPlan = null;
    }
    if (S.laundry.user === who) S.laundry = { user:null, startedAt:null, minutes:0, endsAt:null, notifyMe:false, src:null };
    openTopics().forEach(t => { if (topicResolvable(t)) resolveTopic(t); });
    S.moveoutRecord = rec; S.moveout = null;
    const open = memberOpenBills(who).length;
    logFeed('sys', `租房中介已确认 ${mem(who).name} 退租${open ? `，还有 ${open} 笔账单待结清` : ''}`);
    checkSettled();
    render(); toast(open ? `退租已确认。你不再参与家里的事务，结清 ${open} 笔账单后成员关系正式结束。` : '退租已确认，没有待结的账，成员关系已结束。');
    break;
  }
  case 'undoMoveout': {
    const rec = S.moveoutRecord, who = ME;
    S.settling = S.settling.filter(x => x !== who); S.movedOut = S.movedOut.filter(x => x !== who);
    if (rec && rec.who === who) {
      rec.zones.forEach(({ sp, n }) => { const z = S.spaces.find(x => x.id === sp).zones.find(x => x.n === n); if (z) { z.o = who; delete z.freed; } });
      rec.tasks.forEach(({ id:tid }) => { const t = S.tasks.find(x => x.id === tid); if (t) { t.who = who; t.deferred = null; } });
    }
    S.moveoutRecord = null;
    logFeed('sys', `（演示）${mem(who).name} 恢复为在住成员`);
    render(); toast('已恢复为在住成员，分区和任务都还给你了');
    break;
  }

  /* ---- 逆向操作：改错了、取消、提前结束 ---- */
  case 'editBill': editBillSheet(id); break;
  case 'doEditBill': {
    const b = S.bills.find(x => x.id === sheetEl().dataset.bid);
    const amount = parseFloat(document.getElementById('eb-a').value) || 0;
    if (amount <= 0) { toast('金额要大于 0'); return; }
    b.title = document.getElementById('eb-t').value.trim() || b.title;
    b.amount = amount;
    b.payer = document.getElementById('eb-p').value;
    const ppl = [...sheetEl().querySelectorAll('#eb-w button[aria-pressed="true"]')].map(x => x.dataset.m);
    if (!ppl.length) { toast('至少选择一位参与的成员'); return; }
    /* 已经确认收款的份额不能被悄悄改掉：要么先撤销确认，要么这次不改金额和参与人 */
    const locked = payers(b).filter(p => payState(b, p) === 'confirmed');
    const changed = amount !== b.amount || ppl.join() !== b.people.join() || document.getElementById('eb-p').value !== b.payer;
    if (locked.length && changed) {
      toast(`${locked.map(x => mem(x).name).join('、')} 那几份已经确认收款了。要改金额或参与人，先在账单里撤销对应的结清。`);
      return;
    }
    b.people = ppl;
    b.payer = document.getElementById('eb-p').value;
    b.kind = document.getElementById('eb-k').value;
    delete b.shareCents; delete b.weights; b.method = 'even';
    /* 参与人变了，已经登记的付款状态里不该再留着不参与的人 */
    Object.keys(b.paid || {}).forEach(k => { if (!b.people.includes(k) || k === b.payer) delete b.paid[k]; });
    b.src = { ...b.src, edited:stamp(), by:ME };
    logFeed(ME, `修改了费用「${b.title}」，金额改为 <b>${yuan(amount)}</b>`);
    checkSettled();
    closeSheet(); render();
    toast(`已更新：${perLabel(b)}，本月合计 ${yuan(monthTotal())}，应付应收和净额都已重算`);
    break;
  }
  case 'delBill': {
    const b = S.bills.find(x => x.id === id);
    if (hasConfirmed(b)) { toast('这笔账里已经有人确认收款了，删掉会破坏历史账务。先撤销对应的结清再删。'); return; }
    S.bills = S.bills.filter(x => x.id !== id);
    logFeed(ME, `删除了费用「${b.title}」`);
    checkSettled();
    closeSheet(); render();
    toast(`已删除。本月合计 ${yuan(monthTotal())}，待你支付 ${yuan(myDueTotal())}，净额已重算`);
    break;
  }
  case 'editAway': editAwaySheet(id); break;
  case 'doEditAway': {
    const a = S.away.find(x => x.id === sheetEl().dataset.aid);
    const f = parseInt(document.getElementById('ea-f').value), t2 = parseInt(document.getElementById('ea-t').value);
    if (isNaN(f) || isNaN(t2) || t2 < f) { toast('结束日期不能早于开始日期'); return; }
    a.fromDn = f; a.toDn = t2; a.src = mySrc();
    logFeed(ME, `修改了离家登记：${fmtDn(a.fromDn)} — ${fmtDn(a.toDn)}`);
    closeSheet(); render();
    toast(`已更新，登记在住天数改为 ${Math.max(0, S.utilityForecast.days - awayDaysOf(a.who))} 天，值日与分摊建议同步重算`);
    break;
  }
  case 'delAway': {
    const a = S.away.find(x => x.id === id);
    S.away = S.away.filter(x => x.id !== id);
    S.tasks.forEach(t => { if (t.who === a.who && t.deferred && t.deferred.includes('离家')) t.deferred = null; });
    /* 已经提出、还没确认的按天数分摊方案建立在这条记录上，一起收回 */
    if (S.splitPlan && S.splitPlan.status === 'pending' && S.splitPlan.method === 'days') {
      const r = S.requests.find(x => x.id === S.splitPlan.reqId);
      if (r && reqOpen(r)) { r.status = 'cancelled'; r.note = '离家登记已取消，这个方案不再成立'; r.resolvedAt = stamp(); }
      S.splitPlan = null;
    }
    logFeed(a.who, '取消了离家计划');
    closeSheet(); render();
    toast('离家计划已取消，成员状态、值日和分摊建议都已恢复');
    break;
  }
  case 'editVisit': editVisitSheet(id); break;
  case 'doEditVisit': {
    const v = S.visits.find(x => x.id === sheetEl().dataset.vid);
    if (v.exId) { toast('这一晚来自已批准的临时例外，要改请先撤回那条例外'); return; }
    const nd = parseInt(document.getElementById('ev-d').value);
    if (!isNaN(nd)) v.dn = nd;
    v.time = document.getElementById('ev-t').value.trim() || v.time;
    v.overnight = sheetEl().querySelector('#ev-o button[aria-pressed="true"]').dataset.v === '1';
    v.nights = v.overnight ? 1 : 0;
    v.src = mySrc();
    const ck = stayCheck(v.host, v.guestId, 0);
    closeSheet(); render();
    toast(`已更新。${mem(v.host).name} 的「${v.guest}」本周登记 ${ck.total} 晚，${ck.over ? '超过' : '仍在'}可接受的 ${ck.allow} 晚${ck.over ? '' : '之内'}`);
    break;
  }
  case 'delVisit': {
    const v = S.visits.find(x => x.id === id);
    S.visits = S.visits.filter(x => x.id !== id);
    /* 这一晚是某条例外带来的：例外里也要同步去掉，不能留下一条"批了但没用"的悬空记录 */
    if (v.exId) { const e = S.exceptions.find(x => x.id === v.exId);
      if (e) { e.visitIds = (e.visitIds || []).filter(x => x !== v.id);
        if (!e.visitIds.length) { e.status = 'cancelled'; e.note = '对应的留宿登记已取消'; } } }
    logFeed(ME, `取消了 ${fmtDn(v.dn)} 的访客登记`);
    closeSheet(); render();
    toast(`已取消。${mem(v.host).name} 的「${v.guest}」本周登记回到 ${nightsOf(v.host, v.guestId)} 晚，规则判断已重新运行`);
    break;
  }
  case 'editRepair': editRepairSheet(id); break;
  case 'doEditRepair': {
    const r = S.repairs.find(x => x.id === sheetEl().dataset.rid);
    const add = document.getElementById('er-d').value.trim();
    if (add) { r.timeline.push({ s:'住户补充：' + add, at:stamp(), via:'member' }); logFeed(ME, `补充了报修说明：${add}`); }
    closeSheet(); render(); toast(add ? '已补充，租房中介会看到这条说明' : '没有补充内容');
    break;
  }
  case 'delRepair': {
    S.repairs = S.repairs.filter(x => x.id !== id);
    logFeed(ME, '撤回了一张报修单');
    closeSheet(); render(); toast('报修已撤回。受理之后就不能再撤回了。');
    break;
  }
  case 'doneRepair': {
    const r = S.repairs.find(x => x.id === id);
    r.timeline.push({ s:'已完成', at:stamp(), via:'member' });
    logFeed(ME, `确认「${r.desc}」已修好`);
    closeSheet(); render(); toast('已标记完成，生活页的报修状态同步更新');
    break;
  }
  case 'washCancel':
    logFeed(ME, '取消了洗衣机使用登记');
    S.laundry = { user:null, startedAt:null, minutes:0, endsAt:null, notifyMe:false, src:null };
    render(); toast('已取消，洗衣机恢复空闲'); break;
  case 'redivide': redivideSheet(); break;
  case 'doRedivide': {
    if (el.dataset.v === 'rotate') {
      /* 重新划分会动到每个人的分区，必须大家一起定，不能一个人点一下就改掉别人的格子 */
      const t = newTopic({ title:'重新划分公共空间', at:stamp(), by:ME,
        proposal:'冰箱、厨房储物柜、卫生间置物架、鞋柜的分区各往下顺次挪一格，公共区保持不变。',
        openText:`${mem(ME).name} 提出重新划分一次公共空间` });
      S.topics.push(t);
      logFeed('sys', '「重新划分公共空间」进入讨论，现有分区保持不变');
      closeSheet(); goTo('talk');
      toast('已放到「正在讨论」。在大家都接受之前，现在的分区不变。');
    } else {
      logFeed('sys', '讨论后决定维持现有的公共空间分法');
      closeSheet(); render(); toast('已记录：维持现在的分法');
    }
    break;
  }

  /* ---- 值日：完成即写一条完成记录，责任分布由这些记录统计 ---- */
  case 'doneTask': {
    const t = S.tasks.find(x => x.id === id);
    if (t.who !== ME) { toast('这项任务的负责人不是你'); break; }
    t.done = true; t.doneAt = stamp(); t.doneDn = dnNow(); t.deferred = null;
    S.completions.unshift([t.task, ME, fmtDn(dnNow())]);
    logFeed(ME, `完成了值日「${t.task}」`);
    render(); toast(`「${t.task}」已完成，已记入完成记录`);
    break;
  }
  case 'undoTask': {
    const t = S.tasks.find(x => x.id === id);
    t.done = false; t.doneAt = null; t.doneDn = null;
    const i = S.completions.findIndex(c => c[0] === t.task && c[1] === ME && c[2] === fmtDn(dnNow()));
    if (i >= 0) S.completions.splice(i, 1);
    render(); toast('已撤销完成标记，完成记录里也去掉了这一条'); break;
  }
  case 'deferTask': deferSheet(id); break;
  case 'doDefer': {
    const t = S.tasks.find(x => x.id === sheetEl().dataset.tid);
    const k = el.dataset.k;
    if (k === 'swap') {
      const c = sheetEl().dataset.cand;
      if (c) {
        /* 换班要对方同意才生效，负责人在此之前不变 */
        newRequest('swap', c, `${t.task} 换班`, `原定由 ${mem(ME).name} 负责，想和你换一下`, { task:t.id });
        t.deferred = `已向 ${mem(c).name} 发起换班，等待回应`;
        logFeed('sys', `${mem(ME).name} 就「${t.task}」发起了换班请求`);
        closeSheet(); render(); toast(`已向 ${mem(c).name} 发起换班请求，对方同意后负责人才会变`);
      }
    } else {
      t.dueDn = dnNow() + 1; delete t.dueKind;
      t.deferred = k === 'away' ? '今天不在家，已顺延到明天' : '今天较忙，已顺延到明天';
      logFeed('sys', `「${t.task}」顺延到 ${fmtDn(t.dueDn)}`);
      closeSheet(); render(); toast('已顺延到明天，不会记为未完成');
    }
    break;
  }
  case 'newTask': taskSheet(); break;
  case 'doTask': {
    const task = document.getElementById('nt').value.trim();
    if (!task) { toast('先写一下任务内容'); return; }
    const nd = document.getElementById('nd').value;
    S.tasks.push({ id:'t' + Date.now(), task, who:document.getElementById('nw').value,
      ...(nd === 'week' ? { dueKind:'week', dueDn: weekEndDn(dnNow()) } : { dueDn: dnNow() + (+nd || 0) }),
      done:false, temp:true });
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
    if (s.rule.startsWith('可直接')) {
      logFeed(ME, `登记借用了 ${mem(s.owner).name} 的${s.name}`);
      render(); toast('已登记借用，用完清洗放回');
    } else {
      /* "使用前问我"要走完整请求流程，不能只弹个提示 */
      newRequest('borrow', s.owner, `借用${s.name}`, `${mem(ME).name} 想用一下你的${s.name}`, { thing:s.id });
      render(); toast(`已向 ${mem(s.owner).name} 发出请求，对方回应后你会看到结果`);
    }
    break;
  }
  /* 回应请求：只记录"我这一票"。需要的人全部同意，请求才会通过并执行；
     有一个人不同意，就不再显示为通过，发起人可以撤回或转成讨论。 */
  case 'reqAgree': case 'reqDecline': case 'reqDiscuss': {
    const r = S.requests.find(x => x.id === id);
    if (!r || !reqOpen(r)) { toast('这条请求已经有结果了'); render(); break; }
    if (!reqNeed(r).includes(ME)) { toast('这条请求不需要你回应'); break; }
    const stance = act === 'reqAgree' ? 'agree' : act === 'reqDecline' ? 'decline' : 'discuss';
    r.responses = r.responses || {};
    r.responses[ME] = { stance, at:stamp(), dn:dnNow() };
    logFeed(ME, `对「${r.subject}」回应了：${RESP_TEXT[stance]}`);

    if (stance === 'discuss') {
      r.status = 'discuss'; r.resolvedAt = stamp(); r.by = ME;
      const t = newTopic({ title:REQ_LABEL[r.kind] + '：' + r.subject, proposal:r.detail, by:ME, at:stamp(),
        openText:`${mem(ME).name} 觉得这件事值得大家一起聊聊，而不是只回一句同意或不同意` });
      S.topics.push(t);
      if (r.effect && r.effect.exception) { const e = S.exceptions.find(x => x.id === r.effect.exception); if (e) { e.status = 'cancelled'; e.note = '已转为家里一起讨论'; } }
      sendMessage({ kind:'notify', to:[r.from], title:`你的「${r.subject}」转成了讨论`,
        body:`${mem(ME).name} 希望大家一起聊聊，而不是只回一句同意或不同意。议题已经在共识页的「正在讨论」里。`, meta:{ topic:t.id } });
      logFeed('sys', `「${r.subject}」已提到家里一起讨论`);
      render(); toast('已转为一起讨论，发起人会收到通知');
      break;
    }
    if (stance === 'decline') {
      r.status = 'declined'; r.resolvedAt = stamp(); r.by = ME;
      if (r.effect && r.effect.exception) { const e = S.exceptions.find(x => x.id === r.effect.exception); if (e) e.status = 'rejected'; }
      sendMessage({ kind:'notify', to:[r.from], title:`「${r.subject}」这次没有通过`,
        body:`有室友这次不太方便。你可以撤回这次申请，或者把它放到家里一起讨论。` });
      render(); toast('已回复"这次不太方便"。发起人会看到结果，不会显示成拒绝某个人。');
      break;
    }
    /* 同意：还没齐就继续等，齐了才执行 */
    if (!reqPassed(r)) {
      render();
      toast(`已记下你同意。还在等 ${reqWaiting(r).map(x => mem(x).name).join('、')} 回应，${reqProgress(r)}。`);
      break;
    }
    applyRequest(r);
    render();
    toast(`${reqNeed(r).map(x => mem(x).name).join('、')} 都同意了，${r.subject} 已生效。`);
    break;
  }
  case 'reqWithdraw': {
    const r = S.requests.find(x => x.id === id);
    if (!r) break;
    r.status = 'cancelled'; r.note = '发起人已撤回'; r.resolvedAt = stamp(); r.by = ME;
    if (r.effect && r.effect.exception) { const e = S.exceptions.find(x => x.id === r.effect.exception); if (e && e.status === 'pending') e.status = 'cancelled'; }
    if (r.kind === 'swap' && r.task) { const t = S.tasks.find(x => x.id === r.task); if (t && /换班/.test(t.deferred || '')) t.deferred = null; }
    reqNeed(r).forEach(x => sendMessage({ kind:'notify', to:[x], title:`「${r.subject}」已被撤回`, body:`${mem(ME).name} 撤回了这次申请，你不用再回应了。` }));
    logFeed(ME, `撤回了「${r.subject}」`);
    render(); toast('已撤回。还没回应的人不会再看到它，相关状态都回到原样。');
    break;
  }
  /* 有人不同意之后：发起人可以把它交给家里一起讨论 */
  case 'reqToTopic': {
    const r = S.requests.find(x => x.id === id);
    if (!r) break;
    const t = newTopic({ title:REQ_LABEL[r.kind] + '：' + r.subject, proposal:r.detail, by:ME, at:stamp(),
      openText:`由「${r.subject}」转来：这次没有全部同意，放到家里一起聊` });
    S.topics.push(t); r.topicId = t.id;
    logFeed('sys', `「${r.subject}」转入家里讨论`);
    goTo('talk'); toast('已放到「正在讨论」，大家可以慢慢聊，不用急着给一个同意或不同意。');
    break;
  }
  case 'shareMode': shareSheet(id); break;
  case 'doShare': {
    const s = S.supplies.find(x => x.id === id), v = el.dataset.v;
    if (v === 'private') { s.kind = 'private'; s.zone = s.zone || '未标注位置'; delete s.rule; }
    else { s.kind = 'lend'; s.rule = v === 'free' ? '可直接使用，用后清洗放回' : '使用前问一声'; }
    s.src = mySrc();
    S.segment = s.kind;
    const n = v === 'ask' ? 0 : cancelRequests(r => r.kind === 'borrow' && r.thing === s.id,
      v === 'private' ? `「${s.name}」的主人已改为不共享，本次请求已取消` : `「${s.name}」已改为可直接使用，不用再申请`);
    logFeed(ME, `把「${s.name}」的共享方式改为${v === 'private' ? '不共享' : v === 'free' ? '可直接使用' : '使用前询问'}`);
    closeSheet(); render();
    toast((v === 'private' ? '已改为不共享，其他人的可借列表里立刻看不到了' : '已更新共享方式') + (n ? `；${n} 条未处理的借用请求已取消并告知申请人` : ''));
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
  case 'delThing': {
    const x = S.supplies.find(y => y.id === id);
    const n = cancelRequests(r => r.kind === 'borrow' && r.thing === id, `「${x ? x.name : '物品'}」已被主人删除，本次请求已取消`);
    S.supplies = S.supplies.filter(y => y.id !== id);
    render(); toast(n ? `已删除，${n} 条未处理的借用请求已一并取消并告知申请人` : '已删除');
    break;
  }
  /* 管理自己的物品：改共享方式、说明、位置；删除只是次要动作 */
  case 'manageThing': manageThingSheet(id); break;
  case 'doManageThing': {
    const x = S.supplies.find(y => y.id === sheetEl().dataset.sid);
    const name = document.getElementById('mt-n').value.trim();
    if (!name) { toast('物品名称不能为空'); return; }
    const w = sheetEl().querySelector('#mt-w button[aria-pressed="true"]').dataset.v;
    const zone = document.getElementById('mt-z').value.trim();
    const rule = document.getElementById('mt-r').value.trim();
    x.name = name;
    x.kind = w === 'private' ? 'private' : 'lend';
    x.zone = zone || (x.kind === 'private' ? '未标注位置' : undefined);
    x.rule = x.kind === 'lend' ? (rule || (w === 'free' ? '可直接使用，用后清洗放回' : '使用前问一声')) : undefined;
    x.src = { ...(x.src || {}), via:'member', by:x.src && x.src.by || ME, at:x.src && x.src.at || stamp(), edited:stamp() };
    const n = x.kind === 'private'
      ? cancelRequests(r => r.kind === 'borrow' && r.thing === x.id, `「${x.name}」的主人已改为不共享，本次请求已取消`)
      : w === 'free' ? cancelRequests(r => r.kind === 'borrow' && r.thing === x.id, `「${x.name}」已改为可直接使用，不用再申请`) : 0;
    closeSheet(); render(); toast(`已更新「${x.name}」：${x.kind === 'lend' ? '可借 · ' + x.rule : '私人物品'}${n ? `；${n} 条未处理的借用请求已取消并告知申请人` : ''}`);
    break;
  }

  /* ---- 公共空间 ---- */
  /* 新成员分区是共同设定，不是谁点一下就定了：发起确认，在住成员都同意才写进分区表 */
  case 'confirmZones': {
    const pr = S.zoneProposal;
    if (pr.confirmed) { toast('这份分区已经确认过了'); break; }
    const live = S.requests.find(r => r.kind === 'zones' && reqOpen(r));
    if (live) { toast('已经在等大家确认了'); goTo('life', 'space'); break; }
    const r = newRequest('zones', 'all', `为 ${mem(pr.who).name} 分配公共空间分区`,
      `${pr.items.map(it => `${S.spaces.find(sp => sp.id === it.sp).name} ${it.n}`).join('、')}，${mem(pr.who).joined}起生效。其他人的分区不变。`,
      { days:7 });
    render();
    toast(reqNeed(r).length ? `已发起确认，等 ${reqNeed(r).map(x => mem(x).name).join('、')} 同意后才会生效。` : '已确认分区');
    break;
  }
  /* ---- 访客：每次登记都是一条记录，次数由记录累计 ---- */
  case 'newVisit': visitSheet(false); break;
  /* 登记访客。超出约定的那几晚不会先记上再补审批——
     它们走「临时例外」：批准之前不进留宿记录，批准之后只记一次。 */
  case 'doVisit': {
    const on = sheetEl().querySelector('#vo button[aria-pressed="true"]').dataset.v === '1';
    const host = document.getElementById('vh').value;
    const guest = document.getElementById('vg').value.trim() || '朋友';
    const guestId = guestKey(host, guest);
    const vdn = dnNow() + (parseInt(document.getElementById('vd').value) || 0);
    const time = document.getElementById('vw').value.trim() || '未填时间';
    const nights = on ? Math.max(1, parseInt(document.getElementById('vn').value) || 1) : 0;
    const ck = stayCheck(host, guestId, nights);
    const known = guestsOf(host).find(g => g.guestId === guestId);

    if (on && ck.over) {
      if (pendingEx(host, guestId)) { toast('这位访客已经有一条还在等回应的例外申请，先等那条有结果'); break; }
      const over = ck.total - ck.allow;
      const within = nights - over;
      /* 在约定之内的那几晚照常登记，只有超出的部分需要申请 */
      for (let i = 0; i < within; i++) S.visits.unshift({ id:'v' + Date.now() + i, host, guest, guestId,
        guestPhoto: known && known.photo, dn:vdn, time, overnight:true, nights:1, src:mySrc() });
      closeSheet();
      exceptionSheet({ host, guest, guestId, nights:over, fromDn:vdn, toDn:Math.max(vdn, weekEndDn(dnNow())),
        had:ck.had, limit:ck.limit, extra:ck.extra, registered:within });
      render();
      break;
    }

    for (let i = 0; i < (on ? nights : 1); i++) S.visits.unshift({ id:'v' + Date.now() + i, host, guest, guestId,
      guestPhoto: known && known.photo, dn:vdn, time, overnight:on, nights: on ? 1 : 0, src:mySrc() });
    logFeed(ME, `登记了访客：${relDn(vdn)} ${time}${on ? ` · 留宿 ${nights} 晚` : ''}`);
    closeSheet(); render();
    toast(on ? `已登记，「${guest}」本周共 ${ck.total} 晚，仍在${ck.extra ? `约定 ${ck.limit} 晚 + 已批准例外 ${ck.extra} 晚` : `约定的 ${ck.limit} 晚`}之内`
        : '已登记，室友会看到这次到访');
    break;
  }

  /* ---- 临时例外：申请 → 室友分别回应 → 全部同意才生效 ---- */
  case 'newException': exceptionSheet(null); break;
  case 'doException': {
    const d = JSON.parse(sheetEl().dataset.ex || '{}');
    const nights = Math.max(1, parseInt(document.getElementById('xn').value) || 1);
    const reason = (document.getElementById('xr').value || '').trim();
    const toDn = Math.max(d.fromDn != null ? d.fromDn : dnNow(), weekEndDn(dnNow()));
    const e = { id:'ex' + Date.now(), kind:'overnight', host:d.host || ME, guest:d.guest, guestId:d.guestId,
      nights, fromDn: d.fromDn != null ? d.fromDn : dnNow(), toDn, reason,
      status:'pending', createdDn:dnNow(), at:stamp(), visitIds:[] };
    S.exceptions.push(e);
    const r = newRequest('stay', 'all', `${d.guest}${relDn(e.fromDn)}起多留宿 ${nights} 晚`,
      `这是一次临时例外申请，不改动「${(S.rules.find(x => x.prefKey === 'overnight') || {}).title || '留宿约定'}」。${reason ? '原因：' + reason + '。' : ''}有效期到 ${fmtDn(toDn)}，过期自动失效。`,
      { effect:{ exception:e.id }, guest:d.guest, guestId:d.guestId, days: Math.max(1, toDn - dnNow()) });
    e.reqId = r.id;
    logFeed(ME, `申请了一次临时例外：「${d.guest}」多留宿 ${nights} 晚`);
    closeSheet(); goTo('life', 'guest');
    toast(reqNeed(r).length ? `已发出申请，等 ${reqNeed(r).map(x => mem(x).name).join('、')} 分别回应。批准前这几晚不会计入留宿记录。`
      : '已生效');
    break;
  }
  /* 例外申请人自己撤回 */
  case 'cancelException': {
    const e = S.exceptions.find(x => x.id === id);
    if (!e) break;
    e.status = 'cancelled';
    const r = S.requests.find(x => x.id === e.reqId);
    if (r && reqOpen(r)) { r.status = 'cancelled'; r.note = '申请人已撤回'; r.resolvedAt = stamp(); }
    logFeed(ME, `撤回了「${e.guest}」的临时例外申请`);
    render(); toast('已撤回。这几晚没有计入留宿记录，长期约定也没有变化。');
    break;
  }
  /* 觉得以后长期都需要，就从例外进入共识讨论 */
  case 'exToTopic': {
    const e = S.exceptions.find(x => x.id === id);
    const rule = S.rules.find(x => x.prefKey === 'overnight');
    const t = newTopic({ title:'访客留宿', prefKey:'overnight', ruleId: rule && rule.id, at:stamp(),
      proposal:`把同一访客每周留宿上限从 ${(overnightRule() || {}).limit || 2} 晚调整为 ${((overnightRule() || {}).limit || 2) + (e ? e.nights : 1)} 晚，超过仍然提前征求其他室友意见。`,
      by:ME, openText:'由一次临时例外转来：如果这种情况会长期发生，不如把约定本身重新定一次' });
    S.topics.push(t);
    logFeed('sys', '一次临时例外被转成了对长期约定的讨论');
    goTo('talk'); toast('已转成共识讨论。原约定在达成一致之前继续有效。');
    break;
  }
  /* ---- 离家 ---- */
  case 'newAway': awaySheet(); break;
  case 'doAway2': {
    const f = parseInt(document.getElementById('af').value), t2 = parseInt(document.getElementById('at').value);
    if (isNaN(f) || isNaN(t2) || t2 < f) { toast('结束日期不能早于开始日期'); return; }
    addAway(f, t2);
    closeSheet(); render(); toast(`已登记离家 ${fmtDn(f)} — ${fmtDn(t2)}，值日与分摊会基于这条记录调整`);
    break;
  }
  case 'cancelAway': case 'cancelAwayMe': {
    const a = id ? S.away.find(x => x.id === id) : awayOf(ME);
    if (a) { a.toDn = dnNow() - 1; a.endedEarly = stamp(); logFeed(ME, '提前结束了离家登记'); }
    render(); toast('已恢复在住状态，值日和分摊建议同步重算');
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
  case 'washDone': {
    const L = S.laundry;
    logFeed(ME, '取出了衣物，洗衣机已释放');
    /* 有人等着用：真的给他发一条提醒，而不是只在界面上写"会提醒你" */
    if (L.notifyMe && L.notifyFor && L.notifyFor !== ME)
      sendMessage({ kind:'notify', from:'sys', to:[L.notifyFor], title:'洗衣机空出来了',
        body:`${mem(ME).name} 已经把衣物取走，现在可以用了。（演示：模拟站内提醒）` });
    S.laundry = { user:null, startedAt:null, minutes:0, endsAt:null, notifyMe:false, notifyFor:null, src:null };
    render(); toast('洗衣机已标记为空闲' + (L.notifyMe && L.notifyFor !== ME ? `，已提醒 ${mem(L.notifyFor).name}` : ''));
    break;
  }
  case 'notifyWash':
    S.laundry.notifyMe = true; S.laundry.notifyFor = ME; render();
    toast('洗衣机到点后会给你一条站内提醒（演示：推进时间就能看到），不会打扰其他人'); break;

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
    toast('报修单已提交，租房中介受理后状态会自动同步回来');
    setTimeout(() => {
      const r = S.repairs.find(x => x.id === rid);
      if (r && r.timeline.length === 1) {
        r.timeline.push({ s:'管家已受理（演示：模拟机构回传）', at:stamp(), via:'platform' });
        logFeed('sys', `租房中介已受理报修：${r.desc}（演示）`);
        sendMessage({ kind:'steward', from:'sys', to:[r.by], title:`${HOUSE.steward}已受理你的报修`,
          body:`${r.desc} —— 稍后会安排上门时间。演示环境里机构侧的动作都是模拟的。` });
        render(); toast(`${HOUSE.steward}已受理，稍后会安排上门时间（演示：模拟机构回传）`);
      }
    }, 2800);
    break;
  }

  /* ---- 账单 ----
     结清按"每一份"走：付款人说已付 → 垫付人确认收到。
     一个人点一下，只代表他自己那一份，不代表整笔账都清了。 */
  case 'payClaim': {
    const b = S.bills.find(x => x.id === id), who = el.dataset.w || ME;
    if (who !== ME) { toast('只能标记你自己那一份'); break; }
    b.paid = b.paid || {};
    b.paid[ME] = { ...(b.paid[ME] || {}), claimedAt:stamp(), claimedDn:dnNow() };
    sendMessage({ kind:'notify', to:[b.payer], title:`${mem(ME).name} 说已经付了 ${yuan(shareOf(b, ME))}`,
      body:`这是「${b.title}」里他那一份。收到之后在账单页确认一下，这一份才算结清。`, meta:{ bill:b.id } });
    logFeed(ME, `标记已支付「${b.title}」中自己的 <b>${yuan(shareOf(b, ME))}</b>`);
    render(); toast(`已告诉 ${mem(b.payer).name}。等他确认收到，这一份才算结清。`);
    break;
  }
  case 'payConfirm': {
    const b = S.bills.find(x => x.id === id), who = el.dataset.w;
    if (b.payer !== ME) { toast('只有垫付人能确认收到这笔钱'); break; }
    b.paid = b.paid || {}; b.paid[who] = { ...(b.paid[who] || {}), claimedAt:(b.paid[who] || {}).claimedAt || stamp(), confirmedAt:stamp(), confirmedDn:dnNow() };
    sendMessage({ kind:'notify', to:[who], title:`${mem(ME).name} 确认收到了你的 ${yuan(shareOf(b, who))}`,
      body:`「${b.title}」里你这一份已经结清。`, meta:{ bill:b.id } });
    logFeed(ME, `确认收到 ${mem(who).name} 的 <b>${yuan(shareOf(b, who))}</b>（${b.title}）`);
    const ended = checkSettled();
    render();
    toast(isSettled(b)
      ? (ended.length ? `「${b.title}」全部结清。${ended.map(x => mem(x).name).join('、')} 的账已全部结清，成员关系正式结束。` : `「${b.title}」的每一份都确认了，这笔账结清。`)
      : `已确认。这笔还有 ${payers(b).filter(p => payState(b, p) !== 'confirmed').length} 份没结清。`);
    break;
  }
  case 'payUndo': {
    const b = S.bills.find(x => x.id === id), who = el.dataset.w;
    if (who !== ME && b.payer !== ME) { toast('只有这一份的付款人或垫付人能撤销'); break; }
    delete b.paid[who];
    logFeed(ME, `撤销了「${b.title}」中 ${mem(who).name} 那一份的结清状态`);
    render(); toast('已撤销。这一份回到待支付，净额结算同步重算。');
    break;
  }
  /* 垫付人一次确认全部收到：仍然是逐份写入，不是把整笔"一键标成已结清" */
  case 'payConfirmAll': {
    const b = S.bills.find(x => x.id === id);
    if (b.payer !== ME) { toast('只有垫付人能确认收款'); break; }
    const list = payers(b).filter(p => payState(b, p) !== 'confirmed');
    list.forEach(p => { b.paid[p] = { ...(b.paid[p] || {}), claimedAt:(b.paid[p] || {}).claimedAt || stamp(), confirmedAt:stamp(), confirmedDn:dnNow() };
      sendMessage({ kind:'notify', to:[p], title:`${mem(ME).name} 确认收到了你的 ${yuan(shareOf(b, p))}`, body:`「${b.title}」里你这一份已经结清。`, meta:{ bill:b.id } }); });
    logFeed(ME, `确认收到「${b.title}」剩余 ${list.length} 份款项`);
    const ended2 = checkSettled();
    render(); toast(ended2.length ? `已全部确认。${ended2.map(x => mem(x).name).join('、')} 的账已结清，成员关系结束。` : `已确认 ${list.length} 份，这笔账结清。`);
    break;
  }
  case 'newBill': billSheet(); break;
  case 'doBill': {
    const title = document.getElementById('bt').value.trim() || '公共费用';
    const amount = parseFloat(document.getElementById('ba').value) || 0;
    if (amount <= 0) { toast('请填写大于 0 的金额'); document.getElementById('ba').focus(); return; }
    const payer = document.getElementById('bp').value;
    const kind = document.getElementById('bk').value;
    /* 只有随使用变化的费用才按在住天数分；固定成本和消耗品按家里约定 */
    const method = kind === 'utility' ? document.getElementById('bm').value : 'even';
    const people = [...sheetEl().querySelectorAll('#bw button[aria-pressed="true"]')].map(b => b.dataset.m);
    if (!people.length) { toast('至少选择一位参与的成员'); return; }
    const bill = { id:'b' + Date.now(), title, note:'', amount, payer, people, method, kind, paid:{},
      date:TODAY, src:{ via:'manual', by:ME, at:stamp() } };
    /* 按天数分：存权重，金额按分现算，各人相加永远等于总额 */
    if (method === 'days') bill.weights = Object.fromEntries(people.map(pid =>
      [pid, Math.max(0, S.utilityForecast.days - awayDaysOf(pid))]));
    S.bills.unshift(bill);
    logFeed(payer, `记了一笔 <b>${title} ${yuan(amount)}</b>`);
    closeSheet(); goTo('bill');
    toast(`已记录「${title}」 · ${METHOD_TEXT[method]}`);
    break;
  }
  /* 分摊方案：一个人只能"提出"，要相关成员都确认，才会生成账单。
     系统不会因为谁点了一下就说"已由全员确认"。 */
  case 'proposeSplit': {
    const method = el.dataset.m;
    if (S.splitPlan && S.splitPlan.status === 'pending') { toast('已经有一个分摊方案在等大家确认了'); break; }
    const people = living().map(m => m.id);
    const fd = fairByDays(people);
    const plan = { id:'sp' + Date.now(), method, people, payer:ME, status:'pending', by:ME, at:stamp(),
      weights: method === 'days' ? Object.fromEntries(fd.rows.map(r => [r.id, r.days])) : null };
    S.splitPlan = plan;
    const detail = method === 'days'
      ? `${S.utilityForecast.title} ${yuan(S.utilityForecast.amount)} 按登记在住天数分：${fd.rows.map(r => `${mem(r.id).name} ${yuan(r.amount)}（${r.days} 天）`).join('、')}。`
      : `${S.utilityForecast.title} ${yuan(S.utilityForecast.amount)} 维持平均分摊，每人 ${yuan(S.utilityForecast.amount / people.length)}。`;
    const r = newRequest('split', 'all', `${S.utilityForecast.title}的分摊方案`, detail + '确认之后才会生成这笔账单。', { days:5 });
    plan.reqId = r.id;
    logFeed(ME, `提出了${S.utilityForecast.title}的分摊方案：${method === 'days' ? '按登记在住天数' : '维持平均分摊'}`);
    render();
    toast(reqNeed(r).length ? `方案已提出，等 ${reqNeed(r).map(x => mem(x).name).join('、')} 确认。在那之前不会生成账单。` : '已生成账单');
    break;
  }
  case 'cancelSplit': {
    const plan = S.splitPlan;
    if (!plan) break;
    const r = S.requests.find(x => x.id === plan.reqId);
    if (r && reqOpen(r)) { r.status = 'cancelled'; r.note = '提出人已撤回'; r.resolvedAt = stamp(); }
    S.splitPlan = null;
    render(); toast('已撤回这个分摊方案，账单没有变化。');
    break;
  }

  /* ---- 共识 ----
     表态只更新"我对当前这版方案的态度"，议题不会因为谁点了一下就消失；
     需要的人都接受了，才写进约定。 */
  case 'toggleSame': UI.sameOpen = !UI.sameOpen; render(); break;
  case 'jumpTo': { const s = document.getElementById(el.dataset.k); if (s) s.scrollIntoView({ behavior:'smooth', block:'start' }); break; }
  case 'openTopic': S.tab = 'talk'; S.sub = 'topic'; S.topicId = id; UI.editFor = null; render(); window.scrollTo({ top:0 }); break;
  case 'stance': {
    const t = topicById(id), s = el.dataset.s;
    const resolved = setStance(t, ME, s);
    /* 不同意的话，顺手问问更希望怎么安排；其他态度想补充也随时能点"补充想法" */
    UI.noteFor = s === 'disagree' ? t.id : (UI.noteFor === t.id ? null : UI.noteFor);
    render();
    if (resolved) { toast(`大家都接受了「${t.title}」的方案，已经写进共同约定`); break; }
    toast(s === 'agree' ? '已记录你的想法，随时可以修改'
        : s === 'disagree' ? '已记录。说说你更希望怎么安排？'
        : '没关系，想好以后随时回来改。');
    if (s === 'disagree') { const ta = document.getElementById('note-' + t.id); if (ta) ta.focus(); }
    break;
  }
  case 'noteOpen': UI.noteFor = id; render(); { const ta = document.getElementById('note-' + id); if (ta) ta.focus(); } break;
  case 'noteCancel': UI.noteFor = null; render(); break;
  case 'noteSave': {
    const t = topicById(id), ta = document.getElementById('note-' + id);
    const text = ta ? ta.value.trim() : '';
    const p = t.positions[ME] || (t.positions[ME] = { stance:'provided', version:t.version, at:stamp() });
    p.note = text; p.at = stamp();
    t.history.push({ type:'note', who:ME, at:stamp(), text, version:t.version });
    UI.noteFor = null;
    render(); toast(text ? '已记下你的补充意见，大家都能看到' : '已清空补充意见');
    break;
  }
  /* 方案改了就是新的一版：之前的表态不能自动算成对新方案的同意 */
  case 'proposalEdit': UI.editFor = id; render(); { const ta = document.getElementById('prop-' + id); if (ta) ta.focus(); } break;
  case 'proposalCancel': UI.editFor = null; render(); break;
  case 'proposalSave': {
    const t = topicById(id), ta = document.getElementById('prop-' + id);
    const text = ta ? ta.value.trim() : '';
    if (!text) { toast('方案不能是空的'); return; }
    UI.editFor = null;
    if (text === t.proposal) { render(); toast('方案没有变化'); break; }
    t.history.push({ type:'proposal', who:ME, at:stamp(), from:t.proposal, text, version:t.version + 1 });
    t.proposal = text; t.version++;
    logFeed('sys', `「${t.title}」的方案调整到第 ${t.version} 版，等待大家重新确认`);
    render(); toast(`方案已更新到第 ${t.version} 版。之前的表态需要重新确认，也包括你自己的。`);
    break;
  }
  /* 限时试行：先按新方案走一段时间，到期自动回到讨论，不会悄悄变成长期约定 */
  case 'trialTopic': {
    const t = topicById(id);
    const until = dnNow() + 14;
    t.status = 'trial'; t.trialUntilDn = until; t.trialFrom = dnNow();
    t.history.push({ type:'trial', who:ME, at:stamp(), version:t.version, until });
    const rule = S.rules.find(r => r.id === (t.ruleId || t.revisit));
    if (rule) {
      /* 试行期的条文是临时的：记下试行前的样子，到期原样还回去 */
      rule.beforeTrial = { title:rule.title, desc:rule.desc, since:rule.since, prefVal:rule.prefVal };
      rule.trialOf = t.id; rule.desc = t.proposal; rule.trialUntilDn = until;
    }
    logFeed('sys', `「${t.title}」进入限时试行，到 ${fmtDn(until)} 为止`);
    render();
    toast(`已开始试行，到 ${fmtDn(until)}。到期自动回到讨论，不会直接变成长期约定。`);
    break;
  }
  case 'endTrial': {
    const t = topicById(id), k = el.dataset.k;
    const rule = S.rules.find(r => r.id === (t.ruleId || t.revisit));
    if (k === 'adopt') {
      if (rule) { delete rule.trialOf; delete rule.beforeTrial; delete rule.trialUntilDn; }
      t.status = 'discussion'; t.positions = {};
      t.history.push({ type:'trialAdopt', who:ME, at:stamp(), version:t.version });
      render(); toast('试行结束。要正式写进约定，仍然需要大家各自再确认一次——试行不等于已经同意。');
    } else {
      if (rule && rule.trialOf === t.id) { Object.assign(rule, rule.beforeTrial || {}); delete rule.trialOf; delete rule.beforeTrial; delete rule.trialUntilDn; }
      t.status = 'discussion'; t.positions = {};
      t.history.push({ type:'trialEnd', who:ME, at:stamp(), version:t.version });
      render(); toast('已提前结束试行，约定恢复成试行前那一版，讨论继续。');
    }
    break;
  }
  /* 没达成一致也是一种结果：原约定保持不变 */
  case 'holdTopic': {
    const t = topicById(id);
    t.status = 'hold'; t.heldAt = stamp();
    t.history.push({ type:'hold', who:ME, at:stamp() });
    logFeed('sys', `「${t.title}」暂不调整，保持原有约定`);
    goTo('talk'); toast('已标记为暂不调整。原来的约定保持不变，之后想起来还能再提。');
    break;
  }
  case 'reopenTopic': {
    const t = topicById(id);
    t.status = 'discussion'; t.positions = {};
    t.history.push({ type:'reopen', who:ME, at:stamp() });
    logFeed('sys', `「${t.title}」重新打开了讨论`);
    render(); toast('已重新打开讨论，大家可以重新表态');
    break;
  }
  /* 入住共识结果页里的"接受这个建议"：这件事已经在讨论就直接记一票同意，没有就开一个议题 */
  case 'acceptSuggest': {
    const k = el.dataset.k, label = PREF_KEYS.find(p => p.k === k).label;
    let t = openTopics().find(x => x.prefKey === k);
    if (!t) {
      t = newTopic({ title:label, prefKey:k, proposal:SUGGESTION[k], by:ME, at:stamp(),
        ruleId:(S.rules.find(r => r.prefKey === k) || {}).id,
        openText:`${mem(ME).name} 在入住共识结果里接受了管家建议，提交大家一起确认` });
      S.topics.push(t);
      logFeed('sys', `「${label}」的建议已提交全员确认`);
    }
    const resolved = setStance(t, ME, 'agree');
    goTo('talk'); toast(resolved ? `大家都接受了「${label}」的方案，已经写进共同约定` : '已记录你接受这个方案，其他人都接受后才会成为约定');
    break;
  }
  case 'editSuggest': {
    const t = openTopics().find(x => x.prefKey === el.dataset.k);
    if (!t) { toast('可以先接受建议开一个议题，再在讨论详情里调整方案'); break; }
    S.tab = 'talk'; S.sub = 'topic'; S.topicId = t.id; UI.editFor = t.id;
    render(); window.scrollTo({ top:0 });
    break;
  }

  /* ---- 入住共识问卷 ---- */
  case 'startQuiz': S.quiz = { step:0, answers:{} }; quizSheet(); break;
  /* 从「我的」进来是改自己的偏好：带着现在的答案进问卷，只改想改的；改偏好 ≠ 改约定 */
  case 'editPrefs': S.quiz = { step:0, answers:{ ...mem(ME).prefs }, from:'me' }; quizSheet(); break;
  case 'quizPick': S.quiz.answers[QUIZ[S.quiz.step].k] = el.dataset.v; quizSheet(); break;
  case 'quizBack': S.quiz.step--; quizSheet(); break;
  case 'quizNext':
    if (S.quiz.step === QUIZ.length - 1) {
      S.myPrefs[ME] = { ...(S.myPrefs[ME] || {}), ...S.quiz.answers };
      S.onboardDone[ME] = TODAY;
      logFeed(ME, '更新了自己的生活偏好');
      closeSheet();
      if (S.quiz.from === 'me') {
        goTo('me');
        const diff = myPrefDiff();
        if (diff.length) prefDiffSheet(diff);
        else toast('已更新你的偏好。和现在的共同约定没有冲突。');
      } else {
        goTo('talk', 'onboard');
        toast('已更新。已经形成约定的部分不会自动改变，需要重新讨论。');
      }
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
  case 'awkBack': S.awk.step = Math.max(0, S.awk.step - 1); S.awk.anonText = null; awkwardSheet(); break;
  /* 匿名发起前：把会暴露身份的说法换成描述事情本身的说法 */
  case 'anonClean': {
    const ta = document.getElementById('anonT');
    if (ta) { S.awk.anonText = anonClean(ta.value); awkwardSheet(); toast('已改成不指向具体某个人的说法，你还可以继续编辑'); }
    break;
  }
  case 'awkSubmit': {
    const a = S.awk;
    const existing = ruleFor(a.focus);
    const gap = gapFor(a.focus);
    if (a.way === 'private') {
      /* 真的送达：Demo 用模拟站内消息，切换到对方身份就能看到并回应 */
      const text = (document.getElementById('awkFinal') || {}).value || '';
      const to = a.host && a.host !== ME ? [a.host] : living().map(m => m.id).filter(x => x !== ME);
      sendMessage({ kind:'private', from:ME, to, title:`${mem(ME).name} 私下说了一句`, body:text.trim(),
        meta:{ focus:a.focus } });
      closeSheet(); goTo('me', 'msg');
      toast(`已发给 ${to.map(x => mem(x).name).join('、')}（演示：模拟站内消息，切换身份可以看到）。家里动态里不会出现。`);
    } else if (a.way === 'watch') {
      /* 没超出约定就不制造矛盾，只在自己这里留个观察记录 */
      S.issues.unshift({ id:'i' + Date.now(), cat:a.readCat || a.cat, rule:existing && existing.id,
        title:a.focus, level:0, count:0, window:'最近 7 天',
        note:'目前的登记情况还在约定之内，先继续观察，没有发出任何提醒。',
        src:{ via:'member', by:ME, at:stamp() }, follow:'self' });
      closeSheet(); goTo('talk', 'issue');
      toast('已记在你自己这里。没有超出约定，所以不会打扰任何人。');
    } else if (a.way === 'remind') {
      /* 中立提醒：发给相关的人，只说约定和登记情况，不点名、不说是谁触发的 */
      const to = a.host && a.host !== ME ? [a.host] : living().map(m => m.id).filter(x => x !== ME);
      sendMessage({ kind:'remind', from:'sys', to, anonymous:true, title:`关于「${existing.title}」的一次中立提醒`,
        body:`${gap ? gap.text : ''}这条提醒由系统按共同约定发出，不指向任何人，也不会显示是谁触发的。`,
        meta:{ rule:existing.id } });
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
      const txt = (document.getElementById('anonT') || {}).value || `${existing.desc}${gap ? ' 当前情况：' + gap.text : ''}`;
      S.topics.push(newTopic({ title:'重新确认：' + existing.title, revisit:existing.id, at:stamp(), anon:true,
        proposal: txt.trim(),
        openText:'有人觉得这条约定需要重新明确一次（系统不显示是谁提出的）。在大家达成一致之前，原约定继续有效。' }));
      logFeed('sys', `「${existing.title}」进入重新确认，现行约定暂不改动`);
      closeSheet(); goTo('talk');
      toast('已发起重新确认。不新增约定，只改现有这一条；原约定在达成一致前继续有效。');
    } else {
      const txt = (document.getElementById('anonT') || {}).value || AWK_SUGGEST[a.focus] || `关于${a.focus}的约定，等待大家一起确认。`;
      S.topics.push(newTopic({ title:a.focus, at:stamp(), anon:true, proposal: txt.trim(),
        openText:'有人把这件事提到家里一起聊（系统不显示是谁提出的）' }));
      logFeed('sys', `新增讨论议题「${a.focus}」`);
      closeSheet(); goTo('talk');
      toast('已发起讨论。系统不显示发起人，但内容本身可能让人猜到——你刚才看到的就是大家会看到的那一段。');
    }
    break;
  }

  /* ---- 居住问题：记录之后必须有去向 ---- */
  case 'issueFollow': {
    const it = S.issues.find(x => x.id === id), k = el.dataset.k;
    const rule = S.rules.find(r => r.id === it.rule);
    it.follow = k;
    if (k === 'remind') {
      it.level = Math.max(it.level, 2);
      /* 真的发出去：不点名，但收件人确实会在自己的消息里看到 */
      sendMessage({ kind:'remind', from:'sys', to:living().map(m => m.id).filter(x => x !== ME), anonymous:true,
        title:`关于「${rule ? rule.title : it.title}」的一次中立提醒`,
        body:`${it.window}系统记录到 ${it.count} 次与这条约定的出入。这条提醒不指向任何人，也不显示是谁触发的。（演示：模拟站内消息）`,
        meta:{ rule: rule && rule.id } });
      logFeed('sys', `按共同约定就「${it.title}」发出了一次私下提醒`);
    }
    if (k === 'discuss') {
      it.level = 4;
      S.topics.push(newTopic({ title:'重新确认：' + (rule ? rule.title : it.title), revisit: rule && rule.id, at:stamp(),
        proposal: rule ? rule.desc : it.note, openText:`由居住问题记录「${it.title}」发起，不显示是谁提的` }));
      logFeed('sys', `「${it.title}」已提到家里一起讨论`);
    }
    if (k === 'steward') { it.level = 5; render(); stewardSheet(it.id); return; }
    render();
    toast(k === 'self' ? '已留存，只有你能看到' : k === 'remind' ? '提醒已私下发出，不点名' : '已放到家里一起讨论');
    break;
  }
  case 'clarifyRule': clarifySheet(id); break;
  case 'clarifyPick': el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); break;
  /* 重新明确标准 = 提出一个新方案，原约定在达成一致之前原样生效，不会被这一步改掉 */
  case 'doClarify': {
    const picked = [...sheetEl().querySelectorAll('.opt[aria-pressed="true"]')].map(b => b.textContent.trim());
    const it = S.issues.find(x => x.id === sheetEl().dataset.iid);
    const rule = S.rules.find(r => r.id === it.rule);
    if (!picked.length) { toast('至少选一条具体标准'); return; }
    const proposal = picked.join('、') + '。';
    it.level = 1; it.count = 0; it.follow = 'discuss';
    it.note = '已经提出一版更具体的标准，正在等大家确认。在那之前，原来的约定继续有效。';
    S.topics.push(newTopic({ title:'重新确认：' + rule.title, revisit:rule.id, at:stamp(),
      proposal, openText:'有人提出把这条约定的标准写得更具体（不显示是谁提的）。原约定在达成一致之前保持不变。' }));
    logFeed('sys', `「${rule.title}」进入重新确认，现行约定暂不改动`);
    closeSheet(); goTo('talk'); toast('已发起重新确认。原来的约定继续生效，大家都接受新版才会替换。');
    break;
  }
  case 'stewardBrief': stewardSheet(id); break;
  case 'member': memberSheet(id); break;
  /* 分区不是个人能改的：想换要向对方发请求，对方同意才互换 */
  case 'zoneSwap': zoneSwapSheet(id); break;
  case 'doZoneSwap': {
    const sp = S.spaces.find(x => x.id === sheetEl().dataset.spid);
    const mine = sp.zones.find(z => z.o === ME);
    const pick = sheetEl().querySelector('#zs-w button[aria-pressed="true"]');
    if (!pick) { toast('先选一块想换的分区'); return; }
    const target = sp.zones.find(z => z.n === pick.dataset.n);
    newRequest('zone', target.o, `想和你换${sp.name}的分区`, `${mem(ME).name} 的 ${mine.n} ↔ 你的 ${target.n}，同意后两块互换`, { zone:{ sp:sp.id, from:mine.n, to:target.n } });
    closeSheet(); render(); toast(`已向 ${mem(target.o).name} 发出分区调整请求，对方同意后才会互换`);
    break;
  }
  /* 不好开口：确认说的是哪一位访客 */
  case 'awkGuest': S.awk.host = el.dataset.h; S.awk.guestId = el.dataset.g || null; S.awk.step = 2; awkwardSheet(); break;
  /* 提交协调摘要：Demo 不会真的发给机构，但会生成一条可查的模拟工单和回执 */
  case 'doSteward': {
    const iid = sheetEl().dataset.iid;
    const it = (iid && S.issues.find(x => x.id === iid)) || visibleIssues().find(x => x.follow !== 'self');
    const brief = { id:'br' + Date.now(), issue: it && it.id, by:ME, at:stamp(), dn:dnNow(),
      status:'已提交（模拟）', timeline:[{ s:'住户提交协调摘要', at:stamp(), via:'member' }] };
    S.briefs = S.briefs || []; S.briefs.unshift(brief);
    if (it) { it.brief = brief.id; it.level = 5; }
    sendMessage({ kind:'steward', from:'sys', to:living().map(m => m.id), title:`${HOUSE.steward}收到了一份协调摘要（模拟）`,
      body:`摘要里只写了约定和登记情况的差距，没有点名任何人。演示环境不会真正发送给机构，这里用一条模拟工单表示。`,
      meta:{ brief:brief.id } });
    logFeed('sys', `向${HOUSE.steward}提交了一份协调摘要（演示：模拟工单 ${brief.id.slice(-4)}）`);
    closeSheet(); goTo('talk', 'issue');
    toast(`已生成模拟工单。演示环境不会真的发给机构，你可以在问题记录里看到它的状态。`);
    break;
  }
  /* 模拟机构侧回应，让这条链路有结果而不是停在"已提交" */
  case 'stewardReply': {
    const b = (S.briefs || []).find(x => x.id === id);
    if (!b) break;
    b.status = '管家已回复（模拟）';
    b.timeline.push({ s:`${HOUSE.steward}回复：会在本周联系三位住户，各自说明一次使用习惯`, at:stamp(), via:'platform' });
    sendMessage({ kind:'steward', from:'sys', to:living().map(m => m.id), title:`${HOUSE.steward}回复了协调请求（模拟）`,
      body:'会在本周分别联系三位住户，各自说明一次使用习惯，再给出一个建议。这是演示环境模拟的机构回应。' });
    logFeed('sys', `${HOUSE.steward}回复了协调请求（演示）`);
    render(); toast('这是演示环境模拟的机构回应，真实环境由机构侧系统回传。');
    break;
  }
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
  /* 管家执行：全部读 S.pending —— 它就是预览里那一份，不会换算法 */
  case 'doStock': {
    const p = S.pending;
    const s = S.supplies.find(x => x.id === p.supplyId);
    if (!s) { toast('这件物品已经不在了'); closeSheet(); break; }
    if (s.mode === 'count') { if (p.qty == null || isNaN(p.qty)) { toast('先填一下现在还剩多少'); return; }
      s.qty = p.qty; s.max = Math.max(s.max, p.qty); }
    else s.state = p.state || s.state;
    s.src = mySrc();
    logFeed(ME, `把${s.name}更新为 <b>${supplyText(s)}</b>`);
    closeSheet(); goTo('life', 'supply');
    toast(isLow(s) ? `${s.name}已低于约定水位，首页出现补充提醒` : `${s.name}已更新为 ${supplyText(s)}`);
    break;
  }
  case 'doBuy': {
    const p = S.pending;
    if (!p.name || p.amount == null || isNaN(p.amount) || !p.people.length) { toast('还有必填项没确认'); return; }
    let s = p.supplyId && S.supplies.find(x => x.id === p.supplyId);
    if (!s) {
      s = { id:'s' + Date.now(), kind:'public', mode:'count', name:p.name, qty:0, min:1,
            unit:p.unit || '件', max:Math.max(2, (p.qty || 1) * 2), src:mySrc() };
      S.supplies.push(s);
    }
    applyPurchase(s, p.qty || 0, p.amount, p.people, s.mode === 'state' ? '充足' : null, 'butler', p.payer);
    closeSheet(); goTo('bill');
    toast(`${s.name}更新为 ${supplyText(s)}，账单新增 ${yuan(p.amount)}，${p.people.length} 人分摊${
      p.people.length < living().length ? `（${living().filter(m => !p.people.includes(m.id)).map(m => m.name).join('、')} 这次不分）` : ''}`);
    break;
  }
  case 'doAway': {
    const p = S.pending;
    if (p.fromDn == null || isNaN(p.fromDn) || p.toDn == null || isNaN(p.toDn)) { toast('先把日期选完整'); return; }
    addAway(p.fromDn, p.toDn);
    closeSheet(); goTo('life', 'away');
    toast(`已登记离家 ${fmtDn(p.fromDn)} — ${fmtDn(p.toDn)}。水电怎么分要大家确认，系统不会替你们改。`);
    break;
  }
  /* 一句话里有几件事时，用户选了哪一件就按哪一件继续 */
  case 'butlerPick': {
    const k = el.dataset.k, text = el.dataset.text;
    closeSheet();
    if (k === 'awkward') { awkward(); break; }
    if (k === 'visit') { visitSheet(/过夜|留宿/.test(text)); break; }
    const forced = parseButlerAs(k, text);
    if (forced) butlerRoute(forced);
    break;
  }
  }
});
function awkward() { S.awk = { step:0, cat:'', text:'', focus:'', way:'rule' }; awkwardSheet(); }

/* ============================================================
   共用业务动作
   ============================================================ */
function applyPurchase(s, qty, amount, people, state, via, payer) {
  const ppl = people || living().map(m => m.id);
  if (s.mode === 'count') { s.qty += qty; s.max = Math.max(s.max, s.qty); }
  else if (state) s.state = state;
  s.src = mySrc();
  if (amount > 0) {
    S.bills.unshift({ id:'b' + Date.now(), title:s.name, payerOverride:payer || null,
      note: s.mode === 'count' ? `补充 ${qty} ${s.unit}` : `补充至${state || s.state}`,
      amount, payer: payer || ME, people:ppl, method:'even', kind:'supply', paid:{}, date:TODAY,
      src:{ via: via || 'supply', by:ME, at:stamp() } });
    logFeed(ME, `补充了${s.name}，并记了一笔 <b>${yuan(amount)}</b> 的公共支出`);
  } else {
    logFeed(ME, `补充了${s.name}，当前 <b>${supplyText(s)}</b>`);
  }
}

function addAway(fromDn, toDn) {
  S.away = S.away.filter(a => !(a.who === ME && !a.cancelled && a.toDn >= dnNow()));
  S.away.push({ id:'aw' + Date.now(), who:ME, fromDn, toDn, cancelled:false, src:mySrc() });
  logFeed(ME, `登记了离家：${fmtDn(fromDn)} — ${fmtDn(toDn)}`);
}

function startWash(minutes) {
  const [h, m] = NOW.split(':').map(Number);
  const end = new Date(2026, 8, 12, h, m + minutes);
  const hh = String(end.getHours()).padStart(2, '0'), mm = String(end.getMinutes()).padStart(2, '0');
  S.laundry = { user:ME, startedAt:NOW, minutes, endsAt:`${hh}:${mm}`, notifyMe:false,
    src:{ via:'member', by:ME, at:`今天 ${NOW} 点了开始使用，选择 ${minutes} 分钟` } };
  logFeed(ME, `开始使用洗衣机，预计 ${S.laundry.endsAt} 结束`);
}

/* 统一的请求创建口：谁发起、要谁回应、什么时候过期，一次写清楚。
   need 不包含发起人——发起人不能代替别人同意。 */
function newRequest(kind, to, subject, detail, extra) {
  const need = to === 'all'
    ? living().map(m => m.id).filter(x => x !== ME)
    : [to].filter(x => membership(x) === 'active' && x !== ME);
  const r = { id:'rq' + Date.now() + Math.floor(Math.random() * 100), kind, from:ME, to, subject, detail,
              need, responses:{}, status:'open', at:stamp(), atDn:dnNow(),
              expiresDn: dnNow() + (extra && extra.days != null ? extra.days : 3), ...(extra || {}) };
  S.requests.push(r);
  need.forEach(x => sendMessage({ kind:'notify', to:[x], title:`${mem(ME).name}：${subject}`,
    body:`${detail} —— 需要你回应一下。`, meta:{ req:r.id } }));
  /* 没有人需要回应（比如只剩自己在住）就直接执行，不留一条永远等不到结果的请求 */
  if (!need.length) applyRequest(r);
  return r;
}

/* 请求通过之后真正产生效果。所有"同意了会发生什么"都集中在这里，
   页面上写的影响预览和这里是同一套逻辑。 */
function applyRequest(r) {
  r.status = 'agreed'; r.agreedAt = stamp();
  const by = reqNeed(r).map(x => mem(x).name).join('、');

  if (r.kind === 'swap' && r.task) {
    const t = S.tasks.find(x => x.id === r.task);
    if (t) { t.who = r.need[0]; t.deferred = `由 ${mem(r.from).name} 换给 ${mem(t.who).name}，已同意`; }
  }
  if (r.kind === 'borrow') {
    logFeed(r.from, `借用了 ${mem(r.to).name} 的${r.thing ? (S.supplies.find(x => x.id === r.thing) || {}).name || '物品' : '物品'}`);
  }
  /* 额外留宿：批准之后例外才生效，这几晚也才正式登记，只记一次 */
  if (r.kind === 'stay' && r.effect && r.effect.exception) {
    const e = S.exceptions.find(x => x.id === r.effect.exception);
    if (e && e.status === 'pending') {
      e.status = 'approved'; e.approvedAt = stamp(); e.approvedDn = dnNow();
      e.approvedBy = reqNeed(r).slice();
      e.visitIds = [];
      for (let i = 0; i < e.nights; i++) {
        const v = { id:'v' + Date.now() + i, host:e.host, guest:e.guest, guestId:e.guestId,
          guestPhoto:(guestsOf(e.host).find(g => g.guestId === e.guestId) || {}).photo,
          dn: Math.min(e.toDn, dnNow() + i), time:'经室友同意的例外', overnight:true, nights:1,
          exId:e.id, src:{ via:'shared', at:stamp() } };
        S.visits.unshift(v); e.visitIds.push(v.id);
      }
      logFeed('sys', `${by} 都同意了 ${mem(e.host).name} 的临时例外：「${e.guest}」本周多留宿 ${e.nights} 晚（${fmtDn(e.fromDn)}—${fmtDn(e.toDn)}）`);
      sendMessage({ kind:'notify', to:[e.host], title:'临时例外已生效',
        body:`${by} 都同意了。「${e.guest}」这 ${e.nights} 晚已经正式登记，不会再被判成超出约定。例外在 ${fmtDn(e.toDn)} 到期，之后仍按「${(S.rules.find(x => x.prefKey === 'overnight') || {}).title || '原约定'}」执行。` });
    }
  }
  /* 分区调整：两块互换，记为共同设定 */
  if (r.kind === 'zone' && r.zone) {
    const sp = S.spaces.find(x => x.id === r.zone.sp);
    const a = sp && sp.zones.find(z => z.n === r.zone.from && z.o === r.from);
    const b = sp && sp.zones.find(z => z.n === r.zone.to && z.o === r.need[0]);
    if (a && b) { const t = a.o; a.o = b.o; b.o = t; sp.src = { via:'shared', at:TODAY };
      logFeed('sys', `${sp.name}：${mem(r.from).name} 和 ${mem(r.need[0]).name} 交换了分区（${r.zone.from} ↔ ${r.zone.to}）`); }
  }
  /* 新成员分区：全员确认之后才真的写进分区表 */
  if (r.kind === 'zones') {
    const pr = S.zoneProposal;
    pr.items.forEach(it => {
      const sp = S.spaces.find(x => x.id === it.sp);
      if (sp.zones.some(z => z.n === it.n)) return;
      const pub = sp.zones.findIndex(z => z.o === 'public');
      const zone = { n:it.n, o:pr.who, pending:true };
      if (pub >= 0) sp.zones.splice(pub, 0, zone); else sp.zones.push(zone);
      sp.src = { via:'shared', at:TODAY };
    });
    pr.confirmed = true; pr.confirmedBy = reqNeed(r).slice(); pr.confirmedAt = stamp();
    logFeed('sys', `${by} 都确认了为 ${mem(pr.who).name} 准备的公共空间分区`);
  }
  /* 分摊方案：全员确认之后才生成账单 */
  if (r.kind === 'split' && S.splitPlan && S.splitPlan.reqId === r.id) {
    applySplitPlan(S.splitPlan, reqNeed(r));
  }
  r.status = 'done'; r.doneAt = stamp();
  if (r.from !== ME) sendMessage({ kind:'notify', to:[r.from], title:`「${r.subject}」已通过`,
    body:`${by} 都同意了，已经生效。` });
  return r;
}

/* 分摊方案落成账单：方案里每个人的金额按分存，相加等于总额 */
function applySplitPlan(plan, confirmedBy) {
  const f = S.utilityForecast;
  const bill = { id:'b' + Date.now(), title:f.title, note: plan.method === 'days' ? '按登记在住天数' : '平均分摊',
    kind:'utility', amount:f.amount, payer:plan.payer, people:plan.people.slice(), method:plan.method,
    paid:{}, date:TODAY, src:{ via:'manual', by:plan.payer, at:stamp(), plan:plan.id } };
  if (plan.method === 'days') bill.weights = { ...plan.weights };
  S.bills.unshift(bill);
  plan.status = 'applied'; plan.appliedAt = stamp(); plan.billId = bill.id; plan.confirmedBy = confirmedBy || [];
  const names = (confirmedBy || []).map(x => mem(x).name).join('、');
  logFeed('sys', `${f.title}的分摊方案经 ${names || '相关成员'} 确认后生效：${plan.method === 'days' ? '按登记在住天数' : '平均分摊'}`);
}

/* 记下某个人对当前这版方案的态度：覆盖他之前的，补充意见跟着人走。
   需要的人都接受了才达成；返回是否就此达成。 */
function setStance(t, who, stance) {
  const prev = t.positions[who];
  t.positions[who] = { stance, note: prev ? prev.note || '' : '', version:t.version, at:stamp() };
  t.history.push({ type:'stance', who, stance, version:t.version, at:stamp() });
  if (!topicResolvable(t)) return false;
  resolveTopic(t);
  return true;
}

/* 达成一致：同一个议题只更新原约定，不会因为入口不同长出内容相近的第二条 */
function resolveTopic(t) {
  t.status = 'resolved'; t.resolvedAt = stamp();
  t.history.push({ type:'resolved', who:'sys', at:stamp(), version:t.version });
  const target = S.rules.find(x => x.id === (t.ruleId || t.revisit))
    || (t.prefKey && S.rules.find(x => x.prefKey === t.prefKey));
  if (target) {
    target.history = target.history || [];
    target.history.push({ desc:target.desc, until:TODAY });
    target.desc = t.proposal;
    target.since = TODAY;
    target.by = living().map(m => m.id);
    /* 约定文字变了，对应的偏好选项值也跟着更新；对不上的就不再拿来和个人偏好比对 */
    if (target.prefKey) { const pv = prefValFromText(target.prefKey, target.title + ' ' + t.proposal); if (pv) target.prefVal = pv; else delete target.prefVal; }
    logFeed('sys', `大家就「${t.title}」达成了新的约定：「${target.title}」更新到第 ${target.history.length + 1} 版`);
    return;
  }
  S.rules.push({ id:'r' + Date.now(), title:t.title.replace(/（.*?）/, ''), cat:TOPIC_CAT[t.prefKey] || '共识',
    desc:t.proposal, by:living().map(m => m.id), since:TODAY, prefKey:t.prefKey, history:[],
    prefVal: t.prefKey ? prefValFromText(t.prefKey, t.proposal) : undefined });
  logFeed('sys', `大家就「${t.title}」达成了新的约定`);
}

/* 已搬出的人账全部结清 → 成员关系结束；返回这次结束了谁 */
function checkSettled() {
  const ended = [];
  settlingMembers().forEach(m => {
    /* 只看和他自己有关的那几份：别人之间还没结的账不该把他卡住 */
    if (!memberOpenBills(m.id).length) { S.settling = S.settling.filter(x => x !== m.id); S.movedOut.push(m.id); ended.push(m.id);
      logFeed('sys', `${m.name} 的账务已全部结清，成员关系正式结束`); }
  });
  return ended;
}
/* 住所卡 / 首页的人数：在住 · 即将入住 · 待结清 分开说 */
function memberCountText() {
  const parts = [`${living().length} 位在住`];
  const inc = incomingMember(); if (inc) parts.push(`1 位即将入住`);
  const st = settlingMembers(); if (st.length) parts.push(`${st.length} 位已搬出待结清`);
  return parts.join(' · ');
}

/* 搬出清单的说明按当前这个人的实际情况生成 */
function defaultMoveout() {
  const me = mem(ME);
  const open = memberOpenBills(ME).length;
  const zones = []; S.spaces.forEach(sp => sp.zones.forEach(z => { if (z.o === ME) zones.push(`${sp.name} ${z.n}`); }));
  const things = S.supplies.filter(x => x.owner === ME).map(x => x.name);
  const tasks = S.tasks.filter(t => t.who === ME && !t.done).length;
  return { who:ME, items:[
    { id:'m1', t:'结清未完成账单', m: open ? `当前和你有关的待结算 ${open} 笔` : '当前没有待结算的账', done:false },
    { id:'m2', t:'带走私人物品',   m: [me.room, ...zones].join(' · ') + (things.length ? ` · 登记过：${things.join('、')}` : ''), done:false },
    { id:'m3', t:'公共资产权益结算', m:'共同购买的电水壶、晾衣架等按约定处理', done:false },
    { id:'m4', t:'清空并清洁分区', m: zones.length ? `${zones.length} 处分区交还前恢复原状` : '没有分区需要交还', done:false },
    { id:'m5', t:'归还钥匙与门禁卡', m:'交回租房中介的管家', done:false },
    { id:'m6', t:'退出值日轮换',   m: tasks ? `本周还有 ${tasks} 项任务会重新分配` : '本周没有分到任务', done:false }
  ] };
}

render();
