console.log('===== main.js loaded =====');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const XLSX = require('xlsx');
const os = require('os');

const { launchBrowser, closeBrowser } = require('./browser');
const { sleep } = require('./utils');
const { executeSignup } = require('./tasks/signup');
const { executeSkuClean } = require('./tasks/sku-clean');
const { checkMarketingStatus } = require('./tasks/status');
const { getRefundableOrders, clickRefundButton } = require('./tasks/refund');
const { executePerfect } = require('./tasks/perfect');

// ==================== 全局变量 ====================
let mainWindow;
let browser = null;
let page = null;
const taskState = {
  isStopRequested: false,
  isPaused: false,
  pauseResolve: { resolve: null },
  currentTaskType: null
};

// ==================== Electron 窗口 ====================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 850,
    height: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    },
    title: '千牛工作助手',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  setTimeout(async () => {
    console.log('自动启动浏览器...');
    const result = await launchBrowser(mainWindow, app);
    if (result) {
      browser = result.browser;
      page = result.page;
      console.log('启动结果: 成功');
    }
  }, 3000);
});

app.on('window-all-closed', async () => {
  await closeBrowser(browser, page);
  if (process.platform !== 'darwin') app.quit();
});

// ==================== 登录检查 ====================
// 获取当前页面 URL
ipcMain.handle('get-current-url', async () => {
  if (page) {
    try {
      return { success: true, url: page.url() };
    } catch (e) {
      return { success: false, url: '' };
    }
  }
  return { success: false, url: '' };
});

// 检测页面登录状态
ipcMain.handle('check-page-login-status', async () => {
  if (page) {
    try {
      const isLoggedIn = await page.evaluate(() => {
        // 检查是否有登录用户元素
        const userElement = document.querySelector('.site-nav-user, .login-info, [class*="user"], [class*="login"]');
        // 检查是否在登录页面
        const isLoginPage = window.location.href.includes('login');
        return !isLoginPage && userElement !== null;
      });
      return isLoggedIn;
    } catch (e) {
      return false;
    }
  }
  return false;
});

