/* ============================================================
   视图层
   每个动态状态旁边都标出它的来源，用户随时能知道系统为什么知道这件事。
   ============================================================ */

const TABS = [
  { id:'home', label:'首页', icon:I.home },
  { id:'life', label:'生活', icon:I.life },
  { id:'bill', label:'账单', icon:I.bill },
  { id:'talk', label:'共识', icon:I.talk },
  { id:'me',   label:'我的', icon:I.me   }
];

const backBtn = (label, tab) =>
  `<button class="back" data-act="go" data-tab="${tab}">${svg(I.back)}${label}</button>`;
const head = (h1, p) => `<div class="phead"><h1>${h1}</h1>${p ? `<p>${p}</p>` : ''}</div>`;
const sec  = (t, sub, extra) =>
  `<div class="sechead"><h2>${t}</h2>${extra || (sub ? `<span class="sub">${sub}</span>` : '')}</div>`;
/* 请求卡片：发起人、接收人、时间、状态、结果一应俱全 */
function reqCard(r, mine) {
  const done = r.status !== 'pending';
  return `<div class="card pad ${done ? 'dim' : ''}">
    <div style="display:flex;gap:10px;align-items:flex-start">${av(r.from, 'lg')}
      <div style="flex:1">
        <b style="font-family:var(--f-d);font-size:15px">${mem(r.from).name}：${r.subject}</b>
        <div style="font-size:12.5px;color:var(--ink-3);margin-top:2px">${r.detail}</div>
        <div class="srctag">${svg(I.info)}${REQ_LABEL[r.kind]}请求 · 发给${r.to === 'all' ? '全体室友' : mem(r.to).name} · ${r.at}</div>
      </div>
      <span class="pill ${done ? (r.status === 'agreed' ? 'ok' : 'plain') : 'warn'}">${REQ_STATUS[r.status]}</span></div>
    ${done ? `<div class="srctag">${svg(I.check)}${r.status === 'cancelled' ? (r.note || '本次请求已取消') + (r.resolvedAt ? ` · ${r.resolvedAt}` : '') : `${mem(r.by).name} 于 ${r.resolvedAt} 回应`}</div>`
      : mine ? `<div class="btnrow" style="margin-top:10px">
          <button class="btn sm" data-act="reqWithdraw" data-id="${r.id}">撤回请求</button></div>`
      : `<div class="btnrow" style="margin-top:10px">
          <button class="btn pri sm" data-act="reqAgree" data-id="${r.id}">可以</button>
          <button class="btn sm" data-act="reqDecline" data-id="${r.id}">这次不太方便</button>
          <button class="btn sm" data-act="reqDiscuss" data-id="${r.id}">想讨论一下</button></div>`}
  </div>`;
}

/* 来源标签：这条信息是谁、什么时候、怎么产生的 */
const srcTag = (s, cls) => s ? `<span class="srctag ${cls || ''}">${svg(I.info)}${srcNote(s)}</span>` : '';

/* ============================================================
   首页
   ============================================================ */
/* 图片位：有图时补 .ok 收起占位说明，缺图时 <img> 自行移除、露出说明，尺寸由 CSS 固定 */
const imgSlot = (src, label) =>
  `<figure class="ph"><img src="${src}" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()"><figcaption>${label}</figcaption></figure>`;

function vHome() {
  if (!can('feed')) return vHomeLimited();
  /* ---- "家里怎么样"是 House 层面的：库存、还没达成的讨论；"今日待办"只放需要我做的 ---- */
  const watch = [];
  if (lowSupplies().length) watch.push('公共物品库存');
  const houseTalk = openTopics();
  if (houseTalk.length) watch.push(`${houseTalk.length} 项讨论进行中`);
  const calm = watch.length === 0;
  const awayN = awayMembers().length;
  const me = mem(ME);
  const mineTalk = myPendingTopics();

  /* ---- 今日待办 ---- */
  const todos = [];
  const t = S.tasks.find(x => x.who === ME && x.due === '今天' && !x.done);
  if (t) todos.push(`<div class="tcard a"><span class="tic">${svg(I.chore)}</span>
      <div><div class="tt">${t.task}</div><div class="ts">按固定任务安排，今天轮到你</div></div>
      <div class="tb"><button class="btn pri sm" data-act="doneTask" data-id="${t.id}">${svg(I.check)}完成</button>
        <button class="btn sm" data-act="deferTask" data-id="${t.id}">今天做不了</button></div></div>`);

  if (myDue().length) todos.push(`<div class="tcard b"><span class="tic">${svg(I.bill)}</span>
      <div><div class="tt">待支付 ${yuan(myDueTotal())}</div>
      <div class="ts">${myDue().map(b => b.title).join(' · ')}</div></div>
      <div class="tb"><button class="btn pri sm" data-act="go" data-tab="bill">去结算</button></div></div>`);

  const inbox = inboxRequests();
  if (inbox.length) todos.push(`<div class="tcard d"><span class="tic">${svg(I.guest)}</span>
      <div><div class="tt">${mem(inbox[0].from).name}：${inbox[0].subject}</div>
      <div class="ts">${inbox[0].detail}</div></div>
      <div class="tb"><button class="btn pri sm" data-act="reqAgree" data-id="${inbox[0].id}">可以</button>
        <button class="btn sm" data-act="reqDecline" data-id="${inbox[0].id}">不太方便</button></div></div>`);

  /* 只有等我表态 / 重新确认的讨论才是我的待办；家里还有议题没达成 ≠ 我要做事 */
  if (mineTalk.length) todos.push(`<div class="tcard c"><span class="tic">${svg(I.talk)}</span>
      <div><div class="tt">有 ${mineTalk.length} 项讨论等你表态</div>
      <div class="ts">${mineTalk.map(t => t.title).join(' · ')}</div></div>
      <div class="tb"><button class="btn pri sm" data-act="go" data-tab="talk">去表态</button></div></div>`);

  const low = lowSupplies()[0];
  if (low && todos.length < 4) todos.push(`<div class="tcard c"><span class="tic">${svg(I.box)}</span>
      <div><div class="tt">${low.name}${low.mode === 'count' ? `只剩 ${low.qty} ${low.unit}` : low.state}</div>
      <div class="ts">${srcNote(low.src)} 更新</div></div>
      <div class="tb"><button class="btn pri sm" data-act="restock" data-id="${low.id}">去补充</button></div></div>`);

  /* ---- 成员一行：点开是成员小卡，只放家里本来就公开的信息 ---- */
  const people = household().map(m => {
    const st = statusOf(m.id), a = awayOf(m.id);
    const tail = st === 'away' ? `${a.to} 回` : st === 'incoming' ? `${m.joined} 入住` : STATUS_TEXT[st];
    return `<div class="person ${m.id === ME ? 'me' : ''}" data-act="member" data-id="${m.id}" role="button" tabindex="0">
      ${av(m.id, 'xxl' + (st === 'in' ? '' : ' out'))}
      <div class="pn">${m.name}${m.id === ME ? '·你' : ''}</div>
      <div class="pr">${m.room}</div>
      <div class="pst"><i class="sdot ${st}"></i>${tail}</div></div>`;
  }).join('');

  return `
  <section class="welcome">
    <div class="wl-text">
      <h1>${greet()}，${me.name}</h1>
      <p>${greetSub()}</p>
      <div class="wl-meta">${HOUSE.name} · 和室友一起住的第 ${daysTogether()} 天</div>
    </div>
    ${imgSlot('img/home-welcome.jpg', '待补欢迎横幅氛围图<br>窗边阳光 · 绿植 · 桌椅')}
  </section>

  <div class="hgrid">
    <section class="place">
      <div class="ptop"><h2>${HOUSE.name}</h2></div>
      <div class="pmeta">
        <span>${svg(I.me)}${memberCountText()}${awayN ? ` · ${awayN} 位登记离家` : ''}</span>
        <span>${svg(I.home)}${HOUSE.org}</span>
        <span>${svg(I.clock)}下一次保洁 ${HOUSE.clean.next}</span>
      </div>
      <div class="people">${people}</div>
    </section>

    <section class="mood">
      <div class="mbody">
        <div class="ml">今天，家里怎么样</div>
        <h2>${calm ? '一切正常，没有需要协调的事' : `有 ${watch.length} 件事值得留意`}</h2>
        ${watch.length ? `<div class="mtags">${watch.map(w => `<span>${w}</span>`).join('')}</div>` : ''}
        <div class="mglance">
          <span>${svg(I.guest)}今晚 ${tonightVisits().length} 位访客登记</span>
          <span>${svg(I.chore)}${myTasks().filter(x => x.due === '今天').length} 项任务待完成</span>
          <span>${svg(I.talk)}${mineTalk.length ? `${mineTalk.length} 项讨论等你表态` : houseTalk.length ? `${houseTalk.length} 项讨论进行中，你已表态` : '没有进行中的讨论'}</span>
        </div>
      </div>
      ${imgSlot('img/home-mood.jpg', '待补首页主视觉<br>沙发 · 猫 · 绿植 · 午后光线')}
    </section>
  </div>

  <div class="hgrid2">
    <div>
      ${sec('今日待办', todos.length ? `${Math.min(todos.length, 4)} 件` : '')}
      ${todos.length ? `<div class="todos">${todos.slice(0, 4).join('')}</div>`
        : '<div class="card empty">今天没有需要你处理的事。有新情况时，管家会主动提醒你。</div>'}
      ${butlerBox()}
    </div>
    <aside>
      ${sec('家里动态', '自动生成')}
      <ul class="stream">${S.feed.map(f => `<li>
        ${f.who === 'sys'
          ? `<span class="sic">${svg(I.spark)}</span>`
          : av(f.who, 'lg')}
        <span class="stx">${f.who === 'sys' ? '<b>Roomly 管家</b> ' : `<b>${mem(f.who).name}</b> `}${f.text}
          <div class="stm">${f.t}</div></span></li>`).join('')}</ul>
    </aside>
  </div>

  <section class="lifeband">
    ${imgSlot('img/home-lifeband.jpg', '待补底部生活方式横幅<br>绿植 · 柔和光线 · 生活场景')}
    <div class="lbtext"><p>生活不一定完美，但一个互相体谅的家，可以很美。</p></div>
  </section>`;
}

/* 问候语随时间变化，NOW 是演示时钟 */
function greet() {
  const h = parseInt(NOW.split(':')[0], 10);
  return h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
}
function greetSub() {
  const h = parseInt(NOW.split(':')[0], 10);
  return h < 11 ? '新的一天，从一个整洁、温暖的家开始。' : h < 18 ? '家里的事都在这儿，看一眼就好。' : '忙了一天，回到一个整洁、温暖的家。';
}
/* 从当前用户入住那天算到今天，只用已有的租约数据 */
function daysTogether() {
  const m = mem(ME).joined.match(/(\d+)月(\d+)日/);
  if (!m) return 0;
  const from = new Date(2026, +m[1] - 1, +m[2]);
  return Math.max(1, Math.round((new Date(2026, 8, 12) - from) / 86400000));
}

function butlerBox() {
  return `<div class="butler2">
    <div class="b2h"><span class="b2i">${svg(I.spark)}</span>
      <span><b>跟管家说一句</b><span>用平常说话的方式就行，管家会先理解、再让你确认</span></span></div>
    <div class="b2in">
      <input type="text" id="butlerIn" placeholder="比如：厕纸好像只剩两卷了" aria-label="跟管家说一句">
      <button data-act="butlerGo" aria-label="发送">${svg(I.arrow)}</button>
    </div>
    <div class="b2q">
      <button data-act="butlerFill" data-text="我刚买了29块9的厕纸，12卷，三个人平分">${svg(I.box)}我买了公共用品</button>
      <button data-act="butlerFill" data-text="我下周三到周日回老家">${svg(I.away)}我要离开几天</button>
      <button data-act="awkward">${svg(I.talk)}有件事不好开口</button>
    </div>
  </div>`;
}

/* ============================================================
   生活
   ============================================================ */
/* 生活页：接下来几天会发生什么，家里的东西和空间现在怎么样。
   日程只列已登记或已同步的事；八张卡各自读原有模块的数据，入口仍指向原来的子页面。 */
