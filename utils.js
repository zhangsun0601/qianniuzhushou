// 工具函数模块

// ==================== 自定义错误类 ====================
class TaskStoppedError extends Error {
  constructor() {
    super('任务已停止');
    this.name = 'TaskStoppedError';
  }
}

// ==================== 基础等待函数 ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== 暂停/停止状态检查 ====================
async function checkShouldStop(taskState, sendLog) {
  // 先检查是否被停止
  if (taskState.isStopRequested) {
    throw new TaskStoppedError();
  }
  
  // 处理暂停状态
  if (taskState.isPaused) {
    if (sendLog) sendLog('⏸️ 任务已暂停，点击"继续"恢复...', 'warning');
    
    await new Promise(resolve => {
      taskState.pauseResolve.resolve = () => {
        if (sendLog && !taskState.isStopRequested) {
          sendLog('▶️ 任务已恢复', 'success');
        }
        resolve();
      };
    });
    
    // 恢复后再次检查是否在暂停期间被停止
    if (taskState.isStopRequested) {
      throw new TaskStoppedError();
    }
  }
}

// ==================== 可中断的延时函数 ====================
async function interruptibleSleep(ms, taskState, sendLog, checkInterval = 100) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    await checkShouldStop(taskState, sendLog);
    const remaining = ms - (Date.now() - start);
    await sleep(Math.min(checkInterval, remaining));
  }
}

// ==================== 安全输入 ====================
async function safeInput(page, selector, value, description) {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector, { clickCount: 3 });
    await page.type(selector, value);
    console.log(`✅ 输入 ${description}: ${value}`);
    return true;
  } catch (e) {
    console.log(`❌ 输入失败 ${description}: ${e.message}`);
    return false;
  }
}

// ==================== 暂停检查（旧版兼容，内部调用新函数） ====================
async function checkPause(isPaused, isStopRequested, pauseResolve, sendLog) {
  // 这个函数保留用于兼容旧代码，实际逻辑已整合到 checkShouldStop
  while (isPaused && !isStopRequested) {
    sendLog('⏸️ 任务已暂停，点击"继续"恢复...', 'warning');
    await new Promise(resolve => {
      pauseResolve.resolve = resolve;
    });
    if (!isStopRequested && !isPaused) {
      sendLog('▶️ 任务已恢复', 'success');
    }
  }
}

// ==================== 导出 ====================
module.exports = {
  sleep,
  safeInput,
  checkPause,
  checkShouldStop,
  interruptibleSleep,
  TaskStoppedError
};