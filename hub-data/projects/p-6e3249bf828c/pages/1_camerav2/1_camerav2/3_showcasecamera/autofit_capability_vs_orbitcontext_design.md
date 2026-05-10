# AutoFit 能力路由 与 OrbitContextExtension 方案整理

> 日期：2026-03-19  
> 适用范围：CameraControllerV2 / OrbitViewMode / ShowcaseMode / StageActorViewUIController  
> 目的：明确两套机制的定位、边界与演进策略，避免重复建设和语义冲突

---

## 1. 背景

在 V2 相机体系中，当前同时存在两种“参数/指令传递”机制：

1. **OrbitContextExtension 机制**  
   OrbitMode 内部通过 `ExtensionContainer` 向模块传递一次性指令与配置。
2. **Module Capability 路由机制**  
   通过 `ICameraAutoFitCapability` + `CameraAutoFitRequest`，由外部统一下发能力请求到当前模式内具备能力的模块。

两者都可影响 AutoFit，需统一边界。

---

## 2. 方案 A：OrbitContextExtension

### 2.1 设计目的

- 解决 **Orbit 模式内部** 的模块协同问题。  
- 让 OrbitMode 与 Orbit 模块之间以“扩展数据”解耦，而不是直接互相引用。

### 2.2 主要功能

- 一次性指令：`ResetRequested`、`AutoFitRequested`、`AutoFitMode` 等。
- 持久参数：`TargetInFrameRatio`、初始状态参数等。
- Orbit 状态回写：通过 `OrbitStateExtension` 提供调试/状态读取。

### 2.3 边界

- **仅限 Orbit 模式内部协同**（Mode ↔ Orbit 模块，模块 ↔ 模块）。
- 不应作为跨模式通用能力入口。

### 2.4 风险

- 若被上层当作通用入口，会把外部调用方重新绑定到 Orbit 语义。
- 与能力路由并存时，AutoFit 语义可能出现双写与优先级不清。

---

## 3. 方案 B：Module Capability 路由（ICameraAutoFitCapability）

### 3.1 设计目的

- 提供 **模式无关、模块可插拔** 的统一外部能力入口。
- 让调用方（如 `StageActorViewUIController`）不依赖具体 Mode 类型。

### 3.2 主要功能

- 外部构造 `CameraAutoFitRequest`（模式、占屏比、中心调整、作用域）。
- `CameraControllerV2` 将请求路由到当前模式中实现 `ICameraAutoFitCapability` 的模块。
- Orbit / Showcase / 后续新模块都可接入同一能力协议。

### 3.3 边界

- **北向接口（上层调用入口）**：UI/业务代码只走能力路由。
- 只定义“能力意图”，不承载 Orbit 内部状态机细节。

### 3.4 风险

- 若能力协议无限膨胀，会变成新的“巨型参数总线”。
- 若不定义作用域与优先级，可能出现多模块同时响应带来的非预期结果。

---

## 4. 冲突与重复分析

### 4.1 是否冲突

- **不冲突**：两者分属不同层级（外部入口 vs 内部协同）。

### 4.2 是否重复

- **存在部分重复**：AutoFit 相关字段在两边都有表达能力。  
  典型重复语义：
  - `AutoFitMode`
  - `AdjustCenterToGeometry`
  - `TargetInFrameRatio`
  - 触发 AutoFit 的请求信号

---

## 5. 分层建议（最终目标）

### 5.1 职责分层

1. **Capability 路由：对外统一入口**  
   - 所有上层调用（Stage/UI/业务）只下发能力请求。
2. **OrbitContextExtension：Orbit 内部协同容器**  
   - 仅保留 Orbit 特有、跨 Orbit 模块协同必需的内部状态。

### 5.2 单一事实来源（Single Source of Truth）

- 对 AutoFit 参数，优先收敛到 **Capability 请求** 作为唯一外部来源。  
- OrbitContext 中与 AutoFit 重叠字段逐步下线或仅作内部镜像，不对外暴露语义。

---

## 6. 过渡策略

### 阶段 1（已完成）

- 引入 `ICameraAutoFitCapability` 与 `CameraAutoFitRequest`。
- `StageActorViewUIController` 改为统一路由，不再直接依赖 `OrbitViewModeComponent`。
- Orbit/Showcase 模块均支持能力请求。

### 阶段 2（短期）

- 明确并固化优先级规则（建议：Capability 请求 > OrbitContext 默认值）。
- 对同帧重复来源增加日志告警（便于治理）。

### 阶段 3（中期）

- 收敛 OrbitContext 中与 AutoFit 重叠的“外部入口语义”。
- OrbitContext 聚焦于 Orbit 专有内部状态（Reset/InitialState/调试态）。

---

## 7. 风险控制与验收

### 7.1 风险控制

- 所有能力接口都要求“无能力即忽略，不报错中断”。
- 路由返回命中数量，用于监控是否真正命中能力模块。
- 关键调用链保留日志（目标设置、请求下发、命中数）。

