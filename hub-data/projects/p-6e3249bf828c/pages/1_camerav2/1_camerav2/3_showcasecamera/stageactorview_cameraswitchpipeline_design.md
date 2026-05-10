# StageActorViewUITask 相机机位切换管线设计方案

## 一、背景与问题

### 1.1 当前问题

当前 `StageActorViewUITaskCompMainTofu` 的相机切换通过直接方法调用实现：

```csharp
// 当前实现：直接调用，绕过管线
public bool CameraSwitchTo(int index)
{
    return m_mainUICtrl.CameraSwitchTo(index);
}
```

这违反了 EFUITask 框架规范：**所有 UI 刷新必须走管线**。

### 1.2 设计约束

`StageActorViewUITaskCompMainTofu` 是**通用 Tofu 组件**，会被多个 UITask 复用（如 `CommonItemStageViewUITask`、`TackleAssembleTackleUITask` 等）。因此：

- **不能使用 UITask 级别的 Mode / PipelineUpdateMask**（这些属于 UITask，不属于 Tofu）
- **必须使用 Tofu 自有的 ParamKey + `ParamDictHasCare` + `m_isUpdateAllTofu=false`** 机制
- **ParamKey 必须以 Tofu 名字做前缀**，避免与宿主 UITask 中其他 Tofu 的 ParamKey 冲突

【补丁】
- 本次改造采用 **Tofu Flag 机制（一次性切换）**：不再保留“旧参数隐式推导行为”。
- 外部发起 StageActorView 相关增量刷新时，必须显式传递 `ParamKey4TofuUpdateFlag`。

---

## 二、框架机制回顾

### 2.1 多 Tofu 部分刷新机制

```
UITaskUpdatePipelineDefault 构造函数:
┌─────────────────────────────────────────────────┐
│ if (initInfo.m_isUpdateAllTofu)                 │
│     → 所有 Tofu 都参与管线                       │
│ else                                            │
│     → 遍历所有 Tofu，调用                        │
│       tofu.NeedUpdateInThisPipeline(initInfo)   │
│       → 内部调用 ParamDictHasCare(paramDict)    │
│       → 检查 paramDict 中是否有自己关心的 Key     │
│       → 只有返回 true 的 Tofu 才参与本次管线      │
└─────────────────────────────────────────────────┘
```

### 2.2 ParamKey 防冲突规范

```
❌ 错误：使用通用名称
  "CameraIndex"  ← 可能与其他 Tofu 冲突

✅ 正确：以 Tofu 类名做前缀
  "StageActorViewUITaskCompMainTofu_CameraVCIndex"
```

---

## 三、设计方案

### 3.1 新增 ParamKey + Tofu Flag（定义在 Tofu 内部）

在 `StageActorViewUITaskCompMainTofu` 中新增：

```csharp
[Flags]
public enum PipelineUpdateMask
{
    None = 0,    
    StageActorSwitch     = 1 << 1,     // 新建/切换StageActor
    StageActorAdjust      = 1 << 2,    // 只调整StageActor位置，动作等
    CameraVCSwitch       = 1 << 3,     // 只切换相机机位
    RefreshAll            = 1 << 4,    // 全部更新
}

public const string ParamKeyPipelineUpdateMask = "StageActorViewPipelineUpdateMask";

```

### 3.2 UITask 注册 ParamKey

宿主 UITask 在两个数组中都要注册：

```csharp
// StageActorViewUITask.cs
protected override string[] CustomParamKey4UpdatePipelineDefineArray
{
    get
    {
        return new string[]
        {            
            StageActorViewUITaskCompMainTofu.ParamKeyPipelineUpdateMask,   
        };
    }
}
```

> 其他复用此 Tofu 的 UITask 也需要完成相同注册。

### 3.3 Override `ParamDictHasCare`

