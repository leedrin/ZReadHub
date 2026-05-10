# Wiki Hub 测试与验收文档（MVP）

## 1. 目标

定义本地多项目 Wiki Hub 的测试范围、验收门槛、用例矩阵与交付标准，确保功能可用、可回归、可发布。

## 2. 测试范围

1. 项目扫描与元数据归一化
2. API 合约稳定性
3. Dashboard 门户展示与筛选
4. Reader 文档渲染与导航
5. 全局搜索与跨项目跳转
6. 基础视觉一致性与响应式表现

## 3. 不在本次范围

1. 一键 `zread generate` 调度
2. 文件系统实时监听与热刷新
3. 账号、权限、多用户并发

## 4. 测试环境

1. OS: Windows 11（主测），Ubuntu（CI）
2. Node.js: 20.x
3. pnpm: 10.x
4. Browsers: Chromium（必测），Firefox（冒烟）
5. 数据样本:
- `C:\temp\Unity3D_RO\clientproj\Assets\.zread\wiki\versions\2026-05-10-124151\`

## 5. 入口与退出准则

### 5.1 进入测试（Entry Criteria）

1. `pnpm install` 成功
2. API 与 Web 可本地启动
3. 扫描根目录配置完成
4. 基础自动化测试脚本可执行

### 5.2 退出测试（Exit Criteria）

1. P0 用例通过率 100%
2. P1 用例通过率 >= 95%
3. 无 P0/P1 级未修复缺陷
4. `pnpm verify` 全绿

## 6. 测试类型与工具

1. 单元测试: Vitest
2. API 集成测试: Fastify inject + Vitest
3. E2E: Playwright
4. 视觉回归: Playwright screenshot baseline
5. 手工验收: 业务场景清单

## 7. 功能验收用例矩阵

| ID | 级别 | 模块 | 用例描述 | 步骤摘要 | 预期结果 |
|---|---|---|---|---|---|
| SCN-001 | P0 | Scanner | 识别 `.zread/wiki/current` 项目 | 配置根目录并触发扫描 | 项目进入列表，状态 `ready` |
| SCN-002 | P0 | Scanner | 路径越界防护 | 输入含 `..` 的路径请求 | 返回拒绝/错误，不读取越界文件 |
| CAT-001 | P0 | Catalog | 解析 `wiki.json` | 打开项目详情 | `pageCount`、`lastGeneratedAt` 正确 |
| API-001 | P0 | API | `/api/projects` 合约 | GET 请求 | 200 + 数组字段完整 |
| API-002 | P0 | API | `/api/projects/:id/wiki` 合约 | GET 请求 | 200 + `pages[]` 可用 |
| API-003 | P0 | API | `/api/projects/:id/pages/:slug` | GET 请求 | 200 + markdown 正文 |
| API-004 | P0 | API | 非法 projectId | GET 请求 | 404 + 可读错误信息 |
| UI-001 | P0 | Dashboard | 首页卡片展示 | 打开首页 | 卡片数量与项目数一致 |
| UI-002 | P0 | Dashboard | 项目名筛选 | 输入关键词 | 卡片按关键词过滤 |
| UI-003 | P1 | Dashboard | 最近更新时间排序 | 切换排序 | 列表顺序正确 |
| RD-001 | P0 | Reader | 默认页打开 | 进入 `/reader/:id` | 自动打开第一篇文章 |
| RD-002 | P0 | Reader | 指定 slug 路由 | 进入 `/reader/:id/:slug` | 展示对应页面内容 |
| RD-003 | P0 | Reader | 目录树导航 | 点击侧栏条目 | URL 和内容同步切换 |
| RD-004 | P1 | Reader | Mermaid 渲染 | 打开含 mermaid 页面 | 图表渲染成功 |
| RD-005 | P1 | Reader | 代码块高亮 | 打开代码块页面 | 高亮主题生效 |
| SRH-001 | P0 | Search | 全局关键词检索 | `Ctrl+K` 输入关键词 | 返回跨项目结果 |
| SRH-002 | P0 | Search | 结果跳转 | 点击结果 | 跳转到目标项目+slug |
| SRH-003 | P1 | Search | 无结果态 | 输入不存在关键词 | 显示空状态，不报错 |
| RSP-001 | P1 | Responsive | 移动端布局 | 375px 宽度打开 reader | 可阅读，无布局溢出 |
| PERF-001 | P1 | 性能 | 首页首屏耗时 | 冷启动访问首页 | 热缓存 < 2 秒 |

## 8. 非功能测试检查点

1. 安全
- 仅允许白名单根目录扫描
- API 禁止任意文件读取

2. 稳定性
- 单个项目损坏时，不影响其他项目展示

3. 可维护性
- API schema 变更需同步类型和契约测试

## 9. 缺陷分级标准

1. P0
- 核心流程不可用（无法扫描、无法阅读、无法搜索）

2. P1
- 关键体验严重受损（错误跳转、大量空白内容）

3. P2
- 一般问题（样式细节、低频交互异常）

4. P3
- 建议优化（文案、微交互）

## 10. 回归策略

1. 每次合并请求必须运行：
- API 测试全量
- Web E2E 冒烟
- 关键视觉快照

2. 每日回归（可选定时 CI）
- 全量 E2E
- 搜索准确性抽样

## 11. 发布验收清单（UAT）

1. 可以同时展示至少 3 个本地 wiki 项目。
2. 每个项目可进入 reader 并阅读所有页面。
3. 全局搜索能命中并跳转至少 10 条跨页结果。
4. 404、空结果、损坏项目均有可理解提示。
5. Dashboard 与 Reader 在桌面和移动端均可用。

## 12. 测试执行命令

```bash
pnpm --filter @wikihub/api test
pnpm --filter @wikihub/web test
pnpm verify
```

## 13. 测试报告模板

```markdown
# Wiki Hub MVP Test Report

- Date:
- Build/Commit:
- Tester:

## Summary
- Total cases:
- Passed:
- Failed:
- Blocked:

## Failed Cases
| Case ID | Severity | Symptom | Owner | ETA |
|---|---|---|---|---|

## Release Recommendation
- Go / No-Go
- Rationale:
```
