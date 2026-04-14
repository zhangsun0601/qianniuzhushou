// tasks/sku-clean.js - SKU清洗模块
const path = require('path');
const fs = require('fs');
const { sleep, checkShouldStop, interruptibleSleep, TaskStoppedError } = require('../utils');

// ==================== SKU清洗辅助函数 ====================

// 标准SKU：添加 .1 后缀
async function addSuffixToStandardSkuInPage(page, sectionId) {
  return await page.evaluate((sectionId) => {
    return new Promise((resolve) => {
      const itemSelector = '#' + sectionId + ' .sell-component-common-sale-props-option-item:first-child';
      const firstItem = document.querySelector(itemSelector);
      if (!firstItem) {
        resolve(false);
        return;
      }
      
      const input = firstItem.querySelector('input[role="combobox"]');
      if (!input) {
        resolve(false);
        return;
      }
      
      const currentValue = input.value;
      if (currentValue.trim() === '' || currentValue.endsWith('.1')) {
        resolve(false);
        return;
      }
      
      input.focus();
      input.select();
      
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, currentValue + '.1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      setTimeout(() => {
        input.blur();
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log(`✅ "${currentValue}" → "${currentValue}.1"`);
        resolve(true);
      }, 100);
    });
  }, sectionId);
}

// 颜色分类：添加 .1 后缀
async function addSuffixToColorSkuInPage(page, sectionId) {
  console.log(`🔍 [主进程] 开始处理颜色分类, sectionId: ${sectionId}`);
  
  const result = await page.evaluate((sectionId) => {
    return new Promise((resolve) => {
      const colorItem = document.querySelector(`#${sectionId} .color-sub-items`);
      if (!colorItem) {
        console.log('❌ 未找到颜色分类元素');
        resolve(false);
        return;
      }
      
      const input = colorItem.querySelector('input');
      if (!input) {
        console.log('❌ 未找到颜色分类输入框');
        resolve(false);
        return;
      }
      
      const currentValue = input.value;
      if (currentValue.trim() === '' || currentValue.endsWith('.1')) {
        console.log(`⚠️ 跳过: "${currentValue}"`);
        resolve(false);
        return;
      }
      
      console.log(`📊 当前值: "${currentValue}"`);
      const newValue = currentValue + '.1';
      
      input.focus();
      input.select();
      
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, newValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      
      setTimeout(() => {
        input.blur();
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log(`✅ "${currentValue}" → "${newValue}"`);
        resolve(true);
      }, 100);
    });
  }, sectionId);
  
  console.log(`🔍 [主进程] 颜色分类处理结果: ${result}`);
  return result;
}

