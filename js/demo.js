/* ============================================================
   演示层：模拟时间推进 + 情境化体验
   这里只做两件事：
     1. 让时间往前走，看得到"到期、跨周、月末"这些随时间发生的变化；
     2. 提供四条典型情境，让第一次打开的人不用自己摸索也能看懂产品。
   情境各自带一份预置数据，彼此不串场；随时可以重置或回到自由探索。
   ============================================================ */

/* ---------- 模拟时间 ----------
   推进时间不会删除任何历史记录：已经发生的留宿、账单、完成记录都留在原地，
   变化的只有"现在是哪一天"以及由它推导出来的状态。 */
function advanceTo(targetDn, label) {
  const from = S.clock.day;
  if (targetDn <= from) { toast('演示时间只能往前走'); return; }
  const notes = [];

  for (let d = from + 1; d <= targetDn; d++) {
    S.clock.day = d;
    syncClock();
    notes.push(...rollDay(d));
  }
  /* 到了新的一天，时间回到早上 */
  S.clock.hm = '09:00';
  syncClock();
  const swept = sweepAll();

  logFeed('sys', `演示时间推进到 ${fmtDn(targetDn)} ${wdOfDn(targetDn)}`);
  render();
  const extra = notes.length ? '：' + notes.slice(0, 3).join('；') : '';
  toast(`演示时间已到 ${fmtDn(targetDn)} ${wdOfDn(targetDn)}${extra}`);
}

/* 过一天会发生什么：这些都是"时间到了自然会变"的事，不需要谁去点 */
function rollDay(d) {
  const out = [];

  /* 洗衣机：到点了就提醒登记过的人，提醒是真的会送达的 */
  const L = S.laundry;
  if (L.user) {
    if (L.notifyMe && L.notifyFor) sendMessage({ kind:'notify', from:'sys', to:[L.notifyFor],
      title:'洗衣机应该已经结束了', body:`${mem(L.user).name} 登记的 ${L.minutes} 分钟已经到了。（演示：模拟站内提醒）` });
    sendMessage({ kind:'notify', from:'sys', to:[L.user], title:'记得把衣服取出来',
      body:'洗衣机已经到点，其他人可能在等着用。（演示：模拟站内提醒）' });
    S.laundry = { user:null, startedAt:null, minutes:0, endsAt:null, notifyMe:false, notifyFor:null, src:null };
    out.push('洗衣机已结束并释放');
  }

  /* 离家：到期自动结束 */
  S.away.forEach(a => { if (!a.cancelled && a.toDn === d - 1) out.push(`${mem(a.who).name} 的离家登记结束`); });

  /* 临时例外：过期自动失效，长期约定一个字都不动 */
  S.exceptions.forEach(e => {
    if (e.status !== 'approved') return;
    if (e.toDn < d || weekOf(e.fromDn) !== weekOf(d)) {
      e.status = 'expired'; e.expiredDn = d;
      sendMessage({ kind:'notify', from:'sys', to:[e.host], title:'临时例外已到期',
        body:`「${e.guest}」的这次例外已经到期，之后仍按「${(S.rules.find(x => x.prefKey === 'overnight') || {}).title || '原约定'}」执行。已经登记过的那几晚会留在记录里。` });
      out.push(`${mem(e.host).name} 的临时例外到期失效`);
    }
  });

  /* 请求：过了截止日自动失效，不会永远挂着 */
  S.requests.forEach(r => {
    if (!reqOpen(r) || r.expiresDn == null || r.expiresDn >= d) return;
    r.status = 'expired'; r.resolvedAt = `${fmtDn(d)} 09:00`;
    if (r.effect && r.effect.exception) { const e = S.exceptions.find(x => x.id === r.effect.exception); if (e && e.status === 'pending') e.status = 'expired'; }
    sendMessage({ kind:'notify', from:'sys', to:[r.from], title:`「${r.subject}」已过期`,
      body:'到截止时间还没有收齐回应，这次申请自动失效。需要的话可以重新发起，或者放到家里一起讨论。' });
    out.push(`「${r.subject}」因超时自动失效`);
  });

  /* 值日：当天没完成的顺延一天，固定任务按周期生成下一次 */
  S.tasks.forEach(t => {
    if (t.done || t.dueKind === 'week') return;
    if (t.dueDn < d) { t.dueDn = d; t.deferred = '上一期没完成，已顺延到今天'; }
  });
  rollChores(d).forEach(x => out.push(x));

  /* 跨周：访客留宿计数自然回到 0（历史登记不删，只是不再属于本周） */
  if (weekOf(d) !== weekOf(d - 1)) out.push('进入新的一周，访客留宿次数重新开始计算');

  /* 试行期到了：回到讨论，而不是悄悄变成永久约定 */
  S.topics.forEach(t => { if (t.status === 'trial' && t.trialUntilDn != null && t.trialUntilDn < d)
    out.push(`「${t.title}」的试行期结束，回到讨论`); });

  return out;
}

