// tasks/perfect.js - 批量完善商品模块
const { sleep, checkShouldStop, interruptibleSleep, TaskStoppedError } = require('../utils');
const { STATUS_CHECK_URL } = require('../browser');

// ==================== 批量点击完善商品 ====================
async function clickAllPerfectButtons(page, sendLog, taskState) {
  await checkShouldStop(taskState, sendLog);
  
  // 获取当前页面所有"完善商品"按钮
  const buttons = await page.$$('button');
  const perfectButtons = [];
  
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.innerText, btn);
    if (text.includes('完善商品')) {
      perfectButtons.push(btn);
    }
  }
  
  if (perfectButtons.length === 0) {
    sendLog(`  ⚠️ 当前页面没有"完善商品"按钮`, 'warning');
    return 0;
  }
  
  sendLog(`  📦 找到 ${perfectButtons.length} 个"完善商品"按钮`, 'info');
  
  let successCount = 0;
  
  for (let i = 0; i < perfectButtons.length; i++) {
    await checkShouldStop(taskState, sendLog);
    
    try {
      // 获取当前打开的页面数量
      const pagesBefore = await page.browser().pages();
      
      // 点击按钮
      await perfectButtons[i].click();
      sendLog(`    🖱️ 点击第 ${i+1} 个按钮`, 'info');
      
      // 等待新页面打开
      await interruptibleSleep(1500, taskState, sendLog);
      
      // 获取新打开的页面
      const pagesAfter = await page.browser().pages();
      const newPages = pagesAfter.filter(p => !pagesBefore.includes(p));
      
      // 关闭所有新打开的页面
      for (const newPage of newPages) {
        try {
          await newPage.close();
          sendLog(`    ✅ 已关闭新页面`, 'success');
        } catch (e) {
          // 忽略关闭错误
        }
      }
      
      successCount++;
      
      // 每个按钮之间等待一下
      await interruptibleSleep(500, taskState, sendLog);
      
    } catch (e) {
      sendLog(`    ❌ 第 ${i+1} 个按钮点击失败: ${e.message}`, 'error');
    }
  }
  
  return successCount;
}

// ==================== 搜索批次 ====================
async function searchPerfectBatch(page, idsString, isFirstBatch, sendLog, taskState) {
  sendLog(`  🔍 搜索 ${idsString.split(',').length} 个ID...`, 'info');
  
  await checkShouldStop(taskState, sendLog);
  
  // 非第一批：点击清除按钮
  if (!isFirstBatch) {
    const clearBtn = await page.$('.next-icon-delete-filling');
    if (clearBtn) {
      sendLog('  🧹 点击清除按钮', 'info');
      await clearBtn.click();
      await interruptibleSleep(1500, taskState, sendLog);
    }
  }
  
  await checkShouldStop(taskState, sendLog);
  
  // 输入ID
  await page.evaluate((ids) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    const input = document.querySelector('#global');
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => {
      setter.call(input, ids);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 300);
  }, idsString);
  
  await interruptibleSleep(800, taskState, sendLog);
  
  await checkShouldStop(taskState, sendLog);
  
  // 点击搜索
  const searchClicked = await page.evaluate(() => {
    const btn = document.querySelector('button.next-btn[type="submit"]') ||
                Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('搜索'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  
  if (searchClicked) {
    sendLog('  🖱️ 点击搜索', 'info');
  }
  
  await interruptibleSleep(2500, taskState, sendLog);
}

// ==================== 翻页 ====================
async function goToNextPage(page, taskState, sendLog) {
  await checkShouldStop(taskState, sendLog);
  
  const hasNext = await page.evaluate(() => {
    const nextBtn = document.querySelector('button.next-pagination-item.next-next');
    return nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('disabled');
  });
  
  if (hasNext) {
    await page.evaluate(() => {
      document.querySelector('button.next-pagination-item.next-next').click();
    });
    await interruptibleSleep(2000, taskState, sendLog);
    return true;
  }
  
  return false;
}

// ==================== 批量完善主函数 ====================
async function executePerfect(products, sendLog, sendProgress, sendComplete, page, taskState) {
  const BATCH_SIZE = 20;
  const startTime = Date.now();
  let totalClicked = 0;
  
  sendLog(`🔧 共 ${products.length} 个ID，分 ${Math.ceil(products.length / BATCH_SIZE)} 批处理`, 'info');
  
  await checkShouldStop(taskState, sendLog);
  
  // 导航到状态检测页面（和搜索同一个页面）
  sendLog('📍 导航到营销活动页面...', 'info');
  await page.goto(STATUS_CHECK_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await interruptibleSleep(2000, taskState, sendLog);
  
  for (let i = 0; i < products.length && !taskState.isStopRequested; i += BATCH_SIZE) {
    await checkShouldStop(taskState, sendLog);
    
    const batch = products.slice(i, i + BATCH_SIZE).map(p => p.id);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(products.length / BATCH_SIZE);
    
    sendLog(`\n📦 第 ${batchNum}/${totalBatches} 批 (${batch.length}个ID)`, 'info');
    sendProgress(i, products.length);
    
    const idsString = batch.join(',');
    const isFirstBatch = (i === 0);
    
    try {
      // 搜索
      await searchPerfectBatch(page, idsString, isFirstBatch, sendLog, taskState);
      
      await checkShouldStop(taskState, sendLog);
      
      // 处理当前页及后续翻页
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages && !taskState.isStopRequested) {
        await checkShouldStop(taskState, sendLog);
        
        sendLog(`\n  📄 第 ${currentPage} 页`, 'info');
        
        // 等待页面稳定
        await interruptibleSleep(500, taskState, sendLog);
        
        // 批量点击当前页的完善商品按钮
        const clicked = await clickAllPerfectButtons(page, sendLog, taskState);
        totalClicked += clicked;
        
        await checkShouldStop(taskState, sendLog);
        
        // 尝试翻页
        hasMorePages = await goToNextPage(page, taskState, sendLog);
        
        if (hasMorePages) {
          currentPage++;
          sendLog(`  ➡️ 翻到第 ${currentPage} 页`, 'info');
        } else {
          sendLog(`  ✅ 已到最后一页`, 'success');
        }
      }
      
    } catch (e) {
      if (e.name === 'TaskStoppedError') {
        sendLog('⏹️ 任务已停止', 'warning');
        break;
      }
      sendLog(`❌ 批次处理失败: ${e.message}`, 'error');
    }
    
    if (i + BATCH_SIZE < products.length && !taskState.isStopRequested) {
      sendLog('⏳ 等待2秒后处理下一批...', 'info');
      await interruptibleSleep(2000, taskState, sendLog);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  sendLog(`\n✨ 完成！共点击 ${totalClicked} 个完善按钮，耗时 ${elapsed}秒`, 'success');
  
  // 构造结果
  const results = products.map(p => ({
    marketingId: p.id,
    status: '已处理',
    error: ''
  }));
  
  sendComplete(results);
  return results;
}

// ==================== 导出 ====================
module.exports = {
  executePerfect
};