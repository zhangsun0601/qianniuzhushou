// tasks/refund.js - 批量退款模块
const { sleep, checkShouldStop, interruptibleSleep, TaskStoppedError } = require('../utils');

// ==================== 处理退款弹窗 ====================
async function handleRefundPopup(page, taskState) {
  try {
    await interruptibleSleep(1000, taskState);
    
    await checkShouldStop(taskState);
    
    const pages = await page.browser().pages();
    const refundPage = pages.find(p => p.url().includes('refund') || p.url().includes('apply'));
    
    if (!refundPage) return true;
    
    await refundPage.bringToFront();
    await interruptibleSleep(500, taskState);
    
    await checkShouldStop(taskState);
    
    const link = await refundPage.$('a[href*="apply.htm"][title="我要退款（无需退货）"]');
    if (link) {
      await link.click();
      await interruptibleSleep(1000, taskState);
    }
    
    await checkShouldStop(taskState);
    
    const addEdit = await refundPage.$('.itemMultiSelectEntrence span');
    if (addEdit) {
      await addEdit.click();
      console.log('1. 已点击添加和编辑');
      await interruptibleSleep(500, taskState);
    }
    
    await checkShouldStop(taskState);
    
    const selectAll = await refundPage.$('.radio-item');
    if (selectAll) {
      await selectAll.click();
      console.log('2. 已点击全选');
      await interruptibleSleep(500, taskState);
    }
    
    await checkShouldStop(taskState);
    
    const submitSelect = await refundPage.$('.button-item.highlight.ml');
    if (submitSelect) {
      await submitSelect.click();
      console.log('3. 已点击提交选择');
      await interruptibleSleep(800, taskState);
    }
    
    await checkShouldStop(taskState);
    
    await selectRefundReason(refundPage, taskState);
    
    for (let i = 0; i < 10; i++) {
      await checkShouldStop(taskState);
      
      const submit = await refundPage.$('.center.button-item.highlight');
      if (submit) {
        await submit.click();
        console.log('已点击提交');
        await interruptibleSleep(800, taskState);
        
        const text = await refundPage.evaluate(() => document.body.innerText);
        if (text.includes('批量仅退款申请成功') || text.includes('请等待商家处理')) {
          await interruptibleSleep(1000, taskState);
          await refundPage.close();
          return true;
        }
      }
      await interruptibleSleep(500, taskState);
    }
    
    await refundPage.close();
    return true;
  } catch (e) {
    console.log('处理退款弹窗出错:', e);
    return true;
  }
}

// ==================== 选择退款原因 ====================
async function selectRefundReason(page, taskState) {
  try {
    await checkShouldStop(taskState);
    
    const hasSelected = await page.evaluate(() => {
      const selected = document.querySelector('.selected-wrap, [class*="selected"]');
      if (selected) {
        const text = selected.textContent;
        if (text && text.trim() !== '' && !text.includes('请选择')) {
          return true;
        }
      }
      return false;
    });
    
    if (hasSelected) {
      console.log('退款原因已选中，跳过');
      return true;
    }
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      await checkShouldStop(taskState);
      
      const arrowClicked = await page.evaluate(() => {
        const arrow = document.querySelector('.arrow-down');
        if (!arrow) return false;
        
        arrow.scrollIntoView({ behavior: 'instant', block: 'center' });
        arrow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
        arrow.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
        arrow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
        arrow.click();
        return true;
      });
      
      if (arrowClicked) {
        console.log(`下拉箭头点击成功 (尝试 ${attempt})`);
        await interruptibleSleep(300, taskState);
        
        for (let optAttempt = 1; optAttempt <= 3; optAttempt++) {
          await checkShouldStop(taskState);
          
          const optionClicked = await page.evaluate(() => {
            const selectors = ['.options-item', '.next-menu-item', '.next-select-menu-item', 'li', '[role="option"]'];
            
            for (const sel of selectors) {
              const opts = document.querySelectorAll(sel);
              if (opts.length > 0) {
                const firstOpt = opts[0];
                firstOpt.scrollIntoView({ behavior: 'instant', block: 'center' });
                firstOpt.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
                firstOpt.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
                firstOpt.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
                firstOpt.click();
                return { success: true, text: firstOpt.textContent.trim() };
              }
            }
            return { success: false };
          });
          
          if (optionClicked.success) {
            console.log(`选项点击成功: ${optionClicked.text} (尝试 ${optAttempt})`);
            await interruptibleSleep(200, taskState);
            return true;
          }
          
          if (optAttempt < 3) {
            await interruptibleSleep(150, taskState);
          }
        }
        
        return false;
      }
      
      if (attempt < 3) {
        await interruptibleSleep(200, taskState);
      }
    }
    
    console.log('选择退款原因失败');
    return false;
  } catch (e) {
    console.log('选择退款原因出错:', e.message);
    return false;
  }
}

// ==================== 获取可退款订单 ====================
async function getRefundableOrders(page) {
  return await page.evaluate(() => {
    const orders = [];
    const containers = document.querySelectorAll('[id^="shopOrderContainer_"]');
    
    for (const container of containers) {
      const idMatch = container.id.match(/\d+/);
      if (!idMatch) continue;
      const orderId = idMatch[0];
      
      const text = container.textContent || container.innerText;
      const isRefunded = text.includes('退款中') || text.includes('退款成功') || text.includes('交易关闭');
      
      if (!isRefunded) {
        const refundBtns = container.querySelectorAll('.trade-button');
        const hasRefundBtn = Array.from(refundBtns).some(btn => btn.textContent.includes('退款'));
        if (hasRefundBtn) {
          orders.push(orderId);
        }
      }
    }
    
    return orders;
  });
}

// ==================== 点击退款按钮 ====================
async function clickRefundButton(page, orderId, taskState, buttonIndex = 0) {
  try {
    await checkShouldStop(taskState);
    
    const clicked = await page.evaluate((id, index) => {
      const container = document.getElementById(`shopOrderContainer_${id}`);
      if (!container) return false;
      
      const refundBtns = container.querySelectorAll('.trade-button');
      const validBtns = Array.from(refundBtns).filter(btn => btn.textContent.includes('退款'));
      
      if (validBtns.length <= index) return false;
      
      const targetBtn = validBtns[index];
      targetBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      targetBtn.click();
      return true;
    }, orderId, buttonIndex);
    
    if (clicked) {
      await interruptibleSleep(1500, taskState);
      const handled = await handleRefundPopup(page, taskState);
      return { success: handled, error: handled ? null : '退款处理失败' };
    }
    
    return { success: false, error: '未找到退款按钮' };
  } catch (e) {
    if (e.name === 'TaskStoppedError') {
      return { success: false, error: '用户停止' };
    }
    return { success: false, error: e.message };
  }
}
    
// ==================== 获取订单的退款按钮数量 ====================
async function getOrderButtonCount(page, orderId) {
  return await page.evaluate((id) => {
    const container = document.getElementById(`shopOrderContainer_${id}`);
    if (!container) return 0;
    const refundBtns = container.querySelectorAll('.trade-button');
    return Array.from(refundBtns).filter(btn => btn.textContent.includes('退款')).length;
  }, orderId);
}

// ==================== 导出 ====================
module.exports = {
  handleRefundPopup,
  selectRefundReason,
  getRefundableOrders,
  clickRefundButton,
  getOrderButtonCount
};