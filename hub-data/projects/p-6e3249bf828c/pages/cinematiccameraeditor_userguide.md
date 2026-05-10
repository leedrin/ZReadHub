# 电影级相机编辑器 - 使用指南

## 快速开始

### 1. 创建序列资产

1. 在Project窗口中右键点击 `Create > ProjectEF > Cinematic > Cinematic Sequence`
2. 命名你的序列资产，例如 `MyFirstSequence`

### 2. 打开编辑器

1. 菜单栏选择 `ProjectEF > Cinematic > Sequence Editor`
2. 在编辑器窗口中将你创建的序列资产拖入 "当前序列" 字段

### 3. 添加镜头片段

1. 点击工具栏的 "添加片段" 按钮
2. 新片段会自动出现在时间轴上

### 4. 编辑关键帧

#### 方式1: 在Inspector中手动输入
- 在右侧属性面板中直接输入位置、旋转、FOV值

#### 方式2: 在Scene视图中可视化编辑
1. 确保Scene视图可见
2. 选中一个片段
3. 使用Unity的Move工具(W键)拖拽关键帧位置
4. 使用Rotate工具(E键)调整相机旋转
5. 拖拽黄色的切线控制点调整贝塞尔曲线形状

### 5. 设置目标物体

1. 在Inspector的 "目标物体" 部分
2. 将场景中的物体拖入 "目标 A" 或 "目标 B" 字段
3. 目标物体会在时间轴的下方轨道显示

### 6. 生成轨迹

#### 基础生成(默认插值)
- 点击 "生成选中" 按钮
- 系统会自动在起始和结束关键帧之间生成平滑的贝塞尔曲线

#### AI风格生成(需要模型)
1. 勾选片段的 "启用AI生成"
2. 选择一个 StylePreset 资产
3. 点击 "生成选中" 按钮

### 7. 调整速度曲线

1. 在Inspector中找到 "速度曲线" 编辑器
2. 调整曲线控制相机沿轨迹的速度变化
3. 重新生成以应用速度曲线

### 8. 预览播放

1. 点击工具栏的 播放按钮 (▶)
2. 拖动时间滑块查看不同时间点的相机状态
3. 在Scene视图中实时看到相机位置和视锥体

### 9. Runtime播放

#### 方式1: 使用CinematicSequencePlayer组件
```csharp
// 在场景中创建一个带相机的GameObject
// 添加 CinematicSequencePlayer 组件
// 将序列资产拖入组件
// 运行游戏时会自动播放
```

#### 方式2: 通过代码控制
```csharp
using BlackJack.ProjectEF.Cinematic.Runtime;

public class MyCinematicController : MonoBehaviour
{
    public CinematicSequencePlayer player;
    public CinematicSequenceAsset sequence;

    void Start()
    {
        player.SetSequenceAsset(sequence);
        player.Play();
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            if (player.IsPlaying)
                player.Pause();
            else
                player.Play();
        }
    }
}
```

---

## 高级功能

### 创建风格预设

1. 右键 `Create > ProjectEF > Cinematic > Style Preset`
2. 命名预设(例如: "推进镜头")
3. (可选)点击上下文菜单 "Initialize Default Style Code (64D)" 生成随机风格向量
4. 设置推荐的距离范围和FOV范围

### 贝塞尔切线技巧

- **对称切线**: 拖动一侧切线时，按住 Shift 键可对称调整另一侧
- **切线长度**: 切线越长，曲线越平缓
- **切线方向**: 切线方向决定相机进入/离开的角度

### 时间轴操作

- **拖动片段**: 直接在时间轴上拖动片段调整时间
- **调整长度**: (未来功能) 拖动片段边缘调整起始/结束时间
- **多选片段**: (未来功能) 按住 Ctrl 多选片段批量操作

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| 空格 | 播放/暂停 |
| Home | 跳转到开始 |
| End | 跳转到结束 |
| W | Move工具(编辑关键帧位置) |
| E | Rotate工具(编辑相机旋转) |
| F | 聚焦到选中关键帧 |

---

## 常见问题

### Q: 为什么看不到Scene视图中的可视化?
A: 确保:
1. 序列资产已选中
2. 至少选中了一个片段
3. Scene视图是激活状态

### Q: 生成的轨迹不平滑怎么办?
A:
1. 调整关键帧的贝塞尔切线
2. 在属性面板中增加中间点数量
3. 调整速度曲线使变化更渐进

### Q: 如何导出相机动画?
A: 当前版本支持通过 CinematicSequencePlayer 在Runtime播放。Timeline集成功能在后续版本实现。

### Q: AI生成失败怎么办?
A: 当前版本使用基础插值算法作为降级方案。完整的AI功能需要:
1. Unity Barracuda package
2. 训练好的ONNX模型文件
3. 将模型放置在 StreamingAssets/CinematicModels/ 目录

---

## 最佳实践

### 1. 命名规范
- 序列: `Seq_场景名_序号`，例如 `Seq_Opening_01`
- 片段: 描述性名称，例如 `推进到主角`, `环绕展示`
- 风格预设: 运镜类型，例如 `Style_DollyIn`, `Style_Orbit`

### 2. 关键帧设置
- 起始和结束关键帧的位置差距不要过大
- FOV变化保持在合理范围(40-80度)
- 避免过于剧烈的旋转变化

### 3. 性能优化
- 限制轨迹点数量在10-20个
- 避免过多重叠的片段
- Runtime播放时使用对象池管理相机

### 4. 版本控制
- 序列资产是ScriptableObject，适合Git版本控制
- 定期保存资产(Ctrl+S)
- 使用描述性的提交信息

---

## 系统架构

```
数据层:
├── CinematicSequenceAsset (序列容器)
├── CinematicShotClip (片段数据)
├── CameraKeyframe (关键帧数据)
└── StylePresetSO (风格预设)

编辑器层:
├── CinematicSequenceEditorWindow (主窗口)
├── TimelinePanel (时间轴面板)
└── CinematicSequenceSceneExtension (Scene视图扩展)

Runtime层:
└── CinematicSequencePlayer (播放器)

AI层:
├── TTAEncoder (时间编码器)
└── CinematicPathGenerator (路径生成器)
```

---

## 更新日志

### v1.0 (当前版本)
- ✅ 完整的数据结构
- ✅ 双轨道时间轴编辑器
- ✅ Scene视图实时编辑
- ✅ 基础路径生成(插值)
- ✅ Runtime播放组件
- ✅ 贝塞尔曲线支持
- ⏳ AI生成(框架已搭建，需ONNX模型)
- ⏳ Timeline集成(规划中)

### 未来规划
- Unity Timeline轨道集成
- 多相机序列支持
- 相机组预设库
- 实时预览优化
- 批量导出工具

---

## 技术支持

如有问题，请查阅:
1. 详细设计文档: `Assets/Doc/CinematicCameraEditorDetailedDesign.md`
2. 架构文档: `Assets/Doc/Camera_Architecture.md`
3. 项目主文档: `CLAUDE.md`

---

**祝您创作出精彩的电影级相机镜头！** 🎬