function vLife() {
  /* 即将入住的人可以看公共空间是怎么分的（有他的一块），其他子页要入住后才开放 */
  if (!can('tasks') && !(S.sub === 'space' && can('zonesOwn'))) return vLifeLimited();
  if (S.sub) return LIFE_VIEWS[S.sub]();
  const L = S.laundry, me = mem(ME);
  const rp = openRepairs()[0], low = lowSupplies(), away = awayMembers(), inc = incomingMember();
  const tonight = tonightVisits(), stayReq = inboxRequests().filter(r => r.kind === 'stay');
  const go = (sub, label) => `<button class="lcgo" data-act="go" data-tab="life" data-sub="${sub}">${label}${svg(I.chev)}</button>`;

  /* ---- 日程条目：自己的任务可以直接勾掉，其他人的只显示状态 ---- */
  const item = o => `<li class="ag ${o.done ? 'done' : ''} ${o.muted ? 'muted' : ''}">
    ${o.task && o.task.who === ME && !o.task.done
      ? `<button class="agm chk" data-act="doneTask" data-id="${o.task.id}" aria-label="完成 ${o.task.task}"></button>`
      : o.done ? `<span class="agm chk on">${svg(I.check, 2.4)}</span>`
      : `<span class="agm dot ${o.tone || ''}"></span>`}
    <div class="agb"><div class="agt">${o.title}</div><div class="ags">${o.sub}</div></div></li>`;
  const taskSub = t => t.done
    ? `${mem(t.who).name} · ${(t.doneAt || '').replace('今天 ', '')} 完成`
    : t.who === ME ? '固定任务，这次轮到你' : `${mem(t.who).name} 负责`;

  const today = [];
  S.tasks.filter(t => t.due === '今天').sort((a, b) => (a.done - b.done) || (b.who === ME) - (a.who === ME))
    .forEach(t => today.push({ task:t, done:t.done, title:t.task, sub:taskSub(t) }));
  tonight.forEach(v => today.push({ tone:'sky', title:`${mem(v.host).name} 有访客`,
    sub:`${v.time} · ${v.overnight ? '留宿' : '不留宿'}` }));
  if (L.user) today.push({ tone:'sky', title:`${mem(L.user).name} 在用洗衣机`, sub:`预计 ${L.endsAt} 结束` });

  const tomorrow = S.tasks.filter(t => t.due === TOMORROW.wd && !t.done)
    .map(t => ({ task:t, title:t.task, sub:taskSub(t) }));

  const next = [];
  if (rp) next.push({ tone:'peach', title:rp.desc, sub:`${repairState(rp).s} · 租房中介` });
  next.push({ tone:'sage', title:'公区保洁', sub:`${HOUSE.clean.next} · 租房中介排期` });
  /* 负责人登记离家中的任务已暂缓，不算"会发生的事"，留在值日页里 */
  S.tasks.filter(t => !t.done && !taskPaused(t) && !['今天', TOMORROW.wd].includes(t.due)).forEach(t => next.push({
    task:t, title:t.task, sub:`${t.due} · ${mem(t.who).name} 负责` }));
  away.forEach(a => next.push({ tone:'sage', title:`${mem(a.who).name} 回来`, sub:`${a.to} · 本人登记` }));
  if (inc) next.push({ tone:'peach', title:`${inc.name} 入住 ${inc.room}`, sub:`${inc.joined} · 租房中介同步` });

  const col = (title, date, list, empty) => `<div class="agcol">
    <div class="agh"><b>${title}</b><span>${date}</span></div>
    <ul>${list.length ? list.map(item).join('') : `<li class="ag none">${empty}</li>`}</ul></div>`;

  /* ---- 家里的东西和空间：每张卡读自己模块的数据 ---- */
  const supplyRow = s => {
    const isLowNow = isLow(s), warn = s.mode === 'state' && s.state === '不多了';
    const v = s.mode === 'count' ? `${isLowNow ? '仅剩' : '还有'} ${s.qty} ${s.unit}` : s.state;
    return `<li><span>${s.name}</span><b class="${isLowNow ? 'hot' : warn ? 'warm' : ''}">${v}</b></li>`;
  };
  const pub = S.supplies.filter(s => s.kind === 'public');
  const supplyList = [...pub.filter(isLow), ...pub.filter(s => !isLow(s) && s.mode === 'state' && s.state === '不多了'),
    ...pub.filter(s => !isLow(s) && !(s.mode === 'state' && s.state === '不多了'))].slice(0, 3);

  const guestAv = v => `<span class="av gav" title="${mem(v.host).name}的${v.guest}">${
    v.guestPhoto ? `<img src="${v.guestPhoto}" alt="" onerror="this.remove()">` : ''}客</span>`;
  const weekVisits = S.visits.filter(v => v.week);
  const guests = tonight.length ? tonight : weekVisits.slice(0, 1);

  const lend = S.supplies.filter(s => s.kind === 'lend');
  const dutyPeople = [...new Set(S.tasks.filter(t => !t.done).map(t => t.who))];
  const myAway = awayOf(ME);
  const washAct = !L.user
    ? `<button class="btn pri sm" data-act="washStart">开始使用</button>`
    : L.user === ME
      ? `<button class="btn pri sm" data-act="washDone">${svg(I.check)}我拿好了</button>
         <button class="btn sm" data-act="washCancel">点错了</button>`
      : `<button class="btn sm ${L.notifyMe ? '' : 'pri'}" data-act="notifyWash" ${L.notifyMe ? 'disabled' : ''}>${L.notifyMe ? '已设置提醒' : '结束后提醒我'}</button>`;

  return `
  <div class="lifetop">
    <div><h1>生活</h1><p>接下来几天会发生什么，家里的东西和空间现在怎么样。</p></div>
    <div class="ltme">${av(ME, 'lg')}<span><b>${me.name}</b>和室友一起住的第 ${daysTogether()} 天</span></div>
  </div>

  <section class="lwelcome">
    <div class="lw-text">
      <button class="lw-cta" data-act="awkward">${svg(I.talk)}有件事不好开口</button>
      <h2>一起生活，<br>把日子过成自己喜欢的样子。</h2>
      <p>分享空间，也分享日常里的小确幸。</p>
    </div>
    ${imgSlot('img/life-welcome.jpg', '待补生活页顶部横幅图<br>餐桌 · 花束 · 马克杯 · 窗边阳光')}
  </section>

  ${sec('这几天会发生的', '只列已经登记或同步的事', go('chore', '值日安排'))}
  <section class="agenda">
    ${col('今天', `${TODAY} ${WEEKDAY}`, today, '今天没有登记的安排')}
    ${col('明天', `${TOMORROW.date} ${TOMORROW.wd}`, tomorrow, '暂时没有登记的安排')}
    ${col('接下来', `到 ${inc ? inc.joined : away[0] ? away[0].to : '下周'}`, next, '暂时没有更远的安排')}
    <div class="agmoment">
      ${imgSlot('img/life-moment.jpg', '待补活动氛围图<br>沙发 · 绿植 · 暖光')}
      <div class="agmt"><p>好的日子，<br>是大家一起过出来的。</p>
        <button class="btn" data-act="newTask">${svg(I.plus)}提一件事</button></div>
    </div>
  </section>

  ${sec('家里的东西和空间', '数量和状态都由成员自己更新')}
  <section class="lcards">
    <article class="lc sand">
      <header><span class="lci">${svg(I.box)}</span><h3>公共物品</h3>${low.length ? `<i class="lcflag">${low.length}</i>` : ''}</header>
      <ul class="lclist">${supplyList.map(supplyRow).join('')}</ul>
      <footer>${go('supply', '管理公共物品')}</footer>
    </article>

    <article class="lc sky">
      <header><span class="lci">${svg(I.guest)}</span><h3>访客</h3>${stayReq.length ? `<i class="lcflag">${stayReq.length}</i>` : ''}</header>
      <div class="gavs">${guests.map(v => av(v.host, 'lg')).join('')}${guests.map(guestAv).join('')}
        <button class="av gav add" data-act="newVisit" aria-label="登记访客">${svg(I.plus)}</button></div>
      <div class="lcbig">${tonight.length ? `${mem(tonight[0].host).name} 今晚有访客` : '今晚没有访客登记'}</div>
      <div class="lcsub">${tonight.length ? `${tonight[0].time} · ${tonight[0].overnight ? '留宿' : '不留宿'}` : '有朋友来提前说一声就好'}</div>
      <div class="lcnote">${stayReq.length ? `<b>${stayReq.length} 条留宿请求等你回应</b>` : `本周已登记 ${weekVisits.length} 次到访`}</div>
      <footer>${go('guest', '访客记录')}</footer>
    </article>

    <article class="lc sage">
      <header><span class="lci">${svg(I.wash)}</span><h3>洗衣机</h3></header>
      <div class="lcbig"><i class="sdot ${L.user ? 'busy' : 'free'}"></i>${L.user ? `${mem(L.user).name} 使用中` : '空闲'}</div>
      <div class="lcsub">${L.user ? `预计 ${L.endsAt} 结束 · ${L.minutes} 分钟` : '点开始就能用，用完记得点一下'}</div>
      <div class="lcnote">${L.src ? srcNote(L.src) : '状态来自使用者的登记'}</div>
      <footer><div class="btnrow">${washAct}</div>${go('facility', '共享设施')}</footer>
    </article>

    <article class="lc cream">
      <header><span class="lci">${svg(I.space)}</span><h3>公共空间</h3>${S.zoneProposal.confirmed ? '' : '<i class="lcflag">1</i>'}</header>
      <ul class="lclist">${S.spaces.map(sp => {
        const z = sp.zones.find(x => x.o === ME);
        return `<li><span>${sp.name}</span><b>${z ? z.n + ' · 你的分区' : '没有你的分区'}</b></li>`; }).join('')}</ul>
      ${S.zoneProposal.confirmed ? '' : `<div class="lcnote warm">${mem(S.zoneProposal.who).name} 的分区待确认</div>`}
      <footer>${go('space', '查看分区')}</footer>
    </article>

    <article class="lc cream">
      <header><span class="lci">${svg(I.away)}</span><h3>在住 / 离家</h3></header>
      <div class="lcsub">${living().length - away.length} 人在住 · ${away.length} 人登记离家${inc ? ` · ${inc.name} ${inc.joined} 入住` : ''}${settlingMembers().length ? ` · ${settlingMembers().length} 人已搬出待结清` : ''}</div>
      <div class="lpeople">${household().map(m => {
        const st = statusOf(m.id), a = awayOf(m.id);
        return `<div class="lp ${st}">${av(m.id, 'xl' + (st === 'in' ? '' : ' out'))}
          <b>${m.name}${m.id === ME ? '·你' : ''}</b><span>${st === 'away' ? a.to + ' 回' : st === 'incoming' ? m.joined + ' 入住' : STATUS_TEXT[st]}</span></div>`; }).join('')}</div>
      <footer>${myAway
        ? `<button class="btn sm" data-act="cancelAway" data-id="${myAway.id}">我提前回来了</button>`
        : `<button class="btn sm" data-act="newAway">登记我的离家</button>`}${go('away', '详情')}</footer>
    </article>

    <article class="lc sand">
      <header><span class="lci">${svg(I.tool)}</span><h3>可借的东西</h3></header>
      <ul class="lclist lend">${lend.map(s => `<li>${av(s.owner, 'sm')}<span>${s.name}<em>${s.rule}</em></span>
        ${s.owner === ME ? '<b>你的</b>' : `<button class="btn sm" data-act="borrow" data-id="${s.id}">${s.rule.startsWith('可直接') ? '登记借用' : '问一声'}</button>`}</li>`).join('')}</ul>
      <footer>${go('supply', '全部物品')}</footer>
    </article>

    <article class="lc sage">
      <header><span class="lci">${svg(I.chore)}</span><h3>清洁安排</h3></header>
      <div class="lcbig">下次公区保洁 ${HOUSE.clean.next}</div>
      <div class="lcsub">${srcNote(HOUSE.clean.src)}</div>
      <div class="lcnote"><span class="avs">${dutyPeople.map(id => av(id, 'sm')).join('')}</span>
        这周值日 ${S.tasks.filter(t => !t.done).length} 项待完成，你有 ${myTasks().length} 项</div>
      <footer>${go('chore', '查看排班')}</footer>
    </article>

    <article class="lc peach">
      <header><span class="lci">${svg(I.phone)}</span><h3>房屋服务</h3></header>
      <ul class="lclist svc">
        <li><span>${svg(I.tool)}</span><span>报修<em>${rp ? `${rp.desc} · ${repairState(rp).s}` : '没有进行中的报修'}</em></span></li>
        <li><span>${svg(I.phone)}</span><span>${HOUSE.steward}<em>${HOUSE.org.split(' · ')[0]} · 居住问题可以请管家协调</em></span></li>
      </ul>
      <footer><button class="btn sm" data-act="newRepair">${svg(I.plus)}我要报修</button>${go('facility', '报修记录')}</footer>
    </article>
  </section>

  <section class="lband">
    ${imgSlot('img/life-band.jpg', '待补底部横幅图<br>绿植 · 猫 · 沙发一角 · 柔和光线')}
    <div class="lbt"><p>生活不只是住在一起，<br>更是和不同的人，一起把日子过舒服。</p></div>
  </section>`;
}

/* ---------- 值日 ---------- */
function vChore() {
  const taskRow = t => {
    const paused = taskPaused(t);
    return `<div class="row ${t.done ? 'dim' : ''}">
      <div class="main">
        <div class="ttl">${t.task}
          <span class="pill ${t.done ? 'ok' : t.due === '今天' ? 'warn' : 'plain'}">${t.done ? '已完成' : t.due}</span>
          ${paused ? '<span class="pill plain">登记离家中，已暂缓</span>' : ''}
        </div>
        <div class="meta">${mem(t.who).name}${t.who === ME ? '（你）' : ''}
          ${t.done && t.doneAt ? ` · ${t.doneAt} 标记完成` : ''}${t.deferred ? ' · ' + t.deferred : ''}</div>
      </div>
      <div class="right">${av(t.who, 'lg' + (paused ? ' out' : ''))}</div>
      <div class="cta">${t.done
        ? `<button class="btn sm" data-act="undoTask" data-id="${t.id}">撤销</button>`
        : t.who === ME
          ? `<button class="btn sm pri" data-act="doneTask" data-id="${t.id}">${svg(I.check)}完成</button>
             ${paused ? '' : `<button class="btn sm" data-act="deferTask" data-id="${t.id}">今天做不了</button>`}`
          : `<span class="pill plain">${mem(t.who).name} 负责</span>`}</div>
    </div>`;
  };
  const mine = S.tasks.filter(t => t.who === ME);
  const others = S.tasks.filter(t => t.who !== ME);
  const load = loadByMember();
  const maxLoad = Math.max(1, ...Object.values(load));

  return `
    ${backBtn('生活', 'life')}
    ${head('值日', '固定任务由大家一起定，当期安排由系统按日期和离家登记生成。谁临时不方便，可以换班或顺延。')}
    ${inboxRequests().filter(r => r.kind === 'swap').length ? `${sec('等你回应的换班')}
      <div class="stack">${inboxRequests().filter(r => r.kind === 'swap').map(r => reqCard(r)).join('')}</div>` : ''}
    ${myRequests().filter(r => r.kind === 'swap').length ? `${sec('我发出的换班请求')}
      <div class="stack">${myRequests().filter(r => r.kind === 'swap').map(r => reqCard(r, true)).join('')}</div>` : ''}
    ${sec('我的任务', `${mine.filter(t => !t.done).length} 项待完成`)}
    <div class="card rows">${mine.map(taskRow).join('') || '<div class="empty">这周你没有分到任务</div>'}</div>
    ${sec('这周家里的分工')}
    <div class="card rows">${others.map(taskRow).join('')}</div>

    ${sec('固定任务', '低频设定，改动需要全员确认', `<button class="btn sm" data-act="newTask">${svg(I.plus)}临时任务</button>`)}
    <div class="card rows">${S.choreTemplates.map(c => `
      <div class="row"><div class="main"><div class="ttl">${c.task}
        <span class="pill plain">${c.every}</span></div>
        <div class="meta">${srcNote(c.src)}</div></div></div>`).join('')}</div>

    ${sec('责任分布', '最近 4 周')}
    <div class="card pad">
      ${living().map(m => `
        <div class="calcline">
          <span class="cl">${av(m.id)}${m.name}</span>
          <span style="display:flex;align-items:center;gap:9px;flex:1;margin-left:12px">
            <span style="flex:1;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;max-width:180px">
              <i style="display:block;height:100%;width:100%;background:var(--jade);transform-origin:left;transform:scaleX(${load[m.id] / maxLoad})"></i></span>
            <span class="cv">${load[m.id]} 项</span></span>
        </div>`).join('')}
      <p style="font-size:13px;color:var(--ink-2);margin-top:11px;line-height:1.6">
        由 ${S.completions.length} 条完成记录统计得出。Tom 登记了 9月8日—9月18日 离家，这期间的任务由其他人承担，
        后续轮换会自动补偿回来。除此之外，当前责任分布整体均衡。</p>
      ${srcTag({ via:'derived', note:`来自 ${S.completions.length} 条任务完成记录` })}
    </div>`;
}

