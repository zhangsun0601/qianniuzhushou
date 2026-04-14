// tasks/signup.js - 秒杀报名模块
const { sleep, safeInput, checkShouldStop, interruptibleSleep, TaskStoppedError } = require('../utils');
const { ACTIVITY_URL } = require('../browser');

// ==================== 批量设置（活动到手价） ====================
async function executeBatchSetting(page, priceType, percentage, subtractor, taskState, sendLog) {
  console.log(`📊 设置${priceType}: ${percentage}%`);
  
  await checkShouldStop(taskState, sendLog);
  
  // 点击批量设置按钮
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const batchBtn = btns.find(btn => btn.innerText.includes('批量设置'));
    if (batchBtn) batchBtn.click();
  });
  await interruptibleSleep(400, taskState, sendLog);
  
  await checkShouldStop(taskState, sendLog);
  
  // 选择"根据一口价设置"
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.next-radio-label'));
    const target = labels.find(l => l.innerText.includes('根据一口价设置'));
    if (target) target.click();
  });
  await interruptibleSleep(300, taskState, sendLog);
  
  await checkShouldStop(taskState, sendLog);
  
  // 输入百分比和减数
  await safeInput(page, '#percentage', percentage.toString(), '百分比');
  if (subtractor) await safeInput(page, '#subtractor', subtractor.toString(), '减数');
  
  await checkShouldStop(taskState, sendLog);
  
  // 选择"不取整"
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.next-radio-label'));
    const target = labels.find(l => l.innerText.includes('不取整'));
    if (target) target.click();
  });
  await interruptibleSleep(200, taskState, sendLog);
  
  await checkShouldStop(taskState, sendLog);
  
  // 点击保存
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(btn => btn.innerText.includes('保存'));
    if (saveBtn) saveBtn.click();
  });
  await interruptibleSleep(400, taskState, sendLog);
  
  return true;
}

// ==================== 活动价设置 ====================
async function executeActivityPriceSetting(page, percentage, taskState, sendLog) {
  console.log(`📊 设置活动价: ${percentage}%`);
  
  await checkShouldStop(taskState, sendLog);
  
  // 点击批量设置按钮（第二个）
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const batchBtns = btns.filter(btn => btn.innerText.includes('批量设置'));
    const targetBtn = batchBtns.length >= 2 ? batchBtns[1] : batchBtns[0];
    if (targetBtn) targetBtn.click();
  });
  await interruptibleSleep(400, taskState, sendLog);
  
  await checkShouldStop(taskState, sendLog);
  
  // 选择"根据一口价设置"
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.next-radio-label'));
    const target = labels.find(l => l.innerText.includes('根据一口价设置'));
    if (target) target.click();
  });
  await interruptibleSleep(300, taskState, sendLog);
  
  await checkShouldStop(taskState, sendLog);
  
  // 输入百分比
  await safeInput(page, '#percentage', percentage.toString(), '百分比');
  
  await checkShouldStop(taskState, sendLog);
  
  // 选择"不取整"
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.next-radio-label'));
    const target = labels.find(l => l.innerText.includes('不取整'));
    if (target) target.click();
  });
  await interruptibleSleep(200, taskState, sendLog);
  
  await checkShouldStop(taskState, sendLog);
  
  // 点击保存
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(btn => btn.innerText.includes('保存'));
    if (saveBtn) saveBtn.click();
  });
  await interruptibleSleep(400, taskState, sendLog);
  
  return true;
}

