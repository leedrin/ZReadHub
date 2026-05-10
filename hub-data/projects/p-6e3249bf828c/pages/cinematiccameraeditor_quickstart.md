# 电影级相机编辑器 - 5分钟快速开始

## 第一步：创建序列资产 (30秒)

1. 在Project窗口中右键点击
2. 选择 `Create > ProjectEF > Cinematic > Cinematic Sequence`
3. 命名为 `TestSequence`

![创建序列资产](https://via.placeholder.com/400x200/4CAF50/FFFFFF?text=Create+Sequence+Asset)

---

## 第二步：打开编辑器 (10秒)

1. 菜单栏点击 `ProjectEF > Cinematic > Sequence Editor`
2. 将 `TestSequence` 拖入编辑器窗口的 "当前序列" 字段

![打开编辑器](https://via.placeholder.com/600x300/2196F3/FFFFFF?text=Open+Editor+Window)

---

## 第三步：添加第一个镜头 (20秒)

1. 点击工具栏的 **"添加片段"** 按钮
2. 在右侧属性面板中修改片段名称为 `Opening Shot`
3. 观察时间轴上出现的绿色片段块

![添加片段](https://via.placeholder.com/600x150/FF9800/FFFFFF?text=Add+Shot+Clip)

---

## 第四步：设置起始关键帧 (1分钟)

### 方式A：在Scene视图中直观设置 (推荐)

1. 确保Scene视图可见
2. 在Scene中找到绿色的 "起始关键帧" 球体
3. 按 **W** 键切换到Move工具
4. 拖动绿色球体到你想要的起始位置（例如：(0, 1, -5)）
5. 按 **E** 键切换到Rotate工具，调整相机朝向

### 方式B：在Inspector中精确输入

1. 在右侧属性面板找到 "起始关键帧"
2. 设置：
   - 起始位置: `(0, 1, -5)`
   - 起始旋转: `(0, 0, 0)`
   - 起始FOV: `60`

![设置关键帧](https://via.placeholder.com/400x300/9C27B0/FFFFFF?text=Set+Keyframes)

---

## 第五步：设置结束关键帧 (1分钟)

1. 在Scene视图中找到红色的 "结束关键帧" 球体
2. 拖动到目标位置（例如：(5, 2, 0)）
3. 调整旋转让相机看向场景中心

或在Inspector中输入：
- 结束位置: `(5, 2, 0)`
- 结束旋转: `(10, -90, 0)`
- 结束FOV: `45`

---

## 第六步：生成平滑轨迹 (10秒)

1. 点击工具栏的 **"生成选中"** 按钮
2. 等待1-2秒
3. 观察Scene视图中出现青色的贝塞尔曲线

![生成轨迹](https://via.placeholder.com/600x200/00BCD4/FFFFFF?text=Generate+Path)

**提示**: 如果看不到曲线，请确保：
- 编辑器窗口仍然打开
- Scene视图处于激活状态
- 片段仍然被选中（时间轴上有黄色边框）

---

## 第七步：预览播放 (30秒)

1. 点击工具栏的 **播放按钮 (▶)**
2. 观看相机沿着轨迹移动
3. 拖动时间滑块手动预览不同时间点
4. 在Scene视图中看到：
   - 🟢 起始关键帧（绿色）
   - 🔴 结束关键帧（红色）
   - 🔵 当前相机位置（洋红色）
   - 💙 青色贝塞尔曲线路径

![预览播放](https://via.placeholder.com/600x250/E91E63/FFFFFF?text=Preview+Playback)

---

## 第八步：在游戏中播放 (1分钟)

### 方式A：使用现有相机

1. 在Hierarchy中找到你的主相机
2. 添加组件 `Cinematic Sequence Player`
3. 将 `TestSequence` 拖入 "Sequence Asset" 字段
4. 勾选 "Play On Start"
5. 运行游戏！

### 方式B：创建新相机

1. Hierarchy右键 > `Create Empty`，命名为 `CinematicCamera`
2. 添加组件 `Camera`
3. 添加组件 `Cinematic Sequence Player`
4. 设置序列资产并运行

![Runtime播放](https://via.placeholder.com/400x250/8BC34A/FFFFFF?text=Runtime+Playback)

---

## 🎉 恭喜！你已完成第一个电影镜头

现在你可以：

### 进阶操作

#### 1. 调整贝塞尔曲线 (让路径更平滑)
- 在Scene视图中找到黄色的切线控制点
- 拖动它们改变曲线形状
- 切线越长，曲线越平缓

#### 2. 设置目标物体 (让相机追踪物体)
- 在Inspector的 "目标物体" 部分
- 将场景中的GameObject拖入 "目标 A" 字段
- Scene视图会显示从相机到目标的橙色连线

#### 3. 调整速度曲线 (控制运镜节奏)
- 在Inspector中找到 "速度曲线" 编辑器
- 拖动曲线让相机先慢后快或先快后慢
- 重新点击 "生成选中" 应用曲线

#### 4. 添加多个片段 (创建复杂序列)
- 继续点击 "添加片段"
- 每个片段会自动排列在时间轴上
- 点击 "生成全部" 一次性生成所有轨迹

---

## 常见问题快速解决

### ❓ Scene视图看不到可视化？
**解决**:
1. 确保编辑器窗口打开
2. 确保选中了一个片段
3. 点击Scene视图激活它

### ❓ 生成的路径不平滑？
**解决**:
1. 拖动黄色切线控制点
2. 在Inspector中调整 "切线权重" (0.2-0.5)
3. 增加关键帧之间的距离

### ❓ 相机旋转不对？
**解决**:
1. 在Scene视图中按 **E** 键
2. 使用Rotate工具调整红色/绿色球体的朝向
3. 或在Inspector中精确输入欧拉角

### ❓ Runtime播放时看不到效果？
**解决**:
1. 检查 `CinematicSequencePlayer` 组件是否添加
2. 检查 "Sequence Asset" 是否已设置
3. 检查 "Play On Start" 是否勾选
4. 确保片段已生成轨迹（状态为绿色✓）

---

## 下一步学习

📚 阅读完整文档：
- [详细使用指南](./CinematicCameraEditor_UserGuide.md) - 深入学习所有功能
- [实施总结](./CinematicCameraEditor_ImplementationSummary.md) - 了解系统架构
- [详细设计](./CinematicCameraEditorDetailedDesign.md) - 技术深入研究

🎬 尝试更多场景：
- 创建环绕镜头（起始和结束在物体周围）
- 制作推进镜头（从远到近）
- 组合多个片段创建复杂序列

💡 高级功能：
- 创建自定义风格预设
- 使用AI生成（需要ONNX模型）
- 导出到Unity Timeline

---

## 🆘 需要帮助？

- 查看代码示例: `Cinematic/README.md`
- 检查常见问题: 使用指南的FAQ部分
- 系统架构: 详细设计文档

---

**预计完成时间: 5分钟**
**难度等级: ⭐ 简单**
**效果: 🎬 专业级电影镜头**

开始创作吧！✨
