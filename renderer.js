console.log('🚀 renderer.js 已加载');

// 这些库不能在渲染进程直接 require 了，需要用其他方式
// 我们先注释掉，后面再处理
// const XLSX = require('xlsx');
// const path = require('path');
// const os = require('os');
// const fs = require('fs');

// ==================== 全局状态 ====================
let isRunning = false;
let isCleaning = false;
let isChecking = false;
let currentProducts = [];
let cleanProducts = [];
let results = [];
let cleanResults = [];
let statusResults = [];
let totalSignups = 0;
let stopOnError = false;
let signupCount = 1;  // 新增：报名次数
let isRefunding = false;
let refundOrders = [];
let refundProcessed = 0;
let refundCurrentIndex = 0;
let openBoughtPageBtn; 
let isPerfecting = false;
let perfectResults = [];

// ==================== DOM 元素 ====================
// 公共
let taskSelect, subtitle, logDiv, statusDiv, refreshLoginBtn, loginStatusSpan, openBrowserBtn;

// 秒杀报名面板
let panelSignup, totalProductsSpan, totalSignupsSpan, currentProductSpan;
let productListTextarea, loadDemoBtn, loadFileBtn, startBtn;
let pauseBtn, resumeBtn, stopBtn, exportSignupBtn, stopOnErrorCheckbox, signupCountInput;

// SKU清洗面板
let panelClean, cleanTotalProductsSpan, cleanSuccessCount, cleanFailCount;
let cleanProductList, cleanLoadFileBtn, skuCleanBtn;
let cleanPauseBtn, cleanResumeBtn, cleanStopBtn, exportCleanBtn;

// 状态检测面板
let panelStatus, statusTotalIds, statusCurrentId, statusFoundCount;
let marketingIdList, statusLoadFileBtn, checkStatusBtn;
let statusPauseBtn, statusResumeBtn, statusStopBtn, exportStatusBtn;

// ==================== 初始化 DOM ====================
function initDOM() {
  // 公共
  taskSelect = document.getElementById('taskSelect');
  subtitle = document.getElementById('subtitle');
  logDiv = document.getElementById('log');
  statusDiv = document.getElementById('status');
  refreshLoginBtn = document.getElementById('refreshLoginBtn');
  loginStatusSpan = document.getElementById('loginStatus');
  openBrowserBtn = document.getElementById('openBrowserBtn');
  
  // 秒杀报名
  panelSignup = document.getElementById('panelSignup');
  totalProductsSpan = document.getElementById('totalProducts');
  totalSignupsSpan = document.getElementById('totalSignups');
  currentProductSpan = document.getElementById('currentProduct');
  productListTextarea = document.getElementById('productList');
  loadDemoBtn = document.getElementById('loadDemoBtn');
  loadFileBtn = document.getElementById('loadFileBtn');
  startBtn = document.getElementById('startBtn');
  pauseBtn = document.getElementById('pauseBtn');
  resumeBtn = document.getElementById('resumeBtn');
  stopBtn = document.getElementById('stopBtn');
  exportSignupBtn = document.getElementById('exportSignupBtn');
  stopOnErrorCheckbox = document.getElementById('stopOnError');
signupCountInput = document.getElementById('signupCountInput');
  
  // SKU清洗
  panelClean = document.getElementById('panelClean');
  cleanTotalProductsSpan = document.getElementById('cleanTotalProducts');
  cleanSuccessCount = document.getElementById('cleanSuccessCount');
  cleanFailCount = document.getElementById('cleanFailCount');
  cleanProductList = document.getElementById('cleanProductList');
  cleanLoadFileBtn = document.getElementById('cleanLoadFileBtn');
  skuCleanBtn = document.getElementById('skuCleanBtn');
  cleanPauseBtn = document.getElementById('cleanPauseBtn');
  cleanResumeBtn = document.getElementById('cleanResumeBtn');
  cleanStopBtn = document.getElementById('cleanStopBtn');
  exportCleanBtn = document.getElementById('exportCleanBtn');
  
  // 状态检测
  panelStatus = document.getElementById('panelStatus');
  statusTotalIds = document.getElementById('statusTotalIds');
  statusCurrentId = document.getElementById('statusCurrentId');
  statusFoundCount = document.getElementById('statusFoundCount');
  marketingIdList = document.getElementById('marketingIdList');
  statusLoadFileBtn = document.getElementById('statusLoadFileBtn');
  checkStatusBtn = document.getElementById('checkStatusBtn');
  statusPauseBtn = document.getElementById('statusPauseBtn');
  statusResumeBtn = document.getElementById('statusResumeBtn');
  statusStopBtn = document.getElementById('statusStopBtn');
  exportStatusBtn = document.getElementById('exportStatusBtn');

  // 批量退款
  panelRefund = document.getElementById('panelRefund');
  refundTotalOrders = document.getElementById('refundTotalOrders');
  refundProcessedOrders = document.getElementById('refundProcessedOrders');
  refundCurrentRound = document.getElementById('refundCurrentRound');
  orderListDiv = document.getElementById('orderList');
  getOrdersBtn = document.getElementById('getOrdersBtn');
  startRefundBtn = document.getElementById('startRefundBtn');
  stopRefundBtn = document.getElementById('stopRefundBtn');
  openBoughtPageBtn = document.getElementById('openBoughtPageBtn');

// 完善商品
panelPerfect = document.getElementById('panelPerfect');
perfectTotalIds = document.getElementById('perfectTotalIds');
perfectProcessed = document.getElementById('perfectProcessed');
perfectClicked = document.getElementById('perfectClicked');
perfectIdList = document.getElementById('perfectIdList');
perfectLoadFileBtn = document.getElementById('perfectLoadFileBtn');
startPerfectBtn = document.getElementById('startPerfectBtn');
perfectPauseBtn = document.getElementById('perfectPauseBtn');
perfectResumeBtn = document.getElementById('perfectResumeBtn');
perfectStopBtn = document.getElementById('perfectStopBtn');
exportPerfectBtn = document.getElementById('exportPerfectBtn');
}

