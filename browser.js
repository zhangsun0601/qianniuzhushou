// browser.js - 浏览器管理模块
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const { sleep } = require('./utils');

// ==================== 配置 ====================
const ACTIVITY_URL = 'https://myseller.taobao.com/home.htm/starb/tmc-next/sale/seller/apply.htm?activityId=614741240180&activityDetailEmbedApply=true&gpReqChannelParam=180100%2A%2Abaokuan&puCode=itemBaseInfoSetting&processId=5ec3c0e292a94278b96b6ec0be5cddca';
const STATUS_CHECK_URL = 'https://myseller.taobao.com/home.htm/starb/tmc-next/sale/seller/sign_items.htm';

// ==================== 自动查找浏览器路径 ====================
function findBrowserPath() {
  // 1. 优先找用户电脑上已安装的 Edge
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
  ];
  
  for (const p of edgePaths) {
    try {
      if (p && fs.existsSync(p)) {
        console.log(`✅ 找到 Edge: ${p}`);
        return p;
      }
    } catch (e) {}
  }
  
  console.log('⚠️ 未找到 Edge，尝试找 Chrome...');
  
  // 2. 找 Chrome 作为备选
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env['LOCALAPPDATA'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
  ];
  
  for (const p of chromePaths) {
    try {
      if (p && fs.existsSync(p)) {
        console.log(`✅ 找到 Chrome: ${p}`);
        return p;
      }
    } catch (e) {}
  }
  
  console.log('⚠️ 未找到任何浏览器，将弹窗让用户手动选择');
  
  // 3. 返回 null，由调用方（launchBrowser）处理弹窗
  return null;
}
// ==================== 启动浏览器 ====================
async function launchBrowser(mainWindow, app) {
  console.log('===== launchBrowser called =====');
  
  let browserPath = findBrowserPath();
  
  if (!browserPath) {
    console.log('⚠️ 未自动找到浏览器，请手动选择 Edge 或 Chrome');
    
    const { dialog } = require('electron');
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '未找到浏览器',
      message: '您的电脑上没有找到 Edge 或 Chrome 浏览器。',
      detail: '请点击"确定"手动选择浏览器程序（msedge.exe 或 chrome.exe），或点击"取消"退出。',
      buttons: ['确定', '取消'],
      defaultId: 0,
      cancelId: 1
    });
    
    if (result.response === 1) {
      throw new Error('用户取消，无法启动浏览器');
    }
    
    const fileResult = await dialog.showOpenDialog(mainWindow, {
      title: '请选择浏览器程序 (msedge.exe 或 chrome.exe)',
      filters: [
        { name: '浏览器程序', extensions: ['exe'] }
      ],
      properties: ['openFile']
    });
    
    if (!fileResult.canceled && fileResult.filePaths.length > 0) {
      browserPath = fileResult.filePaths[0];
      console.log(`✅ 用户选择了浏览器: ${browserPath}`);
    } else {
      throw new Error('未选择浏览器，无法启动');
    }
  }
  
  console.log(`✅ 使用浏览器: ${browserPath}`);  
  const userDataDir = path.join(app.getPath('userData'), 'browser-profile');
  console.log(`📁 用户数据目录: ${userDataDir}`);
  
  if (!fs.existsSync(userDataDir)) {
    console.log('📁 创建用户数据目录...');
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: false,
    defaultViewport: null,
    userDataDir: userDataDir,
    args: [
      '--start-maximized',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--remote-debugging-port=9222'
    ],
  });
  
  console.log('✅ 浏览器已启动');
  
  // 1. 先关闭所有现有页面
  let pages = await browser.pages();
  for (let i = 0; i < pages.length; i++) {
    console.log(`[初始] 关闭标签页 ${i}`);
    await pages[i].close();
  }

  // 2. 创建一个新页面并导航到活动页
  const page = await browser.newPage();
  await page.goto(ACTIVITY_URL);
  console.log('✅ 已导航到活动报名页');

  // 3. 等一小会儿，让可能晚出现的页面加载出来
  await sleep(1000);

  // 4. 再检查一次，如果出现了多余的页面，就强制关闭
  pages = await browser.pages();
  if (pages.length > 1) {
    console.log(`[二次清理] 发现 ${pages.length} 个页面，将关闭多余的。`);
    for (let i = 0; i < pages.length; i++) {
      if (pages[i] !== page) {
        console.log(`[二次清理] 关闭标签页 ${i}`);
        await pages[i].close();
      }
    }
  }
  
  return { browser, page };
}

// ==================== 关闭浏览器 ====================
async function closeBrowser(browser, page) {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
    console.log('浏览器已关闭');
  }
}

// ==================== 导出 ====================
module.exports = {
  ACTIVITY_URL,
  STATUS_CHECK_URL,
  findBrowserPath,
  launchBrowser,
  closeBrowser
};