/* ---------- 公共物品 ---------- */
function vSupply() {
  const KINDS = [
    { k:'public',  label:'公共',  desc:'所有人都可以用，一起采购、费用平摊。数量由谁发现谁更新。' },
    { k:'lend',    label:'可借',  desc:'属于某个人，但愿意借出。由物主自己登记共享方式。' },
    { k:'private', label:'私人',  desc:'明确属于个人。只有需要划清边界时才登记，不用录入所有东西。' }
  ];
  const seg = S.segment;
  const list = S.supplies.filter(s => s.kind === seg);

  const card = s => {
    if (s.kind === 'public') {
      const low = isLow(s);
      if (s.mode === 'count') {
        const pct = Math.max(6, Math.min(100, Math.round(s.qty / s.max * 100)));
        return `<div class="card sup ${low ? 'low' : ''}">
          <div class="head"><div><div class="nm">${s.name}</div><div class="th">低于 ${s.min} ${s.unit} 时提醒</div></div>
            <span class="pill ${low ? 'hot' : 'ok'}">${low ? '需要补充' : '充足'}</span></div>
          <div><div class="num" style="font-size:21px;font-weight:600;margin-bottom:5px">${s.qty}<span style="font-size:12.5px;color:var(--ink-3);margin-left:2px">${s.unit}</span></div>
            <div class="bar"><i style="transform:scaleX(${pct / 100})"></i></div></div>
          <div class="foot">
            <span class="qty"><button data-act="dec" data-id="${s.id}" aria-label="减少${s.name}">−</button><span>${s.qty}</span><button data-act="inc" data-id="${s.id}" aria-label="增加${s.name}">+</button></span>
            <button class="btn sm" data-act="setStock" data-id="${s.id}">更新库存</button>
          </div>
          <div class="foot"><span></span><button class="btn sm ${low ? 'pri' : ''}" data-act="restock" data-id="${s.id}">补充并记账</button></div>
          ${srcTag(s.src)}</div>`;
      }
      return `<div class="card sup ${low ? 'low' : ''}">
        <div class="head"><div><div class="nm">${s.name}</div><div class="th">只记状态，不数数量</div></div>
          <span class="pill ${low ? 'hot' : s.state === '不多了' ? 'warn' : 'ok'}">${s.state}</span></div>
        <div class="states">${SUPPLY_STATES.map(v => `
          <button class="stbtn" data-act="setState" data-id="${s.id}" data-v="${v}" aria-pressed="${s.state === v}">${v}</button>`).join('')}</div>
        <div class="foot"><span></span><button class="btn sm ${low ? 'pri' : ''}" data-act="restock" data-id="${s.id}">补充并记账</button></div>
        ${srcTag(s.src)}</div>`;
    }
    if (s.kind === 'lend') {
      return `<div class="card sup">
        <div class="head"><div><div class="nm">${s.name}</div><div class="th">可借</div></div>
          <span class="pill info">${s.rule.startsWith('可直接') ? '可直接使用' : '需先询问'}</span></div>
        <div class="owner">${av(s.owner)}${mem(s.owner).name} 登记${s.owner === ME ? '（你）' : ''}</div>
        <div class="rulenote">${s.rule}</div>
        <div class="foot"><span></span>${s.owner === ME
          ? `<button class="btn sm" data-act="manageThing" data-id="${s.id}">管理</button>
             <button class="btn sm" data-act="delThing" data-id="${s.id}">删除</button>`
          : `<button class="btn sm" data-act="borrow" data-id="${s.id}">${s.rule.startsWith('可直接') ? '登记借用' : '问一声'}</button>`}</div>
        ${srcTag(s.src)}</div>`;
    }
    return `<div class="card sup">
      <div class="head"><div><div class="nm">${s.owner === ME ? s.name : '私人物品'}</div><div class="th">${s.zone || ''}</div></div>
        <span class="pill plain">${svg(I.lock)}私人</span></div>
      <div class="owner">${av(s.owner)}${mem(s.owner).name}${s.owner === ME ? '（你）' : ''}</div>
      <div class="rulenote">${s.owner === ME ? '只有你能看到具体内容。' : '这是私人区域，其他人不需要知道里面具体有什么。'}</div>
      ${s.owner === ME ? `<div class="foot"><span></span>
        <button class="btn sm" data-act="manageThing" data-id="${s.id}">管理</button>
        <button class="btn sm" data-act="delThing" data-id="${s.id}">删除</button></div>` : ''}
      ${s.owner === ME ? srcTag(s.src) : ''}</div>`;
  };

  return `
    ${backBtn('生活', 'life')}
    ${head('公共物品', '不是家里所有东西都属于所有人。数量和状态都由成员自己更新，系统不会去数。')}
    <div class="segbar">${KINDS.map(k => `<button class="seg" data-act="seg" data-k="${k.k}" aria-pressed="${seg === k.k}">${k.label}</button>`).join('')}</div>
    <div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>${KINDS.find(k => k.k === seg).desc}</span></div>
    ${inboxRequests().filter(r => r.kind === 'borrow').length ? `${sec('等你回应的借用')}
      <div class="stack" style="margin-bottom:14px">${inboxRequests().filter(r => r.kind === 'borrow').map(r => reqCard(r)).join('')}</div>` : ''}
    ${myRequests().filter(r => r.kind === 'borrow').length ? `${sec('我发出的借用请求')}
      <div class="stack" style="margin-bottom:14px">${myRequests().filter(r => r.kind === 'borrow').map(r => reqCard(r, true)).join('')}</div>` : ''}
    ${seg !== 'public' ? `<div class="btnrow" style="margin-bottom:12px">
      <button class="btn pri sm" data-act="newThing">${svg(I.plus)}添加我的物品</button></div>` : ''}
    <div class="sgrid">${list.map(card).join('') || '<div class="card empty">这一类还没有登记过物品</div>'}</div>`;
}

/* ---------- 公共空间 ---------- */
function vSpace() {
  const inc = incomingMember();
  const pr = S.zoneProposal;
  const zoneRow = z => {
    const cls = z.o === 'public' ? 'pub' : z.pending ? 'pending' : z.o === ME ? 'mine' : '';
    return `<div class="zone ${cls}">
      <span class="zn">${z.n}</span>
      <span class="zo">${z.o === 'public'
        ? '<span class="pill plain">公共</span>'
        : `${av(z.o, 'sm')}${mem(z.o).name}${z.o === ME ? '（你）' : ''}`}
        ${z.pending ? `<span class="pill plain">${mem(z.o).joined}起</span>` : ''}</span>
    </div>`;
  };
  return `
    ${backBtn('生活', 'life')}
    ${head('公共空间', '分区是大家一次性定好的共同约定。新成员加入时，只需要为他增加一块，其他人的不动。')}

    ${inboxRequests().filter(r => r.kind === 'zone').length ? `${sec('等你回应的分区调整')}
      <div class="stack" style="margin-bottom:14px">${inboxRequests().filter(r => r.kind === 'zone').map(r => reqCard(r)).join('')}</div>` : ''}
    ${myRequests().filter(r => r.kind === 'zone').length ? `${sec('我发出的分区调整请求')}
      <div class="stack" style="margin-bottom:14px">${myRequests().filter(r => r.kind === 'zone').map(r => reqCard(r, true)).join('')}</div>` : ''}
    ${inc && !pr.confirmed ? `
    <div class="live" style="margin-bottom:14px">
      <div class="lv-top">${av(inc.id, 'lg')}
        <div style="flex:1"><b>${inc.name} 即将入住 ${inc.room}，还没有分配公共空间</b>
          <span>管家按"一人一块 + 保留公共区"给出了建议，确认后才会出现在下面的分区里</span></div>
        <span class="pill warn">待确认</span></div>
      <div class="lv-body">${pr.items.map(it => `<span class="val" style="padding-left:10px">
        ${S.spaces.find(sp => sp.id === it.sp).name} <b>${it.n}</b></span>`).join('')}</div>
      ${can('spaces') ? `<div class="btnrow"><button class="btn pri sm" data-act="confirmZones">确认分配</button></div>` : '<div class="srctag">由在住成员确认</div>'}
    </div>` : ''}

    <div class="spgrid">${S.spaces.map(sp => `
      <div class="card space">
        <h3>${svg(I[sp.icon])}${sp.name}</h3>
        <div class="zones">${sp.zones.map(zoneRow).join('')}</div>
        ${srcTag(sp.src)}
      </div>`).join('')}</div>

    ${can('spaces') ? `<div class="btnrow" style="margin-top:14px">
      <button class="btn sm" data-act="redivide">重新划分公共空间</button>
    </div>` : ''}`;
}

/* ---------- 访客 ---------- */
function vGuest() {
  const o = overnightRule();
  const week = S.visits.filter(v => v.week);
  return `
    ${backBtn('生活', 'life')}
    ${head('访客', '普通到访只要说一声；留宿会对照现在的约定，超过了也不是禁止，而是先问问大家。')}

    ${inboxRequests().length ? `${sec('等待你回应', `${inboxRequests().length} 条`)}
      <div class="stack">${inboxRequests().map(r => reqCard(r)).join('')}</div>` : ''}
    ${myRequests().filter(r => r.kind === 'stay').length ? `${sec('我发出的请求')}
      <div class="stack">${myRequests().filter(r => r.kind === 'stay').map(r => reqCard(r, true)).join('')}</div>` : ''}
    ${sec('本周访客登记', `${week.length} 条记录`, `<button class="btn pri sm" data-act="newVisit">${svg(I.plus)}登记访客</button>`)}
    <div class="card rows">${S.visits.length ? S.visits.map(v => `
      <div class="row"><div class="main">
        <div class="ttl">${mem(v.host).name} 的${v.guest}
          <span class="pill ${v.overnight ? 'info' : 'plain'}">${v.overnight ? '留宿' : '不留宿'}</span></div>
        <div class="meta">${v.date} · ${v.time}</div>
        ${srcTag(v.src)}</div>
        <div class="right">${av(v.host)}</div>
        ${v.host === ME ? `<div class="cta"><button class="btn sm" data-act="editVisit" data-id="${v.id}">修改</button></div>` : ''}
      </div>`).join('')
      : '<div class="empty">本周还没有访客登记</div>'}</div>

    ${sec('留宿次数是怎么算出来的')}
    <div class="card pad">
      <div class="ruleitem" style="padding:0;border:0">
        <span class="rn">${svg(I.guest)}</span>
        <div class="rb"><div class="rt">${o.rule.title}</div><div class="rd">${o.rule.desc}</div></div>
      </div>
      <div class="calcbox">
        ${o.pairs.map(p => `<div class="calcline"><span class="cl">${av(p.host, 'sm')}${mem(p.host).name} 的「${p.guest}」</span>
          <span class="cv" style="color:${p.nights > o.limit ? 'var(--amber)' : 'var(--jade)'}">${p.nights} 晚 / 约定 ${o.limit} 晚</span></div>`).join('')
          || '<div class="calcline"><span class="cl">本周没有留宿登记</span><span class="cv">0 晚</span></div>'}
      </div>
      ${srcTag({ via:'derived', note:`按"谁的哪一位访客"分开累计，由 ${week.filter(v => v.overnight).length} 条留宿登记得出，不同访客不会加在一起；系统不核实实际住宿情况` })}
    </div>`;
}

/* ---------- 离家 ---------- */
function vAway() {
  const myAway = awayOf(ME);
  return `
    ${backBtn('生活', 'life')}
    ${head('离家', '这是产品唯一的离家数据来源。登记之后，成员状态、值日、公共采购和水电分摊都基于它推导。')}
    ${sec('当前状态')}
    <div class="card rows">${living().map(m => {
      const a = awayOf(m.id);
      return `<div class="row"><div class="main">
        <div class="ttl">${m.name}${m.id === ME ? '（你）' : ''}
          <span class="pill ${a ? 'plain' : 'ok'}">${a ? '登记离家中' : '在住'}</span></div>
        <div class="meta">${a ? `${a.from} — ${a.to}，共 ${a.days} 天` : m.room}</div>
        ${a ? srcTag(a.src) : ''}</div>
        <div class="right">${av(m.id, 'lg' + (a ? ' out' : ''))}</div>
        ${a && m.id === ME ? `<div class="cta">
          <button class="btn sm" data-act="editAway" data-id="${a.id}">修改</button>
          <button class="btn sm pri" data-act="cancelAway" data-id="${a.id}">我提前回来了</button></div>` : ''}
      </div>`;
    }).join('')}</div>
    ${awayMembers().length ? `${sec('这份登记影响了什么')}
    <div class="card pad"><div class="stack">
      ${awayMembers().map(a => `<div>
        <div style="font-family:var(--f-d);font-weight:600;font-size:14.5px;margin-bottom:6px">${mem(a.who).name} · ${a.from} — ${a.to}</div>
        <div class="calcline"><span class="cl">${svg(I.chore)}值日</span><span class="cv" style="font-weight:400;font-size:12.5px;color:var(--ink-2)">期间的任务自动暂缓，后续轮换补偿</span></div>
        <div class="calcline"><span class="cl">${svg(I.box)}公共采购</span><span class="cv" style="font-weight:400;font-size:12.5px;color:var(--ink-2)">期间不安排采购任务</span></div>
        <div class="calcline"><span class="cl">${svg(I.scale)}水电分摊</span><span class="cv" style="font-weight:400;font-size:12.5px;color:var(--ink-2)">登记在住天数 ${30 - a.days} 天</span></div>
      </div>`).join('')}
    </div></div>` : ''}
    <div class="btnrow" style="margin-top:14px">
      ${myAway ? '' : `<button class="btn pri" data-act="newAway">${svg(I.away)}登记我的离家</button>`}
    </div>`;
}

