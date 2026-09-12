/* ============================================================
   视图层
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

/* ============================================================
   首页 —— 这个家今天怎么样，我有什么要处理
   ============================================================ */
function vHome() {
  /* 值得留意：只说是什么类型的事，具体内容留给下面的待办，不重复两遍 */
  const watch = [];
  if (lowSupplies().length) watch.push('公共物品库存');
  const revisit = rulesToRevisit();
  if (revisit.length) watch.push('新室友约定确认');

  const calm = watch.length === 0;
  const hero = `
    <section class="hero ${calm ? 'calm' : 'watch'}">
      <div class="hl">今天，家里怎么样</div>
      <h1 class="ht">${calm ? '一切正常，没有需要协调的事' : `有 ${watch.length} 件事值得留意`}</h1>
      ${watch.length ? `<div class="htags">${watch.map(w => `<span>${w}</span>`).join('')}</div>` : ''}
      <div class="glance">
        <span class="gl">${svg(I.home)}${homeCount()} 人在家</span>
        <span class="gl">${svg(I.guest)}今晚 ${tonightVisits().length} 位访客</span>
        <span class="gl">${svg(I.chore)}${myTasks().filter(t => t.due === '今天').length} 项任务待完成</span>
        <span class="gl">${svg(I.talk)}${revisit.length} 条约定待确认</span>
      </div>
    </section>`;

  /* 成员状态：一行轻量状态栏，不再用四张大卡重复左侧信息 */
  const strip = `<div class="whobar">${MEMBERS.filter(m => !S.movedOut.includes(m.id)).map(m => {
    const st = statusOf(m.id);
    const away = S.away.find(a => a.who === m.id && a.active);
    const tail = st === 'away' ? `${away.to}回` : st === 'incoming' ? `${m.joined}入住` : '在家';
    return `<span class="who ${st}">${av(m.id, 'sm' + (st === 'home' ? '' : ' out'))}
      <b>${m.name}${m.me ? '·你' : ''}</b><i class="sdot ${st}"></i>${tail}</span>`;
  }).join('')}</div>`;

  /* 今天需要你处理：最多 4 件，且必须与当前用户真的有关 */
  const todos = [];
  const t = S.tasks.find(x => x.who === ME && x.due === '今天' && !x.done);
  if (t) todos.push(`<div class="todo a"><span class="ic">${svg(I.chore)}</span><div class="bd">
      <div class="k">今天的值日</div><div class="t">${t.task}</div>
      <div class="m">今天由你负责</div>
      <div class="act">
        <button class="btn pri sm" data-act="doneTask" data-id="${t.id}">${svg(I.check)}完成</button>
        <button class="btn sm" data-act="deferTask" data-id="${t.id}">今天做不了</button>
      </div></div></div>`);

  if (myDue().length) todos.push(`<div class="todo b"><span class="ic">${svg(I.bill)}</span><div class="bd">
      <div class="k">待结算</div><div class="t">你还需支付 ${yuan(myDueTotal())}</div>
      <div class="m">${myDue().map(b => b.title).join(' · ')}</div>
      <div class="act"><button class="btn sm" data-act="go" data-tab="bill">去结算</button></div>
    </div></div>`);

  if (revisit.length) todos.push(`<div class="todo d"><span class="ic">${svg(I.talk)}</span><div class="bd">
      <div class="k">新室友</div><div class="t">${incomingMember().name} 入住后有 ${revisit.length} 项约定需要重新确认</div>
      <div class="m">${revisit.map(r => r.rule.title).join(' · ')}</div>
      <div class="act"><button class="btn pri sm" data-act="go" data-tab="talk" data-sub="lin">参与讨论</button></div>
    </div></div>`);

  const low = lowSupplies()[0];
  if (low && todos.length < 4) todos.push(`<div class="todo c"><span class="ic">${svg(I.box)}</span><div class="bd">
      <div class="k">公共物品</div><div class="t">${low.name}只剩 ${low.qty} ${low.unit}</div>
      <div class="m">低于约定的 ${low.min} ${low.unit}，谁方便谁补充，费用平摊</div>
      <div class="act"><button class="btn pri sm" data-act="restock" data-id="${low.id}">去补充</button></div>
    </div></div>`);

  const todoBlock = todos.length
    ? `<div class="todos">${todos.slice(0, 4).join('')}</div>`
    : `<div class="card empty">今天没有需要你处理的事。<br>有新情况时，管家会主动提醒你。</div>`;

  return `
    ${strip}
    ${hero}
    ${sec('今天需要你处理', todos.length ? `${Math.min(todos.length,4)} 件` : '')}
    ${todoBlock}
    ${sec('跟管家说一句')}
    ${butlerBox()}
    ${sec('家里动态', '共同生活的状态流，不是社交动态')}
    <ul class="feed bare">${S.feed.map(f => `<li>
      ${f.who === 'sys'
        ? `<span class="sysic">${svg(I.spark)}</span><span class="tx"><b>合租管家</b> ${f.text}</span>`
        : `${av(f.who)}<span class="tx"><b>${mem(f.who).name}</b> ${f.text}</span>`}
      <span class="tm">${f.t}</span></li>`).join('')}</ul>`;
}

