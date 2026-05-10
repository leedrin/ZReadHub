# UIProcess 可视化编辑器 用户手册

## 目录

1. [概述](#概述)
2. [快速开始](#快速开始)
3. [界面介绍](#界面介绍)
4. [基本操作](#基本操作)
5. [轨道类型](#轨道类型)
6. [Clip 编辑](#clip-编辑)
7. [动画信息提取](#动画信息提取)
8. [区间与事件标记](#区间与事件标记)
9. [运行时播放](#运行时播放)
10. [最佳实践](#最佳实践)
11. [常见问题](#常见问题)

---

## 概述

UIProcess 可视化编辑器是一个基于 Unity UIElements 的时间轴编辑工具，用于可视化编排 UI 动画序列。它允许设计师和开发者通过拖拽方式创建复杂的 UI 动画流程，而无需编写代码。

### 核心特性

- **可视化时间轴编辑** - 直观的拖拽式编辑界面
- **多轨道支持** - State、Logic、Audio、Control 四种轨道类型
- **动画信息自动提取** - 从 AdvanceUIStateController、TweenMain、Animator 等组件自动提取动画时长
- **实时预览** - 在编辑器中预览动画效果
- **数据资源化** - 保存为 ScriptableObject，支持版本控制
- **运行时播放** - 通过 UIProcessRuntimePlayer 在游戏中播放

---

## 快速开始

### 打开编辑器

**方法一：通过菜单**
```
Unity 菜单栏 → BJFramework → UI → UIProcess Editor
```

**方法二：双击资源**
在 Project 窗口中双击 `.asset` 格式的 UIProcessDataAsset 文件

### 创建第一个 UIProcess

1. 点击工具栏 **「新建」** 按钮
2. 选择保存位置，输入文件名
3. 点击 **「+」** 添加轨道
4. 选择轨道类型（如 State）
5. 右键点击时间轴空白处，选择 **「在此添加 Clip」**
6. 在属性面板中编辑 Clip 参数
7. 点击 **「保存」**

---

## 界面介绍

```
┌─────────────────────────────────────────────────────────────────┐
│  工具栏: [新建] [打开] [保存] | [▶] [❚❚] [■] | 0.00s | [刷新动画] │
├──────────────┬──────────────────────────────────────────────────┤
│              │  时间轴标尺  0.0s   0.5s   1.0s   1.5s   2.0s    │
│  轨道列表    ├──────────────────────────────────────────────────┤
│              │                                                  │
│  ┌─────────┐ │  ┌────────────┐  ┌──────────┐                   │
│  │State [+]│ │  │ State_Show │  │State_Idle│                   │
│  └─────────┘ │  └────────────┘  └──────────┘                   │
│              │                                                  │
│  ┌─────────┐ │  ┌─────────────────┐                            │
│  │Logic [+]│ │  │   OnComplete    │                            │
│  └─────────┘ │  └─────────────────┘                            │
│              │                                                  │
├──────────────┴──────────────────────────────────────────────────┤
│  属性面板                                                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 名称: State_Show                                           │ │
│  │ 开始时间: 0.00                                             │ │
│  │ 时长: 0.50                                                 │ │
│  │ 状态名: Show                                               │ │
│  └────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  状态栏: 就绪                                    [100%] ══════  │
└─────────────────────────────────────────────────────────────────┘
```

### 工具栏

| 按钮 | 功能 | 快捷键 |
|------|------|--------|
| 新建 | 创建新的 UIProcess 资源 | - |
| 打开 | 打开现有资源 | - |
| 保存 | 保存当前资源 | Ctrl+S |
| ▶ | 播放预览 | Space |
| ❚❚ | 暂停预览 | Space |
| ■ | 停止预览 | - |
| 刷新动画 | 从场景中提取动画时长 | - |

### 轨道列表面板

显示所有轨道，每个轨道包含：
- **颜色指示器** - 标识轨道类型
- **轨道名称** - 可编辑
- **类型标签** - [State] / [Logic] / [Audio] / [Control]
- **M 按钮** - 静音（Mute）
- **🔒 按钮** - 锁定
- **× 按钮** - 删除轨道

### 时间轴面板

- **标尺** - 显示时间刻度，点击可定位播放头
- **轨道行** - 显示该轨道的所有 Clip
- **播放头** - 红色竖线，表示当前播放位置
- **Ctrl + 滚轮** - 缩放时间轴

### 属性面板

选中 Clip 后显示其可编辑属性，不同类型的 Clip 有不同的属性。

### 状态栏

- 左侧：操作状态提示
- 右侧：缩放比例滑块

---

## 基本操作

### 轨道操作

| 操作 | 方法 |
|------|------|
| 添加轨道 | 点击轨道列表标题栏的 **「+」** 按钮 |
| 删除轨道 | 点击轨道右侧的 **「×」** 按钮 |
| 选中轨道 | 单击轨道项 |
| 静音轨道 | 点击 **「M」** 按钮，静音后运行时不执行 |
| 锁定轨道 | 点击 **「🔒」** 按钮，锁定后无法编辑 |

### Clip 操作

| 操作 | 方法 |
|------|------|
| 添加 Clip | 右键点击时间轴空白处 → 选择「在此添加 Clip」 |
| 选中 Clip | 单击 Clip |
| 移动 Clip | 拖拽 Clip 到新位置 |
| 调整时长 | 拖拽 Clip 左右边缘 |
| 删除 Clip | 选中后按 Delete 键（待实现） |

### 时间轴操作

| 操作 | 方法 |
|------|------|
| 定位播放头 | 点击时间轴标尺 |
| 缩放时间轴 | Ctrl + 鼠标滚轮 / 拖动右下角滑块 |
| 滚动时间轴 | 鼠标滚轮 / 拖拽滚动条 |

---

## 轨道类型

### State 轨道（状态轨道）

用于控制 UI 状态切换，关联 `AdvanceUIStateController` 或 `CommonUIStateController`。

**Clip 属性：**
- **状态名 (StateName)** - 目标状态名称，如 "Show"、"Hide"、"Idle"
- **等待完成 (WaitForCompletion)** - 是否等待动画播放完成
- **手动时长覆盖** - 手动指定时长，覆盖自动提取的值
- **动画信息** - 自动提取的动画时长信息（只读）

**颜色：** 蓝色

**示例用途：**
- 面板显示/隐藏动画
- 按钮状态切换
- UI 元素进场/退场

### Logic 轨道（逻辑轨道）

用于在指定时间点执行 C# 逻辑。

**Clip 属性：**
- **方法名 (MethodName)** - 要调用的方法名
- **目标类型 (TargetTypeName)** - 包含该方法的类型全名

**颜色：** 红色

**示例用途：**
- 动画完成回调
- 数据更新
- 事件触发

### Audio 轨道（音频轨道）

用于播放 UI 音效。

**Clip 属性：**
- **音频路径 (AudioPath)** - 音频资源路径
- **音量 (Volume)** - 播放音量 (0-1)
- **循环 (Loop)** - 是否循环播放

**颜色：** 绿色

**示例用途：**
- 按钮点击音效
- 界面切换音效
- 背景音乐

### Control 轨道（控制轨道）

用于流程控制，如循环、跳转、等待。

**Clip 属性：**
- **控制类型 (ControlType)** - Wait / Loop / Jump / Pause
- **目标区间 (TargetSectionName)** - 跳转目标区间名
- **循环次数 (LoopCount)** - 循环次数（-1 为无限）

**颜色：** 黄色

**控制类型说明：**

| 类型 | 说明 |
|------|------|
| Wait | 等待指定时长 |
| Loop | 循环播放指定区间 |
| Jump | 跳转到指定区间 |
| Pause | 暂停播放，等待外部恢复 |

---

## Clip 编辑

### 通用属性

所有类型的 Clip 都包含以下属性：

| 属性 | 说明 |
|------|------|
| 名称 (ClipName) | Clip 的标识名称 |
| 开始时间 (StartTime) | 在时间轴上的开始位置（秒） |
| 时长 (Duration) | Clip 的持续时间（秒） |
| 颜色 (ClipColor) | Clip 在时间轴上的显示颜色 |
| 备注 (Comment) | 备注信息 |

### 时间吸附

编辑 Clip 时，时间会自动吸附到帧边界。帧率可在资源设置中调整（默认 60 FPS）。

### Clip 重叠

同一轨道内的 Clip 不允许重叠。如果拖动导致重叠，Clip 会自动调整到最近的可用位置。

---

## 动画信息提取

### 自动提取

编辑器可以从场景中的 UI 组件自动提取动画时长信息。

**支持的组件类型：**

| 组件 | 提取信息 |
|------|---------|
| Animator | AnimationClip 时长、循环设置 |
| TweenMain | duration、delay、style |
| Animation (Legacy) | clip.length、wrapMode |
| DOTween 组件 | duration、delay、loops |

### 使用方法

1. 在 Hierarchy 中选中包含 UI Controller 的 GameObject
2. 确保场景中有 `AdvanceUIStateController` 或 `CommonUIStateController`
3. 点击工具栏 **「刷新动画」** 按钮
4. 编辑器会自动匹配 State Clip 的状态名并提取时长

### 手动覆盖

如果自动提取的时长不准确，可以在属性面板中设置 **「手动时长覆盖」** 值。设置后该值优先于自动提取值。

---

## 区间与事件标记

### 区间 (Section)

区间用于标记时间轴上的一段范围，可用于循环和跳转。

**添加区间：**
右键时间轴 → 「添加区间标记」

**区间属性：**
- **名称** - 区间标识
- **开始时间** - 区间起点
- **结束时间** - 区间终点
- **可中断** - 是否允许外部中断
- **退出区间** - 中断后跳转的目标区间

### 事件标记 (Event Marker)

事件标记用于在特定时间点触发事件通知。

**添加事件：**
右键时间轴 → 「添加事件标记」

**事件属性：**
- **名称** - 事件标识
- **时间** - 触发时间点
- **参数** - 事件参数（字符串）
- **启用** - 是否启用该事件

---

## 运行时播放

### UIProcessRuntimePlayer

在游戏运行时使用 `UIProcessRuntimePlayer` 加载和播放 UIProcess。

```csharp
using BlackJack.BJFramework.Runtime.UI;

public class MyUIController : MonoBehaviour
{
    [SerializeField]
    private UIProcessDataAsset m_processAsset;

    private UIProcessRuntimePlayer m_player;

    void Start()
    {
        m_player = new UIProcessRuntimePlayer();
        m_player.Load(m_processAsset);
    }

    public void PlayAnimation()
    {
        m_player.Play(onComplete: () => {
            Debug.Log("UIProcess 播放完成");
        });
    }

    public void StopAnimation()
    {
        m_player.Stop();
    }
}
```

### UIProcessBuilder

使用 `UIProcessBuilder` 将 `UIProcessDataAsset` 转换为可执行的 `UIProcess` 对象。

```csharp
// 构建 UIProcess
UIProcess process = UIProcessBuilder.Build(m_processAsset);

// 播放
process.Play();
```

### 事件监听

```csharp
m_player.OnSectionEnter += (sectionName) => {
    Debug.Log($"进入区间: {sectionName}");
};

m_player.OnEventTriggered += (eventName, eventParams) => {
    Debug.Log($"事件触发: {eventName}, 参数: {eventParams}");
};
```

---

## 最佳实践

### 命名规范

```
UIProcess 资源命名：
  {功能名}_UIProcess.asset
  例：MainMenu_UIProcess.asset, ShopPanel_UIProcess.asset

轨道命名：
  {Controller名称}_{类型}
  例：MainPanel_State, ButtonGroup_State

Clip 命名：
  {动作}_{状态}
  例：Panel_Show, Button_Highlight, OnComplete_Callback
```

### 组织结构

```
推荐的文件夹结构：
Assets/
  GameProject/
    UIProcess/
      MainMenu/
        MainMenu_UIProcess.asset
      Shop/
        ShopPanel_UIProcess.asset
        ShopItem_UIProcess.asset
```

### 性能优化

1. **减少轨道数量** - 合并功能相似的轨道
2. **避免过长的时间轴** - 将长动画拆分为多个 UIProcess
3. **使用区间复用** - 通过 Loop 复用重复的动画片段
4. **预加载资源** - 在需要播放前提前 Load

### 调试技巧

1. **使用备注** - 在 Clip 中添加备注说明其用途
2. **颜色区分** - 使用不同颜色标识不同功能的 Clip
3. **静音测试** - 静音部分轨道来隔离问题
4. **验证数据** - 使用 Inspector 中的「验证数据」按钮检查错误

---

## 常见问题

### Q: 动画时长提取不准确怎么办？

**A:** 可以使用「手动时长覆盖」属性手动设置准确的时长。确保场景中的 Controller 组件设置正确。

### Q: 如何让多个动画同时播放？

**A:** 将需要同时播放的 Clip 放在不同轨道上，设置相同的开始时间。运行时会并行执行。

### Q: 如何实现动画循环？

**A:**
1. 创建一个 Section 区间，标记需要循环的范围
2. 添加 Control 轨道
3. 在区间结束位置添加 Loop 类型的 Control Clip
4. 设置循环次数（-1 为无限循环）

### Q: 编辑器无法打开怎么办？

**A:**
1. 检查控制台是否有编译错误
2. 尝试 Unity 菜单 → Assets → Reimport All
3. 删除 Library 文件夹后重新打开项目

### Q: 如何在代码中动态修改 UIProcess？

**A:**
```csharp
var asset = Resources.Load<UIProcessDataAsset>("MyProcess");

// 修改 Clip 时长
var track = asset.Tracks[0];
var clip = track.Clips[0];
clip.Duration = 1.5f;

// 重新计算总时长
asset.RecalculateDuration();
```

### Q: 支持热更新吗？

**A:** UIProcessDataAsset 是 ScriptableObject，可以打包到 AssetBundle 中进行热更新。资源包含版本号字段用于兼容性检查。

---

## 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2024-01 | 初始版本 |

---

## 技术支持

如有问题，请联系框架开发团队或查阅 `CLAUDE.md` 中的架构文档。