// 测量SKU：添加 .1 后缀
async function addSuffixToMeasurementSkuInPage(page, sectionId) {
  console.log(`🔍 [主进程] 开始处理测量SKU, sectionId: ${sectionId}`);
  
  await page.screenshot({ path: 'debug_before_click.png' });
  console.log('📸 已截图: debug_before_click.png');
  
  const result = await page.evaluate((sectionId) => {
    return new Promise((resolve) => {
      console.log('🔍 [浏览器] 开始执行');
      
      const section = document.getElementById(sectionId);
      if (!section) {
        console.log('❌ 未找到区块:', sectionId);
        resolve(false);
        return;
      }
      console.log('✅ 找到区块');
      
      const firstItem = section.querySelector('.sell-measurement-sale-props-item');
      if (!firstItem) {
        console.log('❌ 未找到测量SKU项');
        resolve(false);
        return;
      }
      console.log('✅ 找到测量SKU项');
      
      const overlay = firstItem.querySelector('.overlay');
      if (!overlay) {
        console.log('⚠️ 未找到 overlay');
        resolve(false);
        return;
      }
      console.log('✅ 找到 overlay');
      
      console.log('📌 点击 overlay 展开...');
      overlay.click();
      
      setTimeout(() => {
        console.log('📌 等待面板出现...');
        
        const itemContainer = document.querySelector('.item-container');
        if (!itemContainer) {
          console.log('❌ 未找到 .item-container');
          document.body.click();
          resolve(false);
          return;
        }
        console.log('✅ 找到 .item-container');
        
        const numberInput = itemContainer.querySelector('input[placeholder*="小数点"]');
        if (!numberInput) {
          console.log('❌ 未找到数字输入框');
          document.body.click();
          resolve(false);
          return;
        }
        console.log('✅ 找到数字输入框，当前值:', numberInput.value);
        
        const currentValue = numberInput.value;
        const currentNum = parseFloat(currentValue);
        
        if (isNaN(currentNum)) {
          console.log(`⚠️ 当前值不是数字: "${currentValue}"`);
          document.body.click();
          resolve(false);
          return;
        }
        
        const newValue = currentNum + 0.1;
        const formattedNewValue = Math.round(newValue * 10) / 10;
        console.log(`🔢 将数字: "${currentValue}" → "${formattedNewValue}"`);
        
        numberInput.focus();
        numberInput.select();
        
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(numberInput, formattedNewValue.toString());
        numberInput.dispatchEvent(new Event('input', { bubbles: true }));
        numberInput.dispatchEvent(new Event('change', { bubbles: true }));
        numberInput.dispatchEvent(new Event('blur', { bubbles: true }));
        
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        });
        numberInput.dispatchEvent(enterEvent);
        
        setTimeout(() => {
          document.body.click();
          console.log('✅ 已关闭弹窗');
          
          setTimeout(() => {
            const specInput = firstItem.querySelector('input[placeholder="规格"]');
            if (specInput) {
              console.log(`📊 验证结果: 规格值 = "${specInput.value}"`);
              if (specInput.value.includes(formattedNewValue.toString())) {
                console.log('✅ 修改成功！');
                resolve(true);
              } else {
                console.log('❌ 修改失败');
                resolve(false);
              }
            } else {
              console.log('❌ 未找到规格输入框验证');
              resolve(false);
            }
          }, 500);
        }, 300);
      }, 1000);
    });
  }, sectionId);
  
  await page.screenshot({ path: 'debug_after_click.png' });
  console.log('📸 已截图: debug_after_click.png');
  
  console.log(`🔍 [主进程] 测量SKU处理结果: ${result}`);
  return result;
}

// 处理确认弹窗
async function handleConfirmDialog(page) {
  for (let retry = 0; retry < 20; retry++) {
    const confirmBtn = await page.$('.next-dialog .next-btn-primary');
    if (confirmBtn) {
      const isVisible = await page.evaluate(btn => {
        return btn.offsetParent !== null;
      }, confirmBtn);
      
      if (isVisible) {
        console.log('✅ 点击确认按钮');
        await confirmBtn.click();
        await sleep(300);
        return true;
      }
    }
    await sleep(200);
  }
  console.log('⚠️ 未找到确认弹窗');
  return false;
}

// 等待页面加载
async function waitForPageLoad(page) {
  console.log('📋 等待页面加载...');
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 });
  await sleep(2000);
  console.log('   ✅ 页面加载完成');
}

