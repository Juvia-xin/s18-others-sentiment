import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import {
  fetchCompetitors, fetchSentimentRanking, fetchDailyReports,
  fetchPosts, fetchSentimentTrend, fetchHotKeywords, seedCompetitors,
  fetchSamples, fetchArchives, fetchLatestDate,
} from './api';

const S18_ID = 10;

function App() {
  const [tab, setTab] = useState('s18');
  const [competitors, setCompetitors] = useState([]);
  const [reports, setReports] = useState({});
  const [ranking, setRanking] = useState([]);
  const [selCompetitorId, setSelCompetitorId] = useState(null);
  const [date, setDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [archives, setArchives] = useState([]);

  useEffect(() => {
    async function init() {
      try {
        const latest = await fetchLatestDate();
        if (latest?.date) {
          setDate(latest.date);
        }
      } catch {}
      loadData();
    }
    init();
  }, []);

  useEffect(() => { if (date) loadData(); }, [date]);

  async function loadData() {
    setLoading(true);
    try {
      const [comp, rank, reports] = await Promise.all([
        fetchCompetitors(),
        fetchSentimentRanking(date),
        fetchDailyReports(date),
      ]);
      setCompetitors(comp || []);
      setRanking(rank?.ranking || []);
      const map = {};
      (reports?.reports || []).forEach(r => { map[r.competitor_id] = r; });
      setReports(map);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function loadArchives() {
    try {
      const data = await fetchArchives();
      setArchives(data?.archives || []);
    } catch (e) { console.error(e); }
  }

  const s18 = competitors.find(c => c.id === S18_ID);
  const s18Report = reports[S18_ID];

  function changeDate(delta) {
    setDate(prev => dayjs(prev).add(delta, 'day').format('YYYY-MM-DD'));
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>极限战场 · 竞品舆情分析</h1>
        <span className="product-tag">S18</span>
      </header>

      <nav className="nav-bar">
        <button className={tab === 's18' ? 'active' : ''} onClick={() => setTab('s18')}>
          S18 极限战场
        </button>
        <button className={tab === 'competitor' ? 'active' : ''} onClick={() => setTab('competitor')}>
          竞品舆情
        </button>
        <button className={tab === 'ranking' ? 'active' : ''} onClick={() => setTab('ranking')}>
          舆情排名
        </button>
        <button className={tab === 'archives' ? 'active' : ''} onClick={() => { setTab('archives'); loadArchives(); }}>
          历史报告
        </button>
      </nav>

      <div className="date-picker">
        <button onClick={() => changeDate(-1)}>&lt; 前一天</button>
        <span className="date-display">{date}</span>
        <button onClick={() => changeDate(1)}>后一天 &gt;</button>
        <button className="btn-today" onClick={() => setDate(dayjs().format('YYYY-MM-DD'))}>回到今天</button>
      </div>

      <main className="content">
        {loading ? <div className="loading">加载中...</div> : (
          <>
            {tab === 's18' && <SentimentPanel report={s18Report} competitor={s18} date={date} isS18 />}
            {tab === 'competitor' && (
              <CompetitorPanel
                competitors={competitors.filter(c => c.id !== S18_ID)}
                reports={reports}
                date={date}
                selId={selCompetitorId}
                setSelId={setSelCompetitorId}
              />
            )}
            {tab === 'ranking' && <RankingPanel ranking={ranking} s18Name={s18?.name} date={date} />}
            {tab === 'archives' && <HistoryReportsPanel archives={archives} />}
          </>
        )}
      </main>
    </div>
  );
}

function MetricRow({ report, competitor }) {
  const r = report || {};
  const total = r.total_comments || 0;
  const ratio = r.sentiment_ratio ? JSON.parse(r.sentiment_ratio) : {};
  return (
    <div className="metric-row">
      <div className="metric-card">
        <div className="mc-num">{r.total_posts || 0}</div>
        <div className="mc-label">监测动态</div>
      </div>
      <div className="metric-card">
        <div className="mc-num">{total}</div>
        <div className="mc-label">评论总数</div>
      </div>
      <div className="metric-card positive">
        <div className="mc-num">{ratio.positive || 0}%</div>
        <div className="mc-label">正面率</div>
      </div>
      <div className="metric-card neutral">
        <div className="mc-num">{ratio.neutral || 0}%</div>
        <div className="mc-label">中性率</div>
      </div>
      <div className="metric-card negative">
        <div className="mc-num">{ratio.negative || 0}%</div>
        <div className="mc-label">负面率</div>
      </div>
    </div>
  );
}

function AlertBanner({ report }) {
  if (!report) return null;
  const r = JSON.parse(report.sentiment_ratio || '{}');
  const negPct = r.negative || 0;
  const level = negPct > 50 ? 'high' : negPct > 30 ? 'medium' : null;
  if (!level) return null;

  return (
    <div className={`alert-banner alert-${level}`}>
      <strong>重大舆情预警</strong>
      <span>近24小时负面率 <b>{negPct}%</b>{negPct > 50 ? '（触发重大舆情阈值）' : '（需关注）'}</span>
      {report.summary_text && <p>{report.summary_text}</p>}
    </div>
  );
}

function SentimentPanel({ report, competitor, date, isS18 }) {
  const [trendData, setTrendData] = useState([]);
  const [samples, setSamples] = useState(null);

  useEffect(() => {
    if (competitor?.id) {
      fetchSentimentTrend(competitor.id, 7).then(data => {
        const grouped = {};
        (data || []).forEach(d => {
          if (!grouped[d.date]) grouped[d.date] = { date: d.date, positive: 0, neutral: 0, negative: 0 };
          grouped[d.date][d.sentiment] = d.count;
        });
        setTrendData(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)));
      });

      fetchSamples(competitor.id, date).then(data => {
        setSamples(data);
      }).catch(() => setSamples(null));
    }
  }, [competitor?.id, date]);

  return (
    <div>
      <div className="card">
        <h3>{isS18 ? 'S18 极限战场' : competitor?.name} · 关键指标</h3>
        <MetricRow report={report} competitor={competitor} />
      </div>

      <AlertBanner report={report} />

      <div className="card">
        <h3>近7日舆情趋势</h3>
        {trendData.length === 0 ? (
          <div className="empty-state"><p>暂无趋势数据</p></div>
        ) : (
          <TrendTable data={trendData} />
        )}
      </div>

      {samples && (samples.wordcloud?.length > 0 || samples.positive?.length > 0 || samples.negative?.length > 0) && (
        <div className="card">
          <h3>本日舆情样本</h3>
          <WordCloud words={samples.wordcloud || []} />
          <SampleExcerpts positive={samples.positive || []} negative={samples.negative || []} />
        </div>
      )}

      {report && (
        <div className="card">
          <h3>本日舆情摘要</h3>
          <p className="summary-text">{report.summary_text}</p>
          <UserProfile report={report} />
        </div>
      )}
    </div>
  );
}

function TrendTable({ data }) {
  return (
    <table className="ranking-table">
      <thead>
        <tr><th>日期</th><th>正面</th><th>中性</th><th>负面</th><th>正面率</th><th>负面率</th></tr>
      </thead>
      <tbody>
        {data.map((d, i) => {
          const total = (d.positive || 0) + (d.neutral || 0) + (d.negative || 0) || 1;
          return (
            <tr key={i}>
              <td>{d.date}</td>
              <td><span className="badge positive">{d.positive || 0}</span></td>
              <td><span className="badge neutral">{d.neutral || 0}</span></td>
              <td><span className="badge negative">{d.negative || 0}</span></td>
              <td>{Math.round((d.positive || 0) / total * 100)}%</td>
              <td>{Math.round((d.negative || 0) / total * 100)}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function UserProfile({ report }) {
  let profile = {};
  try { profile = JSON.parse(report.user_profile_json || '{}'); } catch {}
  if (!profile.total_users) return null;
  return (
    <div className="report-stats" style={{ marginTop: 12 }}>
      <span>用户数: <strong>{profile.total_users}</strong></span>
      <span>均赞: <strong>{profile.avg_likes}</strong></span>
      <span>高活跃: <strong>{profile.profile_distribution?.high_engagement_pct || 0}%</strong></span>
      <span>中活跃: <strong>{profile.profile_distribution?.medium_engagement_pct || 0}%</strong></span>
      <span>低活跃: <strong>{profile.profile_distribution?.low_engagement_pct || 0}%</strong></span>
    </div>
  );
}

function CompetitorPanel({ competitors, reports, date, selId, setSelId }) {
  if (!selId && competitors.length > 0) {
    return (
      <div className="competitor-grid">
        {competitors.map(c => {
          const r = reports[c.id];
          const ratio = r ? JSON.parse(r.sentiment_ratio || '{}') : {};
          return (
            <div key={c.id} className="competitor-card" onClick={() => setSelId(c.id)}>
              <h4>{c.name}</h4>
              <div className="category">{c.category}</div>
              {r ? (
                <div style={{ marginTop: 8 }}>
                  <span className="badge positive">正面{ratio.positive || 0}%</span>{' '}
                  <span className="badge negative">负面{ratio.negative || 0}%</span>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                    动态{r.total_posts} · 评论{r.total_comments}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>暂无数据</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const c = competitors.find(x => x.id === selId);
  const r = reports[selId];

  return (
    <div>
      <button className="seed-btn" onClick={() => setSelId(null)}>← 返回竞品列表</button>
      <SentimentPanel report={r} competitor={c} date={date} />
    </div>
  );
}

function RankingPanel({ ranking, s18Name, date }) {
  const sorted = [...ranking].sort((a, b) => b.positive_pct - a.positive_pct);
  return (
    <div className="card">
      <h3>舆情排名 · {date}（按正面率降序）</h3>
      {sorted.length === 0 ? (
        <div className="empty-state"><p>暂无数据</p></div>
      ) : (
        <table className="ranking-table">
          <thead>
            <tr><th>#</th><th>产品</th><th>正面率</th><th>负面率</th><th>评论总数</th></tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const isS18 = r.name === s18Name;
              return (
                <tr key={i} style={isS18 ? { background: 'rgba(79,195,247,0.12)', fontWeight: 700 } : {}}>
                  <td>{i + 1}</td>
                  <td>{r.name}{isS18 ? ' ★' : ''}</td>
                  <td><span className="badge positive">{r.positive_pct}%</span></td>
                  <td><span className="badge negative">{r.negative_pct}%</span></td>
                  <td>{r.total_comments}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function WordCloud({ words }) {
  if (!words || words.length === 0) return null;

  const maxWeight = Math.max(...words.map(w => w.weight), 1);

  return (
    <div className="wordcloud">
      <h4 style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>高频词云</h4>
      <div className="wordcloud-tags">
        {words.map((w, i) => {
          const size = 12 + (w.weight / maxWeight) * 18;
          const opacity = 0.5 + (w.weight / maxWeight) * 0.5;
          const colors = ['#4fc3f7', '#66bb6a', '#ff7043', '#ab47bc', '#26c6da', '#ffa726'];
          return (
            <span
              key={i}
              className="wordcloud-tag"
              style={{
                fontSize: size,
                opacity,
                color: colors[i % colors.length],
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SampleExcerpts({ positive, negative }) {
  return (
    <div className="samples-section">
      {positive.length > 0 && (
        <div className="samples-col">
          <h4 className="samples-title positive-title">正面样本代表</h4>
          {positive.map((s, i) => (
            <div key={i} className="sample-item">
              <div className="sample-text">"{s.content}"</div>
              <div className="sample-meta">
                <span className="badge positive">{s.platform}</span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="sample-link">查看原文 →</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {negative.length > 0 && (
        <div className="samples-col">
          <h4 className="samples-title negative-title">负面样本代表</h4>
          {negative.map((s, i) => (
            <div key={i} className="sample-item">
              <div className="sample-text">"{s.content}"</div>
              <div className="sample-meta">
                <span className="badge negative">{s.platform}</span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="sample-link">查看原文 →</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryReportsPanel({ archives }) {
  if (archives.length === 0) {
    return (
      <div className="card">
        <h3>历史报告</h3>
        <div className="empty-state"><p>暂无历史报告，等待首次周报生成</p></div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>历史报告</h3>
      <table className="ranking-table">
        <thead>
          <tr>
            <th>报告生成时间</th>
            <th>报告覆盖周期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {archives.map((a, i) => {
            const startFormatted = (a.start_date || '').replace(/-/g, '/');
            const endFormatted = (a.end_date || '').replace(/-/g, '/');
            const genTime = a.generated_at || '';
            return (
              <tr key={i}>
                <td>{genTime}</td>
                <td>{startFormatted} - {endFormatted}</td>
                <td>
                  <a
                    href={`/snapshots/${a.snapshot_path?.replace('snapshots/', '') || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sample-link"
                  >
                    查看报告
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;
