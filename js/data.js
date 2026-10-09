/* ============================================================
   Roomly · 数据层

   核心约束：页面上每一个动态事实，都必须能回答"谁在什么时候
   通过什么动作产生了它"。来源只有四类：
     member   成员主动登记
     shared   成员共同设定
     derived  系统根据已有记录计算
     platform 租赁机构同步
   系统不感知真实生活，只知道被登记下来的事。
   ============================================================ */

/* ============ 模拟时钟 ============
   演示基准日是 2026 年 9 月 12 日（周六）。S.clock.day 是"从基准日往后推了几天"，
   演示面板可以推进一天 / 下一周 / 月末。所有需要判断"过期没有、是不是本周"的记录
   都带一个 dn（day number，相对基准日的整数），显示文字由 dn 现算，不写死。
   过去已经发生的记录（账单、报修、动态）保留当时的文字，不随时间改写。 */
const BASE_DATE = new Date(2026, 8, 12);
const WDS = ['周日','周一','周二','周三','周四','周五','周六'];
const dateOfDn = n => { const d = new Date(BASE_DATE); d.setDate(d.getDate() + n); return d; };
const fmtDn = n => { const d = dateOfDn(n); return `${d.getMonth() + 1}月${d.getDate()}日`; };
const wdOfDn = n => WDS[dateOfDn(n).getDay()];
/* 把"9月12日"这样的文字换算成 dn，种子数据里可以继续写人话 */
function dn(label) {
  const m = String(label).match(/(\d+)月(\d+)[日号]/);
  if (!m) return 0;
  const d = new Date(2026, +m[1] - 1, +m[2]);
  return Math.round((d - BASE_DATE) / 86400000);
}
/* 当前这一天（S 还没初始化时按基准日算，供种子数据使用） */
const dnNow = () => (typeof S !== 'undefined' && S && S.clock ? S.clock.day : 0);
const nowHM  = () => (typeof S !== 'undefined' && S && S.clock ? S.clock.hm : '21:05');
/* 相对今天的说法：今天 / 明天 / 昨天 / 具体日期 */
const relDn = n => { const d = n - dnNow();
  return d === 0 ? '今天' : d === 1 ? '明天' : d === -1 ? '昨天' : d === 2 ? '后天' : fmtDn(n); };
const dayDn = n => `${fmtDn(n)} ${wdOfDn(n)}`;
/* 周一为一周的起点，访客留宿按自然周累计 */
const weekOf = n => { const d = dateOfDn(n); const wd = d.getDay() === 0 ? 7 : d.getDay();
  return Math.floor((n - (wd - 1)) / 7); };
const sameWeek = n => weekOf(n) === weekOf(dnNow());
/* 这一周的周日是哪天：临时例外默认只到本周结束 */
const weekEndDn = n => { const d = dateOfDn(n), wd = d.getDay() === 0 ? 7 : d.getDay(); return n + (7 - wd); };
/* 这个月的最后一天：演示时钟的"跳到月末"用它 */
const monthEndDn = n => { const d = dateOfDn(n), last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return n + Math.round((last - d) / 86400000); };
/* 这些量会随模拟时钟变化，渲染前由 syncClock() 刷新 */
let TODAY = '9月12日';
let NOW = '21:05';
let WEEKDAY = '周六';
let TOMORROW = { date:'9月13日', wd:'周日', dn:1 };
function syncClock() {
  const n = dnNow();
  TODAY = fmtDn(n); NOW = nowHM(); WEEKDAY = wdOfDn(n);
  TOMORROW = { date: fmtDn(n + 1), wd: wdOfDn(n + 1), dn: n + 1 };
}

const HOUSE = {
  name: '望京西园三区 · 503',
  org: '租房中介 · 托管房源',
  steward: '陈管家',
  /* 保洁由机构排期，住户不手动新增 */
  clean: { next:'周四 10:00', src:{ via:'platform', at:'9月9日' } }
};

/* ---------- 来源标记 ---------- */
const VIA_LABEL = { member:'成员登记', shared:'共同设定', derived:'系统推导', platform:'租房中介同步' };
function srcNote(s) {
  if (!s) return '';
  if (s.via === 'platform') return `租房中介同步${s.at ? ' · ' + s.at : ''}`;
  if (s.via === 'derived')  return s.note || '系统根据已有记录计算';
  if (s.via === 'shared')   return `全员共同设定${s.at ? ' · ' + s.at : ''}`;
  return `${mem(s.by).name} · ${s.at}`;
}

/* ---------- 生活偏好 ---------- */
const PREF_KEYS = [
  { k:'quiet',    label:'安静时间', kind:'rule', cmp:true },
  { k:'visitor',  label:'朋友来访', kind:'rule', cmp:true },
  { k:'overnight',label:'访客留宿', kind:'rule', cmp:true },
  { k:'kitchen',  label:'厨房恢复', kind:'rule', cmp:true },
  { k:'supply',   label:'公共用品', kind:'rule', cmp:true },
  { k:'temp',     label:'空调温度', kind:'rule', cmp:true },
  { k:'smoke',    label:'吸烟',     kind:'rule', cmp:true },
  { k:'social',   label:'室友关系', kind:'info', cmp:true },
  { k:'sleep',    label:'作息',     kind:'info' },
  { k:'conflict', label:'沟通方式', kind:'info' },
  { k:'cook',     label:'做饭频率', kind:'info' },
  { k:'pet',      label:'宠物',     kind:'info' }
];

/* 成员的租约信息来自机构，生活偏好来自本人填写的入住共识 */
const MEMBERS = [
  { id:'yiming', name:'Yiming', short:'YM', c:'#2A7059', room:'02室', me:true, joined:'6月1日',
    photo:'img/avatar-yiming.jpg',
    lease:{ via:'platform', at:'6月1日' },
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'每周 ≤2 晚', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'25°C', smoke:'家里都不吸',
            sleep:'23:45 左右', social:'礼貌互不打扰', conflict:'系统先中立提醒', cook:'偶尔做饭', pet:'不养，可以接受' } },
  { id:'alex', name:'Alex', short:'AX', c:'#A3651E', room:'01室', joined:'4月15日',
    photo:'img/avatar-alex.jpg',
    lease:{ via:'platform', at:'4月15日' },
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'不限', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'25°C', smoke:'家里都不吸',
            sleep:'00:30 左右', social:'偶尔一起聊天吃饭', conflict:'私下直接说', cook:'经常做饭', pet:'不养，可以接受' } },
  { id:'tom', name:'Tom', short:'TM', c:'#3F5F80', room:'03室', joined:'3月1日',
    photo:'img/avatar-tom.jpg',
    lease:{ via:'platform', at:'3月1日' },
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'每周 ≤1 晚', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'26°C', smoke:'家里都不吸',
            sleep:'23:00 左右', social:'礼貌互不打扰', conflict:'系统先中立提醒', cook:'几乎不做饭', pet:'不养，可以接受' } },
  { id:'lin', name:'Lin', short:'LN', c:'#6B4A6E', room:'04室', incoming:true, joined:'9月20日',
    photo:'img/avatar-lin.jpg',
    lease:{ via:'platform', at:'9月8日' },
    prefsSrc:{ via:'member', by:'lin', at:'9月10日' },
    prefs:{ quiet:'23:30', visitor:'提前说一声', overnight:'不限', kitchen:'台面擦净，锅具当天洗',
            supply:'统一采购 AA', temp:'27°C', smoke:'家里都不吸',
            sleep:'00:30 左右', social:'礼貌互不打扰', conflict:'系统先中立提醒', cook:'偶尔做饭', pet:'不养，可以接受' } }
];

