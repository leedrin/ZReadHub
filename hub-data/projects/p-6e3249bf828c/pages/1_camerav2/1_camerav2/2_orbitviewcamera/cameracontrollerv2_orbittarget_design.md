# CameraControllerV2 OrbitTarget 设计方案

## 版本信息
| 项目 | 值 |
|------|-----|
| **版本** | v1.0 |
| **日期** | 2026-01-30 |
| **状态** | 已审核 |
| **关联文档** | CameraControllerV2_Integration_Design.md |

---

## 1. 问题背景

### 1.1 冲突点

在实现 `StageActorViewUIController` 的积木式架构时，出现了两种设计理念的冲突：

**方案 A（已废弃）**：在 `CameraControllerV2` 中添加模式专用方法
```csharp
// ❌ 违反业务无关原则
bool OrbitTargetSet(ICameraFollowTarget target, CameraAutoFitMode mode, ...)
void OrbitAutoFitRequest(CameraAutoFitMode mode, ...)
void OrbitAdjustCenterSet(bool adjustCenter)
```

**统一接口设计原则**（CameraControllerV2_Integration_Design.md 2.1）：
1. **业务无关**: 接口使用通用术语，**不绑定特定业务概念**（Actor/Tackle/Slot/**Orbit**/Focus）
2. **配置分离**: 模式相关参数在 **Prefab 中配置**，运行时可修改
3. **统一目标概念**: 所有模式使用统一的 Target 概念

### 1.2 设计目标

- 符合统一接口设计原则（业务无关）
- 实现积木式架构的解耦
- 保持旧版 CameraController 兼容性

---

## 2. 解决方案
---
  方案对比
  ┌───────────────────────────┬──────────────────────────────┬─────────────────┬─────────────────────┐
  │           方案            │             描述             │      优点       │        缺点         │
  ├───────────────────────────┼──────────────────────────────┼─────────────────┼─────────────────────┤
  │ A: 控制器添加模式专用方法 │ OrbitTargetSet()             │ 调用方便        │ ❌ 违反业务无关原则 │
  ├───────────────────────────┼──────────────────────────────┼─────────────────┼─────────────────────┤
  │ B: ModeGet + 直接调用     │ ModeGet<T>().Method()        │ 类型安全        │ 业务层耦合模式类型  │
  ├───────────────────────────┼──────────────────────────────┼─────────────────┼─────────────────────┤
  │ C: 目标变更自动触发       │ TargetSet() 自动触发 AutoFit │ 完全解耦        │ 需依赖模式内部机制  │
  ├───────────────────────────┼──────────────────────────────┼─────────────────┼─────────────────────┤
  │ D: 通用指令接口           │ CommandSend(ICommand)        │ 完全解耦+可扩展 │ 复杂度增加          │
  └───────────────────────────┴──────────────────────────────┴─────────────────┴─────────────────────┘
  ---
  推荐方案：C + B 混合

### 2.1 核心思路

1. **利用现有机制**：`TargetSet()` 会触发 `OnTargetProviderChanged` 事件，OrbitViewMode 在此事件中自动调用 `RequestAutoFit()`
2. **配置修改**：如需覆盖默认参数，通过 `ModeGet<T>()` 获取模式后修改其属性
3. **保持接口业务无关**：`CameraControllerV2` 不添加任何模式专用方法

### 2.2 数据流

```
┌─────────────────┐                ┌──────────────────┐              ┌─────────────────┐
│   Controller    │                │ CameraControllerV2│              │ OrbitViewMode   │
└────────┬────────┘                └────────┬─────────┘              └────────┬────────┘
         │                                  │                                 │
         │  1. ModeGet<OrbitViewMode>()     │                                 │
         ├─────────────────────────────────>│                                 │
         │<─────────────────────────────────┤ (返回模式引用)                   │
         │                                  │                                 │
         │  2. mode.AutoFitMode = xxx       │                                 │
         ├──────────────────────────────────────────────────────────────────->│
         │                                  │                     (修改属性)   │
         │                                  │                                 │
         │  3. TargetSet(provider)          │                                 │
         ├─────────────────────────────────>│                                 │
         │                                  │  SetTargetProvider(provider)    │
         │                                  ├────────────────────────────────>│
         │                                  │                                 │
         │                                  │     OnTargetProviderChanged()   │
         │                                  │                    ┌────────────┤
         │                                  │                    │ 自动触发    │
         │                                  │                    │ RequestAutoFit()
         │                                  │                    └───────────>│
         │                                  │                                 │
         │                                  │         (下一帧模块执行 AutoFit) │
         │                                  │                                 │
```