/* ---------- 共享设施 ---------- */
function vFacility() {
  const L = S.laundry;
  const mine = L.user === ME;
  return `
    ${backBtn('生活', 'life')}
    ${head('共享设施', '设施状态完全来自使用者的登记。没人点开始，系统就不知道有人在用。')}

    <div class="card pad" style="margin-bottom:12px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="width:40px;height:40px;border-radius:12px;background:${L.user ? 'var(--slate-soft)' : 'var(--jade-soft)'};color:${L.user ? 'var(--slate)' : 'var(--jade)'};display:grid;place-items:center;flex:none">${svg(I.wash)}</span>
        <div style="flex:1">
          <h3 style="font-size:16px">洗衣机</h3>
          <div style="font-size:13.5px;color:var(--ink-2);margin-top:3px">
            ${L.user ? `${mem(L.user).name} 使用中 · ${L.minutes} 分钟 · 预计 ${L.endsAt} 结束` : '当前空闲，可以直接使用'}</div>
          ${L.src ? srcTag(L.src) : ''}
          <div class="btnrow" style="margin-top:11px">
            ${!L.user ? `<button class="btn pri sm" data-act="washStart">开始使用</button>`
              : mine ? `<button class="btn pri sm" data-act="washDone">${svg(I.check)}我拿好了</button>
                        <button class="btn sm" data-act="washCancel">点错了，取消</button>`
              : `<button class="btn sm ${L.notifyMe ? '' : 'pri'}" data-act="notifyWash" ${L.notifyMe ? 'disabled' : ''}>${L.notifyMe ? '已设置提醒' : '结束后提醒我'}</button>`}
          </div>
          <div class="notice" style="margin-top:11px">${svg(I.info)}<span>
            预计结束后如果一直没人取，管家只会私下提醒使用者一句，不会公开显示占用了多久。</span></div>
        </div>
      </div>
    </div>

    ${sec('房屋服务', '由租房中介提供，住户不手动维护', `<button class="btn pri sm" data-act="newRepair">${svg(I.plus)}我要报修</button>`)}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">公区保洁</div>
        <div class="meta">客厅、厨房、卫生间，无需自己打扫</div>
        ${srcTag(HOUSE.clean.src)}</div>
        <div class="right"><div class="amt" style="font-size:14px">${HOUSE.clean.next}</div></div></div>
      <div class="row"><div class="main"><div class="ttl">${HOUSE.steward}</div>
        <div class="meta">居住问题长期没解决时，可以在问题记录里请管家协调</div></div></div>
    </div>

    ${sec('报修记录')}
    <div class="card rows">${S.repairs.length ? S.repairs.map(r => `
      <div class="row"><div class="main">
        <div class="ttl">${r.desc}<span class="pill ${repairState(r).s === '已完成' ? 'ok' : 'warn'}">${repairState(r).s}</span></div>
        <div class="meta">${r.place} · ${mem(r.by).name} 提交</div>
        <div class="timeline">${r.timeline.map(x => `
          <div class="tlrow"><i class="${x.via}"></i><span>${x.s}</span><em>${x.at}</em>
            <span class="tlvia">${x.via === 'platform' ? '租房中介' : '住户'}</span></div>`).join('')}</div>
      </div>
      ${r.by === ME && repairState(r).s !== '已完成'
        ? `<div class="cta"><button class="btn sm" data-act="editRepair" data-id="${r.id}">${r.timeline.length > 1 ? '补充 / 完成' : '补充 / 撤回'}</button></div>` : ''}
      </div>`).join('') : '<div class="empty">还没有报修记录</div>'}</div>`;
}

const LIFE_VIEWS = { chore:vChore, supply:vSupply, space:vSpace, guest:vGuest, away:vAway, facility:vFacility };

/* ============================================================
   账单
   ============================================================ */
const METHOD_TEXT = { even:'平均分摊', days:'按登记在住天数', ratio:'按比例', custom:'自定义' };

/* 账单页：算清楚不是为了斤斤计较，而是为了让长期一起住更轻松。
   顶部是管家发现的公平问题，中间是本月怎么结、右侧是记账入口，下面是每一笔记录。
   所有金额都来自 bills / netSettlement / fairByDays，页面不写死数字。 */
function vBill() {
  if (!can('pay')) return vBillLimited();
  /* 已搬出待结清的人：只看和自己有关的历史账单、把该付的付掉，不再记新账 */
  const limited = !can('bills');
  const net = netSettlement(), away = awayMembers(), fd = fairByDays();
  const open = openBills(), month = TODAY.split('月')[0] + '月';
  const pending = !limited && away.length && !S.fairApplied;
  const bills = limited ? S.bills.filter(b => b.payer === ME || b.people.includes(ME)) : S.bills;

  /* 每个人的应付 / 应收：应付 = 别人垫付里我的份额，应收 = 我垫付里别人的份额；已搬出待结清的人也在里面 */
  const gross = {};
  accountHolders().forEach(m => gross[m.id] = { pay:0, recv:0 });
  open.forEach(b => b.people.forEach(p => {
    if (p === b.payer || !gross[p]) return;
    gross[p].pay += shareOf(b, p);
    if (gross[b.payer]) gross[b.payer].recv += shareOf(b, p);
  }));

  const fairCard = pending ? `
    <div class="fairhero">
      <span class="fhi"><img src="img/bill-idea.png" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()">${svg(I.spark)}</span>
      <div class="fhb">
        <h2>${S.utilityForecast.title}，要不要按登记在住天数来分？</h2>
        <p>${away.map(a => `${mem(a.who).name} 登记了 ${a.from} — ${a.to} 离家，共 ${a.days} 天`).join('；')}。
          ${S.utilityForecast.title}预计 ${yuan(S.utilityForecast.amount)}，如果仍按 ${living().length} 人平均，可能和大家的实际使用有出入。</p>
        <div class="btnrow">
          <button class="btn pri" data-act="applyFair">采用这个方案</button>
          <button class="btn" data-act="keepEven">仍按平均分摊</button>
        </div>
        <div class="fhf">这只是一个建议，分摊方式由你们自己决定，系统不会替你们改。${srcTag({ via:'derived', note:'按成员登记的离家时间计算，系统不掌握真实居住情况' })}</div>
      </div>
    </div>` : `
    <div class="fairdone">${svg(I.check)}<span>${limited ? '你已搬出，这里只显示和你有关的账单；结清之后成员关系正式结束。'
      : S.fairApplied
      ? `${S.utilityForecast.title}${S.bills.some(b => b.method === 'days') ? '已按登记在住天数计算，并加入下方账单' : '按平均分摊，大家已确认'}。房租、宽带这类固定成本和公共消耗品不受离家天数影响，维持原有方式。`
      : '这个月没有人登记离家，公共费用按平均分摊。离家天数只会影响水电燃气这类随使用变化的费用。'}</span></div>`;

  const fairPeople = pending ? `
    <div class="fairpeople">
      <div class="fpl">按登记在住天数，${S.utilityForecast.title}会是</div>
      <div class="fps">${fd.rows.map(r => `<div class="fp">
        ${av(r.id, 'xl')}<b>${mem(r.id).name}</b>
        <span class="fpa">${yuan(r.amount)}</span>
        <span class="fpd">登记在住 ${r.days} 天${r.off ? `<br>离家 ${r.off} 天` : ''}</span></div>`).join('')}</div>
    </div>` : '';

  /* ---- 每一笔记录 ---- */
  const scope = b => b.people.length < living().length ? `${b.people.length} 人分` : METHOD_TEXT[b.method];
  const billRow = b => `
    <div class="brow ${b.settled ? 'done' : ''}">
      <div class="bdate">${b.date}</div>
      <div class="bwhat"><b>${b.title}</b>${b.note ? `<span>${b.note}</span>` : ''}</div>
      <div class="bchips"><span class="bchip kind">${BILL_KIND[billKindOf(b)]}</span><span class="bchip ${b.method === 'days' ? 'sage' : b.people.length < living().length ? 'sky' : ''}">${scope(b)}</span>
        ${b.src && b.src.via !== 'manual' ? `<span class="bchip src">${b.src.via === 'supply' ? '补货自动生成' : '管家记录'}</span>` : ''}</div>
      <div class="bpayer">${av(b.payer, 'sm')}<span>${mem(b.payer).name}${b.payer === ME ? '（你）' : ''} 垫付</span></div>
      <div class="bpeople">${b.people.map(p => av(p, 'sm')).join('')}<span>${b.shares ? `${b.people.length} 人 · 各不相同` : perLabel(b)}</span></div>
      <div class="bamt">${yuan(b.amount)}</div>
      <div class="bstate"><span class="pill ${b.settled ? 'ok' : 'warn'}">${b.settled ? '已结清' : '待结算'}</span></div>
      <div class="bact">
        ${limited ? '' : `<button class="btn sm" data-act="editBill" data-id="${b.id}">修改</button>`}
        ${b.settled
          ? `<button class="btn sm" data-act="unsettle" data-id="${b.id}">撤销结清</button>`
          : `<button class="btn sm pri" data-act="settle" data-id="${b.id}">${svg(I.check)}标记结清</button>`}
      </div>
    </div>`;

  const netLabel = id => {
    const v = net.balances[id] || 0;
    return Math.abs(v) < 0.005 ? '<span class="pill ok">已两清</span>'
      : v < 0 ? `<span class="pill warn">还需付 ${yuan(-v)}</span>` : `<span class="pill info">可收回 ${yuan(v)}</span>`;
  };

  return `
  <section class="bhero">
    <div class="bh-left">
      <div class="bh-head"><h1>账单</h1><p>让每一笔花费都清晰透明，合租更安心。</p></div>
      ${fairCard}
    </div>
    <div class="bh-right">
      ${imgSlot('img/bill-hero.jpg', '待补账单页主视觉<br>阳光房间 · 绿植 · 木质家具 · 装饰画')}
      ${fairPeople}
    </div>
  </section>

  <section class="bstats">
    <div class="bst peach"><span class="bsi">${svg(I.bill)}</span><div>
      <div class="bsl">待我支付</div><div class="bsv">${yuan(myDueTotal())}</div>
      <div class="bss">${myDue().length ? `${myDue().length} 笔别人垫付的份额` : '暂时没有要付的'}</div></div></div>
    <div class="bst sky"><span class="bsi">${svg(I.scale)}</span><div>
      <div class="bsl">本月共同支出</div><div class="bsv">${yuan(monthTotal())}</div>
      <div class="bss">${S.bills.length} 笔支出</div></div></div>
    <div class="bst sage"><span class="bsi">${svg(I.check)}</span><div>
      <div class="bsl">未结清</div><div class="bsv">${open.length} <small>笔</small></div>
      <div class="bss">月末按净额一次结清</div></div></div>
    <div class="bquote">
      <p>AA 不只是付钱，<br>更是互相理解的生活方式。</p>
      ${imgSlot('img/bill-tip.jpg', '待补小贴士插画')}
    </div>
  </section>

  <div class="bgrid">
    <section class="bsettle">
      <div class="bs-head"><h2>本月结算</h2><span class="bs-month">${month}</span>
        <span class="bs-hint">未结清的 ${open.length} 笔账单自动抵消后的净额</span></div>
      <div class="bs-body">
        <ul class="bs-rows">${accountHolders().map(m => `<li>
          ${av(m.id, 'lg')}
          <div class="bsn"><b>${m.name}${m.id === ME ? '（你）' : ''}${membership(m.id) !== 'active' ? ' <small style="color:var(--ink-4);font-weight:400">已搬出</small>' : ''}</b>
            <span>应付 ${yuan(gross[m.id].pay)} <i>·</i> 应收 ${yuan(gross[m.id].recv)}</span></div>
          ${netLabel(m.id)}</li>`).join('')}</ul>
        <figure class="ph bs-art">
          <img src="img/bill-settle.jpg" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()">
          <figcaption>待补结算区插画<br>小桌 · 绿植 · 阳光</figcaption>
          <div class="bs-quote"><p>算清楚，<br>是为了走得更远。</p></div>
        </figure>
      </div>
      <div class="bs-foot">
        ${net.transfers.length ? `<div class="bs-tl">最省事的结法</div>
          <div class="bs-trs">${net.transfers.map(t => `<span class="bs-tr">${av(t.from, 'sm')}<b>${mem(t.from).name}</b>${svg(I.arrow)}${av(t.to, 'sm')}<b>${mem(t.to).name}</b><em>${yuan(t.amount)}</em></span>`).join('')}</div>`
          : '<div class="bs-tl">当前没有需要转账的净额</div>'}
        ${net.deferred.length ? `<div class="bs-def">${svg(I.info)}${net.deferred.map(t => `${mem(t.from).name} → ${mem(t.to).name} ${yuan(t.amount)}`).join('，')} 不到 ¥10，自动滚入下月一起算，不用来回转。</div>` : ''}
      </div>
    </section>

    <aside class="bside">
      ${limited ? `<section class="btips"><span class="bti">${svg(I.info)}</span><div><b>已搬出，只剩结清</b>
        <p>你不再被加进新的公共费用，也不能再记账。把「待结算」的份额付掉、把别人欠你的收回来，账两清之后成员关系就正式结束了。</p></div></section>` : `<section class="bquick">
        <h3>快速操作</h3>
        <button class="btn pri big" data-act="newBill">${svg(I.plus)}记一笔新支出</button>
        <div class="bq-or">或者直接跟管家说</div>
        <div class="b2in"><input type="text" id="butlerIn" placeholder="比如：我买了 48 块的洗衣液，三个人平分" aria-label="跟管家说一句">
          <button data-act="butlerGo" aria-label="发送">${svg(I.arrow)}</button></div>
        <div class="b2q"><button data-act="butlerFill" data-text="我刚买了29块9的厕纸，12卷，三个人平分">${svg(I.box)}我买了公共用品</button></div>
      </section>
      <section class="btips">
        <span class="bti">${svg(I.info)}</span>
        <div><b>记账时可以只选参与的人</b>
          <p>阳台材料这种只有两个人用的，选两个人分就好；有人不在家的月份，水电燃气可以改成按登记在住天数分——房租、宽带这类固定成本和公共消耗品不按天数重算。月末只结净额，几十块不用来回转。</p></div>
      </section>`}
    </aside>
  </div>

  ${sec('账单记录', `${bills.length} 笔 · 每一笔都能看到谁记的、为什么这样分`)}
  <section class="blist">${bills.length ? bills.map(billRow).join('') : '<div class="empty">这个月还没有公共支出</div>'}</section>`;
}

