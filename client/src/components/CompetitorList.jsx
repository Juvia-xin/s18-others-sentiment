function CompetitorList({ competitors, onSeed, onSelect }) {
  return (
    <div>
      <button className="seed-btn" onClick={onSeed}>初始化默认竞品</button>

      {competitors.length === 0 ? (
        <div className="empty-state">
          <p>暂无竞品数据，请点击上方按钮初始化默认竞品列表</p>
        </div>
      ) : (
        <div className="competitor-grid">
          {competitors.map(c => (
            <div
              key={c.id}
              className="competitor-card"
              onClick={() => onSelect(c)}
            >
              <h4>{c.name}</h4>
              <div className="category">{c.category || '未分类'}</div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text2)' }}>
                状态: <span style={{ color: c.status === 'active' ? 'var(--positive)' : 'var(--neutral)' }}>
                  {c.status === 'active' ? '活跃' : '停用'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompetitorList;