// 跳转到发布页面
async function jumpToPublishPage(page, itemId) {
  const url = `https://item.upload.taobao.com/sell/v2/publish.htm?itemId=${itemId}`;
  console.log(`📍 跳转到: ${url}`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  
  if (page.url().includes('login')) {
    console.log('⏳ 检测到需要登录，请在浏览器中登录...');
    while (page.url().includes('login')) {
      await sleep(2000);
    }
    console.log('✅ 登录完成，继续执行');
  }
  
  await waitForPageLoad(page);
  return true;
}

// 定位模板区域
async function locateTemplateArea(page) {
  const templateContainer = await page.$('#template-sale');
  if (templateContainer) return true;
  const fallback = await page.$('.sell-component-block-template');
  return !!fallback;
}

// 打开模板下拉菜单
async function openTemplateDropdown(page) {
  const dropdown = await page.$('#template-sale .next-select');
  if (!dropdown) return false;
  const isExpanded = await page.evaluate(el => el.getAttribute('aria-expanded') === 'true', dropdown);
  if (isExpanded) return true;
  await dropdown.click();
  await sleep(500);
  return true;
}

// 删除所有模板
async function deleteAllTemplates(page) {
  console.log('🗑️ 开始删除所有模板...');
  
  const dropdown = await page.$('#template-sale .next-select');
  if (!dropdown) {
    console.log('❌ 未找到下拉框');
    return false;
  }
  
  const isExpanded = await page.evaluate(el => el.getAttribute('aria-expanded') === 'true', dropdown);
  if (!isExpanded) {
    console.log('📂 展开下拉菜单...');
    await dropdown.click();
    await sleep(500);
  }
  
  let maxLoops = 30;
  let loops = 0;
  
  while (loops < maxLoops) {
    const deleteButtons = await page.$$('svg[title="删除"]');
    
    if (deleteButtons.length === 0) {
      console.log('✅ 所有模板已删除');
      break;
    }
    
    console.log(`剩余 ${deleteButtons.length} 个模板`);
    
    const parentLi = await deleteButtons[0].$('xpath=ancestor::li[contains(@class, "sell-component-block-template-item")]');
    let templateName = '未知';
    if (parentLi) {
      templateName = await page.evaluate(el => el.getAttribute('title'), parentLi);
    }
    console.log(`👉 正在删除模板: ${templateName}`);
    
    await page.evaluate((btn) => {
      const rect = btn.getBoundingClientRect();
      const events = ['mouseenter', 'mousedown', 'mouseup', 'click'];
      for (const eventType of events) {
        const event = new MouseEvent(eventType, {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 5,
          clientY: rect.top + 5
        });
        btn.dispatchEvent(event);
      }
    }, deleteButtons[0]);
    
    await sleep(200);
    await handleConfirmDialog(page);
    await sleep(200);
    
    loops++;
  }
  
  const remaining = await page.$$('svg[title="删除"]');
  console.log(`删除完成，剩余模板数: ${remaining.length}`);
  return remaining.length === 0;
}

// 创建模板
async function createTemplate(page, templateName) {
  console.log('========== 创建模板 ==========');
  
  const saveBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.next-btn-helper'));
    const btn = btns.find(b => b.innerText === '存为新模板');
    if (btn) return btn.closest('button');
    return null;
  });
  
  if (!saveBtn) {
    console.log('❌ 未找到存为新模板按钮');
    return false;
  }
  
  await saveBtn.click();
  console.log('✅ 已点击存为新模板');
  await sleep(500);
  
  await page.waitForSelector('#templateName', { timeout: 5000 });
  
  console.log(`👉 输入模板名称: ${templateName}`);
  
  await page.click('#templateName', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  
  for (const char of templateName) {
    await page.keyboard.type(char);
    await sleep(50);
  }
  
  await sleep(300);
  
  const confirmBtn = await page.$('.next-dialog .next-btn-primary');
  if (confirmBtn) {
    console.log('👉 点击确定按钮');
    await confirmBtn.click();
    await sleep(500);
    console.log('✅ 模板创建完成');
    return true;
  }
  
  return false;
}

// 点击批量导入
async function clickBatchImport(page) {
  const btn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.next-btn-helper'));
    const btn = btns.find(b => b.innerText === '批量导入');
    if (btn) return btn.closest('button');
    return null;
  });
  if (!btn) return false;
  await btn.click();
  await sleep(500);
  return true;
}

// 切换到模板上传
async function switchToTemplateUpload(page) {
  const tab = await page.evaluateHandle(() => {
    const tabs = Array.from(document.querySelectorAll('.next-tabs-tab-inner'));
    return tabs.find(t => t.innerText === '模板上传');
  });
  if (!tab) return false;
  await tab.click();
  await sleep(500);
  return true;
}

// 关闭弹窗
async function closeDialog(page) {
  const closeIcon = await page.$('.next-dialog-close');
  if (closeIcon) {
    await closeIcon.click();
    await sleep(500);
    return true;
  }
  const cancelBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.next-btn-helper'));
    const btn = btns.find(b => b.innerText === '取消');
    if (btn) return btn.closest('button');
    return null;
  });
  if (cancelBtn) {
    await cancelBtn.click();
    await sleep(500);
    return true;
  }
  return false;
}