/* ============================================================
   共识
   ============================================================ */
/* 共识页：共识是过程（表达差异 → 理解 → 找到大家都接受的方案），规则只是结果。
   新室友一来，系统就把偏好比对完：一致的收起、按需看；不同的直接进入"正在讨论"。
   每个人对当前方案表态（同意 / 不同意 / 再想想），随时可以改；议题不会因为谁点了一下就消失，
   需要的人都接受了，才写进"我们已经说好的"。所有议题、偏好、态度都来自 linDiff / topics / rules，页面不写死。 */
const TOPIC_ART = { overnight:'img/talk-overnight.jpg', temp:'img/talk-temp.jpg' };
const TOPIC_ART_LABEL = { overnight:'待补访客留宿场景图<br>卧室 · 暖光 · 绿植', temp:'待补空调温度场景图<br>空调 · 窗边 · 阳光' };
const PREF_ICON = { quiet:I.clock, visitor:I.guest, overnight:I.guest, kitchen:I.chore, supply:I.box, temp:I.home, smoke:I.shield, social:I.life };
const RULE_ICON = { '噪音':I.clock, '访客':I.guest, '物品':I.box, '清洁':I.chore, '其他':I.shield, '共识':I.talk };
const STANCE_PILL = { agree:'ok', disagree:'rose', undecided:'peach', stale:'warm', provided:'sky', none:'plain' };
const TALK_TIPS = [
  '从"我"出发，表达感受和需求，而不是指责',
  '倾听不同的想法，也许会有更合适的方案',
  '没有绝对正确的答案，找到大家都舒服的方式',
  '共识不是一次达成的，可以随时再讨论',
  '尊重彼此的生活习惯，是温暖的开始'
];
const I_X = '<path d="M6 6l12 12M18 6 6 18"/>';

/* 议题里"和我有关"的那一块：怎么看这个方案 → 三个态度 → 补充意见。卡片和详情页共用。
   Lin 在第 1 版不表态（方案本来就是按他的偏好拟的），方案改过之后才请他确认。 */
/* 议题里出现的人：在住成员 + 引出这个议题的新室友（还没转正时也在） */
const topicPeople = t => { const ids = living().map(m => m.id); if (t.subject && !ids.includes(t.subject) && membership(t.subject) === 'pending') ids.push(t.subject); return ids; };

function stanceBlock(t) {
  const isInc = t.subject === ME && membership(ME) === 'pending';
  const me = stanceOf(t, ME);
  const canAct = living().some(m => m.id === ME) || (isInc && t.version > 1);
  const note = t.positions[ME] ? t.positions[ME].note || '' : '';
  const noteOpen = UI.noteFor === t.id;
  const btn = (s, label, icon) => `<button class="btn sm ${me.k === s ? 'on ' + s : ''}" data-act="stance" data-s="${s}" data-id="${t.id}" aria-pressed="${me.k === s}">${svg(icon)}${label}</button>`;
  const ask = !canAct
    ? (isInc
        ? `<div class="tk-ask lin">${svg(I.info)}<span>这个方案是按你填的偏好和家里现有的约定拟的，不用再对自己的偏好表态；方案有调整时会请你确认。</span></div>`
        : `<div class="tk-ask lin">${svg(I.info)}<span>你入住后就能参与这件事的讨论。</span></div>`)
    : `${me.k === 'none' || me.k === 'provided' ? `<div class="tk-ask">${isInc ? '方案有了调整，你能接受吗？' : '你怎么看这个方案？'}</div>`
        : me.k === 'stale' ? `<div class="tk-ask stale">${svg(I.info)}<span>方案已调整到第 ${t.version} 版，请重新确认（上一版你选了「${{ agree:'同意', disagree:'不同意', undecided:'再想想' }[me.prev]}」）</span></div>` : ''}
      <div class="tk-acts">
        ${btn('agree', isInc ? '可以接受' : '同意', I.check)}${btn('disagree', '不同意', I_X)}${btn('undecided', '再想想', I.clock)}
      </div>`;
  const state = me.k === 'agree' ? `<span class="tk-state agree">${svg(I.check)}你的想法已记录，可随时修改。</span>`
    : me.k === 'disagree' ? `<span class="tk-state disagree">${svg(I_X)}已记录你不同意这个方案${note ? '' : '，可以说说你更希望怎么安排'}。</span>`
    : me.k === 'undecided' ? `<span class="tk-state undecided">${svg(I.clock)}没关系，想好以后随时回来改。</span>`
    : `<span class="tk-state">${topicSummary(t)}</span>`;
  const noteBox = noteOpen ? `
    <div class="tk-note">
      <label for="note-${t.id}">${me.k === 'disagree' ? '说说你更希望怎么安排？' : '想补充点什么？'}</label>
      <textarea id="note-${t.id}" rows="2" placeholder="比如：我觉得留宿还是最好限制次数，但特殊情况可以提前说。">${note}</textarea>
      <div class="btnrow"><button class="btn pri sm" data-act="noteSave" data-id="${t.id}">保存</button>
        <button class="btn sm" data-act="noteCancel" data-id="${t.id}">先不写</button></div>
    </div>` : '';
  const noteLink = (me.k !== 'none' && me.k !== 'stale') || isInc
    ? `<button class="lcgo" data-act="noteOpen" data-id="${t.id}">${note ? '修改意见' : '补充想法'}</button>` : '';
  return { ask, noteBox, state, noteLink, note: note && !noteOpen ? `<div class="tk-mynote"><b>你的补充</b>${note}</div>` : '' };
}