### 2.3 方案对比

| 方案 | 描述 | 业务无关 | 解耦程度 | 采用 |
|-----|------|:-------:|:-------:|:----:|
| A: 控制器添加模式专用方法 | `OrbitTargetSet()` | ❌ | 低 | ❌ |
| B: ModeGet + 直接调用 | `ModeGet<T>().Method()` | ✅ | 中 | ✅ |
| C: 目标变更自动触发 | `TargetSet()` 自动触发 | ✅ | 高 | ✅ |
| **最终: B + C 混合** | 属性修改 + 自动触发 | ✅ | 高 | ✅ |

---

## 3. 接口设计

### 3.1 CameraControllerV2 接口（保持不变）

```csharp
public interface ICameraControllerV2
{
    // 目标管理（业务无关）
    void TargetSet(ITargetProvider target);
    void TargetClear();
    ITargetProvider TargetGet();

    // 偏移机制
    void TargetOffsetSet(Vector3 offset);
    void TargetOffsetReset();

    // 模式控制
    bool ModeSwitch(CameraModeType modeType);
    T ModeGet<T>() where T : CameraModeComponent;

    // 基础操作
    void Reset();
    void Zoom(float delta);
    void Rotate(Vector2 delta);
}
```

**关键点**：
- ✅ 不包含 `Orbit` 等模式专用术语
- ✅ `ModeGet<T>()` 用于获取特定模式进行配置
- ✅ `TargetSet()` 是设置目标的统一入口

### 3.2 OrbitViewModeComponent 属性暴露

```csharp
public class OrbitViewModeComponent : CameraModeComponent
{
    // Prefab 可配置，运行时可修改
    public CameraAutoFitMode AutoFitMode { get; set; }
    public bool AdjustCenterToGeometry { get; set; }
    public float TargetScreenRatio { get; set; }

    // 手动触发（可选，目标变更时会自动触发）
    public void RequestAutoFit(CameraAutoFitMode mode, bool adjustCenter);
}
```

### 3.3 自动触发机制（已实现）

```csharp
// OrbitViewModeComponent.cs
protected override void OnTargetProviderChanged(ITargetProvider newProvider)
{
    // 当目标改变时，自动重新触发自动适配
    if (newProvider != null && m_isActive)
    {
        RequestAutoFit(m_currentAutoFitMode, m_adjustOrbitCenterToBoundsCenter);
    }
}
```

---

## 4. 实现方案

### 4.1 需要移除的代码

从 `CameraControllerV2.cs` 中移除以下方法：

```csharp
// ❌ 移除这些模式专用方法
bool OrbitTargetSet(ICameraFollowTarget target, CameraAutoFitMode mode, bool adjustCenter)
bool OrbitTargetSet(ITargetProvider provider, CameraAutoFitMode mode, bool adjustCenter)
void OrbitAutoFitRequest(CameraAutoFitMode mode, bool adjustCenter)
void OrbitAdjustCenterSet(bool adjustCenter)
bool OrbitAdjustCenterGet()
```

### 4.2 StageActorViewUIController 正确实现

```csharp
/// <summary>
/// 使用 V2 控制器设置环绕观察目标
/// 符合统一接口设计原则：
/// 1. 通过 ModeGet 获取模式并修改配置（如需覆盖 Prefab 默认值）
/// 2. 通过 TargetSet 设置目标（自动触发 AutoFit）
/// </summary>
protected void SetOrbitTargetV2(IStageActor stageActor, CameraAutoFitMode autoFitMode = CameraAutoFitMode.Capsule)
{
    if (m_cameraControllerV2 == null || stageActor == null)
    {
        return;
    }

    // 记录当前使用的适配模式
    m_currentAutoFitMode = autoFitMode;

    // 1. 如需覆盖默认配置，通过 ModeGet 修改模式属性
    var orbitMode = m_cameraControllerV2.ModeGet<OrbitViewModeComponent>();
    if (orbitMode != null)
    {
        // 设置适配模式和中心调整（覆盖 Prefab 默认值）
        orbitMode.AutoFitMode = autoFitMode;
        orbitMode.AdjustCenterToGeometry = true;
    }

    // 2. 创建 Provider 适配器
    var targetProvider = new FollowTargetProviderAdapter(stageActor);

    // 3. 设置目标（会自动触发 AutoFit，通过 OnTargetProviderChanged）
    m_cameraControllerV2.TargetSet(targetProvider);

    Debug.Log($"StageActorViewUIController: [V2] 目标已设置为 {stageActor.ActorId}, " +
              $"适配模式: {autoFitMode}");
}
```

