/* ============================================================
   流程层：管家理解、入住共识、不好开口、安全处理、各类登记
   统一原则：先展示理解结果和影响，用户确认后才执行。
   ============================================================ */

const ov = () => document.getElementById('ov');
const sheetEl = () => document.getElementById('sheet');
function openSheet(html, wide) {
  const s = sheetEl();
  s.className = 'sheet' + (wide ? ' wide' : '');
  s.innerHTML = html;
  ov().hidden = false;
  const f = s.querySelector('input,textarea,select,button.opt');
  if (f) f.focus();
}
function closeSheet() { ov().hidden = true; sheetEl().innerHTML = ''; }

const uline = (l, v) => `<div class="uline"><span class="ul">${l}</span><span class="uv">${v}</span></div>`;
/* 日期选择：值是 dn，显示是人话。演示时间推进之后这些选项跟着走 */
const dayOpts = (sel, from, to) => { let o = '';
  for (let i = from; i <= to; i++) { const d = dnNow() + i;
    o += `<option value="${d}" ${d === sel ? 'selected' : ''}>${fmtDn(d)} ${wdOfDn(d)}${i === 0 ? '（今天）' : i === 1 ? '（明天）' : ''}</option>`; }
  return o; };
const understandBox = (title, lines) =>
  `<div class="understand"><div class="uh">${title}</div><div class="ub">${lines.join('')}</div></div>`;
const impactBox = (lines) =>
  `<div class="impact"><div class="il">确认后会发生什么</div><ul>${lines.map(l => `<li>${svg(I.check)}<span>${l}</span></li>`).join('')}</ul></div>`;
const acts = (confirmAct, confirmLabel, extra) =>
  `<div class="acts">${extra || ''}<button class="btn" data-act="close">取消</button>
   <button class="btn pri" data-act="${confirmAct}">${confirmLabel}</button></div>`;

/* ============================================================
   跟管家说一句 —— 自然表达 → 结构化理解 → 影响 → 确认
   ============================================================ */
const CN_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7 };