// ==================== 工具函数 ====================
function addLog(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.textContent = `[${time}] ${msg}`;
  if (type === 'error') line.style.color = '#f48771';
  if (type === 'success') line.style.color = '#6a9955';
  if (type === 'warning') line.style.color = '#f9a825';
  if (logDiv) {
    logDiv.appendChild(line);
    logDiv.scrollTop = logDiv.scrollHeight;
  }
}

function parseProductList(text) {
  const lines = text.trim().split(/\r?\n/);
  const products = [];
  for (let line of lines) {
    line = line.trim();
    if (line === '' || line.startsWith('#')) continue;
    const parts = line.split(',');
    if (parts.length >= 2) {
      const id = parts[0].trim();
      const modeStr = parts[1].trim();
      
      let mode, discount;
      if (modeStr === '托管') {
        mode = 'managed';
        discount = 50;  // 托管固定50%
      } else if (modeStr === '自定义') {
        // 兼容旧格式：自定义 → 50%
        mode = 'custom';
        discount = 50;
      } else if (modeStr === '默认9折') {
        // 兼容旧格式：默认9折 → 90%
        mode = 'custom';
        discount = 90;
      } else {
        // 新格式：直接写数字
        mode = 'custom';
        discount = parseInt(modeStr, 10);
        if (isNaN(discount) || discount < 1 || discount > 99) {
          addLog(`跳过无效折扣: ${line}`, 'warning');
          continue;
        }
      }
      
      products.push({ id, mode, discount });
    }
  }
  return products;
}
function parseIdList(text) {
  return text.trim().split(/\r?\n/).map(id => id.trim()).filter(id => id);
}



// ==================== 登录状态 ====================
async function checkLoginStatus() {
  try {
    // 尝试获取当前页面 URL，判断是否在登录页
    const result = await window.electronAPI.getCurrentUrl();
    
    if (result && result.url) {
      const url = result.url;
      // 如果在登录页面，说明未登录
      if (url.includes('login.taobao.com') || url.includes('login.tmall.com')) {
        if (loginStatusSpan) {
          loginStatusSpan.textContent = '❌ 未登录';
          loginStatusSpan.style.color = '#f44336';
        }
        return false;
      }
    }
    
    // 尝试获取页面中的登录状态元素
    const isLoggedIn = await window.electronAPI.checkPageLoginStatus();
    
    if (isLoggedIn) {
      if (loginStatusSpan) {
        loginStatusSpan.textContent = '✅ 已登录';
        loginStatusSpan.style.color = '#4caf50';
      }
      return true;
    } else {
      if (loginStatusSpan) {
        loginStatusSpan.textContent = '❌ 未登录';
        loginStatusSpan.style.color = '#f44336';
      }
      return false;
    }
  } catch (err) {
    if (loginStatusSpan) {
      loginStatusSpan.textContent = '⚠️ 检测失败';
      loginStatusSpan.style.color = '#ff9800';
    }
    return false;
  }
}