const KEY_PREFS = ['quiet', 'overnight', 'kitchen', 'temp'];

/* 演示环境可以切换身份，这样"请求—回应"这类双方流程能被完整走通 */
let ME = 'yiming';
/* 每个人后来改过的偏好按人存在 S.myPrefs[id] 里，盖在入住时填的那份上面 */
const mem = id => {
  const base = MEMBERS.find(m => m.id === id) || { id, name:id, short:'?', c:'#8A938D', prefs:{} };
  const has = typeof S !== 'undefined' && S;
  const edits = has && S.myPrefs && S.myPrefs[id];
  /* 机构推送过来的租约变更（入住日期）也记在状态里，刷新后仍然一致 */
  const lease = has && S.leaseOverride && S.leaseOverride[id];
  if (!edits && !lease) return base;
  return { ...base, ...(lease || {}), prefs: edits ? { ...base.prefs, ...edits } : base.prefs };
};
/* ---------- 成员生命周期 ----------
   pending 租约已签、还没到入住日 → active 在住 → moved_out_pending_settlement 已搬出、账还没结清 → ended 成员关系结束
   pending → active 由租约（机构同步）推动；搬出准备做完、机构确认退租 → 待结清；账全部结清 → ended。
   页面和权限都按这个状态判断，不看"在不在成员列表里"。 */
const membership = id => {
  if (S.movedOut.includes(id)) return 'ended';
  if (S.settling.includes(id)) return 'moved_out_pending_settlement';
  const m = MEMBERS.find(x => x.id === id);
  if (m && m.incoming && !S.activated.includes(id)) return 'pending';
  return 'active';
};
const MEMBERSHIP_TEXT = { pending:'即将入住', active:'在住', moved_out_pending_settlement:'已搬出 · 待结清', ended:'已搬出' };
/* 在住成员：任务、新账单、讨论表态、分区的默认参与人 */
const living = () => MEMBERS.filter(m => membership(m.id) === 'active').map(m => mem(m.id));
const incomingMember = () => MEMBERS.find(m => membership(m.id) === 'pending');
const settlingMembers = () => MEMBERS.filter(m => membership(m.id) === 'moved_out_pending_settlement').map(m => mem(m.id));
/* 家里的人：在住 + 即将入住 + 已搬出待结清；ended 的不再出现在家里 */
const household = () => MEMBERS.filter(m => membership(m.id) !== 'ended').map(m => mem(m.id));
/* 还有账要算的人：在住 + 已搬出待结清 */
const accountHolders = () => [...living(), ...settlingMembers()];

/* 权限按生命周期给。能力名：
   tasks 值日 · bills 记账与本月结算 · pay 结清历史账单 · visits 访客 · laundry 洗衣机 · supplies 公共物品
   spaces 分区 · talk 参与所有讨论 · talkOwn 只看和自己入住有关的讨论 · issues 居住问题记录 · requests 收发请求
   away 离家登记 · moveout 搬出 · butler 管家 · feed 家里动态 · prefs 生活偏好 */