/* 固定任务到了周期就生成下一期，负责人在"在住且没登记离家"的人里轮换 */
function rollChores(d) {
  const out = [];
  const every = { '每 2 天':2, '每周':7, '每两周':14 };
  const avail = living().filter(m => !S.away.some(a => a.who === m.id && !a.cancelled && a.fromDn <= d && a.toDn >= d));
  if (!avail.length) return out;
  S.choreTemplates.forEach(tpl => {
    const n = every[tpl.every] || 7;
    const last = S.tasks.filter(t => t.tpl === tpl.id).sort((a, b) => b.dueDn - a.dueDn)[0];
    if (!last || last.dueDn + n > d) return;
    /* 轮到待完成任务最少的人，离家的人自动跳过 */
    const who = avail.map(m => ({ id:m.id, load: S.tasks.filter(x => x.who === m.id && !x.done).length }))
      .sort((a, b) => a.load - b.load)[0].id;
    S.tasks.push({ id:'t' + d + tpl.id, tpl:tpl.id, task:tpl.task, who, dueDn:d, done:false });
    out.push(`新一期「${tpl.task}」安排给 ${mem(who).name}`);
  });
  return out;
}

/* ============================================================
   情境化体验
   每个情境 = 一份预置数据 + 几步引导。进入时整份状态被替换，
   退出时回到自由探索那一份，两边互不污染。
   ============================================================ */