function butlerBox() {
  return `<div class="butler">
    <div class="bh"><span class="bi">${svg(I.spark)}</span><b>跟管家说一句</b><span>先理解，再确认，最后才执行</span></div>
    <div class="binput">
      <input type="text" id="butlerIn" placeholder="例如：我下周三到周日回老家" aria-label="跟管家说一句">
      <button class="btn pri" data-act="butlerGo">说给管家</button>
    </div>
    <div class="bquick">
      <button class="bq" data-act="butlerFill" data-text="我刚买了29块9的厕纸，12卷，三个人平分">我买了公共用品</button>
      <button class="bq" data-act="butlerFill" data-text="我下周三到周日回老家">我要离开几天</button>
      <button class="bq" data-act="awkward">有件事不好开口</button>
    </div>
  </div>`;
}

/* ============================================================
   生活
   ============================================================ */
const LIFE_MODS = [
  { id:'chore',   name:'值日',     icon:I.chore },
  { id:'supply',  name:'公共物品', icon:I.box   },
  { id:'space',   name:'公共空间', icon:I.space },
  { id:'guest',   name:'访客',     icon:I.guest },
  { id:'away',    name:'离家',     icon:I.away  },
  { id:'facility',name:'共享设施', icon:I.wash  }
];

function vLife() {
  if (S.sub) return LIFE_VIEWS[S.sub]();
  const st = {
    chore:  `${S.tasks.filter(t => !t.done).length} 项待完成 · 你有 ${myTasks().length} 项`,
    supply: lowSupplies().length ? `${lowSupplies().map(s => s.name).join('、')}库存不足` : '库存都在约定水位以上',
    space:  `冰箱 · 储物柜 · 置物架 · 鞋柜已分区`,
    guest:  tonightVisits().length ? `今晚 ${mem(tonightVisits()[0].host).name} 有 1 位访客` : '今晚没有访客登记',
    away:   awayMembers().length ? `${awayMembers().map(a => mem(a.who).name).join('、')} 离家中` : '所有人都在家',
    facility: S.laundry.user ? `洗衣机使用中，预计 ${S.laundry.endsAt} 结束` : '洗衣机空闲'
  };
  const flag = { chore: myTasks().filter(t => t.due === '今天').length, supply: lowSupplies().length,
                 guest: S.visitAsks.length, space:0, away:0, facility:0 };
  const tile = id => {
    const m = LIFE_MODS.find(x => x.id === id);
    return `<button class="mod" data-act="go" data-tab="life" data-sub="${id}">
      <span class="mi">${svg(m.icon)}</span>
      <span><span class="mn">${m.name}${flag[id] ? `<span class="flag">${flag[id]}</span>` : ''}</span>
      <span class="ms">${st[id]}</span></span></button>`;
  };

  return `
    ${head('生活', '这个家此刻的运转状态。日常的事尽量自动进行，需要你的时候才会出现在首页。')}
    <div class="tonight">
      <div class="tn"><div class="tl">今晚</div><div class="tv">${tonightVisits().length ? `${mem(tonightVisits()[0].host).name} 有 1 位访客` : '没有访客'}</div>
        <div class="tsub">${tonightVisits().length ? tonightVisits()[0].when.replace('今晚 ','') + ' · 不留宿' : '有访客请提前登记'}</div></div>
      <div class="tn"><div class="tl">洗衣机</div><div class="tv">${S.laundry.user ? mem(S.laundry.user).name + ' 使用中' : '空闲'}</div>
        <div class="tsub">${S.laundry.user ? '预计 ' + S.laundry.endsAt + ' 结束' : '可以直接用'}</div></div>
      <div class="tn"><div class="tl">下一次公区保洁</div><div class="tv">${HOUSE.nextClean}</div>
        <div class="tsub">${HOUSE.org.split(' · ')[0]}安排，无需自己打扫</div></div>
      <div class="tn"><div class="tl">报修</div><div class="tv">${HOUSE.repair.item} ${HOUSE.repair.status}</div>
        <div class="tsub">${HOUSE.repair.eta}</div></div>
    </div>
    ${sec('这几天会发生的', '和人、时间有关')}
    <div class="mods">${['chore', 'guest', 'facility', 'away'].map(tile).join('')}</div>
    ${sec('家里的东西和空间', '和物、边界有关')}
    <div class="mods">${['supply', 'space'].map(tile).join('')}</div>`;
}