// ==================== IPC 处理 ====================
ipcMain.handle('launch-browser', async () => {
  try {
    console.log('收到 launch-browser 请求');
    const result = await launchBrowser(mainWindow, app);
    if (result) {
      browser = result.browser;
      page = result.page;
      return { success: true, message: '浏览器已启动' };
    }
    return { success: false, message: '启动失败' };
  } catch (error) {
    console.error('启动浏览器失败:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('close-browser', async () => {
  await closeBrowser(browser, page);
  browser = null;
  page = null;
  return { success: true };
});

ipcMain.handle('check-login', async () => {
  return await checkLogin();
});

ipcMain.handle('execute-signup', async (event, products, signupCount = 1, stopOnError = false) => {
  console.log('收到 execute-signup 请求，商品数量:', products.length, '报名次数:', signupCount);
  
  taskState.currentTaskType = 'signup';
  taskState.isStopRequested = false;
  taskState.isPaused = false;
  
  const sendLog = (msg, type) => event.sender.send('signup-log', { msg, type });
  const sendProgress = (current, total, round) => event.sender.send('signup-progress', { current, total, round });
  const sendComplete = (results, totalSignups) => event.sender.send('signup-complete', { results, totalSignups });
  
  return await executeSignup(products, sendLog, sendProgress, sendComplete, event, signupCount, stopOnError, page, taskState);
});

ipcMain.handle('execute-sku-clean', async (event, products) => {
  console.log('收到 execute-sku-clean 请求，商品数量:', products.length);
  
  taskState.currentTaskType = 'clean';
  taskState.isStopRequested = false;
  taskState.isPaused = false;
  
  const sendLog = (msg, type) => event.sender.send('sku-log', { msg, type });
  const sendProgress = (current, total, round) => event.sender.send('sku-progress', { current, total, round });
  const sendComplete = (results, successCount, failCount) => event.sender.send('sku-complete', { results, successCount, failCount });
  
  return await executeSkuClean(products, sendLog, sendProgress, sendComplete, page, browser, taskState, app);
});

ipcMain.handle('check-marketing-status', async (event, marketingIds) => {
  console.log('收到 check-marketing-status 请求，数量:', marketingIds.length);
  
  taskState.currentTaskType = 'status';
  taskState.isStopRequested = false;
  taskState.isPaused = false;
  
  const sendLog = (msg, type) => event.sender.send('status-log', { msg, type });
  const sendProgress = (current, total) => event.sender.send('status-progress', { current, total });
  const sendComplete = (results) => event.sender.send('status-complete', { results });
  
  return await checkMarketingStatus(marketingIds, sendLog, sendProgress, sendComplete, page, taskState);
});

ipcMain.handle('get-browser-status', async () => {
  return { isConnected: browser !== null, hasPage: page !== null };
});

ipcMain.handle('pause-task', async () => {
  console.log('收到暂停请求');
  if (!taskState.isPaused && !taskState.isStopRequested && taskState.currentTaskType) {
    taskState.isPaused = true;
    return { success: true, taskType: taskState.currentTaskType };
  }
  return { success: false, message: '没有正在执行的任务' };
});

ipcMain.handle('resume-task', async () => {
  console.log('收到继续请求');
  if (taskState.isPaused && !taskState.isStopRequested) {
    taskState.isPaused = false;
    if (taskState.pauseResolve.resolve) {
      taskState.pauseResolve.resolve();
      taskState.pauseResolve.resolve = null;
    }
    return { success: true };
  }
  return { success: false, message: '未处于暂停状态' };
});

ipcMain.handle('stop-task', async () => {
  console.log('收到停止请求');
  taskState.isStopRequested = true;
  taskState.isPaused = false;
  if (taskState.pauseResolve.resolve) {
    taskState.pauseResolve.resolve();
    taskState.pauseResolve.resolve = null;
  }
  return { success: true };
});

ipcMain.handle('execute-in-main', async (event, action, orderId, buttonIndex) => {
  if (action === 'getRefundableOrders') {
    return await getRefundableOrders(page);
  }
  
  if (action === 'clickRefundButton') {
    return await clickRefundButton(page, orderId, taskState, buttonIndex || 0);
  }
  
  if (action === 'getOrderButtonCount') {
    const { getOrderButtonCount } = require('./tasks/refund');
    return await getOrderButtonCount(page, orderId);
  }
  
  return null;
});

ipcMain.handle('refresh-page', async () => {
  console.log('收到刷新页面请求');
  if (page) {
    try {
      await page.reload({ waitUntil: 'networkidle2' });
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
  return { success: false, message: '页面不存在' };
});
ipcMain.handle('execute-perfect', async (event, products) => {
  console.log('收到 execute-perfect 请求，数量:', products.length);
  
  taskState.currentTaskType = 'perfect';
  taskState.isStopRequested = false;
  taskState.isPaused = false;
  
  const sendLog = (msg, type) => event.sender.send('perfect-log', { msg, type });
  const sendProgress = (current, total) => event.sender.send('perfect-progress', { current, total });
  const sendComplete = (results) => event.sender.send('perfect-complete', { results });
  
  return await executePerfect(products, sendLog, sendProgress, sendComplete, page, taskState);
});
ipcMain.handle('navigate', async (event, url) => {
  console.log('收到导航请求:', url);
  if (page) {
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
  return { success: false, message: '浏览器未启动' };
});
ipcMain.handle('smart-navigate', async (event, url) => {
  console.log('收到智能导航请求:', url);
  
  // 1. 检查浏览器是否存在
  if (!browser) {
    console.log('浏览器未启动，正在重新启动...');
    try {
      const result = await launchBrowser(mainWindow, app);
      if (result) {
        browser = result.browser;
        page = result.page;
        console.log('✅ 浏览器已重新启动');
        return { success: false, reopened: true, message: '浏览器已重新启动' };
      }
    } catch (e) {
      return { success: false, reopened: false, message: '浏览器启动失败: ' + e.message };
    }
  }
  
  // 2. 检查 page 是否有效
  try {
    await page.evaluate(() => true);
  } catch (e) {
    console.log('浏览器窗口已关闭，正在重新打开...');
    try {
      // 关闭旧的 browser
      await browser.close();
    } catch (err) {}
    
    try {
      const result = await launchBrowser(mainWindow, app);
      if (result) {
        browser = result.browser;
        page = result.page;
        console.log('✅ 浏览器已重新打开');
        return { success: false, reopened: true, message: '浏览器已重新打开' };
      }
    } catch (err) {
      return { success: false, reopened: false, message: '浏览器重启失败' };
    }
  }
  
  // 3. 浏览器正常，直接导航
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    return { success: true, reopened: false };
  } catch (e) {
    return { success: false, reopened: false, message: e.message };
  }
});
// ==================== 导出功能 ====================
ipcMain.handle('export-signup-results', async (event, results) => {
  try {
    const sheetData = results.map(r => {
      // 判断是否有任何一个 signupId 不为空
      const signupIds = [r.signupId1, r.signupId2, r.signupId3, r.signupId4, r.signupId5];
      const hasSuccess = signupIds.some(id => id && id !== '');
      
      return {
        '商品ID': r.productId,
        '营销ID1': r.signupId1 || '',
        '营销ID2': r.signupId2 || '',
        '营销ID3': r.signupId3 || '',
        '营销ID4': r.signupId4 || '',
        '营销ID5': r.signupId5 || '',
        '状态': hasSuccess ? '成功' : '失败',
        '失败原因': r.failReason || '',
        '报名时间': r.timestamp
      };
    });
    
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '报名结果');
    
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const fileName = `秒杀报名结果_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`;
    const filePath = path.join(desktopPath, fileName);
    
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-clean-results', async (event, results) => {
  try {
    const sheetData = results.map(r => ({
      '商品ID': r.productId,
      '状态': r.status,
      '失败原因': r.error || '',
      '完成时间': r.timestamp
    }));
    
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SKU清洗结果');
    
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const fileName = `SKU清洗结果_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`;
    const filePath = path.join(desktopPath, fileName);
    
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-status-results', async (event, results) => {
  try {
    const sheetData = results.map(r => ({
      '商品ID': r.itemId || '',
      '营销ID': r.marketingId,
      '状态': r.status,
      '清退时间': r.clearTime || '',
      '原因': r.reason || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '状态检测结果');
    
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const fileName = `营销ID状态检测_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`;
    const filePath = path.join(desktopPath, fileName);
    
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-perfect-results', async (event, results) => {
  try {
    const sheetData = results.map(r => ({
      '营销ID': r.marketingId,
      '状态': r.status,
      '失败原因': r.error || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '完善结果');
    
    const desktopPath = path.join(os.homedir(), 'Desktop');
    const fileName = `完善商品结果_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`;
    const filePath = path.join(desktopPath, fileName);
    
    XLSX.writeFile(wb, filePath);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});