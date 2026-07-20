function Dashboard({ ranking, reports, date }) {
  const totalPosts = ranking.reduce((s, r) => s + r.total_posts, 0);
  const totalComments = ranking.reduce((s, r) => s + r.total_comments, 0);

  const mostNegative = [...ranking].sort((a, b) => b.negative_pct - a.negative_pct)[0];
  const mostPositive = [...ranking].sort((a, b) => b.positive_pct - a.positive_pct)[0];

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h3>关键指标 · {date}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg3)', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--accent)' }}>{totalPosts}</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>监测动态总数</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg3)', borderRadius: '8px' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--accent)' }}>{totalComments}</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>评论总数</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg3)', borderRadius: '8px' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--accent)' }}>{ranking.length}</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>监测竞品数</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg3)', borderRadius: '8px' }}>
            <div style={{ fontSize: '18px', fontWeight: '600', color: mostNegative ? 'var(--negative)' : 'var(--neutral)' }}>
              {mostNegative ? `${mostNegative.negative_pct}%` : '-'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
              {mostNegative ? `最高负面率 · ${mostNegative.name}` : '暂无数据'}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>舆情排名 · {date}</h3>
        {ranking.length === 0 ? (
          <div className="empty-state"><p>暂无数据，请先执行数据采集</p></div>
        ) : (
          <table className="ranking-table">
            <thead>
              <tr>
                <th>竞品</th>
                <th>动态</th>
                <th>评论</th>
                <th>正面</th>
                <th>负面</th>
                <th>风险</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.competitor_id} style={i === 0 ? { borderLeft: '3px solid var(--negative)' } : {}}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.total_posts}</td>
                  <td>{r.total_comments}</td>
                  <td><span className="badge positive">{r.positive_pct}%</span></td>
                  <td><span className="badge negative">{r.negative_pct}%</span></td>
                  <td>
                    <div style={{ width: `${Math.min(r.negative_pct, 100)}%`, height: '4px', background: r.negative_pct > 30 ? 'var(--negative)' : r.negative_pct > 15 ? 'var(--accent2)' : 'var(--neutral)', borderRadius: '2px' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