const CAPS = {
  active:  ['tasks','bills','pay','visits','laundry','supplies','spaces','talk','talkOwn','issues','requests','away','moveout','butler','feed','prefs','rules'],
  pending: ['talkOwn','rules','prefs','zonesOwn'],
  moved_out_pending_settlement: ['pay','prefs','rules'],
  ended: ['prefs']
};
const can = (cap, id = ME) => CAPS[membership(id)].includes(cap);

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
  note:'<path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v4h4"/><path d="M9.5 12h5M9.5 16h5"/>',
  edit:'<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m13.5 6.5 3 3"/>',
  truck:'<path d="M3 7h10v9H3z"/><path d="M13 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  key:'<circle cx="8" cy="14" r="4"/><path d="m11 11 8-8"/><path d="m16 6 2 2M19 3l2 2"/>',
  broom:'<path d="M14 3 8 9"/><path d="M8 9c-3 0-4.5 2-4.5 5.5V21h9v-6.5C12.5 11 11 9 8 9Z"/><path d="M3.5 17h9"/>'
};
const svg = (p, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

/* ============ 展示辅助 ============ */
const av = (id, cls = '') => {
  const m = mem(id);
  const ghost = membership(id) !== 'active';
  return `<span class="av ${cls} ${id===ME?'me':''} ${ghost?'ghost':''}" ${ghost?'':`style="background:${m.c}"`} title="${m.name}">${
    m.photo ? `<img src="${m.photo}" alt="" onerror="this.remove()">` : ''}${m.short}</span>`;
};
const yuan = n => {
  const v = Math.round(n * 100) / 100;
  return '¥' + (Number.isInteger(v) ? v : v.toFixed(2));
};
/* 系统只知道谁登记了离家，不知道谁此刻在不在家 */
const statusOf = id => {
  const ms = membership(id);
  if (ms === 'ended') return 'gone';
  if (ms === 'moved_out_pending_settlement') return 'settling';
  if (ms === 'pending') return 'incoming';
  return S.away.some(a => a.who === id && awayActive(a)) ? 'away' : 'in';
};
const STATUS_TEXT = { in:'在住', away:'登记离家中', incoming:'即将入住', settling:'已搬出 · 待结清', gone:'已搬出' };

/* ============ 初始状态 ============ */
const SUPPLY_STATES = ['充足', '不多了', '快用完', '已用完'];

/* 种子数据一变就换版本号，让还开着的标签页也回到新的起点 */
const SEED_VERSION = '2026-10-09a';

const SEED = {
  tab: 'home',
  sub: null,
  segment: 'public',
  /* 模拟时钟：day 是距基准日 2026-09-12 的天数，演示面板可以推进 */
  clock: { day: 0, hm: '21:05' },
  /* 成员生命周期：activated 已到入住日转正的人；settling 已搬出待结清；movedOut 成员关系已结束 */
  activated: [],
  settling: [],
  movedOut: [],
  moveoutRecord: null,
  leaseOverride: {},

  /* 离家只有这一份原始记录，成员状态、值日、采购、公平分摊都由它推导。
     结束日期过了就自动失效，不需要谁手动点一下 */
  away: [
    { id:'a1', who:'tom', fromDn:dn('9月9日'), toDn:dn('9月18日'), cancelled:false,
      src:{ via:'member', by:'tom', at:'9月7日 22:10' } }
  ],

  /* 值日 = 共同设定的固定任务模板 + 按日期和离家状态生成的当期安排 */
  choreTemplates: [
    { id:'ct1', task:'倒垃圾',        every:'每 2 天', src:{ via:'shared', at:'6月1日' } },
    { id:'ct2', task:'卫生间简单整理', every:'每周',    src:{ via:'shared', at:'6月1日' } },
    { id:'ct3', task:'公共用品检查',   every:'每周',    src:{ via:'shared', at:'6月1日' } },
    { id:'ct4', task:'保洁前整理',     every:'每两周',  src:{ via:'shared', at:'8月20日' } }
  ],
  /* 当期安排：dueDn 是具体哪一天，显示文字（今天 / 明天 / 9月15日）由它现算；
     dueKind:'week' 表示"本周内完成"，不绑定具体某天 */
  tasks: [
    { id:'t1', tpl:'ct1', task:'倒垃圾',          who:'yiming', dueDn:0, done:false },
    { id:'t2', tpl:'ct4', task:'保洁前整理',      who:'yiming', dueDn:1, done:false },
    { id:'t3', tpl:'ct2', task:'卫生间简单整理',   who:'alex',   dueDn:0, done:true, doneAt:'今天 09:20', doneDn:0 },
    { id:'t4', tpl:'ct3', task:'公共用品检查',     who:'tom',    dueKind:'week', dueDn:5, done:false }
  ],
  /* 最近 4 周的完成记录，责任分布由它统计，不写死数字 */
  completions: [
    ['倒垃圾','yiming','9月10日'],['倒垃圾','alex','9月8日'],['倒垃圾','tom','9月6日'],
    ['倒垃圾','yiming','9月4日'],['倒垃圾','alex','9月2日'],['卫生间简单整理','alex','今天'],
    ['卫生间简单整理','tom','9月5日'],['卫生间简单整理','yiming','8月29日'],
    ['公共用品检查','tom','9月1日'],['公共用品检查','alex','8月25日'],
    ['保洁前整理','yiming','9月7日'],['保洁前整理','alex','8月24日'],
    ['倒垃圾','yiming','8月31日'],['倒垃圾','tom','8月27日'],
    ['倒垃圾','yiming','8月23日'],['倒垃圾','alex','8月19日']
  ],

  /* 公共消耗品分两种：数量型逐个计数，状态型只选档位 */
  supplies: [
    { id:'s1', kind:'public', mode:'count', name:'厕纸',   qty:2,  min:3, unit:'卷', max:12,
      src:{ via:'member', by:'alex', at:'今天 18:20' } },
    { id:'s2', kind:'public', mode:'count', name:'垃圾袋', qty:14, min:5, unit:'个', max:30,
      src:{ via:'member', by:'yiming', at:'9月6日 11:05' } },
    { id:'s3', kind:'public', mode:'count', name:'厨房纸', qty:3,  min:2, unit:'卷', max:6,
      src:{ via:'member', by:'tom', at:'9月4日 19:40' } },
    { id:'s4', kind:'public', mode:'state', name:'洗洁精', state:'不多了',
      src:{ via:'member', by:'alex', at:'9月9日 21:30' } },
    { id:'s5', kind:'public', mode:'state', name:'洗衣液', state:'充足',
      src:{ via:'member', by:'yiming', at:'9月1日 10:15' } },
    { id:'s6', kind:'lend', name:'空气炸锅', owner:'yiming', rule:'可直接使用，用后清洗放回',
      src:{ via:'member', by:'yiming', at:'6月3日' } },
    { id:'s7', kind:'lend', name:'工具箱',   owner:'alex',   rule:'使用前问一声',
      src:{ via:'member', by:'alex', at:'5月2日' } },
    { id:'s8', kind:'private', name:'个人食材与调料', owner:'yiming', zone:'冰箱上层',
      src:{ via:'member', by:'yiming', at:'6月3日' } },
    { id:'s9', kind:'private', name:'私人洗护用品',   owner:'alex',   zone:'卫生间 B 层',
      src:{ via:'member', by:'alex', at:'5月2日' } }
  ],

  /* 分区是一次共同设定的结果，新成员的分区需要单独确认 */
  spaces: [
    { id:'sp1', name:'冰箱', icon:'fridge', src:{ via:'shared', at:'6月2日' },
      zones:[{n:'上层',o:'yiming'},{n:'中层',o:'alex'},{n:'下层',o:'tom'},{n:'门侧',o:'public'}] },
    { id:'sp2', name:'厨房储物柜', icon:'cabinet', src:{ via:'shared', at:'6月2日' },
      zones:[{n:'A 格',o:'yiming'},{n:'B 格',o:'alex'},{n:'C 格',o:'tom'},{n:'E 格',o:'public'}] },
    { id:'sp3', name:'卫生间置物架', icon:'shelf', src:{ via:'shared', at:'6月2日' },
      zones:[{n:'A 层',o:'yiming'},{n:'B 层',o:'alex'},{n:'C 层',o:'tom'}] },
    { id:'sp4', name:'鞋柜', icon:'shoe', src:{ via:'shared', at:'6月2日' },
      zones:[{n:'A 区',o:'yiming'},{n:'B 区',o:'alex'},{n:'C 区',o:'tom'}] }
  ],
  /* 新成员的分区建议，确认后才写进 spaces */
  zoneProposal: { who:'lin', confirmed:false,
    items:[{ sp:'sp1', n:'保鲜抽屉' },{ sp:'sp2', n:'D 格' },{ sp:'sp3', n:'D 层' },{ sp:'sp4', n:'D 区' }] },

  /* 访客逐条登记，留宿次数由这些记录累计得出 */
  /* guest 是登记人给访客起的称呼（不需要真名），同一个 host 下同一个称呼就是同一个人（guestId = host:称呼）。
     "同一访客每周最多留宿 2 晚"按 host + guestId + 本周 累计，不会把一个人的所有访客加在一起。 */
  /* 访客逐条登记，dn 决定它属于哪一周；nights 恒为 1 条记录 1 晚，便于按天核对 */
  visits: [
    { id:'v4', host:'alex', guest:'女朋友', guestId:'alex:女朋友', guestPhoto:'img/guest-1.jpg', dn:dn('9月12日'), time:'19:00–22:00', overnight:false,
      src:{ via:'member', by:'alex', at:'昨天 21:10' } },
    { id:'v3', host:'alex', guest:'女朋友', guestId:'alex:女朋友', guestPhoto:'img/guest-1.jpg', dn:dn('9月11日'), time:'20:30 起', overnight:true, nights:1,
      src:{ via:'member', by:'alex', at:'9月11日 20:05' } },
    { id:'v2', host:'alex', guest:'女朋友', guestId:'alex:女朋友', guestPhoto:'img/guest-1.jpg', dn:dn('9月10日'), time:'21:00 起', overnight:true, nights:1,
      src:{ via:'member', by:'alex', at:'9月10日 20:40' } },
    { id:'v1', host:'alex', guest:'女朋友', guestId:'alex:女朋友', guestPhoto:'img/guest-1.jpg', dn:dn('9月9日'),  time:'19:30–23:00', overnight:false,
      src:{ via:'member', by:'alex', at:'9月9日 19:30' } }
  ],

  /* ---------- 请求原语 ----------
     借物、换班、分区调整、留宿例外、分摊方案共用这一套生命周期：
       发起申请 → 等待回应 → 申请通过 / 有人不同意 / 转为讨论 → 执行完成
     need 是"必须回应的人"，responses 按人记录，谁都不能代替别人同意。
     发起人不在 need 里，也就不能给自己投票。 */
  requests: [
    { id:'rq1', kind:'stay', from:'alex', to:'all', subject:'女朋友本周再留宿 1 晚',
      detail:'本周已经住满约定的 2 晚。她这几天项目赶工，想申请这一次的临时例外——不改约定本身，这周结束就失效。',
      need:['yiming','tom'], responses:{}, status:'open', at:'今天 19:40', atDn:0, expiresDn:1,
      effect:{ exception:'ex1' } }
  ],

  /* ---------- 长期规则下的临时例外 ----------
     用户不反对约定本身，只是这一次需要突破。批准后这几晚正式登记，
     并把这段时间的上限临时抬高，不会再被判成超限；过期自动失效，长期约定不变。 */
  exceptions: [
    { id:'ex1', kind:'overnight', host:'alex', guest:'女朋友', guestId:'alex:女朋友',
      nights:1, fromDn:0, toDn:weekEndDn(0), reason:'这几天项目赶工，住得近一点',
      status:'pending', reqId:'rq1', createdDn:0, at:'今天 19:40', visitIds:[] }
  ],

  /* ---------- 模拟站内消息 ----------
     Demo 不接真实推送：私下沟通、中立提醒、管家回执都写成站内消息，
     切换到接收者身份就能看到并处理。全部标注为演示行为。 */
  messages: [],

  /* 洗衣机：谁点了开始使用、选了多久，状态就是什么 */
  laundry: { user:null, startedAt:null, minutes:0, endsAt:null, notifyMe:false, src:null },

  /* 报修：住户提交，机构更新处理进度 */
  repairs: [
    { id:'rp1', place:'厨房', desc:'厨房灯不亮', by:'yiming',
      timeline:[
        { s:'已提交',       at:'9月11日 20:30', via:'member' },
        { s:'管家已受理',   at:'9月11日 21:10', via:'platform' },
        { s:'师傅预计周三上门', at:'今天 09:20', via:'platform' }
      ] }
  ],

  /* kind：utility 水电燃气这类随使用变化的费用（离家可按天数分）· fixed 房租宽带这类固定成本（短期离家不重算）
           supply 公共消耗品（按公共采购约定 AA）· other 其他 */
  /* 一笔费用 = 谁垫付 + 参与的人 + 每个人该出多少（按分存，相加必然等于总额）。
     paid[成员] 记录这一份的进度：claimed 本人说已付 → confirmed 垫付人确认收到。
     整笔"已结清"是推导出来的：所有非垫付人的份额都确认了才算，不是谁点一下就代表全部。 */
  bills: [
    { id:'b1', title:'9月上半月水电', note:'国网 + 自来水', amount:180, payer:'alex', kind:'utility',
      people:['yiming','alex','tom'], method:'even', paid:{}, date:'9月10日',
      src:{ via:'manual', by:'alex', at:'9月10日 19:22' } },
    { id:'b2', title:'公共清洁用品', note:'洗衣液 · 消毒液 · 抹布', amount:48, payer:'tom', kind:'supply',
      people:['yiming','alex','tom'], method:'even', paid:{}, date:'9月6日',
      src:{ via:'supply', by:'tom', at:'9月6日 20:10' } },
    { id:'b3', title:'公共纸品补充', note:'厕纸 · 厨房纸', amount:30, payer:'yiming', kind:'supply',
      people:['yiming','alex','tom'], method:'even', paid:{}, date:'9月4日',
      src:{ via:'supply', by:'yiming', at:'9月4日 18:50' } },
    { id:'b4', title:'阳台防水材料', note:'01室与03室共用阳台', amount:60, payer:'tom', kind:'other',
      people:['alex','tom'], method:'even', paid:{}, date:'9月3日',
      src:{ via:'manual', by:'tom', at:'9月3日 15:30' } },
    { id:'b6', title:'厨房灯泡', note:'报修前先自行更换', amount:28, payer:'alex', kind:'other',
      people:['yiming','alex','tom'], method:'even', date:'9月2日',
      paid:{ yiming:{ claimedAt:'9月2日', confirmedAt:'9月3日' }, tom:{ claimedAt:'9月3日', confirmedAt:'9月3日' } },
      src:{ via:'manual', by:'alex', at:'9月2日 20:15' } },
    { id:'b5', title:'宽带费 9–11月', note:'联通 500M', amount:300, payer:'yiming', kind:'fixed',
      people:['yiming','alex','tom'], method:'even', date:'9月1日',
      paid:{ alex:{ claimedAt:'9月1日', confirmedAt:'9月2日' }, tom:{ claimedAt:'9月1日', confirmedAt:'9月2日' } },
      src:{ via:'manual', by:'yiming', at:'9月1日 09:40' } }
  ],
  utilityForecast: { title:'9月水电费', amount:360, days:30, kind:'utility' },
  /* 分摊方案不再由一个人说了算：提出 → 相关成员确认 → 才会生成账单 */
  splitPlan: null,

  rules: [
    { id:'r1', title:'23:30 后保持安静',        cat:'噪音', desc:'外放改用耳机，洗衣、搬动家具尽量避开这个时间。', by:['yiming','alex','tom'], since:'6月1日' },
    /* prefVal：这条约定对应到入住共识选项里的哪个值，用来比对"我的偏好"和"共同约定" */
    { id:'r2', title:'同一访客每周最多留宿 2 晚', cat:'访客', desc:'超过这个次数，提前征求其他室友意见。',        by:['yiming','alex','tom'], since:'6月1日', prefKey:'overnight', prefVal:'每周 ≤2 晚' },
    { id:'r3', title:'常用公共用品统一采购 AA',   cat:'物品', desc:'厕纸、垃圾袋、洗洁精等由当次发现缺货的人补充，费用三人平摊。', by:['yiming','alex','tom'], since:'6月1日', prefKey:'supply', prefVal:'统一采购 AA' },
    { id:'r4', title:'厨房使用后当天恢复',        cat:'清洁', desc:'台面无明显油污，厨余当天处理，锅具当天清洗。',   by:['yiming','alex','tom'], since:'8月20日', prefKey:'kitchen', prefVal:'台面擦净，锅具当天洗' },
    { id:'r5', title:'公共区域禁止吸烟',          cat:'其他', desc:'包括客厅、厨房、卫生间与阳台。',              by:['yiming','alex','tom'], since:'6月1日', prefKey:'smoke', prefVal:'家里都不吸' },
    { id:'r6', title:'访客留宿提前告知',          cat:'访客', desc:'至少提前一天在家里登记一下，方便大家安排。',   by:['yiming','alex','tom'], since:'6月1日' }
  ],

  topics: [],

  issues: [
    { id:'i1', cat:'清洁', rule:'r4', title:'厨房恢复标准', level:3, count:2, window:'最近 14 天',
      note:'这条约定可能存在理解差异，建议重新明确一次标准。',
      src:{ via:'derived', note:'由 2 次系统提醒记录汇总' }, follow:null }
  ],

  feed: [
    { who:'alex',  text:'把厕纸库存更新为 <b>2 卷</b>', t:'今天 18:20' },
    { who:'alex',  text:'完成了值日「卫生间简单整理」', t:'今天 09:20' },
    { who:'sys',   text:'租房中介更新了报修进度：师傅预计周三上门', t:'今天 09:20' },
    { who:'alex',  text:'登记了今晚 19:00–22:00 的访客', t:'昨天 21:10' },
    { who:'yiming',text:'提交了报修：厨房灯不亮', t:'9月11日 20:30' },
    { who:'tom',   text:'登记了离家：9月9日 — 9月18日（10 天）', t:'9月7日 22:10' }
  ],

  me: 'yiming',
  onboardDone: { yiming:'8月12日', alex:'6月30日', tom:'6月30日', lin:'9月10日' },
  moveout: null,
  myPrefs: {},
  showAllPrefs: false,
  demoPanel: false,
  dock: false,
  quiz: { step:0, answers:{} },
  awk: { step:0, cat:'', text:'', focus:'', way:'rule' },
  pending: null,
  /* 提交给机构的协调摘要（演示：模拟工单） */
  briefs: [],
  /* 情境体验：选了场景就进入对应的预置数据，scenario 记录当前走到第几步 */
  scenario: null,
  /* 自由探索的数据和情境数据分开存，互不污染 */
  freeSnapshot: null
};

/* ============ 持久化 ============
   这是演示产品：每次新打开页面都回到同一个固定的初始状态，谁体验过、做过什么都不会带给下一个人。
   状态只放在 sessionStorage 里——同一个标签页里刷新会保留你刚才的操作（方便一步步验证），
   关掉标签页或新开一个页面就是全新的一份种子数据。演示面板里的「重置演示数据」可以随时回到起点。 */
const KEY = 'hezu-demo';
let S;
try { localStorage.removeItem('hezu-v4'); } catch (e) {}
try {
  const raw = JSON.parse(sessionStorage.getItem(KEY));
  /* 同一标签页里如果部署了新版本、字段对不上，整份回退到种子数据，避免半旧半新的状态 */
  const complete = raw && raw.seedVersion === SEED_VERSION &&
    ['bills','rules','spaces','completions','requests','repairs','visits','topics','exceptions','messages'].every(k => Array.isArray(raw[k]));
  S = complete ? raw : structuredClone(SEED);
} catch (e) { S = structuredClone(SEED); }
Object.keys(SEED).forEach(k => { if (S[k] === undefined) S[k] = structuredClone(SEED[k]); });
S.seedVersion = SEED_VERSION;
ME = S.me || 'yiming';
syncClock();
/* 只关乎这一屏怎么显示、不需要记住的状态：对比区展开没有、哪张卡正在写补充意见 */
const UI = { sameOpen:false, noteFor:null, editFor:null };
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const logFeed = (who, text, t) => { S.feed.unshift({ who, text, t: t || `${relDn(dnNow())} ${nowHM()}`, dn: dnNow() }); S.feed = S.feed.slice(0, 12); };
/* 每次渲染前跑一遍：时间走了以后，该失效的失效、该结束的结束，页面上不会留下过期状态 */
function sweepAll() {
  syncClock();
  const n = sweepExceptions() + sweepRequests() + sweepTrials();
  /* 分摊方案跟着它那条请求走：请求被否决 / 撤回 / 过期，方案就不能再显示成"等大家确认" */
  if (S.splitPlan && S.splitPlan.status === 'pending') {
    const r = S.requests.find(x => x.id === S.splitPlan.reqId);
    if (!r) S.splitPlan = null;
    else if (!reqOpen(r) && !['agreed', 'done'].includes(r.status)) { S.splitPlan.status = 'rejected'; S.splitPlan.reason = REQ_STATUS[r.status]; }
  }
  return n;
}

/* ============ 派生计算 ============ */
/* ---------- 账务：一切按"分"算 ----------
   不管哪种分摊方式，各人金额之和必须等于账单总额。余数按固定顺序依次给前几个人，
   所以同一笔账反复渲染结果也完全一样。 */
const billCents = b => Math.round(b.amount * 100);
/* 按权重把总分数拆开，保证相加等于总额 */
function splitCents(total, people, weights) {
  const out = {}; if (!people.length) return out;
  const w = people.map(p => Math.max(0, (weights && weights[p] != null) ? weights[p] : 1));
  const sum = w.reduce((a, x) => a + x, 0) || people.length;
  let used = 0;
  people.forEach((p, i) => { const c = Math.floor(total * (sum ? w[i] / sum : 1 / people.length)); out[p] = c; used += c; });
  /* 余下的分依次补给权重大的人，总额分毫不差 */
  const order = people.map((p, i) => [p, w[i]]).sort((a, b2) => b2[1] - a[1]);
  for (let i = 0; used < total; i++, used++) out[order[i % order.length][0]]++;
  return out;
}
/* 这笔账每个人该出多少分 */
function sharesCentsOf(b) {
  const total = billCents(b);
  if (b.weights) return splitCents(total, b.people, b.weights);
  if (b.shareCents) {
    /* 存过明细就用明细，但总额改过时按比例重算，避免相加对不上 */
    const sum = b.people.reduce((a, p) => a + (b.shareCents[p] || 0), 0);
    if (sum === total && b.people.every(p => b.shareCents[p] != null)) return { ...b.shareCents };
    return splitCents(total, b.people, b.shareCents);
  }
  return splitCents(total, b.people);
}
const splitOf = b => { const c = sharesCentsOf(b), out = {}; Object.keys(c).forEach(k => out[k] = c[k] / 100); return out; };
const shareOf = (b, who) => (sharesCentsOf(b)[who] || 0) / 100;
const perLabel = b => {
  const v = Object.values(splitOf(b));
  if (!v.length) return '没有参与的人';
  return (new Set(v).size === 1 ? '每人 ' : '每人约 ') + yuan(Math.max(...v));
};
/* ---------- 结清：按"每一份"算，不是整笔一刀切 ----------
   份额状态：owed 待支付 → claimed 本人说已付、等垫付人确认 → confirmed 两边都认了。
   整笔结清 = 所有非垫付人的份额都 confirmed。 */
const payers = b => b.people.filter(p => p !== b.payer && shareOf(b, p) > 0);
const payState = (b, who) => { const r = (b.paid || {})[who];
  return !r ? 'owed' : r.confirmedAt ? 'confirmed' : 'claimed'; };
const PAY_TEXT = { owed:'待支付', claimed:'已付 · 待确认', confirmed:'已结清' };
const isSettled = b => payers(b).every(p => payState(b, p) === 'confirmed');
const settledDate = b => { const t = payers(b).map(p => (b.paid[p] || {}).confirmedAt).filter(Boolean); return t[t.length - 1] || ''; };
/* 已经有人确认收款的账，改金额会动到历史账务，要单独说明 */
const hasConfirmed = b => payers(b).some(p => payState(b, p) === 'confirmed');
const BILL_SRC = { manual:'手动记录', supply:'补充公共用品时自动生成', butler:'通过管家创建' };
/* 费用类型决定"公平"怎么算：只有随使用变化的费用才建议按离家天数分 */
const BILL_KIND = { utility:'水电燃气', fixed:'固定成本', supply:'公共消耗品', other:'其他' };
const BILL_KIND_HINT = {
  utility:'随使用变化的费用，有人登记离家时可以按在住天数分',
  fixed:'房租、宽带这类固定成本，短期离家不重算，按家里约定平均分',
  supply:'按公共采购约定 AA，不套用离家天数',
  other:'按参与的人平均分'
};
function guessBillKind(title, via) {
  if (via === 'supply') return 'supply';
  const t = title || '';
  if (/水|电|燃气|煤气|暖气/.test(t)) return 'utility';
  if (/房租|租金|宽带|网费|物业|押金|保洁费|服务费/.test(t)) return 'fixed';
  if (/纸|袋|洗|清洁|用品|消毒|抹布|洗衣液|洗洁精/.test(t)) return 'supply';
  return 'other';
}
const billKindOf = b => b.kind || guessBillKind(b.title, b.src && b.src.via);

const openBills  = () => S.bills.filter(b => !isSettled(b));
/* 等我付的：别人垫付、我有份、而且我这一份还没确认收到 */
const myDue      = () => S.bills.filter(b => b.payer !== ME && b.people.includes(ME) && payState(b, ME) !== 'confirmed');
const myDueTotal = () => myDue().reduce((a, b) => a + shareOf(b, ME), 0);
/* 和某个人自己有关、还没了结的账：
   他该付的那几份还没确认，或者别人欠他的还没结。
   别人之间互相欠钱不算在他头上——否则他会被一笔跟自己无关的账永远卡在"待结清"。 */
const memberOpenBills = id => S.bills.filter(b =>
  (b.payer !== id && b.people.includes(id) && payState(b, id) !== 'confirmed') ||
  (b.payer === id && payers(b).some(p => payState(b, p) !== 'confirmed')));
/* 等我确认收款的：我垫付的账里，别人说已付但我还没确认 */
const myToConfirm = () => S.bills.filter(b => b.payer === ME && payers(b).some(p => payState(b, p) === 'claimed'));
const monthTotal = () => S.bills.reduce((a, b) => a + b.amount, 0);

/* 净额只看"还没结清的那些份额"，已经确认收款的不再参与抵消 */
function netSettlement() {
  const bal = {};
  accountHolders().forEach(m => bal[m.id] = 0);
  S.bills.forEach(b => {
    payers(b).forEach(p => {
      if (payState(b, p) === 'confirmed') return;
      const v = shareOf(b, p);
      if (bal[p] != null) bal[p] -= v;
      if (bal[b.payer] != null) bal[b.payer] += v;
    });
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

/* ---------- 离家 ----------
   只有这一份原始记录。结束日期过了就自动失效，不需要谁手动点一下。 */
const awayDays = a => Math.max(1, a.toDn - a.fromDn + 1);
const awayActive = a => !a.cancelled && a.toDn >= dnNow() && a.fromDn <= dnNow();
/* 本月范围内登记的离家天数（用于水电按天数分） */
function awayDaysOf(id) {
  return S.away.filter(a => a.who === id && !a.cancelled)
    .reduce((n, a) => n + awayDays(a), 0);
}
/* 登记在住天数 = 当月天数 − 本人登记的离家天数。系统不掌握真实居住情况。 */
function fairByDays(people) {
  const f = S.utilityForecast;
  const ids = people || living().map(m => m.id);
  const rows = ids.map(id => { const off = awayDaysOf(id); return { id, days: Math.max(0, f.days - off), off }; });
  const cents = splitCents(Math.round(f.amount * 100), ids, Object.fromEntries(rows.map(r => [r.id, r.days])));
  rows.forEach(r => r.amount = cents[r.id] / 100);
  return { rows, total: rows.reduce((a, r) => a + r.days, 0), even: f.amount / (ids.length || 1) };
}

/* ---------- 公共物品 ---------- */
const isLow = s => s.mode === 'count' ? s.qty < s.min : ['快用完', '已用完'].includes(s.state);
const lowSupplies = () => S.supplies.filter(s => s.kind === 'public' && isLow(s));
const supplyText = s => s.mode === 'count' ? `${s.qty} ${s.unit}` : s.state;

/* ---------- 访客：次数由逐条记录累计，按"谁的哪一位访客"分开算 ---------- */
const guestKey = (host, name) => `${host}:${(name || '朋友').trim()}`;
const thisWeek = v => sameWeek(v.dn);
/* 某位成员登记过的访客：称呼、头像、本周留宿几晚 */
const guestsOf = host => {
  const out = [];
  S.visits.filter(v => v.host === host).sort((a, b) => b.dn - a.dn).forEach(v => {
    let g = out.find(x => x.guestId === v.guestId);
    if (!g) { g = { guestId:v.guestId, guest:v.guest, photo:v.guestPhoto, nights:0, visits:0, last:v.dn }; out.push(g); }
    g.visits++; if (v.overnight && thisWeek(v)) g.nights += (v.nights || 1);
    if (!g.photo && v.guestPhoto) g.photo = v.guestPhoto;
  });
  return out;
};
/* 本周留宿晚数：指定访客就只算这一位；不指定就取这位成员留宿最多的那位访客 */
const nightsOf = (host, guestId) => {
  if (guestId) return S.visits.filter(v => v.host === host && v.overnight && thisWeek(v) && v.guestId === guestId)
    .reduce((n, v) => n + (v.nights || 1), 0);
  return Math.max(0, ...guestsOf(host).map(g => g.nights));
};
const tonightVisits = () => S.visits.filter(v => v.dn === dnNow());
const weekVisits = () => S.visits.filter(thisWeek);

/* ---------- 临时例外 ----------
   已批准、还在有效期内的例外，把这一对"成员 + 访客"本周的上限临时抬高。
   例外里的留宿只在 visits 里记一次，不会既算例外又算一次超限。 */
const exActive = e => e.status === 'approved' && e.toDn >= dnNow() && weekOf(e.fromDn) === weekOf(dnNow());
const exFor = (host, guestId) => S.exceptions.filter(e => e.host === host && e.guestId === guestId);
/* 这一对现在被批准的额外晚数 */
const extraNights = (host, guestId) => exFor(host, guestId).filter(exActive).reduce((n, e) => n + e.nights, 0);
const pendingEx = (host, guestId) => exFor(host, guestId).find(e => e.status === 'pending');
const EX_STATUS = { pending:'等待室友回应', approved:'例外已生效', rejected:'未获同意', cancelled:'已撤回', expired:'已到期失效' };
/* 到期的例外自动失效；长期约定一个字都不改 */
function sweepExceptions() {
  let n = 0;
  S.exceptions.forEach(e => {
    if (e.status === 'approved' && (e.toDn < dnNow() || weekOf(e.fromDn) !== weekOf(dnNow()))) { e.status = 'expired'; e.expiredDn = dnNow(); n++; }
  });
  return n;
}

/* ---------- 洗衣机 ---------- */
const laundryFree = () => !S.laundry.user;

/* ---------- 报修 ---------- */
const openRepairs = () => S.repairs.filter(r => r.timeline[r.timeline.length - 1].s !== '已完成');
const repairState = r => r.timeline[r.timeline.length - 1];

/* ---------- 值日 ----------
   dueDn 是具体哪天，显示文字由它现算；dueKind:'week' 是"本周内完成"。 */
const taskDue = t => t.dueKind === 'week' ? '本周内' : relDn(t.dueDn);
const taskToday = t => t.dueKind === 'week' ? false : t.dueDn === dnNow();
/* 过了日子还没做的：不说"失职"，只说顺延 */
const taskOverdue = t => !t.done && (t.dueKind === 'week' ? t.dueDn < dnNow() : t.dueDn < dnNow());
const myTasks = (id = ME) => S.tasks.filter(t => t.who === id && !t.done);
/* 责任分布由完成记录统计得出 */
function loadByMember() {
  const out = {};
  living().forEach(m => out[m.id] = 0);
  S.completions.forEach(([, by]) => { if (out[by] != null) out[by]++; });
  return out;
}
/* 离家期间的任务自动标注暂缓，不在 seed 里写死 */
const taskPaused = t => statusOf(t.who) === 'away';

const awayMembers = () => S.away.filter(awayActive);
const awayOf = id => S.away.find(a => a.who === id && awayActive(a));
/* 还没开始的离家计划：已经登记但日期还没到 */
const awayPlanned = id => S.away.find(a => a.who === id && !a.cancelled && a.fromDn > dnNow());

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
/* 新室友入住引出的、还在讨论并且会改到某条现有约定的议题：首页用它提示"入住前有 N 件事待确认" */
const rulesToRevisit = () => openTopics().filter(t => t.origin === 'lin')
  .map(t => ({ topic:t, rule:S.rules.find(r => r.id === t.ruleId) }))
  .filter(x => x.rule);
/* 某条约定是否正被哪个议题讨论着 */
const topicOnRule = rule => openTopics().find(t => (t.ruleId || t.revisit) === rule.id);

/* 留宿上限从约定文字里读，约定改了判断跟着改 */
/* 约定是"同一访客"每周最多几晚，所以按 host + guestId 分别累计，取最多的那一对来判断。
   有已批准的临时例外时，这一对的上限临时抬高；到期后自动回到原约定。 */
function overnightRule() {
  const rule = S.rules.find(x => x.prefKey === 'overnight');
  if (!rule) return null;
  const m = (rule.title + rule.desc).match(/(\d+)\s*晚/);
  const limit = m ? +m[1] : 2;
  const pairs = [];
  household().forEach(x => guestsOf(x.id).forEach(g => {
    const extra = extraNights(x.id, g.guestId);
    pairs.push({ host:x.id, ...g, extra, allow: limit + extra, over: g.nights > limit + extra });
  }));
  pairs.sort((a, b) => (b.nights - b.allow) - (a.nights - a.allow) || b.nights - a.nights);
  const withNights = pairs.filter(p => p.nights);
  const top = withNights[0];
  const actual = top ? top.nights : 0;
  return { rule, limit, actual, who: top && top.host, guest: top && top.guest, guestId: top && top.guestId,
    pairs: withNights, allPairs: pairs, extra: top ? top.extra : 0, allow: top ? top.allow : limit,
    exceeded: !!top && top.over };
}
/* 某位成员的某位访客再加 n 晚之后是什么情况：在约定内 / 有例外兜着 / 超出 */
function stayCheck(host, guestId, add) {
  const o = overnightRule(), had = nightsOf(host, guestId), extra = extraNights(host, guestId);
  const total = had + (add || 0), allow = o.limit + extra;
  return { had, add: add || 0, total, limit: o.limit, extra, allow, over: total > allow, rule: o.rule };
}

/* 某一项上"家里现在的做法"：有对应约定就按约定对应的选项值，没有就按在住成员的多数 */
function houseValOf(k) {
  const rule = S.rules.find(r => r.prefKey === k);
  if (rule && rule.prefVal) return { v:rule.prefVal, from:'rule', rule };
  const count = {};
  living().forEach(m => { const v = m.prefs[k]; if (v) count[v] = (count[v] || 0) + 1; });
  const v = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  return v ? { v, from:'house', rule } : null;
}
/* 我的偏好和家里现在的做法 / 共同约定不同的地方。改偏好不改约定，这里只用来提醒去共识页聊 */
const myPrefDiff = (id = ME) => PREF_KEYS.filter(p => p.cmp && p.kind === 'rule')
  .map(p => ({ ...p, mine: mem(id).prefs[p.k], house: houseValOf(p.k) }))
  .filter(x => x.mine && x.house && x.mine !== x.house.v);
/* 约定文字改了之后，尽量把它对应回一个选项值；对不上就不再拿来比对 */
function prefValFromText(k, text) {
  if (k === 'overnight') { const m = text.match(/(\d+)\s*晚/); return m ? `每周 ≤${m[1]} 晚` : (/不限/.test(text) ? '不限' : undefined); }
  if (k === 'temp')      { const m = text.match(/(\d+)\s*°C/); return m ? `${m[1]}°C` : undefined; }
  if (k === 'quiet')     { const m = text.match(/(\d{1,2}:\d{2})/); return m ? m[1] : undefined; }
  return undefined;
}

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

/* ---------- 请求：谁发起、要谁回应、每个人分别怎么说 ----------
   一条请求的生命周期：
     open 等待回应 → agreed 申请通过 → done 执行完成
                   ↘ declined 有人不同意 ↘ discuss 转为讨论 ↘ cancelled 已撤回 ↘ expired 已过期
   need 是"必须回应的人"（发起人不在里面，不能自己批自己）。
   只有 need 里的人全部同意，状态才会变成"申请通过"；有一个人不同意，就不再显示为通过。 */
const REQ_LABEL = { borrow:'借用物品', swap:'换班', stay:'额外留宿', zone:'分区调整', split:'分摊方案', zones:'新成员分区' };
const REQ_STATUS = { open:'等待回应', agreed:'申请通过', done:'执行完成', declined:'有人不同意',
  discuss:'转为一起讨论', cancelled:'已撤回', expired:'已过期' };
const RESP_TEXT = { agree:'同意', decline:'不同意', discuss:'想讨论一下' };
/* 现在还需要谁回应：need 里仍然在住的人（搬走的不再计入，请求不会被一个已走的人卡住） */
const reqNeed = r => (r.need || []).filter(id => membership(id) === 'active');
const reqResp = (r, id) => (r.responses || {})[id] || null;
const reqAgreedBy = r => reqNeed(r).filter(id => (reqResp(r, id) || {}).stance === 'agree');
const reqWaiting  = r => reqNeed(r).filter(id => !reqResp(r, id));
const reqDeclined = r => reqNeed(r).filter(id => (reqResp(r, id) || {}).stance === 'decline');
const reqOpen = r => r.status === 'open';
/* 全部必要成员都同意了才算通过；没人需要回应（都搬走了）也视为通过 */
const reqPassed = r => reqOpen(r) && !reqDeclined(r).length && !reqWaiting(r).length;
const reqProgress = r => { const need = reqNeed(r);
  return need.length ? `${reqAgreedBy(r).length}/${need.length} 位已同意` : '没有需要回应的人'; };
/* 过期：到了截止日还没有全部同意 */
const reqExpired = r => reqOpen(r) && r.expiresDn != null && r.expiresDn < dnNow();
/* 需要我回应的：我在 need 里、还没表过态、请求还开着 */
const inboxRequests = (id = ME) => can('requests', id)
  ? S.requests.filter(r => reqOpen(r) && !reqExpired(r) && reqNeed(r).includes(id) && !reqResp(r, id)) : [];
/* 我参与的、还没有结果的请求（包括我已经回应、在等别人的） */
const waitingRequests = (id = ME) => S.requests.filter(r => reqOpen(r) && !reqExpired(r) &&
  (r.from === id || reqNeed(r).includes(id)));
/* 物品的共享方式变了 / 物品删了 / 成员搬走了：还没处理的请求不能悬着 */
function cancelRequests(pred, note) {
  let n = 0;
  S.requests.forEach(r => { if (reqOpen(r) && pred(r)) { r.status = 'cancelled'; r.note = note; r.resolvedAt = stamp(); r.by = ME; n++;
    if (r.effect && r.effect.exception) { const e = S.exceptions.find(x => x.id === r.effect.exception); if (e && e.status === 'pending') e.status = 'cancelled'; } } });
  return n;
}
const myRequests = (id = ME) => S.requests.filter(r => r.from === id);
const openRequests = () => S.requests.filter(reqOpen);
/* 到期的请求自动失效，相关的例外一起收尾，不留半截状态 */
function sweepRequests() {
  let n = 0;
  S.requests.forEach(r => {
    if (!reqExpired(r)) return;
    r.status = 'expired'; r.resolvedAt = `${fmtDn(dnNow())} ${nowHM()}`; n++;
    if (r.effect && r.effect.exception) { const e = S.exceptions.find(x => x.id === r.effect.exception); if (e && e.status === 'pending') e.status = 'expired'; }
  });
  return n;
}

/* ---------- 模拟站内消息 ----------
   Demo 不接真实推送。私下沟通、中立提醒、管家回执都落成站内消息，
   切换到接收者的身份就能看到。每条都标明是演示行为。 */
const MSG_KIND = { private:'私下沟通', remind:'中立提醒', steward:'管家回执', notify:'系统提醒', house:'全体通知' };
const myMessages = (id = ME) => S.messages.filter(m => m.to.includes(id));
const unreadMessages = (id = ME) => myMessages(id).filter(m => !m.read[id]);
function sendMessage(o) {
  const m = { id:'mg' + Date.now() + Math.floor(Math.random() * 1000), kind:o.kind || 'notify',
    from:o.from || ME, to:o.to || [], title:o.title, body:o.body, anonymous:!!o.anonymous,
    dn:dnNow(), at:`${relDn(dnNow())} ${nowHM()}`, read:{}, meta:o.meta || null };
  S.messages.unshift(m);
  return m;
}

/* ---------- 讨论 ----------
   一个议题 = 当前方案（proposal，可以改，改一次 version +1）+ 每个人对"这一版方案"的态度。
   status：discussion 正在讨论 → resolved 大家都接受、写进约定；hold 是"暂不调整"。
   positions[成员] = { stance:'agree' | 'disagree' | 'undecided', note, version, at }
   每人只保留当前有效的一条，改主意就覆盖；来龙去脉记在 history 里。
   对旧版方案的表态不算数（version 对不上就是"方案已调整，待重新确认"）。
   Lin 不给自己的偏好投票：第 1 版方案本来就是按他填的偏好和家里的约定拟的，
   他的状态是"偏好已提供"；方案被改过（version > 1）才需要 Lin 也确认一次。 */
const STANCE_TEXT = { agree:'已同意', disagree:'不同意', undecided:'再想想', provided:'偏好已提供' };
const TOPIC_CAT = { overnight:'访客', visitor:'访客', temp:'其他', quiet:'噪音', kitchen:'清洁', supply:'物品', smoke:'其他' };

function newTopic(o) {
  return { id:o.id || 'tp' + Date.now(), title:o.title, prefKey:o.prefKey || null,
    origin:o.origin || 'member', subject:o.subject || null, ruleId:o.ruleId || o.revisit || null, revisit:o.revisit || null,
    proposal:o.proposal, version:1, status:'discussion', openedAt:o.at || '',
    positions:{}, history:[{ type:'open', who:o.by || 'sys', at:o.at || '', text:o.openText || '' }] };
}
const topicById  = id => S.topics.find(t => t.id === id);
const openTopics = () => S.topics.filter(t => t.status === 'discussion');
const holdTopics = () => S.topics.filter(t => t.status === 'hold');
/* 限时试行：先按新方案走一段时间，到期回到讨论，而不是悄悄变成永久约定 */
const trialTopics = () => S.topics.filter(t => t.status === 'trial');
const trialOver = t => t.status === 'trial' && t.trialUntilDn != null && t.trialUntilDn < dnNow();
function sweepTrials() {
  let n = 0;
  S.topics.forEach(t => { if (trialOver(t)) {
    t.status = 'discussion'; t.positions = {};
    t.history.push({ type:'trialEnd', who:'sys', at:`${relDn(dnNow())} ${nowHM()}`, version:t.version });
    /* 试行期的临时条文撤下，长期约定回到试行前那一版 */
    const rule = S.rules.find(r => r.id === (t.ruleId || t.revisit));
    if (rule && rule.trialOf === t.id) { Object.assign(rule, rule.beforeTrial || {}); delete rule.trialOf; delete rule.beforeTrial; }
    n++;
  } });
  return n;
}

/* 谁的接受是这个议题需要的：在住的每个人；由新室友偏好引出的议题，方案改过之后也要请这位新室友再确认 */
const topicNeeds = t => {
  const ids = living().map(m => m.id);
  if (t.subject && !ids.includes(t.subject) && t.version > 1 && membership(t.subject) === 'pending') ids.push(t.subject);
  return ids;
};
/* 只认对当前这版方案的表态 */
const positionOf    = (t, id) => { const p = t.positions[id]; return p && p.version === t.version ? p : null; };
const stalePosition = (t, id) => { const p = t.positions[id]; return p && p.version !== t.version ? p : null; };
/* 第 1 版方案本来就是按新室友填的偏好拟的，他不用再对自己的偏好表态 */
const providedFor = (t, id) => t.subject === id && t.version === 1;
const topicResolvable = t => topicNeeds(t).every(id => { const p = positionOf(t, id); return (p && p.stance === 'agree') || providedFor(t, id); });

/* 议题里某个人现在的状态，卡片和详情页都用它 */
function stanceOf(t, id) {
  const isSub = t.subject === id;
  const p = positionOf(t, id), old = stalePosition(t, id);
  if (p && p.stance !== 'provided') return { k:p.stance, text: isSub && p.stance === 'agree' ? '可以接受' : STANCE_TEXT[p.stance], note:p.note };
  if (old && old.stance !== 'provided') return { k:'stale', text:'方案已调整，待重新确认', prev:old.stance, note:old.note };
  if (isSub) return { k:'provided', text: t.version > 1 ? '方案调整后，待确认' : '偏好已提供', note: p ? p.note : old ? old.note : '' };
  return { k:'none', text:'待表态', note:'' };
}
/* "家里还有议题没达成" ≠ "现在需要我做事"。需要我做的只有：还没表态、方案改过要重新确认、
   新室友在方案调整后要确认。"再想想"已经是一个决定，只有别人都接受了、只剩我时才再提醒一次。 */
function topicNeedsMe(t, id = ME) {
  if (t.status !== 'discussion' || !topicNeeds(t).includes(id)) return false;
  const s = stanceOf(t, id);
  if (s.k === 'none' || s.k === 'stale') return true;
  if (s.k === 'provided') return t.version > 1;
  if (s.k === 'undecided') return topicNeeds(t).filter(x => x !== id)
    .every(x => { const p = positionOf(t, x); return (p && p.stance === 'agree') || providedFor(t, x); });
  return false;
}
const myPendingTopics = (id = ME) => openTopics().filter(t => topicNeedsMe(t, id));
/* 讨论范围：在住成员看全部；即将入住的只看由自己入住引出的 */
const visibleTopics = (id = ME) => can('talk', id) ? openTopics() : can('talkOwn', id) ? openTopics().filter(t => t.subject === id) : [];
/* 议题为什么还开着：几个人接受、几个人不同意、几个人还没说 */
function topicSummary(t) {
  const n = { agree:0, disagree:0, undecided:0, none:0 };
  topicNeeds(t).forEach(id => { const s = stanceOf(t, id).k; n[s === 'stale' ? 'none' : s === 'provided' ? (t.version > 1 ? 'none' : 'agree') : s]++; });
  const parts = [];
  if (n.agree) parts.push(`${n.agree} 人接受`);
  if (n.disagree) parts.push(`${n.disagree} 人不同意`);
  if (n.undecided) parts.push(`${n.undecided} 人再想想`);
  if (n.none) parts.push(`${n.none} 人还没表态`);
  return parts.join(' · ');
}

/* 新室友的偏好和家里做法不同的地方，系统比对完就直接放进"正在讨论"，不需要谁来"发起" */
function ensureLinTopics() {
  const d = linDiff();
  if (!d.lin) return;
  d.diff.forEach(x => {
    if (S.topics.some(t => t.origin === 'lin' && t.prefKey === x.k)) return;
    S.topics.push(newTopic({ id:`tp-lin-${x.k}`, title:x.label, prefKey:x.k, origin:'lin', subject:d.lin.id, ruleId:x.rule && x.rule.id,
      proposal: SUGGESTION[x.k] || `现在家里是${x.house}，${d.lin.name} 的偏好是${x.lin}，一起定一个大家都接受的做法。`,
      by:'sys', at:d.lin.prefsSrc.at,
      openText:`${d.lin.name} 填的偏好「${x.lin}」和家里现在的做法「${x.house}」不同，系统把它放进讨论` }));
  });
}
ensureLinTopics();

/* 已经处理过的问题不再重复提醒 */
const needsReminder = issue => !issue.follow || issue.follow === 'self';
/* "仅自己留存"的记录只有本人看得到；不是在住成员的看不到问题记录 */
const visibleIssues = (id = ME) => can('issues', id)
  ? S.issues.filter(i => !(i.follow === 'self' && i.src && i.src.via === 'member' && i.src.by !== id)) : [];

/* 导航红点 = 现在需要我本人做的动作，不是家里有多少事：
   生活 = 今天轮到我的值日 + 等我回应的请求；账单 = 等我付的份额；共识 = 等我表态 / 重新确认的议题 */
const badge = tab => {
  if (tab === 'me')    return unreadMessages().length;
  if (tab === 'life')  return can('tasks') ? myTasks().filter(t => taskToday(t) || taskOverdue(t)).length + inboxRequests().length : 0;
  if (tab === 'bill')  return can('pay') ? myDue().length + (can('bills') ? myToConfirm().length : 0) : 0;
  if (tab === 'talk')  return myPendingTopics().length;
  return 0;
};
