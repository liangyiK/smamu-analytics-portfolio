(() => {
  'use strict';
  const D = window.SMAData, C = window.SMACore;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n, d = 0) => n === null || !Number.isFinite(n) ? '—' : n.toLocaleString('zh-TW', { maximumFractionDigits: d, minimumFractionDigits: d });
  const pct = n => n === null ? '—' : num(n * 100, 1) + '%';
  const money = n => 'NT$ ' + num(n);

  // Page header for each view: [eyebrow, title, subtitle].
  const views = {
    'e-overview': ['E-COMMERCE · OVERVIEW', '從訂單看見經營全貌', '以一致的訂單口徑，理解商品金額、購買規模與時間變化。'],
    'e-channel': ['E-COMMERCE · CHANNEL & PRODUCT', '來源與商品，如何貢獻銷售？', '從金額與訂單拆解組成，再提出需要補充資料的經營問題。'],
    'e-crm': ['E-COMMERCE · CUSTOMER STRATEGY', '顧客分群，讓經營有優先順序', '以固定快照的 RFM，將最近購買、頻率與金額轉成經營假設。'],
    's-overview': ['SOCIAL LISTENING · OVERVIEW', '從社群討論理解消費者', '從 PTT 與 Dcard 的既有樣本整理討論，先確認範圍與資料限制。'],
    's-topics': ['SOCIAL LISTENING · TOPICS', '主題先探索，需求再驗證', '以 LDA 聚合討論關鍵詞，保留模型輸出與人工解讀的界線。'],
    's-sentiment': ['SOCIAL LISTENING · SENTIMENT', '情感判讀，需要多少證據？', '同時呈現模型分布、可判讀率與尚待完成的人工作業。'],
  };

  // Case introduction shared by the three pages of each case.
  const intro = {
    s: '<div><small>RESEARCH QUESTION</small><b>如何把分散的討論整理成可驗證的研究方向？</b></div>' +
      '<p><b>分析路徑：</b>文章去重 → 品牌範圍 → 討論結構 → AI 讀文歸納 → 證據核對。<br>觀察限於既有 12 品牌篩選樣本，非全美妝市場。日期欄與 PTT 網址時間線索衝突，不解讀發文趨勢。</p>',
    e: '<div><small>BUSINESS QUESTION</small><b>當真實數據不能公開，如何展示可用的經營分析？</b></div>' +
      '<p><b>分析路徑：</b>資料稽核 → 訂單與明細分表 → 統一指標 → 來源商品分析 → RFM。<br>資料與商品皆為虛構，示範分析方法與可驗證的計算。</p>',
  };

  // Per-page story strip: [label, text] pairs for question, method and judgement.
  const story = {
    'e-overview': ['商業問題', '不能公開內部數據，如何讓主管理解訂單分析能支持什麼決策？', '分析方法', '用虛構資料重建顧客、訂單與商品明細，先統一完成訂單口徑。', '關鍵判斷', '來源金額接近；缺少成本與流量，不能據此決定投放預算。'],
    'e-channel': ['商業問題', '金額最高的商品，是否也賣得最多、最值得主推？', '分析方法', '比較商品金額占比、件數與平均單價，區分價格和數量。', '關鍵判斷', '前三商品占 64.4% 金額、32.3% 件數；主推決策仍需成本與庫存。'],
    'e-crm': ['商業問題', '顧客經營資源有限，應先照顧哪些人？', '分析方法', '固定 12 個月快照，用最近購買、頻率及金額建立 RFM 分群。', '關鍵判斷', '高價值群與沉睡潛力群可採不同策略；以對照實驗驗證增量。'],
    's-overview': ['研究問題', '如何從跨平台、多品牌文章找到值得深入的討論？', '分析方法', '識別並去重文章，依品牌規則整理樣本與多品牌提及。', '關鍵判斷', '1,436 篇提及多個研究品牌；日期存在衝突，暫不解讀趨勢。'],
    's-topics': ['研究問題', '文章中的哪些使用情境與購買疑慮值得追查？', '分析方法', '底妝與保養各按平台、長短文抽讀 24 篇，區分選購、購後問題、引用與反例；各輪不合併計數。', '關鍵判斷', '底妝追查試用與選色；保養追查產品角色與生活限制。資訊、促購與購後服務需要分流。'],
    's-sentiment': ['研究問題', '模型的正負面分布能支持什麼判斷？', '分析方法', '分開呈現成功判讀、未知與模型標籤，核對文章的評價對象。', '關鍵判斷', '可判讀率不是準確率；整篇情感不能直接代表單一品牌滿意度。'],
  };

  let view = 'e-overview', csvRows = [], saved = { e: null, s: null };

  const options = (id, values) => $(id).innerHTML = '<option value="">全部</option>' + values.map(v => `<option>${esc(v)}</option>`).join('');
  options('source', [...new Set(D.ecommerce.map(r => r.source))].sort());
  options('category', [...new Set(D.ecommerce.map(r => r.category))].sort());

  // ---- HTML building blocks ----
  const kpi = (label, value, hint) => `<div class="kpi"><small>${label}</small><strong>${value}</strong><em>${hint}</em></div>`;
  const panel = (title, sub, body) => `<section class="panel"><h2>${title}</h2><p class="sub">${sub}</p>${body}</section>`;
  const note = (title, text, warn = false) => `<div class="note${warn ? ' warn' : ''}"><b>${title}</b><p>${text}</p></div>`;
  const evidence = items => '<div class="evidence">' +
    items.map((r, i) => `<div><small>0${i + 1} · ${r[0]}</small><b>${r[1]}</b><p>${r[2]}</p></div>`).join('') +
    '</div>';

  function bars(rows, format = num, color = 'var(--accent)') {
    if (!rows.length) return '<p class="sub">此條件沒有資料。</p>';
    const max = Math.max(...rows.map(r => r.value), 1);
    return '<div class="bars">' + rows.map(r =>
      `<div class="bar-row"><span class="bar-label">${esc(r.name)}</span>` +
      `<div class="track"><div class="fill" style="width:${100 * r.value / max}%;background:${color}"></div></div>` +
      `<span class="bar-num">${format(r.value)}</span></div>`
    ).join('') + '</div>';
  }

  function table(headers, rows) {
    return '<div class="table-wrap"><table><thead><tr>' +
      headers.map(x => '<th scope="col">' + esc(x) + '</th>').join('') +
      '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map(x => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  // Every calendar month (YYYY-MM) from start to end, inclusive.
  function months(start, end) {
    const a = new Date(start.slice(0, 7) + '-01T00:00:00Z'), b = end.slice(0, 7), out = [];
    while (a.toISOString().slice(0, 7) <= b) {
      out.push(a.toISOString().slice(0, 7));
      a.setUTCMonth(a.getUTCMonth() + 1);
    }
    return out;
  }

  // Monthly line chart as inline SVG, followed by an expandable table of the same values.
  // The month axis is clipped to the case's data window so a wide filter adds no empty years.
  // A first or last month the window only partly covers is drawn dashed with a hollow point,
  // so a one-day month does not read as a sales collapse.
  function trend(rows, f, metric) {
    const values = new Map(C.group(rows, r => r.date.slice(0, 7), metric).map(r => [r.name, r.value]));
    const base = defaults(view[0]);
    const from = f.start > base.start ? f.start : base.start, to = f.end < base.end ? f.end : base.end;
    const data = months(from, to).map(m => {
      const total = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
      const first = m === from.slice(0, 7) ? +from.slice(8) : 1, last = m === to.slice(0, 7) ? +to.slice(8) : total;
      return { name: m, value: values.get(m) || 0, days: last - first + 1, total };
    });
    const partial = data.map(r => r.days < r.total), n = data.length;
    const label = r => r.days < r.total ? `${r.name}（${r.days}／${r.total} 天）` : r.name;
    const max = Math.max(...data.map(r => r.value), 1), w = 600, h = 218, left = 62, bottom = 183;
    const step = n > 1 ? 518 / (n - 1) : 0;
    const points = data.map((r, i) => [left + i * step, bottom - r.value / max * 145]);
    const line = (a, b, cls) => `<polyline class="${cls}" points="${points.slice(a, b + 1).map(p => p.join(',')).join(' ')}"/>`;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="月份趨勢圖，下方可展開數值表">`;
    for (let i = 0; i < 4; i++) {
      const y = bottom - 145 * i / 3;
      s += `<line class="gridline" x1="${left}" x2="585" y1="${y}" y2="${y}"/>` +
        `<text x="52" y="${y + 3}" text-anchor="end">${num(max * i / 3 / ((max > 1000000) ? 10000 : 1))}${max > 1000000 ? '萬' : ''}</text>`;
    }
    // Only the first and last months can be partial: solid between them, dashed into them.
    const a = partial[0] ? 1 : 0, b = partial[n - 1] ? n - 2 : n - 1;
    if (b > a) s += line(a, b, 'trendline');
    for (let i = 0; i < n - 1; i++) if (partial[i] || partial[i + 1]) s += line(i, i + 1, 'trendline partial');
    data.forEach((r, i) => {
      const [x, y] = points[i];
      s += partial[i]
        ? `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff" stroke="#895365" stroke-width="1.5"><title>${label(r)}: ${num(r.value)}</title></circle>`
        : `<circle cx="${x}" cy="${y}" r="3" fill="#895365"><title>${r.name}: ${num(r.value)}</title></circle>`;
      if (i === 0 || i === n - 1 || i % Math.ceil(n / 5) === 0)
        s += `<text x="${x}" y="207" text-anchor="middle">${r.name.slice(2)}</text>`;
    });
    s += '</svg>';
    const cut = data.filter(r => r.days < r.total);
    if (cut.length)
      s += `<p class="sub">虛線與空心點為不完整月份（${cut.map(r => `${r.name} 含 ${r.days}／${r.total} 天`).join('、')}），不能直接與完整月份比較。</p>`;
    return s + '<details><summary class="sub">查看每月數值</summary>' +
      table(['月份', metric ? '商品金額 TWD' : '文章數'], data.map(r => [label(r), num(r.value)])) +
      '</details>';
  }

  // ---- Filter form ----
  function getForm() {
    return { start: $('start').value, end: $('end').value, source: $('source').value, category: $('category').value, platform: $('platform').value };
  }
  function setForm(f) {
    for (const k of ['start', 'end', 'source', 'category', 'platform']) $(k).value = f[k] || '';
  }
  function defaults(type) {
    return type === 'e' ? { start: '2023-08-02', end: '2025-08-01' } : { start: '2024-05-01', end: '2025-03-31' };
  }

  // ---- Page rendering ----
  function render() {
    const social = view.startsWith('s-'), crm = view === 'e-crm', f = getForm();
    $('mode').textContent = social ? '歷史樣本 · 日期待核實' : '模擬資料 · 已完成訂單';
    $('eyebrow').textContent = views[view][0];
    $('title').textContent = views[view][1];
    $('subtitle').textContent = views[view][2];
    $('filters').hidden = crm;
    $('source-label').hidden = social;
    $('category-label').hidden = social;
    $('platform-label').hidden = !social;

    const st = story[view];
    $('case-intro').innerHTML = social ? intro.s : intro.e;
    $('case-intro').innerHTML += '<div class="case-story" aria-label="分析思路">' +
      [0, 2, 4].map((i, n) => `<div><small>0${n + 1} · ${st[i]}</small><p>${st[i + 1]}</p></div>`).join('') +
      '</div>';
    $('scope').textContent = crm
      ? '固定快照：2025-08-02｜全店 2024-08-02 至 2025-08-01｜已完成訂單｜此頁不套用探索篩選'
      : `${social ? '來源日期欄（非核實發文日）：' : ''}${f.start} 至 ${f.end}（台北日期，含首尾日）｜` +
        `${social ? (f.platform || '全部平台') : '已完成訂單 · ' + (f.source || '全部來源') + ' · ' + (f.category || '全部商品分類')}`;

    try {
      if (crm) {
        crmPage();
        $('download').disabled = false;
      } else {
        const rows = C.filterRows(social ? D.social : D.ecommerce, social
          ? { start: f.start, end: f.end, platform: f.platform }
          : { start: f.start, end: f.end, source: f.source, category: f.category });
        if (!rows.length) {
          $('content').innerHTML = '<div class="empty"><h2>此條件沒有資料</h2><p>請調整日期或篩選條件，或按「重設」回到完整樣本。</p></div>';
          csvRows = [['狀態', '此條件沒有資料']];
        } else if (social) socialPage(rows, f);
        else ecommercePage(rows, f);
        $('download').disabled = false;
      }
    } catch (e) {
      $('content').innerHTML = `<div class="empty" role="alert"><h2>請檢查日期</h2><p>${esc(e.message)}</p></div>`;
      $('download').disabled = true;
    }

    // Full-sample findings only apply to the unfiltered snapshot.
    const base = defaults(social ? 's' : 'e');
    if (crm || (f.start === base.start && f.end === base.end && !f.source && !f.category && !f.platform))
      $('content').innerHTML = findings(view) + $('content').innerHTML;
    $('method-body').innerHTML = social ? socialMethod() : ecomMethod();
    document.querySelectorAll('[data-view]').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
      b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
    });
  }

  function ecommercePage(rows, f) {
    const s = C.ecommerceSummary(rows), sources = C.group(rows, 'source', r => r.amount), products = C.group(rows, 'product', r => r.amount);
    let html = '<div class="kpis">' +
      kpi('商品銷售額', money(s.sales), '明細商品金額加總；不含運費與稅額') +
      kpi('訂單數', num(s.orders), '依訂單識別碼去重') +
      kpi('購買人數', num(s.customers), '依顧客識別碼去重') +
      kpi('平均訂單商品金額', money(s.aov), '商品金額 ÷ 訂單數；畫面取整數') +
      '</div>';
    if (view === 'e-overview') {
      html += '<div class="grid">' +
        panel('商品銷售額趨勢', '每月彙總 · 期間邊界月份可能不是完整月份', trend(rows, f, r => r.amount)) +
        panel('從觀察走向可驗證的問題', '只描述當前篩選結果，不將模擬差異解讀為真實成效', evidence([
          ['組成', `${esc(sources[0].name)} 貢獻 ${pct(sources[0].value / s.sales)}`, '比較來源時需補上投放成本與流量，才能評估效率。'],
          ['商品', `${esc(products[0].name)} 為金額首位`, '金額可能同時受到價格、件數與訂單組成影響；進入來源與商品頁拆解。'],
          ['顧客', `${num(s.customers)} 位顧客，${num(s.orders / s.customers, 2)} 張訂單／人`, '這是期間購買頻次，不能直接視為留存率。以固定 RFM 快照檢視客群。'],
        ])) +
        '</div>';
      html += note('口徑決定數字的意義', '商品篩選只保留符合條件的明細；同一訂單可能橫跨分類。因此篩選後的平均金額，是每張相關訂單的所選商品金額。');
    } else {
      const cats = C.group(rows, 'category', r => r.amount);
      html += '<div class="grid equal">' +
        panel('來源金額貢獻', '訂單歸屬的來源／媒介；未提供廣告成本與曝光', bars(sources, money)) +
        panel('商品分類組成', '依所選商品明細計算；分類訂單數不可直接相加', bars(cats, money, 'var(--teal)')) +
        '</div>';
      html += panel('商品表現明細', '商品金額、相關訂單與銷售件數共同閱讀', table(
        ['商品', '商品金額 TWD', '金額占比', '相關訂單', '件數'],
        products.map(p => {
          const sub = rows.filter(r => r.product === p.name), m = C.ecommerceSummary(sub);
          return [p.name, num(p.value), pct(p.value / s.sales), num(m.orders), num(m.units)];
        })));
      html += note('下一步驗證：把貢獻拆成價格與數量', '來源金額高不代表投資報酬率較高；商品金額高也不代表毛利較高。若有廣告費、折扣、退貨與成本，再評估投放及商品策略。');
    }
    $('content').innerHTML = html;
    csvRows = [
      ['指標', '數值'], ['資料類型', 'synthetic'], ['開始日期', f.start], ['結束日期', f.end],
      ['來源', f.source || '全部'], ['分類', f.category || '全部'],
      ['商品銷售額', s.sales], ['訂單數', s.orders], ['購買人數', s.customers], ['件數', s.units], ['平均訂單商品金額', s.aov],
      [],
      ['商品', '商品金額'], ...products.map(p => [p.name, p.value]),
    ];
  }

  // RFM uses a fixed snapshot, so this page ignores the exploration filters.
  function crmPage() {
    const r = D.rfm, segments = r.segments;
    const total = segments.reduce((n, z) => n + z.customers, 0), sales = segments.reduce((n, z) => n + z.sales, 0);
    const high = segments.find(z => z.segment === '高價值活躍'), sleep = segments.find(z => z.segment === '沉睡潛力');
    const actions = { '高價值活躍': '回購提醒／會員體驗測試', '近期活躍': '觀察第二次購買與偏好', '沉睡潛力': '小規模喚回實驗，設對照組', '低頻久未購買': '先檢查觸達成本與可聯絡性' };
    $('content').innerHTML = '<div class="kpis">' +
      kpi('合格購買顧客', num(total), '固定期間內至少 1 張已完成訂單') +
      kpi('高價值活躍', num(high.customers), 'R ≥ 3、F ≥ 3、M ≥ 3') +
      kpi('沉睡潛力', num(sleep.customers), 'R < 3，且 F ≥ 3 或 M ≥ 3') +
      kpi('RFM 期間商品金額', money(sales), '僅前 12 個曆月；不等於全期間金額') +
      '</div><div class="grid equal">' +
      panel('客群人數', '全店顧客分群；相同數值不拆散評分',
        bars(segments.map(z => ({ name: z.segment, value: z.customers })).sort((a, b) => b.value - a.value), num)) +
      panel('客群商品金額', '各群於固定 RFM 期間的商品金額加總',
        bars(segments.map(z => ({ name: z.segment, value: z.sales })).sort((a, b) => b.value - a.value), money, 'var(--teal)')) +
      '</div>' +
      panel('由分群形成經營假設', '以下是建議驗證的方案；沒有宣稱已產生營收成效', table(
        ['客群', '人數', 'R 中位數／天', 'F 中位數／張', '待驗證行動'],
        segments.map(z => [z.segment, num(z.customers), num(z.recency, 1), num(z.frequency, 1), actions[z.segment]]))) +
      note('如何驗證分群策略？', '以符合資格的顧客隨機分派處理組與對照組，事前定義回購率、增量商品金額與退訂率。分群切點來自模擬資料，不當作通用商業門檻。');
    csvRows = [
      ['快照', r.snapshot_date], ['期間起日', r.window_start], ['期間迄日', '2025-08-01'],
      ['客群', '人數', '商品金額', 'R中位數', 'F中位數'],
      ...segments.map(z => [z.segment, z.customers, z.sales, z.recency, z.frequency]),
    ];
  }

  function socialPage(rows, f) {
    const s = C.socialSummary(rows), platforms = C.group(rows, 'platform');
    const brands = C.group(rows.flatMap(r => r.brands.map(brand => ({ brand, count: r.count }))), 'brand');
    const topics = C.group(rows.filter(r => r.topic !== null), r => '主題 ' + (r.topic + 1));
    let html = note('模型探索結果 · 人工覆核待完成', '可判讀率僅表示成功產生分數的比例，並非準確率。文章情感不等於品牌滿意度；歷史樣本無法代表全體消費者。', true);
    html += '<div class="kpis">' +
      kpi('納入文章', num(s.posts), '依規則納入；已處理相同來源重複') +
      kpi('成功判讀', num(s.scored), '可產生文章層級情感分數') +
      kpi('可判讀率', pct(s.coverage), '成功判讀 ÷ 納入文章；非準確率') +
      kpi('未知情感', num(s.unknown), '未成功判讀，獨立列示') +
      '</div>';

    if (view === 's-overview') {
      html += '<div class="grid">' +
        panel('日期品質檢查：暫停趨勢解讀', '既有日期欄不等於已核實發文日期', note('5,690 篇 PTT 日期存在衝突', '將網址 M. 後的數字作 Unix 時間換算，5,690／5,690 篇與來源日期欄不同日；部分內文亦提及較早年份。這是待回源核實的線索，尚未擅自改寫日期，也未驗證 Dcard 發文時間。此頁不據此推論成長或季節性。', true)) +
        panel('平台樣本組成', '依來源日期欄選出的既有快照；實際發文期間待核實', bars(platforms, num, 'var(--teal)')) +
        '</div>' +
        panel('品牌提及次數', '同篇可能提及多品牌，各品牌占比加總可能超過 100%；非市場占有率', bars(brands.slice(0, 8), num)) +
        note('閱讀樣本時，先問收集是否完整', '原始檔案的涵蓋日期不等於完整蒐集保證。討論高低可能同時受收集方式、文章長度與品牌納入規則影響；需要抽樣覆核再解讀。現有篩選範圍主要為萊雅相關 12 品牌；不能推廣成全美妝品牌排名。');
    } else if (view === 's-topics') {
      const topicCards = D.topics.map(t => {
        const n = rows.filter(r => r.topic === t.topic_id).reduce((n, r) => n + r.count, 0);
        return `<div class="topic"><div class="topic-head"><h3>主題 ${t.topic_id + 1} · 待人工命名</h3><strong>${num(n)} 篇</strong></div>` +
          `<p>占成功分配 ${pct(s.topics ? n / s.topics : null)}</p>` +
          `<div class="keywords">${t.keywords.map(k => '<span>' + esc(k) + '</span>').join('')}</div></div>`;
      }).join('');
      html += '<div class="grid equal">' +
        panel('LDA 主題分布', `成功分配 ${num(s.topics)} 篇；未分配 ${num(s.posts - s.topics)} 篇。每篇取最高機率主題。`, bars(topics, num)) +
        panel('關鍵詞與待覆核命名', '固定模型 K = 5；以下關鍵詞來自完整訓練樣本，不隨此頁篩選重新訓練。', topicCards) +
        '</div>' +
        note('從模型主題到消費需求，還有一步', '人工閱讀代表文章、確認關鍵詞的語境與主題一致性，再命名並整理需求。此版本只呈現模型群集，不把主題編號直接當成已確認的消費需求。');
    } else {
      const colors = { '正面': '#477a73', '中性': '#a7a49f', '負面': '#a76576' };
      const dist = '<div class="stack" aria-hidden="true">' +
        Object.entries(s.shares).map(([k, v]) => `<span style="width:${100 * (v || 0)}%;background:${colors[k]}"></span>`).join('') +
        '</div><div class="legend">' +
        Object.entries(s.shares).map(([k, v]) => `<span><i style="background:${colors[k]}"></i>${k} ${pct(v)}</span>`).join('') +
        '</div>' +
        table(['模型標籤', '篇數', '成功判讀占比'], Object.entries(s.counts).map(([k, n]) => [k, num(n), pct(s.shares[k])])) +
        '<p class="sub">未知 ' + num(s.unknown) + ' 篇不計入正／中／負占比分母。</p>';
      html += '<div class="grid equal">' +
        panel('文章情感分布', `占比分母：${num(s.scored)} 篇成功判讀文章`, dist) +
        panel('哪些證據已具備？', '將自動檢查與人工品質驗證分開呈現', evidence([
          ['已完成', '資料與計算檢查', '去重、日期邊界、納入規則、未知情感處理及彙總對帳。'],
          ['待完成', '120 筆情感人工覆核', '分層抽樣已備妥，人工標籤仍空白；尚無準確率、混淆矩陣或測試集成績。'],
          ['待完成', '58 筆納入覆核、25 筆主題檢視', '確認品牌語境、文章相關性與主題命名後，才整理可對外引用的代表討論。'],
        ])) +
        '</div>' +
        note('代表文章尚未公開', '待人工選文、摘要及權利檢查完成，再提供經核對的短摘要與原文來源。本頁不以自動挑選的文章冒充已審核證據。');
    }
    $('content').innerHTML = html;
    csvRows = [
      ['指標', '數值'], ['資料類型', 'historical_collected_sample'],
      ['日期品質', '來源日期欄與PTT網址時間線索衝突；非已核實發文期間'], ['人工驗證', 'pending'],
      ['開始日期', f.start], ['結束日期', f.end], ['平台', f.platform || '全部'],
      ['納入文章', s.posts], ['成功判讀', s.scored], ['未知情感', s.unknown], ['可判讀率_非準確率', s.coverage], ['成功分配主題', s.topics],
      [],
      ['情感', '篇數', '成功判讀占比'], ...Object.entries(s.counts).map(([k, n]) => [k, n, s.shares[k]]),
      [],
      ['主題_待人工命名', '篇數'], ...topics.map(r => [r.name, r.value]),
    ];
  }

  // Headline findings for the full, unfiltered sample of each page.
  function findings(v) {
    const title = '全樣本重點發現', scope = '固定完整樣本／RFM 快照；探索篩選後隱藏，重設可再查看。';
    if (v === 'e-overview') return panel(title, scope, evidence([
      ['來源', '五個來源貢獻接近，無充分理由選出投放贏家', 'Instagram 商品金額 8,814,470 元，占 20.9%；Google 8,182,110 元，占 19.4%，差距約 1.5 個百分點。來源是訂單標籤，沒有成本與流量；且生成器隨機分派來源。'],
      ['判斷', '把比較金額，轉成需要哪些決策資料', '目前能比較貢獻，不能比較 ROAS、轉換率或增量效益。若要調整預算，下一步補齊廣告費、流量與歸因規則，而非依模擬排名加碼。'],
    ]));
    if (v === 'e-channel') return panel(title, scope, evidence([
      ['金額與件數', '前三項商品占金額 64.4%，件數只占 32.3%', '修護精華、修護髮膜、護髮精油合計 27,234,980 元、9,099 件；分母分別為 42,268,160 元與 28,144 件。'],
      ['原因拆解', '高單價解釋金額集中，不能直接稱為需求更強', '三項單件成交均價約 3,284／3,002／2,693 元；洗髮露售出 3,214 件，高於三者各自件數。這是生成器價位差異下的模擬示例；選主推商品仍需毛利、庫存與退貨資料。'],
    ]));
    if (v === 'e-crm') return panel(title, '固定 RFM：2024-08-02 至 2025-08-01；分母 1,750 位顧客、21,408,330 元。', evidence([
      ['資源排序', '23.4% 高價值活躍顧客，貢獻 41.1% 商品金額', '410 人／1,750 人；8,802,880 元／21,408,330 元。可作會員體驗或回購提醒的測試對象。'],
      ['待驗證機會', '431 位沉睡潛力顧客，適合小規模喚回實驗', '占合格顧客 24.6%，過去商品金額 7,018,750 元，占 32.8%。歷史金額不等於可挽回營收；應設對照組，衡量增量回購並納入觸達成本。'],
    ]));
    if (v === 's-overview') return panel(title, '12 品牌既有篩選樣本，共 10,373 篇；不是全美妝市場。', evidence([
      ['討論結構', '1,436 篇同時提及多個研究品牌，占 13.8%', '品牌提及可重疊；多品牌不一定都是比較文，也可能是購物清單或合輯。下一步可針對比較語句整理選購理由，不將整篇情感直接歸給單一品牌。'],
      ['範圍限制', '提及前三為蘭蔻、植村秀、聖羅蘭', '分別 2,472、2,193、1,958 篇；只能說在既有品牌與蒐集規則下的提及量。保留較少樣本的品牌，避免把樣本不足誤讀成市場冷門。'],
    ]));
    if (v === 's-topics') return panel('底妝選購障礙：從猶豫走向行銷假設', 'AI 完整讀文 24 篇：17 篇選購、2 篇使用問題、5 篇另案／排除。926 篇候選中 3 篇正文空白；非空候選按平台 × 長短文等額抽樣。不是市場比例或人工金標。', evidence([
      ['試用之後', '不同光線、帶妝時長與情境，仍可能留下疑問', 'B02 未測足持妝時間；B05 換光源後對色號猶豫；B09／B10 希望更完整試妝或觀察。先測試情境觀察＋後續諮詢流程，不直接加碼折扣。'],
      ['選色與取捨', '現用品、希望妝感與生活情境可以一起問', 'B15／B17／B18／B19 希望由既有色號縮小選項；B24 有通勤便利需求。可設計選購引導，不承諾跨品牌色號等同或某產品必然適合某膚質。'],
      ['反例', '猶豫不全是資訊不足，使用問題也不等於購買意願', 'B07 已試妝，主要仍比較官網贈品與代買價格；B14／B21 是使用後操作疑問；B06 是氣墊唇彩誤收。分流後才決定內容、服務或優惠。'],
    ])) +
      panel('怎麼驗證這個行銷假設？', '設計草案，尚未執行；需要另行取得顧客行為資料。', table(['項目', '試驗設計'], [
        ['對象與分派', '已領底妝試用品、尚未購買且自願參加的合格顧客；隨機分成一般提醒與情境觀察＋諮詢邀請，保持產品、優惠與頻率相同。'],
        ['主指標', '14 天內完成有效諮詢人數 ÷ 全部隨機分派合格顧客；事前定義完成標準，不能只計填表完成者。'],
        ['次指標與護欄', '有可串接交易資料再看 30 天購買比例差；同時觀察退訂、投訴與服務成本。時間窗須依實際週期確認。'],
        ['反證與限制', '諮詢增加但購買未改善時，回查價格、通路與適配。樣本量另依基準率與最小效果規劃，24 篇讀文不能估計成效。'],
      ])) +
      note('研究範圍', '本輪 24 篇與先前 15 篇主題探索不合併計數。抽樣、逐篇摘要與反例見下方研究紀錄。日期尚待核實，不推論趨勢或當前產品表現。') +
      '<details class="method"><summary>查看抽樣與逐篇研究紀錄</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7">' + esc(D.baseMakeupNotes) + '</pre></details>' +
      skincareFindings();
    return panel('如何使用情感結果？', '成功產生分數 10,279 篇；模型中性 6,985 篇，占成功判讀 68.0%。', evidence([
      ['可用與不可用', '中性比例高，無法直接解釋為消費者無感', '質問、情報、多品牌混合評價與模型判斷都可能影響分布。這只是候選解釋，本輪未核對各類模型錯誤率。'],
      ['下一步', '針對要引用的發現，核對對象與語境', '已讀樣本出現同篇對不同產品有不同評價。品牌／產品／面向分開整理較有助於形成研究問題；若要報準確率，仍須另做正式人工標註。'],
    ]));
  }

  function skincareFindings() {
    return panel('保養品疑慮：產品角色、生活限制與購後服務', 'AI 完整讀文 24 篇：11 篇一般選購、4 篇購後問題、3 篇特殊照護、3 篇回覆補充、3 篇跨品類／排除。322 篇聚焦候選中 3 篇正文空白；按平台 × 長短文各抽 6 篇，非市場比例或人工金標。', evidence([
      ['角色與資訊', '買完仍不知道如何理解產品之間的角色', 'S10／S13／S18／S20／S21 有品類或版本疑問；S02／S06 已購買仍對資訊整合有疑慮。先改善角色說明與資訊一致性，不由 AI 指定成分搭配。'],
      ['生活限制與反例', '步驟能否維持，比多買一瓶更值得先問', 'S11 擔心多步驟難以持續；S17 不想再加買；S20 有預算限制；S08 同時考量價值觀、價格與容量。尋求建議不等於套組加購機會。'],
      ['服務分流', '資訊疑問、品質詢問與不適回報分開承接', 'S05／S15 需要客服受理，不能由文字判定產品缺陷或適用性；S04／S23／S24 涉及特殊照護，需專業判斷。S09／S12 為同題回覆，不當成兩個獨立需求來源。'],
    ])) +
      panel('優先驗證：角色說明是否幫助選購？', '尚未執行；先測流程可用性，再依流量與基準率規劃隨機試驗。', table(['項目', '驗證草案'], [
        ['對象與內容', '一般品類選購訪客；特殊照護與不適求助另行分流。比較現有頁面與加入品類角色／版本差異的說明頁，內容先經核實，保持商品、價格、優惠與任務相同。'],
        ['主指標與分母', '同次測試中 3 題品類／版本辨識題全部答對的人數 ÷ 全部隨機分派合格訪客；未作答仍留在分母，另報作答率。題目與答案事前依核實資訊訂定。'],
        ['護欄與判斷', '觀察完成時間、錯誤理解與人工協助需求。沒有改善先回查資訊結構及偏好限制；未取得交易資料，不宣稱轉換或營收提升。'],
      ])) +
      note('面試敘事', '從提問分流，找出產品角色不清、生活限制與購後服務需求，再提出可驗證的內容設計。這是歷史小樣本假設，不是功效判定、需求規模或銷售成效。') +
      '<details class="method"><summary>查看保養抽樣、24 篇摘要與驗證設計</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.7">' + esc(D.skincareNotes) + '</pre></details>';
  }

  // ---- "Data, metrics and validation" panel ----
  function ecomMethod() {
    return '<p><strong>資料：</strong>固定種子 42 的虛構電商；2,600 位顧客、9,117 張全狀態訂單、23,026 筆明細與 9 個虛構商品。展示限已完成訂單。原始表按主外鍵及檔案雜湊驗證後匯出。</p>' +
      '<p><strong>指標：</strong>商品金額＝件數 × 商品單價，再按明細加總。訂單數與購買人數各自去重。平均訂單商品金額＝符合明細的商品金額 ÷ 符合明細的訂單數。沒有運費、稅額、成本與退貨資料，不稱淨營收、毛利或 ROAS。</p>' +
      '<p><strong>RFM：</strong>快照 2025-08-02，觀察 2024-08-02 至 2025-08-01。R 為最近一次完成購買距快照天數；F 為完成訂單數；M 為商品金額。四分位評分，同值維持同分，R 反向。切點：' +
      Object.entries(D.rfm.cutpoints).map(([k, v]) => esc(k) + ' = [' + v.map(x => num(x, 2)).join(', ') + ']').join('；') +
      '。</p>' +
      '<p><strong>驗證：</strong>展示資料全量對帳，另測試跨分類訂單去重、日期首尾、來源／商品交集、空資料與零分母。資料用於方法演示，觀察差異不代表真實市場。</p>';
  }
  function socialMethod() {
    return '<p><strong>樣本：</strong>來源日期欄篩選 2024-05-01 至 2025-03-31，Asia/Taipei；不代表已核實發文期間。PTT 網址數字按 Unix 時間換算後 5,690 篇均與此欄不同日；時間線索尚待回源核實，Dcard 未做此項驗證。原檔 PTT 5,839 筆、Dcard 45,374 筆。處理來源重複與日期後，可辨識期間文章 34,008 篇；規則納入 10,373、待確認 985、排除 22,650。收集完整性未知。</p>' +
      '<p><strong>納入與去重：</strong>來源網址標準化後比對內容與日期，相同來源去重。品牌別名搭配美妝語境，歧義名稱待覆核。同內容不同來源保留。品牌提及可重複計入；PTT 互動數不提供。頁面只含匿名彙總資料。</p>' +
      '<p><strong>情感：</strong>全文 SnowNLP 與含局部否定處理的詞典分數；分數 > 0.6 正面、< 0.35 負面，其餘中性。失敗或不合資格標未知，不轉成中性。成功判讀 10,279，未知 94，可判讀率 99.09%。人工準確率尚未評估。</p>' +
      '<p><strong>主題：</strong>固定種子 100、單工作者。候選 K=3、4、5 的訓練 coherence c_v 為 0.389、0.411、0.430，選 K=5。這是探索指標，不是測試集品質保證。成功分配 10,278 篇，主題名稱待人工確認；模型不隨介面篩選重訓。</p>' +
      '<p><strong>限制：</strong>文章層級情感無法直接推論品牌滿意度，品牌提及非市占；沒有與模擬電商串接，不能推論社群造成銷售變化。</p>';
  }

  // ---- Navigation and events ----
  // Each case keeps its own filters when switching between the two cases.
  function switchView(next) {
    if (!views[next]) next = 'e-overview';
    const old = view[0], type = next[0];
    if (old !== type) {
      saved[old] = getForm();
      setForm(saved[type] || defaults(type));
    }
    view = next;
    render();
  }

  $('filters').addEventListener('submit', e => { e.preventDefault(); render(); });
  $('reset').addEventListener('click', () => { setForm(defaults(view[0])); render(); });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.view; }));
  window.addEventListener('hashchange', () => {
    const next = location.hash.slice(1);
    if (views[next]) switchView(next);
  });
  $('download').addEventListener('click', () => {
    const csv = '﻿' + csvRows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const u = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = u;
    a.download = 'SMAmu_' + view + '_summary.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  });

  setForm(defaults('e'));
  switchView(location.hash.slice(1) || 'e-overview');
})();