/* ---------- 值日 ---------- */
function vChore() {
  const taskRow = t => {
    const away = statusOf(t.who) === 'away';
    return `<div class="row ${t.done ? 'dim' : ''}">
      <div class="main">
        <div class="ttl">${t.task}
          <span class="pill ${t.done ? 'ok' : t.due === '今天' ? 'warn' : 'plain'}">${t.done ? '已完成' : t.due}</span>
          ${away ? '<span class="pill plain">离家中已暂缓</span>' : ''}
        </div>
        <div class="meta">${mem(t.who).name}${t.who === ME ? '（你）' : ''}${t.note ? ' · ' + t.note : ''}${t.deferred ? ' · ' + t.deferred : ''}</div>
      </div>
      <div class="right">${av(t.who, 'lg' + (away ? ' out' : ''))}</div>
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
  const maxLoad = Math.max(...Object.values(S.load));

  return `
    ${backBtn('生活', 'life')}
    ${head('值日', '责任明确到人。谁临时不方便，可以换班或顺延，系统会记录原因而不是记录失误。')}
    ${sec('我的任务', `${mine.filter(t => !t.done).length} 项待完成`)}
    <div class="card rows">${mine.map(taskRow).join('') || '<div class="empty">这周你没有分到任务</div>'}</div>
    ${sec('这周家里的分工')}
    <div class="card rows">${others.map(taskRow).join('')}</div>
    ${sec('责任分布', '最近 4 周')}
    <div class="card pad">
      ${living().map(m => `
        <div class="calcline">
          <span class="cl">${av(m.id)}${m.name}</span>
          <span style="display:flex;align-items:center;gap:9px;flex:1;margin-left:12px">
            <span style="flex:1;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;max-width:180px">
              <i style="display:block;height:100%;width:100%;background:var(--jade);transform-origin:left;transform:scaleX(${S.load[m.id] / maxLoad})"></i></span>
            <span class="cv">${S.load[m.id]} 项</span></span>
        </div>`).join('')}
      <p style="font-size:13px;color:var(--ink-2);margin-top:11px;line-height:1.6">
        Tom 在 9月8日—9月18日 离家 10 天，这期间的 2 项任务由其他人承担，后续轮换会自动补偿回来。
        除此之外，当前责任分布整体均衡。</p>
    </div>`;
}

/* ---------- 公共物品 ---------- */
function vSupply() {
  const KINDS = [
    { k:'public',  label:'公共',  desc:'所有人都可以用，一起采购、费用平摊。' },
    { k:'lend',    label:'可借',  desc:'属于某个人，但愿意借出。按主人写下的方式使用。' },
    { k:'private', label:'私人',  desc:'明确属于个人。其他人只需要知道这是私人区域，不需要看到具体内容。' }
  ];
  const seg = S.segment;
  const list = S.supplies.filter(s => s.kind === seg);

  const card = s => {
    if (s.kind === 'public') {
      const low = s.qty < s.min;
      const pct = Math.max(6, Math.min(100, Math.round(s.qty / s.max * 100)));
      return `<div class="card sup ${low ? 'low' : ''}">
        <div class="head"><div><div class="nm">${s.name}</div><div class="th">低于 ${s.min} ${s.unit} 时提醒</div></div>
          <span class="pill ${low ? 'hot' : s.qty <= s.min ? 'warn' : 'ok'}">${low ? '库存不足' : s.qty <= s.min ? '即将用完' : '充足'}</span></div>
        <div><div class="num" style="font-size:21px;font-weight:600;margin-bottom:5px">${s.qty}<span style="font-size:12.5px;color:var(--ink-3);margin-left:2px">${s.unit}</span></div>
          <div class="bar"><i style="transform:scaleX(${pct / 100})"></i></div></div>
        <div class="foot">
          <span class="qty"><button data-act="dec" data-id="${s.id}" aria-label="减少${s.name}">−</button><span>${s.qty}</span><button data-act="inc" data-id="${s.id}" aria-label="增加${s.name}">+</button></span>
          <button class="btn sm ${low ? 'pri' : ''}" data-act="restock" data-id="${s.id}">补充</button>
        </div></div>`;
    }
    if (s.kind === 'lend') {
      return `<div class="card sup">
        <div class="head"><div><div class="nm">${s.name}</div><div class="th">可借</div></div>
          <span class="pill info">${s.rule.startsWith('可直接') ? '可直接使用' : '需先询问'}</span></div>
        <div class="owner">${av(s.owner)}${mem(s.owner).name} 的物品${s.owner === ME ? '（你）' : ''}</div>
        <div class="rulenote">${s.rule}</div>
        ${s.owner === ME ? '' : `<div class="foot"><span></span><button class="btn sm" data-act="borrow" data-id="${s.id}">${s.rule.startsWith('可直接') ? '登记借用' : '问一声'}</button></div>`}
      </div>`;
    }
    return `<div class="card sup">
      <div class="head"><div><div class="nm">${s.owner === ME ? s.name : '私人物品'}</div><div class="th">${s.zone}</div></div>
        <span class="pill plain">${svg(I.lock)}私人</span></div>
      <div class="owner">${av(s.owner)}${mem(s.owner).name}${s.owner === ME ? '（你）' : ''}</div>
      <div class="rulenote">${s.owner === ME ? '只有你能看到具体内容。' : '这是私人区域，其他人不需要知道里面具体有什么。'}</div>
    </div>`;
  };

  return `
    ${backBtn('生活', 'life')}
    ${head('公共物品', '不是家里所有东西都属于所有人。先分清公共、可借和私人，借用和采购才不会产生误会。')}
    <div class="segbar">${KINDS.map(k => `<button class="seg" data-act="seg" data-k="${k.k}" aria-pressed="${seg === k.k}">${k.label}</button>`).join('')}</div>
    <div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>${KINDS.find(k => k.k === seg).desc}</span></div>
    <div class="sgrid">${list.map(card).join('')}</div>`;
}

/* ---------- 公共空间 ---------- */
function vSpace() {
  const inc = incomingMember();
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
  const pendingZone = S.spaces.some(sp => sp.zones.some(z => z.pending));
  return `
    ${backBtn('生活', 'life')}
    ${head('公共空间', '把物理边界写下来，是陌生人住在一起最省事的一件事。谁用哪一格，不需要每次开口问。')}
    <div class="spgrid">${S.spaces.map(sp => `
      <div class="card space">
        <h3>${svg(I[sp.icon])}${sp.name}</h3>
        <div class="zones">${sp.zones.map(zoneRow).join('')}</div>
      </div>`).join('')}</div>
    ${pendingZone && inc ? `<div class="handnote" style="margin-top:14px">
      ${inc.name} 入住 ${inc.room} 后使用上面新增的分区，${inc.joined}起生效。现有三位成员的分区都不变。</div>` : ''}`;
}

/* ---------- 访客 ---------- */
function vGuest() {
  const rule = S.rules.find(r => r.id === 'r2');
  return `
    ${backBtn('生活', 'life')}
    ${head('访客', '普通到访只要说一声；留宿会对照现在的约定，超过了也不是禁止，而是先问问大家。')}
    ${S.visitAsks.length ? `${sec('等待你回应')}
      <div class="stack">${S.visitAsks.map(a => `
        <div class="card pad">
          <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">${av(a.host, 'lg')}
            <span><b style="font-family:var(--f-d);font-size:15px">${mem(a.host).name} ${a.text}</b>
            <div style="font-size:12.5px;color:var(--ink-3);margin-top:1px">按登记记录这会是本周第 ${a.nights} 晚，现在的约定是每周最多 ${overnightRule().limit} 晚</div></span></div>
          <div class="btnrow"><button class="btn pri sm" data-act="visitOk" data-id="${a.id}">同意</button>
            <button class="btn sm" data-act="visitTalk" data-id="${a.id}">想讨论一下</button></div>
        </div>`).join('')}</div>` : ''}
    ${sec('最近的访客登记', '本周此前已有 3 晚留宿登记，今晚是普通到访、不留宿')}
    <div class="card rows">${S.visits.length ? S.visits.map(v => `
      <div class="row"><div class="main">
        <div class="ttl">${mem(v.host).name} 的${v.guest}
          <span class="pill ${v.overnight ? 'info' : 'plain'}">${v.overnight ? '留宿' : '不留宿'}</span>
          <span class="pill ok">${v.status}</span></div>
        <div class="meta">${v.when}</div></div>
        <div class="right">${av(v.host)}</div></div>`).join('')
      : '<div class="empty">最近没有访客登记</div>'}</div>
    ${sec('当前约定')}
    <div class="card pad">
      <div class="ruleitem" style="padding:0;border:0">
        <span class="rn">${svg(I.guest)}</span>
        <div class="rb"><div class="rt">${rule.title}</div><div class="rd">${rule.desc}</div>
        <div class="rd">按当前登记记录，本周你登记了 ${S.nights[ME]} 晚留宿。系统只统计登记，不会去核实实际情况。</div></div>
      </div>
    </div>
    <div class="btnrow" style="margin-top:14px">
      <button class="btn pri" data-act="newVisit">${svg(I.plus)}登记一位访客</button>
    </div>`;
}

/* ---------- 离家 ---------- */
function vAway() {
  const myAway = S.away.find(a => a.who === ME && a.active);
  return `
    ${backBtn('生活', 'life')}
    ${head('离家', '登记之后，值日、公共采购和水电分摊都会跟着调整，不用再一件件跟室友交代。')}
    ${sec('当前状态')}
    <div class="card rows">${living().map(m => {
      const a = S.away.find(x => x.who === m.id && x.active);
      return `<div class="row"><div class="main">
        <div class="ttl">${m.name}${m.me ? '（你）' : ''}
          <span class="pill ${a ? 'plain' : 'ok'}">${a ? '离家中' : '在家'}</span></div>
        <div class="meta">${a ? `${a.from} — ${a.to}，共 ${a.days} 天` : m.room + ' · ' + m.prefs.sleep + '睡'}</div></div>
        <div class="right">${av(m.id, 'lg' + (a ? ' out' : ''))}</div>
        ${a && m.id === ME ? `<div class="cta"><button class="btn sm" data-act="cancelAway" data-id="${a.id}">我提前回来了</button></div>` : ''}
      </div>`;
    }).join('')}</div>
    ${awayMembers().length ? `${sec('离家带来的调整')}
    <div class="card pad"><div class="stack">
      ${awayMembers().map(a => `<div>
        <div style="font-family:var(--f-d);font-weight:600;font-size:14.5px;margin-bottom:6px">${mem(a.who).name} · ${a.from} — ${a.to}</div>
        <div class="calcline"><span class="cl">${svg(I.chore)}值日</span><span class="cv" style="font-weight:400;font-size:12.5px;color:var(--ink-2)">期间的任务已暂缓，后续轮换补偿</span></div>
        <div class="calcline"><span class="cl">${svg(I.box)}公共采购</span><span class="cv" style="font-weight:400;font-size:12.5px;color:var(--ink-2)">期间不安排采购任务</span></div>
        <div class="calcline"><span class="cl">${svg(I.scale)}水电分摊</span><span class="cv" style="font-weight:400;font-size:12.5px;color:var(--ink-2)">月末可按实际居住天数计算</span></div>
      </div>`).join('')}
    </div></div>` : ''}
    <div class="btnrow" style="margin-top:14px">
      ${myAway ? '' : `<button class="btn pri" data-act="newAway">${svg(I.away)}登记我的离家</button>`}
    </div>`;
}

/* ---------- 共享设施 ---------- */
function vFacility() {
  const L = S.laundry;
  return `
    ${backBtn('生活', 'life')}
    ${head('共享设施', '设施状态公开，谁在用、什么时候结束一目了然，不需要来回敲门确认。')}
    <div class="card pad" style="margin-bottom:12px">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <span style="width:40px;height:40px;border-radius:12px;background:var(--slate-soft);color:var(--slate);display:grid;place-items:center;flex:none">${svg(I.wash)}</span>
        <div style="flex:1">
          <h3 style="font-size:16px">洗衣机</h3>
          <div style="font-size:13.5px;color:var(--ink-2);margin-top:3px">
            ${L.user ? `${mem(L.user).name} 使用中，预计 ${L.endsAt} 结束` : '当前空闲，可以直接使用'}</div>
          ${L.idleMinutes > 30 ? `<div class="notice" style="margin-top:10px">${svg(I.info)}<span>洗衣机已结束 ${L.idleMinutes} 分钟。管家已经提醒使用者取出衣物，不会显示占用时长。</span></div>` : ''}
          <div class="btnrow" style="margin-top:11px">
            ${L.user && L.user !== ME
              ? `<button class="btn sm ${L.notifyMe ? '' : 'pri'}" data-act="notifyWash">${L.notifyMe ? '已设置提醒' : '结束后提醒我'}</button>`
              : `<button class="btn pri sm" data-act="useWash">${L.user === ME ? '我用完了' : '我要用'}</button>`}
          </div>
        </div>
      </div>
    </div>
    ${sec('房屋服务', HOUSE.org)}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">公区保洁</div>
        <div class="meta">由${HOUSE.org.split(' · ')[0]}安排，客厅、厨房、卫生间</div></div>
        <div class="right"><div class="amt" style="font-size:14px">${HOUSE.nextClean}</div></div></div>
      <div class="row"><div class="main"><div class="ttl">${HOUSE.repair.item}报修 <span class="pill warn">${HOUSE.repair.status}</span></div>
        <div class="meta">${HOUSE.repair.eta}</div></div></div>
      <div class="row"><div class="main"><div class="ttl">${HOUSE.steward}</div>
        <div class="meta">居住问题长期没解决时，可以在问题记录里请管家协调</div></div></div>
    </div>`;
}

const LIFE_VIEWS = { chore:vChore, supply:vSupply, space:vSpace, guest:vGuest, away:vAway, facility:vFacility };

/* ============================================================
   账单 —— 公平账本
   ============================================================ */
const METHOD_TEXT = { even:'平均分摊', days:'按实际居住天数', ratio:'按比例', custom:'自定义' };

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
      </div>
      <div class="right"><div class="amt">${yuan(b.amount)}</div>
        <div class="per">${b.people.length} 人 · ${METHOD_TEXT[b.method]}</div></div>
      <div class="cta">${b.settled
        ? `<button class="btn sm" data-act="unsettle" data-id="${b.id}">撤销</button>`
        : `<button class="btn sm pri" data-act="settle" data-id="${b.id}">${svg(I.check)}标记结清</button>`}</div>
    </div>`;

  return `
    ${head('账单', '每一笔都能解释清楚为什么这样算。月末只结净额，不为了几十块钱来回转账。')}

    ${away.length && !S.fairApplied ? `
    <div class="fair" style="margin-bottom:14px">
      <div class="fh">${svg(I.scale)}一个可能影响公平的情况</div>
      <p>${away.map(a => `${mem(a.who).name} 本月有 ${a.days} 天处于离家状态`).join('；')}。
         ${S.utilityForecast.title}（预计 ${yuan(S.utilityForecast.amount)}）如果仍按三人平均，可能与实际使用情况有出入。</p>
      <div class="calcbox">
        <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700;margin-bottom:4px">按实际居住天数计算</div>
        ${fd.rows.map(r => `<div class="calcline">
          <span class="cl">${av(r.id, 'sm')}${mem(r.id).name}<span class="cd">${r.days} 天${r.off ? ` · 离家 ${r.off} 天` : ''}</span></span>
          <span class="cv">${yuan(r.amount)}</span></div>`).join('')}
      </div>
      <div class="btnrow" style="margin-top:11px">
        <button class="btn pri sm" data-act="applyFair">采用这个方案</button>
        <button class="btn sm" data-act="keepEven">仍按平均分摊</button>
      </div>
      <p style="font-size:12px;color:var(--ink-3);margin-top:9px">这只是一个建议。家里的分摊方式需要你们自己决定，系统不会替你们改。</p>
    </div>` : ''}

    ${S.fairApplied ? `<div class="notice" style="margin-bottom:14px">${svg(I.check)}<span>${S.utilityForecast.title}已改为按实际居住天数计算，并已加入下方账单。其他费用维持原有方式。</span></div>` : ''}

    ${sec('我的账目')}
    <div class="card pad" style="margin-bottom:4px">
      <div class="calcline"><span class="cl">待我支付</span><span class="cv">${yuan(myDueTotal())}</span></div>
      <div class="calcline"><span class="cl">本月共同支出</span><span class="cv">${yuan(monthTotal())}</span></div>
      <div class="calcline"><span class="cl">未结清笔数</span><span class="cv">${openBills().length} 笔</span></div>
    </div>

    ${sec('月末净额结算', '已自动抵消相互欠款')}
    <div class="card rows">
      ${net.transfers.length ? net.transfers.map(t => `
        <div class="netrow"><span class="arrow">${av(t.from)}<b>${mem(t.from).name}</b>${svg(I.arrow)}${av(t.to)}<b>${mem(t.to).name}</b></span>
          <span class="amt">${yuan(t.amount)}</span></div>`).join('')
        : '<div class="empty">当前没有需要结算的净额</div>'}
    </div>
    ${net.deferred.length ? `<div class="notice" style="margin-top:10px">${svg(I.info)}<span>
      ${net.deferred.map(t => `${mem(t.from).name} → ${mem(t.to).name} ${yuan(t.amount)}`).join('，')}
      金额低于 ¥10，已自动滚入下月抵消。不用为了几块钱专门转一次账。</span></div>` : ''}

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
  const open = S.topics.filter(t => !t.done);

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
      ${t.votes && t.votes[ME] ? '' : `<div class="btnrow">
        <button class="btn pri sm" data-act="agreeTopic" data-id="${t.id}">同意</button>
        <button class="btn sm" data-act="discussTopic" data-id="${t.id}">想讨论一下</button></div>`}
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
          <div class="rd" style="color:var(--ink-4)">${r.cat} · ${r.since} 起</div></div>
      </div>`).join('')}</div>

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
        <span class="ms">只记录约定与现状的偏差，不记录谁做错了什么。</span></span></button>
      <button class="mod" data-act="go" data-tab="me">
        <span class="mi">${svg(I.me)}</span><span><span class="mn">我的生活偏好</span>
        <span class="ms">随时可以修改，改动只会影响还没形成约定的部分。</span></span></button>
    </div>`;
}

/* ---------- 入住共识结果 ---------- */
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

    ${sec('谁填过')}
    <div class="card rows">${MEMBERS.filter(m => !S.movedOut.includes(m.id)).map(m => `
      <div class="row"><div class="main"><div class="ttl">${m.name}${m.me ? '（你）' : ''}</div>
        <div class="meta">${S.onboardDone[m.id] ? S.onboardDone[m.id] + ' 完成' : '将在入住前完成'}</div></div>
      <div class="right">${av(m.id, 'lg')}</div>
      ${m.me ? `<div class="cta"><button class="btn sm" data-act="startQuiz">重新填写</button></div>` : ''}</div>`).join('')}</div>`;
}

