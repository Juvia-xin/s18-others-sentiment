import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchSentimentTrend } from '../api';

function SentimentChart({ competitors, selectedCompetitor }) {
  const [trendData, setTrendData] = useState([]);
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    if (competitors.length > 0 && !selId) {
      setSelId(competitors[0].id);
    }
  }, [competitors]);

  useEffect(() => {
    if (selId) {
      fetchSentimentTrend(selId, 7).then(data => {
        const grouped = {};
        (data || []).forEach(d => {
          if (!grouped[d.date]) grouped[d.date] = { date: d.date, positive: 0, neutral: 0, negative: 0 };
          grouped[d.date][d.sentiment] = d.count;
        });
        setTrendData(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)));
      });
    }
  }, [selId]);

  const selName = competitors.find(c => c.id === selId)?.name || '';

  return (
    <div className="card">
      <h3>
        情感趋势 ·&nbsp;
        <select
          value={selId || ''}
          onChange={e => setSelId(Number(e.target.value))}
          style={{
            background: 'var(--bg3)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
          }}
        >
          {competitors.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3f54" />
              <XAxis dataKey="date" stroke="#8fa3b8" fontSize={12} />
              <YAxis stroke="#8fa3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1b2838', border: '1px solid #2a3f54', borderRadius: '8px' }}
                labelStyle={{ color: '#e8edf2' }}
              />
              <Legend />
              <Bar dataKey="positive" name="正面" fill="#66bb6a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="neutral" name="中性" fill="#90a4ae" radius={[4, 4, 0, 0]} />
              <Bar dataKey="negative" name="负面" fill="#ef5350" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h4 style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '12px' }}>近7日评论情感分布</h4>
          {trendData.length === 0 ? (
            <div className="empty-state"><p>暂无趋势数据</p></div>
          ) : (
            <table className="ranking-table">
              <thead>
                <tr><th>日期</th><th>正面</th><th>中性</th><th>负面</th></tr>
              </thead>
              <tbody>
                {trendData.map((d, i) => {
                  const total = d.positive + d.neutral + d.negative || 1;
                  return (
                    <tr key={i}>
                      <td>{d.date}</td>
                      <td><span className="badge positive">{Math.round(d.positive / total * 100)}%</span></td>
                      <td><span className="badge neutral">{Math.round(d.neutral / total * 100)}%</span></td>
                      <td><span className="badge negative">{Math.round(d.negative / total * 100)}%</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default SentimentChart;