```csharp
// StageActorViewUITaskCompMainTofu.cs
/// <summary>  
/// 判断本次管线的参数字典中是否包含关注的参数  
/// 用于部分刷新时决定此 Tofu 是否参与管线  
/// </summary>  
public override bool ParamDictHasCare(CustomParamDictionary paramDict)  
{  
    // 检查全局 PipelineUpdateMask 是否包含 StageActorViewUITaskCompMainTofu 关心的标志 ParamKeyPipelineUpdateMask    
    if (paramDict.ParamContainsKey(ParamKeyPipelineUpdateMask))  
    {
            return true;  
    }  
    return false;  
}
```

```csharp
public override void UpdateContextSetup(ICustomParamDictionaryReadOnly paramDict, UITaskUpdatePipelineStartType pipelineStartType,  
    params object[] extraParamArr)  
{  
    base.UpdateContextSetup(paramDict, pipelineStartType, extraParamArr);  
    // 获取本次管线行为  
    m_currPipelineUpdateMask = paramDict.GetStructParam<PipelineUpdateMask>(ParamKeyPipelineUpdateMask);

	// 根据Mask 如果是第一次，或StageActorSwitch， 需要进行旧StageActor销毁，以及新建StageActor
	
	
	// 其他参数获取 参考原来代码
	m_stagePreset
	m_isActorRotateEnabled
	m_isCameraControllEnabled
	m_rotationAxes
	m_rotationSpace
	m_sharedSceneLayer
	
	...    
}
```

【补丁】
- 不再做旧 Key 兼容推导（一次性切换要求）。

### 3.6 `ViewUpdate` 分支执行相机切换/StageActor设置

```csharp
// StageActorViewUITaskCompMainTofu.cs
public override void ViewUpdate(IUITaskUpdatePipelineController pipelineCtrl)
{
    // 1) 全量刷新（首次进入、恢复、切换StageActor）
    if (IsUITaskUpdatePipelineInitOrResume() ||   m_currPipelineUpdateMask.HasFlag(StageActorViewTofuUpdateFlag.StageActorSwitch) ||
    m_currPipelineUpdateMask.HasFlag(StageActorViewTofuUpdateFlag.RefreshAll))
    {
        DisplayStageActorInternal();
        (m_owner as StageActorViewUITask)?.OnEventActorReady(m_stageActor);
    }

    // 2) StageActor调整（旋转/缩放/动画）
    if (m_currPipelineUpdateMask.HasFlag(StageActorViewTofuUpdateFlag.StageActorAdjust)
        && m_pendingStageActorSetup != null)
    {
        StageActorSetupApply(m_pendingStageActorSetup);
    }

    // 3) 相机机位切换（camera-only 不触发 DisplayStageActorInternal）
    if (m_currPipelineUpdateMask.HasFlag(StageActorViewTofuUpdateFlag.CameraVCSwitch)
        && m_pendingCameraVCIndex >= 0
        && m_mainUICtrl != null)
    {
        m_mainUICtrl.CameraSwitchTo(m_pendingCameraVCIndex);
        m_pendingCameraVCIndex = -1;
    }
}
```

【补丁】
- 解决最初版本遗漏：camera-only 场景不再走 `DisplayStageActorInternal()`。

### 3.7 发起管线的公开方法（替代原直接调用）

