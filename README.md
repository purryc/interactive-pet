# Interactive Pet · Miso

一只可以在浏览器里逗弄的四足暹罗猫。模型按用户的 Q 版设定制作：圆润的身体、短厚的腿、蓝眼睛和重点色耳爪。网页支持头颈追踪、点击移动、12 个骨骼动作，以及观察和调试面板。

![Miso v10 四足模型](output/siamese_cat_quadruped_hero_v10.png)

[在线体验](https://purryc.github.io/interactive-pet/) · [完整动作预览](output/siamese_cat_quadruped_v10.mp4)

## 本地运行

需要 Node.js 20.19 或更新版本。在 `web/` 内运行：

```sh
npm ci
npm run dev
```

打开 `http://localhost:5179/`。macOS 也可以双击根目录的 `launch_miso.command`。执行 `npm test` 检查实际 GLB 的动作控制，执行 `npm run build` 生成静态网页。

## 怎么玩

- **观察**：拖动旋转、滚动缩放，或切换正面、侧面、背面。
- **逗猫**：在场景中移动指针或轻触地面；猫会平滑转头看向目标。目标高度和头颈角度可调。
- **移动**：点击地面让猫走过去；按住 Shift 点击可小跑。调试面板另有触屏可用的走向／跑向目标按钮。
- **动作**：待机、走路、小跑、下蹲、左右伸爪、跳跃、落地、坐下、张望、嗅闻、伸懒腰。跳跃按钮按下蹲→起跳→落地→待机播放。
- **演示**：播放或保存约 15 秒本地画布录像；不会录制麦克风或屏幕。

## 模型文件

| 文件 | 用途 |
| --- | --- |
| [`output/siamese_cat_quadruped_v10.blend`](output/siamese_cat_quadruped_v10.blend) | Blender 5.2 可编辑模型，32 根骨骼、12 个 Action、展示时间线 |
| [`output/siamese_cat_quadruped_v10.glb`](output/siamese_cat_quadruped_v10.glb) | 网页运行用骨骼动画模型 |
| [`output/cat_asset_config_v10.json`](output/cat_asset_config_v10.json) | 骨骼映射、动作名、坐标和交互参数 |
| [`output/siamese_cat_quadruped_v10.mp4`](output/siamese_cat_quadruped_v10.mp4) | 24.67 秒动作预览 |

Blender 中选中 `Cat_Rig` 并进入 Pose Mode 可以编辑骨骼。要单独修改 Action，先静音 `Quadruped showcase` NLA 轨道。Walk／Run 是原地动画，位移由网页控制。GLB 采用 Y 向上、+Z 朝前，换算尺寸以配置文件为准。

## 源码与验证

`web/src/` 将模型、动作、头颈追踪、移动和输入适配分开。`src/` 保存 v10 的建模、绑定、动作、导出及回导脚本；`reference/` 保存选定设定图和[来源说明](reference/README.md)。v10 的 Blender 重建需要 `output/siamese_cat_quadruped_v6.blend`，它已包含在仓库中。可在安装 Blender 5.2 和 Python 后运行：

```sh
python3 -m venv qa/.venv_sculpt
qa/.venv_sculpt/bin/pip install -r src/requirements_sculpt.txt
qa/.venv_sculpt/bin/python src/produce_v10.py
```

若 Blender 命令未在 PATH 中，可通过 `BLENDER_BIN` 指定其可执行文件。构建会重写 v10 输出；需要保留改动时先另存副本。所有 12 个动作通过逐帧网格及边界检查，1902 个支撑爪样本通过接地检查，GLB 回导和网页的 5 项控制器测试通过；详见 [`qa/anatomy_review_v10.md`](qa/anatomy_review_v10.md) 与 [`qa/web/acceptance_v10.md`](qa/web/acceptance_v10.md)。

## 当前边界

体表是平滑材质和渐变重点色，没有设定图中的蓬松毛发模拟。眼球、眨眼和嘴部动画尚未制作。网页在 Chrome 中完成加载和横竖屏尺寸检查；iPad Safari 真机触摸与性能尚未验收。本仓库没有附角色图像、模型或代码的复用许可证。
