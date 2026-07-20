const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSnapshotDir() {
  const dir = path.join(__dirname, '..', '..', 'data', 'snapshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getS18Id(db) {
  const row = db.prepare("SELECT id FROM competitors WHERE name = '极限战场'").get();
  return row ? row.id : null;
}

function generateS18Detail(db, s18Id, startDate, endDate) {
  if (!s18Id) return '<p class="summary-desc">未找到极限战场竞品配置。</p>';

  const report = db.prepare(`
    SELECT * FROM daily_reports
    WHERE competitor_id = ? AND report_date >= ? AND report_date <= ?
  `).all(s18Id, startDate, endDate);

  const totalPosts = report.reduce((s, r) => s + r.total_posts, 0);
  const totalComments = report.reduce((s, r) => s + r.total_comments, 0);
  const posCount = report.reduce((s, r) => s + r.positive_count, 0);
  const neuCount = report.reduce((s, r) => s + r.neutral_count, 0);
  const negCount = report.reduce((s, r) => s + r.negative_count, 0);
  const total = totalComments || 1;
  const posPct = Math.round(posCount / total * 100);
  const neuPct = Math.round(neuCount / total * 100);
  const negPct = Math.round(negCount / total * 100);

  if (totalComments === 0) {
    return `
    <div class="s18-detail">
      <p class="summary-desc">上周极限战场未收集到有效舆情数据，可能暂无用户讨论或数据源未覆盖。</p>
    </div>`;
  }

  const s18Sentiments = db.prepare(`
    SELECT s.sentiment, s.keywords, s.score, c.content, p.platform, p.url, c.author
    FROM sentiment_results s
    JOIN comments c ON s.comment_id = c.id
    JOIN posts p ON c.post_id = p.id
    WHERE p.competitor_id = ? AND date(c.publish_time) >= ? AND date(c.publish_time) <= ?
      AND s.sentiment != 'neutral'
    ORDER BY ABS(s.score) DESC
  `).all(s18Id, startDate, endDate);

  const posKeywords = {};
  const negKeywords = {};
  const platformCount = {};
  for (const s of s18Sentiments) {
    const kws = (s.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    const counter = s.sentiment === 'positive' ? posKeywords : negKeywords;
    for (const kw of kws) counter[kw] = (counter[kw] || 0) + 1;
    platformCount[s.platform] = (platformCount[s.platform] || 0) + 1;
  }

  const topPosKw = Object.entries(posKeywords).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topNegKw = Object.entries(negKeywords).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const posSamples = s18Sentiments.filter(s => s.sentiment === 'positive').slice(0, 5);
  const negSamples = s18Sentiments.filter(s => s.sentiment === 'negative').slice(0, 5);

  const platforms = Object.entries(platformCount).sort((a, b) => b[1] - a[1]);

  let html = '<div class="s18-detail">';

  html += `<div class="s18-metric-row">`;
  html += `<div class="s18-metric"><span class="s18-metric-num">${totalPosts}</span><span class="s18-metric-label">动态数</span></div>`;
  html += `<div class="s18-metric"><span class="s18-metric-num">${totalComments}</span><span class="s18-metric-label">评论数</span></div>`;
  html += `<div class="s18-metric positive"><span class="s18-metric-num">${posPct}%</span><span class="s18-metric-label">正面率</span></div>`;
  html += `<div class="s18-metric neutral"><span class="s18-metric-num">${neuPct}%</span><span class="s18-metric-label">中性率</span></div>`;
  html += `<div class="s18-metric negative"><span class="s18-metric-num">${negPct}%</span><span class="s18-metric-label">负面率</span></div>`;
  html += `</div>`;

  html += `<div class="s18-platforms">数据来源：${platforms.map(([p, c]) => `<span class="platform-tag">${escapeHtml(p)} (${c}条)</span>`).join(' ')}</div>`;

  html += `<div class="s18-cols">`;

  html += `<div class="s18-col">`;
  html += `<h4 class="positive">👍 好评关键词 & 代表评论</h4>`;
  if (topPosKw.length > 0) {
    html += `<div class="summary-kw">${topPosKw.map(([kw, cnt]) => `<span class="kw-tag p">${escapeHtml(kw)}(${cnt})</span>`).join(' ')}</div>`;
    html += `<p class="summary-desc">玩家正面评价集中在 ${topPosKw.slice(0, 3).map(([kw]) => escapeHtml(kw)).join('、')} 等关键词。</p>`;
    html += `<ul class="sample-list">`;
    for (const s of posSamples) {
      html += `<li class="s18-sample"><span class="tag p">好评</span> "${escapeHtml((s.content || '').slice(0, 100))}"`;
      html += `<span class="sample-src"> — ${escapeHtml(s.platform)} | ${escapeHtml(s.author || '匿名')}</span></li>`;
    }
    html += `</ul>`;
  } else {
    html += `<p class="summary-desc">暂无好评数据。</p>`;
  }
  html += `</div>`;

  html += `<div class="s18-col">`;
  html += `<h4 class="negative">👎 负评关键词 & 代表评论</h4>`;
  if (topNegKw.length > 0) {
    html += `<div class="summary-kw">${topNegKw.map(([kw, cnt]) => `<span class="kw-tag n">${escapeHtml(kw)}(${cnt})</span>`).join(' ')}</div>`;
    html += `<p class="summary-desc">玩家负面评价集中在 ${topNegKw.slice(0, 3).map(([kw]) => escapeHtml(kw)).join('、')} 等关键词。</p>`;
    html += `<ul class="sample-list">`;
    for (const s of negSamples) {
      html += `<li class="s18-sample"><span class="tag n">差评</span> "${escapeHtml((s.content || '').slice(0, 100))}"`;
      html += `<span class="sample-src"> — ${escapeHtml(s.platform)} | ${escapeHtml(s.author || '匿名')}</span></li>`;
    }
    html += `</ul>`;
  } else {
    html += `<p class="summary-desc">暂无负评数据。</p>`;
  }
  html += `</div>`;

  html += `</div>`;
  html += `</div>`;

  return html;
}

function generateCompetitorSummaries(db, s18Id, startDate, endDate) {
  const competitors = db.prepare(`
    SELECT c.id, c.name, d.total_posts, d.total_comments, d.positive_count, d.neutral_count, d.negative_count,
           d.summary_text
    FROM daily_reports d
    JOIN competitors c ON d.competitor_id = c.id
    WHERE d.report_date >= ? AND d.report_date <= ?
      AND c.id != ?
      AND d.total_comments > 0
    ORDER BY d.total_comments DESC
  `).all(startDate, endDate, s18Id || -1);

  if (competitors.length === 0) return '';

  let html = '';
  html += `<h3>竞品舆情摘要</h3>`;
  html += `<div class="competitor-summaries">`;

  for (const c of competitors) {
    const total = c.total_comments || 1;
    const posPct = Math.round(c.positive_count / total * 100);
    const negPct = Math.round(c.negative_count / total * 100);

    let riskTag = '';
    if (negPct > 40) riskTag = '<span class="risk-high">⚠ 高风险</span>';
    else if (negPct > 20) riskTag = '<span class="risk-medium">⚠ 注意</span>';

    const cKeywords = db.prepare(`
      SELECT s.keywords FROM sentiment_results s
      JOIN comments cm ON s.comment_id = cm.id
      JOIN posts p ON cm.post_id = p.id
      WHERE p.competitor_id = ? AND date(cm.publish_time) >= ? AND date(cm.publish_time) <= ?
        AND s.keywords != '' AND s.sentiment != 'neutral'
      LIMIT 30
    `).all(c.id, startDate, endDate);

    const kwCount = {};
    for (const row of cKeywords) {
      const kws = (row.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
      for (const kw of kws) kwCount[kw] = (kwCount[kw] || 0) + 1;
    }
    const topKw = Object.entries(kwCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

    html += `<div class="comp-summary-row">`;
    html += `<span class="comp-name">${escapeHtml(c.name)}</span>`;
    html += `<span class="comp-stats">评论${c.total_comments}条 | 正面<span class="positive">${posPct}%</span> | 负面<span class="negative">${negPct}%</span></span>`;
    html += `${riskTag}`;
    if (topKw.length > 0) {
      html += `<span class="comp-kw">${topKw.map(([kw, cnt]) => `<span class="kw-tag">${escapeHtml(kw)}(${cnt})</span>`).join(' ')}</span>`;
    }
    html += `<span class="comp-summary">${escapeHtml(c.summary_text || '')}</span>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function generateSnapshotHtml(startDate, endDate) {
  const db = getDb();
  const s18Id = getS18Id(db);

  const ranking = db.prepare(`
    SELECT
      c.name,
      c.id as competitor_id,
      SUM(d.total_posts) as total_posts,
      SUM(d.total_comments) as total_comments,
      SUM(d.positive_count) as positive_count,
      SUM(d.neutral_count) as neutral_count,
      SUM(d.negative_count) as negative_count
    FROM daily_reports d
    JOIN competitors c ON d.competitor_id = c.id
    WHERE d.report_date >= ? AND d.report_date <= ?
    GROUP BY c.id
    ORDER BY SUM(d.negative_count) * 1.0 / MAX(SUM(d.total_comments), 1) DESC
  `).all(startDate, endDate);

  function renderRow(c) {
    const total = c.total_comments || 1;
    const posPct = Math.round(c.positive_count / total * 100);
    const neuPct = Math.round(c.neutral_count / total * 100);
    const negPct = Math.round(c.negative_count / total * 100);

    let riskLevel = '低';
    let riskClass = 'risk-low';
    if (negPct > 40) { riskLevel = '高'; riskClass = 'risk-high'; }
    else if (negPct > 20) { riskLevel = '中'; riskClass = 'risk-medium'; }

    const isS18 = c.competitor_id === s18Id;
    const rowClass = isS18 ? 's18-row' : '';
    const star = isS18 ? ' ★' : '';

    return `
    <tr class="${rowClass}">
      <td><strong>${escapeHtml(c.name)}${star}</strong></td>
      <td>${c.total_posts}</td>
      <td>${c.total_comments}</td>
      <td class="positive">${posPct}%</td>
      <td>${neuPct}%</td>
      <td class="negative">${negPct}%</td>
      <td><span class="${riskClass}">${riskLevel}</span></td>
    </tr>`;
  }

  const rows = ranking.map(renderRow).join('');

  const topNeg = [...ranking].sort((a, b) => {
    const ap = (a.total_comments || 1);
    const bp = (b.total_comments || 1);
    return Math.round(b.negative_count / bp * 100) - Math.round(a.negative_count / ap * 100);
  });

  const now = new Date();
  const startFormatted = startDate.replace(/-/g, '/');
  const endFormatted = endDate.replace(/-/g, '/');
  const genTime = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const s18DetailHtml = generateS18Detail(db, s18Id, startDate, endDate);
  const compSummariesHtml = generateCompetitorSummaries(db, s18Id, startDate, endDate);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>竞品舆情周报 · ${startFormatted} - ${endFormatted}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#0f1923;color:#e8edf2;padding:20px}
h1{font-size:22px;margin-bottom:4px}
h2{font-size:16px;margin:28px 0 12px;border-bottom:2px solid #4fc3f7;padding-bottom:4px}
h3{font-size:15px;margin:0 0 12px;color:#4fc3f7}
h4{font-size:13px;margin:8px 0 6px}
.sub{color:#8fa3b8;font-size:13px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0}
th{background:#1b2838;padding:8px 10px;text-align:left;font-weight:600;color:#8fa3b8;font-size:12px}
td{padding:8px 10px;border-bottom:1px solid #2a3f54}
tr.s18-row{background:rgba(79,195,247,0.08);border-left:3px solid #4fc3f7}
tr.s18-row td{font-weight:600}
.positive{color:#66bb6a;font-weight:600}
.negative{color:#ef5350;font-weight:600}
.risk-high{color:#ef5350;font-weight:700;background:rgba(239,83,80,.15);padding:2px 8px;border-radius:4px}
.risk-medium{color:#ffa726;font-weight:600;background:rgba(255,167,38,.12);padding:2px 8px;border-radius:4px}
.risk-low{color:#66bb6a;padding:2px 8px}
.alert-box{padding:12px 16px;border-radius:6px;margin:12px 0;font-size:13px}
.alert-high{background:rgba(239,83,80,.15);border:1px solid rgba(239,83,80,.3);color:#ef5350}
.alert-medium{background:rgba(255,167,38,.15);border:1px solid rgba(255,167,38,.3);color:#ffa726}

.s18-detail{margin:16px 0;padding:16px;background:#0d1a26;border-radius:8px;border:1px solid #2a3f54}
.s18-metric-row{display:flex;gap:12px;margin-bottom:12px}
.s18-metric{flex:1;text-align:center;padding:8px;background:#1b2838;border-radius:6px}
.s18-metric-num{display:block;font-size:22px;font-weight:700;color:#e8edf2}
.s18-metric-label{display:block;font-size:11px;color:#8fa3b8;margin-top:2px}
.s18-metric.positive .s18-metric-num{color:#66bb6a}
.s18-metric.neutral .s18-metric-num{color:#90a4ae}
.s18-metric.negative .s18-metric-num{color:#ef5350}
.s18-platforms{margin-bottom:12px;font-size:12px;color:#8fa3b8}
.platform-tag{display:inline-block;padding:1px 6px;margin:0 4px;background:#2a3f54;border-radius:3px;font-size:11px}
.s18-cols{display:flex;gap:16px;margin:12px 0}
.s18-col{flex:1;padding:12px;background:#1b2838;border-radius:8px;min-width:0}
.s18-sample{margin:6px 0;padding:6px 8px;background:rgba(0,0,0,.2);border-radius:4px;font-size:12px;line-height:1.5;color:#b0bec5}
.sample-src{display:block;font-size:10px;color:#5a7a8a;margin-top:2px}

.competitor-summaries{margin:12px 0}
.comp-summary-row{padding:10px 12px;margin:6px 0;background:#1b2838;border-radius:6px;font-size:12px;line-height:1.6}
.comp-name{font-weight:700;font-size:13px;margin-right:8px;color:#e8edf2}
.comp-stats{color:#8fa3b8;margin-right:8px}
.comp-kw{display:flex;flex-wrap:wrap;gap:3px;margin:4px 0}
.comp-summary{display:block;color:#6a8090;font-size:11px;margin-top:2px}

.summary-kw{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.kw-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;background:#2a3f54;color:#8fa3b8}
.kw-tag.p{background:rgba(102,187,106,.15);color:#66bb6a}
.kw-tag.n{background:rgba(239,83,80,.15);color:#ef5350}
.summary-desc{font-size:12px;color:#8fa3b8;line-height:1.6;margin:6px 0}
.sample-list{list-style:none;padding:0;margin:8px 0}
.sample-list li{font-size:11px;color:#8fa3b8;padding:3px 0;line-height:1.5}
.sample-list li::before{content:'▸ ';color:#4fc3f7}
.tag{display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;margin-right:4px}
.tag.p{background:rgba(102,187,106,.2);color:#66bb6a}
.tag.n{background:rgba(239,83,80,.2);color:#ef5350}
</style>
</head>
<body>
<h1>极限战场 · 竞品舆情周报</h1>
<div class="sub">覆盖周期: ${startFormatted} ~ ${endFormatted} | 生成时间: ${genTime}</div>

<h2>S18 极限战场 · 上周舆情分析</h2>
${s18DetailHtml}

<h2>竞品舆情摘要</h2>
${compSummariesHtml || '<p class="summary-desc">暂无其他竞品舆情数据。</p>'}

<h2>竞品排名总览</h2>
<table>
<thead>
<tr><th>竞品</th><th>动态</th><th>评论</th><th>正面</th><th>中性</th><th>负面</th><th>风险</th></tr>
</thead>
<tbody>
${rows}
</tbody>
</table>

${topNeg.length > 0 && Math.round(topNeg[0].negative_count / (topNeg[0].total_comments || 1) * 100) > 30 ? `
<div class="alert-box alert-high">
  <strong>重大舆情预警:</strong> ${escapeHtml(topNeg[0].name)} 负面率 ${Math.round(topNeg[0].negative_count / (topNeg[0].total_comments || 1) * 100)}%，请重点关注。
</div>
` : ''}

<div style="text-align:center;color:#8fa3b8;font-size:11px;margin-top:30px">
  自动生成于 ${genTime} · 极限战场竞品舆情系统 v1.2 · 周报模式
</div>
</body>
</html>`;

  const filename = `sentiment-weekly-${startDate}-${endDate}.html`;
  const filePath = path.join(getSnapshotDir(), filename);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`[快照] 已生成: ${filePath}`);

  return `snapshots/${filename}`;
}

module.exports = { generateSnapshotHtml };