### 4.3 调用示例对比

**旧方式（已废弃）**：
```csharp
// ❌ 调用控制器的模式专用方法
m_cameraControllerV2.OrbitTargetSet(stageActor, autoFitMode, true);
```

**新方式（推荐）**：
```csharp
// ✅ 修改模式配置 + 设置目标（自动触发）
var orbitMode = m_cameraControllerV2.ModeGet<OrbitViewModeComponent>();
if (orbitMode != null)
{
    orbitMode.AutoFitMode = autoFitMode;
}
m_cameraControllerV2.TargetSet(new FollowTargetProviderAdapter(stageActor));
```

---

## 5. 兼容性

### 5.1 旧版 CameraController 保持不变

```csharp
// 旧版接口保留，派生类可继续使用
if (m_cameraController != null)
{
    m_cameraController.FollowActorBind(stageActor);
    SetOrbitTarget(stageActor, CameraAutoFitMode.Capsule);
}
```

### 5.2 V2 向后兼容接口保留

```csharp
// CameraControllerV2 保留这些向后兼容方法
void FollowTargetBind(ICameraFollowTarget target);  // 内部创建 Adapter
void FollowTargetUnbind();
bool SwitchToOrbitView(ICameraFollowTarget target, CameraAutoFitMode mode);  // 便捷方法
```

---

## 6. 设计原则验证

| 原则 | 要求 | 本方案 | 符合 |
|-----|------|--------|:----:|
| 业务无关 | 接口不包含模式专用术语 | `TargetSet`, `ModeGet<T>` | ✅ |
| 职责分离 | Provider 提供数据，模块消费 | Provider 提供几何信息 | ✅ |
| 配置分离 | 参数在 Prefab 配置 | `AutoFitMode` 在 Prefab 序列化 | ✅ |
| 统一目标 | 所有模式使用统一 Target | `TargetSet(ITargetProvider)` | ✅ |
| 向后兼容 | 旧接口可用 | `FollowTargetBind` 保留 | ✅ |
| 积木式解耦 | 层级清晰 | Controller→统一接口→Mode | ✅ |

---

## 7. 实施步骤

### Step 1: 移除 CameraControllerV2 的模式专用方法
- 文件: `CameraControllerV2.cs`
- 移除: `OrbitTargetSet`, `OrbitAutoFitRequest`, `OrbitAdjustCenterSet`, `OrbitAdjustCenterGet`

### Step 2: 更新 StageActorViewUIController
- 文件: `StageActorViewUIController.cs`
- 修改: `SetOrbitTargetV2` 方法，使用 `ModeGet<T>()` + `TargetSet()` 模式

### Step 3: 验证自动触发机制
- 确认 `OrbitViewModeComponent.OnTargetProviderChanged` 正确触发 `RequestAutoFit`

### Step 4: 测试
- 验证 V2 控制器功能正常
- 验证旧版控制器兼容性

---

## 附录 A: 完整代码示例

### A.1 SetOrbitTargetV2 完整实现

