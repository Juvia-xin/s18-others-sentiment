function DailyReport({ reports, date }) {
  if (!reports || reports.length === 0) {
    return (
      <div className="empty-state">
        <p>{date} 暂无日报数据</p>
        <p style={{ fontSize: '13px' }}>请确认定时采集任务已执行，或手动触发分析</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>{date} 舆情日报概览</h3>
        <p style={{ color: 'var(--text2)', fontSize: '14px' }}>
          共 {reports.length} 个竞品完成分析 ·
          {reports.reduce((s, r) => s + r.total_posts, 0)} 条动态 ·
          {reports.reduce((s, r) => s + r.total_comments, 0)} 条评论
        </p>
      </div>

      {reports.map(report => {
        const pct = report.total_comments > 0
          ? {
              p: Math.round(report.positive_count / report.total_comments * 100),
              n: Math.round(report.neutral_count / report.total_comments * 100),
              neg: Math.round(report.negative_count / report.total_comments * 100),
            }
          : { p: 0, n: 0, neg: 0 };

        let hotTopics = [];
        try { hotTopics = JSON.parse(report.hot_topics_json || '[]'); } catch {}
        let userProfile = {};
        try { userProfile = JSON.parse(report.user_profile_json || '{}'); } catch {}

        return (
          <div key={report.id} className="report-card">
            <div className="report-header">
              <h3>{report.competitor_name}</h3>
              <span className={`badge ${report.negative_count > 0 && pct.neg > 30 ? 'negative' : 'positive'}`}>
                风险等级: {pct.neg > 40 ? '高' : pct.neg > 20 ? '中' : '低'}
              </span>
            </div>

            <div className="sentiment-bars">
              <div className="bar-p" style={{ width: `${pct.p}%` }} title={`正面 ${pct.p}%`} />
              <div className="bar-n" style={{ width: `${pct.n}%` }} title={`中性 ${pct.n}%`} />
              <div className="bar-neg" style={{ width: `${pct.neg}%` }} title={`负面 ${pct.neg}%`} />
            </div>

            <div className="report-stats">
              <span>动态: <strong>{report.total_posts}</strong></span>
              <span>评论: <strong>{report.total_comments}</strong></span>
              <span>正面: <strong style={{ color: 'var(--positive)' }}>{pct.p}%</strong></span>
              <span>中性: <strong style={{ color: 'var(--neutral)' }}>{pct.n}%</strong></span>
              <span>负面: <strong style={{ color: 'var(--negative)' }}>{pct.neg}%</strong></span>
              <span>
                用户: <strong>{userProfile.total_users || 0}</strong> ·
                均赞: <strong>{userProfile.avg_likes || 0}</strong>
              </span>
            </div>

            <div className="report-summary">{report.summary_text}</div>

            {hotTopics.length > 0 && (
              <div className="report-keywords">
                {hotTopics.slice(0, 8).map((t, i) => (
                  <span key={i} className="keyword-tag">{t.keywords} ({t.count})</span>
                ))}
              </div>
            )}

            {userProfile.profile_distribution && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text2)' }}>
                用户活跃度: 高活跃 {userProfile.profile_distribution.high_engagement_pct}% ·
                中活跃 {userProfile.profile_distribution.medium_engagement_pct}% ·
                低活跃 {userProfile.profile_distribution.low_engagement_pct}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default DailyReport;
