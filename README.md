# Interactive Pet · Heihei

一只可以在浏览器里逗弄的四足暹罗猫。模型按用户的 Q 版设定制作：圆润的身体、短厚的腿、蓝眼睛和重点色耳爪。V2 把 Apple Pencil 当作杆身：笔尖外只显示一段默认 4 厘米的棒头，倾斜和转向会移动系绳点。12 段绳、编织球与五片三节羽片由物理系统驱动，与猫的骨骼碰撞区域和地面互动。猫仍自行决定观察、靠近、追逐、伸爪或扑跳。V0 的 12 个骨骼动作与手动控制仍可从折叠面板使用。

![Heihei v10 四足模型](output/siamese_cat_quadruped_hero_v10.png)

[在线体验](https://purryc.github.io/interactive-pet/) · [完整动作预览](output/siamese_cat_quadruped_v10.mp4)

## 本地运行

需要 Node.js 20.19 或更新版本。在 `web/` 内运行：

```sh
npm ci
npm run dev
```

打开 `http://localhost:5179/`。macOS 也可以双击根目录的 `launch_heihei.command`；旧的 `launch_miso.command` 仍可用。iPad 与 Mac 在同一网络时，可在 iPad Safari 打开 Mac 的局域网地址及 `5179` 端口。执行 `npm test` 检查实际 GLB、Pencil 姿态与碰撞链，执行 `npm run build` 生成静态网页。

## 怎么玩

- **逗猫棒（默认）**：Apple Pencil 悬停或移动鼠标。Pencil 本身是杆身，屏上短棒头随笔的倾角与方位改变系绳点；绳、球和羽片随后摆动并碰撞猫与地面。Heihei 按距离、高度与速度决定行动；接触后会有短暂头颈反应，前爪能拨动球。高度滑块只模拟网页拿不到的离屏高度。观察、零食、视角、动作、参数和记录都在右上角「设置」里。
- **双指零食**：在零食附近用两指捏合并移动，松开后零食下落；猫靠近并低头闻。它是未来双指悬停的触屏代理。
- **观察**：拖动旋转、滚动缩放，或切换正面、侧面、背面。
- **手动动作与 V0 控制**：展开后可使猫直接转头、点击移动、播放 12 个动作。手动动作不会被 V1 自主决策立即打断。
- **动作**：待机、走路、小跑、下蹲、左右伸爪、跳跃、落地、坐下、张望、嗅闻、伸懒腰。跳跃按钮按下蹲→起跳→落地→待机播放。
- **演示**：播放或保存约 15 秒本地画布录像；不会录制麦克风或屏幕。
- **调试与记录**：展开「互动调试与记录」可调虚拟棒头和绳长，查看角度来源、是否真的变化、物理步数及接触部位。模型参数内可显示碰撞轮廓。CSV 记录输入来源与接触事件；日志只保留在网页内存，除非你主动导出。

## 模型文件

| 文件 | 用途 |
| --- | --- |
| [`output/siamese_cat_quadruped_v10.blend`](output/siamese_cat_quadruped_v10.blend) | Blender 5.2 可编辑模型，32 根骨骼、12 个 Action、展示时间线 |
| [`output/siamese_cat_quadruped_v10.glb`](output/siamese_cat_quadruped_v10.glb) | 网页运行用骨骼动画模型 |
| [`output/cat_asset_config_v10.json`](output/cat_asset_config_v10.json) | 骨骼映射、动作名、坐标和交互参数 |
| [`output/cat_wand_v2.blend`](output/cat_wand_v2.blend) | 可编辑逗猫棒：竹杆、绳结、编织球、分层羽片和羽绒丝 |
| [`web/public/assets/cat_wand_v2.glb`](web/public/assets/cat_wand_v2.glb) | 网页用逗猫棒，Rod 与 Lure 可独立摆动 |
| [`output/cat_wand_v3.blend`](output/cat_wand_v3.blend) | V2 可编辑逗猫棒；五片羽毛各有三节骨骼，含可变形羽轴与细绒 |
| [`web/public/assets/cat_wand_v3.glb`](web/public/assets/cat_wand_v3.glb) | 当前网页使用的 v3 资产；保留 v2 文件 |
| [`ios/heihei_hover/HeiheiHover.xcodeproj`](ios/heihei_hover/HeiheiHover.xcodeproj) | Safari 不提供实测悬停姿态时使用的轻量 WKWebView 宿主 |
| [`output/siamese_cat_quadruped_v10.mp4`](output/siamese_cat_quadruped_v10.mp4) | 24.67 秒动作预览 |

Blender 中选中 `Cat_Rig` 并进入 Pose Mode 可以编辑骨骼。要单独修改 Action，先静音 `Quadruped showcase` NLA 轨道。Walk／Run 是原地动画，位移由网页控制。GLB 采用 Y 向上、+Z 朝前，换算尺寸以配置文件为准。

## 源码与验证

`web/src/` 将模型、动作、头颈追踪、移动和输入适配分开；`web/src/v1/` 保留空间输入、猫的感知／决策、双指零食和本地记录，`web/src/v2/` 实现姿态换算与 Rapier 物理。`src/` 保存 v10 的建模、绑定、动作、导出及回导脚本；`reference/` 保存选定设定图和[来源说明](reference/README.md)。v10 的 Blender 重建需要 `output/siamese_cat_quadruped_v6.blend`，它已包含在仓库中。可在安装 Blender 5.2 和 Python 后运行：

逗猫棒 v3 可通过 `blender -b --python src/build_wand_v3.py` 重建；v2 的脚本与资产保留。聊天中提供的商品照片只作为本地视觉参照，未加入公开仓库；[v3 近景检查图](qa/web/wand_v3_detail.png)展示编织球与羽片。羽毛采用可绑定的网格羽片和细绒丝，没有毛发模拟。

```sh
python3 -m venv qa/.venv_sculpt
qa/.venv_sculpt/bin/pip install -r src/requirements_sculpt.txt
qa/.venv_sculpt/bin/python src/produce_v10.py
```

若 Blender 命令未在 PATH 中，可通过 `BLENDER_BIN` 指定其可执行文件。构建会重写 v10 输出；需要保留改动时先另存副本。所有 12 个动作通过逐帧网格及边界检查，1902 个支撑爪样本通过接地检查。V2 增加姿态、绳长、运动中碰撞与接触冷却测试；详见 [`qa/anatomy_review_v10.md`](qa/anatomy_review_v10.md) 与 [`qa/web/acceptance_v2.md`](qa/web/acceptance_v2.md)。

## 当前边界

体表是平滑材质和渐变重点色，没有设定图中的蓬松毛发模拟。眼球、眨眼和嘴部动画尚未制作，前爪动作沿用预制动画，没有 IK 修正。网页会分别显示 Pointer Events 的原始角度字段及是否真的变化；浏览器默认值不算实测。网页事件没有标准的厘米级悬停距离，滑块明确标为模拟高度；原生 `zOffset` 也只按归一化距离使用。目标 iPad 上已确认原生悬停姿态随 Pencil 变化、修订后的棒头起点贴合笔尖、触屏切换持续跟随，并录得超过 5 分钟的运行视频；横竖屏及可见羽片的完整防穿模检查仍待真机复核。原生宿主需要有效的 Xcode 开发团队签名。本仓库没有附角色图像、模型或代码的复用许可证。
