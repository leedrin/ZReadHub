# 配置模块 (Configuration) 设计文档

## 1. 模块定位 (Module Positioning)

`Config` 模块是相机系统的**数据定义层**。它通过 Unity `ScriptableObject` 实现“数据驱动”的重构目标，将相机模式、虚拟相机管线、原子逻辑模块的参数与代码实现彻底分离。

### 核心职责
- **按需加载**: 定义 `CameraController` 运行时需要实例化的模式子集，消除全量初始化的开销。
- **管线组装**: 通过配置文件定义 `VisualCamera` 内部 `Body/Aim/Noise` 模块的组合关系。
- **参数持久化**: 提供标准化的 Inspector 界面，供策划/美术调整相机手感而无需修改代码。

---

## 2. 核心数据结构 (Data Structures)

### 2.1 CameraModeConfig (模式配置单元)
定义单一相机模式的身份与构成。

```csharp
[Serializable]
public class CameraModeConfig
{
    public CameraModeType ModeType;           // 模式枚举标识 (如 OrbitView)
    public string ModeClassName;              // 对应 ICameraMode 的具体实现类名
    public ScriptableObject SharedSettings;   // 该模式下所有 VM 共享的业务参数
    public List<VisualCameraConfig> VMConfigs; // 该模式包含的虚拟相机管线列表
}
```

### 2.2 VisualCameraConfig (管线配置单元)
定义虚拟相机的逻辑流水线。

```csharp
[Serializable]
public class VisualCameraConfig
{
    public string VMName;                     // VM 唯一标识
    public int Priority;                      // VM 内部优先级（用于 VM 间混合）
    public List<ModuleConfig> Pipeline;       // 模块序列 (按 Body -> Aim -> Noise 排序)
}

[Serializable]
public class ModuleConfig
{
    public string ModuleClassName;            // ICameraModule 的实现类名
    public ScriptableObject ModuleSettings;   // 该模块专用的数学参数 (如轨道半径、平滑度)
}
```

---

## 3. 模块工厂与注册表 (Factory & Registry)

### 3.1 ICameraModeFactory (实例化引擎)
负责将静态配置转化为运行时的对象树。
- **职责**: 递归实例化 `CameraMode` -> `VisualCamera` -> `ICameraModule`。
- **注入**: 实例化时将 `ModuleSettings` 注入到对应的模块实例中。

### 3.2 ICameraModeRegistry (运行时容器)
- **职责**: 维护 `Dictionary<CameraModeType, ICameraMode>`，支持 O(1) 级别的模式查询。
- **生命周期**: 仅在 `CameraController.Initialize` 时根据配置列表进行一次性填充。

---

## 4. 数据主权与约束 (Sovereignty & Constraints)

- **数据隔离**: `Config` 模块仅负责数据的**定义与持有**。严禁在 `ScriptableObject` 中编写任何运行时的位姿计算逻辑。
- **禁止交叉引用**: 模块配置（`ModuleSettings`）应当是独立的。例如 `OrbitModuleSettings` 不应引用 `CameraController` 或 `Transform`。
- **只读性**: 在运行时，`ICameraModule` 应该以**只读**方式访问 `ModuleSettings`，严禁在 Tick 过程中通过代码修改 SO 文件中的值。

---

## 5. 交互流程 (Workflow)

1. **策划阶段**: 在 Project 窗口创建 `CameraAssetConfig.asset`。
2. **配置阶段**: 在 Asset 中添加 `OrbitView` 模式，并为其分配 `OrbitalTransposer` 模块和对应的半径参数。
3. **启动阶段**: `CameraController` 加载 Asset，调用 `Factory` 生成模式实例。
4. **运行阶段**: `M-CORE` 接收到 `SwitchMode(OrbitView)` 指令，从 `Registry` 获取已配置好的实例并激活。

---

## 6. 上下文快照 (Context Snapshot)

### [M-CONFIG 设计快照]
- **定位**: 系统的静态蓝图。
- **上游**: 策划/美术（通过 Unity Inspector）。
- **下游**: 为 `M-CORE` 提供初始化的实例列表。
- **数据隔离**: 拥有所有 `ScriptableObject` 的定义权。
- **约束**: 严禁包含任何 `Update` 或 `LateUpdate` 逻辑；严禁在运行时修改磁盘上的 SO 数据。