# Wiki Hub 开发变更记录 — 2026-05-11

## Feature

### 1. Markdown 渲染管线重写 (`hub/app.js`)

- code block 输出结构化 `<pre>` + `.code-block-header`（语言标签）+ `.code-block-body`，消除 `[object Object]` 问题
- heading 渲染添加 `id` 属性支持锚点跳转
- table 渲染兼容 marked token 和字符串双模式
- blockquote 渲染带蓝色左边线 + 浅灰背景

### 2. Mermaid 图表渲染 (`hub/app.js` + `hub/index.html` + `hub/styles.css`)

- 从 `node_modules` 本地加载改为 CDN (`mermaid@10`)，解决 MIME type 和版本兼容问题
- `mermaid.initialize()` 改为全局只执行一次（`mermaidInitialized` 守卫）
- 使用 `mermaid.render(id, code)` 逐个渲染，替代批量 `mermaid.run({ nodes })`
- Mermaid 容器样式：浅灰背景 `#f1f3f5`、16px 圆角边框
- SVG 约束：`max-height: 40vh`、`max-width: 100%`、居中显示
- **悬停态**：hover 上浮 2px + 阴影加深，0.3s 过渡
- **点击全屏**：弹出 overlay（半透明模糊背景 + 白色面板 + 关闭按钮），支持点击空白/×/Esc 关闭

### 3. 文章全宽布局 (`hub/styles.css`)

- `.article` 设为 `width: 100%; max-width: 100%`，与 zread 的 `w-full max-w-full` 一致
- 内容直接填充侧边栏右侧全部空间

### 4. 项目 TOC 侧边栏 (`hub/app.js`)

- 阅读页左侧新增 TOC 目录树，按 section → group → page 层级展示
- 当前页高亮，点击切换页面无需返回门户
- 同时显示项目切换器，可跨项目跳转

### 5. Plain Markdown 目录导入 (`hub/admin-server.mjs`)

- `/import-path` API 自动识别输入类型：zread wiki / 任意 Markdown 目录 / 单个 .md 文件
- 递归扫描子目录中所有 `.md` 文件，自动跳过 `node_modules`、`.git`、`dist` 等目录
- 子目录名映射为 section，文件内首个 `#` 标题映射为 page title
- 生成与 zread 一致的 catalog 结构，前端无需改动

### 6. 设计系统重建 (`hub/styles.css`)

- CSS 变量化设计 token（颜色、圆角、阴影、字体）
- Dashboard 卡片：hover 动画、操作按钮、tag 标签
- 侧边栏：sticky 定位、项目列表、目录树样式
- 细滚动条、响应式布局

## Fix Bug

### 1. 代码块显示 `[object Object]`

- **原因**：marked 新版 `renderer.code` 传入 token 对象而非字符串
- **修复**：添加类型判断兼容两种参数格式

### 2. Mermaid 图表空白

- **原因（三重）**：
  - `node_modules` 路径加载的 mermaid v11 与 `mermaid.run()` API 不兼容
  - `mermaid.initialize()` 每次渲染重复调用导致内部状态重置
  - `fontFamily: 'inherit'` 为无效配置
- **修复**：改用 CDN v10 + `mermaid.render()` + 单次初始化 + 移除无效配置

### 3. Mermaid 容器内黄色色块

- **原因**：`mermaid-fallback` 的黄色背景 `#fef3c7` 和 JS 中注入的琥珀色错误提示
- **修复**：移除 fallback 黄色背景和 JS 错误注入，改用灰色

### 4. 文章内容区域过窄

- **原因**：`--prose-max-width: 720px` 限制了内容宽度
- **修复**：改为 `max-width: 100%`

### 5. Mermaid 全屏弹窗中图表反而缩小

- **原因**：overlay 内 SVG 仍受 `max-height: 40vh` 约束
- **修复**：在 `.mermaid-overlay-inner svg` 中用 `!important` 重置，添加 `min-width: 60vw`

### 6. 非 zread 路径导入报错

- **原因**：`resolveWikiVersionFromInput` 不匹配 zread 格式时直接 throw
- **修复**：新增 plain 类型返回，走 `importPlainMarkdownDir` 分支

## 涉及文件

| 文件 | 变更类型 |
|------|---------|
| `hub/styles.css` | 重写 |
| `hub/app.js` | 重写 |
| `hub/index.html` | 修改（mermaid CDN、缓存版本） |
| `hub/admin-server.mjs` | 重写（新增 plain markdown 导入） |
