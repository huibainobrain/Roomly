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
    ${done ? `<div class="srctag">${svg(I.check)}${mem(r.by).name} 于 ${r.resolvedAt} 回应</div>`
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
  /* ---- 业务数据与原来完全一致 ---- */
  const watch = [];
  if (lowSupplies().length) watch.push('公共物品库存');
  const revisit = rulesToRevisit();
  if (revisit.length) watch.push('新室友约定确认');
  const calm = watch.length === 0;
  const awayN = awayMembers().length;
  const me = mem(ME);

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

  if (revisit.length) todos.push(`<div class="tcard c"><span class="tic">${svg(I.talk)}</span>
      <div><div class="tt">${incomingMember().name} 入住前有 ${revisit.length} 件事待确认</div>
      <div class="ts">${revisit.map(r => r.rule.title).join(' · ')}</div></div>
      <div class="tb"><button class="btn pri sm" data-act="go" data-tab="talk" data-sub="lin">去查看</button></div></div>`);

  const low = lowSupplies()[0];
  if (low && todos.length < 4) todos.push(`<div class="tcard c"><span class="tic">${svg(I.box)}</span>
      <div><div class="tt">${low.name}${low.mode === 'count' ? `只剩 ${low.qty} ${low.unit}` : low.state}</div>
      <div class="ts">${srcNote(low.src)}更新</div></div>
      <div class="tb"><button class="btn pri sm" data-act="restock" data-id="${low.id}">去补充</button></div></div>`);

  /* ---- 成员一行 ---- */
  const people = MEMBERS.filter(m => !S.movedOut.includes(m.id)).map(m => {
    const st = statusOf(m.id), a = awayOf(m.id);
    const tail = st === 'away' ? `${a.to} 回` : st === 'incoming' ? `${m.joined} 入住` : STATUS_TEXT[st];
    return `<div class="person ${m.me ? 'me' : ''}">
      ${av(m.id, 'xxl' + (st === 'in' ? '' : ' out'))}
      <div class="pn">${m.name}${m.me ? '·你' : ''}</div>
      <div class="pr">${m.room}</div>
      <div class="pst"><i class="sdot ${st}"></i>${tail}</div></div>`;
  }).join('');

  return `
  <section class="welcome">
    <div class="wl-text">
      <h1>${greet()}，${me.name}</h1>
      <p>新的一天，从一个整洁、温暖的家开始。</p>
      <div class="wl-meta">${HOUSE.name} · 和室友一起住的第 ${daysTogether()} 天</div>
    </div>
    ${imgSlot('img/home-welcome.jpg', '待补欢迎横幅氛围图<br>窗边阳光 · 绿植 · 桌椅')}
  </section>

  <div class="hgrid">
    <section class="place">
      <div class="ptop"><h2>${HOUSE.name}</h2></div>
      <div class="pmeta">
        <span>${svg(I.me)}${living().length} 位成员${awayN ? ` · ${awayN} 位登记离家` : ''}</span>
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
          <span>${svg(I.talk)}${revisit.length} 条约定待确认</span>
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
        <span class="stx">${f.who === 'sys' ? '<b>合租管家</b> ' : `<b>${mem(f.who).name}</b> `}${f.text}
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
  if (rp) next.push({ tone:'peach', title:rp.desc, sub:`${repairState(rp).s} · 相寓` });
  next.push({ tone:'sage', title:'公区保洁', sub:`${HOUSE.clean.next} · 相寓排期` });
  /* 负责人登记离家中的任务已暂缓，不算"会发生的事"，留在值日页里 */
  S.tasks.filter(t => !t.done && !taskPaused(t) && !['今天', TOMORROW.wd].includes(t.due)).forEach(t => next.push({
    task:t, title:t.task, sub:`${t.due} · ${mem(t.who).name} 负责` }));
  away.forEach(a => next.push({ tone:'sage', title:`${mem(a.who).name} 回来`, sub:`${a.to} · 本人登记` }));
  if (inc) next.push({ tone:'peach', title:`${inc.name} 入住 ${inc.room}`, sub:`${inc.joined} · 相寓同步` });

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
      <div class="agmt"><p>好的日子，是大家一起过出来的。</p>
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
        return `<li><span>${sp.name}</span><b>${z ? '你的 · ' + z.n : '公共'}</b></li>`; }).join('')}</ul>
      ${S.zoneProposal.confirmed ? '' : `<div class="lcnote warm">${mem(S.zoneProposal.who).name} 的分区待确认</div>`}
      <footer>${go('space', '查看分区')}</footer>
    </article>

    <article class="lc cream">
      <header><span class="lci">${svg(I.away)}</span><h3>在住 / 离家</h3></header>
      <div class="lcsub">${living().length - away.length} 人在住 · ${away.length} 人登记离家${inc ? ` · ${inc.name} ${inc.joined} 入住` : ''}</div>
      <div class="lpeople">${MEMBERS.filter(m => !S.movedOut.includes(m.id)).map(m => {
        const st = statusOf(m.id), a = awayOf(m.id);
        return `<div class="lp ${st}">${av(m.id, 'xl' + (st === 'in' ? '' : ' out'))}
          <b>${m.name}${m.me ? '·你' : ''}</b><span>${st === 'away' ? a.to + ' 回' : st === 'incoming' ? m.joined + ' 入住' : STATUS_TEXT[st]}</span></div>`; }).join('')}</div>
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
    <div class="lbt"><p>生活不只是住在一起，更是和不同的人，一起把日子过舒服。</p>
      <button class="btn" data-act="awkward">有件事不好开口</button></div>
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
             <button class="btn sm" data-act="deferTask" data-id="${t.id}">今天做不了</button>`
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
          ? `<button class="btn sm" data-act="shareMode" data-id="${s.id}">共享方式</button>
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
        <button class="btn sm" data-act="shareMode" data-id="${s.id}">共享方式</button>
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

    ${inc && !pr.confirmed ? `
    <div class="live" style="margin-bottom:14px">
      <div class="lv-top">${av(inc.id, 'lg')}
        <div style="flex:1"><b>${inc.name} 即将入住 ${inc.room}，还没有分配公共空间</b>
          <span>管家按"一人一块 + 保留公共区"给出了建议，确认后才会出现在下面的分区里</span></div>
        <span class="pill warn">待确认</span></div>
      <div class="lv-body">${pr.items.map(it => `<span class="val" style="padding-left:10px">
        ${S.spaces.find(sp => sp.id === it.sp).name} <b>${it.n}</b></span>`).join('')}</div>
      <div class="btnrow"><button class="btn pri sm" data-act="confirmZones">确认分配</button></div>
    </div>` : ''}

    <div class="spgrid">${S.spaces.map(sp => `
      <div class="card space">
        <h3>${svg(I[sp.icon])}${sp.name}</h3>
        <div class="zones">${sp.zones.map(zoneRow).join('')}</div>
        ${srcTag(sp.src)}
      </div>`).join('')}</div>

    <div class="btnrow" style="margin-top:14px">
      <button class="btn sm" data-act="redivide">重新划分公共空间</button>
    </div>`;
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
        ${week.filter(v => v.overnight).map(v => `<div class="calcline">
          <span class="cl">${av(v.host, 'sm')}${v.date} 留宿登记</span><span class="cv">1 晚</span></div>`).join('')}
        <div class="calcline"><span class="cl"><b>本周合计</b></span>
          <span class="cv" style="color:${o.exceeded ? 'var(--amber)' : 'var(--jade)'}">${o.actual} 晚 / 约定 ${o.limit} 晚</span></div>
      </div>
      ${srcTag({ via:'derived', note:`由上面 ${week.filter(v => v.overnight).length} 条留宿登记累计得出，系统不核实实际住宿情况` })}
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
        <div class="ttl">${m.name}${m.me ? '（你）' : ''}
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

    ${sec('房屋服务', '由相寓提供，住户不手动维护', `<button class="btn pri sm" data-act="newRepair">${svg(I.plus)}我要报修</button>`)}
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
            <span class="tlvia">${x.via === 'platform' ? '相寓' : '住户'}</span></div>`).join('')}</div>
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

function vBill() {
  const net = netSettlement();
  const away = awayMembers();
  const fd = fairByDays();

  const billRow = b => `
    <div class="row ${b.settled ? 'dim' : ''}">
      <div class="main">
        <div class="ttl">${b.title}
          <span class="pill ${b.settled ? 'ok' : 'warn'}">${b.settled ? '已结清' : '待结算'}</span>
          ${b.method !== 'even' ? `<span class="pill info">${METHOD_TEXT[b.method]}</span>` : ''}
          ${b.people.length < living().length ? '<span class="pill plain">部分成员</span>' : ''}
        </div>
        <div class="meta">${b.note ? b.note + ' · ' : ''}${b.date} · ${mem(b.payer).name} 垫付</div>
        <div class="split">${b.people.map(p => `<span class="chip">${av(p, 'sm')}${yuan(shareOf(b, p))}</span>`).join('')}</div>
        ${b.src ? srcTag({ via:'member', by:b.src.by, at:b.src.at }) + `<span class="srctag">${BILL_SRC[b.src.via]}</span>` : ''}
      </div>
      <div class="right"><div class="amt">${yuan(b.amount)}</div>
        <div class="per">${b.people.length} 人 · ${METHOD_TEXT[b.method]}</div></div>
      <div class="cta">
        <button class="btn sm" data-act="editBill" data-id="${b.id}">修改</button>
        ${b.settled
        ? `<button class="btn sm" data-act="unsettle" data-id="${b.id}">撤销结清</button>`
        : `<button class="btn sm pri" data-act="settle" data-id="${b.id}">${svg(I.check)}标记结清</button>`}</div>
    </div>`;

  return `
    ${head('账单', '每一笔都能解释清楚为什么这样算、是谁记的。月末只结净额，不为了几十块钱来回转账。')}

    ${away.length && !S.fairApplied ? `
    <div class="fair" style="margin-bottom:14px">
      <div class="fh">${svg(I.scale)}一个可能影响公平的情况</div>
      <p>${away.map(a => `${mem(a.who).name} 登记了 ${a.days} 天离家（${a.from} — ${a.to}）`).join('；')}。
         ${S.utilityForecast.title}（预计 ${yuan(S.utilityForecast.amount)}）如果仍按三人平均，可能和大家的使用情况有出入。</p>
      <div class="calcbox">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700;margin-bottom:4px">按登记在住天数计算</div>
        ${fd.rows.map(r => `<div class="calcline">
          <span class="cl">${av(r.id, 'sm')}${mem(r.id).name}<span class="cd">${r.days} 天${r.off ? ` · 登记离家 ${r.off} 天` : ''}</span></span>
          <span class="cv">${yuan(r.amount)}</span></div>`).join('')}
      </div>
      ${srcTag({ via:'derived', note:'根据成员登记的离家时间计算，系统不掌握真实居住情况' })}
      <div class="btnrow" style="margin-top:11px">
        <button class="btn pri sm" data-act="applyFair">采用这个方案</button>
        <button class="btn sm" data-act="keepEven">仍按平均分摊</button>
      </div>
      <p style="font-size:12px;color:var(--ink-3);margin-top:9px">这只是一个建议。分摊方式需要你们自己决定，系统不会替你们改。</p>
    </div>` : ''}

    ${S.fairApplied ? `<div class="notice" style="margin-bottom:14px">${svg(I.check)}<span>${S.utilityForecast.title}已按登记在住天数计算，并加入下方账单。其他费用维持原有方式。</span></div>` : ''}

    ${sec('我的账目')}
    <div class="card pad" style="margin-bottom:4px">
      <div class="calcline"><span class="cl">待我支付</span><span class="cv">${yuan(myDueTotal())}</span></div>
      <div class="calcline"><span class="cl">本月共同支出</span><span class="cv">${yuan(monthTotal())}</span></div>
      <div class="calcline"><span class="cl">未结清笔数</span><span class="cv">${openBills().length} 笔</span></div>
    </div>

    ${sec('月末净额结算', '由未结清账单自动抵消')}
    <div class="card rows">
      ${net.transfers.length ? net.transfers.map(t => `
        <div class="netrow"><span class="arrow">${av(t.from)}<b>${mem(t.from).name}</b>${svg(I.arrow)}${av(t.to)}<b>${mem(t.to).name}</b></span>
          <span class="amt">${yuan(t.amount)}</span></div>`).join('')
        : '<div class="empty">当前没有需要结算的净额</div>'}
    </div>
    ${net.deferred.length ? `<div class="notice" style="margin-top:10px">${svg(I.info)}<span>
      ${net.deferred.map(t => `${mem(t.from).name} → ${mem(t.to).name} ${yuan(t.amount)}`).join('，')}
      金额低于 ¥10，已自动滚入下月抵消。</span></div>` : ''}

    ${sec('费用记录', '', `<button class="btn pri sm" data-act="newBill">${svg(I.plus)}记一笔</button>`)}
    <div class="card rows">${S.bills.map(billRow).join('')}</div>`;
}

/* ============================================================
   共识
   ============================================================ */
function vTalk() {
  if (S.sub) return TALK_VIEWS[S.sub]();
  const revisit = rulesToRevisit();
  const inc = incomingMember();
  const open = openTopics();
  const d = linDiff();
  const liveCount = open.length + (inc && revisit.length ? 1 : 0);

  return `
    ${head('共识', '约定不是管人的，是让大家不用反复开口。低频地把事情说清楚，高频的部分交给系统执行。')}

    ${sec('正在讨论', liveCount ? `${liveCount} 项待你参与` : '暂时没有需要讨论的事')}

    ${inc && revisit.length ? `
    <div class="live">
      <div class="lv-top">${av(inc.id, 'lg')}
        <div style="flex:1"><b>${inc.name} 将在 ${inc.joined} 入住 ${inc.room}</b>
          <span>和现在家里的情况比较：${d.same.length} 项一致，${d.diff.length} 项存在差异</span></div>
        <span class="pill warn">待讨论</span></div>
      <div class="lv-body">${d.diff.map(x => `<span class="val" style="padding-left:10px">${x.label} <b>${x.lin}</b></span>`).join('')}</div>
      <div class="btnrow"><button class="btn pri sm" data-act="go" data-tab="talk" data-sub="lin">只讨论这 ${d.diff.length} 件事</button></div>
    </div>` : ''}

    ${open.map(t => `
    <div class="live">
      <div class="lv-top"><span class="lv-ic">${svg(I.talk)}</span>
        <div style="flex:1"><b>${t.title}</b><span>${t.detail}</span></div>
        <span class="pill warn">${Object.keys(t.votes || {}).length}/${living().length} 已表态</span></div>
      <div class="lv-body">${living().map(m => t.votes && t.votes[m.id]
        ? `<span class="chip">${av(m.id,'sm')}${t.votes[m.id]}</span>`
        : `<span class="chip" style="opacity:.45">${av(m.id,'sm')}未表态</span>`).join('')}</div>
      <div class="btnrow">
        ${t.votes && t.votes[ME] ? '' : `
        <button class="btn pri sm" data-act="agreeTopic" data-id="${t.id}">同意</button>
        <button class="btn sm" data-act="discussTopic" data-id="${t.id}">想讨论一下</button>`}
        <button class="btn sm" data-act="holdTopic" data-id="${t.id}">暂不调整</button>
      </div>
    </div>`).join('')}

    ${!liveCount ? '<div class="card empty">目前没有待讨论的事。有人提出新问题时会出现在这里。</div>' : ''}

    ${sec('我们已经说好的', `${S.rules.length} 条 · 全员确认后生效`)}
    <div class="agreed">${S.rules.map((r, i) => `
      <div class="ruleitem">
        <span class="rn">${i + 1}</span>
        <div class="rb"><div class="rt">${r.title}
          ${r.by.length < living().length ? `<span class="pill warn">${r.by.length}/${living().length} 已确认</span>` : ''}
          ${revisit.some(v => v.rule.id === r.id) ? '<span class="pill warn">新室友入住后要重新确认</span>' : ''}</div>
          <div class="rd">${r.desc}</div>
          <div class="rd" style="color:var(--ink-4)">${r.cat} · 全员确认于 ${r.since}${r.history && r.history.length ? ` · 第 ${r.history.length + 1} 版` : ''}</div>
          ${r.history && r.history.length ? `<div class="srctag">${svg(I.info)}上一版：${r.history[r.history.length - 1].desc}</div>` : ''}</div>
      </div>`).join('')}</div>

    ${holdTopics().length ? `${sec('暂不调整', '讨论过但没达成一致，原有约定保持不变')}
    <div class="card rows">${holdTopics().map(t => `
      <div class="row dim"><div class="main"><div class="ttl">${t.title}<span class="pill plain">暂不调整</span></div>
        <div class="meta">${t.heldAt} 记录 · 原有约定未改动</div></div>
      <div class="cta"><button class="btn sm" data-act="reopenTopic" data-id="${t.id}">重新提出</button></div></div>`).join('')}</div>` : ''}

    ${sec('其他')}
    <div class="mods">
      <button class="mod" data-act="awkward">
        <span class="mi">${svg(I.talk)}</span><span><span class="mn">有件事不好开口</span>
        <span class="ms">把说不出口的情绪，整理成一件能讨论的事。</span></span></button>
      <button class="mod" data-act="go" data-tab="talk" data-sub="onboard">
        <span class="mi">${svg(I.note)}</span><span><span class="mn">入住共识</span>
        <span class="ms">住在一起之前先聊清楚的 12 个问题。你在 ${S.onboardDone[ME]} 填过一次。</span></span></button>
      <button class="mod" data-act="go" data-tab="talk" data-sub="issue">
        <span class="mi">${svg(I.info)}</span><span><span class="mn">居住问题记录${S.issues.length ? `<span class="flag">${S.issues.length}</span>` : ''}</span>
        <span class="ms">只记录约定与登记情况的差距，不记录谁做错了什么。</span></span></button>
      <button class="mod" data-act="go" data-tab="me">
        <span class="mi">${svg(I.me)}</span><span><span class="mn">我的生活偏好</span>
        <span class="ms">随时可以修改，改动只会影响还没形成约定的部分。</span></span></button>
    </div>`;
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
      <div class="gh">${svg(I.info)}有 ${r.talk.length} 件事值得提前聊聊</div>
      <div class="gb">${r.talk.map(t => `
        <div class="diffrow">
          <div class="dt">${t.label}</div>
          <div class="vals">${t.vals.map(v => `<span class="val">${av(v.id, 'sm')}${mem(v.id).name} <b>${v.v}</b></span>`).join('')}</div>
          ${SUGGESTION[t.k] ? `<div class="suggest"><div class="sl">管家建议</div><p>${SUGGESTION[t.k]}</p>
            <div class="btnrow" style="margin-top:9px">
              <button class="btn pri sm" data-act="acceptSuggest" data-k="${t.k}">接受这个建议</button>
              <button class="btn sm" data-act="editSuggest" data-k="${t.k}">一起修改</button></div></div>` : ''}
        </div>`).join('')}</div>
    </div>` : ''}

    ${sec('谁填过', '每个人的答案都是本人填的')}
    <div class="card rows">${MEMBERS.filter(m => !S.movedOut.includes(m.id)).map(m => `
      <div class="row"><div class="main"><div class="ttl">${m.name}${m.me ? '（你）' : ''}</div>
        <div class="meta">${S.onboardDone[m.id] ? S.onboardDone[m.id] + ' 本人完成' : '将在入住前完成'}</div></div>
      <div class="right">${av(m.id, 'lg')}</div>
      ${m.me ? `<div class="cta"><button class="btn sm" data-act="startQuiz">重新填写</button></div>` : ''}</div>`).join('')}</div>`;
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
      <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700;margin-bottom:7px">${inc.name} 本人填写的生活偏好</div>
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
      这份对比由系统计算：拿 ${inc.name} 填的偏好和现在家里的做法逐项比对，其余 ${d.same.length} 项保持不变，不需要全员重新确认一遍。</span></div>

    ${S.linDiscussed
      ? `<div class="card pad" style="border-color:var(--jade-line)"><b style="font-family:var(--f-d)">已发起讨论</b>
         <p style="font-size:13.5px;color:var(--ink-2);margin-top:4px">这 ${d.diff.length} 项已进入「正在讨论」，全员表态后会更新为共同约定。</p></div>`
      : `<button class="btn pri wide" data-act="discussLin">只讨论这 ${d.diff.length} 件事</button>`}`;
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
    ${S.issues.map(it => {
      const rule = S.rules.find(r => r.id === it.rule);
      return `<div class="card pad" style="margin-bottom:12px">
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
        ${it.level >= 4 ? `<div class="btnrow" style="margin-top:12px">
          <button class="btn sm" data-act="stewardBrief">生成协调摘要</button></div>` : ''}
      </div>`;
    }).join('') || '<div class="card empty">当前没有记录中的居住问题</div>'}

    <div class="safety" style="margin-top:14px">
      <h3>${svg(I.shield)}如果遇到的不是普通摩擦</h3>
      <p>威胁、暴力、骚扰、偷拍、强行进入私人空间——这类情况不建议只靠室友之间自行协商解决。</p>
      <div class="btnrow" style="margin-top:11px"><button class="btn danger" data-act="safety">进入安全处理</button></div>
    </div>`;
}

const TALK_VIEWS = { onboard:vOnboard, lin:vLin, issue:vIssue };

/* ============================================================
   我的
   ============================================================ */
function vMe() {
  if (S.sub === 'moveout') return vMoveout();
  const me = mem(ME);
  const st = statusOf(ME);
  const a = awayOf(ME);
  const myZones = [];
  S.spaces.forEach(sp => sp.zones.forEach(z => { if (z.o === ME) myZones.push(`${sp.name} ${z.n}`); }));
  const myThings = S.supplies.filter(s => s.owner === ME);

  return `
    ${head('我的', '你在这个家里的状态、边界和责任。')}

    <div class="card pad" style="margin-bottom:12px">
      <div style="display:flex;gap:13px;align-items:center">${av(ME, 'xl')}
        <div style="flex:1"><div style="font-family:var(--f-d);font-weight:600;font-size:18px">${me.name}</div>
          <div style="font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:6px;margin-top:2px">
            <i class="sdot ${st}"></i>${STATUS_TEXT[st]} · ${me.room}</div>
          ${srcTag(me.lease)}</div>
        <button class="btn sm" data-act="${a ? 'cancelAwayMe' : 'newAway'}">${a ? '我提前回来了' : '登记离家'}</button>
      </div>
    </div>

    ${sec('我的生活偏好', '', `<button class="btn sm" data-act="startQuiz">重新填写</button>`)}
    <div class="vals">${KEY_PREFS.map(k => { const p = PREF_KEYS.find(x => x.k === k);
      return `<span class="val" style="padding-left:10px">${p.label} <b>${me.prefs[k]}</b></span>`; }).join('')}
      ${S.showAllPrefs ? PREF_KEYS.filter(p => !KEY_PREFS.includes(p.k)).map(p =>
        `<span class="val" style="padding-left:10px">${p.label} <b>${me.prefs[p.k]}</b></span>`).join('') : ''}
      <button class="val linkish" data-act="togglePrefs">${S.showAllPrefs ? '收起' : `查看全部 ${PREF_KEYS.length} 项`}</button>
    </div>
    ${srcTag({ via:'member', by:ME, at:S.onboardDone[ME] + ' 完成入住共识' })}

    ${sec('我的空间')}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">${me.room}</div><div class="meta">私人房间</div></div>
        <div class="right"><span class="pill plain">${svg(I.lock)}私人</span></div></div>
      ${myZones.map(z => `<div class="row"><div class="main"><div class="ttl">${z}</div>
        <div class="meta">公共家具中属于你的分区</div></div>
        <div class="right"><span class="pill ok">你的</span></div></div>`).join('')}
    </div>

    ${sec('我的物品', '只在需要划清边界时登记', `<button class="btn sm" data-act="newThing">${svg(I.plus)}添加物品</button>`)}
    <div class="card rows">${myThings.length ? myThings.map(s => `
      <div class="row"><div class="main"><div class="ttl">${s.name}
        <span class="pill ${s.kind === 'lend' ? 'info' : 'plain'}">${s.kind === 'lend' ? '可借' : '私人'}</span></div>
        <div class="meta">${s.rule || s.zone || ''}</div>${srcTag(s.src)}</div>
      <div class="cta"><button class="btn sm" data-act="delThing" data-id="${s.id}">删除</button></div></div>`).join('')
      : '<div class="empty">还没有登记物品。不需要录入所有东西，只在需要说清楚归属时添加。</div>'}
    </div>

    ${sec('我的责任', `本周 ${S.tasks.filter(t => t.who === ME).length} 项`)}
    <div class="card rows">${S.tasks.filter(t => t.who === ME).map(t => `
      <div class="row ${t.done ? 'dim' : ''}"><div class="main"><div class="ttl">${t.task}
        <span class="pill ${t.done ? 'ok' : 'warn'}">${t.done ? '已完成' : t.due}</span></div>
        ${t.done && t.doneAt ? `<div class="meta">${t.doneAt} 标记完成</div>` : ''}</div>
      <div class="cta">${t.done ? '' : `<button class="btn sm pri" data-act="doneTask" data-id="${t.id}">${svg(I.check)}完成</button>`}</div></div>`).join('')}
    </div>

    ${sec('我的账单')}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">待我支付</div>
        <div class="meta">${myDue().map(b => b.title).join(' · ') || '没有待支付的费用'}</div></div>
        <div class="right"><div class="amt">${yuan(myDueTotal())}</div></div>
        <div class="cta"><button class="btn sm" data-act="go" data-tab="bill">查看账单</button></div></div>
    </div>

    ${sec('房屋服务', '由相寓同步', `<button class="btn sm" data-act="newRepair">${svg(I.plus)}我要报修</button>`)}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">租赁机构</div><div class="meta">${HOUSE.org} · ${HOUSE.steward}</div></div></div>
      <div class="row"><div class="main"><div class="ttl">下一次公区保洁</div><div class="meta">${HOUSE.clean.next}</div>
        ${srcTag(HOUSE.clean.src)}</div></div>
      ${S.repairs.map(r => `<div class="row"><div class="main"><div class="ttl">${r.desc}</div>
        <div class="meta">${r.place} · ${mem(r.by).name} 于 ${r.timeline[0].at} 提交</div></div>
        <div class="right"><span class="pill warn">${repairState(r).s}</span></div></div>`).join('')}
    </div>

    ${sec('离开这个家')}
    <div class="card pad">
      <p style="font-size:13.5px;color:var(--ink-2)">搬出会生成一份清单：待结账单、私人物品、公共资产权益、空间清理、钥匙归还、值日退出。
        全部完成后你就正式离开，而这个家会继续运行下去。</p>
      <div class="btnrow" style="margin-top:12px">
        <button class="btn" data-act="go" data-tab="me" data-sub="moveout">查看搬出流程</button>
      </div>
    </div>`;
}

function vMoveout() {
  const mo = S.moveout || defaultMoveout();
  const done = mo.items.filter(i => i.done).length;
  const all = done === mo.items.length;

  return `
    ${backBtn('我的', 'me')}
    ${head('搬出流程', '有人离开，也会有人搬进来，这个家不会被删除。共同约定、公共资产和空间分区都会留下来。')}
    <div class="notice" style="margin-bottom:12px">${svg(I.info)}<span>
      这是流程预览，你现在并没有在搬出。点击任意一项可以切换状态，看看整个交接是怎么走完的。</span></div>
    <div class="card pad" style="margin-bottom:12px">
      <div style="display:flex;gap:11px;align-items:center">${av(ME, 'lg')}
        <div style="flex:1"><div style="font-family:var(--f-d);font-weight:600;font-size:15.5px">如果你要搬出，需要完成这些</div>
          <div style="font-size:13px;color:var(--ink-2);margin-top:1px">清单完成 ${done}/${mo.items.length}</div></div>
        ${all ? '<span class="pill ok">已走完</span>' : '<span class="pill plain">预览中</span>'}</div>
    </div>
    <div class="card rows" style="margin-bottom:12px">
      ${mo.items.map(i => `<div class="chk ${i.done ? 'on' : ''}" data-act="moveChk" data-id="${i.id}" role="button" tabindex="0">
        <span class="box">${svg(I.check, 2.6)}</span><span class="ct">${i.t}</span><span class="cm">${i.m}</span></div>`).join('')}
    </div>
    ${all ? `<div class="card pad" style="border-color:var(--jade-line)">
      <b style="font-family:var(--f-d);font-size:15px">六项走完后，你就正式离开 503</b>
      <p style="font-size:13.5px;color:var(--ink-2);margin-top:5px">
        你的房间和分区会空出来等下一位成员，其余成员的分区不受影响。
        历史账单、共同约定和公共资产都会留在这个家里，剩下的人照常生活。</p>
    </div>` : ''}`;
}

const VIEWS = { home:vHome, life:vLife, bill:vBill, talk:vTalk, me:vMe };
