/* ============================================================
   合租生活管家 · 数据层
   House 是核心对象，成员可以入住 / 离家 / 搬出，House 持续存在。
   ============================================================ */

const TODAY = '9月12日';

const HOUSE = {
  name: '望京西园三区 · 503',
  org: '相寓 · 托管房源',
  steward: '陈管家',
  nextClean: '周四 10:00',
  repair: { item: '厨房灯', status: '维修中', eta: '师傅预计周三上门' }
};

/* 生活偏好的两种性质：
   rule = 容易产生摩擦、需要形成共同规则的
   info = 只用于彼此了解、不需要统一的
   cmp  = 新成员加入时会拿来比对的。作息、做饭频率这类天生因人而异，
          比出"差异"只会制造没必要的协商，所以不参与比对。          */
const PREF_KEYS = [
  { k: 'quiet',    label: '安静时间',   kind: 'rule', cmp: true },
  { k: 'visitor',  label: '朋友来访',   kind: 'rule', cmp: true },
  { k: 'overnight',label: '访客留宿',   kind: 'rule', cmp: true },
  { k: 'kitchen',  label: '厨房恢复',   kind: 'rule', cmp: true },
  { k: 'supply',   label: '公共用品',   kind: 'rule', cmp: true },
  { k: 'temp',     label: '空调温度',   kind: 'rule', cmp: true },
  { k: 'smoke',    label: '吸烟',       kind: 'rule', cmp: true },
  { k: 'social',   label: '室友关系',   kind: 'info', cmp: true },
  { k: 'sleep',    label: '作息',       kind: 'info' },
  { k: 'conflict', label: '沟通方式',   kind: 'info' },
  { k: 'cook',     label: '做饭频率',   kind: 'info' },
  { k: 'pet',      label: '宠物',       kind: 'info' }
];

const MEMBERS = [
  { id:'yiming', name:'Yiming', short:'YM', c:'#2A7059', room:'02室', me:true, joined:'6月1日',
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'每周 ≤2 晚', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'25°C', smoke:'家里都不吸',
            sleep:'23:45 左右', social:'礼貌互不打扰', conflict:'系统先中立提醒', cook:'偶尔做饭', pet:'不养，可以接受' } },
  { id:'alex', name:'Alex', short:'AX', c:'#A3651E', room:'01室', joined:'4月15日',
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'不限', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'25°C', smoke:'家里都不吸',
            sleep:'00:30 左右', social:'偶尔一起聊天吃饭', conflict:'私下直接说', cook:'经常做饭', pet:'不养，可以接受' } },
  { id:'tom', name:'Tom', short:'TM', c:'#3F5F80', room:'03室', joined:'3月1日',
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'每周 ≤1 晚', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'26°C', smoke:'家里都不吸',
            sleep:'23:00 左右', social:'礼貌互不打扰', conflict:'系统先中立提醒', cook:'几乎不做饭', pet:'不养，可以接受' } },
  { id:'lin', name:'Lin', short:'LN', c:'#6B4A6E', room:'03室', incoming:true, joined:'9月20日',
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'不限', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'27°C', smoke:'家里都不吸',
            sleep:'00:30 左右', social:'礼貌互不打扰', conflict:'系统先中立提醒', cook:'偶尔做饭', pet:'不养，可以接受' } }
];

/* 最影响共同生活的四项，其余默认收起 */
const KEY_PREFS = ['quiet', 'overnight', 'kitchen', 'temp'];

const ME = 'yiming';
/* 当前用户改过的偏好存在 state 里，这样刷新后不会丢 */
const mem = id => {
  const base = MEMBERS.find(m => m.id === id) || { id, name:id, short:'?', c:'#8A938D', prefs:{} };
  if (id === ME && typeof S !== 'undefined' && S && S.myPrefs)
    return { ...base, prefs: { ...base.prefs, ...S.myPrefs } };
  return base;
};
/* 当前实际住在这里的人：不含尚未入住和已搬出的 */
const living = () => MEMBERS.filter(m => !m.incoming && !S.movedOut.includes(m.id)).map(m => mem(m.id));