const SCENARIOS = {
  A: {
    key:'A', name:'新室友加入', icon:'talk',
    sub:'偏好比较 → 识别差异 → 共同讨论 → 修改方案 → 全员确认 → 规则更新',
    desc:'Lin 下周入住。系统已经把她填的偏好和家里现在的做法逐项比对过，只有真正不一致的才需要聊。',
    steps:[
      { as:'yiming', tab:'talk', t:'看系统比对的结果', h:'一致的收起来，不一致的已经直接变成「正在讨论」的议题。先看一眼有哪几项。' },
      { as:'yiming', tab:'talk', t:'对当前方案表态', h:'选同意 / 不同意 / 再想想都行，随时能改。不同意时顺手写一句你更希望怎么安排。' },
      { as:'alex',   tab:'talk', t:'换成 Alex，修改方案', h:'进讨论详情点「调整方案」。方案一改就是新的一版，之前所有人的表态都要重新确认——包括改方案的人自己。' },
      { as:'yiming', tab:'talk', t:'重新确认新版方案', h:'注意看：你上一版的表态变成了「方案已调整，待重新确认」。' },
      { as:'tom',    tab:'talk', t:'最后一个人确认', h:'需要的人全部接受，方案才会写进「我们已经说好的」，并生成新一版约定。' },
      { as:'yiming', tab:'life', sub:'space', t:'确认 Lin 的分区', h:'新成员的公共空间分区也是共同设定：要在住成员都同意才会写进分区表。' }
    ],
    setup(st) { st.clock = { day:0, hm:'10:00' }; st.requests = []; st.exceptions = []; st.messages = []; }
  },
  B: {
    key:'B', name:'访客临时例外', icon:'guest',
    sub:'触及上限 → 发起例外申请 → 室友分别回应 → 例外生效 → 到期恢复',
    desc:'约定是同一访客每周最多留宿 2 晚。Alex 的女朋友这周已经住满 2 晚，这周还想再住一晚——不改长期约定，只申请这一次。',
    steps:[
      { as:'alex', tab:'life', sub:'guest', t:'登记第 3 晚', h:'点「登记访客」，选女朋友、勾留宿。到了上限，系统不会直接记上，而是带你去申请一次临时例外。' },
      { as:'alex', tab:'life', sub:'guest', t:'填写例外申请', h:'写清楚是哪位访客、几晚、到什么时候。申请期间这几晚不会计入留宿记录。' },
      { as:'yiming', tab:'home', t:'换成 Yiming 回应', h:'每个人分别回应，Alex 不能替别人同意。你同意之后请求还在等 Tom。' },
      { as:'tom', tab:'home', t:'换成 Tom 回应', h:'最后一个人同意，例外才生效：这一晚正式登记，而且不会再被判成超出约定。' },
      { as:'alex', tab:'life', sub:'guest', t:'看看记了几晚', h:'重点：这一晚只记一次。页面上能分清正常登记、待批准申请、已批准例外。' },
      { as:'alex', tab:'life', sub:'guest', t:'推进到下周', h:'用右下角的演示时间推进到下一周：例外自动失效，上限回到约定的 2 晚，历史登记不会被删。' }
    ],
    setup(st) {
      st.clock = { day:0, hm:'18:30' };
      st.me = 'alex';
      st.requests = []; st.exceptions = []; st.messages = [];
      /* 刚好住满上限：9月11日、9月12日各一晚 */
      st.visits = [
        { id:'v2', host:'alex', guest:'女朋友', guestId:'alex:女朋友', guestPhoto:'img/guest-1.jpg', dn:dn('9月11日'), time:'20:30 起', overnight:true, nights:1,
          src:{ via:'member', by:'alex', at:'9月11日 20:05' } },
        { id:'v1', host:'alex', guest:'女朋友', guestId:'alex:女朋友', guestPhoto:'img/guest-1.jpg', dn:dn('9月10日'), time:'21:00 起', overnight:true, nights:1,
          src:{ via:'member', by:'alex', at:'9月10日 20:40' } }
      ];
    }
  },
  C: {
    key:'C', name:'离家与账单公平', icon:'scale',
    sub:'登记离家 → 值日受影响 → 分摊方案 → 成员确认 → 更新账单 → 月末结算',
    desc:'Tom 登记了 10 天离家。水电要不要按在住天数分，是三个人一起决定的事，不是谁点一下就算数。',
    steps:[
      { as:'tom', tab:'life', sub:'away', t:'看这份登记影响了什么', h:'值日暂缓、采购不派给他、水电可按在住天数——全部由这一条登记推导出来。' },
      { as:'yiming', tab:'bill', t:'提出一个分摊方案', h:'换成 Yiming。注意按钮写的是「提出这个方案」，不是「采用」——一个人不能替别人决定怎么分。' },
      { as:'alex', tab:'bill', t:'Alex 确认', h:'每个相关成员分别确认。还没收齐的时候，账单不会生成。' },
      { as:'tom', tab:'bill', t:'Tom 确认后生成账单', h:'全部确认，账单才出现，每个人的金额按分计算，相加正好等于总额。' },
      { as:'tom', tab:'bill', t:'结清自己那一份', h:'点「我已付这一份」，再切回垫付人确认收到。一个人点一下只代表他自己那一份。' },
      { as:'yiming', tab:'bill', t:'推进到月末看净额', h:'用演示时间跳到月末，看看抵消之后真正需要转的钱。' }
    ],
    setup(st) { st.clock = { day:0, hm:'09:30' }; st.me = 'tom'; st.requests = []; st.exceptions = []; st.messages = []; st.splitPlan = null; }
  },
  D: {
    key:'D', name:'室友搬出', icon:'truck',
    sub:'搬出准备 → 机构确认（模拟）→ 任务与分区交接 → 历史账务结清 → 成员关系结束',
    desc:'有人离开，这个家不会被删除。约定、公共资产和其他人的分区都留下来，只有他的那部分需要交接。',
    steps:[
      { as:'tom', tab:'me', sub:'moveout', t:'走一遍搬出清单', h:'清单只是准备。做完也不等于已经退租——租赁关系由机构确认。' },
      { as:'tom', tab:'me', sub:'moveout', t:'模拟机构确认退租', h:'确认之后他进入「已搬出 · 待结清」：不再参与新事务，分区空出，未完成任务转给负担最少的人。' },
      { as:'yiming', tab:'life', sub:'space', t:'看交接结果', h:'换成 Yiming：Tom 的分区已经空出来等下一位，其他人的分区一点没动。' },
      { as:'tom', tab:'bill', t:'结清历史账务', h:'搬出之后只剩账。把该付的付掉、该收的收回来。' },
      { as:'yiming', tab:'bill', t:'垫付人确认收款', h:'每一份都确认之后，Tom 的账才算全部结清。' },
      { as:'tom', tab:'me', t:'成员关系正式结束', h:'账两清，成员关系才结束。房子还在，历史记录也都还在。' }
    ],
    setup(st) {
      st.clock = { day:0, hm:'14:00' }; st.me = 'tom';
      st.requests = []; st.exceptions = []; st.messages = [];
      /* 搬出场景里不再掺入离家登记，避免两种"不在家"同时出现 */
      st.away = [];
    }
  }
};
const SCENARIO_LIST = ['A', 'B', 'C', 'D'];

