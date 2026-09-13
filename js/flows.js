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
const TODAY_DATE = new Date(2026, 8, 12);
const CN_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7 };
const fmtDate = d => `${d.getMonth() + 1}月${d.getDate()}日`;

function weekdayDate(cn, nextWeek) {
  const target = CN_NUM[cn];
  const ci = TODAY_DATE.getDay() === 0 ? 7 : TODAY_DATE.getDay();
  const monday = new Date(TODAY_DATE); monday.setDate(TODAY_DATE.getDate() - (ci - 1));
  const d = new Date(monday); d.setDate(monday.getDate() + (nextWeek ? 7 : 0) + (target - 1));
  return d;
}

const CN_DIGIT = { '零':0,'一':1,'两':2,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10 };
function cnNum(s) {
  if (/^\d+$/.test(s)) return parseInt(s);
  if (s.length === 1) return CN_DIGIT[s] ?? 0;
  if (s[0] === '十') return 10 + (CN_DIGIT[s[1]] ?? 0);
  if (s[1] === '十') return (CN_DIGIT[s[0]] ?? 0) * 10 + (CN_DIGIT[s[2]] ?? 0);
  return CN_DIGIT[s[0]] ?? 0;
}

function parseButler(raw) {
  const text = (raw || '').trim();
  if (!text) return null;

  /* 先判断是不是在更新库存 —— "只剩两卷"和"买了两卷"是两件完全不同的事 */
  const hitSupply = S.supplies.find(s => s.kind === 'public' && text.includes(s.name));
  if (hitSupply && /只剩|还剩|快没|快用完|用完了|没了|不多|剩下/.test(text) && !/买|购/.test(text)) {
    if (hitSupply.mode === 'count') {
      const m = text.match(/(\d+|[一二两三四五六七八九十]+)\s*(?:卷|个|瓶|包|条|袋|盒|提|片)/);
      return { type:'stock', supply:hitSupply, qty: m ? cnNum(m[1]) : Math.max(0, hitSupply.min - 1) };
    }
    const state = /用完了|已经没/.test(text) ? '已用完'
                : /不多/.test(text) ? '不多了' : '快用完';
    return { type:'stock', supply:hitSupply, state };
  }

  /* 金额：29块9 / 29.9元 / ¥29.9 */
  let amount = 0;
  let m = text.match(/(\d+)\s*块\s*(\d)(?!\d)/);
  if (m) amount = parseFloat(m[1] + '.' + m[2]);
  if (!amount && (m = text.match(/(\d+(?:\.\d+)?)\s*(?:块|元|圆)/))) amount = parseFloat(m[1]);
  if (!amount && (m = text.match(/[¥￥]\s*(\d+(?:\.\d+)?)/))) amount = parseFloat(m[1]);

  /* 数量 + 单位 */
  let qty = 0, unit = '';
  if ((m = text.match(/(\d+)\s*(卷|个|瓶|包|条|袋|盒|提|片)/))) { qty = parseInt(m[1]); unit = m[2]; }

  /* 购买公共用品 */
  if (/买|购|补充|添|囤/.test(text)) {
    const hit = S.supplies.find(s => s.kind === 'public' && text.includes(s.name));
    const people = /各买各|我自己|私人/.test(text) ? [ME] : living().map(x => x.id);
    return { type:'buy', supply: hit, name: hit ? hit.name : '公共用品',
             qty: qty || (hit ? hit.min : 1), unit: unit || (hit ? hit.unit : '件'),
             amount, people };
  }

  /* 离家 */
  if (/离家|回老家|出差|不在家|外出|旅行|回家住|出去几天/.test(text)) {
    let from = null, to = null;
    if ((m = text.match(/(下?)周([一二三四五六日天]).{0,3}?到.{0,3}?(下?)周?([一二三四五六日天])/))) {
      from = weekdayDate(m[2], m[1] === '下');
      to   = weekdayDate(m[4], (m[3] === '下') || (m[1] === '下'));
      if (to < from) to.setDate(to.getDate() + 7);
    } else if ((m = text.match(/(\d+)月(\d+)[日号].{0,3}?到.{0,3}?(?:(\d+)月)?(\d+)[日号]/))) {
      from = new Date(2026, +m[1] - 1, +m[2]);
      to   = new Date(2026, (m[3] ? +m[3] : +m[1]) - 1, +m[4]);
    }
    if (from && to) {
      const days = Math.round((to - from) / 86400000) + 1;
      return { type:'away', from: fmtDate(from), to: fmtDate(to), days };
    }
    return { type:'away', from:'', to:'', days:0, needDates:true };
  }

  /* 访客 */
  if (/访客|朋友来|来玩|过夜|留宿|住一晚|来住/.test(text)) {
    return { type:'visit', overnight: /过夜|留宿|住一晚|住几天/.test(text) };
  }

  /* 不好开口 */
  if (/不好开口|不好意思说|难开口|有点介意|忍很久/.test(text)) return { type:'awkward' };

  return { type:'unknown', text };
}

