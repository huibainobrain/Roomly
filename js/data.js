/* ============================================================
   合租生活管家 · 数据层

   核心约束：页面上每一个动态事实，都必须能回答"谁在什么时候
   通过什么动作产生了它"。来源只有四类：
     member   成员主动登记
     shared   成员共同设定
     derived  系统根据已有记录计算
     platform 租赁机构同步
   系统不感知真实生活，只知道被登记下来的事。
   ============================================================ */

const TODAY = '9月12日';
const NOW = '21:05';
/* 演示日期是 2026 年 9 月 12 日（周六）；生活页的"明天"按这个日历推 */
const WEEKDAY = '周六';
const TOMORROW = { date:'9月13日', wd:'周日' };

const HOUSE = {
  name: '望京西园三区 · 503',
  org: '相寓 · 托管房源',
  steward: '陈管家',
  /* 保洁由机构排期，住户不手动新增 */
  clean: { next:'周四 10:00', src:{ via:'platform', at:'9月9日' } }
};

/* ---------- 来源标记 ---------- */
const VIA_LABEL = { member:'成员登记', shared:'共同设定', derived:'系统推导', platform:'相寓同步' };
function srcNote(s) {
  if (!s) return '';
  if (s.via === 'platform') return `相寓同步${s.at ? ' · ' + s.at : ''}`;
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
const mem = id => {
  const base = MEMBERS.find(m => m.id === id) || { id, name:id, short:'?', c:'#8A938D', prefs:{} };
  if (id === ME && typeof S !== 'undefined' && S && S.myPrefs)
    return { ...base, prefs: { ...base.prefs, ...S.myPrefs } };
  return base;
};
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
  note:'<path d="M6 3h9l4 4v14H6V3Z"/><path d="M15 3v4h4"/><path d="M9.5 12h5M9.5 16h5"/>'
};
const svg = (p, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

/* ============ 展示辅助 ============ */
const av = (id, cls = '') => {
  const m = mem(id);
  const ghost = m.incoming || S.movedOut.includes(id);
  return `<span class="av ${cls} ${id===ME?'me':''} ${ghost?'ghost':''}" ${ghost?'':`style="background:${m.c}"`} title="${m.name}">${
    m.photo ? `<img src="${m.photo}" alt="" onerror="this.remove()">` : ''}${m.short}</span>`;
};
const yuan = n => {
  const v = Math.round(n * 100) / 100;
  return '¥' + (Number.isInteger(v) ? v : v.toFixed(2));
};
/* 系统只知道谁登记了离家，不知道谁此刻在不在家 */
const statusOf = id => {
  if (S.movedOut.includes(id)) return 'gone';
  if (mem(id).incoming) return 'incoming';
  return S.away.some(a => a.who === id && a.active) ? 'away' : 'in';
};
const STATUS_TEXT = { in:'在住', away:'登记离家中', incoming:'即将入住', gone:'已搬出' };

/* ============ 初始状态 ============ */
const SUPPLY_STATES = ['充足', '不多了', '快用完', '已用完'];

const SEED = {
  tab: 'home',
  sub: null,
  segment: 'public',
  movedOut: [],

  /* 离家只有这一份原始记录，成员状态、值日、采购、公平分摊都由它推导 */
  away: [
    { id:'a1', who:'tom', from:'9月8日', to:'9月18日', days:10, active:true,
      src:{ via:'member', by:'tom', at:'9月7日 22:10' } }
  ],

  /* 值日 = 共同设定的固定任务模板 + 按日期和离家状态生成的当期安排 */
  choreTemplates: [
    { id:'ct1', task:'倒垃圾',        every:'每 2 天', src:{ via:'shared', at:'6月1日' } },
    { id:'ct2', task:'卫生间简单整理', every:'每周',    src:{ via:'shared', at:'6月1日' } },
    { id:'ct3', task:'公共用品检查',   every:'每周',    src:{ via:'shared', at:'6月1日' } },
    { id:'ct4', task:'保洁前整理',     every:'每两周',  src:{ via:'shared', at:'8月20日' } }
  ],
  tasks: [
    { id:'t1', tpl:'ct1', task:'倒垃圾',          who:'yiming', due:'今天',   done:false },
    { id:'t2', tpl:'ct4', task:'保洁前整理',      who:'yiming', due:'周日',   done:false },
    { id:'t3', tpl:'ct2', task:'卫生间简单整理',   who:'alex',   due:'今天',   done:true, doneAt:'今天 09:20' },
    { id:'t4', tpl:'ct3', task:'公共用品检查',     who:'tom',    due:'本周内', done:false }
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
  visits: [
    { id:'v4', host:'alex', guest:'朋友', guestPhoto:'img/guest-1.jpg', date:'今天',  time:'19:00–22:00', overnight:false, week:true,
      src:{ via:'member', by:'alex', at:'昨天 21:10' } },
    { id:'v3', host:'alex', guest:'朋友', guestPhoto:'img/guest-1.jpg', date:'9月11日', time:'20:30 起', overnight:true, week:true,
      src:{ via:'member', by:'alex', at:'9月11日 20:05' } },
    { id:'v2', host:'alex', guest:'朋友', guestPhoto:'img/guest-1.jpg', date:'9月10日', time:'21:00 起', overnight:true, week:true,
      src:{ via:'member', by:'alex', at:'9月10日 20:40' } },
    { id:'v1', host:'alex', guest:'朋友', guestPhoto:'img/guest-1.jpg', date:'9月9日',  time:'20:00 起', overnight:true, week:true,
      src:{ via:'member', by:'alex', at:'9月9日 19:30' } }
  ],
  /* 请求原语：借物、换班、额外留宿共用一套生命周期
     pending → agreed / declined / discuss，双方都能看到结果 */
  requests: [
    { id:'rq1', kind:'stay', from:'alex', to:'all', subject:'朋友本周再留宿 1 晚',
      detail:'按登记记录这会超过约定的每周 2 晚', status:'pending', at:'今天 19:40' }
  ],

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

  bills: [
    { id:'b1', title:'9月上半月水电', note:'国网 + 自来水', amount:180, payer:'alex',
      people:['yiming','alex','tom'], method:'even', settled:false, date:'9月10日',
      src:{ via:'manual', by:'alex', at:'9月10日 19:22' } },
    { id:'b2', title:'公共清洁用品', note:'洗衣液 · 消毒液 · 抹布', amount:48, payer:'tom',
      people:['yiming','alex','tom'], method:'even', settled:false, date:'9月6日',
      src:{ via:'supply', by:'tom', at:'9月6日 20:10' } },
    { id:'b3', title:'公共纸品补充', note:'厕纸 · 厨房纸', amount:30, payer:'yiming',
      people:['yiming','alex','tom'], method:'even', settled:false, date:'9月4日',
      src:{ via:'supply', by:'yiming', at:'9月4日 18:50' } },
    { id:'b4', title:'阳台防水材料', note:'01室与03室共用阳台', amount:60, payer:'tom',
      people:['alex','tom'], method:'even', settled:false, date:'9月3日',
      src:{ via:'manual', by:'tom', at:'9月3日 15:30' } },
    { id:'b5', title:'宽带费 9–11月', note:'联通 500M', amount:300, payer:'yiming',
      people:['yiming','alex','tom'], method:'even', settled:true, date:'9月1日',
      src:{ via:'manual', by:'yiming', at:'9月1日 09:40' } },
    { id:'b6', title:'厨房灯泡', note:'报修前先自行更换', amount:28, payer:'alex',
      people:['yiming','alex','tom'], method:'even', settled:true, date:'9月2日',
      src:{ via:'manual', by:'alex', at:'9月2日 20:15' } }
  ],
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

  issues: [
    { id:'i1', cat:'清洁', rule:'r4', title:'厨房恢复标准', level:3, count:2, window:'最近 14 天',
      note:'这条约定可能存在理解差异，建议重新明确一次标准。',
      src:{ via:'derived', note:'由 2 次系统提醒记录汇总' }, follow:null }
  ],

  feed: [
    { who:'alex',  text:'把厕纸库存更新为 <b>2 卷</b>', t:'今天 18:20' },
    { who:'alex',  text:'完成了值日「卫生间简单整理」', t:'今天 09:20' },
    { who:'sys',   text:'相寓更新了报修进度：师傅预计周三上门', t:'今天 09:20' },
    { who:'alex',  text:'登记了今晚 19:00–22:00 的访客', t:'昨天 21:10' },
    { who:'yiming',text:'提交了报修：厨房灯不亮', t:'9月11日 20:30' },
    { who:'tom',   text:'登记了离家：9月8日 — 9月18日', t:'9月7日 22:10' }
  ],

  me: 'yiming',
  onboardDone: { yiming:'8月12日', alex:'6月30日', tom:'6月30日', lin:'9月10日' },
  moveout: null,
  myPrefs: {},
  showAllPrefs: false,
  demoPanel: false,
  quiz: { step:0, answers:{} },
  awk: { step:0, cat:'', text:'', focus:'', way:'rule' },
  pending: null
};

/* ============ 持久化 ============ */
const KEY = 'hezu-v4';
let S;
try {
  const raw = JSON.parse(localStorage.getItem(KEY));
  /* 旧版本存档缺字段时整份回退到种子数据，避免半旧半新的状态 */
  const complete = raw && ['bills','rules','spaces','completions','requests','repairs','visits']
    .every(k => Array.isArray(raw[k]));
  S = complete ? raw : structuredClone(SEED);
} catch (e) { S = structuredClone(SEED); }
/* 补齐后来新增的可选字段，老存档也能正常跑 */
Object.keys(SEED).forEach(k => { if (S[k] === undefined) S[k] = structuredClone(SEED[k]); });
/* 访客头像是后加的展示字段，老存档里同一条登记按 id 补上 */
S.visits.forEach(v => { const seed = SEED.visits.find(x => x.id === v.id);
  if (seed && seed.guestPhoto && !v.guestPhoto) v.guestPhoto = seed.guestPhoto; });
/* 演示约定：公平分摊建议是账单页的展示重点，每次重新打开页面都恢复到"待决定"。
   采用 / 维持两个动作只会生成一笔以 utilityForecast.title 命名的账单和一条动态，一并撤掉。 */
{
  const ft = S.utilityForecast.title;
  S.fairApplied = false;
  S.bills = S.bills.filter(b => b.title !== ft);
  S.feed = S.feed.filter(f => !(f.who === 'sys' && f.text.startsWith(ft)));
}
/* 演示约定：共识页的讨论在同一个标签页里刷新会保留（表态、补充意见、方案版本都还在），
   新开一个标签页 / 窗口时回到起点。
   讨论会一路改到规则（版本、措辞、新增）和问题记录，所以回到起点时这一整片
   （议题、规则、问题记录）整体恢复到种子数据，相关的系统动态一并撤掉。
   其他页面自己产生的动态（记账、库存、访客等）不受影响。 */
let freshOpen = true;
try { freshOpen = !sessionStorage.getItem('hezu-open'); sessionStorage.setItem('hezu-open', '1'); } catch (e) {}
if (freshOpen) {
  S.topics = structuredClone(SEED.topics);
  S.rules = structuredClone(SEED.rules);
  S.issues = structuredClone(SEED.issues);
  const TALK_FEED = ['项差异已进入讨论', '暂不调整，保持原有约定', '的建议已提交全员确认', '进入重新确认',
    '新增讨论议题', '已提到家里一起讨论', '的标准被重新明确', '已更新到第', '已获全员确认，成为共同约定',
    '达成了新的约定', '的方案调整到第', '重新打开了讨论',
    '按共同约定发出提醒', '发出了一次私下提醒', '提交了一份协调摘要'];
  S.feed = S.feed.filter(f => !(f.who === 'sys' && TALK_FEED.some(k => f.text.includes(k))));
}
delete S.linDiscussed;
/* 更早版本存档里的议题用 votes 记表态，按现在的结构补齐 */
S.topics.forEach(t => {
  if (t.positions) return;
  t.positions = {}; t.version = t.version || 1; t.history = t.history || [];
  t.proposal = t.proposal || t.detail || '';
  t.status = t.status === 'agreed' ? 'resolved' : t.status === 'hold' ? 'hold' : 'discussion';
  Object.entries(t.votes || {}).forEach(([id, v]) =>
    t.positions[id] = { stance: v === '同意' ? 'agree' : 'undecided', note:'', version:1, at:'' });
  delete t.votes;
});
ME = S.me || 'yiming';
/* 只关乎这一屏怎么显示、不需要记住的状态：对比区展开没有、哪张卡正在写补充意见 */
const UI = { sameOpen:false, noteFor:null, editFor:null };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const logFeed = (who, text, t) => { S.feed.unshift({ who, text, t: t || '刚刚' }); S.feed = S.feed.slice(0, 10); };

/* ============ 派生计算 ============ */
/* 分摊按"分"计算，余数依次给前几个人，保证各人金额相加等于总额 */
function splitOf(b) {
  if (b.shares) return b.shares;
  const cents = Math.round(b.amount * 100), n = b.people.length || 1;
  const base = Math.floor(cents / n), extra = cents - base * n;
  const out = {};
  b.people.forEach((p, i) => out[p] = (base + (i < extra ? 1 : 0)) / 100);
  return out;
}
const shareOf = (b, who) => splitOf(b)[who] || 0;
const perLabel = b => {
  const v = Object.values(splitOf(b));
  return (new Set(v).size === 1 ? '每人 ' : '每人约 ') + yuan(Math.max(...v));
};
const BILL_SRC = { manual:'手动记录', supply:'补充公共用品时自动生成', butler:'通过管家创建' };

const openBills  = () => S.bills.filter(b => !b.settled);
const myDue      = () => openBills().filter(b => b.payer !== ME && b.people.includes(ME));
const myDueTotal = () => myDue().reduce((a, b) => a + shareOf(b, ME), 0);
const monthTotal = () => S.bills.reduce((a, b) => a + b.amount, 0);

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

/* 登记在住天数 = 当月天数 − 本人登记的离家天数。系统不掌握真实居住情况。 */
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

/* ---------- 公共物品 ---------- */
const isLow = s => s.mode === 'count' ? s.qty < s.min : ['快用完', '已用完'].includes(s.state);
const lowSupplies = () => S.supplies.filter(s => s.kind === 'public' && isLow(s));
const supplyText = s => s.mode === 'count' ? `${s.qty} ${s.unit}` : s.state;

/* ---------- 访客：次数由逐条记录累计 ---------- */
const nightsOf = id => S.visits.filter(v => v.host === id && v.overnight && v.week)
                               .reduce((n, v) => n + (v.nights || 1), 0);
const tonightVisits = () => S.visits.filter(v => v.date === '今天');

/* ---------- 洗衣机 ---------- */
const laundryFree = () => !S.laundry.user;

/* ---------- 报修 ---------- */
const openRepairs = () => S.repairs.filter(r => r.timeline[r.timeline.length - 1].s !== '已完成');
const repairState = r => r.timeline[r.timeline.length - 1];

/* ---------- 值日 ---------- */
const myTasks = () => S.tasks.filter(t => t.who === ME && !t.done);
/* 责任分布由完成记录统计得出 */
function loadByMember() {
  const out = {};
  living().forEach(m => out[m.id] = 0);
  S.completions.forEach(([, by]) => { if (out[by] != null) out[by]++; });
  return out;
}
/* 离家期间的任务自动标注暂缓，不在 seed 里写死 */
const taskPaused = t => statusOf(t.who) === 'away';

const awayMembers = () => S.away.filter(a => a.active);
const awayOf = id => S.away.find(a => a.who === id && a.active);
const incomingMember = () => MEMBERS.find(m => m.incoming && !S.movedOut.includes(m.id));

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
function overnightRule() {
  const rule = S.rules.find(x => x.prefKey === 'overnight');
  if (!rule) return null;
  const m = (rule.title + rule.desc).match(/(\d+)\s*晚/);
  const limit = m ? +m[1] : 2;
  const actual = Math.max(0, ...living().map(x => nightsOf(x.id)));
  const who = living().find(x => nightsOf(x.id) === actual);
  return { rule, limit, actual, who: who && who.id, exceeded: actual > limit };
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

/* ---------- 请求：谁发起、发给谁、什么状态 ---------- */
const REQ_LABEL = { borrow:'借用物品', swap:'换班', stay:'额外留宿' };
const REQ_STATUS = { pending:'等待回应', agreed:'已同意', declined:'对方不方便', discuss:'转为一起讨论' };
/* 需要我回应的：指名给我的，或发给全体但不是我发起的 */
const inboxRequests = () => S.requests.filter(r => r.status === 'pending' &&
  r.from !== ME && (r.to === ME || r.to === 'all'));
const myRequests = () => S.requests.filter(r => r.from === ME);
const openRequests = () => S.requests.filter(r => r.status === 'pending');

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
    origin:o.origin || 'member', ruleId:o.ruleId || o.revisit || null, revisit:o.revisit || null,
    proposal:o.proposal, version:1, status:'discussion', openedAt:o.at || '',
    positions:{}, history:[{ type:'open', who:o.by || 'sys', at:o.at || '', text:o.openText || '' }] };
}
const topicById  = id => S.topics.find(t => t.id === id);
const openTopics = () => S.topics.filter(t => t.status === 'discussion');
const holdTopics = () => S.topics.filter(t => t.status === 'hold');

/* 谁的接受是这个议题需要的：在住的每个人；方案改过之后，也要请 Lin 再确认 */
const topicNeeds = t => {
  const ids = living().map(m => m.id), inc = incomingMember();
  if (inc && t.origin === 'lin' && t.version > 1) ids.push(inc.id);
  return ids;
};
/* 只认对当前这版方案的表态 */
const positionOf    = (t, id) => { const p = t.positions[id]; return p && p.version === t.version ? p : null; };
const stalePosition = (t, id) => { const p = t.positions[id]; return p && p.version !== t.version ? p : null; };
const topicResolvable = t => topicNeeds(t).every(id => { const p = positionOf(t, id); return p && p.stance === 'agree'; });

/* 议题里某个人现在的状态，卡片和详情页都用它 */
function stanceOf(t, id) {
  const inc = incomingMember(), isInc = inc && id === inc.id;
  const p = positionOf(t, id), old = stalePosition(t, id);
  if (p && p.stance !== 'provided') return { k:p.stance, text: isInc && p.stance === 'agree' ? '可以接受' : STANCE_TEXT[p.stance], note:p.note };
  if (old && old.stance !== 'provided') return { k:'stale', text:'方案已调整，待重新确认', prev:old.stance, note:old.note };
  if (isInc && t.origin === 'lin') return { k:'provided', text: t.version > 1 ? '方案调整后，待确认' : '偏好已提供', note: p ? p.note : old ? old.note : '' };
  return { k:'none', text:'待表态', note:'' };
}
/* 议题为什么还开着：几个人接受、几个人不同意、几个人还没说 */
function topicSummary(t) {
  const n = { agree:0, disagree:0, undecided:0, none:0 };
  topicNeeds(t).forEach(id => { const s = stanceOf(t, id).k; n[s === 'stale' || s === 'provided' ? 'none' : s]++; });
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
    S.topics.push(newTopic({ id:`tp-lin-${x.k}`, title:x.label, prefKey:x.k, origin:'lin', ruleId:x.rule && x.rule.id,
      proposal: SUGGESTION[x.k] || `现在家里是${x.house}，${d.lin.name} 的偏好是${x.lin}，一起定一个大家都接受的做法。`,
      by:'sys', at:d.lin.prefsSrc.at,
      openText:`${d.lin.name} 填的偏好「${x.lin}」和家里现在的做法「${x.house}」不同，系统把它放进讨论` }));
  });
}
ensureLinTopics();

/* 已经处理过的问题不再重复提醒 */
const needsReminder = issue => !issue.follow || issue.follow === 'self';

const badge = tab => {
  if (tab === 'life')  return myTasks().filter(t => t.due === '今天').length + lowSupplies().length + inboxRequests().length;
  if (tab === 'bill')  return myDue().length;
  if (tab === 'talk')  return openTopics().length;
  return 0;
};
