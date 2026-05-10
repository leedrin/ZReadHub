# UIProcess 可视化编辑器 - 阶段二详细功能设计文档

> **版本**: v1.1
> **日期**: 2025-12-23
> **基于**: BJFramework UITask/UIProcess 架构 + AdvanceUIStateController 模块化系统
> **前置文档**: UIProcess_Visual_Editor_Phase2_Development_Document.md
> **变更记录**: v1.1 - 增强错误处理、性能优化、接口扩展、事件总线设计

---

## 目录

1. [概述与目标](#1-概述与目标)
2. [AdvanceUIStateController 模块架构分析](#2-advanceuistatecontroller-模块架构分析)
3. [运行时 UIProcess 实现](#3-运行时-uiprocess-实现)
4. [动画信息提取器增强](#4-动画信息提取器增强)
5. [编辑器功能增强](#5-编辑器功能增强)
6. [集成设计](#6-集成设计)
7. [数据流与时序图](#7-数据流与时序图)
8. [开发计划与任务分解](#8-开发计划与任务分解)
9. [测试策略](#9-测试策略)
10. [改进建议与最佳实践](#10-改进建议与最佳实践)

---

## 1. 概述与目标

### 1.1 阶段一回顾

阶段一已完成：
- 数据模型层：`UIProcessDataAsset`、`TrackData`、`ClipData` 及其子类
- 动画信息提取框架：`AnimationInfo`、`IAnimationInfoProvider` 接口
- UIElements 编辑器基础框架
- 运行时播放器骨架：`UIProcessRuntimePlayer`、`UIProcessBuilder`

**核心问题**：`UIProcessBuilder.BuildClip()` 中 `StateClipData`、`LogicClipData` 等类型仍返回占位的 `DelayProcess`，未实现真正的状态切换和逻辑执行。

### 1.2 阶段二目标

1. **实现运行时核心逻辑**
   - `UIStateEffectProcess`：驱动 `AdvanceUIStateController` 状态切换
   - `UIExecutorProcess`：执行 C# 方法调用
   - `UIAudioProcess`：播放音效
   - `UILoopProcess` / `UIJumpProcess`：控制流逻辑

2. **深度集成 AdvanceUIStateController 模块系统**
   - 针对 `UIStateModuleAnimator`、`UIStateModuleTween`、`UIStateModuleAnimatorStateMachine`、`UIStateModuleGameObjectEnable` 实现专用的动画信息提取器
   - 正确处理各模块的完成回调机制

3. **编辑器功能增强**
   - Undo/Redo 支持
   - 运行时预览与 `AdvanceUIStateController` 联动
   - `LogicClip` 参数字典编辑 UI
   - 动画信息硬化（Bake）机制

---

## 2. AdvanceUIStateController 模块架构分析

### 2.1 核心架构

```
AdvanceUIStateController (状态机控制器)
    │
    ├── IUIStateModule 接口
    │   ├── Init()                    // 初始化
    │   ├── EnterState(state, immediateComplete, onFinished)  // 进入状态
    │   ├── ResetToBegin(state)       // 重置到开始
    │   ├── SetToFinish(state)        // 立即完成
    │   └── Tick()                    // 每帧更新
    │
    └── UIStateModuleBase<T> 泛型基类
        ├── m_elements: List<T>       // 状态元素列表
        ├── m_stateName: string       // 当前状态名
        ├── m_moduleState: Enum       // Inited/Executing/Finished
        │
        ├── StartState()              // 开始状态（抽象）
        ├── RevertState()             // 重置状态（抽象）
        ├── FinishState()             // 完成状态（抽象）
        ├── OnTick()                  // Tick逻辑（抽象）
        └── OnEnterStateFinished()    // 状态完成回调
```

### 2.2 关键模块详细分析

#### 2.2.1 UIStateModuleAnimator

**功能**：通过 Animator 播放 UI 动画

**核心字段**：
```csharp
public class UIStateModuleElementAnimator : UIStateModuleElementBase
{
    public int m_stateNameHash;           // 状态名 Hash（运行时计算）
    public bool m_useAnimatorParam;       // 使用参数触发 vs 直接播放状态
    public AnimatorControllerParameterType m_paramType;  // Trigger/Bool/Int/Float
    public float m_floatValue;
    public int m_intValue;
    public bool m_boolValue;
}
```

**状态完成机制**：
1. 注册 `UIStateModuleAnimatorStateMachine.EventOnStateEnd` 事件
2. `UIStateModuleAnimatorStateMachine` 在 `OnStateUpdate()` 中检测 `normalizedTime >= 1`
3. 触发 `EventOnStateEnd(stateName)` 回调
4. `UIStateModuleAnimator.OnAnimatorStateEnd()` 调用 `OnEnterStateFinished()`

**动画时长获取**：
- 需要通过 `AnimatorController` 获取 `AnimatorState` 的 `Motion`（AnimationClip）
- 时长 = `AnimationClip.length`
- 需处理 `Transition` 过渡时间

#### 2.2.2 UIStateModuleTween

**功能**：播放 `TweenMain` 动画列表

**核心字段**：
```csharp
public class UIStateModuleElementTween : UIStateModuleElementBase
{
    public List<TweenMain> m_tweenList;              // Tween 列表
    [NonSerialized] public float m_lifeTime;         // 计算的生命周期
    [NonSerialized] public List<GameObject> m_disableGosByTweenAplha;  // 需禁用的对象
}
```

**状态完成机制**：
1. `StartState()` 中播放所有 Tween，计算 `m_lifeOutTime = DateTime.Now + lifeTime`
2. `OnTick()` 中检测 `DateTime.Now >= m_lifeOutTime`
3. 到时后调用 `OnEnterStateFinished()`

**动画时长计算**（`CollectElementInfo()`）：
```csharp
foreach (var tween in m_tweenList)
{
    float lifeTime = m_delayTimeInSec + tween.duration + tween.delay;
    if (tween.style == TweenMain.Style.Once && lifeTime > maxDuration)
    {
        maxDuration = lifeTime;
    }
}
m_lifeTime = maxDuration;
```

#### 2.2.3 UIStateModuleAnimatorStateMachine

**功能**：`StateMachineBehaviour`，用于检测 Animator 状态播放完成

**核心逻辑**：
```csharp
public override void OnStateUpdate(Animator animator, AnimatorStateInfo stateInfo, int layerIndex)
{
    if (!m_isStateEndTriggerd && stateInfo.normalizedTime >= 1)
    {
        m_isStateEndTriggerd = true;
        EventOnStateEnd?.Invoke(m_stateName);
    }
}

public override void OnStateExit(Animator animator, AnimatorStateInfo stateInfo, int layerIndex)
{
    m_isStateEndTriggerd = false;  // 重置标记，允许下次触发
}
```

**注意事项**：
- 同状态切换时，Unity 会为每个 State 创建 StateInstance
- 需要 `m_isStateEndTriggerd` 标记防止重复触发

#### 2.2.4 UIStateModuleGameObjectEnable

**功能**：激活/禁用 GameObject 列表

**核心字段**：
```csharp
public class UIStateModuleElementGameObjectEnable : UIStateModuleElementBase
{
    public List<GameObject> m_enableGameObjectList;  // 激活对象列表
}
```

**状态完成机制**：
- `StartState()` 中激活所有对象后**立即**调用 `OnEnterStateFinished()`
- 这是即时操作，没有动画时长

**动画时长**：
- 固定为 0（或使用 `m_delayTimeInSec` 延迟）

### 2.3 模块完成回调流程

```
AdvanceUIStateController.SetToUIState(stateName, immediateComplete, ..., onFinished)
    │
    ├── EnterState()
    │   ├── SetModuleState() → 遍历所有 IUIStateModule.EnterState()
    │   │   └── UIStateModuleBase.EnterState() → StartState()
    │   │       ├── [Animator] 播放动画，等待 OnAnimatorStateEnd
    │   │       ├── [Tween] 播放Tween，等待 m_lifeOutTime
    │   │       └── [GameObject] 激活对象，立即 OnEnterStateFinished
    │   │
    │   └── TrySetChildState() → 子 StateController 递归处理
    │
    └── CheckEnterStateCompleted()
        ├── 检查所有 Module 完成（m_moduleCompletedCount == m_stateModules.Count）
        ├── 检查子状态完成（m_childStateCompleted）
        └── 全部完成后 → OnEnterStateCompleted() → onFinished(true)
```

---

## 3. 运行时 UIProcess 实现

### 3.1 UIStateEffectProcess

**职责**：触发 `AdvanceUIStateController` 状态切换，并正确处理完成回调

#### 3.1.1 类设计

```csharp
namespace BlackJack.BJFramework.Runtime.UI
{
    /// <summary>
    /// UI 状态效果 Process
    /// 驱动 AdvanceUIStateController 进行状态切换
    /// </summary>
    public class UIStateEffectProcess : UIProcess
    {
        #region 常量定义

        /// <summary>
        /// 日志标签
        /// </summary>
        private const string LOG_TAG = "[UIStateEffectProcess]";

        /// <summary>
        /// 状态验证失败的错误码
        /// </summary>
        private const int ERROR_CODE_NULL_CONTROLLER = 1001;
        private const int ERROR_CODE_EMPTY_STATE_NAME = 1002;
        private const int ERROR_CODE_INVALID_STATE = 1003;

        #endregion

        #region 字段

        /// <summary>
        /// 目标 StateController
        /// </summary>
        private readonly AdvanceUIStateController m_stateController;

        /// <summary>
        /// 目标状态名称
        /// </summary>
        private readonly string m_stateName;

        /// <summary>
        /// 是否等待动画完成
        /// </summary>
        private readonly bool m_waitForCompletion;

        /// <summary>
        /// 是否刷新同状态
        /// </summary>
        private readonly bool m_refreshSameState;

        /// <summary>
        /// 是否立即完成（跳过动画）
        /// </summary>
        private readonly bool m_immediateComplete;

        /// <summary>
        /// 状态切换是否已完成
        /// </summary>
        private bool m_isStateChangeCompleted;

        /// <summary>
        /// 错误信息（用于调试）
        /// </summary>
        private string m_errorMessage;

        #endregion

        #region 构造函数

        /// <summary>
        /// 构造函数
        /// </summary>
        /// <param name="stateController">目标 StateController（不可为 null）</param>
        /// <param name="stateName">状态名称（不可为空）</param>
        /// <param name="waitForCompletion">是否等待完成</param>
        /// <param name="immediateComplete">是否立即完成</param>
        /// <param name="refreshSameState">是否刷新同状态</param>
        /// <exception cref="ArgumentNullException">stateController 为 null 时抛出</exception>
        /// <exception cref="ArgumentException">stateName 为空时抛出</exception>
        public UIStateEffectProcess(
            AdvanceUIStateController stateController,
            string stateName,
            bool waitForCompletion = true,
            bool immediateComplete = false,
            bool refreshSameState = true)
            : base(ProcessExecMode.Serial)
        {
            // 构造时进行参数验证，提前暴露问题
            if (stateController == null)
            {
                m_errorMessage = $"StateController 为 null，状态：{stateName}";
                Debug.LogError($"{LOG_TAG} [Error:{ERROR_CODE_NULL_CONTROLLER}] {m_errorMessage}");
            }

            if (string.IsNullOrEmpty(stateName))
            {
                m_errorMessage = "状态名称为空";
                Debug.LogError($"{LOG_TAG} [Error:{ERROR_CODE_EMPTY_STATE_NAME}] {m_errorMessage}");
            }

            m_stateController = stateController;
            m_stateName = stateName ?? string.Empty;
            m_waitForCompletion = waitForCompletion;
            m_immediateComplete = immediateComplete;
            m_refreshSameState = refreshSameState;
            m_isStateChangeCompleted = false;
        }

        #endregion

        #region 属性

        /// <summary>
        /// 是否有效（StateController 和 StateName 都有效）
        /// </summary>
        public bool IsValid => m_stateController != null && !string.IsNullOrEmpty(m_stateName);

        /// <summary>
        /// 目标状态名称
        /// </summary>
        public string StateName => m_stateName;

        /// <summary>
        /// 错误信息
        /// </summary>
        public string ErrorMessage => m_errorMessage;

        #endregion

        #region 生命周期

        protected override void OnStart()
        {
            base.OnStart();

            // 参数已在构造函数中验证，这里直接检查有效性
            if (!IsValid)
            {
                Debug.LogWarning($"{LOG_TAG} Process 无效，直接完成。错误：{m_errorMessage}");
                OnComplete();
                return;
            }

            // 验证状态是否存在于 StateController 中
            if (!ValidateStateExists())
            {
                m_errorMessage = $"状态 '{m_stateName}' 在 StateController '{m_stateController.gameObject.name}' 中不存在";
                Debug.LogWarning($"{LOG_TAG} [Error:{ERROR_CODE_INVALID_STATE}] {m_errorMessage}");
                OnComplete();
                return;
            }

            // 如果不等待完成，立即标记完成
            if (!m_waitForCompletion)
            {
                ExecuteStateChange(onFinished: null);
                OnComplete();
                return;
            }

            // 等待完成模式：注册回调
            ExecuteStateChange(OnStateChangeFinished);
        }

        protected override void OnStop(StopOption opt)
        {
            base.OnStop(opt);

            // 安全检查：确保 StateController 仍然有效
            if (m_stateController == null || m_isStateChangeCompleted)
                return;

            // 如果被强制停止，尝试立即完成状态切换
            if (opt == StopOption.Complete)
            {
                m_stateController.StopStateChanging(isReset: false);  // 完成状态
            }
            else if (opt == StopOption.Cancel)
            {
                m_stateController.StopStateChanging(isReset: true);   // 重置状态
            }
        }

        #endregion

        #region 内部方法

        /// <summary>
        /// 验证状态是否存在
        /// </summary>
        private bool ValidateStateExists()
        {
            // 检查 StateController 的状态列表中是否包含目标状态
            return m_stateController.m_stateName != null
                && m_stateController.m_stateName.Contains(m_stateName);
        }

        /// <summary>
        /// 执行状态切换
        /// </summary>
        private void ExecuteStateChange(Action<bool> onFinished)
        {
            m_stateController.SetToUIState(
                m_stateName,
                m_immediateComplete,
                m_refreshSameState,
                onFinished,
                resetLastState: true
            );
        }

        #endregion

        #region 回调处理

        /// <summary>
        /// 状态切换完成回调
        /// </summary>
        private void OnStateChangeFinished(bool isSuccess)
        {
            m_isStateChangeCompleted = true;

            if (!isSuccess)
            {
                Debug.LogWarning($"{LOG_TAG} 状态切换失败：{m_stateName}");
            }

            // 状态为 Started 时才调用 OnComplete（避免已被停止时重复调用）
            if (m_state == UIProcessState.Started)
            {
                OnComplete();
            }
        }

        #endregion

        #region 调试

        public override string ToString()
        {
            string validStr = IsValid ? "Valid" : "Invalid";
            return $"UIStateEffectProcess[{m_stateName}, {validStr}]";
        }

        #endregion
    }
}
```

#### 3.1.2 UIProcessBuilder 集成

修改 `UIProcessBuilder.BuildClip()` 中对 `StateClipData` 的处理：

```csharp
public static UIProcess BuildClip(ClipData clip, IStateControllerResolver resolver)
{
    if (clip == null)
        return null;

    UIProcess process = null;

    if (clip is StateClipData stateClip)
    {
        // 通过 resolver 获取 StateController 实例
        var controller = resolver?.ResolveController(stateClip.TargetControllerName);

        if (controller != null)
        {
            process = new UIStateEffectProcess(
                controller,
                stateClip.StateName,
                stateClip.WaitForCompletion,
                immediateComplete: false,
                refreshSameState: true
            );
        }
        else
        {
            Debug.LogWarning($"[UIProcessBuilder] 未找到 Controller: {stateClip.TargetControllerName}");
            process = new DelayProcess(stateClip.Duration);
        }
    }
    // ... 其他类型处理
}
```

#### 3.1.3 IStateControllerResolver 接口

```csharp
/// <summary>
/// StateController 解析器接口
/// 用于在运行时查找 AdvanceUIStateController 实例
/// </summary>
public interface IStateControllerResolver
{
    /// <summary>
    /// 根据名称解析 StateController
    /// </summary>
    /// <param name="controllerName">Controller 名称</param>
    /// <returns>找到的 Controller，未找到返回 null</returns>
    AdvanceUIStateController ResolveController(string controllerName);

    /// <summary>
    /// 尝试解析 StateController（推荐使用，避免 null 检查）
    /// </summary>
    /// <param name="controllerName">Controller 名称</param>
    /// <param name="controller">输出参数：找到的 Controller</param>
    /// <returns>是否找到</returns>
    bool TryResolveController(string controllerName, out AdvanceUIStateController controller);

    /// <summary>
    /// 获取所有已注册的 Controller 名称
    /// </summary>
    IEnumerable<string> GetAllControllerNames();

    /// <summary>
    /// 检查指定名称的 Controller 是否已注册
    /// </summary>
    bool HasController(string controllerName);

    /// <summary>
    /// 已注册的 Controller 数量
    /// </summary>
    int Count { get; }
}

/// <summary>
/// 基于 UIController 的 StateController 解析器
/// </summary>
public class UIControllerBasedResolver : IStateControllerResolver
{
    #region 常量

    private const string LOG_TAG = "[UIControllerBasedResolver]";

    #endregion

    #region 字段

    private readonly Dictionary<string, AdvanceUIStateController> m_controllerMap;

    #endregion

    #region 构造函数

    public UIControllerBasedResolver()
    {
        m_controllerMap = new Dictionary<string, AdvanceUIStateController>();
    }

    #endregion

    #region 属性

    /// <summary>
    /// 已注册的 Controller 数量
    /// </summary>
    public int Count => m_controllerMap.Count;

    #endregion

    #region 公共方法

    /// <summary>
    /// 注册 Controller
    /// </summary>
    /// <param name="name">注册名称</param>
    /// <param name="controller">Controller 实例</param>
    /// <returns>是否注册成功</returns>
    public bool RegisterController(string name, AdvanceUIStateController controller)
    {
        if (string.IsNullOrEmpty(name))
        {
            Debug.LogWarning($"{LOG_TAG} 注册失败：名称为空");
            return false;
        }

        if (controller == null)
        {
            Debug.LogWarning($"{LOG_TAG} 注册失败：Controller 为 null，名称：{name}");
            return false;
        }

        // 检查重复注册
        if (m_controllerMap.ContainsKey(name))
        {
            Debug.LogWarning($"{LOG_TAG} 覆盖已存在的 Controller：{name}");
        }

        m_controllerMap[name] = controller;
        return true;
    }

    /// <summary>
    /// 从 UIController 的 AdvanceUIStateController 组件注册
    /// </summary>
    /// <param name="uiController">UIController 实例</param>
    /// <returns>注册的 Controller 数量</returns>
    public int RegisterFromUIController(UIControllerBase uiController)
    {
        if (uiController == null)
        {
            Debug.LogWarning($"{LOG_TAG} UIController 为 null");
            return 0;
        }

        var controllers = uiController.GetComponentsInChildren<AdvanceUIStateController>(true);
        int registeredCount = 0;

        foreach (var controller in controllers)
        {
            string name = controller.gameObject.name;
            if (RegisterController(name, controller))
            {
                registeredCount++;
            }
        }

        return registeredCount;
    }

    /// <summary>
    /// 解析 Controller
    /// </summary>
    public AdvanceUIStateController ResolveController(string controllerName)
    {
        TryResolveController(controllerName, out var controller);
        return controller;
    }

    /// <summary>
    /// 尝试解析 Controller（推荐使用）
    /// </summary>
    public bool TryResolveController(string controllerName, out AdvanceUIStateController controller)
    {
        controller = null;

        if (string.IsNullOrEmpty(controllerName))
            return false;

        return m_controllerMap.TryGetValue(controllerName, out controller) && controller != null;
    }

    /// <summary>
    /// 检查是否包含指定 Controller
    /// </summary>
    public bool HasController(string controllerName)
    {
        return !string.IsNullOrEmpty(controllerName) && m_controllerMap.ContainsKey(controllerName);
    }

    /// <summary>
    /// 获取所有 Controller 名称
    /// </summary>
    public IEnumerable<string> GetAllControllerNames()
    {
        return m_controllerMap.Keys;
    }

    /// <summary>
    /// 注销指定 Controller
    /// </summary>
    public bool UnregisterController(string name)
    {
        return m_controllerMap.Remove(name);
    }

    /// <summary>
    /// 清空所有注册
    /// </summary>
    public void Clear()
    {
        m_controllerMap.Clear();
    }

    #endregion
}
```

### 3.2 UIExecutorProcess

**职责**：执行指定的 C# 方法

#### 3.2.1 类设计

```csharp
namespace BlackJack.BJFramework.Runtime.UI
{
    /// <summary>
    /// 逻辑执行 Process
    /// 通过反射或预注册机制执行指定方法
    /// </summary>
    public class UIExecutorProcess : UIProcess
    {
        #region 字段

        private string m_methodName;
        private string m_targetTypeName;
        private SerializableDictionary m_parameters;
        private object m_targetInstance;

        // 预注册的执行器
        private static Dictionary<string, IUIProcessExecutor> s_executorRegistry
            = new Dictionary<string, IUIProcessExecutor>();

        #endregion

        #region 静态注册

        /// <summary>
        /// 注册执行器
        /// </summary>
        public static void RegisterExecutor(string methodKey, IUIProcessExecutor executor)
        {
            s_executorRegistry[methodKey] = executor;
        }

        /// <summary>
        /// 注销执行器
        /// </summary>
        public static void UnregisterExecutor(string methodKey)
        {
            s_executorRegistry.Remove(methodKey);
        }

        #endregion

        #region 构造函数

        public UIExecutorProcess(
            string methodName,
            string targetTypeName,
            SerializableDictionary parameters,
            object targetInstance = null)
            : base(ProcessExecMode.Serial)
        {
            m_methodName = methodName;
            m_targetTypeName = targetTypeName;
            m_parameters = parameters;
            m_targetInstance = targetInstance;
        }

        #endregion

        #region 生命周期

        protected override void OnStart()
        {
            base.OnStart();

            try
            {
                // 优先尝试预注册的执行器
                string executorKey = $"{m_targetTypeName}.{m_methodName}";
                if (s_executorRegistry.TryGetValue(executorKey, out var executor))
                {
                    executor.Execute(m_parameters, OnExecutionComplete);
                    return;
                }

                // 回退到反射调用
                ExecuteViaReflection();
            }
            catch (Exception e)
            {
                Debug.LogError($"[UIExecutorProcess] 执行失败：{m_methodName}, 错误：{e.Message}");
                OnComplete();
            }
        }

        #endregion

        #region 反射执行

        private void ExecuteViaReflection()
        {
            if (string.IsNullOrEmpty(m_targetTypeName) || string.IsNullOrEmpty(m_methodName))
            {
                Debug.LogWarning("[UIExecutorProcess] 类型名或方法名为空");
                OnComplete();
                return;
            }

            // 查找类型
            Type targetType = Type.GetType(m_targetTypeName);
            if (targetType == null)
            {
                // 尝试在所有程序集中查找
                foreach (var assembly in AppDomain.CurrentDomain.GetAssemblies())
                {
                    targetType = assembly.GetType(m_targetTypeName);
                    if (targetType != null)
                        break;
                }
            }

            if (targetType == null)
            {
                Debug.LogError($"[UIExecutorProcess] 未找到类型：{m_targetTypeName}");
                OnComplete();
                return;
            }

            // 查找方法
            var method = targetType.GetMethod(
                m_methodName,
                BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance
            );

            if (method == null)
            {
                Debug.LogError($"[UIExecutorProcess] 未找到方法：{m_targetTypeName}.{m_methodName}");
                OnComplete();
                return;
            }

            // 构建参数
            var methodParams = method.GetParameters();
            object[] args = BuildMethodArguments(methodParams);

            // 执行方法
            object result = method.Invoke(method.IsStatic ? null : m_targetInstance, args);

            // 如果返回 IEnumerator，作为协程执行
            if (result is IEnumerator enumerator)
            {
                DelayExecutor.Instance.StartCoroutine(ExecuteCoroutine(enumerator));
            }
            else
            {
                OnComplete();
            }
        }

        private object[] BuildMethodArguments(ParameterInfo[] paramInfos)
        {
            if (paramInfos == null || paramInfos.Length == 0)
                return null;

            object[] args = new object[paramInfos.Length];

            for (int i = 0; i < paramInfos.Length; i++)
            {
                var paramInfo = paramInfos[i];
                string paramName = paramInfo.Name;

                if (m_parameters != null && m_parameters.TryGetValue(paramName, out string strValue))
                {
                    args[i] = ConvertParameter(strValue, paramInfo.ParameterType);
                }
                else if (paramInfo.HasDefaultValue)
                {
                    args[i] = paramInfo.DefaultValue;
                }
                else
                {
                    args[i] = paramInfo.ParameterType.IsValueType
                        ? Activator.CreateInstance(paramInfo.ParameterType)
                        : null;
                }
            }

            return args;
        }

        private object ConvertParameter(string strValue, Type targetType)
        {
            if (targetType == typeof(string))
                return strValue;
            if (targetType == typeof(int))
                return int.TryParse(strValue, out int intVal) ? intVal : 0;
            if (targetType == typeof(float))
                return float.TryParse(strValue, out float floatVal) ? floatVal : 0f;
            if (targetType == typeof(bool))
                return bool.TryParse(strValue, out bool boolVal) && boolVal;
            if (targetType.IsEnum)
                return Enum.TryParse(targetType, strValue, out object enumVal) ? enumVal : 0;

            // 尝试 JSON 反序列化
            try
            {
                return JsonUtility.FromJson(strValue, targetType);
            }
            catch
            {
                return null;
            }
        }

        private IEnumerator ExecuteCoroutine(IEnumerator coroutine)
        {
            yield return coroutine;
            OnExecutionComplete(true);
        }

        #endregion

        #region 回调

        private void OnExecutionComplete(bool success)
        {
            if (m_state == UIProcessState.Started)
            {
                OnComplete();
            }
        }

        #endregion
    }

    /// <summary>
    /// UIProcess 执行器接口
    /// </summary>
    public interface IUIProcessExecutor
    {
        /// <summary>
        /// 执行逻辑
        /// </summary>
        /// <param name="parameters">参数字典</param>
        /// <param name="onComplete">完成回调</param>
        void Execute(SerializableDictionary parameters, Action<bool> onComplete);
    }
}
```

### 3.3 UIAudioProcess

**职责**：播放 UI 音效

```csharp
namespace BlackJack.BJFramework.Runtime.UI
{
    /// <summary>
    /// 音频播放 Process
    /// </summary>
    public class UIAudioProcess : UIProcess
    {
        #region 字段

        private string m_audioPath;
        private float m_volume;
        private bool m_loop;
        private float m_fadeInDuration;
        private float m_fadeOutDuration;
        private float m_duration;

        // 音频管理器接口（需要根据项目实际情况实现）
        private static IAudioManager s_audioManager;

        #endregion

        #region 静态设置

        /// <summary>
        /// 设置音频管理器
        /// </summary>
        public static void SetAudioManager(IAudioManager manager)
        {
            s_audioManager = manager;
        }

        #endregion

        #region 构造函数

        public UIAudioProcess(
            string audioPath,
            float volume = 1f,
            bool loop = false,
            float fadeInDuration = 0f,
            float fadeOutDuration = 0f,
            float duration = 0f)
            : base(ProcessExecMode.Serial)
        {
            m_audioPath = audioPath;
            m_volume = volume;
            m_loop = loop;
            m_fadeInDuration = fadeInDuration;
            m_fadeOutDuration = fadeOutDuration;
            m_duration = duration;
        }

        #endregion

        #region 生命周期

        protected override void OnStart()
        {
            base.OnStart();

            if (s_audioManager == null)
            {
                Debug.LogWarning("[UIAudioProcess] 未设置音频管理器");
                OnComplete();
                return;
            }

            if (string.IsNullOrEmpty(m_audioPath))
            {
                Debug.LogWarning("[UIAudioProcess] 音频路径为空");
                OnComplete();
                return;
            }

            // 播放音效
            s_audioManager.PlaySound(
                m_audioPath,
                m_volume,
                m_loop,
                m_fadeInDuration,
                OnAudioComplete
            );

            // 如果是循环播放或没有指定时长，立即完成 Process
            // 音效会持续播放，直到被显式停止
            if (m_loop || m_duration <= 0)
            {
                OnComplete();
            }
            else
            {
                // 非循环，等待指定时长后完成
                DelayExecutor.Instance.ExecuteAfterDelay(m_duration, () =>
                {
                    if (m_state == UIProcessState.Started)
                    {
                        OnComplete();
                    }
                });
            }
        }

        protected override void OnStop(StopOption opt)
        {
            base.OnStop(opt);

            // 停止时淡出音效
            if (m_fadeOutDuration > 0)
            {
                s_audioManager?.FadeOutSound(m_audioPath, m_fadeOutDuration);
            }
            else
            {
                s_audioManager?.StopSound(m_audioPath);
            }
        }

        #endregion

        #region 回调

        private void OnAudioComplete()
        {
            if (m_state == UIProcessState.Started && !m_loop)
            {
                OnComplete();
            }
        }

        #endregion
    }

    /// <summary>
    /// 音频管理器接口
    /// </summary>
    public interface IAudioManager
    {
        /// <summary>
        /// 是否已初始化
        /// </summary>
        bool IsInitialized { get; }

        /// <summary>
        /// 播放音效
        /// </summary>
        /// <param name="path">音效资源路径</param>
        /// <param name="volume">音量 (0-1)</param>
        /// <param name="loop">是否循环</param>
        /// <param name="fadeIn">淡入时长（秒）</param>
        /// <param name="onComplete">播放完成回调</param>
        void PlaySound(string path, float volume, bool loop, float fadeIn, Action onComplete);

        /// <summary>
        /// 停止音效
        /// </summary>
        /// <param name="path">音效资源路径</param>
        void StopSound(string path);

        /// <summary>
        /// 淡出音效
        /// </summary>
        /// <param name="path">音效资源路径</param>
        /// <param name="duration">淡出时长（秒）</param>
        void FadeOutSound(string path, float duration);

        /// <summary>
        /// 检查音效是否正在播放
        /// </summary>
        /// <param name="path">音效资源路径</param>
        bool IsPlaying(string path);
    }
}
```

### 3.4 UILoopProcess 与 UIJumpProcess

**职责**：实现控制流逻辑

```csharp
namespace BlackJack.BJFramework.Runtime.UI
{
    /// <summary>
    /// 循环控制 Process
    /// </summary>
    public class UILoopProcess : UIProcess
    {
        #region 字段

        private string m_targetSectionName;
        private int m_loopCount;
        private int m_currentLoop;
        private UIProcessRuntimePlayer m_player;

        #endregion

        #region 构造函数

        public UILoopProcess(
            UIProcessRuntimePlayer player,
            string targetSectionName,
            int loopCount)
            : base(ProcessExecMode.Serial)
        {
            m_player = player;
            m_targetSectionName = targetSectionName;
            m_loopCount = loopCount;
            m_currentLoop = 0;
        }

        #endregion

        #region 生命周期

        protected override void OnStart()
        {
            base.OnStart();

            if (m_player == null || string.IsNullOrEmpty(m_targetSectionName))
            {
                OnComplete();
                return;
            }

            // 无限循环
            if (m_loopCount == -1)
            {
                m_player.JumpToSection(m_targetSectionName);
                // 注意：无限循环不会完成，需要外部中断
                return;
            }

            // 有限循环
            m_currentLoop++;
            if (m_currentLoop < m_loopCount)
            {
                m_player.JumpToSection(m_targetSectionName);
                // 不调用 OnComplete，让 Player 从 Section 重新开始
            }
            else
            {
                // 循环结束
                OnComplete();
            }
        }

        #endregion
    }

    /// <summary>
    /// 跳转控制 Process
    /// </summary>
    public class UIJumpProcess : UIProcess
    {
        #region 字段

        private string m_targetSectionName;
        private string m_condition;
        private UIProcessRuntimePlayer m_player;

        #endregion

        #region 构造函数

        public UIJumpProcess(
            UIProcessRuntimePlayer player,
            string targetSectionName,
            string condition = null)
            : base(ProcessExecMode.Serial)
        {
            m_player = player;
            m_targetSectionName = targetSectionName;
            m_condition = condition;
        }

        #endregion

        #region 生命周期

        protected override void OnStart()
        {
            base.OnStart();

            if (m_player == null || string.IsNullOrEmpty(m_targetSectionName))
            {
                OnComplete();
                return;
            }

            // 检查条件
            if (!string.IsNullOrEmpty(m_condition) && !EvaluateCondition())
            {
                OnComplete();
                return;
            }

            // 执行跳转
            m_player.JumpToSection(m_targetSectionName);
            // 跳转后不调用 OnComplete，播放流程从目标 Section 继续
        }

        private bool EvaluateCondition()
        {
            // TODO: 实现条件表达式解析
            // 可以支持简单的布尔表达式或调用预注册的条件检查器
            return true;
        }

        #endregion
    }
}
```

### 3.5 UIProcessBuilder 完整修改

```csharp
/// <summary>
/// UIProcess 构建上下文
/// </summary>
public class UIProcessBuildContext
{
    public IStateControllerResolver ControllerResolver { get; set; }
    public UIProcessRuntimePlayer Player { get; set; }
    public Dictionary<string, float> SectionStartTimes { get; set; }
}

public static class UIProcessBuilder
{
    /// <summary>
    /// 构建 UIProcess 树
    /// </summary>
    public static UIProcess Build(UIProcessDataAsset asset, UIProcessBuildContext context)
    {
        if (asset == null || context == null)
        {
            Debug.LogError("[UIProcessBuilder] asset 或 context 为 null");
            return null;
        }

        // 预处理 Section 数据
        context.SectionStartTimes = new Dictionary<string, float>();
        foreach (var section in asset.Sections)
        {
            context.SectionStartTimes[section.SectionName] = section.StartTime;
        }

        // 构建根 Process
        var rootProcess = CreateContainerProcess(asset.GlobalMode);
        rootProcess.SetProcessName($"Root_{asset.AssetName}");

        if (asset.GlobalMode == UIProcess.ProcessExecMode.Parallel)
        {
            BuildParallelMode(rootProcess, asset, context);
        }
        else
        {
            BuildSerialMode(rootProcess, asset, context);
        }

        return rootProcess;
    }

    /// <summary>
    /// 构建单个 Clip 的 Process
    /// </summary>
    public static UIProcess BuildClip(ClipData clip, TrackData track, UIProcessBuildContext context)
    {
        if (clip == null)
            return null;

        UIProcess process = null;

        // 根据 Clip 类型创建对应的 Process
        if (clip is StateClipData stateClip)
        {
            var controllerName = !string.IsNullOrEmpty(stateClip.TargetControllerName)
                ? stateClip.TargetControllerName
                : track.TargetControllerName;

            var controller = context.ControllerResolver?.ResolveController(controllerName);

            if (controller != null)
            {
                process = new UIStateEffectProcess(
                    controller,
                    stateClip.StateName,
                    stateClip.WaitForCompletion
                );
            }
            else
            {
                Debug.LogWarning($"[UIProcessBuilder] 未找到 Controller: {controllerName}，使用延迟");
                process = new DelayProcess(stateClip.Duration);
            }
        }
        else if (clip is LogicClipData logicClip)
        {
            process = new UIExecutorProcess(
                logicClip.MethodName,
                logicClip.TargetTypeName,
                logicClip.Parameters
            );
        }
        else if (clip is AudioClipData audioClip)
        {
            process = new UIAudioProcess(
                audioClip.AudioPath,
                audioClip.Volume,
                audioClip.Loop,
                audioClip.FadeInDuration,
                audioClip.FadeOutDuration,
                audioClip.Duration
            );
        }
        else if (clip is ControlClipData controlClip)
        {
            process = BuildControlClip(controlClip, context);
        }
        else
        {
            process = new DelayProcess(clip.Duration);
        }

        process?.SetProcessName($"Clip_{clip.ClipName}");
        return process;
    }

    private static UIProcess BuildControlClip(ControlClipData controlClip, UIProcessBuildContext context)
    {
        switch (controlClip.ControlType)
        {
            case ControlClipType.Wait:
            case ControlClipType.Delay:
                return new DelayProcess(controlClip.Duration);

            case ControlClipType.Loop:
                return new UILoopProcess(
                    context.Player,
                    controlClip.TargetSectionName,
                    controlClip.LoopCount
                );

            case ControlClipType.Jump:
                return new UIJumpProcess(
                    context.Player,
                    controlClip.TargetSectionName,
                    controlClip.Condition
                );

            default:
                return new DelayProcess(controlClip.Duration);
        }
    }

    // ... 其他辅助方法保持不变
}
```

---

## 4. 动画信息提取器增强

### 4.1 针对 UIStateModule 的专用 Provider

#### 4.1.1 UIStateModuleAnimatorProvider

```csharp
/// <summary>
/// UIStateModuleAnimator 动画信息提供者
/// </summary>
public class UIStateModuleAnimatorProvider : IAnimationInfoProvider
{
    public int Priority => 100;

    public bool CanHandle(Component component)
    {
        return component is UIStateModuleAnimator;
    }

    public AnimationInfo ExtractInfo(Component component, string stateName)
    {
        var module = component as UIStateModuleAnimator;
        if (module == null || module.m_animator == null)
            return null;

        // 查找对应状态的元素
        var element = FindElementByStateName(module, stateName);
        if (element == null)
            return null;

        float duration = 0f;
        float delay = element.m_delayTimeInSec;

        // 获取 Animator 中的动画时长
        if (module.m_animator.runtimeAnimatorController != null)
        {
#if UNITY_EDITOR
            var controller = module.m_animator.runtimeAnimatorController
                as UnityEditor.Animations.AnimatorController;
            if (controller != null)
            {
                duration = GetAnimationDurationFromController(
                    controller,
                    stateName,
                    element.m_useAnimatorParam
                );
            }
#endif
        }

        // 如果无法获取，使用默认时长
        if (duration <= 0f)
        {
            duration = 0.5f;
        }

        return new AnimationInfo
        {
            Duration = duration,
            Delay = delay,
            IsLoop = false,
            LoopCount = 1,
            SourceComponentType = "UIStateModuleAnimator",
            SourceGameObjectName = module.gameObject.name,
            DebugInfo = $"Animator: {module.m_animator.name}, State: {stateName}"
        };
    }

    private UIStateModuleAnimator.UIStateModuleElementAnimator FindElementByStateName(
        UIStateModuleAnimator module, string stateName)
    {
        return module.m_elements?.Find(e => e.m_stateName == stateName);
    }

#if UNITY_EDITOR
    private float GetAnimationDurationFromController(
        UnityEditor.Animations.AnimatorController controller,
        string stateName,
        bool useParam)
    {
        foreach (var layer in controller.layers)
        {
            var state = FindStateInStateMachine(layer.stateMachine, stateName);
            if (state != null)
            {
                // 获取 Motion
                if (state.motion is AnimationClip clip)
                {
                    return clip.length;
                }
                else if (state.motion is UnityEditor.Animations.BlendTree blendTree)
                {
                    // BlendTree 取最长的子动画
                    return GetMaxDurationFromBlendTree(blendTree);
                }
            }

            // 如果使用参数触发，可能需要查找 Transition 的目标状态
            if (useParam)
            {
                float transitionDuration = GetTransitionDuration(layer.stateMachine, stateName);
                if (transitionDuration > 0)
                {
                    return transitionDuration;
                }
            }
        }

        return 0f;
    }

    private UnityEditor.Animations.AnimatorState FindStateInStateMachine(
        UnityEditor.Animations.AnimatorStateMachine stateMachine,
        string stateName)
    {
        // 在当前层查找
        foreach (var childState in stateMachine.states)
        {
            if (childState.state.name == stateName)
                return childState.state;
        }

        // 递归子状态机
        foreach (var childMachine in stateMachine.stateMachines)
        {
            var found = FindStateInStateMachine(childMachine.stateMachine, stateName);
            if (found != null)
                return found;
        }

        return null;
    }

    private float GetMaxDurationFromBlendTree(UnityEditor.Animations.BlendTree blendTree)
    {
        float maxDuration = 0f;
        foreach (var child in blendTree.children)
        {
            if (child.motion is AnimationClip clip && clip.length > maxDuration)
            {
                maxDuration = clip.length;
            }
        }
        return maxDuration;
    }

    private float GetTransitionDuration(
        UnityEditor.Animations.AnimatorStateMachine stateMachine,
        string triggerName)
    {
        // 遍历所有 Transition，查找由该 Trigger 触发的
        foreach (var state in stateMachine.states)
        {
            foreach (var transition in state.state.transitions)
            {
                foreach (var condition in transition.conditions)
                {
                    if (condition.parameter == triggerName)
                    {
                        // 找到目标状态
                        var destState = transition.destinationState;
                        if (destState?.motion is AnimationClip clip)
                        {
                            return clip.length + transition.duration;
                        }
                    }
                }
            }
        }
        return 0f;
    }
#endif
}
```

#### 4.1.2 UIStateModuleTweenProvider

```csharp
/// <summary>
/// UIStateModuleTween 动画信息提供者
/// </summary>
public class UIStateModuleTweenProvider : IAnimationInfoProvider
{
    public int Priority => 95;

    public bool CanHandle(Component component)
    {
        return component is UIStateModuleTween;
    }

    public AnimationInfo ExtractInfo(Component component, string stateName)
    {
        var module = component as UIStateModuleTween;
        if (module == null)
            return null;

        var element = module.m_elements?.Find(e => e.m_stateName == stateName);
        if (element == null || element.m_tweenList == null || element.m_tweenList.Count == 0)
            return null;

        float delay = element.m_delayTimeInSec;
        float maxDuration = 0f;
        bool hasLoop = false;
        int maxLoopCount = 1;

        foreach (var tween in element.m_tweenList)
        {
            if (tween == null)
                continue;

            float tweenTotalTime = tween.delay + tween.duration;

            // 处理循环
            if (tween.style != TweenMain.Style.Once)
            {
                hasLoop = true;
                // PingPong 算两次
                if (tween.style == TweenMain.Style.PingPong)
                {
                    tweenTotalTime *= 2;
                }
                // Loop 为无限循环
                if (tween.style == TweenMain.Style.Loop)
                {
                    maxLoopCount = -1;
                }
            }

            if (tweenTotalTime > maxDuration)
            {
                maxDuration = tweenTotalTime;
            }
        }

        return new AnimationInfo
        {
            Duration = maxDuration,
            Delay = delay,
            IsLoop = hasLoop && maxLoopCount == -1,
            LoopCount = maxLoopCount,
            SourceComponentType = "UIStateModuleTween",
            SourceGameObjectName = module.gameObject.name,
            DebugInfo = $"Tween Count: {element.m_tweenList.Count}, MaxDuration: {maxDuration:F2}s"
        };
    }
}
```

#### 4.1.3 UIStateModuleGameObjectEnableProvider

```csharp
/// <summary>
/// UIStateModuleGameObjectEnable 动画信息提供者
/// 该模块为即时操作，无动画时长
/// </summary>
public class UIStateModuleGameObjectEnableProvider : IAnimationInfoProvider
{
    public int Priority => 50;

    public bool CanHandle(Component component)
    {
        return component is UIStateModuleGameObjectEnable;
    }

    public AnimationInfo ExtractInfo(Component component, string stateName)
    {
        var module = component as UIStateModuleGameObjectEnable;
        if (module == null)
            return null;

        var element = module.m_elements?.Find(e => e.m_stateName == stateName);
        if (element == null)
            return null;

        // GameObject 激活是即时操作，只有延迟
        return new AnimationInfo
        {
            Duration = 0f,  // 无持续时间
            Delay = element.m_delayTimeInSec,
            IsLoop = false,
            LoopCount = 1,
            SourceComponentType = "UIStateModuleGameObjectEnable",
            SourceGameObjectName = module.gameObject.name,
            DebugInfo = $"Enable {element.m_enableGameObjectList?.Count ?? 0} GameObjects"
        };
    }
}
```

### 4.2 AdvanceUIStateController 专用提取器

```csharp
/// <summary>
/// AdvanceUIStateController 动画信息提取器
/// 整合所有 UIStateModule 的动画信息
/// </summary>
public class AdvanceUIStateControllerExtractor
{
    private readonly List<IAnimationInfoProvider> m_providers;

    public AdvanceUIStateControllerExtractor()
    {
        m_providers = new List<IAnimationInfoProvider>
        {
            new UIStateModuleAnimatorProvider(),
            new UIStateModuleTweenProvider(),
            new UIStateModuleGameObjectEnableProvider(),
            // 可扩展添加其他 Provider
        };

        // 按优先级排序
        m_providers.Sort((a, b) => b.Priority.CompareTo(a.Priority));
    }

    /// <summary>
    /// 提取指定状态的动画信息
    /// </summary>
    public AnimationInfo ExtractStateInfo(AdvanceUIStateController controller, string stateName)
    {
        if (controller == null || string.IsNullOrEmpty(stateName))
            return AnimationInfo.CreateDefault();

        // 检查状态有效性
        if (!controller.m_stateName.Contains(stateName))
        {
            Debug.LogWarning($"[AdvanceUIStateControllerExtractor] 状态 {stateName} 不存在");
            return AnimationInfo.CreateDefault();
        }

        // 收集所有模块的动画信息
        var allInfos = new List<AnimationInfo>();
        var modules = controller.GetComponents<UIStateModuleBase>();

        foreach (var module in modules)
        {
            foreach (var provider in m_providers)
            {
                if (provider.CanHandle(module))
                {
                    try
                    {
                        var info = provider.ExtractInfo(module, stateName);
                        if (info != null && info.IsValid())
                        {
                            allInfos.Add(info);
                        }
                    }
                    catch (Exception e)
                    {
                        Debug.LogWarning($"提取动画信息失败: {module.GetType().Name}, 错误: {e.Message}");
                    }
                    break;  // 一个模块只用一个 Provider
                }
            }
        }

        // 处理子 StateController
        var childInfos = ExtractChildStateInfos(controller, stateName);
        allInfos.AddRange(childInfos);

        // 合并所有动画信息
        if (allInfos.Count == 0)
        {
            return AnimationInfo.CreateDefault();
        }

        return AnimationInfo.Merge(allInfos.ToArray());
    }

    /// <summary>
    /// 提取子 StateController 的动画信息
    /// </summary>
    private List<AnimationInfo> ExtractChildStateInfos(
        AdvanceUIStateController controller,
        string stateName)
    {
        var infos = new List<AnimationInfo>();

        var playableInfos = controller.m_childStatePlayableInfos
            .Find(c => c.m_stateName == stateName);

        if (playableInfos?.m_childStates == null)
            return infos;

        foreach (var childInfo in playableInfos.m_childStates)
        {
            if (childInfo.m_stateCtrl != null && !string.IsNullOrEmpty(childInfo.m_stateName))
            {
                var childExtractor = new AdvanceUIStateControllerExtractor();
                var info = childExtractor.ExtractStateInfo(childInfo.m_stateCtrl, childInfo.m_stateName);

                // 加上子状态的延迟
                info.Delay += childInfo.m_delayTime;
                infos.Add(info);
            }
        }

        // 如果是串行播放，需要累加时长；如果是并行，取最大
        if (playableInfos.m_playedSerial && infos.Count > 1)
        {
            float totalDuration = 0f;
            foreach (var info in infos)
            {
                totalDuration += info.GetTotalDuration();
            }

            var serialInfo = new AnimationInfo
            {
                Duration = totalDuration,
                Delay = 0f,
                IsLoop = false,
                LoopCount = 1,
                SourceComponentType = "ChildStates_Serial",
                DebugInfo = $"串行子状态总时长: {totalDuration:F2}s"
            };

            return new List<AnimationInfo> { serialInfo };
        }

        return infos;
    }

    /// <summary>
    /// 获取 StateController 的所有状态名称
    /// </summary>
    public List<string> GetAllStateNames(AdvanceUIStateController controller)
    {
        return controller?.m_stateName ?? new List<string>();
    }
}
```

---

## 5. 编辑器功能增强

### 5.1 Undo/Redo 支持

```csharp
// 在 UIProcessEditorWindow 中的所有数据修改操作前添加 Undo 记录

// 示例：修改 Clip 开始时间
private void OnClipStartTimeChanged(ClipData clip, float newStartTime)
{
    if (m_currentAsset == null)
        return;

    // 记录 Undo
    Undo.RecordObject(m_currentAsset, $"修改 Clip 开始时间: {clip.ClipName}");

    clip.StartTime = newStartTime;

    // 标记为脏
    EditorUtility.SetDirty(m_currentAsset);

    // 刷新视图
    RefreshTimeline();
}

// 示例：添加 Track
private void OnAddTrack()
{
    if (m_currentAsset == null)
        return;

    Undo.RecordObject(m_currentAsset, "添加轨道");

    var newTrack = new TrackData
    {
        TrackName = $"Track_{m_currentAsset.Tracks.Count + 1}",
        Type = TrackType.State,
        TrackColor = Color.cyan
    };

    m_currentAsset.Tracks.Add(newTrack);

    EditorUtility.SetDirty(m_currentAsset);
    RefreshAllViews();
}

// 示例：删除 Clip
private void OnDeleteClip(TrackData track, ClipData clip)
{
    if (track == null || clip == null)
        return;

    Undo.RecordObject(m_currentAsset, $"删除 Clip: {clip.ClipName}");

    track.RemoveClip(clip);

    EditorUtility.SetDirty(m_currentAsset);
    RefreshTimeline();
}
```

### 5.2 运行时预览与 AdvanceUIStateController 联动

```csharp
/// <summary>
/// 编辑器预览控制器
/// </summary>
public class UIProcessEditorPreviewController
{
    private UIProcessDataAsset m_asset;
    private float m_currentTime;
    private bool m_isPlaying;
    private Dictionary<string, AdvanceUIStateController> m_controllerMap;
    private float m_lastUpdateTime;

    /// <summary>
    /// 初始化预览
    /// </summary>
    public void Initialize(UIProcessDataAsset asset)
    {
        m_asset = asset;
        m_currentTime = 0f;
        m_isPlaying = false;

        // 从场景中查找并初始化所有 StateController
        m_controllerMap = new Dictionary<string, AdvanceUIStateController>();
        var controllers = Object.FindObjectsOfType<AdvanceUIStateController>();

        foreach (var controller in controllers)
        {
            // 初始化编辑器预览
            controller.InitStateCtrl4EditorPreview();
            m_controllerMap[controller.gameObject.name] = controller;
        }
    }

    /// <summary>
    /// 播放预览
    /// </summary>
    public void Play()
    {
        if (m_asset == null)
            return;

        m_isPlaying = true;
        m_lastUpdateTime = (float)EditorApplication.timeSinceStartup;

        // 注册 Editor Update
        EditorApplication.update += OnEditorUpdate;
    }

    /// <summary>
    /// 暂停预览
    /// </summary>
    public void Pause()
    {
        m_isPlaying = false;
    }

    /// <summary>
    /// 停止预览
    /// </summary>
    public void Stop()
    {
        m_isPlaying = false;
        m_currentTime = 0f;
        EditorApplication.update -= OnEditorUpdate;

        // 重置所有 StateController
        foreach (var controller in m_controllerMap.Values)
        {
            controller.ResetState();
        }
    }

    /// <summary>
    /// 跳转到指定时间
    /// </summary>
    public void SeekTo(float time)
    {
        m_currentTime = Mathf.Clamp(time, 0f, m_asset.TotalDuration);
        ApplyStateAtTime(m_currentTime);
    }

    /// <summary>
    /// Editor Update 回调
    /// </summary>
    private void OnEditorUpdate()
    {
        if (!m_isPlaying || m_asset == null)
            return;

        float currentEditorTime = (float)EditorApplication.timeSinceStartup;
        float deltaTime = currentEditorTime - m_lastUpdateTime;
        m_lastUpdateTime = currentEditorTime;

        m_currentTime += deltaTime;

        if (m_currentTime >= m_asset.TotalDuration)
        {
            m_currentTime = m_asset.TotalDuration;
            Stop();
            return;
        }

        ApplyStateAtTime(m_currentTime);
    }

    /// <summary>
    /// 应用指定时间点的状态
    /// </summary>
    private void ApplyStateAtTime(float time)
    {
        foreach (var track in m_asset.Tracks)
        {
            if (track.IsMuted || track.IsHidden || track.Type != TrackType.State)
                continue;

            var clip = track.GetClipAtTime(time);
            if (clip is StateClipData stateClip)
            {
                var controllerName = !string.IsNullOrEmpty(stateClip.TargetControllerName)
                    ? stateClip.TargetControllerName
                    : track.TargetControllerName;

                if (m_controllerMap.TryGetValue(controllerName, out var controller))
                {
                    // 计算 Clip 内的归一化时间
                    float normalizedTime = stateClip.GetNormalizedTime(time);
                    bool immediateComplete = normalizedTime >= 1f;

                    // 只在 Clip 开始时触发状态切换
                    if (normalizedTime < 0.01f || controller.CurrStateName != stateClip.StateName)
                    {
                        controller.SetToUIState(
                            stateClip.StateName,
                            immediateComplete,
                            refreshSameState: false
                        );
                    }
                }
            }
        }

        // 强制刷新场景视图
        SceneView.RepaintAll();
    }
}
```

### 5.3 LogicClip 参数编辑器

```csharp
/// <summary>
/// LogicClip 参数编辑器 UI
/// </summary>
public class LogicClipParameterEditor : VisualElement
{
    private LogicClipData m_clipData;
    private ListView m_parameterList;
    private Action m_onChanged;

    public LogicClipParameterEditor(LogicClipData clipData, Action onChanged)
    {
        m_clipData = clipData;
        m_onChanged = onChanged;

        BuildUI();
    }

    private void BuildUI()
    {
        // 标题
        var titleLabel = new Label("参数列表");
        titleLabel.style.unityFontStyleAndWeight = FontStyle.Bold;
        titleLabel.style.marginBottom = 5;
        Add(titleLabel);

        // 参数列表
        var parameters = m_clipData.Parameters.ToDictionary();
        var parameterItems = parameters.Select(kvp => new ParameterItem
        {
            Key = kvp.Key,
            Value = kvp.Value
        }).ToList();

        m_parameterList = new ListView(
            parameterItems,
            30,  // Item height
            MakeParameterItem,
            BindParameterItem
        );
        m_parameterList.style.flexGrow = 1;
        m_parameterList.style.minHeight = 100;
        m_parameterList.selectionType = SelectionType.Single;
        Add(m_parameterList);

        // 添加按钮
        var buttonRow = new VisualElement();
        buttonRow.style.flexDirection = FlexDirection.Row;
        buttonRow.style.marginTop = 5;

        var addButton = new Button(OnAddParameter) { text = "+ 添加参数" };
        addButton.style.flexGrow = 1;
        buttonRow.Add(addButton);

        var removeButton = new Button(OnRemoveParameter) { text = "- 删除" };
        removeButton.style.flexGrow = 1;
        buttonRow.Add(removeButton);

        Add(buttonRow);
    }

    private VisualElement MakeParameterItem()
    {
        var container = new VisualElement();
        container.style.flexDirection = FlexDirection.Row;
        container.style.paddingLeft = 4;
        container.style.paddingRight = 4;

        var keyField = new TextField();
        keyField.name = "key-field";
        keyField.style.width = Length.Percent(40);
        container.Add(keyField);

        var valueField = new TextField();
        valueField.name = "value-field";
        valueField.style.flexGrow = 1;
        container.Add(valueField);

        return container;
    }

    private void BindParameterItem(VisualElement element, int index)
    {
        var items = (List<ParameterItem>)m_parameterList.itemsSource;
        if (index >= items.Count)
            return;

        var item = items[index];
        var keyField = element.Q<TextField>("key-field");
        var valueField = element.Q<TextField>("value-field");

        keyField.SetValueWithoutNotify(item.Key);
        valueField.SetValueWithoutNotify(item.Value);

        keyField.RegisterValueChangedCallback(evt =>
        {
            // 更新 Key
            string oldKey = item.Key;
            string newKey = evt.newValue;

            if (oldKey != newKey)
            {
                m_clipData.Parameters.Remove(oldKey);
                m_clipData.Parameters.SetValue(newKey, item.Value);
                item.Key = newKey;
                m_onChanged?.Invoke();
            }
        });

        valueField.RegisterValueChangedCallback(evt =>
        {
            // 更新 Value
            item.Value = evt.newValue;
            m_clipData.Parameters.SetValue(item.Key, item.Value);
            m_onChanged?.Invoke();
        });
    }

    private void OnAddParameter()
    {
        var items = (List<ParameterItem>)m_parameterList.itemsSource;
        string newKey = $"param{items.Count}";

        items.Add(new ParameterItem { Key = newKey, Value = "" });
        m_clipData.Parameters.SetValue(newKey, "");

        m_parameterList.Rebuild();
        m_onChanged?.Invoke();
    }

    private void OnRemoveParameter()
    {
        var items = (List<ParameterItem>)m_parameterList.itemsSource;
        int selectedIndex = m_parameterList.selectedIndex;

        if (selectedIndex >= 0 && selectedIndex < items.Count)
        {
            var item = items[selectedIndex];
            m_clipData.Parameters.Remove(item.Key);
            items.RemoveAt(selectedIndex);

            m_parameterList.Rebuild();
            m_onChanged?.Invoke();
        }
    }

    private class ParameterItem
    {
        public string Key;
        public string Value;
    }
}
```

### 5.4 动画信息硬化（Bake）机制

```csharp
/// <summary>
/// 动画信息硬化数据
/// </summary>
[Serializable]
public class BakedAnimationData
{
    /// <summary>
    /// 状态名称 -> 动画信息
    /// </summary>
    public List<BakedStateInfo> States = new List<BakedStateInfo>();

    /// <summary>
    /// Bake 时间戳
    /// </summary>
    public long BakeTimestamp;

    /// <summary>
    /// 源 Asset 版本
    /// </summary>
    public int SourceVersion;
}

[Serializable]
public class BakedStateInfo
{
    public string ControllerName;
    public string StateName;
    public float Duration;
    public float Delay;
    public bool IsLoop;
    public int LoopCount;
}

/// <summary>
/// UIProcessDataAsset 扩展 - Bake 功能
/// </summary>
public partial class UIProcessDataAsset
{
    [SerializeField]
    private BakedAnimationData m_bakedData;

    /// <summary>
    /// 硬化的动画数据
    /// </summary>
    public BakedAnimationData BakedData => m_bakedData;

    /// <summary>
    /// 是否有有效的 Baked 数据
    /// </summary>
    public bool HasValidBakedData => m_bakedData != null
        && m_bakedData.SourceVersion == m_version
        && m_bakedData.States.Count > 0;

    /// <summary>
    /// 执行动画信息硬化
    /// </summary>
    public void BakeAnimationInfo(Dictionary<string, AdvanceUIStateController> controllerMap)
    {
        m_bakedData = new BakedAnimationData
        {
            BakeTimestamp = DateTime.Now.Ticks,
            SourceVersion = m_version,
            States = new List<BakedStateInfo>()
        };

        var extractor = new AdvanceUIStateControllerExtractor();

        foreach (var track in m_tracks)
        {
            if (track.Type != TrackType.State)
                continue;

            foreach (var clip in track.Clips)
            {
                if (clip is StateClipData stateClip)
                {
                    var controllerName = !string.IsNullOrEmpty(stateClip.TargetControllerName)
                        ? stateClip.TargetControllerName
                        : track.TargetControllerName;

                    if (controllerMap.TryGetValue(controllerName, out var controller))
                    {
                        var info = extractor.ExtractStateInfo(controller, stateClip.StateName);

                        m_bakedData.States.Add(new BakedStateInfo
                        {
                            ControllerName = controllerName,
                            StateName = stateClip.StateName,
                            Duration = info.Duration,
                            Delay = info.Delay,
                            IsLoop = info.IsLoop,
                            LoopCount = info.LoopCount
                        });

                        // 同时更新 Clip 的 Duration
                        if (stateClip.ManualDurationOverride <= 0)
                        {
                            stateClip.Duration = info.GetTotalDuration();
                        }
                    }
                }
            }
        }

        Debug.Log($"[UIProcessDataAsset] 已硬化 {m_bakedData.States.Count} 个状态的动画信息");
    }

    /// <summary>
    /// 从硬化数据获取动画信息
    /// </summary>
    public AnimationInfo GetBakedInfo(string controllerName, string stateName)
    {
        if (!HasValidBakedData)
            return null;

        var bakedState = m_bakedData.States.Find(
            s => s.ControllerName == controllerName && s.StateName == stateName);

        if (bakedState == null)
            return null;

        return new AnimationInfo
        {
            Duration = bakedState.Duration,
            Delay = bakedState.Delay,
            IsLoop = bakedState.IsLoop,
            LoopCount = bakedState.LoopCount,
            SourceComponentType = "Baked",
            DebugInfo = "从硬化数据加载"
        };
    }
}
```

---

## 6. 集成设计

### 6.1 在 UITask 中使用

```csharp
/// <summary>
/// UITask Tofu 中使用 UIProcess 可视化系统的示例
/// </summary>
public class SampleUITaskCompMainTofu : UITaskCompTofuBase
{
    private UIProcessRuntimePlayer m_processPlayer;
    private UIControllerBasedResolver m_resolver;

    public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
    {
        base.ViewUpdate(pipelineCtrl);

        // 1. 初始化 StateController 解析器
        m_resolver = new UIControllerBasedResolver();

        // 从 UIController 注册 StateController
        var mainCtrl = m_owner.CompUIControllerManagerGet()
            .UIControllerGet<SampleUIController>("MainController");
        m_resolver.RegisterFromUIController(mainCtrl);

        // 2. 创建播放器
        m_processPlayer = new UIProcessRuntimePlayer();

        // 3. 加载资源
        var assetPath = "UIProcess/SampleAnimation";
        var asset = Resources.Load<UIProcessDataAsset>(assetPath);

        if (asset == null)
        {
            Debug.LogError($"无法加载 UIProcess 资源: {assetPath}");
            return;
        }

        m_processPlayer.LoadAsset(asset);

        // 4. 注册事件回调
        m_processPlayer.RegisterEventCallback("OnStepComplete", OnStepComplete);
        m_processPlayer.OnCompleted += OnAnimationCompleted;

        // 5. 配置构建上下文
        var buildContext = new UIProcessBuildContext
        {
            ControllerResolver = m_resolver,
            Player = m_processPlayer
        };

        // 6. 播放
        m_processPlayer.Play(buildContext);
    }

    private void OnStepComplete(string eventParams)
    {
        Debug.Log($"步骤完成: {eventParams}");
    }

    private void OnAnimationCompleted(UIProcessRuntimePlayer player)
    {
        Debug.Log("UIProcess 动画播放完成");

        // 继续后续流程
        // ...
    }

    public override void OnStop()
    {
        base.OnStop();

        // 清理
        m_processPlayer?.Stop();
        m_processPlayer = null;
        m_resolver?.Clear();
        m_resolver = null;
    }
}
```

### 6.2 与 UpdatePipeline 集成

```csharp
/// <summary>
/// 在 UpdatePipeline 的 ViewUpdate 阶段使用 UIProcess
/// </summary>
public class SampleUITaskUpdatePipeline : UITaskUpdatePipelineBase
{
    private UIProcessRuntimePlayer m_processPlayer;
    private bool m_isProcessCompleted;

    protected override void ViewUpdate()
    {
        m_isProcessCompleted = false;

        // 创建并配置 Player
        m_processPlayer = new UIProcessRuntimePlayer();

        var asset = LoadAsset();
        if (asset == null)
        {
            m_isProcessCompleted = true;
            return;
        }

        m_processPlayer.LoadAsset(asset);
        m_processPlayer.OnCompleted += _ => m_isProcessCompleted = true;
        m_processPlayer.OnCanceled += _ => m_isProcessCompleted = true;

        // 配置上下文
        var context = CreateBuildContext();

        // 开始播放
        m_processPlayer.Play(context);
    }

    protected override bool IsViewUpdateCompleted()
    {
        // 等待 UIProcess 播放完成
        return m_isProcessCompleted;
    }

    protected override void OnPipelineStop()
    {
        base.OnPipelineStop();
        m_processPlayer?.Stop();
    }

    private UIProcessDataAsset LoadAsset()
    {
        // 从 Intent 获取资源路径
        string assetPath = GetIntentParam<string>("UIProcessAssetPath");
        return Resources.Load<UIProcessDataAsset>(assetPath);
    }

    private UIProcessBuildContext CreateBuildContext()
    {
        var resolver = new UIControllerBasedResolver();

        // 从 UITask 获取已加载的 UIController 并注册
        var controllers = m_owner.CompUIControllerManagerGet().GetAllControllers();
        foreach (var ctrl in controllers)
        {
            resolver.RegisterFromUIController(ctrl);
        }

        return new UIProcessBuildContext
        {
            ControllerResolver = resolver,
            Player = m_processPlayer
        };
    }
}
```

---

## 7. 数据流与时序图

### 7.1 运行时播放流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          UIProcess 运行时播放流程                         │
└─────────────────────────────────────────────────────────────────────────┘

用户/Tofu                    RuntimePlayer                  Builder
    │                             │                            │
    │  LoadAsset(asset)           │                            │
    │────────────────────────────>│                            │
    │                             │                            │
    │  RegisterResolver(resolver) │                            │
    │────────────────────────────>│                            │
    │                             │                            │
    │  Play(context)              │                            │
    │────────────────────────────>│                            │
    │                             │  Build(asset, context)     │
    │                             │───────────────────────────>│
    │                             │                            │
    │                             │     UIProcess Tree         │
    │                             │<───────────────────────────│
    │                             │                            │
    │                             │                            │

Builder                                UIStateEffectProcess
    │                                         │
    │  BuildClip(StateClipData)               │
    │────────────────────────────────────────>│
    │                                         │
    │  resolver.ResolveController(name)       │
    │────────────────────────────────────────>│
    │                                         │
    │       AdvanceUIStateController          │
    │<────────────────────────────────────────│
    │                                         │
    │  new UIStateEffectProcess(ctrl, state)  │
    │────────────────────────────────────────>│
    │                                         │

UIStateEffectProcess              AdvanceUIStateController
    │                                    │
    │  OnStart()                         │
    │───────────────────────────────────>│
    │                                    │
    │  SetToUIState(state, ..., onFinished)
    │───────────────────────────────────>│
    │                                    │
    │                                    │  EnterState()
    │                                    │──┐
    │                                    │  │ SetModuleState()
    │                                    │  │ (各 Module.EnterState)
    │                                    │<─┘
    │                                    │
    │                                    │  ... 动画播放中 ...
    │                                    │
    │                                    │  OnStateModuleEnterStateCompleted()
    │                                    │  CheckEnterStateCompleted()
    │                                    │
    │  onFinished(true)                  │
    │<───────────────────────────────────│
    │                                    │
    │  OnComplete()                      │
    │───────────────────────────────────>│
```

### 7.2 动画信息提取流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         动画信息提取流程                                  │
└─────────────────────────────────────────────────────────────────────────┘

EditorWindow                 Extractor                  Providers
    │                            │                          │
    │  OnRefreshAnimationInfo()  │                          │
    │───────────────────────────>│                          │
    │                            │                          │
    │  BuildControllerMap()      │                          │
    │<───────────────────────────│                          │
    │                            │                          │
    │  foreach StateClip         │                          │
    │ ┌──────────────────────────┤                          │
    │ │                          │                          │
    │ │  ExtractStateInfo(ctrl, stateName)                  │
    │ │──────────────────────────────────────────────────>  │
    │ │                          │                          │
    │ │                          │  foreach Module          │
    │ │                          │ ┌───────────────────────>│
    │ │                          │ │                        │
    │ │                          │ │  CanHandle(module)?    │
    │ │                          │ │<───────────────────────│
    │ │                          │ │                        │
    │ │                          │ │  ExtractInfo(module, state)
    │ │                          │ │<───────────────────────│
    │ │                          │ │                        │
    │ │                          │ │  AnimationInfo         │
    │ │                          │<┘                        │
    │ │                          │                          │
    │ │                          │  AnimationInfo.Merge()   │
    │ │                          │<─────────────────────────│
    │ │                          │                          │
    │ │  MergedAnimationInfo     │                          │
    │ │<─────────────────────────│                          │
    │ │                          │                          │
    │ │  UpdateClipDuration()    │                          │
    │<┘                          │                          │
    │                            │                          │
    │  RefreshTimeline()         │                          │
    │<───────────────────────────│                          │
```

---

## 8. 开发计划与任务分解

### 8.1 里程碑与任务

| 里程碑 | 任务 | 优先级 | 依赖 |
|--------|------|--------|------|
| **M1: 运行时核心** | | | |
| | 1.1 实现 `UIStateEffectProcess` | P0 | - |
| | 1.2 实现 `IStateControllerResolver` 接口 | P0 | - |
| | 1.3 实现 `UIControllerBasedResolver` | P0 | 1.2 |
| | 1.4 修改 `UIProcessBuilder.BuildClip()` | P0 | 1.1, 1.3 |
| | 1.5 实现 `UIExecutorProcess` | P1 | - |
| | 1.6 实现 `UIAudioProcess` | P2 | - |
| **M2: 控制流** | | | |
| | 2.1 实现 `UILoopProcess` | P1 | M1 |
| | 2.2 实现 `UIJumpProcess` | P1 | M1 |
| | 2.3 修改 `UIProcessRuntimePlayer` 支持跳转 | P1 | 2.1, 2.2 |
| **M3: 动画信息提取** | | | |
| | 3.1 实现 `UIStateModuleAnimatorProvider` | P0 | - |
| | 3.2 实现 `UIStateModuleTweenProvider` | P0 | - |
| | 3.3 实现 `UIStateModuleGameObjectEnableProvider` | P1 | - |
| | 3.4 实现 `AdvanceUIStateControllerExtractor` | P0 | 3.1, 3.2, 3.3 |
| **M4: 编辑器增强** | | | |
| | 4.1 添加 Undo/Redo 支持 | P1 | - |
| | 4.2 实现 `UIProcessEditorPreviewController` | P1 | M1 |
| | 4.3 实现 `LogicClipParameterEditor` | P2 | - |
| | 4.4 实现动画信息硬化（Bake）机制 | P2 | M3 |
| **M5: 集成测试** | | | |
| | 5.1 单元测试编写 | P1 | M1-M4 |
| | 5.2 UITask 集成测试 | P1 | 5.1 |
| | 5.3 复杂场景测试（撕卡包等） | P1 | 5.2 |

### 8.2 验收标准

#### M1 验收标准
- [ ] `UIStateEffectProcess` 能正确触发 `AdvanceUIStateController` 状态切换
- [ ] 状态切换完成后能正确触发 UIProcess 完成回调
- [ ] `immediateComplete` 模式下能立即完成状态切换
- [ ] 支持 `WaitForCompletion = false` 的立即完成模式

#### M2 验收标准
- [ ] `UILoopProcess` 能正确执行指定次数的循环
- [ ] `UIJumpProcess` 能正确跳转到指定 Section
- [ ] 无限循环能被外部中断

#### M3 验收标准
- [ ] 能正确提取 `UIStateModuleAnimator` 的动画时长
- [ ] 能正确提取 `UIStateModuleTween` 的动画时长
- [ ] 能正确处理子 `AdvanceUIStateController` 的嵌套
- [ ] 多个模块的时长能正确合并（取最大）

#### M4 验收标准
- [ ] 所有编辑操作支持 Ctrl+Z 撤销
- [ ] 编辑器预览能正确驱动场景中的 UI 动画
- [ ] `LogicClip` 参数能通过 UI 编辑
- [ ] Bake 后的动画信息与实时提取一致

---

## 9. 测试策略

### 9.1 单元测试

```csharp
[TestFixture]
public class UIStateEffectProcessTests
{
    [Test]
    public void Test_StateChange_WaitForCompletion()
    {
        // 准备
        var mockController = CreateMockController();
        var process = new UIStateEffectProcess(
            mockController,
            "Show",
            waitForCompletion: true
        );

        bool completed = false;
        process.Start(_ => completed = true);

        // 验证
        Assert.IsFalse(completed, "状态切换未完成时不应触发回调");

        // 模拟状态完成
        mockController.SimulateStateComplete();

        Assert.IsTrue(completed, "状态切换完成后应触发回调");
    }

    [Test]
    public void Test_StateChange_NoWait()
    {
        var mockController = CreateMockController();
        var process = new UIStateEffectProcess(
            mockController,
            "Show",
            waitForCompletion: false
        );

        bool completed = false;
        process.Start(_ => completed = true);

        Assert.IsTrue(completed, "不等待完成模式应立即触发回调");
    }
}

[TestFixture]
public class AnimationInfoExtractorTests
{
    [Test]
    public void Test_Extract_UIStateModuleTween()
    {
        // 准备包含 UIStateModuleTween 的 GameObject
        var go = new GameObject();
        var controller = go.AddComponent<AdvanceUIStateController>();
        var tweenModule = go.AddComponent<UIStateModuleTween>();

        // 配置 Tween 元素
        tweenModule.m_elements = new List<UIStateModuleTween.UIStateModuleElementTween>
        {
            new UIStateModuleTween.UIStateModuleElementTween
            {
                m_stateName = "Show",
                m_delayTimeInSec = 0.1f,
                m_tweenList = CreateMockTweens(duration: 0.5f)
            }
        };

        // 提取
        var extractor = new AdvanceUIStateControllerExtractor();
        var info = extractor.ExtractStateInfo(controller, "Show");

        // 验证
        Assert.AreEqual(0.5f, info.Duration, 0.01f);
        Assert.AreEqual(0.1f, info.Delay, 0.01f);

        // 清理
        Object.DestroyImmediate(go);
    }
}
```

### 9.2 集成测试场景

1. **简单状态切换**
   - 创建包含 3 个状态的 StateController
   - 配置 3 个 StateClip 顺序播放
   - 验证状态按顺序切换，时长正确

2. **并行动画**
   - 创建 2 个独立的 StateController
   - 配置 2 个并行轨道，同时播放
   - 验证两个动画同时播放和结束

3. **循环与跳转**
   - 创建包含循环的动画序列
   - 验证循环次数正确
   - 验证跳转功能正确

4. **撕卡包场景**
   - 复现完整的撕卡包动画流程
   - 验证动画、音效、逻辑的协调执行

---

## 附录

### A. 相关文件列表

| 文件路径 | 说明 |
|----------|------|
| `BJFramework/Script/Runtime/UI/UIProcessVisual/UIProcessBuilder.cs` | Process 构建器 |
| `BJFramework/Script/Runtime/UI/UIProcessVisual/UIProcessRuntimePlayer.cs` | 运行时播放器 |
| `BJFramework/Script/Runtime/UI/UIProcessVisual/ClipData.cs` | Clip 数据定义 |
| `BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/AdvanceUIStateController.cs` | 状态控制器 |
| `BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleBase.cs` | 模块基类 |
| `BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleAnimator.cs` | Animator 模块 |
| `BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleTween.cs` | Tween 模块 |
| `BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleGameObjectEnable.cs` | GameObject 激活模块 |
| `BJFramework/Script/Runtime/UI/Extend/AdvanceUIStateController/UIStateModuleAnimatorStateMachine.cs` | StateMachine 行为 |

### B. 参考资料

- Unity Timeline 源码架构
- AdvanceUIStateController 内部文档
- BJFramework UIProcess 设计文档 v1.0/v2.0

---

## 10. 改进建议与最佳实践

### 10.1 代码层面改进

#### 10.1.1 常量定义规范

为避免魔法数字，所有固定值应定义为常量：

```csharp
/// <summary>
/// UIProcess 系统常量定义
/// </summary>
public static class UIProcessConstants
{
    #region 时间相关

    /// <summary>
    /// 默认动画时长（秒）
    /// </summary>
    public const float DEFAULT_ANIMATION_DURATION = 0.5f;

    /// <summary>
    /// 最小有效时长（秒）
    /// </summary>
    public const float MIN_VALID_DURATION = 0.001f;

    /// <summary>
    /// 编辑器预览帧间隔检测阈值（秒）
    /// </summary>
    public const float EDITOR_PREVIEW_DELTA_THRESHOLD = 0.1f;

    #endregion

    #region 错误码

    /// <summary>
    /// 错误码：StateController 为空
    /// </summary>
    public const int ERROR_NULL_CONTROLLER = 1001;

    /// <summary>
    /// 错误码：状态名为空
    /// </summary>
    public const int ERROR_EMPTY_STATE_NAME = 1002;

    /// <summary>
    /// 错误码：状态不存在
    /// </summary>
    public const int ERROR_STATE_NOT_FOUND = 1003;

    /// <summary>
    /// 错误码：方法未找到
    /// </summary>
    public const int ERROR_METHOD_NOT_FOUND = 2001;

    /// <summary>
    /// 错误码：类型未找到
    /// </summary>
    public const int ERROR_TYPE_NOT_FOUND = 2002;

    #endregion

    #region 缓存相关

    /// <summary>
    /// 动画时长缓存过期时间（秒）
    /// </summary>
    public const float ANIMATION_CACHE_EXPIRE_TIME = 300f;

    /// <summary>
    /// 最大缓存条目数
    /// </summary>
    public const int MAX_CACHE_ENTRIES = 1000;

    #endregion
}
```

#### 10.1.2 UIStateModuleAnimatorProvider 缓存机制

```csharp
/// <summary>
/// UIStateModuleAnimator 动画信息提供者（带缓存）
/// </summary>
public class UIStateModuleAnimatorProvider : IAnimationInfoProvider
{
    #region 缓存

    /// <summary>
    /// 缓存键：ControllerInstanceID_StateName
    /// </summary>
    private static readonly Dictionary<string, CachedAnimationInfo> s_durationCache
        = new Dictionary<string, CachedAnimationInfo>();

    /// <summary>
    /// 缓存锁
    /// </summary>
    private static readonly object s_cacheLock = new object();

    /// <summary>
    /// 缓存的动画信息
    /// </summary>
    private class CachedAnimationInfo
    {
        public float Duration;
        public float CacheTime;
    }

    #endregion

    public int Priority => 100;

    public bool CanHandle(Component component)
    {
        return component is UIStateModuleAnimator;
    }

    public AnimationInfo ExtractInfo(Component component, string stateName)
    {
        var module = component as UIStateModuleAnimator;
        if (module == null || module.m_animator == null)
            return null;

        var element = FindElementByStateName(module, stateName);
        if (element == null)
            return null;

        float duration = GetCachedOrExtractDuration(module, stateName, element);
        float delay = element.m_delayTimeInSec;

        return new AnimationInfo
        {
            Duration = duration,
            Delay = delay,
            IsLoop = false,
            LoopCount = 1,
            SourceComponentType = "UIStateModuleAnimator",
            SourceGameObjectName = module.gameObject.name,
            DebugInfo = $"Animator: {module.m_animator.name}, State: {stateName}"
        };
    }

    /// <summary>
    /// 获取缓存的时长或重新提取
    /// </summary>
    private float GetCachedOrExtractDuration(
        UIStateModuleAnimator module,
        string stateName,
        UIStateModuleAnimator.UIStateModuleElementAnimator element)
    {
        string cacheKey = $"{module.GetInstanceID()}_{stateName}";
        float currentTime = Time.realtimeSinceStartup;

        lock (s_cacheLock)
        {
            // 检查缓存
            if (s_durationCache.TryGetValue(cacheKey, out var cached))
            {
                // 检查是否过期
                if (currentTime - cached.CacheTime < UIProcessConstants.ANIMATION_CACHE_EXPIRE_TIME)
                {
                    return cached.Duration;
                }
            }

            // 提取并缓存
            float duration = ExtractDurationFromAnimator(module, stateName, element);

            // 缓存清理（防止无限增长）
            if (s_durationCache.Count >= UIProcessConstants.MAX_CACHE_ENTRIES)
            {
                ClearExpiredCache(currentTime);
            }

            s_durationCache[cacheKey] = new CachedAnimationInfo
            {
                Duration = duration,
                CacheTime = currentTime
            };

            return duration;
        }
    }

    /// <summary>
    /// 清理过期缓存
    /// </summary>
    private static void ClearExpiredCache(float currentTime)
    {
        var keysToRemove = new List<string>();

        foreach (var kvp in s_durationCache)
        {
            if (currentTime - kvp.Value.CacheTime >= UIProcessConstants.ANIMATION_CACHE_EXPIRE_TIME)
            {
                keysToRemove.Add(kvp.Key);
            }
        }

        foreach (var key in keysToRemove)
        {
            s_durationCache.Remove(key);
        }
    }

    /// <summary>
    /// 强制清空缓存（编辑器中 Animator 修改后调用）
    /// </summary>
    public static void InvalidateCache()
    {
        lock (s_cacheLock)
        {
            s_durationCache.Clear();
        }
    }

    // ... 其他方法保持不变
}
```

#### 10.1.3 编辑器 Update 优化

```csharp
/// <summary>
/// 编辑器预览控制器（优化版）
/// </summary>
public class UIProcessEditorPreviewController
{
    #region 字段

    private UIProcessDataAsset m_asset;
    private float m_currentTime;
    private bool m_isPlaying;
    private Dictionary<string, AdvanceUIStateController> m_controllerMap;
    private float m_lastUpdateTime;

    /// <summary>
    /// 是否已注册 EditorUpdate
    /// </summary>
    private bool m_isEditorUpdateRegistered;

    /// <summary>
    /// 上一次应用状态的时间（避免频繁刷新）
    /// </summary>
    private float m_lastApplyStateTime;

    #endregion

    #region 公共方法

    /// <summary>
    /// 播放预览
    /// </summary>
    public void Play()
    {
        if (m_asset == null)
            return;

        m_isPlaying = true;
        m_lastUpdateTime = (float)EditorApplication.timeSinceStartup;
        m_lastApplyStateTime = 0f;

        // 安全注册（避免重复注册）
        RegisterEditorUpdate();
    }

    /// <summary>
    /// 暂停预览
    /// </summary>
    public void Pause()
    {
        m_isPlaying = false;
        // 暂停时不注销，保持状态
    }

    /// <summary>
    /// 停止预览
    /// </summary>
    public void Stop()
    {
        m_isPlaying = false;
        m_currentTime = 0f;

        // 安全注销
        UnregisterEditorUpdate();

        // 重置所有 StateController
        ResetAllControllers();
    }

    /// <summary>
    /// 释放资源（窗口关闭时调用）
    /// </summary>
    public void Dispose()
    {
        Stop();
        m_controllerMap?.Clear();
        m_controllerMap = null;
        m_asset = null;
    }

    #endregion

    #region 内部方法

    /// <summary>
    /// 安全注册 EditorUpdate
    /// </summary>
    private void RegisterEditorUpdate()
    {
        if (m_isEditorUpdateRegistered)
            return;

        EditorApplication.update += OnEditorUpdate;
        m_isEditorUpdateRegistered = true;
    }

    /// <summary>
    /// 安全注销 EditorUpdate
    /// </summary>
    private void UnregisterEditorUpdate()
    {
        if (!m_isEditorUpdateRegistered)
            return;

        EditorApplication.update -= OnEditorUpdate;
        m_isEditorUpdateRegistered = false;
    }

    /// <summary>
    /// Editor Update 回调
    /// </summary>
    private void OnEditorUpdate()
    {
        // 防御性检查
        if (!m_isPlaying || m_asset == null)
        {
            UnregisterEditorUpdate();
            return;
        }

        float currentEditorTime = (float)EditorApplication.timeSinceStartup;
        float deltaTime = currentEditorTime - m_lastUpdateTime;

        // 防止异常的大 deltaTime（如编辑器挂起后恢复）
        if (deltaTime > UIProcessConstants.EDITOR_PREVIEW_DELTA_THRESHOLD)
        {
            deltaTime = UIProcessConstants.EDITOR_PREVIEW_DELTA_THRESHOLD;
        }

        m_lastUpdateTime = currentEditorTime;
        m_currentTime += deltaTime;

        if (m_currentTime >= m_asset.TotalDuration)
        {
            m_currentTime = m_asset.TotalDuration;
            Stop();
            return;
        }

        ApplyStateAtTime(m_currentTime);
    }

    /// <summary>
    /// 重置所有 StateController
    /// </summary>
    private void ResetAllControllers()
    {
        if (m_controllerMap == null)
            return;

        foreach (var controller in m_controllerMap.Values)
        {
            if (controller != null)
            {
                controller.ResetState();
            }
        }
    }

    #endregion
}
```

### 10.2 架构层面改进

#### 10.2.1 事件总线设计

为提高组件间解耦性，建议引入事件总线替代部分直接回调：

```csharp
/// <summary>
/// UIProcess 事件总线
/// 用于组件间松耦合通信
/// </summary>
public class UIProcessEventBus
{
    #region 单例

    private static UIProcessEventBus s_instance;
    public static UIProcessEventBus Instance => s_instance ??= new UIProcessEventBus();

    private UIProcessEventBus() { }

    #endregion

    #region 事件定义

    /// <summary>
    /// Process 开始事件
    /// </summary>
    public event Action<UIProcess> OnProcessStarted;

    /// <summary>
    /// Process 完成事件
    /// </summary>
    public event Action<UIProcess, bool> OnProcessCompleted;

    /// <summary>
    /// 状态切换开始事件
    /// </summary>
    public event Action<string, string> OnStateChangeStarted;  // controllerName, stateName

    /// <summary>
    /// 状态切换完成事件
    /// </summary>
    public event Action<string, string, bool> OnStateChangeCompleted;  // controllerName, stateName, success

    /// <summary>
    /// 播放器时间更新事件（用于 UI 同步）
    /// </summary>
    public event Action<float, float> OnPlayerTimeUpdated;  // currentTime, totalDuration

    /// <summary>
    /// 事件标记触发事件
    /// </summary>
    public event Action<string, string> OnEventMarkerTriggered;  // eventName, eventParams

    #endregion

    #region 触发方法

    public void RaiseProcessStarted(UIProcess process)
    {
        OnProcessStarted?.Invoke(process);
    }

    public void RaiseProcessCompleted(UIProcess process, bool success)
    {
        OnProcessCompleted?.Invoke(process, success);
    }

    public void RaiseStateChangeStarted(string controllerName, string stateName)
    {
        OnStateChangeStarted?.Invoke(controllerName, stateName);
    }

    public void RaiseStateChangeCompleted(string controllerName, string stateName, bool success)
    {
        OnStateChangeCompleted?.Invoke(controllerName, stateName, success);
    }

    public void RaisePlayerTimeUpdated(float currentTime, float totalDuration)
    {
        OnPlayerTimeUpdated?.Invoke(currentTime, totalDuration);
    }

    public void RaiseEventMarkerTriggered(string eventName, string eventParams)
    {
        OnEventMarkerTriggered?.Invoke(eventName, eventParams);
    }

    #endregion

    #region 清理

    /// <summary>
    /// 清除所有订阅（场景切换时调用）
    /// </summary>
    public void ClearAllSubscriptions()
    {
        OnProcessStarted = null;
        OnProcessCompleted = null;
        OnStateChangeStarted = null;
        OnStateChangeCompleted = null;
        OnPlayerTimeUpdated = null;
        OnEventMarkerTriggered = null;
    }

    #endregion
}

/// <summary>
/// UIStateEffectProcess 集成事件总线示例
/// </summary>
public partial class UIStateEffectProcess
{
    protected override void OnStart()
    {
        base.OnStart();

        // 触发状态切换开始事件
        UIProcessEventBus.Instance.RaiseStateChangeStarted(
            m_stateController?.gameObject.name ?? "Unknown",
            m_stateName
        );

        // ... 原有逻辑
    }

    private void OnStateChangeFinished(bool isSuccess)
    {
        m_isStateChangeCompleted = true;

        // 触发状态切换完成事件
        UIProcessEventBus.Instance.RaiseStateChangeCompleted(
            m_stateController?.gameObject.name ?? "Unknown",
            m_stateName,
            isSuccess
        );

        // ... 原有逻辑
    }
}
```

#### 10.2.2 UIExecutorProcess 增强

```csharp
/// <summary>
/// UIExecutorProcess 增强版
/// 增加对 targetInstance 的更完善处理
/// </summary>
public class UIExecutorProcess : UIProcess
{
    // ... 原有字段

    /// <summary>
    /// 实例解析器（用于获取非静态方法的实例）
    /// </summary>
    private readonly IInstanceResolver m_instanceResolver;

    /// <summary>
    /// 构造函数
    /// </summary>
    public UIExecutorProcess(
        string methodName,
        string targetTypeName,
        SerializableDictionary parameters,
        object targetInstance = null,
        IInstanceResolver instanceResolver = null)
        : base(ProcessExecMode.Serial)
    {
        m_methodName = methodName;
        m_targetTypeName = targetTypeName;
        m_parameters = parameters;
        m_targetInstance = targetInstance;
        m_instanceResolver = instanceResolver;
    }

    private void ExecuteViaReflection()
    {
        // ... 类型查找逻辑

        var method = targetType.GetMethod(m_methodName, ...);
        if (method == null)
        {
            Debug.LogError($"[UIExecutorProcess] [Error:{ERROR_METHOD_NOT_FOUND}] " +
                $"未找到方法：{m_targetTypeName}.{m_methodName}");
            OnComplete();
            return;
        }

        // 获取实例
        object instance = null;
        if (!method.IsStatic)
        {
            instance = ResolveInstance(targetType);
            if (instance == null)
            {
                Debug.LogError($"[UIExecutorProcess] 非静态方法需要实例，但未找到：{m_targetTypeName}.{m_methodName}");
                OnComplete();
                return;
            }
        }

        // 执行方法
        var methodParams = method.GetParameters();
        object[] args = BuildMethodArguments(methodParams);
        object result = method.Invoke(instance, args);

        // ... 协程处理逻辑
    }

    /// <summary>
    /// 解析实例
    /// </summary>
    private object ResolveInstance(Type targetType)
    {
        // 1. 优先使用构造函数传入的实例
        if (m_targetInstance != null && targetType.IsInstanceOfType(m_targetInstance))
        {
            return m_targetInstance;
        }

        // 2. 尝试通过 InstanceResolver 获取
        if (m_instanceResolver != null)
        {
            var resolved = m_instanceResolver.Resolve(targetType);
            if (resolved != null)
            {
                return resolved;
            }
        }

        // 3. 尝试查找单例
        var singletonProperty = targetType.GetProperty("Instance",
            BindingFlags.Public | BindingFlags.Static);
        if (singletonProperty != null)
        {
            return singletonProperty.GetValue(null);
        }

        // 4. 尝试从场景中查找 MonoBehaviour
        if (typeof(MonoBehaviour).IsAssignableFrom(targetType))
        {
            return Object.FindObjectOfType(targetType);
        }

        return null;
    }
}

/// <summary>
/// 实例解析器接口
/// </summary>
public interface IInstanceResolver
{
    /// <summary>
    /// 解析指定类型的实例
    /// </summary>
    object Resolve(Type type);

    /// <summary>
    /// 解析指定类型的实例（泛型版本）
    /// </summary>
    T Resolve<T>() where T : class;
}
```

### 10.3 最佳实践总结

| 类别 | 建议 | 说明 |
|------|------|------|
| **错误处理** | 构造时验证参数 | 提前暴露问题，避免运行时异常 |
| **错误处理** | 使用错误码 | 便于定位问题和自动化日志分析 |
| **性能优化** | 使用缓存 | 对重复计算结果（如动画时长）进行缓存 |
| **性能优化** | 安全注册/注销 | 避免重复注册 EditorUpdate 导致的内存泄漏 |
| **接口设计** | 提供 Try 模式 | `TryResolveController` 比 null 检查更清晰 |
| **接口设计** | 添加状态属性 | 如 `IsInitialized`，便于调用前检查 |
| **解耦设计** | 使用事件总线 | 组件间通过事件通信，降低直接依赖 |
| **常量定义** | 避免魔法数字 | 所有固定值定义为常量，便于维护 |
| **日志规范** | 统一日志标签 | 每个类使用 `LOG_TAG` 常量 |
| **资源管理** | 提供 Dispose | 编辑器窗口关闭时正确释放资源 |

---

**文档版本**: v1.1
**最后更新**: 2025-12-23
**作者**: Claude Code