function butlerSheet(raw) {
  const p = parseButler(raw);
  if (!p) return;

  if (p.type === 'awkward') { closeSheet(); awkwardSheet(); return; }

  if (p.type === 'unknown') {
    openSheet(`<h3>管家没有完全听懂</h3>
      <p class="hint">为了不把事情做错，管家只在能明确理解时才会执行。你可以换个说法，或者直接选一件事。</p>
      ${understandBox('你说的是', [uline('原话', `<span style="font-weight:400">${p.text}</span>`)])}
      <div class="stack">
        <button class="btn wide" data-act="butlerFill" data-text="我刚买了29块9的厕纸，12卷，三个人平分">我买了公共用品</button>
        <button class="btn wide" data-act="butlerFill" data-text="我下周三到周日回老家">我要离开几天</button>
        <button class="btn wide" data-act="newVisit">我有访客要来</button>
        <button class="btn wide" data-act="awkward">有件事不好开口</button>
      </div>
      <div class="acts"><button class="btn" data-act="close">关闭</button></div>`);
    return;
  }

  if (p.type === 'stock') {
    const s = p.supply;
    S.pending = p;
    const after = s.mode === 'count' ? `${s.qty} → ${p.qty} ${s.unit}` : `${s.state} → ${p.state}`;
    const willLow = s.mode === 'count' ? p.qty < s.min : ['快用完','已用完'].includes(p.state);
    openSheet(`<h3>管家理解成这样</h3>
      <p class="hint">这会更新公共物品的状态，记在你名下，其他人能看到是谁什么时候更新的。</p>
      ${understandBox('理解结果', [
        uline('动作', '更新公共物品'),
        uline('物品', s.name),
        uline(s.mode === 'count' ? '数量' : '状态', after),
        uline('更新人', `${av(ME, 'sm')}${mem(ME).name}`)
      ])}
      ${impactBox([
        `${s.name}的记录更新为 ${s.mode === 'count' ? p.qty + ' ' + s.unit : p.state}`,
        willLow ? '会低于约定水位，首页出现补充提醒' : '仍在约定水位以上，不会产生提醒',
        '这次更新会记进家里动态',
        '不会产生任何费用，除非你之后选择补充并记账'
      ])}
      ${acts('doStock', '确认更新')}`);
    return;
  }

  if (p.type === 'buy') {
    const per = p.amount / p.people.length;
    S.pending = p;
    const after = (p.supply ? p.supply.qty : 0) + p.qty;
    openSheet(`<h3>管家理解成这样</h3>
      <p class="hint">这会同时改变库存和账单，所以先确认一下再执行。</p>
      ${understandBox('理解结果', [
        uline('物品', p.name),
        uline('库存变化', p.supply ? `${p.supply.qty} → ${after} ${p.unit}` : `+${p.qty} ${p.unit}`),
        uline('金额', yuan(p.amount)),
        uline('付款人', `${av(ME, 'sm')}${mem(ME).name}`),
        uline('参与分摊', p.people.map(x => av(x, 'sm')).join('')),
        uline('每人承担', `<span style="color:var(--jade)">${yuan(per)}</span>`)
      ])}
      ${impactBox([
        `${p.name}库存更新为 ${after} ${p.unit}`,
        p.supply && after >= p.supply.min ? '首页的库存不足提醒会消失' : '库存仍低于提醒水位，提醒会保留',
        `账单新增一笔 ${yuan(p.amount)} 的公共支出，每人 ${yuan(per)}`,
        '家里动态增加一条记录'
      ])}
      ${acts('doBuy', '确认并执行')}`);
    return;
  }

  if (p.type === 'away') {
    if (p.needDates) { closeSheet(); awaySheet(); return; }
    S.pending = p;
    const affected = S.tasks.filter(t => t.who === ME && !t.done);
    openSheet(`<h3>管家理解成这样</h3>
      <p class="hint">离家会影响值日、采购和费用分摊，确认后这些都会自动跟着调整。</p>
      ${understandBox('理解结果', [
        uline('类型', '离家'),
        uline('时间', `${p.from} — ${p.to}`),
        uline('天数', `${p.days} 天`),
        uline('成员', `${av(ME, 'sm')}${mem(ME).name}`)
      ])}
      ${impactBox([
        `值日：期间你的 ${affected.length} 项任务会暂缓，后续轮换补偿`,
        '公共采购：这段时间不会分配采购任务给你',
        `费用：月末水电可按实际居住天数计算，你的居住天数为 ${30 - p.days} 天`,
        '家里的状态和头像会显示为离家中'
      ])}
      ${acts('doAway', '确认离家')}`);
    return;
  }

  if (p.type === 'visit') { closeSheet(); visitSheet(p.overnight); }
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
    return { exceeded: o.exceeded, limit: o.limit, actual: o.actual,
      text: o.exceeded
        ? `根据当前登记记录，这位访客本周已留宿 ${o.actual} 晚，超过了大家约定的每周 ${o.limit} 晚。`
        : `根据当前登记记录，这位访客本周已留宿 ${o.actual} 晚，仍在约定的每周 ${o.limit} 晚之内。` };
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
          ? opt('remind', '按现有约定提醒', '由管家私下发出，不点名、不公开，只说明约定和登记情况', true) +
            opt('clarify', '重新确认这条约定', '如果觉得每周 ' + (gap.limit || '') + ' 晚这个数字本身需要调整', false)
          : existing
            ? opt('clarify', '重新确认这条约定', '把标准写得更具体，减少理解上的差异', true)
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
    const WAY = { private:'私下聊聊', house:'一起讨论', rule:'建立约定', remind:'按现有约定提醒', clarify:'重新确认这条约定' };
    const draft = existing
      ? `想和你对一下访客留宿的安排。我们之前说好的是同一访客每周最多留宿 ${gap ? gap.limit : 2} 晚，这周好像到 ${gap ? gap.actual : 3} 晚了。我不是要计较这个，就是想问问你最近是不是有什么特殊情况，需要的话我们把这条重新定一下也可以。`
      : `想和你聊一下${a.focus}这件事。我们家里目前没有相关的约定，我想问问你的想法，看能不能定一个大家都舒服的方式。`;

    const impact = {
      remind: ['由合租管家私下发出，不会公开，也不会显示是谁触发的',
               '只说明约定内容和登记情况，不做评价',
               '不新增约定——这件事已经有约定了', '这次提醒会记入居住问题记录的第 1 级'],
      clarify: [`「${existing ? existing.title : a.focus}」进入重新确认`, '可以把标准或数字改得更具体',
                '不新增规则，只修改现有这一条', '需要全员确认后才会更新'],
      rule: ['「正在讨论」中新增一个议题', '其他人看到的是议题本身，不会看到是谁提的', '全员同意后成为共同约定'],
      house: ['「正在讨论」中新增一个议题', '不点名，其他人看到的是问题本身', '达成一致后可以转成约定'],
      private: ['这段话只发给相关的人', '家里动态中不会出现任何记录', '如果之后仍有问题，可以再放到一起讨论']
    };

    return openSheet(`
      <h3>${WAY[a.way]}</h3>
      <p class="hint">${a.way === 'private'
        ? '下面这段话去掉了情绪和指责，只说事实和你的想法。发出前你可以再改。'
        : '确认之前，先看清楚这一步会产生什么。'}</p>
      ${a.way === 'private'
        ? `<div class="fld"><label>整理后的表达</label><textarea id="awkFinal">${draft}</textarea></div>`
        : understandBox('将要做的事', [
            uline('针对', a.focus),
            existing ? uline('对应约定', existing.title) : uline('现有约定', '暂无'),
            gap ? uline('当前情况', `<span style="font-weight:400;font-family:var(--f-b);text-align:right">${gap.text}</span>`) : '',
            uline('处理方式', WAY[a.way]),
            uline('署名', '不显示发起人')
          ].filter(Boolean))}
      ${a.way === 'rule' ? `<div class="suggest" style="margin-bottom:14px"><div class="sl">建议的约定</div><p>${sug}</p></div>` : ''}
      ${a.way === 'remind' ? `<div class="suggest" style="margin-bottom:14px"><div class="sl">管家会这样说</div>
        <p>本周登记的留宿次数已经超过大家之前约定的范围，需要一起确认一下后面的安排吗？</p></div>` : ''}
      ${impactBox(impact[a.way])}
      <div class="acts"><button class="btn" data-act="awkBack">上一步</button>
        <button class="btn pri" data-act="awkSubmit">${
          a.way === 'private' ? '发送' : a.way === 'remind' ? '发出提醒' : a.way === 'clarify' ? '发起重新确认' : '发起讨论'}</button></div>`);
  }
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
      uline('每人承担', a > 0 ? `<span style="color:var(--jade)">${yuan(a / living().length)}</span>` : '不产生费用');
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