### 7.2 验收清单

1. Orbit 模式：AutoFit 行为与改造前一致。  
2. Showcase 模式：AutoFit 请求可生效，不再依赖 OrbitMode。  
3. 切换模式后重新设置目标：请求可由当前模式能力模块正确消费。  
4. 上层调用代码不再出现 `ModeGet<OrbitViewModeComponent>()` 这种硬编码依赖。

---

## 8. 结论

- `OrbitContextExtension` 和 `Capability 路由` 不应互相替代，而应上下分层。  
- **Capability** 负责“外部统一入口”，**ContextExtension** 负责“模式内部协同”。  
- 对 AutoFit 这类跨模式能力，应持续收敛到 Capability 协议，降低模式耦合并提升可扩展性。

---

## 9. 与现有 V2 设计文档的对齐结论

本节基于以下文档进行对齐：

- `Deep_Pipeline_Decoupling_Design.md`
- `OrbitView_Decoupling_Design.md`
- `Dynamic_Mode_Discovery_Design.md`
- `Extensible_Context_Design.md`

### 9.1 与 Deep Pipeline Decoupling 的一致性

- 该文档强调：**Mode 是容器，命令应数据化，模块在 Execute 自驱动**。  
- 因此：Capability 路由应仅承担“北向请求入口”，不应演化为新的命令式直接调用链。  
- 推荐实践：Capability 请求在 Mode 侧被“翻译”为模块可消费的数据（一次性标记/持久参数），模块仍在管线内处理。

### 9.2 与 OrbitView Decoupling 的一致性

- 该文档强调：模块间通过 `CameraState` / 隐式契约协作，而非兄弟引用。  
- 因此：AutoFit 能力请求应只改变“输入条件”，不应破坏 `ReferenceLookAt + RawPosition` 的数据流契约。  
- OrbitContextExtension 可继续作为 Orbit 专用中间态容器，但其外部入口语义应收敛。

### 9.3 与 Dynamic Mode Discovery 的一致性

- 该文档强调：扩展应避免硬编码模式类型/枚举。  
- Capability 路由天然符合该目标：上层不依赖 `OrbitViewModeComponent`、`ShowcaseModeComponent` 类型。  
- 后续可将“能力可发现性”也做成配置/反射友好，进一步支撑插件式模式扩展。

### 9.4 与 Extensible Context Design 的一致性

- 该文档强调：`CameraModuleContext` / `CameraState` 必须保持核心最小化，业务参数通过 `ExtensionContainer` 承载。  
- 因此：Capability 路由不应把业务字段重新塞回核心结构，而应在 Mode 层映射为强类型 Extension。  
- 该文档强调：强类型与零分配复用。  
- 因此：建议优先采用“Mode 内复用的 Extension 实例 + 每帧清理一次性字段”，避免临时分配。

---

## 10. 后续目标架构（建议）

### 10.1 三层职责模型

1. **北向层（Controller/API）**  
   - 接收外部业务请求（如 AutoFit、Reframe、LockTarget 等）。
   - 不感知具体 Mode/Module 类型。
2. **路由层（CurrentMode Capability Router）**  
   - 在当前模式内分发能力请求到命中模块。
   - 负责作用域（ActiveVC / AllVC）与冲突策略。
3. **南向层（Pipeline Data）**  
   - 模块在 `Execute` 中读取状态并输出 `CameraState`。
   - 仍遵循“数据流驱动”，避免重新引入模块间直接调用。

### 10.2 推荐数据流

`UI/业务 -> CameraControllerV2.AutoFitRequestApply -> CurrentMode.CapabilityDispatch -> Module更新请求态 -> Execute消费 -> CameraState输出`

---

## 11. 边界细化：一次性请求 vs 持久参数

为避免“同名语义多通道”，建议将能力参数按生命周期分为两类：

### 11.1 一次性请求（One-shot）

- 示例：`RecalculateNow`、`AutoFitRequested`、`ResetRequested`。  
- 语义：仅影响下一次/当前帧执行，执行后清理。

### 11.2 持久参数（Persistent）

- 示例：`AutoFitMode`、`TargetInFrameRatio`、`AdjustCenterToGeometry`。  
- 语义：作为模块配置持续生效，直到被下一次请求覆盖或显式重置。

### 11.3 统一约束

- 同一字段只允许一个“权威入口”。  
- 若过渡期存在双入口，必须定义严格优先级并记录告警。

---

## 12. 冲突策略与优先级（建议固化）

### 12.1 参数优先级

1. **同帧能力请求（Capability Request）**
2. **模式内部扩展状态（如 OrbitContextExtension）**
3. **模块序列化默认值（Prefab）**

### 12.2 多模块命中策略

- 默认允许多模块命中（组合能力）。  
- 对“单写语义能力”（如唯一 AutoFit 写位姿）需在文档中约束：
  - 要么限定作用域只命中 ActiveVC 的一个模块；
  - 要么按模块阶段/顺序确定最终写入者。

