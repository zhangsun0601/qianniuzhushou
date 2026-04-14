// tasks/status.js - 营销ID状态检测模块
const { sleep, checkShouldStop, interruptibleSleep, TaskStoppedError } = require('../utils');
const { STATUS_CHECK_URL } = require('../browser');

// ==================== 搜索批次 ====================
async function searchStatusBatch(page, idsString, isFirstBatch, sendLog, taskState) {
  sendLog(`  🔍 搜索 ${idsString.split(',').length} 个ID...`, 'info');
  
  await checkShouldStop(taskState, sendLog);
  
  if (!isFirstBatch) {
    const clearBtn = await page.$('.next-icon-delete-filling');
    if (clearBtn) {
      sendLog('  🧹 点击清除按钮', 'info');
      await clearBtn.click();
      await interruptibleSleep(1500, taskState, sendLog);
    }
  }
  
  await checkShouldStop(taskState, sendLog);
  
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
  
  const allResults = [];
  let pageNum = 1;
  
  while (true) {
    await checkShouldStop(taskState, sendLog);
    await interruptibleSleep(500, taskState, sendLog);
    
    const pageResults = await page.evaluate(() => {
      const results = [];
      const seen = new Set();
      const rows = document.querySelectorAll('.next-table-row');
      
      for (const row of rows) {
        const juIdCell = row.querySelector('.cell-juId');
        if (!juIdCell) continue;
        
        const text = juIdCell.innerText;
        const match = text.match(/\d{10,}/);
        if (!match) continue;
        
        const marketingId = match[0];
        if (seen.has(marketingId)) continue;
        seen.add(marketingId);
        
        const itemIdCell = row.querySelector('.cell-itemId');
        const itemIdSpan = itemIdCell?.querySelector('.cell-content span');
        const itemId = itemIdSpan ? itemIdSpan.innerText.trim() : '';
        
        const statusSpan = row.querySelector('.item-activity-status .next-tag-body span span') || 
                           row.querySelector('.item-activity-status .next-tag-body span');
        const status = statusSpan ? statusSpan.innerText.trim() : '未找到';
        
        results.push({ marketingId, itemId, status });
      }
      
      return results;
    });
    
    if (pageResults.length === 0) {
      await interruptibleSleep(1000, taskState, sendLog);
      const retryResults = await page.evaluate(() => {
        const results = [];
        const seen = new Set();
        const rows = document.querySelectorAll('.next-table-row');
        for (const row of rows) {
          const juIdCell = row.querySelector('.cell-juId');
          if (!juIdCell) continue;
          const text = juIdCell.innerText;
          const match = text.match(/\d{10,}/);
          if (!match) continue;
          const marketingId = match[0];
          if (seen.has(marketingId)) continue;
          seen.add(marketingId);
          const itemIdCell = row.querySelector('.cell-itemId');
          const itemIdSpan = itemIdCell?.querySelector('.cell-content span');
          const itemId = itemIdSpan ? itemIdSpan.innerText.trim() : '';
          const statusSpan = row.querySelector('.item-activity-status .next-tag-body span span') || 
                             row.querySelector('.item-activity-status .next-tag-body span');
          const status = statusSpan ? statusSpan.innerText.trim() : '未找到';
          results.push({ marketingId, itemId, status });
        }
        return results;
      });
      if (retryResults.length === 0) break;
      pageResults.push(...retryResults);
    }
    
    sendLog(`  📋 第${pageNum}页，${pageResults.length}个商品，提取详情...`, 'info');
    
    for (const item of pageResults) {
      await checkShouldStop(taskState, sendLog);
      
      if (item.status !== '清退' && item.status !== '审核不通过') {
        item.clearTime = '';
        item.reason = '';
        continue;
      }
      
      const detail = await page.evaluate((marketingId) => {
        return new Promise((resolve) => {
          const rows = document.querySelectorAll('.next-table-row');
          let targetRow = null;
          for (const row of rows) {
            const juIdCell = row.querySelector('.cell-juId');
            if (!juIdCell) continue;
            const text = juIdCell.innerText;
            const match = text.match(/\d{10,}/);
            if (match && match[0] === marketingId) {
              targetRow = row;
              break;
            }
          }
          if (!targetRow) { resolve({ clearTime: '', reason: '' }); return; }
          const questionIcon = targetRow.querySelector('.item-activity-status .qn_iconfont.qn_question');
          if (!questionIcon) { resolve({ clearTime: '', reason: '' }); return; }
          const rect = questionIcon.getBoundingClientRect();
          const x = rect.left + 8;
          const y = rect.top + 8;
          const events = [
            { type: 'pointerenter', x, y }, { type: 'pointerover', x, y }, { type: 'pointermove', x, y },
            { type: 'mouseenter', x, y }, { type: 'mouseover', x, y }, { type: 'mousemove', x, y }
          ];
          for (const evt of events) {
            let event;
            if (evt.type.startsWith('pointer')) {
              event = new PointerEvent(evt.type, { bubbles: true, cancelable: true, view: window, clientX: evt.x, clientY: evt.y, pointerId: 1, pointerType: 'mouse', isPrimary: true });
            } else {
              event = new MouseEvent(evt.type, { bubbles: true, cancelable: true, view: window, clientX: evt.x, clientY: evt.y });
            }
            questionIcon.dispatchEvent(event);
          }
          let attempts = 0;
          const checkInterval = setInterval(() => {
            const balloon = document.querySelector('.next-balloon-content');
            if (balloon) {
              const text = balloon.innerText;
              const timeMatch = text.match(/(?:清退|审核不通过)\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
              const reasonMatch = text.match(/原因[:：]\s*([\s\S]+)/);
              if (timeMatch && reasonMatch) {
                clearInterval(checkInterval);
                questionIcon.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
                resolve({ clearTime: timeMatch[1], reason: reasonMatch[1].trim() });
                return;
              }
            }
            attempts++;
            if (attempts >= 20) {
              clearInterval(checkInterval);
              questionIcon.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
              resolve({ clearTime: '', reason: '' });
            }
          }, 200);
        });
      }, item.marketingId);
      
      item.clearTime = detail.clearTime;
      item.reason = detail.reason;
      await interruptibleSleep(300, taskState, sendLog);
    }
    
    allResults.push(...pageResults);
    
    await checkShouldStop(taskState, sendLog);
    
    const hasNext = await page.evaluate(() => {
      const nextBtn = document.querySelector('button.next-pagination-item.next-next');
      return nextBtn && !nextBtn.disabled && !nextBtn.classList.contains('disabled');
    });
    
    if (hasNext) {
      await page.evaluate(() => {
        document.querySelector('button.next-pagination-item.next-next').click();
      });
      pageNum++;
      await interruptibleSleep(2000, taskState, sendLog);
    } else {
      break;
    }
  }
  
  sendLog(`  ✅ 获取到 ${allResults.length} 个结果`, 'success');
  return allResults;
}

// ==================== 检测营销状态 ====================
async function checkMarketingStatus(marketingIds, sendLog, sendProgress, sendComplete, page, taskState) {
  const BATCH_SIZE = 20;
  const allResults = [];
  const startTime = Date.now();
  
  sendLog(`🎯 共 ${marketingIds.length} 个ID，分 ${Math.ceil(marketingIds.length / BATCH_SIZE)} 批检测`, 'info');
  
  await checkShouldStop(taskState, sendLog);
  
  sendLog('📍 导航到状态检测页面...', 'info');
  await page.goto(STATUS_CHECK_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await interruptibleSleep(2000, taskState, sendLog);
  
  for (let i = 0; i < marketingIds.length && !taskState.isStopRequested; i += BATCH_SIZE) {
    await checkShouldStop(taskState, sendLog);
    
    const batch = marketingIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(marketingIds.length / BATCH_SIZE);
    
    sendLog(`\n📦 第 ${batchNum}/${totalBatches} 批 (${batch.length}个ID)`, 'info');
    sendProgress(i, marketingIds.length);
    
    const idsString = batch.join(',');
    const isFirstBatch = (i === 0);
    
    try {
      const batchResults = await searchStatusBatch(page, idsString, isFirstBatch, sendLog, taskState);
      allResults.push(...batchResults);
    } catch (e) {
      if (e.name === 'TaskStoppedError') {
        sendLog('⏹️ 任务已停止', 'warning');
        break;
      }
      sendLog(`❌ 批次检测失败: ${e.message}`, 'error');
    }
    
    if (i + BATCH_SIZE < marketingIds.length && !taskState.isStopRequested) {
      sendLog('⏳ 等待2秒...', 'info');
      await interruptibleSleep(2000, taskState, sendLog);
    }
  }
  
  // ========== 按输入顺序排序 ==========
  // 创建 ID 到结果的映射（一个ID可能对应多个结果，取第一个）
  const resultMap = new Map();
  for (const r of allResults) {
    if (!resultMap.has(r.marketingId)) {
      resultMap.set(r.marketingId, r);
    }
  }
  
  // 按输入顺序重新排列
  const sortedResults = [];
  for (const id of marketingIds) {
    const result = resultMap.get(id);
    if (result) {
      sortedResults.push(result);
    } else {
      // 如果没找到结果，补一个空记录
      sortedResults.push({
        marketingId: id,
        itemId: '',
        status: '未找到',
        clearTime: '',
        reason: ''
      });
    }
  }
  // ========== 排序结束 ==========
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  sendLog(`\n✨ 检测完成！共 ${allResults.length} 个ID，耗时 ${elapsed}秒`, 'success');
  
  sendComplete(sortedResults);  // ← 这里改为 sortedResults
  return sortedResults;         // ← 这里也改为 sortedResults
}
// ==================== 导出 ====================
module.exports = {
  checkMarketingStatus
};