/* ============ 图标 ============ */
const I = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>',
  life:'<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10Z"/>',
  bill:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M7 14h7M17 9.5v5"/>',
  talk:'<path d="M20 14a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8Z"/><path d="M8.5 10h7M8.5 13h4"/>',
  me:'<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.6-3.9 3.8-6 7.5-6s6.9 2.1 7.5 6"/>',
  chore:'<path d="M9.5 3h5l1 5h-7l1-5Z"/><path d="M12 8v4"/><path d="M6 21c0-4 2.7-9 6-9s6 5 6 9H6Z"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  space:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M12 3v18"/>',
  guest:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.5-3.4 3-5.3 6-5.3s5.5 1.9 6 5.3"/><path d="M17 8h5M19.5 5.5v5"/>',
  away:'<path d="M3 12h12"/><path d="m11 8 4 4-4 4"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>',
  wash:'<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.2"/><path d="M8 6.5h.01M11 6.5h.01"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.3 2"/>',
  scale:'<path d="M12 4v16M7 8h10"/><path d="m5 8-2.5 6h5L5 8ZM19 8l-2.5 6h5L19 8Z"/><path d="M8 20h8"/>',
  arrow:'<path d="M5 12h13"/><path d="m13 7 5 5-5 5"/>',
  back:'<path d="M19 12H6"/><path d="m11 7-5 5 5 5"/>',
  chev:'<path d="m9 6 6 6-6 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8h.01"/>',
  shield:'<path d="M12 3 5 6v6c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  alert:'<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4M12 17.2h.01"/>',
  spark:'<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z"/>',
  fridge:'<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9.5 6v2M9.5 13v2.5"/>',
  cabinet:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M9.5 9.5h.01M14.5 9.5h.01"/>',
  shelf:'<path d="M4 6h16M4 12h16M4 18h16"/><path d="M7 6v6M16 12v6"/>',
  shoe:'<path d="M3 16h12l3.5-3 2.5 1v2.5H3Z"/><path d="M3 16v-5h4l2 2"/>',
  tool:'<path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6l-8 8a2.3 2.3 0 0 1-3.2-3.2l8-8Z"/><path d="M6 6l3 3"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.6a3.5 3.5 0 0 1 7 0v2.9"/>',
  phone:'<path d="M6 3h4l2 5-2.5 1.5a12 12 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.2 2 2 0 0 1 6 3Z"/>',
  broom:'<path d="M17 3 9.5 10.5"/><path d="M6 21c-1-3 0-6 2.5-7.5l3 3C10 19 9 20.5 6 21Z"/><path d="m11 9 4 4"/>',
  door:'<path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M3 21h18M13 12h.01"/>',
  note:'<path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v4h4"/><path d="M9.5 12h5M9.5 16h5"/>'
};
const svg = (p, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

/* ============ 展示辅助 ============ */
const av = (id, cls = '') => {
  const m = mem(id);
  const ghost = m.incoming || S.movedOut.includes(id);
  return `<span class="av ${cls} ${id===ME?'me':''} ${ghost?'ghost':''}" ${ghost?'':`style="background:${m.c}"`} title="${m.name}">${m.short}</span>`;
};
const yuan = n => {
  const v = Math.round(n * 100) / 100;
  return '¥' + (Number.isInteger(v) ? v : v.toFixed(2));
};
const statusOf = id => {
  if (S.movedOut.includes(id)) return 'gone';
  if (mem(id).incoming) return 'incoming';
  return S.away.some(a => a.who === id && a.active) ? 'away' : 'home';
};
const STATUS_TEXT = { home:'当前在家', away:'离家中', incoming:'即将入住', gone:'已搬出' };

/* ============ 初始状态 ============ */
const SEED = {
  tab: 'home',
  sub: null,
  segment: 'public',
  movedOut: [],

  away: [
    { id:'a1', who:'tom', from:'9月8日', to:'9月18日', days:10, active:true }
  ],

  tasks: [
    { id:'t1', task:'倒垃圾',          who:'yiming', due:'今天',   done:false },
    { id:'t2', task:'周日保洁前整理',   who:'yiming', due:'周日',   done:false },
    { id:'t3', task:'卫生间简单整理',   who:'alex',   due:'今天',   done:true  },
    { id:'t4', task:'公共用品补充',     who:'tom',    due:'本周内', done:false, note:'Tom 离家中，已暂缓' }
  ],
  /* 最近 4 周实际承担的任务数，用于解释责任分布 */
  load: { yiming:6, alex:6, tom:4 },

  supplies: [
    { id:'s1', kind:'public', name:'厕纸',   qty:2, min:3, unit:'卷', max:12 },
    { id:'s2', kind:'public', name:'垃圾袋', qty:14, min:5, unit:'个', max:30 },
    { id:'s3', kind:'public', name:'洗洁精', qty:2, min:2, unit:'瓶', max:4 },
    { id:'s4', kind:'public', name:'厨房纸', qty:3, min:2, unit:'卷', max:6 },
    { id:'s5', kind:'lend', name:'空气炸锅', owner:'yiming', rule:'可直接使用，用后清洗放回' },
    { id:'s6', kind:'lend', name:'工具箱',   owner:'alex',   rule:'使用前问一声' },
    { id:'s7', kind:'lend', name:'行李箱',   owner:'tom',    rule:'使用前问一声' },
    { id:'s8', kind:'private', name:'个人食材与调料', owner:'yiming', zone:'冰箱上层' },
    { id:'s9', kind:'private', name:'私人洗护用品',   owner:'alex',   zone:'卫生间 B 区' },
    { id:'s10',kind:'private', name:'私人物品',       owner:'tom',    zone:'03室 与 鞋柜 C 区' }
  ],

  spaces: [
    { id:'sp1', name:'冰箱', icon:'fridge',
      zones:[{n:'上层',o:'yiming'},{n:'中层',o:'alex'},{n:'下层',o:'tom',to:'lin'},{n:'门侧',o:'public'}] },
    { id:'sp2', name:'厨房储物柜', icon:'cabinet',
      zones:[{n:'A 格',o:'yiming'},{n:'B 格',o:'alex'},{n:'C 格',o:'tom',to:'lin'},{n:'D 格',o:'public'}] },
    { id:'sp3', name:'卫生间置物架', icon:'shelf',
      zones:[{n:'A 层',o:'yiming'},{n:'B 层',o:'alex'},{n:'C 层',o:'tom',to:'lin'}] },
    { id:'sp4', name:'鞋柜', icon:'shoe',
      zones:[{n:'A 区',o:'yiming'},{n:'B 区',o:'alex'},{n:'C 区',o:'tom',to:'lin'}] }
  ],

  visits: [
    { id:'v1', host:'alex', guest:'朋友', when:'今晚 19:00–22:00', overnight:false, status:'已告知' }
  ],
  /* 本周各成员同一访客已留宿的晚数 */
  nights: { yiming:0, alex:3, tom:0 },
  visitAsks: [
    { id:'va1', host:'alex', text:'希望朋友本周额外留宿 1 晚', nights:3, replies:{} }
  ],

  laundry: { user:'alex', endsAt:'21:40', notifyMe:false, idleMinutes:0 },

  bills: [
    { id:'b1', title:'9月上半月水电', note:'国网 + 自来水', amount:180, payer:'alex',
      people:['yiming','alex','tom'], method:'even', settled:false, date:'9月10日' },
    { id:'b2', title:'公共清洁用品', note:'洗衣液 · 消毒液 · 抹布', amount:48, payer:'tom',
      people:['yiming','alex','tom'], method:'even', settled:false, date:'9月6日' },
    { id:'b3', title:'公共纸品补充', note:'厕纸 · 厨房纸', amount:30, payer:'yiming',
      people:['yiming','alex','tom'], method:'even', settled:false, date:'9月4日' },
    { id:'b4', title:'阳台防水材料', note:'01室与03室共用阳台', amount:60, payer:'tom',
      people:['alex','tom'], method:'even', settled:false, date:'9月3日' },
    { id:'b5', title:'宽带费 9–11月', note:'联通 500M', amount:300, payer:'yiming',
      people:['yiming','alex','tom'], method:'even', settled:true, date:'9月1日' },
    { id:'b6', title:'厨房灯泡', note:'已报修，先自行更换', amount:28, payer:'alex',
      people:['yiming','alex','tom'], method:'even', settled:true, date:'9月2日' }
  ],
  /* 月末水电预估，用于情境公平演示 */
  utilityForecast: { title:'9月水电费', amount:360, days:30 },
  fairApplied: false,

  rules: [
    { id:'r1', title:'23:30 后保持安静',        cat:'噪音', desc:'外放改用耳机，洗衣、搬动家具尽量避开这个时间。', by:['yiming','alex','tom'], since:'6月1日' },
    { id:'r2', title:'同一访客每周最多留宿 2 晚', cat:'访客', desc:'超过这个次数，提前征求其他室友意见。',        by:['yiming','alex','tom'], since:'6月1日', prefKey:'overnight' },
    { id:'r3', title:'常用公共用品统一采购 AA',   cat:'物品', desc:'厕纸、垃圾袋、洗洁精等由当次发现缺货的人补充，费用三人平摊。', by:['yiming','alex','tom'], since:'6月1日', prefKey:'supply' },
    { id:'r4', title:'厨房使用后当天恢复',        cat:'清洁', desc:'台面无明显油污，厨余当天处理，锅具当天清洗。',   by:['yiming','alex','tom'], since:'8月20日', prefKey:'kitchen' },
    { id:'r5', title:'公共区域禁止吸烟',          cat:'其他', desc:'包括客厅、厨房、卫生间与阳台。',              by:['yiming','alex','tom'], since:'6月1日', prefKey:'smoke' },
    { id:'r6', title:'访客留宿提前告知',          cat:'访客', desc:'至少提前一天在家里登记一下，方便大家安排。',   by:['yiming','alex','tom'], since:'6月1日' }
  ],

  topics: [],

  /* 居住问题记录：只记录规则与现状的偏差，不记录"谁违规" */
  issues: [
    { id:'i1', cat:'清洁', rule:'r4', title:'厨房恢复标准', level:3, count:2, window:'最近 14 天',
      note:'这条约定可能存在理解差异，建议重新明确一次标准。' }
  ],

  feed: [
    { who:'sys',   text:'提醒了本周的「公共用品补充」任务', t:'2小时前' },
    { who:'alex',  text:'完成了值日「卫生间简单整理」', t:'今天 09:20' },
    { who:'alex',  text:'登记了今晚 19:00–22:00 的访客', t:'昨天' },
    { who:'tom',   text:'登记了离家：9月8日 — 9月18日', t:'9月7日' },
    { who:'sys',   text:'共同约定「厨房使用后当天恢复」被重新确认', t:'9月5日' }
  ],

  onboardDone: { yiming:'8月12日', alex:'6月30日', tom:'6月30日', lin:null },
  linDiscussed: false,
  moveout: null,
  myPrefs: {},
  showAllPrefs: false,
  demoPanel: false,
  quiz: { step:0, answers:{} },
  awk: { step:0, cat:'', text:'', focus:'', way:'rule' },
  pending: null
};

/* ============ 持久化 ============ */
const KEY = 'hezu-v2';
let S;
try {
  const raw = JSON.parse(localStorage.getItem(KEY));
  S = (raw && raw.bills && raw.rules && raw.spaces) ? raw : structuredClone(SEED);
} catch (e) { S = structuredClone(SEED); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const logFeed = (who, text) => { S.feed.unshift({ who, text, t:'刚刚' }); S.feed = S.feed.slice(0, 9); };

/* ============ 派生计算 ============ */
/* 分摊按"分"计算，余数依次给前几个人，保证各人金额相加等于总额。
   否则 29.90 三人平分显示成 9.97×3 = 29.91，账目对不上。 */
function splitOf(b) {
  if (b.shares) return b.shares;
  const cents = Math.round(b.amount * 100), n = b.people.length || 1;
  const base = Math.floor(cents / n), extra = cents - base * n;
  const out = {};
  b.people.forEach((p, i) => out[p] = (base + (i < extra ? 1 : 0)) / 100);
  return out;
}
const shareOf = (b, who) => splitOf(b)[who] || 0;
/* 各人金额不完全相等时，单独显示的"每人"要标明是约数 */
const perLabel = b => {
  const v = Object.values(splitOf(b));
  return (new Set(v).size === 1 ? '每人 ' : '每人约 ') + yuan(Math.max(...v));
};
const openBills   = () => S.bills.filter(b => !b.settled);
const myDue       = () => openBills().filter(b => b.payer !== ME && b.people.includes(ME));
const myDueTotal  = () => myDue().reduce((a, b) => a + shareOf(b, ME), 0);
const monthTotal  = () => S.bills.reduce((a, b) => a + b.amount, 0);

/* 净额结算：先算每人收支，再抵消成两两转账 */
function netSettlement() {
  const bal = {};
  living().forEach(m => bal[m.id] = 0);
  openBills().forEach(b => {
    if (bal[b.payer] != null) bal[b.payer] += b.amount;
    b.people.forEach(p => { if (bal[p] != null) bal[p] -= shareOf(b, p); });
  });
  const owe  = Object.entries(bal).filter(([, v]) => v < -0.005).map(([k, v]) => [k, -v]).sort((a, b) => b[1] - a[1]);
  const recv = Object.entries(bal).filter(([, v]) => v >  0.005).map(([k, v]) => [k,  v]).sort((a, b) => b[1] - a[1]);
  const out = [];
  let i = 0, j = 0;
  while (i < owe.length && j < recv.length) {
    const amt = Math.min(owe[i][1], recv[j][1]);
    if (amt > 0.005) out.push({ from: owe[i][0], to: recv[j][0], amount: Math.round(amt * 100) / 100 });
    owe[i][1] -= amt; recv[j][1] -= amt;
    if (owe[i][1] < 0.005) i++;
    if (recv[j][1] < 0.005) j++;
  }
  return { transfers: out.filter(t => t.amount >= 10), deferred: out.filter(t => t.amount < 10), balances: bal };
}

/* 按实际居住天数的公平方案 */
function fairByDays() {
  const f = S.utilityForecast;
  const rows = living().map(m => {
    const off = S.away.filter(a => a.who === m.id).reduce((n, a) => n + a.days, 0);
    return { id: m.id, days: f.days - off, off };
  });
  const total = rows.reduce((a, r) => a + r.days, 0);
  rows.forEach(r => r.amount = Math.round(f.amount * r.days / total * 100) / 100);
  return { rows, total, even: f.amount / living().length };
}

const myTasks      = () => S.tasks.filter(t => t.who === ME && !t.done);
const lowSupplies  = () => S.supplies.filter(s => s.kind === 'public' && s.qty < s.min);
const tonightVisits= () => S.visits.filter(v => v.when.includes('今晚'));
const awayMembers  = () => S.away.filter(a => a.active);
const homeCount    = () => living().filter(m => statusOf(m.id) === 'home').length;
const incomingMember = () => MEMBERS.find(m => m.incoming && !S.movedOut.includes(m.id));

/* 新成员与 House 现状的差异：只比较"容易产生摩擦"的偏好 */
function linDiff() {
  const lin = incomingMember();
  if (!lin) return { same: [], diff: [] };
  const same = [], diff = [];
  PREF_KEYS.filter(p => p.cmp).forEach(pk => {
    const vals = living().map(m => m.prefs[pk.k]);
    const count = {};
    vals.forEach(v => count[v] = (count[v] || 0) + 1);
    const houseVal = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    const item = { ...pk, house: houseVal, lin: lin.prefs[pk.k],
                   rule: S.rules.find(r => r.prefKey === pk.k) };
    if (lin.prefs[pk.k] === houseVal) same.push(item); else diff.push(item);
  });
  return { same, diff, lin };
}
/* 因新成员加入而需要重新确认的现有规则 */
const rulesToRevisit = () => S.linDiscussed ? [] : linDiff().diff.filter(d => d.rule);

/* 留宿约定：上限直接从规则文字里读，规则改了判断跟着改 */
function overnightRule() {
  const rule = S.rules.find(x => x.prefKey === 'overnight');
  if (!rule) return null;
  const m = (rule.title + rule.desc).match(/(\d+)\s*晚/);
  const limit = m ? +m[1] : 2;
  const actual = Math.max(0, ...living().map(x => S.nights[x.id] || 0));
  return { rule, limit, actual, exceeded: actual > limit };
}

/* 入住共识结果：三位在住成员之间的一致与分歧 */
function consensusResult() {
  const agree = [], talk = [];
  PREF_KEYS.filter(p => p.kind === 'rule').forEach(pk => {
    const vals = living().map(m => ({ id: m.id, v: m.prefs[pk.k] }));
    const uniq = [...new Set(vals.map(v => v.v))];
    (uniq.length === 1 ? agree : talk).push({ ...pk, vals, value: uniq[0] });
  });
  return { agree, talk };
}

const SUGGESTION = {
  overnight: '同一访客每周最多留宿 2 晚，更多次数提前征求其他室友意见。',
  temp: '公共空间空调设在 26°C，觉得热或冷的人自行调整个人房间。',
  quiet: '23:30 后保持安静，外放改用耳机。',
  visitor: '朋友到访提前在家里说一声，不需要征得同意。',
  kitchen: '厨房使用后当天恢复：台面无明显油污、厨余当天处理、锅具当天清洗。',
  supply: '常用公共用品统一采购，费用三人平摊。',
  smoke: '公共区域不吸烟，包括阳台。'
};

/* 待处理事项总数，用于导航角标 */
const badge = tab => {
  if (tab === 'life')  return myTasks().filter(t => t.due === '今天').length + lowSupplies().length + S.visitAsks.length;
  if (tab === 'bill')  return myDue().length;
  if (tab === 'talk')  return rulesToRevisit().length + S.topics.filter(t => !t.done).length;
  return 0;
};