/* ---------- 新室友 ---------- */
function vLin() {
  const d = linDiff();
  const inc = d.lin;
  if (!inc) return `${backBtn('共识','talk')}<div class="card empty">当前没有即将入住的成员</div>`;
  return `
    ${backBtn('共识', 'talk')}
    ${head(`${inc.name} 即将入住`, '只展示和共同生活有关的部分。新成员加入后，只需要重新协商真正发生变化的地方。')}

    <div class="card pad" style="margin-bottom:14px">
      <div style="display:flex;gap:12px;align-items:center">${av(inc.id, 'xl')}
        <div><div style="font-family:var(--f-d);font-weight:600;font-size:17px">${inc.name}</div>
          <div style="font-size:13px;color:var(--ink-2)">${inc.joined} 入住 ${inc.room} · 这个家将从 ${living().length} 位成员变成 ${living().length + 1} 位</div></div></div>
      <div class="vals" style="margin-top:12px">
        ${['sleep','cook','pet','smoke','social'].map(k => `<span class="val" style="padding-left:10px">${PREF_KEYS.find(p => p.k === k).label} <b>${inc.prefs[k]}</b></span>`).join('')}
      </div>
    </div>

    <div class="resgrp agree">
      <div class="gh">${svg(I.check)}${d.same.length} 项和现在家里的情况一致</div>
      <div class="gb">${d.same.map(s => `<div class="ruleitem"><span class="rn">${svg(I.check)}</span>
        <div class="rb"><div class="rt">${s.label}</div><div class="rd">${s.house}</div></div></div>`).join('')}</div>
    </div>

    <div class="resgrp talk">
      <div class="gh">${svg(I.info)}${d.diff.length} 项存在差异</div>
      <div class="gb">${d.diff.map(t => `
        <div class="diffrow">
          <div class="dt">${t.label}${t.rule ? '<span class="pill warn">涉及现有约定</span>' : '<span class="pill plain">暂无相关约定</span>'}</div>
          <div class="vals">
            <span class="val" style="padding-left:10px">现在家里<b>${t.house}</b></span>
            <span class="val">${av(inc.id, 'sm')}${inc.name} <b>${t.lin}</b></span>
          </div>
          ${t.rule ? `<div class="rd" style="margin-top:7px;font-size:12.5px;color:var(--ink-3)">现有约定：${t.rule.title}</div>` : ''}
          ${SUGGESTION[t.k] ? `<div class="suggest"><div class="sl">管家建议</div><p>${SUGGESTION[t.k]}</p></div>` : ''}
        </div>`).join('')}</div>
    </div>

    <div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>
      其余 ${d.same.length} 项保持不变，不需要全员重新确认一遍。</span></div>

    ${S.linDiscussed
      ? `<div class="card pad" style="border-color:var(--jade-line)"><b style="font-family:var(--f-d)">已发起讨论</b>
         <p style="font-size:13.5px;color:var(--ink-2);margin-top:4px">这 ${d.diff.length} 项已进入「正在讨论」，全员表态后会更新为共同约定。</p></div>`
      : `<button class="btn pri wide" data-act="discussLin">只讨论这 ${d.diff.length} 件事</button>`}`;
}

