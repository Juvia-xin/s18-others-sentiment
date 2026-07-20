const cron = require('node-cron');
const { runWeeklyAnalysis } = require('./dailyTask');

let taskRunning = false;

function startScheduler() {
  console.log('[调度器] 每周一 9:00 自动执行前7天数据分析');

  cron.schedule('0 9 * * 1', async () => {
    if (taskRunning) {
      console.log('[调度器] 上一轮分析尚未完成，跳过本次执行');
      return;
    }
    taskRunning = true;
    try {
      await runWeeklyAnalysis();
    } catch (e) {
      console.error('[调度器] 周分析异常:', e.message);
    } finally {
      taskRunning = false;
    }
  });
}

module.exports = { startScheduler };