// 提交并处理错误
async function submitAndHandleError(page) {
  console.log('🔍 submitAndHandleError 被调用');
  
  async function clickSubmitButton() {
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.innerText === '提交宝贝信息');
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    });
    
    if (!clicked) {
      console.log('❌ 未找到提交宝贝信息按钮');
      return false;
    }
    
    console.log('✅ 已点击提交宝贝信息');
    return true;
  }
  
  async function hasRequiredError() {
    return await page.evaluate(() => {
      const errorElements = document.querySelectorAll('.sell-component-info-wrapper-msg-content.error');
      for (const el of errorElements) {
        if (el.innerText && el.innerText.includes('必填项不能为空')) {
          return true;
        }
      }
      return false;
    });
  }
  
  async function enableMultiDiscount() {
    return await page.evaluate(() => {
      const multiDiscountSection = document.getElementById('sell-field-multiDiscountPromotion');
      if (!multiDiscountSection) {
        console.log('❌ 未找到多件优惠区块');
        return false;
      }
      
      const checkbox = multiDiscountSection.querySelector('.next-checkbox-input');
      if (!checkbox) {
        console.log('❌ 未找到启用复选框');
        return false;
      }
      
      if (checkbox.checked) {
        console.log('ℹ️ 多件优惠已经启用，无需操作');
        return true;
      }
      
      console.log('🖱️ 点击启用按钮...');
      const label = checkbox.closest('.next-checkbox-wrapper');
      if (label) {
        label.click();
      } else {
        checkbox.click();
      }
      
      setTimeout(() => {}, 300);
      return true;
    });
  }
  
  console.log('📤 第1次点击提交宝贝信息');
  const firstClick = await clickSubmitButton();
  if (!firstClick) return false;
  
  await sleep(1500);
  
  const hasError = await hasRequiredError();
  
  if (!hasError) {
    console.log('✅ 没有检测到必填项错误，等待页面刷新...');
    const currentUrl = page.url();
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      if (page.url() !== currentUrl) {
        console.log(`✅ 页面已刷新`);
        return true;
      }
    }
    console.log('⚠️ 等待超时，页面未刷新');
    return false;
  }
  
  console.log('⚠️ 检测到"必填项不能为空"错误，正在启用多件优惠...');
  const enabled = await enableMultiDiscount();
  
  if (!enabled) {
    console.log('❌ 启用多件优惠失败');
    return false;
  }
  
  await sleep(800);
  
  console.log('📤 第2次点击提交宝贝信息（多件优惠已启用）');
  const secondClick = await clickSubmitButton();
  if (!secondClick) return false;
  
  const currentUrl = page.url();
  console.log(`⏳ 等待页面刷新...`);
  
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (page.url() !== currentUrl) {
      console.log(`✅ 页面已刷新，提交成功`);
      return true;
    }
  }
  
  console.log('⚠️ 等待超时，页面未刷新');
  return false;
}

// 关闭成功弹窗
async function closeSuccessDialog(page) {
  const closeBtn = await page.$('.next-dialog-close');
  if (closeBtn) {
    await closeBtn.click();
    await sleep(500);
  }
  return true;
}

// 选择模板
async function selectTemplate(page) {
  console.log('📋 选择模板"1"...');
  
  const dropdown = await page.$('#template-sale .next-select');
  if (!dropdown) {
    console.log('❌ 未找到模板下拉框');
    return false;
  }
  
  const isExpanded = await page.evaluate(el => el.getAttribute('aria-expanded') === 'true', dropdown);
  if (!isExpanded) {
    console.log('📂 展开下拉菜单');
    await dropdown.click();
    await sleep(300);
  }
  
  const options = await page.$$('.sell-component-block-template-item');
  console.log(`找到 ${options.length} 个模板选项`);
  
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const title = await page.evaluate(el => el.getAttribute('title'), opt);
    console.log(`模板 ${i}: title="${title}"`);
    
    if (title === '1') {
      console.log('✅ 找到目标模板，准备点击名称区域');
      const nameSpan = await opt.$('span:first-child');
      if (nameSpan) {
        await nameSpan.click();
        await sleep(500);
        console.log('✅ 模板选择完成');
        return true;
      } else {
        console.log('⚠️ 未找到名称span，尝试点击整个选项');
        await opt.click();
        await sleep(500);
        return true;
      }
    }
  }
  
  console.log('❌ 未找到模板"1"');
  return false;
}