```csharp
/// <summary>
/// 使用 V2 控制器设置环绕观察目标（统一接口）
///
/// 设计原则：
/// - 业务无关：不直接调用 Orbit 专用方法
/// - 配置分离：通过 ModeGet 修改模式属性
/// - 自动触发：TargetSet 会触发 OnTargetProviderChanged → RequestAutoFit
/// </summary>
/// <param name="stageActor">新的目标Actor</param>
/// <param name="autoFitMode">相机自动适配模式</param>
protected void SetOrbitTargetV2(IStageActor stageActor, CameraAutoFitMode autoFitMode = CameraAutoFitMode.Capsule)
{
    if (m_cameraControllerV2 == null || stageActor == null)
    {
        return;
    }

    // 记录当前使用的适配模式
    m_currentAutoFitMode = autoFitMode;

    // 1. 如需覆盖默认配置，通过 ModeGet 修改模式属性
    //    这符合"配置分离"原则：Prefab 配置默认值，运行时可修改
    var orbitMode = m_cameraControllerV2.ModeGet<OrbitViewModeComponent>();
    if (orbitMode != null)
    {
        orbitMode.AutoFitMode = autoFitMode;
        orbitMode.AdjustCenterToGeometry = true;
    }

    // 2. 创建 Provider 适配器
    //    Provider 内部自动检测胶囊体/包围盒，提供最佳观察参数
    var targetProvider = new FollowTargetProviderAdapter(stageActor);

    // 3. 设置目标
    //    会自动触发 OnTargetProviderChanged → RequestAutoFit
    //    这符合"业务无关"原则：控制器只调用统一接口
    m_cameraControllerV2.TargetSet(targetProvider);

    Debug.Log($"StageActorViewUIController: [V2] 目标已设置为 {stageActor.ActorId}, " +
              $"适配模式: {autoFitMode}, 将以目标胶囊体中心为观察中心");
}
```

### A.2 手动触发 AutoFit（可选场景）

```csharp
/// <summary>
/// 重置相机并重新初始化目标
/// 用于界面重新打开时，需要重新计算适配
/// </summary>
public virtual void CameraResetAndReinitializeTarget(CameraAutoFitMode autoFitMode)
{
    CameraReset();
    CameraTargetOffsetReset();

    if (m_currentDisplayedActor != null)
    {
        if (m_useV2Controller && m_cameraControllerV2 != null)
        {
            // 获取模式并手动触发 AutoFit
            var orbitMode = m_cameraControllerV2.ModeGet<OrbitViewModeComponent>();
            if (orbitMode != null)
            {
                orbitMode.AutoFitMode = autoFitMode;
                orbitMode.RequestAutoFit(autoFitMode, true);
            }
        }
        else if (m_cameraController != null)
        {
            SetOrbitTarget(m_currentDisplayedActor, autoFitMode);
        }
    }
}
```
## 完成总结                          
  已完成的修改                                                                                                                                    ┌──────────────────────────────────────────┬──────┬────────────────────────────────────────────────────────────────────┐
  │                   文件                   │ 操作 │                                说明                                │
  ├──────────────────────────────────────────┼──────┼────────────────────────────────────────────────────────────────────┤
  │ CameraControllerV2_OrbitTarget_Design.md │ 新建 │ 设计方案文档                                                       │
  ├──────────────────────────────────────────┼──────┼────────────────────────────────────────────────────────────────────┤
  │ CameraControllerV2.cs                    │ 移除 │ 移除 OrbitTargetSet, OrbitAutoFitRequest, OrbitAdjustCenterSet/Get │
  ├──────────────────────────────────────────┼──────┼────────────────────────────────────────────────────────────────────┤
  │ OrbitViewModeComponent.cs                │ 添加 │ AutoFitMode 和 AdjustCenterToGeometry 可读写属性                   │
  ├──────────────────────────────────────────┼──────┼────────────────────────────────────────────────────────────────────┤
  │ StageActorViewUIController.cs            │ 修改 │ SetOrbitTargetV2 使用 ModeGet + TargetSet 模式                     │
  └──────────────────────────────────────────┴──────┴────────────────────────────────────────────────────────────────────┘
  设计原则验证

  ✅ 业务无关：CameraControllerV2 接口不包含 Orbit 专用术语
  ✅ 配置分离：通过 ModeGet<T>() 修改模式属性
  ✅ 自动触发：TargetSet → OnTargetProviderChanged → RequestAutoFit
  ✅ 向后兼容：旧版 CameraController 接口保持不变

  数据流

  StageActorViewUIController.SetOrbitTargetV2(actor, mode)
      │
      ├─ 1. ModeGet<OrbitViewModeComponent>()
      │      └─ orbitMode.AutoFitMode = mode
      │
      ├─ 2. new FollowTargetProviderAdapter(actor)
      │
      └─ 3. TargetSet(provider)
             └─ OrbitViewMode.OnTargetProviderChanged()
                    └─ RequestAutoFit() [自动触发]