```csharp
// StageActorViewUITaskCompMainTofu.cs
public void CameraVCSwitchByPipeline(int vcIndex)
{
    var info = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    info.m_isUpdateAllTofu = false;
    info.m_customParamDict.SetParam(ParamKey4TofuUpdateFlag, StageActorViewTofuUpdateFlag.CameraVCSwitch);
    info.m_customParamDict.SetParam(ParamKey4CameraVCIndex, vcIndex);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(info);
}

public void StageActorAdjustByPipeline(StageActorSetupParam setupParam)
{
    var info = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    info.m_isUpdateAllTofu = false;
    info.m_customParamDict.SetParam(ParamKey4TofuUpdateFlag, StageActorViewTofuUpdateFlag.StageActorAdjust);
    info.m_customParamDict.SetParam(ParamKey4StageActorSetup, setupParam);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(info);
}

public void StageActorSwitchByPipeline(IStageActor actor, string stagePreset)
{
    var info = m_owner.CompUpdatePipelineManagerGet().UpdatePipelineInitInfoAlloc();
    info.m_isUpdateAllTofu = false;
    info.m_customParamDict.SetParam(ParamKey4TofuUpdateFlag, StageActorViewTofuUpdateFlag.RefreshAll);
    info.m_customParamDict.SetParam(StageActorViewUITask.IntentParamKey4StageActor, actor);
    info.m_customParamDict.SetParam(StageActorViewUITask.IntentParamKey4StagePreset, stagePreset);
    m_owner.CompUpdatePipelineManagerGet().UpdatePipelineLaunch(info);
}
```

---

## 四、完整数据流

### 4.1 相机机位切换（camera-only）

```
外部调用 task.CameraVCSwitchByPipeline(2)
    │
    ▼
UpdatePipelineInitInfoAlloc()
    m_isUpdateAllTofu = false
    m_customParamDict.SetParam("..._UpdateFlag", CameraVCSwitchChanged)
    m_customParamDict.SetParam("..._CameraVCIndex", 2)
    │
    ▼
UpdatePipelineLaunch(initInfo)
    │
    ▼
UITaskUpdatePipelineDefault 构造函数
    ├─ m_isUpdateAllTofu == false
    ├─ StageActorViewMainTofu.ParamDictHasCare() == true
    ├─ 其他Tofu：通常 false（跳过）
    │
    ▼
UpdateContextSetup
    m_currTofuUpdateFlag = CameraVCSwitchChanged
    m_pendingCameraVCIndex = 2
    │
    ▼
LayerLoadIsNeededCheck → false
DynamicResLoadIsNeededCheck → false
    │
    ▼
ViewUpdate
    不调用 DisplayStageActorInternal
    m_mainUICtrl.CameraSwitchTo(2)
```

### 4.2 切换 StageActor / 首次进入

```
flag 包含 StageActorChanged/StagePresetChanged 或 Init/Resume
    ▼
IsFullRefreshThisRound == true
    ▼
DataCache/Layer/Res/View 全量链路执行
```

---

## 五、DebugMenu 调用方式更新

`ShowcaseDebugParamConfig` 中的滑动条改为通过管线发起：

```csharp
// ShowcaseDebugParamConfig.cs
int newIndex = EditorGUILayout.IntSlider(m_vcIndex, 0, VcIndexMax);
if (newIndex != m_vcIndex)
{
    m_vcIndex = newIndex;
    var task = MainTaskGet(); // StageActorViewUITask
    if (task != null)
    {
        task.CameraVCSwitchByPipeline(m_vcIndex); // ← 走管线
    }
}
```



---

## 六、继承链影响检查（一次性切换必须完成）

1. `CommonItemStageViewUITaskCompMainTofu`
   - 自有 `ParamDictHasCare/UpdateContextSetup`，与基类新 flag 机制并存。
   - 需确认不误调用 StageActorView 的 `*ByPipeline` 新接口。
1. `FishmanQuickAccessUITaskCompMainTofu`
   - 已有内部 `PipelineUpdateMask`（`SwitchFishman/SwitchTackle`）。
   - 需明确：该 mask 用于本类业务，StageActorViewTofuUpdateFlag 用于 StageActorView 通用字段变更。
4. `TackleAssembleTackleUITaskCompMainTofu`
   - 当前在 `base.UpdateContextSetup` 之后又读取并覆盖 `StageActor`。
   - 需改为“基类 flag 驱动 + 子类补充字段”，避免重复销毁/覆盖。
5. `PlayerHeadIconShowUITaskCompMainTofu`
   - 走 `base.ViewUpdate()`，将直接受新 flag 路径影响。
   - 对应 `UIIntentCreate` 必须显式写 flag。
