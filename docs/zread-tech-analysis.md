# Zread.ai 技术取证与本地复刻方案（2026-05-10）

## 1. 目标与范围

本文用于指导“本地多项目 Wiki 门户（Wiki Hub）”对 zread.ai 的体验复刻，重点覆盖：

- 聚合首页（项目卡片门户）
- 单项目阅读页（左侧导航 + 右侧文档）
- 全局检索与跨项目跳转
- 主题/排版/交互风格的可复刻实现

说明：本分析基于 `2026-05-10` 对线上页面的取证，不等价于官方源码。

## 2. 取证方法

- 目标页面：
  - `https://zread.ai/`
  - `https://zread.ai/NVIDIA/GenerativeAIExamples/8-rag-inference-pipeline`
- 取证手段：
  - 抓取 HTML 响应头与首屏结构
  - 抓取 `_next/static/css/*` 与关键 JS chunk
  - 关键词扫描（markdown/搜索/图表/组件库等）
  - 对本地 zread 输出样本进行结构匹配分析

## 3. 观测事实（Evidence）

### 3.1 框架与渲染路径

1. 响应头存在 `X-Powered-By: Next.js`。
2. 页面资源路径为 `/_next/static/chunks/*`、`/_next/static/css/*`，符合 Next.js App Router 产物特征。
3. 项目页加载了动态路由 chunk：
   - `app/%5Bowner%5D/%5Brepo%5D/layout-*.js`
   - `app/%5Bowner%5D/%5Brepo%5D/%5B%5B...slugs%5D%5D/page-*.js`
4. HTML 中出现 `self.__next_f.push(...)`，符合 React Server Components（RSC）Flight 数据流形态。

### 3.2 样式与设计系统

1. `/_next/static/css/f26b1da5b669ff93.css` 顶部包含：`/*! tailwindcss v4.1.6 */`。
2. 字体通过 `@font-face` 注入 `Geist`，并在 body class 中启用。
3. 可见主题 token（节选）：
   - `--background`, `--foreground`, `--card`, `--border`, `--muted-foreground`
   - `--primary`, `--primary-foreground`, `--theme`
   - `--sidebar-*`
4. 存在 `.prose` 相关样式与 `::selection` 主题着色。
5. 可见 `dark` 相关选择器、`data-theme` 相关逻辑与首屏主题脚本。

结论：样式体系高度接近“Tailwind + 设计 token + prose 文档排版 + 亮暗主题切换”的组合。

### 3.3 文档能力线索（基于 chunk 关键词扫描）

在项目页加载的 36 个脚本 chunk 中，可检出关键词：

- `rehype-pretty-code`
- `mermaid`
- `shiki`
- `markdown` / `mdx`
- `toc`
- `fuse`
- `radix`
- `clipboard`
- `nprogress`

说明：这是“静态字符串级别”的取证，表示项目中很可能使用这些能力或同名依赖，不代表全部路径都启用。

## 4. 本地 zread 产物结构匹配

