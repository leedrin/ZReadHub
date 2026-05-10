# 本地多项目 Wiki Hub 功能设计文档（2026-05-10）

## 1. 文档目标

将“多项目 zread wiki 聚合门户”需求转化为可开发、可验收、可迭代的功能设计，面向本地运行场景。

## 2. 范围定义

### 2.1 In Scope

- 扫描多个根目录并自动发现 zread wiki 项目
- 生成项目卡片聚合首页（Dashboard）
- 提供单项目阅读体验（Reader）
- 跨项目搜索并可直接跳转
- 显示 wiki 生成状态与更新时间

### 2.2 Out of Scope（本期不做）

- 云端账号系统与多人协作
- 远端仓库自动拉取
- 复杂权限系统
- 移动端离线缓存同步

## 3. 用户角色与典型场景

1. 本地开发者
- 维护多个项目，希望统一入口浏览 wiki。

2. 架构/技术负责人
- 需要跨项目检索架构主题，快速对比实现差异。

3. 新同学
- 通过门户快速了解每个项目结构与关键文档。

## 4. 信息架构

## 4.1 一级页面

1. `/`：Wiki Hub Dashboard
2. `/reader/:projectId/:slug?`：阅读页
3. `/settings`：根目录与扫描配置（可后置到 P1）

## 4.2 阅读页布局

- 左栏：
  - 全局项目列表
  - 当前项目目录树（按 section/group/page）
- 右栏：
  - 文档正文
  - 页内 TOC（可选）

## 5. 功能设计

## 5.1 项目自动发现与管理

### 5.1.1 输入

- 根目录列表（1..N）

### 5.1.2 识别规则

命中任一条件即视为候选项目：

1. 存在 `.zread/wiki/current`
2. 存在 `.zread/wiki/versions/*/wiki.json`

### 5.1.3 元数据提取优先级

1. `zread.config.yaml`（若存在）
2. `README.md` 首标题 + 首段
3. 回退到目录名

### 5.1.4 状态字段

- `wikiStatus`: `ready | missing | stale | error`
- `lastGeneratedAt`: 来自 `wiki.json.generated_at`
- `lastScannedAt`: 扫描时间

## 5.2 聚合首页 Dashboard

### 5.2.1 组件

- 顶部搜索框（项目名搜索）
- 分类筛选（后端/前端/AI/游戏等）
- 项目卡片网格

### 5.2.2 卡片字段

- 标题
- 简介
- 标签
- 页面数
- 最近更新时间
- 状态点（ready/missing/stale）

### 5.2.3 交互

- 点击卡片进入对应 reader
- 支持排序：最近更新 / 名称 / 页面数

## 5.3 文档阅读器 Reader

### 5.3.1 路由

- `/reader/:projectId` 默认打开第一篇
- `/reader/:projectId/:slug` 打开指定页面

### 5.3.2 渲染策略

#### 方案 A（iframe）

- 读取项目静态站点入口 `index.html`。
- 适用于已有完整静态产物。

#### 方案 B（统一渲染，推荐）

- API 返回 markdown 文本 + 页面元信息。
- 前端统一渲染（markdown-it/remark + mermaid + code highlight）。

### 5.3.3 目录组织

- 从 `wiki.json.pages` 构建：
  - 一级：`section`
  - 二级：`group`
  - 叶子：`title`（slug）

## 5.4 全局搜索

### 5.4.1 索引来源

- `project.title`
- `wiki.json.pages[].title`
- markdown 正文（可裁剪前 N 字）

### 5.4.2 检索引擎

- 首选 `FlexSearch`
- 备选 `Fuse.js`

### 5.4.3 结果结构

- `projectId`
- `projectTitle`
- `slug`
- `pageTitle`
- `snippet`
- `score`

### 5.4.4 跳转

- 点击结果跳转 `/reader/:projectId/:slug` 并高亮关键词

## 5.5 一键重生成（P1）

- 后端提供 `POST /api/projects/:id/regenerate`
- 服务端执行本地 `zread generate`（命令可配置）
- 生成结束后重建索引

## 6. 数据模型

```ts
interface ProjectMeta {
  id: string;
  name: string;
  rootPath: string;
  wikiRoot: string;
  currentVersionPath?: string;
  title: string;
  summary: string;
  tags: string[];
  wikiStatus: 'ready' | 'missing' | 'stale' | 'error';
  pageCount: number;
  lastGeneratedAt?: string;
  lastScannedAt: string;
}

interface WikiPage {
  slug: string;
  title: string;
  file: string;
  section?: string;
  group?: string;
  level?: string;
}

interface SearchHit {
  projectId: string;
  projectTitle: string;
  slug: string;
  pageTitle: string;
  snippet: string;
  score: number;
}
```

## 7. API 设计（Fastify）

1. `GET /api/projects`
- 返回项目列表与状态

2. `GET /api/projects/:id/wiki`
- 返回 `wiki.json` 解析结果

3. `GET /api/projects/:id/pages/:slug`
- 返回 markdown 正文与元信息

4. `GET /api/search?q=...`
- 返回跨项目检索结果

5. `POST /api/scan`
- 触发全量扫描

6. `POST /api/projects/:id/regenerate`（P1）
- 触发 zread 重新生成

## 8. 状态流转

```text
missing -> ready
ready -> stale (检测到源码变更或超出时效阈值)
stale -> ready (重新生成成功)
any -> error (解析失败/权限失败)
```

## 9. 非功能要求

1. 性能
- 100 个项目内，首页首屏 < 2s（热缓存）
- 单篇文档打开 < 500ms（本地磁盘缓存命中）

2. 可用性
- 扫描失败不阻塞其它项目展示
- Reader 页面断点恢复（刷新后保留当前 slug）

3. 安全
- 限制可扫描根目录白名单
- 路径规范化防越界读取

4. 兼容
- Windows 路径优先，兼容 macOS/Linux

## 10. 里程碑（Roadmap）

### M1（MVP）

- 手动 `projects.json`
- 首页项目列表
- Reader 基础渲染（方案 B 简化版）

### M2（视觉还原）

- 卡片化 UI、主题 token、排版优化
- 目录树 + TOC + 搜索弹层

### M3（自动化增强）

- 自动扫描根目录
- 全文索引与跨项目跳转
- 一键 regenerate

## 11. 验收标准（DoD）

1. 能发现并展示至少 3 个本地 zread 项目。
2. Dashboard 可按关键字筛选项目。
3. Reader 可按 section/group 浏览并正确渲染 Markdown、表格、代码块、Mermaid。
4. 全局搜索可返回跨项目结果并正确跳转到目标 slug。
5. 项目状态与更新时间展示准确。

## 12. 风险与缓解

1. 路径映射复杂
- 缓解：统一 `PathResolver`，集中处理绝对/相对路径。

2. 搜索索引构建慢
- 缓解：增量索引 + 异步后台构建。

3. 样式不一致
- 缓解：建立主题 token 层，文档渲染样式单独维护 `prose-overrides.css`。

## 13. 开发建议（下一步）

1. 先实现统一数据层（扫描 + 标准化元数据）。
2. Reader 先打通 markdown 渲染闭环，再叠加视觉细节。
3. 全局搜索先标题级，后正文级。
4. `regenerate` 放在 P1，避免前期耦合 zread 执行链路。
