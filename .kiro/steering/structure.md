# 项目结构

## 目录组织

```
qianniu-helper/
├── .kiro/                    # Kiro AI 助手配置目录
│   └── steering/             # 引导规则文档
├── dist/                     # 构建输出目录（打包后的安装包）
├── node_modules/             # npm 依赖包
├── tasks/                    # 任务模块目录
│   ├── signup.js             # 秒杀批量报名模块
│   ├── sku-clean.js          # SKU批量清洗模块
│   ├── status.js             # 营销ID状态检测模块
│   ├── refund.js             # 批量退款模块
│   └── perfect.js            # 批量完善商品模块
├── SKU模板/                  # SKU模板文件夹
├── main.js                   # Electron 主进程入口
├── renderer.js               # 渲染进程脚本（UI逻辑）
├── preload.js                # 预加载脚本（IPC桥接）
├── browser.js                # 浏览器管理模块
├── utils.js                  # 工具函数模块
├── index.html                # 应用主界面
├── package.json              # 项目配置和依赖
└── package-lock.json         # 依赖锁定文件
```

## 核心文件说明

### 主进程文件
- **main.js**: Electron 主进程，负责：
  - 创建应用窗口
  - 管理浏览器实例（browser, page）
  - 处理所有 IPC 通信
  - 管理任务状态（taskState）
  - 导出Excel结果

### 渲染进程文件
- **renderer.js**: 前端逻辑，负责：
  - DOM 操作和事件绑定
  - 用户输入解析
  - 实时日志显示
  - 进度更新
  - 任务面板切换

- **index.html**: 用户界面，包含：
  - 任务选择器
  - 5个功能面板（秒杀报名、SKU清洗、状态检测、批量退款、完善商品）
  - 统计卡片
  - 日志区域

- **preload.js**: 安全桥接层，暴露 IPC API 到渲染进程

### 浏览器管理
- **browser.js**: 浏览器控制模块，负责：
  - 自动查找 Edge/Chrome 浏览器路径
  - 启动和关闭浏览器
  - 管理用户数据目录
  - 定义活动页面URL常量

### 工具模块
- **utils.js**: 通用工具函数，包含：
  - `sleep()`: 延时函数
  - `safeInput()`: 安全输入函数
  - `checkShouldStop()`: 停止状态检查
  - `interruptibleSleep()`: 可中断延时
  - `TaskStoppedError`: 自定义错误类

### 任务模块（tasks/）
每个任务模块都是独立的功能单元：

- **signup.js**: 秒杀报名逻辑
  - `signupOnce()`: 单次报名流程
  - `executeBatchSetting()`: 批量价格设置
  - `executeActivityPriceSetting()`: 活动价设置
  - `executeSignup()`: 批量报名主函数

- **sku-clean.js**: SKU清洗逻辑
- **status.js**: 状态检测逻辑
- **refund.js**: 退款逻辑
- **perfect.js**: 完善商品逻辑

## 代码组织规范

### 模块导出模式
```javascript
// CommonJS 模块系统
const { module1, module2 } = require('./path');

module.exports = {
  function1,
  function2
};
```

### 任务状态管理
全局 `taskState` 对象：
```javascript
{
  isStopRequested: false,    // 是否请求停止
  isPaused: false,           // 是否暂停
  pauseResolve: { resolve: null },  // 暂停恢复回调
  currentTaskType: null      // 当前任务类型
}
```

### IPC 通信命名规范
- **Handle**: `execute-{task}`, `check-{action}`, `export-{type}-results`
- **Send**: `{task}-log`, `{task}-progress`, `{task}-complete`

### 日志类型
- `info`: 普通信息（默认颜色）
- `success`: 成功信息（绿色）
- `warning`: 警告信息（橙色）
- `error`: 错误信息（红色）

## 数据流向

```
用户输入 (index.html)
    ↓
渲染进程 (renderer.js)
    ↓ IPC invoke
主进程 (main.js)
    ↓ 调用任务模块
任务模块 (tasks/*.js)
    ↓ 使用浏览器
浏览器控制 (browser.js + puppeteer)
    ↓ 实时反馈
主进程发送日志/进度
    ↓ IPC send
渲染进程更新UI
```

## 文件命名约定
- 模块文件：小写字母 + 连字符（kebab-case）
  - 例如：`sku-clean.js`, `browser.js`
- 任务模块：放在 `tasks/` 目录下
- 配置文件：标准名称（`package.json`, `index.html`）

## 关键URL常量
定义在 `browser.js` 中：
- `ACTIVITY_URL`: 秒杀活动报名页面
- `STATUS_CHECK_URL`: 营销ID状态检测页面