// ==================== 秒杀报名 ====================
function updateSignupStats() {
  if (totalProductsSpan) totalProductsSpan.textContent = currentProducts.length;
  if (totalSignupsSpan) totalSignupsSpan.textContent = totalSignups;
}

function updateSignupPreview() {
  if (startBtn) startBtn.disabled = currentProducts.length === 0 || isRunning;
  if (exportSignupBtn) exportSignupBtn.disabled = results.length === 0;
  updateSignupStats();
}

function setSignupButtonsState(running, paused = false) {
  startBtn.disabled = running || currentProducts.length === 0;
  pauseBtn.disabled = !running;
  resumeBtn.disabled = !paused;
  stopBtn.disabled = !running;
  loadDemoBtn.disabled = running;
  loadFileBtn.disabled = running;
}

// ==================== SKU清洗 ====================
function updateCleanStats() {
  if (cleanTotalProductsSpan) cleanTotalProductsSpan.textContent = cleanProducts.length;
  if (cleanSuccessCount) cleanSuccessCount.textContent = cleanResults.filter(r => r.status === '成功').length;
  if (cleanFailCount) cleanFailCount.textContent = cleanResults.filter(r => r.status === '失败').length;
}

function updateCleanPreview() {
  if (skuCleanBtn) skuCleanBtn.disabled = cleanProducts.length === 0 || isCleaning;
  if (exportCleanBtn) exportCleanBtn.disabled = cleanResults.length === 0;
  updateCleanStats();
}

function setCleanButtonsState(running, paused = false) {
  skuCleanBtn.disabled = running || cleanProducts.length === 0;
  cleanPauseBtn.disabled = !running;
  cleanResumeBtn.disabled = !paused;
  cleanStopBtn.disabled = !running;
  cleanLoadFileBtn.disabled = running;
}

// ==================== 状态检测 ====================
function updateStatusStats() {
  const ids = parseMarketingIds();
  if (statusTotalIds) statusTotalIds.textContent = ids.length;
  if (statusFoundCount) statusFoundCount.textContent = statusResults.length;
}

function parseMarketingIds() {
  const rawText = marketingIdList.value.trim();
  if (!rawText) return [];
  if (rawText.includes(',')) {
    return rawText.split(',').map(id => id.trim()).filter(id => id);
  }
  return rawText.split(/\r?\n/).map(id => id.trim()).filter(id => id);
  }
function parsePerfectIds() {
  const rawText = perfectIdList.value.trim();
  if (!rawText) return [];
  if (rawText.includes(',')) {
    return rawText.split(',').map(id => id.trim()).filter(id => id);
  }
  return rawText.split(/\r?\n/).map(id => id.trim()).filter(id => id);
}

function updatePerfectStats() {
  const ids = parsePerfectIds();
  perfectTotalIds.textContent = ids.length;
}

function updatePerfectPreview() {
  const ids = parsePerfectIds();
  startPerfectBtn.disabled = ids.length === 0 || isPerfecting;
  exportPerfectBtn.disabled = perfectResults.length === 0;
  updatePerfectStats();
}

function setPerfectButtonsState(running, paused = false) {
  const ids = parsePerfectIds();
  startPerfectBtn.disabled = running || ids.length === 0;
  perfectPauseBtn.disabled = !running;
  perfectResumeBtn.disabled = !paused;
  perfectStopBtn.disabled = !running;
  perfectLoadFileBtn.disabled = running;
}

function updateStatusPreview() {
  const ids = parseMarketingIds();
  if (checkStatusBtn) checkStatusBtn.disabled = ids.length === 0 || isChecking;
  if (exportStatusBtn) exportStatusBtn.disabled = statusResults.length === 0;
  updateStatusStats();
}

function setStatusButtonsState(running, paused = false) {
  const ids = parseMarketingIds();
  checkStatusBtn.disabled = running || ids.length === 0;
  statusPauseBtn.disabled = !running;
  statusResumeBtn.disabled = !paused;
  statusStopBtn.disabled = !running;
  statusLoadFileBtn.disabled = running;
}
  // ========== 批量退款 ==========
