const { contextBridge, ipcRenderer } = require('electron');

console.log('preload.js 已加载');

// 使用 contextBridge 安全地暴露 API
contextBridge.exposeInMainWorld('electronAPI', {
 navigate: (url) => ipcRenderer.invoke('navigate', url),
  smartNavigate: (url) => ipcRenderer.invoke('smart-navigate', url),  // ← 新增
  getCurrentUrl: () => ipcRenderer.invoke('get-current-url'),
  checkPageLoginStatus: () => ipcRenderer.invoke('check-page-login-status'),
  // 浏览器管理
  launchBrowser: () => ipcRenderer.invoke('launch-browser'),
  closeBrowser: () => ipcRenderer.invoke('close-browser'),
  checkLogin: () => ipcRenderer.invoke('check-login'),
  getBrowserStatus: () => ipcRenderer.invoke('get-browser-status'),

  // 导出功能
exportSignupResults: (results) => ipcRenderer.invoke('export-signup-results', results),
exportCleanResults: (results) => ipcRenderer.invoke('export-clean-results', results),
exportStatusResults: (results) => ipcRenderer.invoke('export-status-results', results),
// 批量完善商品
executePerfect: (products) => ipcRenderer.invoke('execute-perfect', products),
exportPerfectResults: (results) => ipcRenderer.invoke('export-perfect-results', results),

// 事件监听 - 完善商品
onPerfectLog: (callback) => {
  ipcRenderer.on('perfect-log', (event, data) => callback(data));
},
onPerfectProgress: (callback) => {
  ipcRenderer.on('perfect-progress', (event, data) => callback(data));
},
onPerfectComplete: (callback) => {
  ipcRenderer.on('perfect-complete', (event, data) => callback(data));
},
  // 报名执行
  executeSignup: (products, signupCount, stopOnError) => 
    ipcRenderer.invoke('execute-signup', products, signupCount, stopOnError),
  
  // SKU清洗执行
  executeSkuClean: (products) => ipcRenderer.invoke('execute-sku-clean', products),
  
  // 营销ID状态检测
  checkMarketingStatus: (marketingIds) => 
    ipcRenderer.invoke('check-marketing-status', marketingIds),
  
  // 批量退款
  executeInMain: (action, orderId) => 
    ipcRenderer.invoke('execute-in-main', action, orderId),
  refreshPage: () => ipcRenderer.invoke('refresh-page'),

  // 导航
  navigate: (url) => ipcRenderer.invoke('navigate', url),

  getCurrentUrl: () => ipcRenderer.invoke('get-current-url'),
  checkPageLoginStatus: () => ipcRenderer.invoke('check-page-login-status'),

  // 控制
  pauseTask: () => ipcRenderer.invoke('pause-task'),
  resumeTask: () => ipcRenderer.invoke('resume-task'),
  stopTask: () => ipcRenderer.invoke('stop-task'),  
  
  // 事件监听 - 报名
  onSignupLog: (callback) => {
    ipcRenderer.on('signup-log', (event, data) => callback(data));
  },
  onSignupProgress: (callback) => {
    ipcRenderer.on('signup-progress', (event, data) => callback(data));
  },
  onSignupComplete: (callback) => {
    ipcRenderer.on('signup-complete', (event, data) => callback(data));
  },
  onSignupRealtimeUpdate: (callback) => {
    ipcRenderer.on('signup-realtime-update', (event, data) => callback(data));
  },
  
  // 事件监听 - SKU清洗
  onSkuLog: (callback) => {
    ipcRenderer.on('sku-log', (event, data) => callback(data));
  },
  onSkuProgress: (callback) => {
    ipcRenderer.on('sku-progress', (event, data) => callback(data));
  },
  onSkuComplete: (callback) => {
    ipcRenderer.on('sku-complete', (event, data) => callback(data));
  },
  
  // 事件监听 - 状态检测
  onStatusLog: (callback) => {
    ipcRenderer.on('status-log', (event, data) => callback(data));
  },
  onStatusProgress: (callback) => {
    ipcRenderer.on('status-progress', (event, data) => callback(data));
  },
  onStatusComplete: (callback) => {
    ipcRenderer.on('status-complete', (event, data) => callback(data));
  },

  // 导航
  navigate: (action) => ipcRenderer.invoke('navigate-webview', action)

});

console.log('electronAPI 已安全暴露到 window');