function vTalk() {
  if (!can('talk') && !can('talkOwn')) return vTalkLimited();
  if (S.sub) return TALK_VIEWS[S.sub]();
  /* 在住成员看全部议题；即将入住的只看由自己入住引出的那几项 */
  const inc = incomingMember(), d = linDiff(), open = visibleTopics(), held = can('talk') ? holdTopics() : [];
  const linOpen = open.filter(t => t.origin === 'lin'), linDone = S.topics.filter(t => t.origin === 'lin' && t.status === 'resolved');

  const artOf = k => TOPIC_ART[k]
    ? `<figure class="ph tk-art"><img src="${TOPIC_ART[k]}" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()"><figcaption>${TOPIC_ART_LABEL[k]}</figcaption></figure>`
    : '';
  const stack = ids => `<span class="tk-avs">${ids.map(id => av(id, 'sm')).join('')}</span>`;

  /* ---- 讨论中的议题：场景 → 现在家里 vs Lin 的偏好 → 当前方案 → 每个人的态度 → 我的表态 ---- */
  const topicCard = t => {
    const item = t.prefKey ? d.diff.find(x => x.k === t.prefKey) : null;
    const people = topicPeople(t);
    const reviser = t.version > 1 ? [...t.history].reverse().find(h => h.type === 'proposal') : null;
    const notes = people.map(id => ({ id, s: stanceOf(t, id) })).filter(x => x.s.note && x.id !== ME).slice(-2);
    const b = stanceBlock(t);
    return `
    <article class="tk-topic">
      ${artOf(t.prefKey)}
      <div class="tk-body">
        <div class="tk-th"><span class="tk-ic">${svg(PREF_ICON[t.prefKey] || I.talk)}</span><h3>${t.title}</h3>
          <span class="pill peach">${svg(I.clock)}讨论中</span></div>
        ${item && inc ? `<div class="tk-vals">
          <span>现在家里 <b>${item.house}</b></span>
          <span>${av(inc.id, 'sm')}${inc.name} 的偏好 <b>${item.lin}</b></span></div>` : ''}
        <div class="tk-say"><i>${svg(I.spark)}</i><span><b>${t.origin === 'lin' && t.version === 1 ? '管家建议' : '当前方案'}：</b>${t.proposal}
          ${reviser ? `<em>第 ${t.version} 版 · ${mem(reviser.who).name} 调整</em>` : ''}</span></div>
        <div class="tk-stances">${people.map(id => { const s = stanceOf(t, id);
          return `<span class="tk-st ${s.k}" title="${s.note ? s.note.replace(/"/g, '&quot;') : ''}">${av(id, 'sm')}${mem(id).name}${id === ME ? '（你）' : ''} · ${s.text}</span>`; }).join('')}</div>
        ${notes.length ? `<div class="tk-notes">${notes.map(x => `<div><b>${mem(x.id).name}</b>${x.s.note}</div>`).join('')}</div>` : ''}
        ${b.ask}
        ${b.noteBox}
        ${b.note}
        <div class="tk-foot">
          ${b.state}
          <span class="tk-links">${b.noteLink}<button class="lcgo" data-act="openTopic" data-id="${t.id}">讨论详情${svg(I.chev)}</button></span>
        </div>
      </div>
    </article>`;
  };

  /* ---- 已经说好的：轻量行；正被哪个议题讨论着的约定，标出来 ---- */
  const ruleRow = r => {
    const partial = r.by.length < living().length, talking = topicOnRule(r);
    return `<li class="tk-rule">
      <span class="tk-ri">${svg(RULE_ICON[r.cat] || I.check)}</span>
      <div class="tk-rt"><b>${r.title}</b><span>${r.desc}</span>
        ${r.history && r.history.length ? `<em>第 ${r.history.length + 1} 版 · 上一版：${r.history[r.history.length - 1].desc}</em>` : ''}</div>
      ${stack(r.by)}
      <span class="tk-rd">${r.since}</span>
      ${talking ? `<button class="pill warm" data-act="openTopic" data-id="${talking.id}">讨论中</button>`
        : `<span class="pill ${partial ? 'warn' : 'ok'}">${partial ? `${r.by.length}/${living().length} 已确认` : '已确认'}</span>`}
    </li>`;
  };

  /* ---- Hero：新室友入住 + 两个状态入口；"一致"的那块原地展开成小对比区 ---- */
  const hero = inc ? `
  <section class="thero ${UI.sameOpen ? 'open' : ''}">
    <div class="th-left">
      ${av(inc.id, 'xxl')}
      <div class="th-text">
        <h1>${inc.name} 将在 ${inc.joined} 入住 ${inc.room}</h1>
        <p>一个新的人要进来一起生活，只需要提前聊清楚真正会互相影响的事。</p>
        <div class="th-cmp">
          <button class="th-chip ok" data-act="toggleSame" aria-expanded="${UI.sameOpen}">${svg(I.check)}${d.same.length} 项和家里一致<i>·</i><span>${UI.sameOpen ? '收起' : '看对比'}${svg(I.chev)}</span></button>
          ${linOpen.length ? `<button class="th-chip talk" data-act="jumpTo" data-k="tk-discuss">${svg(I.talk)}${linOpen.length} 项正在讨论</button>` : ''}
          ${linDone.length ? `<span class="th-chip done">${svg(I.check)}${linDone.length} 项已经说好</span>` : ''}
        </div>
        ${UI.sameOpen ? `
        <div class="th-same">
          <div class="ts-h"><b>这些方面我们已经达成一致 🎉</b><button class="ts-close" data-act="toggleSame">收起${svg(I.chev)}</button></div>
          <ul class="ts-grid">${d.same.map(s => `<li><span class="ts-i">${svg(PREF_ICON[s.k] || I.check)}</span><span class="ts-k">${s.label}</span><b>${s.house}</b><i>${svg(I.check)}</i></li>`).join('')}</ul>
          <button class="lcgo" data-act="go" data-tab="talk" data-sub="lin">查看完整偏好对比${svg(I.chev)}</button>
        </div>` : ''}
      </div>
    </div>
    ${imgSlot('img/talk-hero.jpg', '待补入住场景图<br>入户门 · Welcome 地垫 · 纸箱 · 绿植 · 猫')}
  </section>` : head('共识', '约定不是管人的，是让大家不用反复开口。低频地把事情说清楚，高频的部分交给系统执行。');

  return `
  ${hero}
  <section class="tsec tk-discuss" id="tk-discuss">
    <div class="tk-h"><span class="tk-hi peach">${svg(I.talk)}</span>
      <div><h2>正在讨论</h2><p>只讨论真正会影响大家生活的事。把精力放在重要的事上，找到大家都舒服的方式。</p></div>
      <span class="tk-hc">${open.length ? `${open.length} 件` : ''}</span></div>
    ${open.length ? `<div class="tk-topics">${open.map(topicCard).join('')}</div>`
      : '<div class="tk-empty">现在没有需要讨论的事。有人提出新问题时会出现在这里。</div>'}
  </section>

  <div class="tgrid">
    <div class="tmain">
      <section class="tsec">
        <div class="tk-h"><span class="tk-hi sage">${svg(I.check)}</span>
          <div><h2>我们已经说好的</h2><p>这些是大家一起达成的，系统会帮忙记着，不用再反复开口。</p></div>
          <span class="tk-hc">共 ${S.rules.length} 条</span></div>
        <ul class="tk-rules">${S.rules.map(ruleRow).join('')}</ul>
      </section>

      ${held.length ? `<section class="tsec">
        <div class="tk-h"><span class="tk-hi plain">${svg(I.clock)}</span>
          <div><h2>暂不调整</h2><p>讨论过但没达成一致，原有约定保持不变，想起来还能再提。</p></div></div>
        <ul class="tk-rules held">${held.map(t => `<li class="tk-rule">
          <span class="tk-ri">${svg(I.talk)}</span>
          <div class="tk-rt"><b>${t.title}</b><span>${t.heldAt} 记录 · 原有约定未改动</span></div>
          <button class="btn sm" data-act="reopenTopic" data-id="${t.id}">重新提出</button></li>`).join('')}</ul>
      </section>` : ''}
    </div>

    <aside class="taside">
      <section class="tstart">
        ${can('talk') ? `<button class="btn pri big" data-act="awkward">${svg(I.talk)}发起讨论</button>
        <p>有件事不好开口？先说给管家听，管家帮你整理成一件能一起聊的事。</p>`
        : `<p style="margin-top:0"><b style="font-family:var(--f-d);color:var(--ink)">入住之后就能发起讨论</b><br>入住前你能看到的是和自己入住有关的讨论，以及大家已经说好的约定。</p>`}
        ${imgSlot('img/talk-start.jpg', '待补讨论氛围图<br>马克杯 · 植物 · 木桌 · 暖光')}
      </section>
      <section class="ttips">
        <div class="tt-h"><span class="tt-i"><img src="img/bill-idea.png" alt="" onerror="this.remove()"></span><b>共识小贴士</b></div>
        <ul>${TALK_TIPS.map(t => `<li>${svg(I.check)}<span>${t}</span></li>`).join('')}</ul>
      </section>
      <section class="tlinks">
        <button data-act="go" data-tab="talk" data-sub="onboard"><span class="tl-i">${svg(I.note)}</span><span><b>入住共识</b><em>住在一起之前先聊清楚的 12 个问题 · 你在 ${S.onboardDone[ME]} 填过</em></span>${svg(I.chev)}</button>
        ${can('issues') ? `<button data-act="go" data-tab="talk" data-sub="issue"><span class="tl-i">${svg(I.info)}</span><span><b>居住问题记录${visibleIssues().length ? ` · ${visibleIssues().length}` : ''}</b><em>只记录约定与登记情况的差距，不记录谁做错了什么</em></span>${svg(I.chev)}</button>` : ''}
        <button data-act="go" data-tab="me"><span class="tl-i">${svg(I.me)}</span><span><b>我的生活偏好</b><em>随时可以改，只影响还没形成约定的部分</em></span>${svg(I.chev)}</button>
      </section>
      ${imgSlot('img/talk-mood.jpg', '待补共识生活图<br>沙发 · 绿植 · 猫 · 阳光')}
    </aside>
  </div>

  <div class="tend"><i></i><p>${svg(I.life)}因为人与人的理解，平凡的日子也闪闪发光。</p><i></i></div>`;
}

/* 讨论详情：完整偏好、当前方案（可以调整）、每个人的意见、来龙去脉 */
function vTopic() {
  const t = topicById(S.topicId);
  if (!t) return `${backBtn('共识', 'talk')}<div class="card empty">这个议题不存在了</div>`;
  const inc = incomingMember();
  const people = topicPeople(t);
  const rule = S.rules.find(r => r.id === (t.ruleId || t.revisit)) || (t.prefKey && S.rules.find(r => r.prefKey === t.prefKey));
  const editing = UI.editFor === t.id, talking = t.status === 'discussion';
  const b = stanceBlock(t);
  const who = id => id === 'sys' ? '系统' : mem(id).name;
  const VERB = { agree:'接受了', disagree:'不同意', undecided:'还想再想想' };
  const hist = h => h.type === 'open' ? (h.text || '开始讨论')
    : h.type === 'stance' ? `${who(h.who)} ${VERB[h.stance]}第 ${h.version} 版方案`
    : h.type === 'note' ? (h.text ? `${who(h.who)} 补充：${h.text}` : `${who(h.who)} 清空了补充意见`)
    : h.type === 'proposal' ? `${who(h.who)} 把方案调整为第 ${h.version} 版：${h.text}`
    : h.type === 'resolved' ? `需要的人都接受了第 ${h.version} 版方案，已写进共同约定`
    : h.type === 'hold' ? `${who(h.who)} 标记为暂不调整，原有约定保持不变`
    : h.type === 'reopen' ? `${who(h.who)} 重新打开了讨论` : '';

  return `
    ${backBtn('共识', 'talk')}
    ${head(`${t.title} · 讨论详情`, talking ? '完整偏好、每个人的意见和方案的每一次调整都在这里。表态随时可以改。'
      : t.status === 'resolved' ? '这件事已经达成一致，写进了「我们已经说好的」。' : '这件事暂不调整，原有约定保持不变，想起来还能再提。')}

    <div class="card pad tp-top">
      <div class="tp-th">
        <span class="pill ${talking ? 'peach' : t.status === 'resolved' ? 'ok' : 'plain'}">${talking ? '讨论中' : t.status === 'resolved' ? '已达成' : '暂不调整'}</span>
        <span class="tp-meta">第 ${t.version} 版方案${t.openedAt ? ` · ${t.openedAt} 开始讨论` : ''}${t.resolvedAt ? ` · ${t.resolvedAt} 达成` : ''}</span>
      </div>
      ${talking ? `${b.ask}${b.noteBox}${b.note}<div class="tk-foot">${b.state}<span class="tk-links">${b.noteLink}</span></div>` : ''}
    </div>

    ${t.prefKey ? `${sec('完整偏好', '每个人在入住共识里填的')}
    <div class="card pad">
      <div class="vals">${people.map(id => `<span class="val">${av(id, 'sm')}${mem(id).name} <b>${mem(id).prefs[t.prefKey] || '—'}</b></span>`).join('')}</div>
      <div class="notice" style="margin-top:10px">${svg(I.info)}<span>${rule
        ? `现有约定：${rule.title} —— ${rule.desc}${rule.history && rule.history.length ? `（第 ${rule.history.length + 1} 版）` : ''}`
        : '目前还没有相关约定，这次一起定下来。'}</span></div>
    </div>` : rule ? `${sec('涉及的约定')}
    <div class="card pad"><div class="notice">${svg(I.info)}<span>${rule.title} —— ${rule.desc}</span></div></div>` : ''}

    ${sec('当前方案', `第 ${t.version} 版`, talking && !editing ? `<button class="btn sm" data-act="proposalEdit" data-id="${t.id}">调整方案</button>` : '')}
    <div class="card pad">
      ${editing ? `
        <label for="prop-${t.id}">改成什么样，大家更能接受？</label>
        <textarea id="prop-${t.id}" rows="3">${t.proposal}</textarea>
        <div class="notice" style="margin-top:10px">${svg(I.info)}<span>方案改了就是新的一版：之前每个人的表态都要重新确认，也包括你自己的${t.subject && membership(t.subject) === 'pending' ? `；会一并请 ${mem(t.subject).name} 确认一次` : ''}。</span></div>
        <div class="btnrow" style="margin-top:11px"><button class="btn pri sm" data-act="proposalSave" data-id="${t.id}">保存为第 ${t.version + 1} 版</button>
          <button class="btn sm" data-act="proposalCancel" data-id="${t.id}">取消</button></div>`
      : `<p class="tp-prop">${t.proposal}</p>`}
    </div>

    ${sec('各成员意见', '只显示每个人当前有效的态度')}
    <div class="card rows">${people.map(id => { const s = stanceOf(t, id), p = t.positions[id];
      return `<div class="row"><div class="main"><div class="ttl">${av(id, 'sm')}${mem(id).name}${id === ME ? '（你）' : ''}
          <span class="pill ${STANCE_PILL[s.k]}">${s.text}</span></div>
        ${s.note ? `<div class="meta tp-quote">"${s.note}"</div>` : ''}
        ${p && p.at && s.k !== 'provided' ? `<div class="meta">${p.at}</div>` : ''}</div></div>`; }).join('')}</div>

    ${sec('讨论记录')}
    <div class="card rows">${[...t.history].reverse().map(h => `<div class="row"><div class="main"><div class="ttl">${hist(h)}</div>${h.at ? `<div class="meta">${h.at}</div>` : ''}</div></div>`).join('')}</div>

    ${talking ? `<div class="btnrow" style="margin-top:14px"><button class="btn sm" data-act="holdTopic" data-id="${t.id}">这次先不调整，保持原有约定</button></div>`
      : t.status === 'hold' ? `<div class="btnrow" style="margin-top:14px"><button class="btn sm" data-act="reopenTopic" data-id="${t.id}">重新提出</button></div>` : ''}`;
}

function vOnboard() {
  const r = consensusResult();
  return `
    ${backBtn('共识', 'talk')}
    ${head('入住共识', '住在一起之前，先把几件容易不好意思聊的事情说清楚。这里不算匹配度，只区分哪些已经一致、哪些值得聊聊。')}

    <div class="resgrp agree">
      <div class="gh">${svg(I.check)}你们已经很一致（${r.agree.length} 项）</div>
      <div class="gb">${r.agree.map(a => `
        <div class="ruleitem"><span class="rn">${svg(I.check)}</span>
        <div class="rb"><div class="rt">${a.label}</div><div class="rd">${a.value}</div></div></div>`).join('')}</div>
    </div>

    ${r.talk.length ? `
    <div class="resgrp talk">
      <div class="gh">${svg(I.info)}有 ${r.talk.length} 项各人偏好不同</div>
      <div class="gb">${r.talk.map(t => {
        /* 偏好不同不等于没说好：已经有约定的按约定来，正在讨论的去讨论里表态 */
        const rule = S.rules.find(x => x.prefKey === t.k), topic = openTopics().find(x => x.prefKey === t.k);
        return `
        <div class="diffrow">
          <div class="dt">${t.label}${rule ? '<span class="pill ok">已有约定</span>' : topic ? '<span class="pill peach">讨论中</span>' : ''}</div>
          <div class="vals">${t.vals.map(v => `<span class="val">${av(v.id, 'sm')}${mem(v.id).name} <b>${v.v}</b></span>`).join('')}</div>
          ${rule ? `<div class="rd" style="margin-top:8px;font-size:12.5px;color:var(--ink-2)">偏好虽然不同，但大家已经说好了：<b>${rule.title}</b>${rule.history && rule.history.length ? `（第 ${rule.history.length + 1} 版）` : ''}。想改的话去共识页重新讨论。</div>`
          : topic ? `<div class="suggest"><div class="sl">当前方案</div><p>${topic.proposal}</p>
            <div class="btnrow" style="margin-top:9px"><button class="btn pri sm" data-act="openTopic" data-id="${topic.id}">去讨论里表态</button></div></div>`
          : SUGGESTION[t.k] ? `<div class="suggest"><div class="sl">管家建议</div><p>${SUGGESTION[t.k]}</p>
            <div class="btnrow" style="margin-top:9px">
              <button class="btn pri sm" data-act="acceptSuggest" data-k="${t.k}">接受这个建议</button>
              <button class="btn sm" data-act="editSuggest" data-k="${t.k}">一起修改</button></div></div>` : ''}
        </div>`; }).join('')}</div>
    </div>` : ''}

    ${sec('谁填过', '每个人的答案都是本人填的')}
    <div class="card rows">${household().map(m => `
      <div class="row"><div class="main"><div class="ttl">${m.name}${m.id === ME ? '（你）' : ''}</div>
        <div class="meta">${S.onboardDone[m.id] ? S.onboardDone[m.id] + ' 本人完成' : '将在入住前完成'}</div></div>
      <div class="right">${av(m.id, 'lg')}</div>
      ${m.id === ME ? `<div class="cta"><button class="btn sm" data-act="editPrefs">修改我的偏好</button></div>` : ''}</div>`).join('')}</div>`;
}

function vLin() {
  const d = linDiff();
  const inc = d.lin;
  if (!inc) return `${backBtn('共识','talk')}<div class="card empty">当前没有即将入住的成员</div>`;
  return `
    ${backBtn('共识', 'talk')}
    ${head(`${inc.name} 即将入住`, '只展示和共同生活有关的部分。新成员加入后，只需要重新协商真正发生变化的地方。')}

    <div class="card pad" style="margin-bottom:12px">
      <div style="display:flex;gap:12px;align-items:center">${av(inc.id, 'xl')}
        <div><div style="font-family:var(--f-d);font-weight:600;font-size:17px">${inc.name}</div>
          <div style="font-size:13px;color:var(--ink-2)">${inc.joined} 入住 ${inc.room} · 这个家将从 ${living().length} 位成员变成 ${living().length + 1} 位</div></div></div>
      ${srcTag(inc.lease)}
    </div>

    <div class="card pad" style="margin-bottom:12px">
      <div style="font-size:11px;letter-spacing:.08em;color:var(--ink-3);font-weight:700;margin-bottom:7px">${inc.name} 本人填写的生活偏好</div>
      <div class="vals">
        ${['sleep','cook','pet','smoke','social'].map(k => `<span class="val" style="padding-left:10px">${PREF_KEYS.find(p => p.k === k).label} <b>${inc.prefs[k]}</b></span>`).join('')}
      </div>
      ${srcTag(inc.prefsSrc)}
    </div>

    <div class="resgrp agree">
      <div class="gh">${svg(I.check)}${d.same.length} 项与现在家里的情况一致</div>
      <div class="gb">${d.same.map(s => `<div class="ruleitem"><span class="rn">${svg(I.check)}</span>
        <div class="rb"><div class="rt">${s.label}</div><div class="rd">${s.house}</div></div></div>`).join('')}</div>
    </div>

    <div class="resgrp talk">
      <div class="gh">${svg(I.info)}${d.diff.length} 项存在差异</div>
      <div class="gb">${d.diff.map(t => `
        <div class="diffrow">
          <div class="dt">${t.label}${t.rule ? '<span class="pill warn">涉及现有约定</span>' : '<span class="pill plain">暂无相关约定</span>'}</div>
          <div class="vals">
            <span class="val" style="padding-left:10px">现在家里 <b>${t.house}</b></span>
            <span class="val">${av(inc.id, 'sm')}${inc.name} <b>${t.lin}</b></span>
          </div>
          ${t.rule ? `<div class="rd" style="margin-top:7px;font-size:12.5px;color:var(--ink-3)">现有约定：${t.rule.title}</div>` : ''}
          ${SUGGESTION[t.k] ? `<div class="suggest"><div class="sl">管家建议</div><p>${SUGGESTION[t.k]}</p></div>` : ''}
        </div>`).join('')}</div>
    </div>

    <div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>
      这份对比由系统计算：拿 ${inc.name} 填的偏好和现在家里的做法逐项比对。一致的 ${d.same.length} 项不需要再聊；
      不同的 ${d.diff.length} 项已经直接放进「正在讨论」，每个人都可以去表态，随时能改。</span></div>
    <button class="btn pri wide" data-act="go" data-tab="talk">回到正在讨论</button>`;
}

const LADDER = [
  { t:'系统中立提醒', d:'管家按约定提醒，不指向任何人' },
  { t:'私下提醒',     d:'只发给相关的人，其他人看不到' },
  { t:'重新明确约定', d:'多次出现，通常是理解不一致，而不是有人故意' },
  { t:'一起讨论',     d:'把标准定得更具体' },
  { t:'请管家协调',   d:'机构房源可以请管家出面，生成协调摘要' }
];
const FOLLOW = [
  { k:'self',    t:'仅自己留存',      d:'先记下来，不做任何动作' },
  { k:'remind',  t:'请管家私下提醒',  d:'不点名，只说明约定和登记情况' },
  { k:'discuss', t:'发起共同讨论',    d:'把问题放到「正在讨论」，不显示是谁提的' },
  { k:'steward', t:'提交管家协调',    d:'由这条记录生成协调摘要' }
];

function vIssue() {
  return `
    ${backBtn('共识', 'talk')}
    ${head('居住问题记录', '这里记录的是约定和登记情况之间的差距，不是谁做错了什么。没有违规次数，也没有排名。')}
    ${visibleIssues().map(it => {
      const rule = S.rules.find(r => r.id === it.rule);
      return `<div class="card pad" style="margin-bottom:12px">
        ${it.follow === 'self' ? `<div class="notice" style="margin-bottom:10px;background:var(--sage-soft);color:var(--sage-deep)">${svg(I.lock)}<span>仅自己留存：这条只有你能看到，不进入家里动态，也不会通知任何人。</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div><h3 style="font-size:16px">${it.title}</h3>
            <div style="font-size:13px;color:var(--ink-2);margin-top:3px">${it.window}，系统发出过 ${it.count} 次提醒</div></div>
          <span class="pill plain">${it.cat}</span></div>
        ${srcTag(it.src)}
        <div class="notice" style="margin-top:11px">${svg(I.info)}<span>${it.note}</span></div>
        ${rule ? `<div style="font-size:12.5px;color:var(--ink-3);margin-top:10px">对应约定：${rule.title} —— ${rule.desc}</div>` : ''}
        <div style="margin:14px 0 4px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);font-weight:700">当前处理到第 ${it.level} 级</div>
        <div class="ladder">${LADDER.map((l, i) => `
          <div class="lstep ${i + 1 === it.level ? 'on' : i + 1 < it.level ? 'past' : ''}">${l.t}<small>${l.d}</small></div>`).join('')}</div>
        ${it.follow ? `<div class="notice" style="margin-top:12px">${svg(I.check)}<span>已选择：${FOLLOW.find(f => f.k === it.follow).t}</span></div>`
          : `<div style="margin-top:13px;font-size:13px;font-weight:600;margin-bottom:8px">接下来怎么处理</div>
             <div class="opts">${FOLLOW.map(f => `
               <button class="opt" data-act="issueFollow" data-id="${it.id}" data-k="${f.k}">
                 <span><b style="font-family:var(--f-d)">${f.t}</b>
                 <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">${f.d}</span></span></button>`).join('')}</div>`}
        ${it.level >= 4 && it.follow !== 'self' ? `<div class="btnrow" style="margin-top:12px">
          <button class="btn sm" data-act="stewardBrief" data-id="${it.id}">生成协调摘要</button></div>` : ''}
      </div>`;
    }).join('') || '<div class="card empty">当前没有记录中的居住问题</div>'}

    <div class="safety" style="margin-top:14px">
      <h3>${svg(I.shield)}如果遇到的不是普通摩擦</h3>
      <p>威胁、暴力、骚扰、偷拍、强行进入私人空间——这类情况不建议只靠室友之间自行协商解决。</p>
      <div class="btnrow" style="margin-top:11px"><button class="btn danger" data-act="safety">进入安全处理</button></div>
    </div>`;
}

const TALK_VIEWS = { onboard:vOnboard, lin:vLin, issue:vIssue, topic:vTopic };

/* ============================================================
   我的
   ============================================================ */
/* 我的：我是谁 → 我怎么生活（个人偏好，不是共同约定）→ 我的空间 / 物品 → 我的责任 / 账单 →
   与我相关的房屋服务 → 搬出与退租。临时离家（登记离家计划）和正式搬出是两类事，分别放在顶部和底部。
   所有内容都来自现有数据：成员 / 偏好 / 分区 / 物品 / 任务 / 账单 / 报修，页面不写死。 */
const PREF_TILE_ICON = { quiet:I.clock, visitor:I.guest, overnight:I.guest, kitchen:I.chore, supply:I.box, temp:I.home, smoke:I.shield,
  social:I.life, sleep:I.clock, conflict:I.talk, cook:I.chore, pet:I.life };
const MOVE_STEP_ICON = { m1:I.bill, m2:I.box, m3:I.scale, m4:I.broom, m5:I.key, m6:I.chore };

function vMe() {
  if (!can('moveout')) return vMeLimited();
  if (S.sub === 'moveout') return vMoveout();
  const me = mem(ME), st = statusOf(ME), a = awayOf(ME);
  const org = HOUSE.org.split(' · ')[0];
  const myZones = [];
  S.spaces.forEach(sp => sp.zones.forEach(z => { if (z.o === ME) myZones.push({ sp, z }); }));
  const myThings = S.supplies.filter(s => s.owner === ME);
  const tasks = S.tasks.filter(t => t.who === ME);
  const myRepairs = S.repairs.filter(r => r.by === ME);
  const diff = myPrefDiff();
  const due = myDue();

  /* 偏好小卡：只展示"我怎么想"，家里现在怎么约定的去共识页看 */
  const tile = k => { const p = PREF_KEYS.find(x => x.k === k);
    return `<div class="mp-tile"><span class="mp-ti">${svg(PREF_TILE_ICON[k] || I.check)}</span><div><span>${p.label}</span><b>${me.prefs[k] || '还没填'}</b></div></div>`; };

  const thingRow = s => `<li class="thing">
    <figure class="ph thumb"><img src="${s.photo || ''}" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()"><figcaption>${svg(I.box)}</figcaption></figure>
    <div class="th-t"><b>${s.name}<span class="pill ${s.kind === 'lend' ? 'info' : 'plain'}">${s.kind === 'lend' ? '可借' : '私人'}</span></b>
      <span>${s.kind === 'lend' ? s.rule : (s.zone || '未标注位置')}</span>
      <em>${me.name} · ${s.src && s.src.at ? s.src.at + ' ' : ''}添加${s.src && s.src.edited ? ` · ${s.src.edited} 改过` : ''}</em></div>
    <div class="th-acts"><button class="btn sm" data-act="manageThing" data-id="${s.id}">管理</button><button class="btn sm ghost" data-act="delThing" data-id="${s.id}">删除</button></div>
  </li>`;

  const steps = defaultMoveout().items;

  return `
  <div class="mehead">
    <div class="phead"><h1>我的</h1><p>你在这个家里的状态、边界与责任。</p></div>
    ${imgSlot('img/mine-header-decor.png', '待补页面右上装饰图<br>绿植 · 手写字')}
  </div>

  <section class="card meid">
    ${av(ME, 'xxl')}
    <div class="meid-t">
      <b>${me.name}</b>
      <span class="meid-st"><i class="sdot ${st}"></i>${STATUS_TEXT[st]} · ${me.room}</span>
      <span class="meid-meta">${svg(I.info)}<span>${me.joined} 入住</span><i>|</i><span>租约信息来自${org}</span></span>
    </div>
    <div class="meid-act">
      <button class="btn pri" data-act="${a ? 'cancelAwayMe' : 'newAway'}">${svg(I.away)}${a ? '我提前回来了' : '登记离家计划'}</button>
      <small>${a ? `${a.from} — ${a.to} 登记离家中` : '临时外出 / 请假不在家'}</small>
    </div>
  </section>

  <section class="card mepref">
    <div class="mp-h">
      <span class="ms-i">${svg(I.me)}</span>
      <div class="mp-ht"><b>我的生活偏好</b><span>这些是你的<em>个人偏好</em>，不会自动修改共同约定。</span></div>
      <span class="mp-hint">${svg(I.info)}如果你的偏好与当前共同约定不同，系统会提醒你发起讨论。</span>
      <button class="btn" data-act="editPrefs">${svg(I.edit)}修改我的偏好</button>
    </div>
    <div class="mp-grid">
      ${KEY_PREFS.map(tile).join('')}
      <button class="mp-more" data-act="togglePrefs">${S.showAllPrefs ? '收起' : `查看全部 ${PREF_KEYS.length} 项`}${svg(S.showAllPrefs ? I.back : I.arrow)}</button>
    </div>
    ${S.showAllPrefs ? `<div class="mp-grid all">${PREF_KEYS.filter(p => !KEY_PREFS.includes(p.k)).map(p => tile(p.k)).join('')}</div>` : ''}
    ${diff.length ? `<div class="mp-diff">${svg(I.talk)}<span>你的偏好和当前共同约定有 ${diff.length} 项不同：${diff.map(d => `${d.label}（你 ${d.mine} · ${d.house.from === 'rule' ? '约定' : '家里'} ${d.house.v}）`).join('、')}。约定不会自动改变。</span>
      <button class="lcgo" data-act="go" data-tab="talk">去共识页聊聊${svg(I.chev)}</button></div>` : ''}
    <div class="mp-src">${svg(I.info)}${S.myPrefs[ME] ? `入住共识里由你本人填写，${S.onboardDone[ME]} 改过` : `${S.onboardDone[ME]} 由你本人在入住共识里填写`}</div>
  </section>

  <div class="megrid">
    <section class="card mesec">
      <div class="ms-h"><span class="ms-i">${svg(I.home)}</span><b>我的空间</b><span class="ms-sub">分区是大家一起定的，这里只能看和申请</span></div>
      <ul class="melist">
        <li><span class="ml-i">${svg(I.lock)}</span><div><b>${me.room}</b><span>私人房间 · 来自租约，由租房中介同步</span></div><span class="pill plain">私人</span></li>
        ${myZones.map(({ sp, z }) => `<li><span class="ml-i">${svg(I[sp.icon] || I.space)}</span>
          <div><b>${sp.name} ${z.n}</b><span>${z.pending ? '分区待其他成员确认' : '公共家具里分配给你的区域'}</span></div>
          <span class="pill ${z.pending ? 'warn' : 'ok'}">${z.pending ? '待确认' : '你的分区'}</span>
          ${z.pending ? '' : `<button class="lcgo" data-act="zoneSwap" data-id="${sp.id}">申请调整${svg(I.chev)}</button>`}</li>`).join('')}
      </ul>
    </section>

    <div class="mecol">
      <section class="card mesec">
        <div class="ms-h"><span class="ms-i">${svg(I.box)}</span><b>我的物品</b><button class="btn sm" data-act="newThing">${svg(I.plus)}添加物品</button></div>
        ${myThings.length ? `<ul class="things">${myThings.map(thingRow).join('')}</ul>`
          : '<div class="empty">还没有登记物品。不需要录入所有东西，只在需要说清楚归属或借用方式时添加。</div>'}
      </section>
      <section class="card mesec">
        <div class="ms-h"><span class="ms-i">${svg(I.chore)}</span><b>我的责任</b><span class="ms-sub">本周 ${tasks.length} 项</span></div>
        <ul class="melist tasks">${tasks.map(t => `<li class="${t.done ? 'dim' : ''}">
          <span class="ml-i">${svg(t.done ? I.check : I.chore)}</span>
          <div><b>${t.task}</b>${t.done && t.doneAt ? `<span>${t.doneAt} 标记完成</span>` : taskPaused(t) ? '<span>登记离家中，已暂缓，回来后再做</span>' : t.deferred ? `<span>${t.deferred}</span>` : ''}</div>
          <span class="pill ${t.done ? 'ok' : 'warn'}">${t.done ? '已完成' : t.due}</span>
          ${t.done ? '' : `<button class="btn pri sm" data-act="doneTask" data-id="${t.id}">${svg(I.check)}完成</button>`}</li>`).join('')
          || '<li><div><b>这周没有分配给你的任务</b></div></li>'}</ul>
      </section>
    </div>
  </div>

  <div class="megrid">
    <section class="card mesec">
      <div class="ms-h"><span class="ms-i">${svg(I.bill)}</span><b>我的账单</b></div>
      <div class="mebill">
        <div><b>待我支付</b><span>${due.map(b => b.title).join(' · ') || '没有待支付的费用'}</span></div>
        <em>${yuan(myDueTotal())}</em>
        <button class="btn" data-act="go" data-tab="bill">查看账单${svg(I.chev)}</button>
      </div>
    </section>

    <section class="card mesec">
      <div class="ms-h"><span class="ms-i">${svg(I.tool)}</span><b>与我相关的房屋服务</b><button class="lcgo" data-act="go" data-tab="life">查看全部服务${svg(I.arrow)}</button></div>
      <div class="mesvc">
        <div class="svc"><span class="svc-i">${svg(I.home)}</span><b>租赁机构</b><span>${HOUSE.org}</span><em>联系管家：${HOUSE.steward}</em></div>
        <div class="svc"><span class="svc-i">${svg(I.broom)}</span><b>下一次公区保洁</b><span>${HOUSE.clean.next}</span><em>${srcNote(HOUSE.clean.src)}</em></div>
        ${myRepairs.map(r => `<div class="svc"><span class="svc-i">${svg(I.tool)}</span><b>${r.desc}</b><span class="warm">${repairState(r).s}</span><em>${me.name} · ${r.timeline[0].at.split(' ')[0]} 提交</em></div>`).join('')}
      </div>
    </section>
  </div>

  <section class="card meout">
    <span class="mo-i">${svg(I.truck)}</span>
    <div class="mo-t">
      <div class="mo-h"><b>搬出与退租</b><span>当你确定不再继续居住时，可按清单逐步完成准备。</span></div>
      <div class="mo-chips">${steps.map(s => `<span>${svg(MOVE_STEP_ICON[s.id] || I.check)}${s.t}</span>`).join('')}<span class="more">…</span></div>
      <p class="mo-note">${svg(I.info)}完成清单后，还需等待租赁机构确认退租，你的成员身份才会正式结束。</p>
    </div>
    <button class="btn pri" data-act="go" data-tab="me" data-sub="moveout">${svg(I.arrow)}开始搬出准备</button>
  </section>`;
}

function vMoveout() {
  const mo = S.moveout || defaultMoveout();
  const done = mo.items.filter(i => i.done).length;
  const all = done === mo.items.length;
  const org = HOUSE.org.split(' · ')[0];

  return `
    ${backBtn('我的', 'me')}
    ${head('搬出与退租', '有人离开，也会有人搬进来，这个家不会被删除。共同约定、公共资产和空间分区都会留下来。')}
    <div class="notice" style="margin-bottom:12px">${svg(I.info)}<span>
      这是流程预览，你现在并没有在搬出。点击任意一项可以切换状态，看看整个交接是怎么走完的。</span></div>
    <div class="card pad" style="margin-bottom:12px">
      <div style="display:flex;gap:11px;align-items:center">${av(ME, 'lg')}
        <div style="flex:1"><div style="font-family:var(--f-d);font-weight:600;font-size:15.5px">如果你要搬出，需要完成这些准备</div>
          <div style="font-size:13px;color:var(--ink-2);margin-top:1px">清单完成 ${done}/${mo.items.length}</div></div>
        ${all ? '<span class="pill warn">等待机构确认退租</span>' : '<span class="pill plain">预览中</span>'}</div>
    </div>
    <div class="card rows" style="margin-bottom:12px">
      ${mo.items.map(i => `<div class="chk ${i.done ? 'on' : ''}" data-act="moveChk" data-id="${i.id}" role="button" tabindex="0">
        <span class="box">${svg(I.check, 2.6)}</span><span class="ct">${i.t}</span><span class="cm">${i.m}</span></div>`).join('')}
      <div class="chk final"><span class="box">${svg(I.clock, 2.2)}</span><span class="ct">与租赁机构确认退租</span><span class="cm">由${org}（${HOUSE.steward}）确认，App 不能代替</span></div>
    </div>
    ${all ? `<div class="btnrow" style="margin-bottom:12px"><button class="btn sm" data-act="confirmMoveout">（演示）模拟${org}确认退租</button></div>` : ''}
    <div class="card pad" style="border-color:var(--sage-line)">
      <b style="font-family:var(--f-d);font-size:15px">${all ? `准备已完成，正在等待${org}确认退租` : '完成清单，不等于已经退租'}</b>
      <p style="font-size:13.5px;color:var(--ink-2);margin-top:5px">
        ${all ? `清单里的事都做完了。${org}确认退租后，你的成员身份才会正式结束；在那之前你仍然是 ${HOUSE.name} 的成员。`
              : `这里的清单只是帮你把搬出准备做完整。租赁关系是否结束由${org}确认，App 不会自己宣布你已退租。`}
        你的房间和分区会空出来等下一位成员，其余成员的分区不受影响；历史账单、共同约定和公共资产都会留在这个家里。</p>
    </div>`;
}

/* ============================================================
   不是在住成员时各页的样子：pending 只看与自己入住有关的；已搬出待结清只剩账；ended 只剩自己的偏好
   ============================================================ */
const lockedCard = (title, text, links) => `<div class="card pad locked">
  <span class="ms-i">${svg(I.lock)}</span>
  <div><b>${title}</b><p>${text}</p>${links ? `<div class="btnrow" style="margin-top:10px">${links}</div>` : ''}</div></div>`;
const goBtn = (label, tab, sub, pri) => `<button class="btn ${pri ? 'pri' : ''} sm" data-act="go" data-tab="${tab}" ${sub ? `data-sub="${sub}"` : ''}>${label}</button>`;
const prefTiles = me => `<div class="mp-grid all" style="margin-top:0">${KEY_PREFS.map(k => { const p = PREF_KEYS.find(x => x.k === k);
  return `<div class="mp-tile"><span class="mp-ti">${svg(PREF_TILE_ICON[k] || I.check)}</span><div><span>${p.label}</span><b>${me.prefs[k] || '还没填'}</b></div></div>`; }).join('')}</div>`;

/* 即将入住的人：入住前需要确认的事、为他准备的分区、大家说好的约定 */
function pendingBlocks(me) {
  const mine = myPendingTopics(), d = linDiff(), pr = S.zoneProposal;
  const own = openTopics().filter(t => t.subject === me.id);
  return `
    <div class="card pad" style="margin-bottom:12px">
      <div class="ms-h"><span class="ms-i">${svg(I.talk)}</span><b>入住前需要你确认的事</b><span class="ms-sub">${mine.length ? `${mine.length} 项` : '暂时没有'}</span></div>
      ${mine.length ? `<ul class="melist">${mine.map(t => `<li><span class="ml-i">${svg(PREF_ICON[t.prefKey] || I.talk)}</span><div><b>${t.title}</b><span>方案调整到第 ${t.version} 版，请你确认能不能接受</span></div>${goBtn('去确认', 'talk', null, true)}</li>`).join('')}</ul>`
        : `<p style="font-size:13.5px;color:var(--ink-2);line-height:1.6">系统已经把你填的偏好和家里现在的做法比对过：${d.same.length} 项一致，${own.length} 项在大家的讨论里。这 ${own.length} 项的方案是按你的偏好拟的，不需要你再表态；方案有调整时会请你确认。</p>
           <div class="btnrow" style="margin-top:10px">${goBtn('看正在讨论的', 'talk')}${goBtn('入住共识', 'talk', 'onboard')}</div>`}
    </div>
    <div class="card pad" style="margin-bottom:12px">
      <div class="ms-h"><span class="ms-i">${svg(I.space)}</span><b>为你准备的公共空间</b><span class="pill ${pr.confirmed ? 'ok' : 'warn'}">${pr.confirmed ? '在住成员已确认' : '待在住成员确认'}</span></div>
      <div class="vals" style="margin-top:0">${pr.items.map(it => `<span class="val" style="padding-left:10px">${S.spaces.find(sp => sp.id === it.sp).name} <b>${it.n}</b></span>`).join('')}</div>
      <div class="srctag">${svg(I.info)}${me.joined}起生效，之前不占用任何公共空间</div>
    </div>`;
}

function vHomeLimited() {
  const me = mem(ME), ms = membership(ME);
  if (ms === 'pending') return `
    <section class="welcome">
      <div class="wl-text"><h1>你好，${me.name}</h1><p>${me.joined} 入住 ${me.room}，欢迎提前认识这个家。</p>
        <div class="wl-meta">${HOUSE.name} · 目前 ${memberCountText()}</div></div>
      ${imgSlot('img/home-welcome.jpg', '待补欢迎横幅氛围图<br>窗边阳光 · 绿植 · 桌椅')}
    </section>
    ${pendingBlocks(me)}
    ${lockedCard('入住之后才会向你开放的', '入住日之前的账单、值日任务、家里动态、其他成员的私人物品和过去的居住问题记录，都与你无关，也不会显示给你。从入住日起，新的公共费用和值日会默认把你算进去。', goBtn('我们已经说好的约定', 'talk') + goBtn('我的生活偏好', 'me'))}`;
  const open = openBills().filter(b => b.payer === ME || b.people.includes(ME));
  return `
    <section class="welcome">
      <div class="wl-text"><h1>${me.name}，${ms === 'ended' ? '你的成员关系已经结束' : '你已经搬出这个家'}</h1>
        <p>${ms === 'ended' ? '历史记录会留在这个家里，你的生活偏好仍然属于你。' : `租房中介已确认退租。${open.length ? `还有 ${open.length} 笔账单待结清，结清之后成员关系正式结束。` : '账已经两清，成员关系即将结束。'}`}</p>
        <div class="wl-meta">${HOUSE.name}</div></div>
      ${imgSlot('img/home-welcome.jpg', '待补欢迎横幅氛围图<br>窗边阳光 · 绿植 · 桌椅')}
    </section>
    ${lockedCard(ms === 'ended' ? '这个家的事务不再向你开放' : '搬出之后只剩账要算', ms === 'ended'
      ? '值日、访客、公共空间、共识和新的公共费用都不再和你有关。'
      : '你不会再被加进新的公共费用、值日或讨论，也不再占用公共空间；历史账单还能查看，该付的可以付，该收的可以收。',
      (ms === 'ended' ? '' : goBtn(`去结清（${open.length} 笔）`, 'bill', null, true)) + goBtn('搬出记录与退租状态', 'me'))}`;
}

function vLifeLimited() {
  const me = mem(ME), ms = membership(ME);
  return `${head('生活', ms === 'pending' ? '入住之后，值日、访客、洗衣机和公共物品都会向你开放。' : '你已经搬出，生活模块不再向你开放。')}
    ${ms === 'pending' ? pendingBlocks(me) + `<div class="btnrow" style="margin-bottom:12px">${goBtn('看看公共空间是怎么分的', 'life', 'space')}</div>` : ''}
    ${lockedCard(ms === 'pending' ? '入住前不显示的内容' : '不再参与的内容', ms === 'pending'
      ? '入住日之前的值日安排、访客登记、洗衣机使用和家里动态是现有成员之间的事，不会显示给你。'
      : '值日、访客、洗衣机、公共物品和公共空间都已经与你无关；如果还有账要结，去账单页处理。',
      ms === 'pending' ? '' : goBtn('去账单页', 'bill'))}`;
}

function vBillLimited() {
  const me = mem(ME), ms = membership(ME);
  return `${head('账单', ms === 'pending' ? `入住日之前的账单与你无关。` : '这个家的账已经和你无关。')}
    ${lockedCard(ms === 'pending' ? `${me.joined}起才会把你算进公共费用` : '账已两清',
      ms === 'pending' ? '入住日前发生的水电、消耗品、维修等费用由现有成员承担，你不会看到明细，也不会被要求分摊。从入住日起，新的公共费用默认把你算进参与人。'
        : '你的成员关系已经结束，历史账单留在这个家里。')}`;
}

function vTalkLimited() {
  const ms = membership(ME);
  return `${head('共识', ms === 'ended' ? '你的成员关系已经结束。' : '你已经搬出，不再参与新的讨论。')}
    ${lockedCard('共识不再向你开放', '正在讨论的议题、表态和发起讨论都是在住成员之间的事。' + (can('rules') ? ' 你还能看到这个家现在说好的约定。' : ''))}
    ${can('rules') ? `${sec('我们已经说好的', `${S.rules.length} 条`)}<div class="card rows">${S.rules.map(r => `<div class="row"><div class="main"><div class="ttl">${r.title}</div><div class="meta">${r.desc}</div></div></div>`).join('')}</div>` : ''}`;
}

function vMeLimited() {
  const me = mem(ME), ms = membership(ME), org = HOUSE.org.split(' · ')[0];
  const open = openBills().filter(b => b.payer === ME || b.people.includes(ME));
  const rec = S.moveoutRecord && S.moveoutRecord.who === ME ? S.moveoutRecord : null;
  const identity = `
    <section class="card meid">
      ${av(ME, 'xxl')}
      <div class="meid-t"><b>${me.name}</b>
        <span class="meid-st"><i class="sdot ${statusOf(ME)}"></i>${MEMBERSHIP_TEXT[ms]} · ${me.room}</span>
        <span class="meid-meta">${svg(I.info)}<span>${ms === 'pending' ? `${me.joined} 入住` : `${me.joined} 入住${rec ? ` · ${rec.at} 退租确认` : ''}`}</span><i>|</i><span>租约信息来自${org}</span></span></div>
    </section>`;
  const prefs = `
    <section class="card mepref">
      <div class="mp-h"><span class="ms-i">${svg(I.me)}</span>
        <div class="mp-ht"><b>我的生活偏好</b><span>这些是你的<em>个人偏好</em>，跟着你走，换到下一个家也能继续用。</span></div>
        <button class="btn" data-act="editPrefs">${svg(I.edit)}修改我的偏好</button></div>
      ${prefTiles(me)}
      <div class="mp-src">${svg(I.info)}${S.onboardDone[ME]} 由你本人在入住共识里填写</div>
    </section>`;
  if (ms === 'pending') return `
    <div class="mehead"><div class="phead"><h1>我的</h1><p>入住前，先看看为你准备好的东西。</p></div>${imgSlot('img/mine-header-decor.png', '待补页面右上装饰图<br>绿植 · 手写字')}</div>
    ${identity}${prefs}${pendingBlocks(me)}
    ${lockedCard('入住之后才会出现的', '我的物品、我的责任、我的账单、与我相关的房屋服务，以及搬出与退租，都从入住日开始。')}`;
  return `
    <div class="mehead"><div class="phead"><h1>我的</h1><p>${ms === 'ended' ? '成员关系已经结束，这里只留下属于你的东西。' : '搬出之后，把账结清就好。'}</p></div>${imgSlot('img/mine-header-decor.png', '待补页面右上装饰图<br>绿植 · 手写字')}</div>
    ${identity}
    <section class="card mesec" style="margin-bottom:16px">
      <div class="ms-h"><span class="ms-i">${svg(I.truck)}</span><b>搬出记录与退租状态</b><span class="pill ${ms === 'ended' ? 'ok' : 'warn'}">${ms === 'ended' ? '成员关系已结束' : '待结清'}</span></div>
      <ul class="melist">
        <li><span class="ml-i">${svg(I.check)}</span><div><b>搬出准备清单</b><span>账单、物品、公共资产、空间清理、钥匙、值日退出——已完成</span></div></li>
        <li><span class="ml-i">${svg(I.check)}</span><div><b>${org}确认退租</b><span>${rec ? rec.at : '已确认'} · 此后不再参与家里的事务，分区已空出</span></div></li>
        <li><span class="ml-i">${svg(ms === 'ended' ? I.check : I.clock)}</span><div><b>历史账务结清</b><span>${ms === 'ended' ? '已全部结清，成员关系于此结束' : `还有 ${open.length} 笔和你有关的账单未结清`}</span></div>
          ${ms === 'ended' ? '' : goBtn('去处理', 'bill', null, true)}</li>
      </ul>
      ${ms === 'ended' ? '' : `<ul class="melist" style="margin-top:8px">${open.map(b => `<li><span class="ml-i">${svg(I.bill)}</span><div><b>${b.title}</b><span>${b.payer === ME ? `你垫付，应收 ${yuan(b.amount - shareOf(b, ME))}` : `${mem(b.payer).name} 垫付，你的份额 ${yuan(shareOf(b, ME))}`}</span></div><button class="btn sm pri" data-act="settle" data-id="${b.id}">${svg(I.check)}标记结清</button></li>`).join('')}</ul>`}
      <div class="btnrow" style="margin-top:12px"><button class="btn sm" data-act="undoMoveout">（演示）恢复为在住成员</button></div>
    </section>
    ${prefs}`;
}

const VIEWS = { home:vHome, life:vLife, bill:vBill, talk:vTalk, me:vMe };