getOrdersBtn.onclick = async () => {
  addLog('📋 抓取当前页面可退款订单...', 'info');
  statusDiv.textContent = '抓取中...';
  
  try {
    const result = await window.electronAPI.executeInMain('getRefundableOrders');
    refundOrders = result || [];
    
    refundTotalOrders.textContent = refundOrders.length;
    refundProcessedOrders.textContent = 0;
    refundCurrentRound.textContent = 0;
    
    if (refundOrders.length > 0) {
      orderListDiv.innerHTML = refundOrders.map(id => 
        `<div class="order-item" style="padding:6px; border-bottom:1px solid #e0e0e0;">📦 ${id}</div>`
      ).join('');
      addLog(`✅ 当前页面找到 ${refundOrders.length} 个可退款订单`, 'success');
      startRefundBtn.disabled = false;
      statusDiv.textContent = `找到 ${refundOrders.length} 个订单（仅当前页）`;
    } else {
      orderListDiv.innerHTML = '<div style="color:#999; text-align:center;">当前页面暂无订单</div>';
      addLog('⚠️ 当前页面未找到可退款订单', 'warning');
      statusDiv.textContent = '当前页无订单';
    }
  } catch (err) {
    addLog(`❌ 抓取失败: ${err.message}`, 'error');
    statusDiv.textContent = '抓取失败';
  }
};  
startRefundBtn.onclick = async () => {
  if (isRefunding) return;
  
  isRefunding = true;
  refundProcessed = 0;
  let round = 0;
  let currentButtonIndex = 0;
  
  startRefundBtn.disabled = true;
  getOrdersBtn.disabled = true;
  stopRefundBtn.disabled = false;
  statusDiv.textContent = '退款中...';
  statusDiv.classList.add('running');
  
  addLog('🚀 开始批量退款（按轮次处理）', 'success');
  
  try {
    while (isRefunding) {
      round++;
      addLog(`\n========== 第 ${round} 轮：处理所有订单的第 ${currentButtonIndex + 1} 个商品 ==========`, 'info');
      refundCurrentRound.textContent = round;
      
      if (round > 1) {
        addLog('🔄 刷新页面...', 'info');
        await window.electronAPI.refreshPage();
        await new Promise(r => setTimeout(r, 3000));
      }
      
      const orders = await window.electronAPI.executeInMain('getRefundableOrders');
      
      if (!orders || orders.length === 0) {
        addLog('✅ 没有更多可退款订单，任务完成！', 'success');
        break;
      }
      
      let hasMore = false;
      const ordersWithCount = [];
      
      for (const orderId of orders) {
        const count = await window.electronAPI.executeInMain('getOrderButtonCount', orderId);
        ordersWithCount.push({ orderId, count });
        if (count > currentButtonIndex) {
          hasMore = true;
        }
      }
      
      if (!hasMore) {
        addLog(`✅ 没有订单有第 ${currentButtonIndex + 1} 个商品，任务完成！`, 'success');
        break;
      }
      
      const ordersToProcess = ordersWithCount.filter(o => o.count > currentButtonIndex);
      addLog(`📦 本轮需要处理 ${ordersToProcess.length} 个订单`, 'info');
      
      refundTotalOrders.textContent = ordersToProcess.length;
      orderListDiv.innerHTML = ordersToProcess.map(o => 
        `<div class="order-item" style="padding:6px; border-bottom:1px solid #e0e0e0;">📦 ${o.orderId} (${o.count}个商品)</div>`
      ).join('');
      
      for (let i = 0; i < ordersToProcess.length && isRefunding; i++) {
        const { orderId } = ordersToProcess[i];
        addLog(`  [${i+1}/${ordersToProcess.length}] 订单 ${orderId} 的第 ${currentButtonIndex + 1} 个商品`, 'info');
        
        const result = await window.electronAPI.executeInMain('clickRefundButton', orderId, currentButtonIndex);
        
        if (result.success) {
          addLog(`    ✅ 退款成功`, 'success');
        } else {
          addLog(`    ❌ 退款失败: ${result.error}`, 'error');
        }
        
        refundProcessed++;
        refundProcessedOrders.textContent = refundProcessed;
        
        await new Promise(r => setTimeout(r, 1500));
      }
      
      addLog(`✅ 第 ${round} 轮完成`, 'success');
      currentButtonIndex++;
      
      if (isRefunding) {
        addLog('⏳ 等待2秒后进入下一轮...', 'info');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } catch (err) {
    addLog(`❌ 退款过程出错: ${err.message}`, 'error');
  }
  
  isRefunding = false;
  startRefundBtn.disabled = false;
  getOrdersBtn.disabled = false;
  stopRefundBtn.disabled = true;
  statusDiv.textContent = `✅ 完成！共处理 ${refundProcessed} 个商品`;
  statusDiv.classList.remove('running');
  addLog(`🎉 批量退款完成！共处理 ${refundProcessed} 个商品`, 'success');
};
  stopRefundBtn.onclick = () => {
    isRefunding = false;
    addLog('⏹️ 已停止退款', 'warning');
    statusDiv.textContent = '已停止';
    statusDiv.classList.remove('running');
    startRefundBtn.disabled = false;
    getOrdersBtn.disabled = false;
    stopRefundBtn.disabled = true;
  };
// ========== 完善商品 ==========
perfectLoadFileBtn.onclick = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.csv';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      perfectIdList.value = event.target.result;
      updatePerfectPreview();
      const ids = parsePerfectIds();
      addLog(`已加载 ${ids.length} 个营销ID`, 'success');
    };
    reader.readAsText(file, 'utf-8');
  };
  input.click();
};