const CN_DIGIT = { '零':0,'一':1,'两':2,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
function cnNum(s) {
  if (/^\d+$/.test(s)) return parseInt(s);
  if (s.length === 1) return CN_DIGIT[s] ?? 0;
  if (s[0] === '十') return 10 + (CN_DIGIT[s[1]] ?? 0);
  if (s[1] === '十') return (CN_DIGIT[s[0]] ?? 0) * 10 + (CN_DIGIT[s[2]] ?? 0);
  return CN_DIGIT[s[0]] ?? 0;
}

/* ============================================================
   跟管家说一句
   自然表达 → 理解成结构化的几项 → 不确定的地方让你改 → 看清影响 → 确认 → 执行。
   三条底线：
     1. 缺信息就问，绝不自己填一个可能算错的数；
     2. 识别错了，用户可以直接改金额、物品、数量、参与人、日期，不用重说一遍；
     3. 最后执行的，就是你在预览里看到的那一份，不会换一种分法。
   ============================================================ */

/* 把一句话拆成若干"可能的意图"，含糊的时候让用户自己选，而不是替他猜 */
function parseButler(raw) {
  const text = (raw || '').trim();
  if (!text) return null;
  const hits = [];

  const money = parseMoney(text);
  const qtyM = text.match(/(\d+|[一二两三四五六七八九十]+)\s*(卷|个|瓶|包|条|袋|盒|提|片)/);
  const qty = qtyM ? cnNum(qtyM[1]) : 0, unit = qtyM ? qtyM[2] : '';
  const supply = S.supplies.find(x => x.kind === 'public' && text.includes(x.name));

  /* 改上一笔记账 */
  if (/改|修改|改一下|写错|记错|搞错|不对/.test(text) && /记账|账|费用|刚才|刚刚|那笔/.test(text))
    hits.push({ type:'editBill', score:3 });

  /* 库存变少（"只剩两卷"和"买了两卷"是完全不同的两件事） */
  if (supply && /只剩|还剩|快没|快用完|用完了|没了|不多|剩下/.test(text) && !/买|购/.test(text))
    hits.push({ type:'stock', score:3, supply, qty: qtyM ? qty : null,
      state: /用完了|已经没/.test(text) ? '已用完' : /不多/.test(text) ? '不多了' : '快用完' });

  /* 买了公共用品 */
  if (/买|购|补充|添|囤/.test(text))
    hits.push({ type:'buy', score: 2 + (money ? 1 : 0) + (supply ? 1 : 0), supply,
      name: supply ? supply.name : guessThingName(text), qty, unit, amount: money,
      people: parsePeople(text) });

  /* 离家 */
  if (/离家|回老家|出差|不在家|外出|旅行|回家住|出去几天|不在/.test(text)) {
    const r = parseRange(text);
    hits.push({ type:'away', score: 2 + (r ? 1 : 0), fromDn: r && r.from, toDn: r && r.to });
  }

  /* 访客 */
  if (/访客|朋友来|来玩|过夜|留宿|住一晚|来住|客人/.test(text))
    hits.push({ type:'visit', score:2, overnight:/过夜|留宿|住一晚|住几天/.test(text) });

  if (/不好开口|不好意思说|难开口|有点介意|忍很久|不知道怎么说/.test(text))
    hits.push({ type:'awkward', score:3 });

  if (!hits.length) return { type:'unknown', text };
  hits.sort((a, b) => b.score - a.score);
  /* 两个意图分数接近：不替用户选，先问清楚要做哪件事 */
  if (hits.length > 1 && hits[0].score - hits[1].score <= 1)
    return { type:'multi', text, options:hits.slice(0, 3) };
  return { ...hits[0], text };
}

function parseMoney(text) {
  let m = text.match(/(\d+)\s*块\s*(\d)(?!\d)/);
  if (m) return parseFloat(m[1] + '.' + m[2]);
  if ((m = text.match(/(\d+(?:\.\d+)?)\s*(?:块|元|圆)/))) return parseFloat(m[1]);
  if ((m = text.match(/[¥￥]\s*(\d+(?:\.\d+)?)/))) return parseFloat(m[1]);
  return 0;
}
/* 谁参与分摊："Tom 不用分"要真的把 Tom 去掉，而不是忽略这半句 */
function parsePeople(text) {
  const all = living().map(m => m.id);
  if (/各买各|我自己|私人|不用分摊|我请/.test(text)) return [ME];
  const out = all.slice();
  MEMBERS.forEach(m => {
    const re = new RegExp(`(?:${m.name}|${m.short})[^，。,]{0,4}(?:不用分|不用算|不参与|不算|别算|不分)`);
    const re2 = new RegExp(`(?:除了|不含|不包括)\\s*(?:${m.name}|${m.short})`);
    if ((re.test(text) || re2.test(text)) && out.includes(m.id)) out.splice(out.indexOf(m.id), 1);
  });
  return out.length ? out : all;
}
function guessThingName(text) {
  const m = text.match(/买了?些?点?\s*([^\d，。,、]{1,8}?)(?:\d|，|。|,|、|$)/);
  const n = m && m[1].trim().replace(/^的/, '');
  return n && !/公共用品|东西|点|些/.test(n) ? n : '';
}
/* 日期区间："下周三到周日"、"9月16日到9月20日" */
function parseRange(text) {
  let m;
  if ((m = text.match(/(下?)周([一二三四五六日天]).{0,3}?到.{0,3}?(下?)周?([一二三四五六日天])/))) {
    const f = weekdayDn(m[2], m[1] === '下');
    let t = weekdayDn(m[4], (m[3] === '下') || (m[1] === '下'));
    if (t < f) t += 7;
    return { from:f, to:t };
  }
  if ((m = text.match(/(\d+)月(\d+)[日号].{0,3}?到.{0,3}?(?:(\d+)月)?(\d+)[日号]/)))
    return { from: dn(`${m[1]}月${m[2]}日`), to: dn(`${m[3] ? m[3] : m[1]}月${m[4]}日`) };
  if ((m = text.match(/(\d+)\s*天/))) return { from: dnNow(), to: dnNow() + Math.max(1, +m[1]) - 1 };
  return null;
}
function weekdayDn(cn, nextWeek) {
  const target = CN_NUM[cn];
  const d = dateOfDn(dnNow()), ci = d.getDay() === 0 ? 7 : d.getDay();
  return dnNow() - (ci - 1) + (nextWeek ? 7 : 0) + (target - 1);
}

/* ---------- 可编辑的理解结果 ---------- */
const bfield = (id, label, input, hint) =>
  `<div class="bf"><label for="${id}">${label}</label>${input}${hint ? `<em>${hint}</em>` : ''}</div>`;
const bMissing = lines => `<div class="bmiss">${svg(I.info)}<div><b>还缺一点信息</b><span>${lines.join('；')}。管家不会替你猜一个数字，因为猜错了账就算错了。</span></div></div>`;

function butlerSheet(raw) {
  const p = parseButler(raw);
  if (!p) return;
  if (p.type === 'awkward') { closeSheet(); awkwardSheet(); return; }
  if (p.type === 'visit') { closeSheet(); visitSheet(p.overnight); return; }

  /* 听不懂：说清楚为什么做不了，并给出能直接去做这件事的入口 */
  if (p.type === 'unknown') return openSheet(`<h3>这句话管家没有把握</h3>
    <p class="hint">为了不把事情做错，管家只在能明确理解时才执行。可以换个说法，也可以直接选一件事去做。</p>
    ${understandBox('你说的是', [uline('原话', `<span style="font-weight:400">${esc(p.text)}</span>`)])}
    <div class="notice" style="margin-bottom:12px">${svg(I.info)}<span>它可能缺少"做什么"这个动作。比较好认的说法：<b>买了什么 + 多少钱</b>、<b>某样东西还剩多少</b>、<b>哪天到哪天不在家</b>。</span></div>
    <div class="stack">
      <button class="btn wide" data-act="butlerFill" data-text="我刚买了29块9的厕纸，12卷，三个人平分">我买了公共用品</button>
      <button class="btn wide" data-act="butlerFill" data-text="厕纸只剩两卷了">更新公共物品剩多少</button>
      <button class="btn wide" data-act="butlerFill" data-text="我下周三到周日回老家">我要离开几天</button>
      <button class="btn wide" data-act="newVisit">我有访客要来</button>
      <button class="btn wide" data-act="newBill">我要记一笔费用</button>
      <button class="btn wide" data-act="awkward">有件事不好开口</button>
    </div>
    <div class="acts"><button class="btn" data-act="close">关闭</button></div>`);

  /* 一句话里有好几件事：先确认你要做哪一件 */
  if (p.type === 'multi') {
    const NAME = { buy:'记一笔公共采购', stock:'更新物品剩多少', away:'登记离家', visit:'登记访客', editBill:'修改之前的记账', awkward:'有件事不好开口' };
    const DESC = { buy:'会更新库存，并新增一笔要分摊的费用', stock:'只改数量或状态，不涉及钱', away:'影响值日、采购和水电分摊',
      visit:'登记一次到访或留宿', editBill:'改金额、参与人或删掉一笔', awkward:'先说给管家听，再决定要不要开口' };
    return openSheet(`<h3>这句话里好像有两件事</h3>
      <p class="hint">它们产生的结果完全不同，先确认你现在想做哪一件。</p>
      ${understandBox('你说的是', [uline('原话', `<span style="font-weight:400">${esc(p.text)}</span>`)])}
      <div class="opts">${p.options.map(o => `
        <button class="opt" data-act="butlerPick" data-k="${o.type}" data-text="${esc(p.text)}">
          <span><b style="font-family:var(--f-d)">${NAME[o.type]}</b>
          <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">${DESC[o.type]}</span></span>
          <span class="ok">${svg(I.check, 2.4)}</span></button>`).join('')}</div>
      <div class="acts"><button class="btn" data-act="close">都不是，取消</button></div>`);
  }

  if (p.type === 'editBill') return butlerEditBill(p);
  if (p.type === 'stock') return butlerStock(p);
  if (p.type === 'buy') return butlerBuy(p);
  if (p.type === 'away') return butlerAway(p);
}

const esc = t => String(t || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/* 用户在"这句话里有两件事"里挑了一件：按那一件重新解析同一句话 */
function parseButlerAs(kind, text) {
  const p = parseButler(text);
  if (p && p.type === 'multi') { const hit = p.options.find(o => o.type === kind); if (hit) return { ...hit, text }; }
  if (p && p.type === kind) return p;
  return { type:kind, text };
}
function butlerRoute(p) {
  if (p.type === 'stock') { if (!p.supply) p.supply = S.supplies.find(x => x.kind === 'public'); return butlerStock(p); }
  if (p.type === 'buy') return butlerBuy({ people: living().map(m => m.id), ...p });
  if (p.type === 'away') return butlerAway(p);
  if (p.type === 'editBill') return butlerEditBill(p);
  if (p.type === 'visit') return visitSheet(!!p.overnight);
}

/* ---------- 修改之前的记账 ---------- */
function butlerEditBill(p) {
  const mine = S.bills.filter(b => b.src && b.src.by === ME).slice(0, 5);
  if (!mine.length) return openSheet(`<h3>没有找到你记过的账</h3>
    <p class="hint">管家只能帮你改你自己记的那几笔。</p>
    <div class="acts"><button class="btn" data-act="close">知道了</button>
      <button class="btn pri" data-act="newBill">记一笔新的</button></div>`);
  openSheet(`<h3>要改哪一笔？</h3>
    <p class="hint">改完之后，各人应付应收和月末净额都会重算。已经有人确认收款的那几笔，需要先撤销对应的结清才能改。</p>
    <div class="opts">${mine.map(b => `
      <button class="opt" data-act="editBill" data-id="${b.id}">
        <span><b style="font-family:var(--f-d)">${b.title} · ${yuan(b.amount)}</b>
        <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">${b.date} · ${b.people.length} 人分${hasConfirmed(b) ? ' · 已有人确认收款' : ''}</span></span>
        <span class="ok">${svg(I.check, 2.4)}</span></button>`).join('')}</div>
    <div class="acts"><button class="btn" data-act="close">取消</button></div>`);
}

/* ---------- 更新库存 ---------- */
function butlerStock(p) {
  const s = p.supply;
  const isCount = s.mode === 'count';
  S.pending = { type:'stock', supplyId:s.id };
  openSheet(`<h3>管家理解成这样</h3>
    <p class="hint">这只改数量或状态，不涉及钱。下面每一项都可以改。</p>
    <div class="bform">
      ${bfield('bs-n', '物品', `<select id="bs-n">${S.supplies.filter(x => x.kind === 'public').map(x =>
        `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select>`)}
      ${isCount
        ? bfield('bs-q', '现在还剩', `<input type="number" id="bs-q" min="0" value="${p.qty != null ? p.qty : ''}" inputmode="numeric" placeholder="没听清，请填一个数">`, `单位：${s.unit}`)
        : bfield('bs-s', '现在的状态', `<select id="bs-s">${SUPPLY_STATES.map(v =>
            `<option value="${v}" ${v === (p.state || s.state) ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
    </div>
    <div id="bImpact"></div>
    ${acts('doStock', '确认更新')}`);
  const upd = () => {
    const sid = document.getElementById('bs-n').value;
    const cur = S.supplies.find(x => x.id === sid);
    const qEl = document.getElementById('bs-q');
    const q = qEl ? (qEl.value === '' ? null : Math.max(0, parseInt(qEl.value))) : null;
    const st = document.getElementById('bs-s') ? document.getElementById('bs-s').value : null;
    S.pending = { type:'stock', supplyId:sid, qty:q, state:st };
    const missing = cur.mode === 'count' && (q == null || isNaN(q));
    document.getElementById('bImpact').innerHTML = missing
      ? bMissing([`没听出「${cur.name}」现在还剩几${cur.unit}`])
      : impactBox([
          `${cur.name}的记录更新为 ${cur.mode === 'count' ? q + ' ' + cur.unit : st}`,
          (cur.mode === 'count' ? q < cur.min : ['快用完', '已用完'].includes(st))
            ? '会低于约定水位，首页出现补充提醒' : '仍在约定水位以上，不会产生提醒',
          '这次更新记在你名下，其他人能看到是谁什么时候改的',
          '不会产生任何费用'
        ]);
    const go = sheetEl().querySelector('[data-act="doStock"]');
    if (go) go.disabled = missing;
  };
  ['bs-n', 'bs-q', 'bs-s'].forEach(i => { const el = document.getElementById(i); if (el) el.addEventListener('input', upd); });
  const sel = document.getElementById('bs-n');
  if (sel) sel.addEventListener('change', () => { closeSheet(); butlerStock({ ...p, supply:S.supplies.find(x => x.id === sel.value) }); });
  upd();
}

/* ---------- 买了公共用品 ---------- */
function butlerBuy(p) {
  const pub = S.supplies.filter(x => x.kind === 'public');
  S.pending = { type:'buy' };
  openSheet(`<h3>管家理解成这样</h3>
    <p class="hint">这会同时改库存和账单，所以每一项都让你先核对、能改了再执行。</p>
    <div class="bform">
      ${bfield('bb-s', '买的是', `<select id="bb-s">
        ${pub.map(x => `<option value="${x.id}" ${p.supply && x.id === p.supply.id ? 'selected' : ''}>${x.name}</option>`).join('')}
        <option value="__new" ${p.supply ? '' : 'selected'}>其他（新增一项公共物品）</option></select>`)}
      <div id="bb-newWrap" ${p.supply ? 'hidden' : ''}>${bfield('bb-name', '它叫什么', `<input type="text" id="bb-name" value="${esc(p.name || '')}" placeholder="例如：洗手液">`)}</div>
      ${bfield('bb-q', '数量', `<input type="number" id="bb-q" min="1" value="${p.qty || ''}" inputmode="numeric" placeholder="买了几${p.unit || '件'}">`, '状态型物品（洗衣液这类只记档位的）可以留空')}
      ${bfield('bb-a', '一共花了多少钱', `<input type="number" id="bb-a" min="0" step="0.01" value="${p.amount || ''}" inputmode="decimal" placeholder="没听清，请填金额">`, '留空就只更新库存、不记账')}
      ${bfield('bb-p', '谁垫付的', `<select id="bb-p">${living().map(m =>
        `<option value="${m.id}" ${m.id === ME ? 'selected' : ''}>${m.name}${m.id === ME ? '（你）' : ''}</option>`).join('')}</select>`)}
      <div class="bf"><label>谁参与分摊</label><div class="who-pick" id="bb-w">${living().map(m =>
        `<button type="button" data-m="${m.id}" aria-pressed="${(p.people || []).includes(m.id)}">${av(m.id, 'sm')}${m.name}</button>`).join('')}</div>
        <em>点一下就能去掉某个人。说过"这次 Tom 不用分"的话，管家已经先去掉了。</em></div>
    </div>
    <div id="bPrev"></div>
    <div id="bImpact"></div>
    ${acts('doBuy', '确认并执行')}`);

  const upd = () => {
    const sid = document.getElementById('bb-s').value;
    const cur = sid === '__new' ? null : S.supplies.find(x => x.id === sid);
    document.getElementById('bb-newWrap').hidden = !!cur;
    const name = cur ? cur.name : (document.getElementById('bb-name').value || '').trim();
    const qv = document.getElementById('bb-q').value;
    const q = qv === '' ? null : Math.max(1, parseInt(qv));
    const av2 = document.getElementById('bb-a').value;
    const amount = av2 === '' ? null : Math.max(0, parseFloat(av2));
    const payer = document.getElementById('bb-p').value;
    const people = [...sheetEl().querySelectorAll('#bb-w button[aria-pressed="true"]')].map(b => b.dataset.m);
    const stateMode = cur && cur.mode === 'state';

    const missing = [];
    if (!name) missing.push('没听出买的是什么');
    if (!stateMode && (q == null || isNaN(q))) missing.push('没听出买了几件');
    if (amount == null || isNaN(amount)) missing.push('没听出花了多少钱');
    if (!people.length) missing.push('至少要有一个人参与分摊');

    /* 预览里每个人的金额，就是确认后真正写进账单的金额 */
    const cents = amount ? splitCents(Math.round(amount * 100), people) : null;
    document.getElementById('bPrev').innerHTML = missing.length ? '' : understandBox('每个人分多少', [
      ...people.map(x => uline(`${av(x, 'sm')}${mem(x).name}`, yuan(cents[x] / 100))),
      uline('<span style="color:var(--ink-3);font-weight:400">合计</span>', yuan(Object.values(cents).reduce((a, c) => a + c, 0) / 100))
    ]);
    document.getElementById('bImpact').innerHTML = missing.length ? bMissing(missing) : impactBox([
      stateMode ? `${name}状态更新为充足` : cur ? `${name}库存 ${cur.qty} → ${cur.qty + q} ${cur.unit}` : `新增公共物品「${name}」，库存 ${q} 件`,
      cur && !stateMode && cur.qty + q >= cur.min ? '首页的库存不足提醒会消失'
        : cur && !stateMode ? '库存仍低于提醒水位，提醒会保留' : '会按新物品的默认水位提醒',
      `账单新增一笔 ${yuan(amount)}，由 ${mem(payer).name} 垫付，${people.length} 人分摊`,
      people.length < living().length ? `${living().filter(m => !people.includes(m.id)).map(m => m.name).join('、')} 这次不参与分摊` : '所有在住成员都参与分摊',
      '每个人的那一份要各自标记已付、由垫付人确认收到，才算结清'
    ]);
    S.pending = { type:'buy', supplyId: cur ? cur.id : null, name, qty:q, unit: cur ? cur.unit : '件',
      amount, payer, people, stateMode };
    const go = sheetEl().querySelector('[data-act="doBuy"]');
    if (go) go.disabled = missing.length > 0;
  };
  ['bb-name', 'bb-q', 'bb-a'].forEach(i => document.getElementById(i).addEventListener('input', upd));
  document.getElementById('bb-p').addEventListener('change', upd);
  document.getElementById('bb-s').addEventListener('change', upd);
  sheetEl().querySelectorAll('#bb-w button').forEach(b => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); upd();
  }));
  upd();
}

/* ---------- 离家 ---------- */
function butlerAway(p) {
  const from = p.fromDn != null ? p.fromDn : null, to = p.toDn != null ? p.toDn : null;
  S.pending = { type:'away' };
  openSheet(`<h3>管家理解成这样</h3>
    <p class="hint">离家会影响值日、采购和费用分摊，日期一定要对，所以让你先确认。</p>
    <div class="bform">
      ${bfield('ba-f', '从哪天开始', `<select id="ba-f"><option value="">${from == null ? '没听出开始日期，请选一个' : ''}</option>${dayOpts(from, 0, 45)}</select>`)}
      ${bfield('ba-t', '到哪天结束', `<select id="ba-t"><option value="">${to == null ? '没听出结束日期，请选一个' : ''}</option>${dayOpts(to, 0, 75)}</select>`)}
    </div>
    <div id="bImpact"></div>
    ${acts('doAway', '确认离家')}`);
  if (from == null) document.getElementById('ba-f').value = '';
  if (to == null) document.getElementById('ba-t').value = '';
  const upd = () => {
    const f = parseInt(document.getElementById('ba-f').value), t = parseInt(document.getElementById('ba-t').value);
    const missing = [];
    if (isNaN(f)) missing.push('没听出从哪天开始');
    if (isNaN(t)) missing.push('没听出到哪天结束');
    if (!isNaN(f) && !isNaN(t) && t < f) missing.push('结束日期不能早于开始日期');
    const days = (!isNaN(f) && !isNaN(t) && t >= f) ? t - f + 1 : 0;
    const affected = S.tasks.filter(x => x.who === ME && !x.done && x.dueDn >= f && x.dueDn <= t).length;
    document.getElementById('bImpact').innerHTML = missing.length ? bMissing(missing) : impactBox([
      `登记离家 ${fmtDn(f)} — ${fmtDn(t)}，共 ${days} 天`,
      `值日：这期间你的 ${affected} 项任务会暂缓，后续轮换补偿`,
      '公共采购：这段时间不会把采购任务分给你',
      `费用：水电这类随使用变化的费用可以按在住天数分，你的登记在住天数会变成 ${Math.max(0, S.utilityForecast.days - days)} 天——但怎么分要大家确认，系统不会替你们改`,
      '家里的状态和头像会显示为离家中'
    ]);
    S.pending = { type:'away', fromDn:f, toDn:t };
    const go = sheetEl().querySelector('[data-act="doAway"]');
    if (go) go.disabled = missing.length > 0;
  };
  document.getElementById('ba-f').addEventListener('change', upd);
  document.getElementById('ba-t').addEventListener('change', upd);
  upd();
}

/* ============================================================
   入住共识问卷
   ============================================================ */
const QUIZ = [
  { k:'sleep',    q:'工作日一般几点睡？',            h:'知道彼此的作息，很多噪音问题就不会发生。', o:['23:00 左右','23:45 左右','00:30 左右','更晚'] },
  { k:'quiet',    q:'几点之后希望家里保持安静？',      h:'这一条最容易形成明确约定。',            o:['22:30','23:00','23:30','00:00'] },
  { k:'visitor',  q:'朋友来家里坐坐，你的接受程度？',  h:'先说清楚，来客人时才不会互相猜。',        o:['都可以，不用特意说','提前说一声','尽量约在外面'] },
  { k:'overnight',q:'同一个朋友一周留宿几晚比较合适？', h:'留宿是合租里最常见的摩擦来源。',          o:['尽量不留宿','每周 ≤1 晚','每周 ≤2 晚','不限'] },
  { k:'kitchen',  q:'厨房用完，什么程度算恢复？',      h:'把"干净"写成具体标准，比互相提醒有用。',   o:['台面擦净，锅具当天洗','大致收一下就行','第二天一起收拾'] },
  { k:'supply',   q:'公共用品你更偏好哪种方式？',      h:'决定要不要建立统一采购和 AA。',          o:['统一采购 AA','各买各的','谁用得多谁买'] },
  { k:'temp',     q:'公共空间空调多少度比较舒服？',    h:'温度差异不大，但夏天最容易积累情绪。',     o:['24°C','25°C','26°C','27°C'] },
  { k:'social',   q:'你希望的室友关系是？',           h:'没有对错，说清楚就好。',                o:['礼貌互不打扰','偶尔一起聊天吃饭','希望成为朋友'] },
  { k:'conflict', q:'如果室友的行为影响到你，你更希望？', h:'这决定了管家以后用什么方式提醒。',       o:['私下直接说','系统先中立提醒','家里一起讨论'] },
  { k:'smoke',    q:'家里能否吸烟？',                 h:'包括阳台。',                          o:['家里都不吸','阳台可以','都可以'] },
  { k:'cook',     q:'你的做饭频率大概是？',           h:'和厨房清洁、油烟、冰箱分区都有关。',      o:['几乎不做饭','偶尔做饭','经常做饭'] },
  { k:'pet',      q:'关于宠物，你的情况是？',         h:'提前说明，避免入住后才发现不合适。',      o:['不养，也不希望有','不养，可以接受','我有宠物'] }
];

function quizSheet() {
  const q = QUIZ[S.quiz.step];
  const cur = S.quiz.answers[q.k];
  openSheet(`
    <div class="prog">${QUIZ.map((_, i) => `<i class="${i <= S.quiz.step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="qnum">第 ${S.quiz.step + 1} / ${QUIZ.length} 题</div>
    <div class="qtitle">${q.q}</div>
    <div class="qhint">${q.h}</div>
    <div class="opts">${q.o.map(o => `
      <button class="opt" data-act="quizPick" data-v="${o}" aria-pressed="${cur === o}">${o}
        <span class="ok">${svg(I.check, 2.4)}</span></button>`).join('')}</div>
    <div class="acts">
      ${S.quiz.step > 0 ? '<button class="btn" data-act="quizBack">上一题</button>' : '<button class="btn" data-act="close">稍后再说</button>'}
      <button class="btn pri" data-act="quizNext" ${cur ? '' : 'disabled'}>${S.quiz.step === QUIZ.length - 1 ? '看看结果' : '下一题'}</button>
    </div>`);
}

/* ============================================================
   有件事不好开口 —— 情绪 → 问题 → 诉求 → 可执行规则
   ============================================================ */
const AWK_CATS = [
  { k:'卫生', s:'厨房、卫生间、公共区域的清洁' },
  { k:'噪音', s:'作息、外放、说话声音' },
  { k:'访客', s:'来访频率、留宿、公共空间占用' },
  { k:'钱',   s:'分摊方式、垫付、结算' },
  { k:'空间', s:'冰箱、储物、私人区域边界' },
  { k:'物品', s:'借用、消耗、损坏' },
  { k:'其他', s:'不属于以上的情况' }
];
/* 每类问题背后，通常真正涉及的几个点 */
const AWK_FOCUS = {
  访客: ['留宿频率', '公共空间占用', '实际居住人数', '费用公平'],
  卫生: ['清洁标准不一致', '恢复时限', '公共区域责任划分'],
  噪音: ['安静时间', '外放与耳机', '洗衣与家务时段'],
  钱:   ['分摊方式', '结算周期', '谁垫付'],
  空间: ['分区边界', '公共区域堆放', '私人空间'],
  物品: ['借用方式', '公共消耗品补充', '损坏赔偿'],
  其他: ['需要建立新的约定']
};

/* 语义识别优先于用户先前选的分类。
   有人心里想的是访客问题，却顺手点了"卫生"，按分类走会把整条链路带偏。 */
const AWK_SIGNALS = [
  { cat:'访客', kws:['女朋友','男朋友','对象','访客','留宿','过夜','住这','来住','住下','天天来','经常来','带人','带朋友','朋友来','另一个人','多住'] },
  { cat:'噪音', kws:['吵','噪音','外放','大声','睡不着','动静','响','打游戏','说话声','半夜'] },
  { cat:'卫生', kws:['脏','乱','油污','不洗','不收拾','碗','台面','厨余','垃圾没','头发','打扫','发霉','异味'] },
  { cat:'钱',   kws:['分摊','平摊','AA','垫付','转账','结算','水电费','费用','付钱','算钱','贵'] },
  { cat:'空间', kws:['占了','堆','放我','塞满','冰箱','柜子','鞋柜','阳台','位置','地方','我的区域'] },
  { cat:'物品', kws:['用我','拿我','借','弄坏','坏了','用完了','没经过我','动我'] }
];
function detectCat(text) {
  let best = null, bestScore = 0;
  AWK_SIGNALS.forEach(s => {
    const score = s.kws.filter(k => text.includes(k)).length;
    if (score > bestScore) { best = s.cat; bestScore = score; }
  });
  return bestScore > 0 ? best : null;
}

/* 每个诉求对应哪条现有规则。有规则就先判断是否超出，而不是再造一条。 */
const FOCUS_RULE = {
  '留宿频率': 'overnight', '实际居住人数': 'overnight',
  '清洁标准不一致': 'kitchen', '恢复时限': 'kitchen',
  '安静时间': 'quiet', '公共消耗品补充': 'supply', '费用公平': null
};
function ruleFor(focus) {
  const key = FOCUS_RULE[focus];
  return key ? S.rules.find(r => r.prefKey === key) : null;
}
/* 现状与约定的差距。
   只依据系统里的登记记录和约定来判断，不写成"实际住了几晚"——
   产品并不知道真实生活，只知道谁登记了什么。 */
function gapFor(focus) {
  if (FOCUS_RULE[focus] === 'overnight') {
    const o = overnightRule();
    if (!o) return null;
    /* 说的是哪一位访客：用户在上一步确认过就按那一位算，没确认就取登记最多的那一对 */
    const a = S.awk || {};
    const pair = a.guestId ? o.pairs.find(p => p.guestId === a.guestId) : o.pairs[0];
    const actual = pair ? pair.nights : 0;
    const who = pair ? `${mem(pair.host).name} 登记为「${pair.guest}」的这位访客` : '这位访客';
    return { exceeded: actual > o.limit, limit: o.limit, actual, guest: pair && pair.guest, host: pair && pair.host,
      text: actual > o.limit
        ? `根据当前登记记录，${who}本周已留宿 ${actual} 晚，超过了大家约定的每周 ${o.limit} 晚。`
        : `根据当前登记记录，${who}本周已留宿 ${actual} 晚，仍在约定的每周 ${o.limit} 晚之内。` };
  }
  const it = S.issues.find(i => S.rules.find(r => r.id === i.rule && r.prefKey === FOCUS_RULE[focus]));
  if (it) return { exceeded: true, text: `${it.window}，系统就这条约定发出过 ${it.count} 次提醒。` };
  return null;
}
const AWK_SUGGEST = {
  '留宿频率': '同一访客每周最多留宿 2 晚，更多次数提前征求其他室友意见。',
  '实际居住人数': '长期多住一人时，水电按实际居住人数分摊。',
  '公共空间占用': '访客在公共区域停留时，公共物品与空间仍按原有分区使用。',
  '水电公平': '当月有人长期多住或长期不在时，水电按实际居住天数或人数计算。',
  '清洁标准不一致': '厨房使用后当天恢复：台面无明显油污、厨余当天处理、锅具当天清洗。',
  '恢复时限': '公共区域使用后当天恢复，不留到第二天。',
  '安静时间': '23:30 后保持安静，外放改用耳机。',
  '分摊方式': '公共费用默认平均分摊，出现长期离家时可改按居住天数。',
  '分区边界': '冰箱、储物柜、置物架和鞋柜按现有分区使用，需要调整先在家里说一声。',
  '借用方式': '可借物品按主人写下的方式使用，用后归位。'
};

/* 哪些写法会让人一眼看出是谁提的 */
function anonHints(text, a) {
  const out = [];
  const names = MEMBERS.filter(m => text.includes(m.name)).map(m => m.name);
  if (names.length) out.push(`出现了成员名字「${names.join('、')}」`);
  if (/我的|我们房|我房间|0\d室/.test(text)) out.push('出现了房间或"我的…"这类指向本人的说法');
  if (a && a.guestId && text.includes((a.guestId.split(':')[1] || ''))) out.push('出现了具体访客的称呼');
  if (/昨天|今天早上|刚才/.test(text)) out.push('出现了很具体的时间点，容易对上是谁在场');
  return out;
}
/* 把指名道姓的说法换成描述事情本身的说法 */
function anonClean(text) {
  let t = text;
  MEMBERS.forEach(m => { t = t.replace(new RegExp(m.name, 'g'), '有室友'); });
  t = t.replace(/有室友的/g, '某位室友的').replace(/(有室友)+/g, '有室友');
  t = t.replace(/我的|我们房|我房间/g, '个人').replace(/昨天|今天早上|刚才/g, '最近');
  return t;
}

function awkwardSheet() {
  const a = S.awk;

  /* 第一步：类型 */
  if (a.step === 0) return openSheet(`
    <h3>有件事不好开口</h3>
    <p class="hint">先选一个类型。管家不会把你说的内容直接发给任何人，最后要不要开口、以什么方式开口，都由你决定。</p>
    <div class="opts">${AWK_CATS.map(c => `
      <button class="opt" data-act="awkCat" data-k="${c.k}">
        <span><b style="font-family:var(--f-d)">${c.k}</b>
        <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">${c.s}</span></span>
        <span class="ok">${svg(I.check, 2.4)}</span></button>`).join('')}</div>
    <div class="safety" style="margin-top:14px;padding:13px">
      <h3 style="font-size:14.5px">${svg(I.shield)}如果涉及人身安全</h3>
      <p style="font-size:13px;margin-top:5px">威胁、暴力、骚扰、偷拍、强闯房间，不要走这条协商流程。</p>
      <div class="btnrow" style="margin-top:10px"><button class="btn danger sm" data-act="safety">进入安全处理</button></div>
    </div>
    <div class="acts"><button class="btn" data-act="close">取消</button></div>`);

  /* 第二步：自然表达 */
  if (a.step === 1) return openSheet(`
    <h3>发生了什么</h3>
    <p class="hint">用你自己的话说就行，不用组织语言。管家会帮你把它整理成可以讨论的问题。</p>
    <div class="fld"><textarea id="awkText" placeholder="例如：Alex 女朋友最近基本天天来，感觉已经不是偶尔来玩了。">${a.text || ''}</textarea></div>
    <button class="bq" data-act="awkFill" data-text="Alex 女朋友最近基本天天来，感觉已经不是偶尔来玩了。">用这个例子试试</button>
    <div class="acts"><button class="btn" data-act="awkBack">上一步</button>
      <button class="btn pri" data-act="awkAnalyze">让管家看看</button></div>`);

  /* 第三步：识别真正涉及什么。以描述内容为准，不以先前选的分类为准。 */
  if (a.step === 2) {
    const readCat = a.readCat || a.cat;
    const shifted = a.readCat && a.readCat !== a.cat;
    const focuses = AWK_FOCUS[readCat] || AWK_FOCUS['其他'];
    return openSheet(`
      <h3>管家的理解</h3>
      <p class="hint">你说的这件事，通常不只是一个问题。先确认你最想解决的是哪一个。</p>
      ${understandBox('你描述的情况', [
        uline('看起来是', `${readCat}相关`),
        `<div class="uline"><span class="ul">原话</span><span class="uv" style="font-weight:400;font-family:var(--f-b);text-align:right">${a.text}</span></div>`
      ])}
      ${shifted ? `<div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>
        看起来这件事更接近${readCat}问题，我按你实际描述的情况继续。</span></div>` : ''}
      ${readCat === '访客' ? awkGuestPick(a) : ''}
      <div style="font-size:13px;color:var(--ink-2);margin-bottom:9px">这件事可能同时涉及：</div>
      <div class="vals" style="margin-bottom:16px">${focuses.map(f => `<span class="val" style="padding-left:10px">${f}</span>`).join('')}</div>
      <div style="font-size:13.5px;font-weight:600;margin-bottom:9px">你最希望先解决哪一个？</div>
      <div class="opts">${focuses.map(f => {
        const r = ruleFor(f);
        return `<button class="opt" data-act="awkFocus" data-k="${f}">
          <span>${f}${r ? `<span style="display:block;font-size:12px;color:var(--ink-3);font-weight:400">已有相关约定</span>` : ''}</span>
          <span class="ok">${svg(I.check, 2.4)}</span></button>`;
      }).join('')}</div>
      <div class="acts"><button class="btn" data-act="awkBack">上一步</button></div>`);
  }

  /* 第四步：先看现有约定，再决定怎么处理。
     已经有约定的，优先按约定提醒，而不是重复造一条新规则。 */
  if (a.step === 3) {
    const existing = ruleFor(a.focus);
    const gap = gapFor(a.focus);
    const sug = AWK_SUGGEST[a.focus] || '把这件事写成一条大家都认可的具体约定。';
    const opt = (w, title, desc, rec) => `
      <button class="opt" data-act="awkGo" data-w="${w}">
        <span><b style="font-family:var(--f-d)">${title}${rec ? '　<span class="pill ok">推荐</span>' : ''}</b>
        <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">${desc}</span></span>
        <span class="ok">${svg(I.check, 2.4)}</span></button>`;

    return openSheet(`
      <h3>${a.focus}</h3>
      <p class="hint">先看家里现在有没有相关约定，再决定怎么处理。</p>
      ${existing ? `
        <div class="rulebox">
          <div class="rl">已有的共同约定</div>
          <b>${existing.title}</b>
          <p>${existing.desc}</p>
          <div class="gap ${gap && gap.exceeded ? 'over' : 'ok'}">
            ${svg(gap && gap.exceeded ? I.info : I.check)}
            <span>${gap ? gap.text : '目前没有记录到与这条约定的明显出入。'}</span></div>
        </div>
        ${gap && gap.exceeded ? `<div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>
          这件事已经有约定了，所以不需要再定一条新规则。先按现有约定提醒，如果大家觉得约定本身需要改，再重新确认。</span></div>` : ''}`
      : `<div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>
          家里还没有关于「${a.focus}」的明确约定。很多摩擦其实来自这里——没人说错话，只是从来没说清楚。</span></div>`}

      <div style="font-size:13.5px;font-weight:600;margin-bottom:9px">你希望怎么处理</div>
      <div class="opts">
        ${existing && gap && gap.exceeded
          /* Case C：有约定且登记已超出 —— 先按约定中立提醒 */
          ? opt('remind', '按现有约定提醒', '由管家私下发出，不点名、不公开，只说明约定和登记情况', true) +
            opt('clarify', '重新确认这条约定', '如果觉得' + (gap.limit ? '每周 ' + gap.limit + ' 晚' : '这个标准') + '本身需要调整', false)
          : existing
            /* Case B：有约定但登记没超出 —— 不制造矛盾，先沟通或继续观察 */
            ? opt('private', '先私下聊一句', '现在的登记情况还在约定之内，也许说一声就够了', true) +
              opt('watch', '先继续观察', '不做任何动作，如果之后确实超出约定，管家会主动提醒你', false) +
              opt('clarify', '我觉得约定本身不合适', '进入重新确认，不新增约定，只改现有这一条', false)
            /* Case A：还没有约定 */
            : opt('rule', '建立约定', sug, true)}
        ${opt('private', '私下聊聊', '管家帮你把话整理得更中性，只发给相关的人', false)}
        ${opt('house', '放到家里一起讨论', '不点名，把问题本身提出来', false)}
      </div>
      <div class="acts"><button class="btn" data-act="awkBack">上一步</button></div>`);
  }

  /* 第五步：确认。不同处理方式产生的结果完全不同，先说清楚再执行。 */
  if (a.step === 4) {
    const sug = AWK_SUGGEST[a.focus] || '把这件事写成一条大家都认可的具体约定。';
    const existing = ruleFor(a.focus);
    const gap = gapFor(a.focus);
    const WAY = { private:'私下聊聊', house:'一起讨论', rule:'建立约定', remind:'按现有约定提醒',
                  clarify:'重新确认这条约定', watch:'先继续观察' };
    const draft = existing
      ? (FOCUS_RULE[a.focus] === 'overnight'
        ? `想和你对一下访客留宿的安排。我们之前说好的是同一访客每周最多留宿 ${gap ? gap.limit : 2} 晚，${gap && gap.guest ? `登记里「${gap.guest}」` : '这周'}好像到 ${gap ? gap.actual : 3} 晚了。我不是要计较这个，就是想问问你最近是不是有什么特殊情况，需要的话我们把这条重新定一下也可以。`
        : `想和你对一下${a.focus}的事。我们之前有约定「${existing.title}」，最近的情况好像和它有点出入。我不是要计较，就是想问问是不是有什么特殊情况，需要的话我们把这条重新定一下也可以。`)
      : `想和你聊一下${a.focus}这件事。我们家里目前没有相关的约定，我想问问你的想法，看能不能定一个大家都舒服的方式。`;

    const impact = {
      remind: ['由 Roomly 管家私下发出，不会公开，也不会显示是谁触发的',
               '只说明约定内容和登记情况，不做评价',
               '不新增约定——这件事已经有约定了', '这次提醒会记入居住问题记录的第 1 级'],
      clarify: [`「${existing ? existing.title : a.focus}」进入重新确认`, '可以把标准或数字改得更具体',
                '不新增规则，只修改现有这一条', '需要全员确认后才会更新'],
      rule: ['「正在讨论」中新增一个议题', '其他人看到的是议题本身，不会看到是谁提的', '全员同意后成为共同约定'],
      house: ['「正在讨论」中新增一个议题', '不点名，其他人看到的是问题本身', '达成一致后可以转成约定'],
      private: ['这段话只发给相关的人', '家里动态中不会出现任何记录', '如果之后仍有问题，可以再放到一起讨论'],
      watch: ['不改动任何约定，也不发出提醒', '这件事只记在你自己这里，其他人看不到',
              '如果之后登记情况真的超出约定，管家会主动提醒你', '你随时可以回来改成其他处理方式']
    };

    /* 不点名 ≠ 没人猜得到：发起前让用户看到别人实际会看到的那段话，并且可以改掉会暴露自己的描述 */
    const anon = ['house', 'rule', 'clarify'].includes(a.way);
    const anonText = a.anonText != null ? a.anonText
      : (a.way === 'clarify' ? `${existing ? existing.desc : a.focus}${gap ? ' 当前情况：' + gap.text : ''}`
        : (AWK_SUGGEST[a.focus] || `关于${a.focus}的约定，等待大家一起确认。`));
    const risky = anonHints(anonText, a);

    return openSheet(`
      <h3>${WAY[a.way]}</h3>
      <p class="hint">${a.way === 'private'
        ? '下面这段话去掉了情绪和指责，只说事实和你的想法。发出前你可以再改。'
        : '确认之前，先看清楚这一步会产生什么。'}</p>
      ${a.way === 'private'
        ? `<div class="fld"><label>整理后的表达</label><textarea id="awkFinal">${draft}</textarea></div>
           <div class="privacy">${svg(I.lock)}<div><b>这段话只有收件人能看到</b>
             <span>不会进家里动态，也不会出现在讨论里。但对方知道是你发的——私下沟通本来就不是匿名的。</span></div></div>`
        : understandBox('将要做的事', [
            uline('针对', a.focus),
            existing ? uline('对应约定', existing.title) : uline('现有约定', '暂无'),
            gap ? uline('当前情况', `<span style="font-weight:400;font-family:var(--f-b);text-align:right">${gap.text}</span>`) : '',
            uline('处理方式', WAY[a.way]),
            uline('署名', anon ? '不显示发起人' : '显示发起人')
          ].filter(Boolean))}

      ${anon ? `
      <div class="anonbox">
        <div class="an-h">${svg(I.shield)}<b>别人会看到这些</b><span>发起人不显示，但内容本身可能让人猜到是谁</span></div>
        <div class="fld"><label for="anonT">议题里会出现的文字（可以改）</label><textarea id="anonT" rows="3">${esc(anonText)}</textarea></div>
        ${risky.length ? `<div class="an-warn">${svg(I.alert)}<div><b>这几处可能暴露你的身份</b>
          <span>${risky.join('；')}。要不要改成不指向具体某个人的说法？</span>
          <button class="btn sm" data-act="anonClean">帮我改成中性说法</button></div></div>`
          : `<div class="an-ok">${svg(I.check)}<span>目前这段文字里没有出现成员名字、房间号或只有你知道的细节。</span></div>`}
        <div class="an-f">${svg(I.info)}<span>Roomly 不承诺绝对匿名：室友之间人很少，谁最近在意什么，彼此多少能猜到。
          这里能做到的是——<b>系统不显示发起人、不记录到家里动态</b>，剩下的由你决定要写多少。</span></div>
      </div>` : ''}
      ${a.way === 'rule' ? `<div class="suggest" style="margin-bottom:14px"><div class="sl">建议的约定</div><p>${sug}</p></div>` : ''}
      ${a.way === 'remind' ? `<div class="suggest" style="margin-bottom:14px"><div class="sl">管家会这样说</div>
        <p>本周登记的留宿次数已经超过大家之前约定的范围，需要一起确认一下后面的安排吗？</p></div>` : ''}
      ${impactBox(impact[a.way])}
      <div class="acts"><button class="btn" data-act="awkBack">上一步</button>
        <button class="btn pri" data-act="awkSubmit">${
          a.way === 'private' ? '发送' : a.way === 'remind' ? '发出提醒'
          : a.way === 'clarify' ? '发起重新确认' : a.way === 'watch' ? '就这样，先观察' : '发起讨论'}</button></div>`);
  }
}

/* 不好开口 · 访客类：先确认说的是哪一位访客。一位成员可能登记过好几位访客，不能把他们加在一起算 */
function awkGuestPick(a) {
  const o = overnightRule();
  if (!o || !o.pairs.length) return '';
  /* 原话里提到了谁，就先按那个人的访客列；没提到就按登记最多的那一对 */
  const named = MEMBERS.find(m => m.id !== ME && a.text && a.text.includes(m.name));
  const host = a.host || (named ? named.id : o.pairs[0].host);
  const list = o.pairs.filter(p => p.host === host);
  /* 只有一位就直接认；原话里点到了称呼（"女朋友"）也先按那位算，用户仍可以改 */
  if (!a.host && !a.guestId) {
    const hit = list.length === 1 ? list[0] : list.find(p => a.text && a.text.includes(p.guest));
    if (hit) { a.host = host; a.guestId = hit.guestId; }
  }
  const cur = a.guestId;
  return `<div style="font-size:13.5px;font-weight:600;margin-bottom:7px">你说的是哪一位访客？</div>
    <div style="font-size:12.5px;color:var(--ink-3);margin-bottom:8px">${mem(host).name} 最近登记过 ${list.length} 位访客，留宿次数是按每一位分开算的。</div>
    <div class="who-pick" style="margin-bottom:16px">
      ${list.map(p => `<button type="button" data-act="awkGuest" data-h="${host}" data-g="${p.guestId}" aria-pressed="${cur === p.guestId}">${mem(host).name} 登记的「${p.guest}」<small style="font-weight:400;color:var(--ink-4)"> · 本周 ${p.nights} 晚</small></button>`).join('')}
      <button type="button" data-act="awkGuest" data-h="${host}" data-g="" aria-pressed="${!cur}">不确定 / 另一位</button>
    </div>`;
}

/* 成员小卡：只放家里本来就公开的信息——状态、房间、入住日、入住共识里的关键偏好、愿意借出的东西 */
function memberSheet(id) {
  const m = mem(id), st = statusOf(id), a = awayOf(id), ms = membership(id);
  const lend = S.supplies.filter(s => s.kind === 'lend' && s.owner === id);
  openSheet(`<h3 style="display:flex;align-items:center;gap:10px">${av(id, 'xl')}<span>${m.name}${id === ME ? '（你）' : ''}</span></h3>
    <div class="vals" style="margin-top:6px">
      <span class="val" style="padding-left:10px">状态 <b>${st === 'away' && a ? `登记离家中 · ${fmtDn(a.toDn)} 回` : ms === 'pending' ? `${m.joined} 入住` : MEMBERSHIP_TEXT[ms]}</b></span>
      <span class="val" style="padding-left:10px">房间 <b>${m.room}</b></span>
      <span class="val" style="padding-left:10px">入住 <b>${m.joined}</b></span>
    </div>
    ${srcTag(m.lease)}
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700;margin:14px 0 6px">入住共识里填的关键偏好</div>
    <div class="vals" style="margin-top:0">${KEY_PREFS.map(k => `<span class="val" style="padding-left:10px">${PREF_KEYS.find(p => p.k === k).label} <b>${m.prefs[k]}</b></span>`).join('')}</div>
    <div class="srctag">${svg(I.info)}本人填写，只反映个人偏好，不是共同约定</div>
    ${lend.length ? `<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);font-weight:700;margin:14px 0 6px">愿意借出的东西</div>
      <div class="vals" style="margin-top:0">${lend.map(x => `<span class="val" style="padding-left:10px">${x.name} <b style="font-weight:400;color:var(--ink-3)">${x.rule}</b></span>`).join('')}</div>` : ''}
    <div class="notice" style="margin-top:14px">${svg(I.shield)}<span>账单明细、私人物品、问题记录这些不在这里显示：它们只属于本人，或只在对应的模块里按权限出现。</span></div>
    <div class="acts"><button class="btn" data-act="close">关闭</button></div>`);
}

/* 分区调整：个人不能直接改公共分区，只能向对方发请求，对方同意后两块互换 */
function zoneSwapSheet(spId) {
  const sp = S.spaces.find(x => x.id === spId);
  const mine = sp.zones.find(z => z.o === ME);
  const others = sp.zones.filter(z => z.o !== ME && z.o !== 'public' && !z.pending && membership(z.o) === 'active');
  openSheet(`<h3>申请调整 · ${sp.name}</h3>
    <p class="hint">分区是大家一起定的结果，不能自己改。你现在用的是 <b>${mine ? mine.n : '—'}</b>；选一块想换的，对方同意后两块互换。整体重新划分请去「公共空间」页。</p>
    <div class="fld"><label>想换成</label><div class="who-pick" id="zs-w">${others.map(z =>
      `<button type="button" data-n="${z.n}" aria-pressed="false">${av(z.o, 'sm')}${mem(z.o).name} 的 ${z.n}</button>`).join('') || '<span style="font-size:13px;color:var(--ink-3)">这个空间里没有可以交换的分区</span>'}</div></div>
    ${impactBox(['只发给对方一个人，其他人不会收到', '对方同意后两块分区互换，记为共同设定', '对方不方便的话，一切保持不变'])}
    ${acts('doZoneSwap', '发出请求')}`);
  sheetEl().dataset.spid = spId;
  sheetEl().querySelectorAll('#zs-w button').forEach(b => b.addEventListener('click', () => {
    sheetEl().querySelectorAll('#zs-w button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
  }));
}

/* ============================================================
   安全事件
   ============================================================ */
function safetySheet() {
  openSheet(`
    <div class="safety" style="border:0;background:none;padding:0">
      <h3>${svg(I.shield)}这类情况不建议自行协商</h3>
      <p>威胁、暴力、骚扰、偷拍、强行进入私人空间，都不属于可以"好好沟通"解决的室友摩擦。
         请优先保证自己的安全，再考虑其他事情。</p>
      <div class="safeacts">
        <button class="safeact" data-act="safeAct" data-k="record">${svg(I.note)}保存事件记录<span class="ar">${svg(I.chev)}</span></button>
        <button class="safeact" data-act="safeAct" data-k="platform">${svg(I.home)}联系租赁平台 / ${HOUSE.steward}<span class="ar">${svg(I.chev)}</span></button>
        <button class="safeact" data-act="safeAct" data-k="contact">${svg(I.phone)}联系紧急联系人<span class="ar">${svg(I.chev)}</span></button>
        <button class="safeact" data-act="safeAct" data-k="police">${svg(I.alert)}求助与报警指引<span class="ar">${svg(I.chev)}</span></button>
      </div>
      <p style="font-size:12px;color:var(--ink-3);margin-top:13px">
        记录只保存在你自己这里，其他室友看不到，也不会出现在 家里动态中。</p>
    </div>
    <div class="acts"><button class="btn" data-act="close">返回</button></div>`);
}

/* ============================================================
   各类登记
   ============================================================ */
/* 只更新数量/状态，不涉及钱 */
function setStockSheet(id) {
  const s = S.supplies.find(x => x.id === id);
  openSheet(`<h3>更新${s.name}库存</h3>
    <p class="hint">直接把数字改成你现在看到的数量。这条记录会记在你名下，其他人能看到是谁什么时候更新的。</p>
    <div class="fld"><label for="sq">当前还有（${s.unit}）</label>
      <input type="number" id="sq" min="0" value="${s.qty}" inputmode="numeric"></div>
    <div class="notice">${svg(I.info)}<span>上次更新：${srcNote(s.src)}</span></div>
    ${acts('doSetStock', '更新')}`);
  sheetEl().dataset.sid = id;
}

/* 补充并记账：数量/状态 + 费用一起处理 */
function restockSheet(id) {
  const s = S.supplies.find(x => x.id === id);
  const defQty = s.mode === 'count' ? Math.max(s.min * 2, 4) : 1;
  const defAmt = s.name === '厕纸' ? 29.9 : 20;
  openSheet(`<h3>补充${s.name}</h3>
    <p class="hint">填了金额，账单里会自动生成一笔对应的公共支出，不用再单独记一次。</p>
    ${s.mode === 'count'
      ? `<div class="fld"><label for="rq">新增数量（${s.unit}）</label><input type="number" id="rq" min="1" value="${defQty}" inputmode="numeric"></div>`
      : `<div class="fld"><label>补充后的状态</label><div class="who-pick" id="rs">
          ${SUPPLY_STATES.map(v => `<button type="button" data-v="${v}" aria-pressed="${v === '充足'}">${v}</button>`).join('')}</div></div>`}
    <div class="fld"><label for="ra">购买金额（元，留空则只更新库存）</label><input type="number" id="ra" min="0" step="0.01" value="${defAmt}" inputmode="decimal"></div>
    <div class="understand"><div class="uh">分摊预览</div><div class="ub" id="rPrev"></div></div>
    ${acts('doRestock', '确认补充')}`);
  const upd = () => {
    const a = parseFloat(document.getElementById('ra').value) || 0;
    const q = s.mode === 'count' ? (parseInt(document.getElementById('rq').value) || 0) : 0;
    document.getElementById('rPrev').innerHTML =
      uline(s.mode === 'count' ? '库存变化' : '状态变化',
            s.mode === 'count' ? `${s.qty} → ${s.qty + q} ${s.unit}`
                               : `${s.state} → ${sheetEl().querySelector('#rs button[aria-pressed="true"]').dataset.v}`) +
      uline('付款人', `${av(ME, 'sm')}${mem(ME).name}`) +
      uline('参与分摊', living().map(x => av(x.id, 'sm')).join('')) +
      uline('每人承担', a > 0 ? `<span style="color:var(--jade)">${yuan(splitCents(Math.round(a * 100), living().map(x => x.id))[ME] / 100)}</span>` : '不产生费用');
  };
  if (s.mode === 'count') document.getElementById('rq').addEventListener('input', upd);
  else sheetEl().querySelectorAll('#rs button').forEach(b => b.addEventListener('click', () => {
    sheetEl().querySelectorAll('#rs button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); upd();
  }));
  document.getElementById('ra').addEventListener('input', upd);
  upd();
  sheetEl().dataset.sid = id;
}

/* 洗衣机：选时长后才有"使用中"这个状态 */
function washSheet() {
  openSheet(`<h3>开始使用洗衣机</h3>
    <p class="hint">选一个大概时长，其他人就能看到预计什么时候空出来，不用来回敲门问。</p>
    <div class="opts">
      <button class="opt" data-act="doWash" data-m="30">快洗　<span style="color:var(--ink-3);font-weight:400">30 分钟</span><span class="ok">${svg(I.check,2.4)}</span></button>
      <button class="opt" data-act="doWash" data-m="60">标准　<span style="color:var(--ink-3);font-weight:400">60 分钟</span><span class="ok">${svg(I.check,2.4)}</span></button>
      <button class="opt" data-act="doWash" data-m="90">大件　<span style="color:var(--ink-3);font-weight:400">90 分钟</span><span class="ok">${svg(I.check,2.4)}</span></button>
    </div>
    <div class="fld" style="margin-top:13px"><label for="wm">或自定义（分钟）</label>
      <div style="display:flex;gap:8px"><input type="number" id="wm" min="5" max="240" value="45" inputmode="numeric">
      <button class="btn" data-act="doWashCustom">确定</button></div></div>
    <div class="acts"><button class="btn" data-act="close">取消</button></div>`);
}

/* 报修：住户提交，之后由租房中介更新进度 */
function repairSheet() {
  openSheet(`<h3>我要报修</h3>
    <p class="hint">提交后由租房中介受理并安排维修，处理进度会同步回来，你不用自己跟进。</p>
    <div class="fld"><label for="rpp">问题位置</label><select id="rpp">
      <option>厨房</option><option>卫生间</option><option>门锁</option><option>家电</option><option>其他</option></select></div>
    <div class="fld"><label for="rpd">问题描述</label><input type="text" id="rpd" placeholder="例如：厨房灯不亮了"></div>
    ${impactBox(['生成一张报修单，状态为「已提交」', '租房中介受理后状态会自动更新（演示环境里这一步是模拟的）',
                 '维修安排会显示在生活页和我的页', '这次提交会记进家里动态'])}
    ${acts('doRepair', '提交报修')}`);
}

/* 个人物品：只在需要划清边界时登记 */
function thingSheet() {
  openSheet(`<h3>添加我的物品</h3>
    <p class="hint">不用录入所有东西。只有当这件东西需要说清楚归属或借用方式时，才值得加进来。</p>
    <div class="fld"><label for="tn">物品名称</label><input type="text" id="tn" placeholder="例如：空气炸锅"></div>
    <div class="fld"><label>共享方式</label><div class="who-pick" id="tw">
      <button type="button" data-v="private" aria-pressed="true">不共享</button>
      <button type="button" data-v="free">可以直接使用</button>
      <button type="button" data-v="ask">使用前问我</button></div></div>
    <div class="fld"><label for="tz">放在哪（可留空）</label><input type="text" id="tz" placeholder="例如：厨房储物柜 A 格"></div>
    ${acts('doThing', '添加')}`);
  sheetEl().querySelectorAll('#tw button').forEach(b => b.addEventListener('click', () => {
    sheetEl().querySelectorAll('#tw button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
  }));
}

/* 管理自己的物品：共享方式、说明、位置都能改；删除放在页面上做次要动作 */
function manageThingSheet(id) {
  const x = S.supplies.find(y => y.id === id);
  const w = x.kind === 'private' ? 'private' : (x.rule && /问/.test(x.rule) ? 'ask' : 'free');
  openSheet(`<h3>管理「${x.name}」</h3>
    <p class="hint">改的是这件东西在家里的使用方式，室友在「可借的东西」里看到的会同步更新。</p>
    <div class="fld"><label for="mt-n">物品名称</label><input type="text" id="mt-n" value="${x.name}"></div>
    <div class="fld"><label>共享方式</label><div class="who-pick" id="mt-w">
      <button type="button" data-v="private" aria-pressed="${w === 'private'}">不共享（私人）</button>
      <button type="button" data-v="free" aria-pressed="${w === 'free'}">可以直接使用</button>
      <button type="button" data-v="ask" aria-pressed="${w === 'ask'}">使用前问我</button></div></div>
    <div class="fld"><label for="mt-r">使用说明（可借时显示给室友）</label><input type="text" id="mt-r" value="${x.rule || ''}" placeholder="例如：用后清洗放回"></div>
    <div class="fld"><label for="mt-z">放在哪（可留空）</label><input type="text" id="mt-z" value="${x.zone || ''}" placeholder="例如：冰箱上层"></div>
    ${acts('doManageThing', '保存')}`);
  sheetEl().dataset.sid = id;
  sheetEl().querySelectorAll('#mt-w button').forEach(b => b.addEventListener('click', () => {
    sheetEl().querySelectorAll('#mt-w button').forEach(y => y.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
  }));
}

/* 改完偏好发现和家里现在的约定不一样：只提示，不改约定 */
function prefDiffSheet(diff) {
  openSheet(`<h3>偏好已更新</h3>
    <p class="hint">你的偏好和当前共同约定有 ${diff.length} 项不同。约定不会因此自动改变——要不要去共识页和大家聊聊？</p>
    <div class="card rows" style="margin:12px 0 14px">${diff.map(d => `
      <div class="row"><div class="main"><div class="ttl">${d.label}</div>
        <div class="meta">你：${d.mine} · ${d.house.from === 'rule' ? '共同约定' : '家里现在'}：${d.house.v}</div></div></div>`).join('')}</div>
    <div class="acts"><button class="btn" data-act="close">先这样</button>
      <button class="btn pri" data-act="go" data-tab="talk">去共识页聊聊</button></div>`);
}

/* ============================================================
   逆向操作：记错了、改主意了、现实变了
   ============================================================ */
function editBillSheet(id) {
  const b = S.bills.find(x => x.id === id);
  openSheet(`<h3>修改「${b.title}」</h3>
    <p class="hint">改完之后，各人应付、本月合计和月末净额都会重新算一遍。</p>
    <div class="fld"><label for="eb-t">费用名称</label><input type="text" id="eb-t" value="${b.title}"></div>
    <div class="fld"><label for="eb-a">金额（元）</label><input type="number" id="eb-a" min="0" step="0.01" value="${b.amount}" inputmode="decimal"></div>
    <div class="fld"><label for="eb-k">费用类型</label><select id="eb-k">${Object.entries(BILL_KIND).map(([k, v]) => `<option value="${k}" ${k === billKindOf(b) ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div class="srctag" style="margin-top:6px">${BILL_KIND_HINT[billKindOf(b)]}${b.method === 'days' ? '；这笔现在按登记在住天数分，保存后改回平均分摊' : ''}</div></div>
    <div class="fld"><label for="eb-p">垫付人</label><select id="eb-p">${accountHolders().map(m =>
      `<option value="${m.id}" ${m.id === b.payer ? 'selected' : ''}>${m.name}</option>`).join('')}</select></div>
    <div class="fld"><label>参与成员</label><div class="who-pick" id="eb-w">${living().map(m =>
      `<button type="button" data-m="${m.id}" aria-pressed="${b.people.includes(m.id)}">${av(m.id,'sm')}${m.name}</button>`).join('')}</div></div>
    <div class="understand"><div class="uh">改完之后</div><div class="ub" id="eb-prev"></div></div>
    <div class="acts">
      <button class="btn danger" data-act="delBill" data-id="${b.id}">删除这笔</button>
      <button class="btn" data-act="close">取消</button>
      <button class="btn pri" data-act="doEditBill">保存</button></div>`);
  const upd = () => {
    const a = parseFloat(document.getElementById('eb-a').value) || 0;
    const ppl = [...sheetEl().querySelectorAll('#eb-w button[aria-pressed="true"]')].map(x => x.dataset.m);
    const c = splitCents(Math.round(a * 100), ppl);
    document.getElementById('eb-prev').innerHTML =
      (ppl.map(p => uline(mem(p).name, yuan(c[p] / 100))).join('') +
        (ppl.length ? uline('<span style="color:var(--ink-3);font-weight:400">合计</span>', yuan(a)) : '')) ||
      uline('提示', '至少选择一位成员');
  };
  upd();
  document.getElementById('eb-a').addEventListener('input', upd);
  sheetEl().querySelectorAll('#eb-w button').forEach(x => x.addEventListener('click', () => {
    const on = x.getAttribute('aria-pressed') === 'true';
    if (on && sheetEl().querySelectorAll('#eb-w button[aria-pressed="true"]').length === 1) return;
    x.setAttribute('aria-pressed', on ? 'false' : 'true'); upd();
  }));
  sheetEl().dataset.bid = id;
}

function editAwaySheet(id) {
  const a = S.away.find(x => x.id === id);
  openSheet(`<h3>修改离家登记</h3>
    <p class="hint">改完之后，值日暂缓范围和登记在住天数都会跟着重新计算。</p>
    <div class="fld"><label for="ea-f">开始</label><select id="ea-f">${dayOpts(a.fromDn, -3, 30)}</select></div>
    <div class="fld"><label for="ea-t">结束</label><select id="ea-t">${dayOpts(a.toDn, -3, 60)}</select></div>
    <div class="srctag">共 ${awayDays(a)} 天。改完之后，值日暂缓范围和登记在住天数都会跟着重新算。</div>
    <div class="acts">
      <button class="btn danger" data-act="delAway" data-id="${a.id}">取消这次离家计划</button>
      <button class="btn" data-act="close">返回</button>
      <button class="btn pri" data-act="doEditAway">保存</button></div>`);
  sheetEl().dataset.aid = id;
}

function editVisitSheet(id) {
  const v = S.visits.find(x => x.id === id);
  const o = overnightRule();
  openSheet(`<h3>修改访客登记</h3>
    <p class="hint">改了日期或留宿信息，本周留宿次数和约定判断都会重新算。</p>
    <div class="fld"><label for="ev-d">日期</label><select id="ev-d">${dayOpts(v.dn, -7, 14)}</select></div>
    <div class="fld"><label for="ev-t">到访时间</label><input type="text" id="ev-t" value="${v.time}"></div>
    <div class="fld"><label>是否留宿</label><div class="who-pick" id="ev-o">
      <button type="button" data-v="0" aria-pressed="${!v.overnight}">不留宿</button>
      <button type="button" data-v="1" aria-pressed="${v.overnight}">留宿</button></div></div>
    <div class="notice">${svg(I.info)}<span>当前 ${mem(v.host).name} 的「${v.guest}」本周共登记 ${nightsOf(v.host, v.guestId)} 晚，约定是同一访客每周 ${o.limit} 晚。</span></div>
    <div class="acts">
      <button class="btn danger" data-act="delVisit" data-id="${v.id}">取消这次登记</button>
      <button class="btn" data-act="close">返回</button>
      <button class="btn pri" data-act="doEditVisit">保存</button></div>`);
  sheetEl().querySelectorAll('#ev-o button').forEach(b => b.addEventListener('click', () => {
    sheetEl().querySelectorAll('#ev-o button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
  }));
  sheetEl().dataset.vid = id;
}

function editRepairSheet(id) {
  const r = S.repairs.find(x => x.id === id);
  const accepted = r.timeline.length > 1;
  openSheet(`<h3>${r.desc}</h3>
    <p class="hint">${accepted ? '租房中介已经受理，这时只能补充说明，不能再撤回。' : '还没有被受理，可以补充描述或撤回这张单。'}</p>
    <div class="fld"><label for="er-d">补充说明</label><input type="text" id="er-d" placeholder="例如：换过灯泡还是不亮"></div>
    <div class="acts">
      ${accepted
        ? `<button class="btn" data-act="doneRepair" data-id="${r.id}">标记已修好</button>`
        : `<button class="btn danger" data-act="delRepair" data-id="${r.id}">撤回报修</button>`}
      <button class="btn" data-act="close">返回</button>
      <button class="btn pri" data-act="doEditRepair">补充</button></div>`);
  sheetEl().dataset.rid = id;
}

function shareSheet(id) {
  const s = S.supplies.find(x => x.id === id);
  const cur = s.kind === 'private' ? 'private' : s.rule.startsWith('可直接') ? 'free' : 'ask';
  openSheet(`<h3>${s.name} 的共享方式</h3>
    <p class="hint">改成"不共享"之后，其他室友的可借列表里会立刻看不到这件东西。</p>
    <div class="opts">
      ${[['private','不共享','只有你能看到具体内容'],
         ['free','可以直接使用','其他人不用问，用完归位'],
         ['ask','使用前问我','其他人发起请求，你同意后才算借出']].map(([k, t, d]) => `
        <button class="opt" data-act="doShare" data-id="${s.id}" data-v="${k}" aria-pressed="${cur === k}">
          <span><b style="font-family:var(--f-d)">${t}</b>
          <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">${d}</span></span>
          <span class="ok">${svg(I.check,2.4)}</span></button>`).join('')}
    </div>
    <div class="acts"><button class="btn" data-act="close">返回</button></div>`);
}

/* 空间重新划分：真的写回分区，并留下共同设定的时间 */
function redivideSheet() {
  openSheet(`<h3>重新划分公共空间</h3>
    <p class="hint">分区是大家一起定的。换一种分法需要全员认可，这里先选一个方案。</p>
    <div class="opts">
      <button class="opt" data-act="doRedivide" data-v="rotate">
        <span><b style="font-family:var(--f-d)">顺次轮换一格</b>
        <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">每个人往下挪一格，公共区保持不变</span></span>
        <span class="ok">${svg(I.check,2.4)}</span></button>
      <button class="opt" data-act="doRedivide" data-v="keep">
        <span><b style="font-family:var(--f-d)">维持现在的分法</b>
        <span style="display:block;font-size:12.5px;color:var(--ink-3);font-weight:400">不做改动，留个记录说明讨论过</span></span>
        <span class="ok">${svg(I.check,2.4)}</span></button>
    </div>
    <div class="acts"><button class="btn" data-act="close">取消</button></div>`);
}

/* 临时任务：不进入固定任务模板 */
function taskSheet() {
  openSheet(`<h3>加一个临时任务</h3>
    <p class="hint">只这一次，不会变成固定任务。固定任务的改动需要全员确认。</p>
    <div class="fld"><label for="nt">任务内容</label><input type="text" id="nt" placeholder="例如：周六整理阳台"></div>
    <div class="fld"><label for="nw">负责人</label><select id="nw">${living().map(m =>
      `<option value="${m.id}" ${m.id === ME ? 'selected' : ''}>${m.name}${m.id === ME ? '（你）' : ''}</option>`).join('')}</select></div>
    <div class="fld"><label for="nd">时间</label><select id="nd">
      <option value="0">今天</option><option value="1">明天</option><option value="week">本周内</option></select></div>
    ${acts('doTask', '添加')}`);
}

function billSheet() {
  openSheet(`<h3>记一笔公共费用</h3>
    <p class="hint">默认平均分摊。只有水电燃气这类随使用变化的费用，才会在有人离家时建议按在住天数分。</p>
    <div class="fld"><label for="bt">费用名称</label><input type="text" id="bt" placeholder="例如：9月水电费"></div>
    <div class="fld"><label for="bk">费用类型</label><select id="bk">${Object.entries(BILL_KIND).map(([k, v]) => `<option value="${k}" ${k === 'other' ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div class="srctag" id="bkHint" style="margin-top:6px"></div></div>
    <div class="fld"><label for="ba">金额（元）</label><input type="number" id="ba" min="0" step="0.01" placeholder="0.00" inputmode="decimal"></div>
    <div class="fld"><label for="bp">垫付人</label><select id="bp">${living().map(m => `<option value="${m.id}" ${m.id === ME ? 'selected' : ''}>${m.name}${m.id === ME ? '（你）' : ''}</option>`).join('')}</select></div>
    <div class="fld"><label>参与成员</label><div class="who-pick" id="bw">${living().map(m => `<button type="button" data-m="${m.id}" aria-pressed="true">${av(m.id, 'sm')}${m.name}</button>`).join('')}</div></div>
    <div class="fld" id="bmWrap"><label for="bm">分摊方式</label><select id="bm">
      <option value="even">平均分摊</option>
      <option value="days">按登记在住天数</option></select></div>
    <div class="understand"><div class="uh">分摊预览</div><div class="ub" id="bPrev"></div></div>
    ${acts('doBill', '保存')}`);
  let kindTouched = false;
  const upd = () => {
    const a = parseFloat(document.getElementById('ba').value) || 0;
    const people = [...sheetEl().querySelectorAll('#bw button[aria-pressed="true"]')].map(b => b.dataset.m);
    /* 类型先按名称猜，用户改过就以用户的为准；按天数只对水电燃气开放 */
    if (!kindTouched) document.getElementById('bk').value = guessBillKind(document.getElementById('bt').value);
    const kind = document.getElementById('bk').value;
    document.getElementById('bkHint').textContent = BILL_KIND_HINT[kind];
    document.getElementById('bmWrap').hidden = kind !== 'utility';
    const method = kind === 'utility' ? document.getElementById('bm').value : 'even';
    let lines = '';
    if (method === 'days') {
      const rows = people.map(id => ({ id, days: Math.max(0, S.utilityForecast.days - awayDaysOf(id)) }));
      const cents = splitCents(Math.round(a * 100), people, Object.fromEntries(rows.map(r => [r.id, r.days])));
      lines = rows.map(r => uline(`${mem(r.id).name}<span style="font-weight:400;color:var(--ink-3)"> ${r.days} 天</span>`,
        yuan(cents[r.id] / 100))).join('');
    } else {
      const ce = splitCents(Math.round(a * 100), people);
      lines = people.map(id => uline(mem(id).name, yuan(ce[id] / 100))).join('');
    }
    document.getElementById('bPrev').innerHTML = lines || uline('提示', '至少选择一位成员');
  };
  upd();
  ['ba', 'bm', 'bt'].forEach(i => document.getElementById(i).addEventListener('input', upd));
  document.getElementById('bm').addEventListener('change', upd);
  document.getElementById('bk').addEventListener('change', () => { kindTouched = true; upd(); });
  sheetEl().querySelectorAll('#bw button').forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') === 'true';
    if (on && sheetEl().querySelectorAll('#bw button[aria-pressed="true"]').length === 1) return;
    b.setAttribute('aria-pressed', on ? 'false' : 'true'); upd();
  }));
}

function visitSheet(presetOvernight) {
  const o = overnightRule();
  openSheet(`<h3>登记一位访客</h3>
    <p class="hint">普通到访只需要告知。留宿会对照现在的约定，超过约定不会被禁止，只是先问问大家。</p>
    <div class="fld"><label for="vh">谁的访客</label><select id="vh">${living().map(m =>
      `<option value="${m.id}" ${m.id === ME ? 'selected' : ''}>${m.name}${m.id === ME ? '（你）' : ''}</option>`).join('')}</select></div>
    <div class="fld"><label for="vg">怎么称呼这位访客？</label><input type="text" id="vg" value="朋友" placeholder="例如：女朋友 / 小王 / 同事A">
      <div class="who-pick" id="vgs" style="margin-top:7px"></div>
      <div class="srctag">不需要真实姓名，只是为了分清是不是同一个人：同一个称呼就按同一位访客累计</div></div>
    <div class="fld"><label for="vd">日期</label><select id="vd">
      <option value="0">今天</option><option value="1">明天</option><option value="2">后天</option></select></div>
    <div class="fld"><label for="vw">到访时间</label><input type="text" id="vw" value="19:00–22:00"></div>
    <div class="fld"><label>是否留宿</label><div class="who-pick" id="vo">
      <button type="button" data-v="0" aria-pressed="${!presetOvernight}">不留宿</button>
      <button type="button" data-v="1" aria-pressed="${!!presetOvernight}">留宿</button></div></div>
    <div class="fld" id="vnWrap" ${presetOvernight ? '' : 'hidden'}><label for="vn">留宿几晚</label>
      <input type="number" id="vn" min="1" max="7" value="1" inputmode="numeric"></div>
    <div id="vCheck"></div>
    ${acts('doVisit', '登记')}`);
  /* 这位成员登记过的访客做成可点的称呼，点一下就复用同一个人 */
  const chips = () => {
    const host = document.getElementById('vh').value, cur = document.getElementById('vg').value.trim();
    document.getElementById('vgs').innerHTML = guestsOf(host).map(g =>
      `<button type="button" data-g="${g.guest}" aria-pressed="${g.guest === cur}">${g.guest}<small style="color:var(--ink-4);font-weight:400">${g.nights ? ` · 本周 ${g.nights} 晚` : ''}</small></button>`).join('');
    sheetEl().querySelectorAll('#vgs button').forEach(b => b.addEventListener('click', () => { document.getElementById('vg').value = b.dataset.g; upd(); }));
  };
  const upd = () => {
    const on = sheetEl().querySelector('#vo button[aria-pressed="true"]').dataset.v === '1';
    const host = document.getElementById('vh').value;
    const guest = document.getElementById('vg').value.trim() || '朋友';
    const add = on ? (parseInt(document.getElementById('vn').value) || 1) : 0;
    document.getElementById('vnWrap').hidden = !on;
    chips();
    const ck = stayCheck(host, guestKey(host, guest), add);
    const over = ck.total - ck.allow;
    document.getElementById('vCheck').innerHTML = !on ? `
      <div class="notice">${svg(I.info)}<span>普通到访只需要告知其他室友，不需要征求同意。</span></div>`
      : !ck.over ? `
      <div class="notice" style="background:var(--jade-soft);color:var(--jade-ink)">${svg(I.check)}<span>
        ${mem(host).name} 的「${guest}」本周已登记 ${ck.had} 晚，加上这次共 ${ck.total} 晚，仍在${
          ck.extra ? `约定 ${ck.limit} 晚 + 已批准例外 ${ck.extra} 晚` : `约定的每周 ${ck.limit} 晚`}之内。</span></div>`
      : `<div class="fair"><div class="fh">${svg(I.info)}超出的 ${over} 晚要先申请一次例外</div>
        <p>${mem(host).name} 的「${guest}」本周已登记 ${ck.had} 晚，加上这次共 ${ck.total} 晚，超过可接受的 ${ck.allow} 晚${
          ck.extra ? `（约定 ${ck.limit} 晚 + 已批准例外 ${ck.extra} 晚）` : `（约定每周 ${ck.limit} 晚）`}。
          ${over < add ? `其中 ${add - over} 晚会直接登记，` : ''}超出的 ${over} 晚<b>不会先记上</b>，
          而是作为一次临时例外请室友分别回应，全部同意之后才正式登记。长期约定不会因此改变。</p></div>`;
  };
  upd();
  document.getElementById('vn').addEventListener('input', upd);
  document.getElementById('vg').addEventListener('input', upd);
  document.getElementById('vh').addEventListener('change', upd);
  sheetEl().querySelectorAll('#vo button').forEach(b => b.addEventListener('click', () => {
    sheetEl().querySelectorAll('#vo button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); upd();
  }));
}

/* ---------- 长期规则下的临时例外 ----------
   用户不反对约定，只是这一次需要突破。申请要说清楚：哪位访客、几晚、到什么时候。
   批准之前这几晚不会计入留宿记录；批准之后只记一次；到期自动失效，约定本身不变。 */
function exceptionSheet(pre) {
  const o = overnightRule();
  const d = pre || (() => {
    const p = (o.pairs || [])[0] || { host:ME, guest:'朋友', guestId:guestKey(ME, '朋友') };
    const ck = stayCheck(p.host, p.guestId, 0);
    return { host:p.host, guest:p.guest, guestId:p.guestId, nights:1, fromDn:dnNow(),
      toDn:weekEndDn(dnNow()), had:ck.had, limit:ck.limit, extra:ck.extra, registered:0 };
  })();
  const toDn = Math.max(d.fromDn, weekEndDn(dnNow()));
  const need = living().map(m => m.id).filter(x => x !== (d.host || ME));
  openSheet(`<h3>申请一次临时例外</h3>
    <p class="hint">你不是要改掉「${o.rule.title}」，只是这一次需要多一点空间。约定本身不会变，例外到期自动失效。</p>
    ${understandBox('这次申请', [
      uline('访客', `${mem(d.host).name} 登记的「${d.guest}」`),
      uline('本周已登记', `${d.had} 晚${d.extra ? ` + 已批准例外 ${d.extra} 晚` : ''}`),
      uline('现有约定', `同一访客每周最多 ${d.limit} 晚`),
      d.registered ? uline('直接登记', `${d.registered} 晚（仍在约定内）`) : '',
      uline('本次申请', `<span style="color:var(--peach)">额外 ${d.nights} 晚</span>`),
      uline('有效期', `${fmtDn(d.fromDn)} — ${fmtDn(toDn)}（本周结束即失效）`)
    ].filter(Boolean))}
    <div class="fld"><label for="xn">额外留宿几晚</label><input type="number" id="xn" min="1" max="5" value="${d.nights}" inputmode="numeric"></div>
    <div class="fld"><label for="xr">想说明一下原因吗（可留空）</label>
      <input type="text" id="xr" value="${pre && pre.reason || ''}" placeholder="例如：她这几天项目赶工，住得近一点"></div>
    ${impactBox([
      `发给 ${need.map(x => mem(x).name).join('、') || '其他在住成员'}，每个人分别回应，你不能替别人同意`,
      '全部同意之前，这几晚<b>不会</b>计入留宿记录，也不会显示成已超出约定',
      '全部同意之后这几晚正式登记，只记一次，不会既算例外又算一次超限',
      `${fmtDn(toDn)} 之后例外自动失效，「${o.rule.title}」原样生效`,
      '如果你觉得这种情况以后会经常发生，可以把它转成对约定本身的讨论'
    ])}
    ${acts('doException', '发出申请')}`);
  sheetEl().dataset.ex = JSON.stringify({ ...d, toDn });
}

function awaySheet() {
  openSheet(`<h3>登记离家计划</h3>
    <p class="hint">临时外出、请假不在家用这个。登记之后，值日、公共采购和水电分摊都会跟着调整；正式搬出请走「搬出与退租」。</p>
    <div class="fld"><label for="af">开始</label><select id="af">${dayOpts(dnNow() + 4, 0, 30)}</select></div>
    <div class="fld"><label for="at">结束</label><select id="at">${dayOpts(dnNow() + 8, 0, 60)}</select></div>
    ${impactBox(['期间你的值日任务会暂缓，后续轮换补偿', '这段时间不会分配公共采购任务给你',
                 '月末水电可按实际居住天数计算', '家里的状态显示为离家中'])}
    ${acts('doAway2', '确认离家')}`);
}

function deferSheet(id) {
  const t = S.tasks.find(x => x.id === id);
  const cand = living().filter(m => m.id !== ME && statusOf(m.id) === 'in')
    .map(m => ({ m, load: S.tasks.filter(x => x.who === m.id && !x.done).length }))
    .sort((a, b) => a.load - b.load)[0];
  openSheet(`<h3>今天做不了「${t.task}」</h3>
    <p class="hint">说明一下原因就好。这不会被记成失误，也不会通知任何人你"没做"。</p>
    <div class="opts">
      <button class="opt" data-act="doDefer" data-k="away">今天不在家<span class="ok">${svg(I.check, 2.4)}</span></button>
      <button class="opt" data-act="doDefer" data-k="busy">今天太忙<span class="ok">${svg(I.check, 2.4)}</span></button>
      <button class="opt" data-act="doDefer" data-k="swap">想和别人换班<span class="ok">${svg(I.check, 2.4)}</span></button>
    </div>
    ${cand ? `<div class="notice" style="margin-top:13px">${svg(I.info)}<span>
      如果选择换班，管家会推荐 <b>${cand.m.name}</b>：目前在家，本周待完成任务最少（${cand.load} 项）。
      换班需要对方同意，不会自动指派。</span></div>` : ''}
    <div class="acts"><button class="btn" data-act="close">取消</button></div>`);
  sheetEl().dataset.tid = id;
  if (cand) sheetEl().dataset.cand = cand.m.id;
}

function stewardSheet(id) {
  /* 只拿公开的问题记录做摘要，"仅自己留存"的不会进摘要 */
  const it = (id && S.issues.find(x => x.id === id)) || visibleIssues().find(x => x.follow !== 'self');
  const rule = it ? S.rules.find(r => r.id === it.rule) : null;
  openSheet(`<h3>管家协调摘要</h3>
    <p class="hint">这份摘要只描述规则和现状之间的差距，不评价任何人。提交前你可以看到全部内容。</p>
    ${understandBox('将提交给 ' + HOUSE.steward, [
      uline('住所', HOUSE.name),
      uline('当前问题', it ? it.title : '—'),
      uline('对应约定', rule ? rule.title : '暂无相关约定'),
      uline('最近情况', it ? `${it.window}出现 ${it.count} 次提醒` : '—'),
      uline('已尝试', '系统中立提醒 → 重新明确约定'),
      uline('当前诉求', '希望协助组织一次标准确认')
    ])}
    <div class="notice" style="margin-bottom:14px">${svg(I.info)}<span>摘要中不包含任何成员的姓名和具体行为描述。</span></div>
    <div class="notice" style="margin-bottom:14px">${svg(I.alert)}<span>演示环境不会真的发送给机构：确认后会生成一条<b>模拟工单</b>，你可以在问题记录里看到它的状态和回复。</span></div>
    ${acts('doSteward', '提交给管家（模拟）')}`, true);
  if (it) sheetEl().dataset.iid = it.id;
}

function clarifySheet(id) {
  const it = S.issues.find(x => x.id === id);
  const rule = S.rules.find(r => r.id === it.rule);
  openSheet(`<h3>重新明确「${rule.title}」</h3>
    <p class="hint">出现多次提醒，通常说明标准不够具体，而不是有人故意不做。把它拆成几条能判断的标准。</p>
    <div class="opts">
      ${['台面无明显油污', '厨余当天处理', '锅具当天清洗', '水槽不留过夜碗碟'].map(x => `
        <button class="opt" data-act="clarifyPick" aria-pressed="true">${x}<span class="ok">${svg(I.check, 2.4)}</span></button>`).join('')}
    </div>
    ${impactBox(['这条约定的描述会更新为选中的具体标准', '「正在讨论」中新增一个议题，等待全员确认',
                 '问题记录回到第 1 级，重新从中立提醒开始'])}
    ${acts('doClarify', '发起重新确认')}`);
  sheetEl().dataset.iid = id;
}