/* ---------- 居住问题记录 ---------- */
const LADDER = [
  { t:'系统中立提醒', d:'管家按约定提醒，不指向任何人' },
  { t:'私下提醒',     d:'只发给相关的人，其他人看不到' },
  { t:'重新明确约定', d:'多次出现，通常是理解不一致，而不是有人故意' },
  { t:'家里一起讨论', d:'一起把标准定得更具体' },
  { t:'请管家协调',   d:'机构房源可以请管家出面，生成协调摘要' }
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
        <div class="notice" style="margin-top:11px">${svg(I.info)}<span>${it.note}</span></div>
        ${rule ? `<div style="font-size:12.5px;color:var(--ink-3);margin-top:10px">对应约定：${rule.title} —— ${rule.desc}</div>` : ''}
        <div style="margin:14px 0 4px;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);font-weight:700">当前处理到第 ${it.level} 级</div>
        <div class="ladder">${LADDER.map((l, i) => `
          <div class="lstep ${i + 1 === it.level ? 'on' : i + 1 < it.level ? 'past' : ''}">${l.t}<small>${l.d}</small></div>`).join('')}</div>
        <div class="btnrow" style="margin-top:13px">
          <button class="btn pri sm" data-act="clarifyRule" data-id="${it.id}">重新明确标准</button>
          ${it.level >= 4 ? `<button class="btn sm" data-act="stewardBrief">请管家协调</button>`
            : `<span style="font-size:12px;color:var(--ink-3);align-self:center">升到第 4 级后，可以请管家介入</span>`}</div>
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
  const myZones = [];
  S.spaces.forEach(sp => sp.zones.forEach(z => { if (z.o === ME) myZones.push(`${sp.name} ${z.n}`); }));
  const myThings = S.supplies.filter(s => s.owner === ME);

  return `
    ${head('我的', '你在这个家里的状态、边界和责任。')}

    <div class="card pad" style="margin-bottom:12px">
      <div style="display:flex;gap:13px;align-items:center">${av(ME, 'xl')}
        <div style="flex:1"><div style="font-family:var(--f-d);font-weight:600;font-size:18px">${me.name}</div>
          <div style="font-size:13px;color:var(--ink-2);display:flex;align-items:center;gap:6px;margin-top:2px">
            <i class="sdot ${st}"></i>${STATUS_TEXT[st]} · ${me.room} · ${me.joined} 入住</div></div>
        <button class="btn sm" data-act="${st === 'away' ? 'cancelAwayMe' : 'newAway'}">${st === 'away' ? '我提前回来了' : '登记离家'}</button>
      </div>
    </div>

    ${sec('我的生活偏好', '', `<button class="btn sm" data-act="startQuiz">重新填写</button>`)}
    <div class="vals">${KEY_PREFS.map(k => { const p = PREF_KEYS.find(x => x.k === k);
      return `<span class="val" style="padding-left:10px">${p.label} <b>${me.prefs[k]}</b></span>`; }).join('')}
      ${S.showAllPrefs ? PREF_KEYS.filter(p => !KEY_PREFS.includes(p.k)).map(p =>
        `<span class="val" style="padding-left:10px">${p.label} <b>${me.prefs[p.k]}</b></span>`).join('') : ''}
      <button class="val linkish" data-act="togglePrefs">${S.showAllPrefs ? '收起' : `查看全部 ${PREF_KEYS.length} 项`}</button>
    </div>
    <p style="font-size:12.5px;color:var(--ink-3);margin-top:10px">已经形成共同约定的部分，改偏好不会自动改约定，需要重新讨论。</p>

    ${sec('我的空间')}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">${me.room}</div><div class="meta">私人房间</div></div>
        <div class="right"><span class="pill plain">${svg(I.lock)}私人</span></div></div>
      ${myZones.map(z => `<div class="row"><div class="main"><div class="ttl">${z}</div>
        <div class="meta">公共家具中属于你的分区</div></div>
        <div class="right"><span class="pill ok">你的</span></div></div>`).join('')}
    </div>

    ${sec('我的物品')}
    <div class="card rows">${myThings.map(s => `
      <div class="row"><div class="main"><div class="ttl">${s.name}
        <span class="pill ${s.kind === 'lend' ? 'info' : 'plain'}">${s.kind === 'lend' ? '可借' : '私人'}</span></div>
        <div class="meta">${s.rule || s.zone}</div></div></div>`).join('')}
    </div>

    ${sec('我的责任', `本周 ${S.tasks.filter(t => t.who === ME).length} 项`)}
    <div class="card rows">${S.tasks.filter(t => t.who === ME).map(t => `
      <div class="row ${t.done ? 'dim' : ''}"><div class="main"><div class="ttl">${t.task}
        <span class="pill ${t.done ? 'ok' : 'warn'}">${t.done ? '已完成' : t.due}</span></div></div>
      <div class="cta">${t.done ? '' : `<button class="btn sm pri" data-act="doneTask" data-id="${t.id}">${svg(I.check)}完成</button>`}</div></div>`).join('')}
    </div>

    ${sec('我的账单')}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">待我支付</div>
        <div class="meta">${myDue().map(b => b.title).join(' · ') || '没有待支付的费用'}</div></div>
        <div class="right"><div class="amt">${yuan(myDueTotal())}</div></div>
        <div class="cta"><button class="btn sm" data-act="go" data-tab="bill">查看账单</button></div></div>
    </div>

    ${sec('房屋服务', HOUSE.org)}
    <div class="card rows">
      <div class="row"><div class="main"><div class="ttl">管家</div><div class="meta">${HOUSE.steward} · ${HOUSE.org}</div></div></div>
      <div class="row"><div class="main"><div class="ttl">下一次公区保洁</div><div class="meta">${HOUSE.nextClean}</div></div></div>
      <div class="row"><div class="main"><div class="ttl">${HOUSE.repair.item}报修</div><div class="meta">${HOUSE.repair.eta}</div></div>
        <div class="right"><span class="pill warn">${HOUSE.repair.status}</span></div></div>
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

/* ---------- 搬出 ---------- */
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