// 查找模板文件
function findTemplateFile(itemId, app) {
  // 优先从桌面查找
  const desktopPath = path.join(require('os').homedir(), 'Desktop', '千牛工作助手', 'SKU模板');
  
  // 备选：从用户数据目录查找
  const userDataPath = path.join(app.getPath('userData'), 'SKU模板');
  
  const searchPaths = [desktopPath, userDataPath];
  
  for (const templateDir of searchPaths) {
    console.log(`📁 查找模板目录: ${templateDir}`);
    
    if (!fs.existsSync(templateDir)) {
      console.log(`   ❌ 目录不存在`);
      continue;
    }
    
    const files = fs.readdirSync(templateDir);
    const patterns = [`${itemId}_SKU模板.xlsx`, `${itemId}_SKU模板.xls`];
    
    for (const pattern of patterns) {
      const found = files.find(f => f === pattern);
      if (found) {
        console.log(`   ✅ 找到模板: ${found}`);
        return path.join(templateDir, found);
      }
    }
    console.log(`   ⚠️ 未找到 ${itemId}_SKU模板.xlsx 或 .xls`);
  }
  
  return null;
}
// 上传模板文件
async function uploadTemplateFile(page, filePath) {
  console.log(`📎 上传模板文件: ${filePath}`);
  
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    console.log('❌ 未找到文件上传控件');
    return false;
  }
  
  await fileInput.uploadFile(filePath);
  await sleep(1000);
  
  const confirmBtn = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.next-btn-helper'));
    const btn = btns.find(b => b.innerText === '确认识别');
    if (btn) return btn.closest('button');
    return null;
  });
  
  if (confirmBtn) {
    await confirmBtn.click();
    await sleep(1000);
    return true;
  }
  
  return false;
}