// ==================== 单次报名 ====================
async function signupOnce(productId, discountType, discount, roundNum, sendLog, page, taskState) {
  if (taskState.isStopRequested) return { success: false, error: '用户停止' };
  
  sendLog(`\n========== 第 ${roundNum} 次报名，商品: ${productId}, 类型: ${discountType} ==========`, 'info');
  
  try {
    await checkShouldStop(taskState, sendLog);
    
    // 强制导航到活动报名页
    sendLog('📍 导航到活动报名页...', 'info');
    await page.goto(ACTIVITY_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await interruptibleSleep(2000, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 等待页面稳定
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
    await interruptibleSleep(1000, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 检查页面
    const currentUrl = page.url();
    sendLog(`📍 当前页面: ${currentUrl}`, 'info');
    
    if (!currentUrl.includes('apply.htm')) {
      sendLog(`❌ 页面错误`, 'error');
      return { success: false, error: '页面导航失败' };
    }
    
    await checkShouldStop(taskState, sendLog);
    
    // 点击"选择商品"按钮
    let selectClicked = false;
    for (let i = 0; i < 10; i++) {
      await checkShouldStop(taskState, sendLog);
      
      selectClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(btn => btn.innerText.includes('选择商品'));
        if (target) { 
          target.click(); 
          return true; 
        }
        return false;
      });
      if (selectClicked) break;
      await interruptibleSleep(500, taskState, sendLog);
    }
    
    if (!selectClicked) {
      sendLog('❌ 未找到选择商品按钮', 'error');
      return { success: false, error: '未找到选择商品按钮' };
    }
    sendLog('✅ 已点击选择商品', 'success');
    await interruptibleSleep(1000, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 输入商品ID
    await safeInput(page, '#itemLink, input[placeholder*="商品ID"]', productId, '商品ID');
    await interruptibleSleep(500, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 点击搜索
    const searched = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const searchBtn = btns.find(btn => btn.innerText.includes('搜索'));
      if (searchBtn) { searchBtn.click(); return true; }
      return false;
    });
    if (!searched) await page.keyboard.press('Enter');
    sendLog('✅ 已搜索', 'success');
    await interruptibleSleep(1500, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 选中商品
    const radioClicked = await page.evaluate(() => {
      const radio = document.querySelector('.next-radio-input[type="radio"]');
      if (radio) { radio.click(); return true; }
      return false;
    });
    if (!radioClicked) return { success: false, error: '未找到商品单选按钮' };
    sendLog('✅ 已选中商品', 'success');
    await interruptibleSleep(500, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 检测是否不可报名
    const isNotAvailable = await page.evaluate(() => {
      const elements = document.querySelectorAll('span, div, .status-text');
      for (const el of elements) {
        if (el.innerText && el.innerText.includes('不可报名')) {
          return true;
        }
      }
      return false;
    });
    
    if (isNotAvailable) {
      sendLog(`⚠️ 商品 ${productId} 不可报名，跳过本次报名`, 'warning');
      return { success: false, error: '商品不可报名', skipProduct: true };
    }
    
    await checkShouldStop(taskState, sendLog);
    
    // 点击确认
    const confirmed = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = btns.find(btn => btn.innerText.includes('确认'));
      if (confirmBtn) { confirmBtn.click(); return true; }
      return false;
    });
    if (!confirmed) return { success: false, error: '未找到确认按钮' };
    sendLog('✅ 已确认选择', 'success');
    await interruptibleSleep(1000, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 第一次提交
    const submitted1 = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(btn => btn.innerText.includes('提交并下一步'));
      if (submitBtn) { submitBtn.click(); return true; }
      return false;
    });
    if (!submitted1) return { success: false, error: '未找到第一次提交按钮' };
    sendLog('✅ 已点击第一次提交', 'success');
    
    // 等待页面跳转
    const startUrl1 = page.url();
    for (let i = 0; i < 30; i++) {
      await checkShouldStop(taskState, sendLog);
      await interruptibleSleep(500, taskState, sendLog);
      if (page.url() !== startUrl1) break;
    }
    await interruptibleSleep(1000, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('⏳ 等待页面跳转...', 'info');
    await page.waitForFunction(
      (targetPuCode) => window.location.href.includes(`puCode=${targetPuCode}`),
      { timeout: 20000 },
      'miaoshaItemMergePlayApplyProcessNode'
    );
    sendLog('✅ 已跳转到价格设置页面', 'success');
    await interruptibleSleep(2000, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 价格设置
    if (discountType === '自定义') {
      // 使用传入的 discount 参数
      const discountValue = discount || 50;
      sendLog(`📊 执行自定义价格设置 (${discountValue}%)`, 'info');
      await executeBatchSetting(page, '活动到手价', discountValue, 0.01, taskState, sendLog);
      await interruptibleSleep(1000, taskState, sendLog);
      await executeActivityPriceSetting(page, discountValue, taskState, sendLog);
    } else {
      sendLog('📊 默认9折：跳过价格设置', 'info');
    }    
    await interruptibleSleep(500, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 限购设置
    sendLog('📊 设置限购...', 'info');
    
    const limitRadioClicked = await page.evaluate(() => {
      const labels = document.querySelectorAll('.next-radio-label, .next-radio-wrapper');
      for (const label of labels) {
        if (label.innerText && label.innerText.trim() === '需要限购') {
          const radio = label.querySelector('input[type="radio"]');
          if (radio && !radio.checked) {
            radio.click();
            return true;
          } else if (radio && radio.checked) {
            return true;
          }
        }
      }
      return false;
    });
    
    if (limitRadioClicked) {
      sendLog('✅ 已点击需要限购', 'success');
    } else {
      sendLog('⚠️ 未找到"需要限购"选项', 'warning');
    }
    await interruptibleSleep(500, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    let limitInput = null;
    for (let i = 0; i < 10; i++) {
      await checkShouldStop(taskState, sendLog);
      await interruptibleSleep(300, taskState, sendLog);
      limitInput = await page.$('#limitNum');
      if (limitInput) break;
    }
    
    if (limitInput) {
      await limitInput.click({ clickCount: 3 });
      await limitInput.press('Backspace');
      await limitInput.type('100');
      sendLog('✅ 输入限购数量: 100', 'success');
    } else {
      sendLog('⚠️ 未找到限购输入框', 'warning');
    }
    await interruptibleSleep(500, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    // 第二次提交
    let submitRetryCount = 0;
    const maxSubmitRetries = 2;
    let submitSuccess = false;
    
    while (submitRetryCount < maxSubmitRetries && !submitSuccess) {
      await checkShouldStop(taskState, sendLog);
      
      const submitted = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const submitBtn = btns.find(btn => btn.innerText.includes('提交并下一步'));
        if (submitBtn) { 
          submitBtn.click(); 
          return true; 
        }
        return false;
      });
      
      if (!submitted) {
        sendLog('❌ 未找到提交按钮', 'error');
        break;
      }
      sendLog('✅ 已点击提交并下一步', 'success');
      
      await interruptibleSleep(1500, taskState, sendLog);
      
      const dialogHandled = await page.evaluate(() => {
        const dialog = document.querySelector('.next-dialog, .next-message-dialog, [role="dialog"]');
        if (!dialog) return false;
        const dialogText = dialog.innerText;
        if (dialogText && (dialogText.includes('限购') || dialogText.includes('商品限购'))) {
          const knowBtn = Array.from(document.querySelectorAll('.next-btn, button'))
            .find(btn => btn.innerText === '知道了' || btn.innerText === '确定');
          if (knowBtn) {
            knowBtn.click();
            return true;
          }
        }
        return false;
      });
      
      if (dialogHandled) {
        sendLog('⚠️ 检测到限购弹窗，准备重试', 'warning');
        submitRetryCount++;
        await interruptibleSleep(1000, taskState, sendLog);
      } else {
        submitSuccess = true;
        sendLog('✅ 提交成功', 'success');
      }
    }
    
    // 等待页面跳转
    const startUrl2 = page.url();
    for (let i = 0; i < 30; i++) {
      await checkShouldStop(taskState, sendLog);
      await interruptibleSleep(500, taskState, sendLog);
      if (page.url() !== startUrl2) break;
    }
    await interruptibleSleep(1000, taskState, sendLog);
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('⏳ 等待报名结果...', 'info');
    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      { timeout: 20000 },
      '通用商品卖点'
    );
    sendLog('✅ 检测到成功标志', 'success');
    
    await checkShouldStop(taskState, sendLog);
    
    const marketingId = await page.evaluate(() => {
      const el = document.querySelector('.signStatusText--iUSpzz0F');
      return el ? el.innerText.trim() : '报名成功';
    });
    
    sendLog(`✅ 营销ID: ${marketingId}`, 'success');
    return { success: true, marketingId, error: null };
    
  } catch (e) {
    if (e.name === 'TaskStoppedError') {
      sendLog('⏹️ 任务已停止', 'warning');
      return { success: false, error: '用户停止' };
    }
    sendLog(`❌ 报名失败: ${e.message}`, 'error');
    return { success: false, error: e.message };
  }
}

// ==================== 批量报名 ====================
async function executeSignup(products, sendLog, sendProgress, sendComplete, event, signupCount, stopOnError, page, taskState) {
  console.log(`🔍 [DEBUG] signup.js: 接收到的 signupCount = ${signupCount}`);
  sendLog(`🔍 [DEBUG] 报名次数 = ${signupCount}`, 'info');
  
  let results = [];
  let totalSignups = 0;
  
  for (let i = 0; i < products.length && !taskState.isStopRequested; i++) {
    await checkShouldStop(taskState, sendLog);
    
    const product = products[i];
    
    // 转换成旧格式的 discountType
    let discountType = product.type;
    if (!discountType) {
      if (product.mode === 'managed') {
        discountType = '自定义';
        product.discount = 50;  // 托管固定50%
      } else if (product.mode === 'custom') {
        discountType = product.discount === 90 ? '默认9折' : '自定义';
      }
    }
    
    const productDesc = discountType === '自定义' ? `${product.discount || 50}%` : '默认9折';
    sendLog(`========== 商品 ${i+1}/${products.length}: ${product.id} (${productDesc}) ==========`, 'info');
    sendProgress(i, products.length, 0);
    
    const signupIds = [];
    let finalError = '';
    
    for (let round = 1; round <= signupCount && !taskState.isStopRequested; round++) {
      await checkShouldStop(taskState, sendLog);
      
      sendLog(`  → 第 ${round}/${signupCount} 次报名`, 'info');
      
      const result = await signupOnce(product.id, discountType, product.discount || 50, round, sendLog, page, taskState);
      totalSignups++;
      
      if (result.success) {
        signupIds.push(result.marketingId);
      } else {
        signupIds.push('');
        finalError = result.error;
        
        if (result.skipProduct) {
          sendLog(`⚠️ 商品 ${product.id} 不可报名，跳过该商品`, 'warning');
          
          // 创建失败记录
          const failedResult = {
            productId: product.id,
            signupId1: '', signupId2: '', signupId3: '', signupId4: '', signupId5: '',
            failReason: '商品不可报名',
            timestamp: new Date().toLocaleString(),
            completedCount: 0
          };
          
          const existingIndex = results.findIndex(r => r.productId === product.id);
          if (existingIndex >= 0) results[existingIndex] = failedResult;
          else results.push(failedResult);
          
          if (event) event.sender.send('signup-realtime-update', failedResult);
          
          break;
        }
        
        if (stopOnError) {
          sendLog(`⚠️ 商品 ${product.id} 报名失败，根据设置停止后续报名`, 'warning');
          taskState.isStopRequested = true;
          break;
        }
      }
      
      const currentResult = {
        productId: product.id,
        signupId1: signupIds[0] || '',
        signupId2: signupIds[1] || '',
        signupId3: signupIds[2] || '',
        signupId4: signupIds[3] || '',
        signupId5: signupIds[4] || '',
        failReason: finalError,
        timestamp: new Date().toLocaleString(),
        completedCount: signupIds.length
      };
      
      const existingIndex = results.findIndex(r => r.productId === product.id);
      if (existingIndex >= 0) results[existingIndex] = currentResult;
      else results.push(currentResult);
      
      if (event) event.sender.send('signup-realtime-update', currentResult);
      sendProgress(i, products.length, round);
      
      if (round < signupCount && !taskState.isStopRequested) {
        await checkShouldStop(taskState, sendLog);
        sendLog('🔄 返回活动报名页，准备下一次报名...', 'info');
        if (page) {
          await page.goto(ACTIVITY_URL);
          await interruptibleSleep(3000, taskState, sendLog);
        }
      }
    }
    
    const successCount = signupIds.filter(id => id).length;
    sendLog(`✅ 商品 ${product.id} 完成 ${successCount}/${signupCount} 次报名`, 'info');
    
    if (!taskState.isStopRequested && i < products.length - 1) {
      await checkShouldStop(taskState, sendLog);
      sendLog('🔄 返回活动报名页，准备下一个商品...', 'info');
      if (page) {
        await page.goto(ACTIVITY_URL);
        await interruptibleSleep(3000, taskState, sendLog);
      }
    }
  }
  
  if (!taskState.isStopRequested) {
    sendLog('🏁 全部报名完成，正在返回活动报名页...', 'info');
    try {
      if (page) {
        await page.goto(ACTIVITY_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await interruptibleSleep(2000, taskState, sendLog);
        sendLog('✅ 已返回活动报名页', 'success');
      }
    } catch (e) {
      sendLog(`⚠️ 返回活动页失败: ${e.message}`, 'warning');
    }
  }	
  console.log('📊 最终 results 数组:', JSON.stringify(results));
  sendComplete(results, totalSignups);
  return results;
}

module.exports = { executeSignup };