/* ============================================================
   主控：渲染 + 动作分发
   每个会改变状态的动作，都会同时写下"谁在什么时候做的"。
   ============================================================ */

['quiz', 'awk', 'myPrefs'].forEach(k => { if (!S[k]) S[k] = structuredClone(SEED[k]); });

const stamp = () => `今天 ${NOW}`;
const mySrc = () => ({ via:'member', by:ME, at:stamp() });

function render() {
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
  confirmZones:'spaces', redivide:'spaces', zoneSwap:'spaces', doneTask:'tasks', deferTask:'tasks', applyFair:'bills', keepEven:'bills',
  editBill:'bills', settle:'pay', unsettle:'pay', proposalEdit:'talk', holdTopic:'talk', reopenTopic:'talk' };
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
  case 'reset': S = structuredClone(SEED); S.seedVersion = SEED_VERSION; ME = S.me; ensureLinTopics(); render(); toast('演示数据已重置'); break;
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
    cancelRequests(r => r.from === who || r.to === who, `${mem(who).name} 已搬出，本次请求已取消`);
    S.away.forEach(a => { if (a.who === who) a.active = false; });
    if (S.laundry.user === who) S.laundry = { user:null, startedAt:null, minutes:0, endsAt:null, notifyMe:false, src:null };
    openTopics().forEach(t => { if (topicResolvable(t)) resolveTopic(t); });
    S.moveoutRecord = rec; S.moveout = null;
    const open = openBills().filter(b => b.payer === who || b.people.includes(who)).length;
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
    b.people = [...sheetEl().querySelectorAll('#eb-w button[aria-pressed="true"]')].map(x => x.dataset.m);
    b.kind = document.getElementById('eb-k').value;
    delete b.shares; b.method = 'even';
    b.src = { ...b.src, edited:stamp(), by:ME };
    logFeed(ME, `修改了费用「${b.title}」，金额改为 <b>${yuan(amount)}</b>`);
    checkSettled();
    closeSheet(); render();
    toast(`已更新：${perLabel(b)}，本月合计 ${yuan(monthTotal())}，净额已重算`);
    break;
  }
  case 'delBill': {
    const b = S.bills.find(x => x.id === id);
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
    a.from = document.getElementById('ea-f').value.trim();
    a.to = document.getElementById('ea-t').value.trim();
    a.days = Math.max(1, parseInt(document.getElementById('ea-d').value) || 1);
    a.src = mySrc();
    logFeed(ME, `修改了离家登记：${a.from} — ${a.to}`);
    closeSheet(); render();
    toast(`已更新，登记在住天数改为 ${30 - a.days} 天，值日与分摊建议同步重算`);
    break;
  }
  case 'delAway': {
    const a = S.away.find(x => x.id === id);
    S.away = S.away.filter(x => x.id !== id);
    S.tasks.forEach(t => { if (t.who === a.who && t.note && t.note.includes('离家')) delete t.note; });
    logFeed(a.who, '取消了离家计划');
    closeSheet(); render();
    toast('离家计划已取消，成员状态、值日和分摊建议都已恢复');
    break;
  }
  case 'editVisit': editVisitSheet(id); break;
  case 'doEditVisit': {
    const v = S.visits.find(x => x.id === sheetEl().dataset.vid);
    v.date = document.getElementById('ev-d').value.trim() || v.date;
    v.time = document.getElementById('ev-t').value.trim() || v.time;
    v.overnight = sheetEl().querySelector('#ev-o button[aria-pressed="true"]').dataset.v === '1';
    v.nights = v.overnight ? (v.nights || 1) : 0;
    v.src = mySrc();
    const o = overnightRule(), n = nightsOf(v.host, v.guestId);
    closeSheet(); render();
    toast(`已更新。${mem(v.host).name} 的「${v.guest}」本周登记 ${n} 晚，${n > o.limit ? '超过' : '仍在'}约定的 ${o.limit} 晚${n > o.limit ? '' : '之内'}`);
    break;
  }
  case 'delVisit': {
    const v = S.visits.find(x => x.id === id);
    S.visits = S.visits.filter(x => x.id !== id);
    logFeed(ME, `取消了 ${v.date} 的访客登记`);
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
      const ids = living().map(m => m.id);
      S.spaces.forEach(sp => {
        const owned = sp.zones.filter(z => z.o !== 'public' && !z.pending);
        const names = owned.map(z => z.o);
        owned.forEach((z, i) => { z.o = names[(i + 1) % names.length]; });
        sp.src = { via:'shared', at:TODAY };
      });
      logFeed('sys', '全员重新划分了公共空间，每人顺次挪了一格');
      closeSheet(); render(); toast('分区已更新，你的分区也跟着变了');
    } else {
      logFeed('sys', '讨论后决定维持现有的公共空间分法');
      closeSheet(); render(); toast('已记录：维持现在的分法');
    }
    break;
  }

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
        /* 换班要对方同意才生效，负责人在此之前不变 */
        newRequest('swap', c, `${t.task} 换班`, `原定由 ${mem(ME).name} 负责，想和你换一下`, { task:t.id });
        t.deferred = `已向 ${mem(c).name} 发起换班，等待回应`;
        logFeed('sys', `${mem(ME).name} 就「${t.task}」发起了换班请求`);
        closeSheet(); render(); toast(`已向 ${mem(c).name} 发起换班请求，对方同意后负责人才会变`);
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
  case 'reqAgree': case 'reqDecline': case 'reqDiscuss': {
    const r = S.requests.find(x => x.id === id);
    r.status = act === 'reqAgree' ? 'agreed' : act === 'reqDecline' ? 'declined' : 'discuss';
    r.by = ME; r.resolvedAt = stamp();
    if (r.status === 'agreed') {
      if (r.kind === 'swap' && r.task) {
        const t = S.tasks.find(x => x.id === r.task);
        if (t) { t.who = ME; t.deferred = `由 ${mem(r.from).name} 换给 ${mem(ME).name}，已同意`; }
      }
      if (r.kind === 'stay') S.visits.unshift({ id:'v' + Date.now(), host:r.from, guest:r.guest || '朋友', guestId:r.guestId || guestKey(r.from, r.guest),
        date:'今天', time:'经室友同意', overnight:true, nights:1, week:true,
        src:{ via:'member', by:r.from, at:stamp() } });
      /* 分区调整：对方同意后两块分区互换，分区记录标为共同设定 */
      if (r.kind === 'zone' && r.zone) {
        const sp = S.spaces.find(x => x.id === r.zone.sp);
        const a = sp && sp.zones.find(z => z.n === r.zone.from && z.o === r.from), b = sp && sp.zones.find(z => z.n === r.zone.to && z.o === ME);
        if (a && b) { a.o = ME; b.o = r.from; sp.src = { via:'shared', at:TODAY }; logFeed('sys', `${sp.name}：${mem(r.from).name} 和 ${mem(ME).name} 交换了分区（${r.zone.from} ↔ ${r.zone.to}）`); }
      }
    }
    if (r.status === 'discuss') {
      S.topics.push(newTopic({ title:REQ_LABEL[r.kind] + '：' + r.subject, proposal:r.detail, by:ME, at:stamp(),
        openText:`${mem(ME).name} 觉得这件事值得大家一起聊聊` }));
      logFeed('sys', `「${r.subject}」已提到家里一起讨论`);
    }
    logFeed(ME, `回应了 ${mem(r.from).name} 的${REQ_LABEL[r.kind]}请求：${REQ_STATUS[r.status]}`);
    render();
    toast(r.status === 'agreed' ? '已同意，发起人会看到结果'
        : r.status === 'declined' ? '已回复"这次不太方便"，不会显示为拒绝'
        : '已转为一起讨论');
    break;
  }
  case 'reqWithdraw': {
    S.requests = S.requests.filter(x => x.id !== id);
    render(); toast('已撤回请求');
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
    logFeed(ME, `确认了为 ${mem(pr.who).name} 准备的公共空间分区`);
    render(); toast(`已为 ${mem(pr.who).name} 分配 4 处分区，${mem(pr.who).joined}起生效`);
    break;
  }
  /* ---- 访客：每次登记都是一条记录，次数由记录累计 ---- */
  case 'newVisit': visitSheet(false); break;
  case 'doVisit': {
    const on = sheetEl().querySelector('#vo button[aria-pressed="true"]').dataset.v === '1';
    const host = document.getElementById('vh').value;
    const guest = document.getElementById('vg').value.trim() || '朋友';
    const guestId = guestKey(host, guest);
    const date = document.getElementById('vd').value;
    const time = document.getElementById('vw').value.trim() || '未填时间';
    const nights = on ? Math.max(1, parseInt(document.getElementById('vn').value) || 1) : 0;
    /* 次数只算这一位访客：同一个称呼就是同一个人 */
    const had = nightsOf(host, guestId);
    const known = guestsOf(host).find(g => g.guestId === guestId);
    S.visits.unshift({ id:'v' + Date.now(), host, guest, guestId, guestPhoto: known && known.photo, date, time, overnight:on,
      nights: on ? nights : 0, week:true, src:mySrc() });
    const o = overnightRule();
    const over = on && had + nights > o.limit;
    if (over) newRequest('stay', 'all', `${guest}本周再留宿 ${nights} 晚`,
      `按登记记录这位访客本周会是第 ${had + nights} 晚，超过约定的每周 ${o.limit} 晚`, { guest, guestId });
    logFeed(ME, `登记了访客：${date} ${time}${on ? ` · 留宿 ${nights} 晚` : ''}`);
    closeSheet(); render();
    toast(over ? `「${guest}」本周登记共 ${had + nights} 晚，超过约定的 ${o.limit} 晚，已向室友发出征询`
        : on ? `已登记，「${guest}」本周共 ${had + nights} 晚，仍在约定之内`
        : '已登记，室友会看到这次到访');
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
    toast('报修单已提交，租房中介受理后状态会自动同步回来');
    setTimeout(() => {
      const r = S.repairs.find(x => x.id === rid);
      if (r && r.timeline.length === 1) {
        r.timeline.push({ s:'管家已受理', at:stamp(), via:'platform' });
        logFeed('sys', `租房中介已受理报修：${r.desc}`);
        render(); toast(`${HOUSE.steward}已受理，稍后会安排上门时间`);
      }
    }, 2800);
    break;
  }

  /* ---- 账单 ---- */
  case 'settle': {
    const b = S.bills.find(x => x.id === id); b.settled = true;
    logFeed(ME, `将「${b.title}」标记为已结清`);
    const ended = checkSettled();
    render(); toast(ended.length ? `「${b.title}」已结清。${ended.map(x => mem(x).name).join('、')} 的账已全部结清，成员关系正式结束。` : `「${b.title}」已结清`);
    break;
  }
  case 'unsettle': S.bills.find(x => x.id === id).settled = false; render(); break;
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
    const bill = { id:'b' + Date.now(), title, note:'', amount, payer, people, method, kind, settled:false,
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
    const bill = { id:'b' + Date.now(), title:S.utilityForecast.title, note:'按登记在住天数', kind:'utility',
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
    S.bills.unshift({ id:'b' + Date.now(), title:S.utilityForecast.title, note:'维持平均分摊', kind:'utility',
      amount:S.utilityForecast.amount, payer:ME, people:living().map(m => m.id), method:'even',
      settled:false, date:TODAY, src:{ via:'manual', by:ME, at:stamp() } });
    logFeed('sys', `${S.utilityForecast.title}维持平均分摊`);
    render(); toast('已维持平均分摊。分摊方式由你们决定，系统不会替你们更改。');
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
  case 'awkBack': S.awk.step = Math.max(0, S.awk.step - 1); awkwardSheet(); break;
  case 'awkSubmit': {
    const a = S.awk;
    const existing = ruleFor(a.focus);
    const gap = gapFor(a.focus);
    if (a.way === 'private') {
      closeSheet(); render(); toast('已私下发送。家里动态中不会留下记录。');
    } else if (a.way === 'watch') {
      /* 没超出约定就不制造矛盾，只在自己这里留个观察记录 */
      S.issues.unshift({ id:'i' + Date.now(), cat:a.readCat || a.cat, rule:existing && existing.id,
        title:a.focus, level:0, count:0, window:'最近 7 天',
        note:'目前的登记情况还在约定之内，先继续观察，没有发出任何提醒。',
        src:{ via:'member', by:ME, at:stamp() }, follow:'self' });
      closeSheet(); goTo('talk', 'issue');
      toast('已记在你自己这里。没有超出约定，所以不会打扰任何人。');
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
      S.topics.push(newTopic({ title:'重新确认：' + existing.title, revisit:existing.id, at:stamp(),
        proposal:`${existing.desc}${gap ? ' 当前情况：' + gap.text : ''}`,
        openText:'有人觉得这条约定需要重新明确一次（不显示是谁提出的）' }));
      logFeed('sys', `「${existing.title}」进入重新确认`);
      closeSheet(); goTo('talk');
      toast('已发起重新确认，不会新增约定，只修改现有这一条');
    } else {
      S.topics.push(newTopic({ title:a.focus, at:stamp(),
        proposal: AWK_SUGGEST[a.focus] || `关于${a.focus}的约定，等待大家一起确认。`,
        openText:'有人把这件事提到家里一起聊（不显示是谁提出的）' }));
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
  case 'doClarify': {
    const picked = [...sheetEl().querySelectorAll('.opt[aria-pressed="true"]')].map(b => b.textContent.trim());
    const it = S.issues.find(x => x.id === sheetEl().dataset.iid);
    const rule = S.rules.find(r => r.id === it.rule);
    if (picked.length) rule.desc = picked.join('、') + '。';
    it.level = 1; it.count = 0; it.follow = 'discuss';
    it.note = '标准已重新明确，正在等待全员确认。';
    S.topics.push(newTopic({ title:'重新确认：' + rule.title, revisit:rule.id, at:stamp(),
      proposal:rule.desc, openText:'标准被重新明确了一次，等待大家确认' }));
    logFeed('sys', `「${rule.title}」的标准被重新明确，等待全员确认`);
    closeSheet(); goTo('talk'); toast('已发起重新确认，问题记录回到第 1 级');
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
    applyPurchase(s, p.qty, p.amount, p.people, s.mode === 'state' ? '充足' : null, 'butler');
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
      amount, payer:ME, people:ppl, method:'even', kind:'supply', settled:false, date:TODAY,
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

/* 统一的请求创建口，保证每个请求都有发起人、接收人、时间和状态 */
function newRequest(kind, to, subject, detail, extra) {
  const r = { id:'rq' + Date.now(), kind, from:ME, to, subject, detail,
              status:'pending', at:stamp(), ...(extra || {}) };
  S.requests.push(r);
  return r;
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
    const open = openBills().some(b => b.payer === m.id || b.people.includes(m.id));
    if (!open) { S.settling = S.settling.filter(x => x !== m.id); S.movedOut.push(m.id); ended.push(m.id);
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
  const open = openBills().filter(b => b.payer === ME || b.people.includes(ME)).length;
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
