# 技术栈

## 核心框架
- **Electron 28.0.0**: 桌面应用框架，用于构建跨平台桌面应用
- **Node.js**: 运行时环境（CommonJS模块系统）

## 主要依赖库

### 浏览器自动化
- **puppeteer-core 21.0.0**: 无头浏览器控制库，用于自动化操作淘宝千牛后台
  - 支持 Chrome 和 Edge 浏览器
  - 使用独立的用户数据目录保持登录状态
  - 远程调试端口：9222

### 数据处理
- **xlsx 0.18.5**: Excel文件读写库，用于导入商品列表和导出结果

### 开发工具
- **electron-builder 24.13.3**: 用于打包和分发应用
  - 目标平台：Windows (NSIS安装包)
  - 支持自定义安装目录
  - 创建桌面快捷方式和开始菜单快捷方式

## 构建系统

### 常用命令
```bash
# 开发模式启动
npm start

# 打包应用（生成Windows安装包）
npm run build
```

### 打包配置
- **输出目录**: `dist/`
- **应用ID**: `com.qianniu.helper`
- **产品名称**: 千牛工作助手
- **安装包类型**: NSIS (Windows)
- **安装选项**: 
  - 非一键安装（用户可选择安装路径）
  - 创建桌面快捷方式
  - 创建开始菜单快捷方式

## 浏览器配置

### 自动查找浏览器
优先级顺序：
1. Microsoft Edge (推荐)
   - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
   - `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
2. Google Chrome (备选)
   - `C:\Program Files\Google\Chrome\Application\chrome.exe`
   - `%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe`
3. 手动选择（如果自动查找失败）

### 浏览器启动参数
```javascript
[
  '--start-maximized',              // 最大化窗口
  '--no-sandbox',                   // 禁用沙箱
  '--disable-dev-shm-usage',        // 禁用共享内存
  '--disable-gpu',                  // 禁用GPU加速
  '--disable-blink-features=AutomationControlled',  // 隐藏自动化特征
  '--remote-debugging-port=9222'    // 远程调试端口
]
```

## 架构模式

### 进程通信
- **主进程 (main.js)**: 管理应用生命周期、浏览器实例、IPC通信
- **渲染进程 (renderer.js)**: 处理UI交互和用户输入
- **预加载脚本 (preload.js)**: 安全地暴露IPC API到渲染进程

### IPC通信模式
- 使用 `ipcMain.handle()` 和 `ipcRenderer.invoke()` 进行双向通信
- 使用 `event.sender.send()` 进行实时日志和进度更新

## 安全配置
```javascript
webPreferences: {
  nodeIntegration: false,      // 禁用Node集成（安全）
  contextIsolation: true,      // 启用上下文隔离（安全）
  preload: 'preload.js',       // 使用预加载脚本
  devTools: true               // 启用开发者工具
}
```

## 文件编码
- 所有文本文件使用 **UTF-8** 编码
- 支持读取 UTF-8 编码的 .txt 和 .csv 文件