perfectIdList.addEventListener('input', updatePerfectPreview);

startPerfectBtn.onclick = async () => {
  if (isPerfecting) return;
  
  const ids = parsePerfectIds();
  if (ids.length === 0) {
    addLog('请先输入营销ID列表', 'warning');
    return;
  }
  
  isPerfecting = true;
  setPerfectButtonsState(true, false);
  perfectResults = [];
  
  statusDiv.textContent = '完善商品中...';
  statusDiv.classList.add('running');
  addLog(`🔧 开始批量完善，共 ${ids.length} 个ID`, 'success');
  
  try {
    await window.electronAPI.executePerfect(ids.map(id => ({ id })));
  } catch (err) {
    addLog(`❌ 执行失败: ${err.message}`, 'error');
    isPerfecting = false;
    setPerfectButtonsState(false);
    statusDiv.classList.remove('running');
  }
};

perfectPauseBtn.onclick = async () => {
  await window.electronAPI.pauseTask();
  setPerfectButtonsState(true, true);
};

perfectResumeBtn.onclick = async () => {
  await window.electronAPI.resumeTask();
  setPerfectButtonsState(true, false);
};

perfectStopBtn.onclick = async () => {
  await window.electronAPI.stopTask();
  isPerfecting = false;
  setPerfectButtonsState(false);
  statusDiv.classList.remove('running');
  statusDiv.textContent = '已停止';
};