// 添加产品到所有SKU
async function addProductToAllSKU(page) {
  console.log('📜 滚动到页面底部...');
  await page.evaluate(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  });
  await sleep(1000);
  
  let processedCount = 0;
  let maxAttempts = 50;
  
  while (processedCount < maxAttempts) {
    const productButtons = await page.$$('.sell-component-sku-combine-cell .view-action');
    if (productButtons.length === 0) break;
    
    console.log(`处理第 ${processedCount + 1} 个 SKU`);
    
    await page.evaluate((index) => {
      const btns = document.querySelectorAll('.sell-component-sku-combine-cell .view-action');
      if (btns[index]) {
        btns[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, processedCount);
    await sleep(500);
    
    await productButtons[0].click();
    await sleep(300);
    
    const addBtnClicked = await page.evaluate(() => {
      const addBtn = Array.from(document.querySelectorAll('.next-btn-helper'))
        .find(btn => btn.innerText === '添加');
      if (addBtn) {
        addBtn.closest('button').click();
        return true;
      }
      return false;
    });
    
    if (!addBtnClicked) {
      processedCount++;
      continue;
    }
    await sleep(500);
    
    const searchInputClicked = await page.evaluate(() => {
      const searchInputs = document.querySelectorAll('.sku-combine-product-select input[role="combobox"]');
      const searchInput = searchInputs[searchInputs.length - 1];
      if (searchInput) {
        searchInput.click();
        return true;
      }
      return false;
    });
    
    if (!searchInputClicked) {
      processedCount++;
      continue;
    }
    await sleep(300);
    
    let productFound = false;
    
    productFound = await page.evaluate(() => {
      const items = document.querySelectorAll('.item-block');
      for (const item of items) {
        const titleEl = item.querySelector('.title');
        if (titleEl && titleEl.innerText && titleEl.innerText.includes('包含SKU展示商品')) {
          item.click();
          return true;
        }
      }
      return false;
    });
    
    if (productFound) {
      console.log('✅ 直接从产品列表找到并点击');
    } else {
      console.log('🔍 产品列表中未找到，开始搜索...');
      
      await page.evaluate(() => {
        const searchInputs = document.querySelectorAll('.sku-combine-product-select input[role="combobox"]');
        const searchInput = searchInputs[searchInputs.length - 1];
        if (searchInput) {
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeSetter.call(searchInput, '包含');
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      
      await sleep(500);
      
      const searchResultFound = await page.evaluate(() => {
        return new Promise((resolve) => {
          let attempts = 0;
          const maxAttempts = 25;
          
          const checkResult = () => {
            attempts++;
            const items = document.querySelectorAll('.item-block');
            for (const item of items) {
              const titleEl = item.querySelector('.title');
              if (titleEl && titleEl.innerText && titleEl.innerText.includes('包含SKU展示商品')) {
                resolve(true);
                return;
              }
            }
            
            if (attempts >= maxAttempts) {
              resolve(false);
            } else {
              setTimeout(checkResult, 200);
            }
          };
          
          checkResult();
        });
      });
      
      if (searchResultFound) {
        console.log('✅ 搜索结果已加载');
        await sleep(300);
        
        await page.evaluate(() => {
          const items = document.querySelectorAll('.item-block');
          for (const item of items) {
            const titleEl = item.querySelector('.title');
            if (titleEl && titleEl.innerText && titleEl.innerText.includes('包含SKU展示商品')) {
              item.click();
              return true;
            }
          }
          return false;
        });
      } else {
        console.log('❌ 搜索结果加载超时，未找到');
      }
    }
    
    await sleep(300);
    
    await page.evaluate(() => {
      const confirmBtn = Array.from(document.querySelectorAll('.next-btn-helper'))
        .find(btn => btn.innerText === '确定');
      if (confirmBtn) {
        confirmBtn.closest('button').click();
      }
    });
    
    processedCount++;
    await sleep(300);
  }
  
  console.log(`✅ 共处理了 ${processedCount} 个 SKU`);
  return true;
}

// 清洗单个商品
async function cleanSingleProduct(itemId, sendLog, page, browser, taskState, app) {
  console.log(`🔍 cleanSingleProduct 被调用, itemId: ${itemId}`);
  sendLog(`\n========== 开始清洗商品: ${itemId} ==========`, 'info');
  
  try {
    await checkShouldStop(taskState, sendLog);
    
    sendLog('📍 Step 1: 跳转到商品发布页面...', 'info');
    await jumpToPublishPage(page, itemId);
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('📋 Step 2: 准备工作...', 'info');
    await locateTemplateArea(page);
    await openTemplateDropdown(page);
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('🗑️ 删除所有现有模板...', 'info');
    await deleteAllTemplates(page);
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('✨ 创建模板"1"...', 'info');
    await createTemplate(page, '1');
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('✏️ 修改SKU...', 'info');
    
    try {
      const sectionsInfo = await page.evaluate(() => {
        const sections = [];
        const allSections = document.querySelectorAll('.common-wrap');
        
        for (const section of allSections) {
          const standardItems = section.querySelectorAll('.sell-component-common-sale-props-option-item');
          const measurementItems = section.querySelectorAll('.sell-measurement-sale-props-item');
          const colorItems = section.querySelectorAll('.color-sub-items');
          
          let skuType = null;
          let skuCount = 0;
          
          if (standardItems.length > 0) {
            skuType = 'standard';
            skuCount = standardItems.length;
          } else if (measurementItems.length > 0) {
            skuType = 'measurement';
            skuCount = measurementItems.length;
          } else if (colorItems.length > 0) {
            skuType = 'color';
            skuCount = colorItems.length;
          }
          
          if (skuType && skuCount > 0) {
            const labelSpan = section.querySelector('.props-label');
            const sectionName = labelSpan ? labelSpan.innerText.replace(/\(\d+\)/, '').trim() : '未知';
            
            sections.push({
              id: section.id,
              name: sectionName,
              type: skuType,
              count: skuCount
            });
          }
        }
        return sections;
      });
      
      sendLog(`📊 检测到 ${sectionsInfo.length} 个SKU区块`, 'info');
      
      for (const section of sectionsInfo) {
        await checkShouldStop(taskState, sendLog);
        sendLog(`  处理区块: ${section.name} (${section.type}, ${section.count}个SKU)`, 'info');
        
        if (section.count <= 1) {
          sendLog(`    ✅ 只有1个SKU，无需删除`, 'info');
          continue;
        }
        
        let deleteSelector = '';
        if (section.type === 'standard') {
          deleteSelector = `#${section.id} .sell-component-common-sale-props-option-item`;
        } else if (section.type === 'measurement') {
          deleteSelector = `#${section.id} .sell-measurement-sale-props-item`;
        } else {
          deleteSelector = `#${section.id} .color-sub-items`;
        }
        
        const deleteResult = await page.evaluate((selector) => {
          return new Promise((resolve) => {
            let deleted = 0;
            const deleteItems = () => {
              const items = document.querySelectorAll(selector);
              if (items.length <= 1) {
                resolve(deleted);
                return;
              }
              
              const deleteBtn = items[items.length - 1].querySelector('.color-delete-icon');
              if (deleteBtn && deleteBtn.offsetParent !== null && !deleteBtn.disabled) {
                deleteBtn.click();
                deleted++;
                setTimeout(deleteItems, 300);
              } else {
                resolve(deleted);
              }
            };
            deleteItems();
          });
        }, deleteSelector);
        
        sendLog(`    ✅ 删除了 ${deleteResult} 个SKU`, 'success');
        await interruptibleSleep(500, taskState, sendLog);
      }
      
      await checkShouldStop(taskState, sendLog);
      sendLog(`  📋 开始添加后缀`, 'info');
      
      const measurementSections = await page.evaluate(() => {
        const sections = [];
        const allSections = document.querySelectorAll('.common-wrap');
        for (const section of allSections) {
          if (section.querySelector('.sell-measurement-sale-props-item')) {
            sections.push({ id: section.id, type: 'measurement', name: '测量SKU' });
          }
        }
        return sections;
      });
      
      const otherSections = await page.evaluate(() => {
        const sections = [];
        const allSections = document.querySelectorAll('.common-wrap');
        for (const section of allSections) {
          if (section.querySelector('.sell-measurement-sale-props-item')) continue;
          
          const colorItem = section.querySelector('.color-sub-items');
          const standardItem = section.querySelector('.sell-component-common-sale-props-option-item');
          
          if (colorItem) {
            const colorInput = colorItem.querySelector('input');
            const hasValue = colorInput && colorInput.value && colorInput.value.trim() !== '';
            if (hasValue) {
              sections.push({ id: section.id, type: 'color', name: '颜色分类' });
            }
          } else if (standardItem) {
            sections.push({ id: section.id, type: 'standard', name: '标准SKU' });
          }
        }
        return sections;
      });
      
      if (measurementSections.length > 0) {
        for (const section of measurementSections) {
          await checkShouldStop(taskState, sendLog);
          sendLog(`  处理测量SKU区块: ${section.name}`, 'info');
          const success = await addSuffixToMeasurementSkuInPage(page, section.id);
          if (success) {
            sendLog(`    ✅ 后缀添加成功`, 'success');
          } else {
            sendLog(`    ❌ 后缀添加失败`, 'error');
          }
        }
      }
      
      if (otherSections.length > 0) {
        for (const section of otherSections) {
          await checkShouldStop(taskState, sendLog);
          sendLog(`  处理${section.name}区块: ${section.name}`, 'info');
          let success = false;
          if (section.type === 'standard') {
            success = await addSuffixToStandardSkuInPage(page, section.id);
          } else if (section.type === 'color') {
            success = await addSuffixToColorSkuInPage(page, section.id);
          }
          if (success) {
            sendLog(`    ✅ 后缀添加成功`, 'success');
          } else {
            sendLog(`    ❌ 后缀添加失败`, 'error');
          }
        }
      }
      
      if (measurementSections.length === 0 && otherSections.length === 0) {
        sendLog(`  ⚠️ 未找到任何SKU区块`, 'warning');
      }
      
    } catch (e) {
      sendLog(`⚠️ SKU修改出错: ${e.message}，尝试继续`, 'warning');
    }
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('📤 Step 4: 第一次提交...', 'info');
    try {
      await submitAndHandleError(page);
    } catch (e) {
      sendLog(`⚠️ 提交时出现错误，继续执行: ${e.message}`, 'warning');
    }
    sendLog('✅ 第一次提交完成', 'success');
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('🔄 Step 5: 刷新页面...', 'info');
    try {
      await closeSuccessDialog(page);
      await interruptibleSleep(500, taskState, sendLog);
      await jumpToPublishPage(page, itemId);
    } catch (e) {
      sendLog(`⚠️ 刷新页面时出现错误: ${e.message}，尝试继续`, 'warning');
      const pages = await browser.pages();
      page = pages.find(p => p.url().includes('item.upload.taobao.com')) || pages[0];
      await interruptibleSleep(1000, taskState, sendLog);
    }
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('📋 Step 6: 应用模板"1"...', 'info');
    await openTemplateDropdown(page);
    await selectTemplate(page);
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('📂 Step 7: 第二次批量导入...', 'info');
    await clickBatchImport(page);
    await switchToTemplateUpload(page);
    
    const templateFile = findTemplateFile(itemId, app);
    if (!templateFile) {
      sendLog(`⚠️ 未找到模板文件: ${itemId}_SKU模板.xlsx 或 .xls，跳过该商品`, 'warning');
      return { success: false, itemId, error: '模板文件不存在' };
    }
    
    sendLog(`📎 上传模板文件: ${path.basename(templateFile)}`, 'info');
    await uploadTemplateFile(page, templateFile);
    
    await checkShouldStop(taskState, sendLog);
    
    sendLog('🏷️ Step 8: 添加产品并最终提交...', 'info');
    await addProductToAllSKU(page);
    await submitAndHandleError(page);
    sendLog('✅ 第二次提交成功', 'success');
    
    await checkShouldStop(taskState, sendLog);
    
    await closeSuccessDialog(page);
    sendLog(`🎉 商品 ${itemId} 清洗完成！`, 'success');
    return { success: true, itemId, error: null };
    
  } catch (error) {
    if (error.name === 'TaskStoppedError') {
      sendLog('⏹️ 任务已停止', 'warning');
      return { success: false, itemId, error: '用户停止' };
    }
    sendLog(`❌ 清洗失败: ${error.message}`, 'error');
    return { success: false, itemId, error: error.message };
  }
}

// 批量SKU清洗
async function executeSkuClean(products, sendLog, sendProgress, sendComplete, page, browser, taskState, app) {
  console.log('🔍 executeSkuClean 被调用，商品数量:', products.length);
  sendLog('🔍 开始执行 SKU 清洗...', 'info');
  
  let results = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < products.length && !taskState.isStopRequested; i++) {
    await checkShouldStop(taskState, sendLog);
    
    console.log(`🔍 处理第 ${i+1} 个商品, ID: ${products[i].id}`);
    sendLog(`🔍 正在处理商品 ${i+1}/${products.length}...`, 'info');
    
    const product = products[i];
    sendProgress(i, products.length, 0);
    
    const result = await cleanSingleProduct(product.id, sendLog, page, browser, taskState, app);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    results.push({
      productId: product.id,
      status: result.success ? '成功' : '失败',
      error: result.error || '',
      timestamp: new Date().toLocaleString()
    });
  }
  
  sendComplete(results, successCount, failCount);
  return results;
}

// ==================== 导出 ====================
module.exports = {
  executeSkuClean
};