/* 进入情境：先把自由探索那一份收起来，再换上情境的预置数据 */
function enterScenario(key) {
  const sc = SCENARIOS[key];
  if (!sc) return;
  const free = S.scenario ? S.freeSnapshot : JSON.stringify(S);
  const st = structuredClone(SEED);
  st.seedVersion = SEED_VERSION;
  sc.setup(st);
  st.freeSnapshot = free;
  st.scenario = { key, step:0 };
  st.demoPanel = false;
  S = st;
  ME = S.me || 'yiming';
  syncClock();
  ensureLinTopics();
  const s0 = sc.steps[0];
  if (s0) { ME = s0.as || ME; S.me = ME; S.tab = s0.tab || 'home'; S.sub = s0.sub || null; }
  render();
  toast(`已进入情境「${sc.name}」。底部的引导条会一步步告诉你做什么，随时可以重置或退出。`);
}

/* 退出情境：回到进来之前的自由探索状态 */
function exitScenario() {
  const free = S.freeSnapshot;
  if (free) { try { S = JSON.parse(free); } catch (e) { S = structuredClone(SEED); } }
  else S = structuredClone(SEED);
  S.seedVersion = SEED_VERSION;
  S.scenario = null; S.freeSnapshot = null;
  ME = S.me || 'yiming';
  syncClock(); ensureLinTopics();
  render();
  toast('已回到自由探索。刚才在情境里做的操作不会带出来。');
}

/* 情境引导条：当前第几步、要做什么、下一步去哪 */
function scenarioBar() {
  if (!S.scenario) return '';
  const sc = SCENARIOS[S.scenario.key];
  if (!sc) return '';
  const i = Math.min(S.scenario.step, sc.steps.length - 1);
  const st = sc.steps[i];
  return `<div class="scbar">
    <div class="sc-h"><span class="sc-tag">情境 ${sc.key}</span><b>${sc.name}</b>
      <span class="sc-prog">第 ${i + 1} / ${sc.steps.length} 步</span>
      <button class="sc-x" data-act="scExit" aria-label="退出情境">退出</button></div>
    <div class="sc-b">
      <div class="sc-step"><b>${st.t}</b><span>${st.h}</span></div>
      <div class="sc-who">${st.as ? `<span>这一步用 ${mem(st.as).name} 的身份</span>${st.as === ME ? '<em>当前就是</em>' : `<button class="btn sm pri" data-act="scAs" data-k="${st.as}">切到 ${mem(st.as).name}</button>`}` : ''}</div>
    </div>
    <div class="sc-f">
      <button class="btn sm" data-act="scPrev" ${i === 0 ? 'disabled' : ''}>上一步</button>
      <button class="btn sm pri" data-act="scNext" ${i === sc.steps.length - 1 ? 'disabled' : ''}>下一步</button>
      <button class="btn sm" data-act="scReset">重新开始</button>
      <button class="btn sm sc-dock" data-act="dock">${svg(I.spark)}演示控制台 · ${fmtDn(dnNow())}</button>
    </div>
  </div>`;
}

/* 演示控制台：时间推进 + 情境入口，放在页面右下角，不占首页版面 */
function demoDock() {
  const open = S.dock;
  const d = dnNow();
  return `<div class="dock ${open ? 'open' : ''}">
    ${open ? `<div class="dk-panel">
      <div class="dk-h"><b>演示控制台</b><button class="dk-x" data-act="dock" aria-label="收起">×</button></div>

      <div class="dk-sec">
        <div class="dk-l">演示时间</div>
        <div class="dk-now">${fmtDn(d)} ${wdOfDn(d)} · ${nowHM()}</div>
        <div class="dk-btns">
          <button class="btn sm" data-act="timeAdv" data-k="1">推进一天</button>
          <button class="btn sm" data-act="timeAdv" data-k="week">下一周</button>
          <button class="btn sm" data-act="timeAdv" data-k="month">月末</button>
          <button class="btn sm" data-act="timeReset">回到起点</button>
        </div>
        <p class="dk-p">推进时间只会让"到期、跨周、月末"这些事自然发生，已经完成的记录不会被删掉。</p>
      </div>

      <div class="dk-sec">
        <div class="dk-l">典型情境</div>
        <div class="dk-sc">${SCENARIO_LIST.map(k => { const sc = SCENARIOS[k];
          return `<button class="dk-scb ${S.scenario && S.scenario.key === k ? 'on' : ''}" data-act="scEnter" data-k="${k}">
            <span class="dk-sck">${k}</span><span><b>${sc.name}</b><em>${sc.sub}</em></span></button>`; }).join('')}</div>
        ${S.scenario ? `<button class="btn sm" data-act="scExit">退出情境，回到自由探索</button>`
          : `<p class="dk-p">四条情境各有一份独立的预置数据，互不影响；随时可以退出回到自由探索。</p>`}
      </div>
    </div>` : ''}
    ${S.scenario ? '' : `<button class="dk-fab" data-act="dock" aria-label="演示控制台">${svg(I.spark)}<span>${fmtDn(d)}</span></button>`}
  </div>`;
}