exportPerfectBtn.onclick = async () => {
  const result = await window.electronAPI.exportPerfectResults(perfectResults);
  if (result.success) {
    addLog(`📎 已导出到桌面`, 'success');
  } else {
    addLog(`❌ 导出失败: ${result.error}`, 'error');
  }
};
// ==================== 事件绑定 ====================
function bindEvents() {
  taskSelect.addEventListener('change', () => {
    const task = taskSelect.value;
    
    panelSignup.classList.remove('active');
    panelClean.classList.remove('active');
    panelStatus.classList.remove('active');
  panelRefund.classList.remove('active');  
  panelPerfect.classList.remove('active'); 
    
    if (task === 'signup') {
      panelSignup.classList.add('active');
      subtitle.textContent = '秒杀批量报名 | 每个商品报名1次 | 支持自定义折扣';
    } else if (task === 'clean') {
      panelClean.classList.add('active');
      subtitle.textContent = 'SKU批量清洗 | 自动删除多余SKU并添加后缀';
      updateCleanStats();
    } else if (task === 'status') {
      panelStatus.classList.add('active');
      subtitle.textContent = '营销ID状态检测 | 批量检测清退/审核不通过状态';
  } else if (task === 'refund') {
    panelRefund.classList.add('active');
    subtitle.textContent = '批量退款 | 自动处理已买到的宝贝退款';
} else if (task === 'perfect') {
  panelPerfect.classList.add('active');
  subtitle.textContent = '批量完善商品 | 批量点击完善商品按钮';

    } else {

      subtitle.textContent = '请选择一个任务开始';
    }
  });
  // 刷新登录
  refreshLoginBtn.onclick = async () => {
    addLog('🔄 正在检查登录状态...', 'info');
    await checkLoginStatus();
  };
  
  // ========== 秒杀报名 ==========
loadDemoBtn.onclick = () => {
  productListTextarea.value = `958281545368,托管\n958281545369,70\n958281545370,90`;
  currentProducts = parseProductList(productListTextarea.value);
  updateSignupPreview();
  addLog(`已加载 ${currentProducts.length} 个示例商品`, 'success');
};  
  loadFileBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        productListTextarea.value = event.target.result;
        currentProducts = parseProductList(event.target.result);
        updateSignupPreview();
        addLog(`已从 ${file.name} 加载 ${currentProducts.length} 个商品`, 'success');
      };
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  };
  
  productListTextarea.addEventListener('input', () => {
    currentProducts = parseProductList(productListTextarea.value);
    updateSignupPreview();
  });
  
  startBtn.onclick = async () => {
    if (isRunning) return;
    if (currentProducts.length === 0) {
      addLog('请先输入商品列表', 'warning');
      return;
    }
    
    // 获取报名次数
    signupCount = parseInt(signupCountInput.value, 10);
    if (isNaN(signupCount) || signupCount < 1) signupCount = 1;
    if (signupCount > 10) signupCount = 10;
    
    stopOnError = stopOnErrorCheckbox.checked;
    addLog(`📊 每个商品报名 ${signupCount} 次${stopOnError ? '，遇错停止' : ''}`, 'info');
    
    const isLoggedIn = await checkLoginStatus();
    if (!isLoggedIn) {
      addLog('❌ 请先登录淘宝账号', 'error');
      return;
    }
    
    isRunning = true;
    setSignupButtonsState(true, false);
    results = [];
    totalSignups = 0;
    
    statusDiv.textContent = '报名中...';
    statusDiv.classList.add('running');
    addLog('🚀 开始批量报名', 'success');
    
    try {
      await window.electronAPI.executeSignup(currentProducts, signupCount, stopOnError);
    } catch (err) {
      addLog(`❌ 执行失败: ${err.message}`, 'error');
      isRunning = false;
      setSignupButtonsState(false);
      statusDiv.classList.remove('running');
    }
  };
  
  pauseBtn.onclick = async () => {
    addLog('⏸️ 正在暂停...', 'info');
    await window.electronAPI.pauseTask();
    setSignupButtonsState(true, true);
  };
  
  resumeBtn.onclick = async () => {
    addLog('▶️ 正在恢复...', 'info');
    await window.electronAPI.resumeTask();
    setSignupButtonsState(true, false);
  };
  
  stopBtn.onclick = async () => {
    addLog('⏹️ 正在停止...', 'warning');
    await window.electronAPI.stopTask();
    if (results.length > 0) exportSignupResults();
    isRunning = false;
    setSignupButtonsState(false);
    statusDiv.classList.remove('running');
    statusDiv.textContent = '已停止';
  };
  
  exportSignupBtn.onclick = () => exportSignupResults();
  
  // ========== SKU清洗 ==========
  cleanLoadFileBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        cleanProductList.value = event.target.result;
        cleanProducts = parseIdList(event.target.result).map(id => ({ id }));
        updateCleanPreview();
        addLog(`已加载 ${cleanProducts.length} 个商品ID`, 'success');
      };
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  };
  
  cleanProductList.addEventListener('input', () => {
    cleanProducts = parseIdList(cleanProductList.value).map(id => ({ id }));
    updateCleanPreview();
  });
  
  skuCleanBtn.onclick = async () => {
    if (isCleaning) return;
    if (cleanProducts.length === 0) {
      addLog('请先输入商品ID列表', 'warning');
      return;
    }
    

    
    isCleaning = true;
    setCleanButtonsState(true, false);
    cleanResults = [];
    
    statusDiv.textContent = 'SKU清洗中...';
    statusDiv.classList.add('running');
    addLog('🧹 开始SKU批量清洗', 'success');
    
    try {
      await window.electronAPI.executeSkuClean(cleanProducts);
    } catch (err) {
      addLog(`❌ 执行失败: ${err.message}`, 'error');
      isCleaning = false;
      setCleanButtonsState(false);
      statusDiv.classList.remove('running');
    }
  };
  
  cleanPauseBtn.onclick = async () => {
    await window.electronAPI.pauseTask();
    setCleanButtonsState(true, true);
  };
  
  cleanResumeBtn.onclick = async () => {
    await window.electronAPI.resumeTask();
    setCleanButtonsState(true, false);
  };
  
  cleanStopBtn.onclick = async () => {
    await window.electronAPI.stopTask();
    if (cleanResults.length > 0) exportCleanResults();
    isCleaning = false;
    setCleanButtonsState(false);
    statusDiv.classList.remove('running');
    statusDiv.textContent = '已停止';
  };
  
  exportCleanBtn.onclick = () => exportCleanResults();
  
  // ========== 状态检测 ==========
  statusLoadFileBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        marketingIdList.value = event.target.result;
        updateStatusPreview();
        const ids = parseMarketingIds();
        addLog(`已加载 ${ids.length} 个营销ID`, 'success');
      };
      reader.readAsText(file, 'utf-8');
    };
    input.click();
  };
  
  marketingIdList.addEventListener('input', updateStatusPreview);
  
  checkStatusBtn.onclick = async () => {
    if (isChecking) return;
    
    const marketingIds = parseMarketingIds();
    if (marketingIds.length === 0) {
      addLog('请先输入营销ID列表', 'warning');
      return;
    }
    
    addLog(`🔍 开始检测 ${marketingIds.length} 个营销ID状态...`, 'info');
    
    isChecking = true;
    setStatusButtonsState(true, false);
    statusResults = [];
    
    statusDiv.textContent = '状态检测中...';
    statusDiv.classList.add('running');
    
    try {
      await window.electronAPI.checkMarketingStatus(marketingIds);
    } catch (err) {
      addLog(`❌ 检测失败: ${err.message}`, 'error');
      isChecking = false;
      setStatusButtonsState(false);
      statusDiv.classList.remove('running');
    }
  };
  
  statusPauseBtn.onclick = async () => {
    await window.electronAPI.pauseTask();
    setStatusButtonsState(true, true);
  };
  
  statusResumeBtn.onclick = async () => {
    await window.electronAPI.resumeTask();
    setStatusButtonsState(true, false);
  };
  
  statusStopBtn.onclick = async () => {
    await window.electronAPI.stopTask();
    if (statusResults.length > 0) exportStatusResults();
    isChecking = false;
    setStatusButtonsState(false);
    statusDiv.classList.remove('running');
    statusDiv.textContent = '已停止';
  };
  
  exportStatusBtn.onclick = () => exportStatusResults();