### 12.3 观测性要求

- Controller 层日志：请求参数、作用域、命中数。  
- Mode 层日志（可选 debug）：命中模块名列表。  
- 模块层日志（仅异常）：参数非法、目标不可用、请求被忽略原因。

---

## 13. 演进路线（进一步细化）

### 13.1 M1（已落地）

- 引入 `ICameraAutoFitCapability` + `CameraAutoFitRequest`。  
- `StageActorViewUIController` 不再依赖 `ModeGet<OrbitViewModeComponent>()`。  
- Orbit/Showcase 模块可统一消费请求。

### 13.2 M2（建议近期）

- 为 AutoFit 增加统一“请求态容器”（优先复用 `ExtensionContainer` 的强类型扩展）。  
- 固化优先级常量与冲突日志模板。  
- 补充自动化回归脚本：Orbit/Showcase 切换、Reset 后重新 TargetSet、不同 Scope 行为。

### 13.3 M3（建议中期）

- 清理 OrbitContext 中重复的外部入口字段，仅保留 Orbit 内部协同所需状态。  
- 评估抽象通用能力基类：`ICameraCapability`（可选，不强推）。

### 13.4 M4（建议长期）

- 能力发现机制接入“动态配置驱动”：
  - 编辑器可视化展示“当前模式支持的能力清单”；
  - 运行时可查询能力支持矩阵，服务于业务降级策略。

---

## 14. 开放问题（需评审确认）

1. AutoFit 请求是否应支持“策略型目标”（例如：头部/武器挂点/自定义观察中心）？  
2. `Scope=AllVisualCameras` 下，不同 VC 的持久参数是否允许差异化覆盖？  
3. 能力请求是否需要事务语义（同一批请求要么都成功命中，要么回滚）？  
4. 是否需要在 `ICameraControllerV2` 暴露 `CapabilitySupportQuery` 接口供上层提前判定？

---

## 15. 结语

后续演进的关键不是“二选一”，而是建立清晰分层：

- **Capability 路由**：面向外部、稳定、可扩展。  
- **ContextExtension**：面向内部、轻量、模式专属。  
- **Pipeline/CameraState**：作为最终执行与状态收敛的唯一主路径。

按此路径推进，可同时满足：模块自由组合、模式动态扩展、上层低耦合调用。

---

## 16. 基于 Extensible Context 的落地细化

### 16.1 统一映射点（建议固化）

为避免“双入口各写一份”，建议把映射点固定在 Mode 的能力分发层：

`Capability Request -> Mode 内 Extension 写入 -> Module Execute 消费`

约束如下：

1. 上层只调用 Capability，不直接写任意 Extension。  
2. Mode 负责把 Capability 参数翻译成本模式可识别的 Extension。  
3. Module 只读 Context/State Extension，不反向依赖上层调用方。

### 16.2 AutoFit 字段单一事实来源表

| 语义字段 | 外部权威入口 | Mode 内部落点 | 模块消费方式 | 生命周期 |
|---|---|---|---|---|
| AutoFit 触发信号 | `CameraAutoFitRequest` 下发 | `OrbitContextExtension.AutoFitRequested` 或等价请求扩展 | `Execute` 检查后执行 | One-shot |
| `AutoFitMode` | `CameraAutoFitRequest.Mode` | `OrbitContextExtension.AutoFitMode` | AutoFit 模块读取 | Persistent |
| `AdjustCenterToGeometry` | `CameraAutoFitRequest.AdjustCenterToGeometry` | `OrbitContextExtension.AdjustCenterToGeometry` | AutoFit 模块读取 | Persistent |
| `TargetInFrameRatio` | `CameraAutoFitRequest.TargetInFrameRatio` | 模式专用扩展（Orbit/Showcase 各自字段） | AutoFit 模块读取 | Persistent |
| `ResetRequested` | 非 AutoFit 能力入口（建议独立 Reset 能力） | `CommonCommandExtension.ResetRequested` 或模式扩展 | Reset 模块读取 | One-shot |

### 16.3 与通用扩展的边界

- `CommonCommandExtension` 适合承载跨模式通用命令（如 Reset/ImmediateSync）。  
- `OrbitContextExtension` 仅承载 Orbit 专有语义，避免“通用字段长期滞留在 Orbit 扩展”。  
- 对跨模式能力，优先新增 Capability 协议，再由各 Mode 映射到本地扩展，不直接共享 Orbit 字段。

### 16.4 风险与治理补充

1. 扩展泛滥风险：每新增扩展必须标注“所属能力、生命周期、清理时机”。  
2. 兼容层长期滞留风险：`[Obsolete]` 兼容属性需设移除里程碑。  
3. 同义字段漂移风险：同一语义只能有一个北向入口，其他入口仅允许镜像且必须有优先级规则。