/* 报修：住户提交，之后由相寓更新进度 */
function repairSheet() {
  openSheet(`<h3>我要报修</h3>
    <p class="hint">提交后由相寓受理并安排维修，处理进度会同步回来，你不用自己跟进。</p>
    <div class="fld"><label for="rpp">问题位置</label><select id="rpp">
      <option>厨房</option><option>卫生间</option><option>门锁</option><option>家电</option><option>其他</option></select></div>
    <div class="fld"><label for="rpd">问题描述</label><input type="text" id="rpd" placeholder="例如：厨房灯不亮了"></div>
    ${impactBox(['生成一张报修单，状态为「已提交」', '相寓受理后状态会自动更新', '维修安排会显示在生活页和我的页', '这次提交会记进家里动态'])}
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

/* 临时任务：不进入固定任务模板 */
function taskSheet() {
  openSheet(`<h3>加一个临时任务</h3>
    <p class="hint">只这一次，不会变成固定任务。固定任务的改动需要全员确认。</p>
    <div class="fld"><label for="nt">任务内容</label><input type="text" id="nt" placeholder="例如：周六整理阳台"></div>
    <div class="fld"><label for="nw">负责人</label><select id="nw">${living().map(m =>
      `<option value="${m.id}" ${m.id === ME ? 'selected' : ''}>${m.name}${m.id === ME ? '（你）' : ''}</option>`).join('')}</select></div>
    <div class="fld"><label for="nd">时间</label><select id="nd">
      <option>今天</option><option>本周内</option><option>周日</option></select></div>
    ${acts('doTask', '添加')}`);
}

function billSheet() {
  openSheet(`<h3>记一笔公共费用</h3>
    <p class="hint">默认平均分摊。有人长期不在家时，可以改成按实际居住天数。</p>
    <div class="fld"><label for="bt">费用名称</label><input type="text" id="bt" placeholder="例如：9月水电费"></div>
    <div class="fld"><label for="ba">金额（元）</label><input type="number" id="ba" min="0" step="0.01" placeholder="0.00" inputmode="decimal"></div>
    <div class="fld"><label for="bp">垫付人</label><select id="bp">${living().map(m => `<option value="${m.id}" ${m.id === ME ? 'selected' : ''}>${m.name}${m.id === ME ? '（你）' : ''}</option>`).join('')}</select></div>
    <div class="fld"><label>参与成员</label><div class="who-pick" id="bw">${living().map(m => `<button type="button" data-m="${m.id}" aria-pressed="true">${av(m.id, 'sm')}${m.name}</button>`).join('')}</div></div>
    <div class="fld"><label for="bm">分摊方式</label><select id="bm">
      <option value="even">平均分摊</option>
      <option value="days">按实际居住天数</option></select></div>
    <div class="understand"><div class="uh">分摊预览</div><div class="ub" id="bPrev"></div></div>
    ${acts('doBill', '保存')}`);
  const upd = () => {
    const a = parseFloat(document.getElementById('ba').value) || 0;
    const people = [...sheetEl().querySelectorAll('#bw button[aria-pressed="true"]')].map(b => b.dataset.m);
    const method = document.getElementById('bm').value;
    let lines = '';
    if (method === 'days') {
      const rows = people.map(id => {
        const off = S.away.filter(x => x.who === id).reduce((n, x) => n + x.days, 0);
        return { id, days: 30 - off, off };
      });
      const tot = rows.reduce((n, r) => n + r.days, 0) || 1;
      lines = rows.map(r => uline(`${mem(r.id).name}<span style="font-weight:400;color:var(--ink-3)"> ${r.days} 天</span>`,
        yuan(a * r.days / tot))).join('');
    } else {
      lines = people.map(id => uline(mem(id).name, yuan(a / (people.length || 1)))).join('');
    }
    document.getElementById('bPrev').innerHTML = lines || uline('提示', '至少选择一位成员');
  };
  upd();
  ['ba', 'bm'].forEach(i => document.getElementById(i).addEventListener('input', upd));
  document.getElementById('bm').addEventListener('change', upd);
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
    <div class="fld"><label for="vg">访客称呼</label><input type="text" id="vg" value="朋友"></div>
    <div class="fld"><label for="vd">日期</label><select id="vd">
      <option>今天</option><option>明天</option><option>后天</option></select></div>
    <div class="fld"><label for="vw">到访时间</label><input type="text" id="vw" value="19:00–22:00"></div>
    <div class="fld"><label>是否留宿</label><div class="who-pick" id="vo">
      <button type="button" data-v="0" aria-pressed="${!presetOvernight}">不留宿</button>
      <button type="button" data-v="1" aria-pressed="${!!presetOvernight}">留宿</button></div></div>
    <div class="fld" id="vnWrap" ${presetOvernight ? '' : 'hidden'}><label for="vn">留宿几晚</label>
      <input type="number" id="vn" min="1" max="7" value="1" inputmode="numeric"></div>
    <div id="vCheck"></div>
    ${acts('doVisit', '登记')}`);
  const upd = () => {
    const on = sheetEl().querySelector('#vo button[aria-pressed="true"]').dataset.v === '1';
    const host = document.getElementById('vh').value;
    const add = on ? (parseInt(document.getElementById('vn').value) || 1) : 0;
    document.getElementById('vnWrap').hidden = !on;
    const had = nightsOf(host), n = had + add;
    document.getElementById('vCheck').innerHTML = !on ? `
      <div class="notice">${svg(I.info)}<span>普通到访只需要告知其他室友，不需要征求同意。</span></div>`
      : n <= o.limit ? `
      <div class="notice" style="background:var(--jade-soft);color:var(--jade-ink)">${svg(I.check)}<span>
        ${mem(host).name} 本周已登记 ${had} 晚，加上这次共 ${n} 晚，仍在约定的每周 ${o.limit} 晚之内。</span></div>`
      : `<div class="fair"><div class="fh">${svg(I.info)}这次登记会超过现在的约定</div>
        <p>${mem(host).name} 本周已登记 ${had} 晚，加上这次共 ${n} 晚，超过约定的每周 ${o.limit} 晚。
           这不会被禁止，但建议先征求其他室友的意见。</p></div>`;
  };
  upd();
  document.getElementById('vn').addEventListener('input', upd);
  document.getElementById('vh').addEventListener('change', upd);
  sheetEl().querySelectorAll('#vo button').forEach(b => b.addEventListener('click', () => {
    sheetEl().querySelectorAll('#vo button').forEach(x => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); upd();
  }));
}

function awaySheet() {
  openSheet(`<h3>登记离家</h3>
    <p class="hint">登记之后，值日、公共采购和水电分摊都会跟着调整。</p>
    <div class="fld"><label for="af">开始</label><input type="text" id="af" value="9月16日"></div>
    <div class="fld"><label for="at">结束</label><input type="text" id="at" value="9月20日"></div>
    <div class="fld"><label for="ad">天数</label><input type="number" id="ad" value="5" min="1"></div>
    ${impactBox(['期间你的值日任务会暂缓，后续轮换补偿', '这段时间不会分配公共采购任务给你',
                 '月末水电可按实际居住天数计算', '家里的状态显示为离家中'])}
    ${acts('doAway2', '确认离家')}`);
}

function deferSheet(id) {
  const t = S.tasks.find(x => x.id === id);
  const cand = living().filter(m => m.id !== ME && statusOf(m.id) === 'home')
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

function stewardSheet() {
  const it = S.issues[0];
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
    ${acts('doSteward', '提交给管家')}`, true);
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