// 打开千牛后台（智能：如果关了就先重新打开）
openBrowserBtn.onclick = async () => {
  addLog('🌐 正在打开千牛后台...', 'info');
  
  const result = await window.electronAPI.smartNavigate('https://myseller.taobao.com/home.htm/QnworkbenchHome/');
  
  if (result.success) {
    addLog('✅ 已在浏览器中打开千牛后台', 'success');
  } else if (result.reopened) {
    addLog('🔄 浏览器已重新启动，正在打开千牛后台...', 'info');
    // 等一小会儿再导航
    setTimeout(async () => {
      await window.electronAPI.navigate('https://myseller.taobao.com/home.htm/QnworkbenchHome/');
      addLog('✅ 已在浏览器中打开千牛后台', 'success');
    }, 2000);
  } else {
    addLog(`❌ 打开失败: ${result.message}`, 'error');
  }
};
  
  // 打开已买到的宝贝
openBoughtPageBtn.onclick = async () => {
  addLog('🛒 正在打开已买到的宝贝...', 'info');
  
  const url = 'https://buyertrade.taobao.com/trade/itemlist/list_bought_items.htm?action=itemlist%2FBoughtQueryAction&event_submit_do_query=1&tabCode=waitSend';
  const result = await window.electronAPI.smartNavigate(url);
  
  if (result.success) {
    addLog('✅ 已在浏览器中打开已买到的宝贝', 'success');
  } else if (result.reopened) {
    addLog('🔄 浏览器已重新启动，正在打开已买到的宝贝...', 'info');
    setTimeout(async () => {
      await window.electronAPI.navigate(url);
      addLog('✅ 已在浏览器中打开已买到的宝贝', 'success');
    }, 2000);
  } else {
    addLog(`❌ 打开失败: ${result.message}`, 'error');
  }
};
}

// ==================== 导出函数 ====================
async function exportSignupResults() {
  try {
    const result = await window.electronAPI.exportSignupResults(results);
    if (result.success) {
      addLog(`📎 已导出到桌面`, 'success');
    } else {
      addLog(`❌ 导出失败: ${result.error}`, 'error');
    }
  } catch (error) {
    addLog(`❌ 导出失败: ${error.message}`, 'error');
  }
}

async function exportCleanResults() {
  try {
    const result = await window.electronAPI.exportCleanResults(cleanResults);
    if (result.success) {
      addLog(`📎 已导出到桌面`, 'success');
    } else {
      addLog(`❌ 导出失败: ${result.error}`, 'error');
    }
  } catch (error) {
    addLog(`❌ 导出失败: ${error.message}`, 'error');
  }
}

async function exportStatusResults() {
  try {
    const result = await window.electronAPI.exportStatusResults(statusResults);
    if (result.success) {
      addLog(`📎 已导出到桌面`, 'success');
    } else {
      addLog(`❌ 导出失败: ${result.error}`, 'error');
    }
  } catch (error) {
    addLog(`❌ 导出失败: ${error.message}`, 'error');
  }
}
// ==================== 监听主进程消息 ====================
// 报名
window.electronAPI.onSignupLog((data) => addLog(data.msg, data.type));