对样本目录
`C:\temp\Unity3D_RO\clientproj\Assets\.zread\wiki\versions\2026-05-10-124151\`
的观测结果：

1. 存在 `wiki.json`，含 `id / generated_at / language / pages[]`。
2. `pages[]` 提供 `slug / title / file / section / group / level`，可直接驱动目录与路由。
3. 每篇内容为 Markdown，含：
   - 代码块
   - 表格
   - Mermaid 图
   - `Sources:` 链接段
4. `.zread/wiki/current` 指向当前版本路径，适合做“最新版本”解析入口。

结论：本地门户完全可以以 `wiki.json + markdown` 为统一数据层，不必强依赖 zread.ai 线上接口。

## 5. 可复刻技术方案（建议）

## 5.1 总体架构

- 前端：`Next.js (App Router) + Tailwind CSS + shadcn/ui（可选）`
- 本地服务层：`Node.js + Fastify`
- 内容解析：`remark/rehype` 流程（支持 GFM + Mermaid + 代码高亮）
- 检索：`FlexSearch`（或 Fuse.js，按性能取舍）

推荐分层：

1. `scanner`：扫描多个根目录，发现 zread 项目
2. `catalog`：生成统一项目元数据（标题、描述、更新时间、分类）
3. `content`：按项目读取 `wiki.json` 与 markdown
4. `search`：构建跨项目索引
5. `ui`：Hub 首页 + Reader 阅读页

## 5.2 读取模式

### 模式 A：Iframe 嵌入（快速落地）

- 优点：实现快，风险低。
- 缺点：风格统一度差，跨域/路径重写/深链较难。

### 模式 B：统一渲染（推荐）

- 直接读取 markdown，在主应用内渲染。
- 与全局 UI、左侧项目列表、全局搜索天然统一。
- 更容易做“跨项目跳转 + 高亮 + 锚点定位”。

建议：MVP 可先 A，再迭代到 B；若团队希望一次到位，直接 B。

## 5.3 UI 复刻要点（接近 zread.ai）

1. 首页
- 大留白 + 中心化容器
- 卡片网格（桌面 3-4 列，移动端 1 列）
- 卡片包含：项目名、简介、标签、更新时间、状态

2. 阅读页
- 左侧：全局项目切换 + 当前项目目录树
- 右侧：文档内容（prose 风格）
- 右上角：搜索、主题切换

3. 视觉 token（建议起步值）
- 圆角：`12px/16px`
- 卡片阴影：轻阴影 + hover 提升
- 边框：`1px` 低对比边线
- 字体：`Geist` 或同类现代无衬线
- 色板：中性灰 + 单一强调色（通过 `--theme` 驱动）

4. 文档呈现
- 启用 `prose` 并覆盖代码块、表格、blockquote
- Mermaid 使用延迟渲染，避免首屏阻塞
- 代码高亮可选 Shiki，保持接近线上效果

## 6. 关键工程难点与对策

1. 相对资源路径
- 问题：markdown 内部图片/链接常为相对路径。
- 对策：按“项目根 + wiki 版本目录”做安全映射，并在渲染期重写 URL。

2. CORS 与本地文件读取
- 问题：跨目录读取与浏览器安全策略冲突。
- 对策：统一走 Fastify API，由服务端读取本地文件并输出标准 JSON/文本。

3. 大仓库索引性能
- 问题：项目多时全量重建索引成本高。
- 对策：增量索引（按 `generated_at`/mtime 判定），并缓存到本地 `.wikihub/index`。

4. 安全边界
- 问题：任意路径读取风险。
- 对策：白名单根目录 + 路径规范化 + 禁止 `..` 越界 + 只读模式。

## 7. 复刻优先级建议

1. P0（必须）
- 多根目录扫描
- 项目卡片首页
- 单项目 markdown 阅读
- 基础搜索（项目名 + 页面标题）

2. P1（应有）
- 跨项目全文检索
- Mermaid/代码高亮
- 主题切换与最近访问

3. P2（增强）
- 一键 `zread generate`
- 文件监控自动刷新
- 收藏/置顶/标签自定义

## 8. 与你当前数据的适配建议

- 首批直接适配 `wiki.json`（无需猜 schema）
- 默认以 `.zread/wiki/current` 解析当前版本
- 同时保留“指定版本回看”能力（历史对比时有用）

## 9. 结论

从线上取证看，zread.ai 的核心是“Next.js + Tailwind 主题系统 + 强文档渲染链路 + 组件化交互”。
你的本地数据结构已经具备复刻基础。建议以“统一渲染模式（模式 B）”作为主线，可以在保持门户一致体验的同时支持未来功能扩展。

## 10. 参考链接

- zread 聚合首页：<https://zread.ai/>
- 示例项目页：<https://zread.ai/NVIDIA/GenerativeAIExamples/8-rag-inference-pipeline>
- Next.js 文档：<https://nextjs.org/docs>
- Tailwind CSS 文档：<https://tailwindcss.com/docs>