window.electronAPI.onSignupProgress((data) => {
  if (currentProductSpan) currentProductSpan.textContent = data.current + 1;
  if (totalProductsSpan) totalProductsSpan.textContent = data.total;
  if (statusDiv) statusDiv.textContent = `报名中: ${data.current + 1}/${data.total}`;
});

window.electronAPI.onSignupComplete((data) => {
  results = data.results;
  totalSignups = data.totalSignups;  // ✅ 直接用主进程传来的总数
  updateSignupStats();
  addLog(`🎉 报名完成！共 ${results.length} 个商品，成功 ${totalSignups} 次报名`, 'success');
  
  if (results.length > 0) exportSignupResults();
  
  statusDiv.textContent = '✅ 完成';
  isRunning = false;
  setSignupButtonsState(false);
  statusDiv.classList.remove('running');
});

window.electronAPI.onSignupRealtimeUpdate((data) => {
  const existingIndex = results.findIndex(r => r.productId === data.productId);
  if (existingIndex >= 0) {
    results[existingIndex] = data;
  } else {
    results.push(data);
  }
  
  // 判断是否有任何一个 signupId 不为空
  const hasSuccess = data.signupId1 || data.signupId2 || data.signupId3 || data.signupId4 || data.signupId5;
  
  totalSignups = results.reduce((sum, r) => {
    return sum + [r.signupId1, r.signupId2, r.signupId3, r.signupId4, r.signupId5].filter(id => id && id !== '').length;
  }, 0);
  
  updateSignupStats();
  addLog(`📝 商品 ${data.productId} ${hasSuccess ? '报名成功' : '报名失败'}`, 'info');
});

// SKU清洗
window.electronAPI.onSkuLog((data) => addLog(data.msg, data.type));

window.electronAPI.onSkuProgress((data) => {
  if (currentProductSpan) currentProductSpan.textContent = data.current + 1;
  if (statusDiv) statusDiv.textContent = `清洗中: ${data.current + 1}/${data.total}`;
});

window.electronAPI.onSkuComplete((data) => {
  cleanResults = data.results;
  updateCleanStats();
  addLog(`🎉 清洗完成！成功 ${data.successCount} 个，失败 ${data.failCount} 个`, 'success');
  
  if (cleanResults.length > 0) exportCleanResults();
  
  statusDiv.textContent = '✅ 完成';
  isCleaning = false;
  setCleanButtonsState(false);
  statusDiv.classList.remove('running');
});

// 状态检测
window.electronAPI.onStatusLog((data) => addLog(data.msg, data.type));

window.electronAPI.onStatusProgress((data) => {
  if (statusCurrentId) statusCurrentId.textContent = data.current + 1;
  if (statusTotalIds) statusTotalIds.textContent = data.total;
  if (statusDiv) statusDiv.textContent = `检测中: ${data.current + 1}/${data.total}`;
});

window.electronAPI.onStatusComplete((data) => {
  statusResults = data.results;
  updateStatusStats();
  addLog(`🎉 检测完成！共检测 ${statusResults.length} 个营销ID`, 'success');
  
  if (statusResults.length > 0) exportStatusResults();
  
  statusDiv.textContent = '✅ 完成';
  isChecking = false;
  setStatusButtonsState(false);
  statusDiv.classList.remove('running');
});
// 完善商品
window.electronAPI.onPerfectLog((data) => addLog(data.msg, data.type));

window.electronAPI.onPerfectProgress((data) => {
  perfectProcessed.textContent = data.current;
  perfectTotalIds.textContent = data.total;
  statusDiv.textContent = `完善中: ${data.current}/${data.total}`;
});

window.electronAPI.onPerfectComplete((data) => {
  perfectResults = data.results;
  updatePerfectStats();
  addLog(`🎉 批量完善完成！`, 'success');
  
  statusDiv.textContent = '✅ 完成';
  isPerfecting = false;
  setPerfectButtonsState(false);
  statusDiv.classList.remove('running');
});
// ==================== 初始化 ====================
async function init() {
  initDOM();
  bindEvents();
  
  addLog('🎯 千牛工作助手已启动', 'success');
  await checkLoginStatus();
  
  addLog('🔍 正在初始化浏览器...', 'info');
  const success = await initBrowser();
  if (success) {
    addLog('💡 请在浏览器中登录淘宝账号，然后点击"刷新状态"', 'info');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}