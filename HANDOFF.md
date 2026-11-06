# Heihei 完整交接与恢复手册

交接日期：2026-11-06（America/Toronto）。这是一份可离开原开发电脑继续工作的说明。现有功能以本次源码及自动测试为准，历史计划不等于已实现。

## 1. 权威入口与交付边界

| 资源 | 入口 | 用途 |
| --- | --- | --- |
| 当前源码、运行模型、可编辑模型 | https://github.com/purryc/interactive-pet | `main` 为本次交付；恢复开发从这里开始 |
| 当前交接手册 | https://github.com/purryc/interactive-pet/blob/main/HANDOFF.md | 本文；与 Notion 交接页同步 |
| 当前投喂规格 | [PRD.md](PRD.md) | 输入、优先级、投掷、进食、模式切换 |
| 历史逗猫棒详细规格 | [PRD_wand_v2.md](PRD_wand_v2.md) | 阅读时结合第 7 节实现差异 |
| 私有完整历史归档 | https://github.com/purryc/interactive-pet-archive | 旧建模项目、原始素材、录屏、先前 ZIP 和校验清单；需仓库访问权 |
| 原 Notion 项目页 | https://app.notion.com/p/3fa194db24c3817c90cfd786a1756ae6 | 历史作品集材料保留，新手册作为子页 |
| 历史在线站点 | https://purryc.github.io/interactive-pet/ | 本次不部署，不能据此判断本次源码是否生效 |

公开仓库包含当前开发必需资产，无需 Rodin 账户、API key、后端或付费服务即可运行。没有新增开源许可证；代码/模型/参考图的复用授权需另行决定。私有仓库中的录屏、原图不要擅自转公开。

## 2. 同事从零运行

需要 Git、Node.js 22 LTS（工程文档最低为 20.19+）、npm 和支持 WebGL 的浏览器。Blender 仅用于编辑模型，不是玩网页的前提。

```sh
git clone https://github.com/purryc/interactive-pet.git
cd interactive-pet/web
npm ci
npm test
npm run dev
```

打开 http://localhost:5179/。开发服务绑定 `0.0.0.0`，同一网络的 iPad 使用终端打印的本机网络地址。端口被占时先停止旧服务；不要将其他应用随意杀掉。普通触屏不支持真实手指悬停，手机用点按投喂，桌面用鼠标移动模拟悬停。

### 静态部署

```sh
cd web
npm ci
npm test
npm run build
```

把 `web/dist/` 内全部内容上传到站点根目录，必须带 `assets/`。本地预览可运行 `npm run preview`（与 dev 同用 5179，先停止 dev）。不要通过 `file://` 双击 HTML；模型需要 HTTP(S) 加载。

子路径部署：`npm run build -- --base=/your-path/`。原仓库 Pages 构建使用 `GITHUB_PAGES=1 npm run build`，路径固定 `/interactive-pet/`。修改仓库名时同步 `web/vite.config.js`。本次将 `.github/workflows/pages.yml` 改为仅 `workflow_dispatch`；备份推送不会自动发布。需要发布时由接手人明确运行 GitHub Actions 的 `Publish interactive pet`，随后检查资源 200、两种玩法及真机表现。

依赖锁定：Three.js `0.184.0`、Rapier `0.20.0`、Vite `6.3.6`。使用 package-lock 和 npm ci，避免交接时顺手升级。暂无 lint 脚本；验证为测试、构建、diff 检查及浏览器/设备验收。

## 3. 文件与系统职责

| 文件 / 目录 | 职责与修改入口 |
| --- | --- |
| `web/index.html`, `web/src/style.css` | 场景、左下玩法选择、右上设置抽屉、响应式布局 |
| `web/src/main.js` | Three.js 场景、相机、资源加载、每帧调度、输入互斥、设置与调试 |
| `web/src/play_selector.js` | 异步模式切换版本号；缓存 wand 加载，丢弃过期完成回调 |
| `web/src/feeding/input.js` | 鼠标/网页笔/原生笔/触屏输入，袋子与地面映射、快晃检测 |
| `web/src/feeding/props.js` | 袋子跟随、投掷轨迹、食物数量、缩小消费与实例清理 |
| `web/src/feeding/brain.js` | 袋子优先、走跑、等待、寻食、进食及局部姿态叠加 |
| `web/src/feeding/logger.js` | 投喂 CSV，本地内存 20 Hz、最多 24000 行 |
| `web/src/v2/play_mode.js` | 延迟加载旧玩法，创建/停止空间输入、物理和猫行为 |
| `web/src/v1/spatial_input.js`, `web/src/v2/pose.js` | 笔姿态、屏幕到世界映射、原生/网页去重、采样和平滑 |
| `web/src/v2/physics.js`, `web/src/v2/wand.js` | 物理世界和可见棒头/绳球/羽片骨骼同步 |
| `web/src/v1/cat_brain.js` | 感知、追逐、左右爪选择、跳跃链与接触冷却 |
| `web/src/cat_*controller.js` | 动作混合、走跑位移、头颈追踪与局部碰撞反应 |
| `web/src/v1/treat.js`, `web/src/v1/logger.js` | 旧实验保留；不等同于当前入口已接线 |
| `web/public/assets/` | 当前网页模型、映射与比较图片 |
| `src/`, `output/` | Blender/Python 重建脚本、可编辑模型与导出预览 |
| `ios/heihei_hover/` | 原生 iPad WKWebView 宿主与 Pencil 事件桥接 |
| `qa/`, `web/tests/` | 验收证据与真实 GLB/行为/物理测试 |

当前帧：投喂模式先投掷队列，再道具、猫决策、猫动画与头颈、进食叠加、记录；逗猫模式先感知上一帧球位、决策、猫更新，再物理和接触事件。相机随后跟随猫、最后渲染。

## 4. 产品操作与优先级

默认冻干。左下选择逗猫棒/冻干，深棕为选中。每次选择（含重选当前项）停止当前动作、清空动画队列/输入/食物、收起旧道具；保留猫位置和视角。刷新恢复冻干。加载逗猫棒期间可以切回冻干，旧异步结果不能抢回场景。失败显示重试，不能退回假物理。设置中保留观察视角、手动动作、转头、点地移动、参数、骨骼/网格调试。

鼠标移动为 hover，左键按下为 contact；一次按下只投一颗，按住拖动不连发。鼠标松开仍在场景则恢复袋子；手机 touch up 不产生伪 hover；笔接触结束需新 hover 才恢复。离开画布/失焦/后台清除当前输入。选择器和设置覆盖区域不应被场景接收。

投喂优先级：袋子 > 按住接触等待 > 落地食物 > 待机。袋子出现后持续头颈注视，走动保持追踪；地上有食物也先跟袋子。移出 hover 后等 0.12 秒寻找最近的已落地食物。吃到一半再次悬停立即停止吃，保留已消费比例；再次移开可继续。

| 参数 | 当前默认值 / 规则 |
| --- | --- |
| 袋子高度与区域 | 0.18–1.05 m；X/Z ±2.2 m；屏幕上下改变高度 |
| 跟随与摇摆 | 指数插值 `1-exp(-11*dt)`；速度倾斜有限幅，轻摆约 ±0.024 rad |
| 慢走 / 跑 | 0.20 / 0.62 m/s；动画倍率封顶 1.8 |
| 等候距离 | 0.31 m，进入停止范围另加 0.025 m 容差 |
| 快晃 | ≥0.55 m/s，0.5 s 内两次明显反向，反向间移动 >0.035 m；兴奋 1.6 s |
| 投掷 | 0.62 s，线性起终点插值加 `0.17*sin(πt)` 高度；起点至少 0.24 m，落点中心 0.014 m |
| 避开猫身下 | 指定点过近时移到距猫中心 0.32 m，避免食物停在体内 |
| 数量 | 最多 8 颗；超出移除最早且未在吃的一颗 |
| 寻食 / 吃 | 距离 >0.65 m 跑，近处走；距离 ≤0.265 m 且朝向误差 <0.16 rad 才吃 |
| 进食 | CAT_SNIFF 低头段保持，0.65 s 后消费；约 2.1 s 缩小消失；小幅周期头颈叠加 |

袋子不是物理刚体；冻干轨迹为确定性动画，没有复杂反弹。改变设置不会持久保存到下一次刷新。

## 5. 逗猫棒输入与物理的实际实现

姿态读取同时处理 altitude/azimuth 和 tiltX/tiltY，区分测量、缺失、保留和默认字段。采用方向向量平滑而非直接对方位角插值，避免跨 360° 翻转。笔尖映射到朝向相机的平面；短棒头默认 0.04 m，系绳点为 `position + direction * wandLength`。倾斜能移动系绳点。`zOffset` 是 UIKit 归一化值，不是厘米。网页通常没有物理离屏距离，只能明确标注模拟值。

空间采样保留 raw/filtered，队列最多 128；物理取原始样本驱动，不播放伪造甩动。位置/高度/倾角平滑默认 15/11/13。出现很短的缺失笔角时保留最近实测姿态最多 100 ms，来源标注 held。

| 物理部分 | 实际参数 |
| --- | --- |
| 世界 | 重力 Y=-9.81；固定 120 Hz；solver iterations 8；积压上限 0.05 s，每帧最多 8 子步 |
| 绳 | 12 个动态链节，默认总长 0.24 m；半径 0.003 m，附加质量 0.002；rope 关节限制长度 |
| 球 | 半径 0.036 m；附加质量 0.025；恢复系数 0.45，摩擦 0.55，线性阻尼 0.6 |
| 羽毛 | 五片，每片三段动态 capsule + spherical joint，附加质量 0.003，线性/角阻尼 3.2/5 |
| 羽片恢复 | 指向预设展开方向的冲量，位置差乘 0.00025；低位向侧面展开，防止地面堆叠弹高 |
| 猫 | 由骨骼映射建立 27 个球形运动学碰撞体，覆盖躯干、头/口鼻、耳、四肢、尾巴 |
| 地面 | 厚 0.01 m 的静态方盒，摩擦 0.65 |
| 连续检测 | 动态绳、球、羽片启用 CCD；棒头额外 shape cast，并做初始重叠投影 |
| 接触 | 部位、位置、方向、速度强度、时间、toy kind；同部位反应冷却 0.7 s |

注意：碰撞组当前让所有玩具只与猫和地面相撞，玩具彼此不碰（包含绳—球、羽毛—球和非相邻绳段）。这比最初“只排除相邻链节”的计划更保守。猫碰撞体每渲染帧同步一次，多物理子步共享该动画目标；不是每个子步重算动画。绳线使用真实链节点插值，球/羽片基于当前刚体；不是全部刚体均渲染插值。球形猫碰撞体和粗 capsule 不等同于精确网格碰撞，不能保证所有姿态可见穿透 <2 mm。

近距离低位球触发伸爪，按球在猫局部坐标左右选择，正中时交替。高位可触发 crouch→jump→land→idle；动作提交后完成，避免离开目标突然截断落地。碰撞可短暂转头/缩头；前爪接球时施加小冲量，猫仍由骨骼动画驱动，不是布娃娃。退出或隐藏清除链和积压，再进入重新从避开碰撞的位置初始化。

## 6. 模型、动作与重建

运行 GLB：`web/public/assets/siamese_cat_quadruped_v10.glb`；编辑：`output/siamese_cat_quadruped_v10.blend`。32 根骨骼，最多四权重且归一化，12 段动作：Idle、Walk、Run、Crouch、PawLeft、PawRight、Jump、Land、Sit、LookAround、Sniff、Stretch。具体名与骨骼映射在 `cat_asset_config_v10.json`。米单位，Y 向上、+Z 朝前；Blender 工作空间到米的系数 0.25。Walk/Run 原地动画，应用自行位移，不从骨骼 root 提取 XZ root motion。

Blender 历史使用版本 5.2。打开后选 `Cat_Rig`，Pose Mode 编辑；单独编辑 Action 前静音 `Quadruped showcase` NLA。现有模型无真实毛发、独立眼球、眨眼 morph 或张嘴口型。引导骨存在不表示功能存在。

冻干：`output/cat_treats_v1.blend` / `web/public/assets/cat_treats_v1.glb`，根节点 `TreatBag`、`PawTreat`；逗猫棒：`output/cat_wand_v3.blend` / `web/public/assets/cat_wand_v3.glb`，根节点 `Rod`、`Lure`，五组独立三段羽片骨骼。保留 v2。

```sh
# macOS 示例；其他系统把可执行路径改成自己的安装位置
/Applications/Blender.app/Contents/MacOS/Blender -b --python src/build_treats_v1.py
/Applications/Blender.app/Contents/MacOS/Blender -b --python src/build_wand_v3.py
python3 -m venv .venv
.venv/bin/pip install -r src/requirements_sculpt.txt
BLENDER_BIN=/Applications/Blender.app/Contents/MacOS/Blender .venv/bin/python src/produce_v10.py
```

`produce_v10.py` 从保留的 v6 输入生成软化躯干，再顺序绑定/导出/检查/回导。原始 Rodin 源及 v1–v9 在私有历史归档 `siamese_cat/`。当前 v10 重建不是从文字重新生成。冻干中文标牌生成需字体，默认 macOS Arial Unicode；可设置 `HEIHEI_LABEL_FONT` 指向中文字体。导出文字已转网格，网页无需装字体。修改后重新跑模型测试、复制输出 GLB/映射到 public、构建，再检查正/侧/后轮廓和动作。脚本会覆盖相应版本输出；先开分支或备份再改。

## 7. iPad、日志和已知未完成项

原生工程 `ios/heihei_hover/HeiheiHover.xcodeproj`。使用自己的 Apple 开发者团队与唯一 bundle id 签名；不交接私钥、profile、账号密码。宿主目前加载公开 Pages URL，不嵌入模型；要测试新版本先在 `HeiheiHover.swift` 中检查/修改默认 URL 或界面地址，再安装。支持的 Pencil/iPad 硬件才能获得 hover；设备解锁、Developer Mode 与签名信任按 Xcode 要求完成。

UIKit 把 x/y 归一化位置、altitude、azimuth、zOffset、timestamp、phase、channel/contact 发给 `heihei-pencil`。网页根据窗口尺寸还原位置；原生通道拥有笔时忽略重复 Pointer Events，接触优先于迟到的 hover end。2026-09 历史对话中用户确认姿态有变化、笔尖已对齐和接触切换正常；这不代替当前双玩法版本的真机重新验收。

当前设置中的 CSV 仅接入冻干记录，字段包含 timestamp、inputSource、hover/contact、bag XYZ、shakeActive、catState/action、treatCount/eatenCount、foodId/foodConsumed、event/eventFoodId。历史 wand logger 留在源码但当前 main 未接入统一逗猫日志。记录只在页面内存，导出到使用者本地，没有服务端上传。

明确未完成：空中快抖触发专用向上快扑、点击立刻下扑、静止抓住球/拉几次挣脱；当前只有既有 jump 链、伸爪和接触。暂无长期 AI personality、导航避障、独立眼球/表情、可见嘴部咀嚼、全姿态精确防穿模。iPad 五分钟 P95≤25ms 和移动真机最新玩法未在本次交接重测。碰撞轮廓/物理参数的全部旧调试 UI 尚未全部接回新设置抽屉。

## 8. 测试、恢复排障与接手顺序

本次在删除前重新运行 `npm test --prefix web`：35/35 通过；`npm run build --prefix web` 成功。包括真实 GLB 骨骼/动作/权重、头颈与移动、投喂优先级、30/60/120Hz 进食、原生去重、异步切换竞态、12 节物理链、快扫碰撞、冷却与落地流程。构建仍有大 chunk 提示（Rapier 动态包约 2.88MB），属于已知性能优化项，不是构建失败。

恢复后先跑 npm ci/test/build，然后实际浏览器验证：默认冻干→上下移动袋子→快晃跑→点按一颗→移出场景吃→进食中重新 hover→切到 wand→球与猫/地面碰撞→左右爪→快速来回切换→打开设置不误触→刷新恢复默认。再测 iPad 原生与手机竖屏。节点自动测试不能证明真实设备性能或视觉碰撞合格。

| 现象 | 排查 |
| --- | --- |
| localhost 拒绝连接 | 启动 npm run dev，检查 5179 是否被占；归档后原电脑服务已停止 |
| 白屏/模型 404 | 检查 base、dist/assets 完整性、使用 HTTP(S)、浏览器网络/控制台 |
| 逗猫棒拿不出来 | 按重试；检查动态 JS 下载、WASM/WebGL 支持；可以切回冻干 |
| 猫不吃 | 鼠标仍在场景产生 hover；移出场景，或笔完全离开悬停范围 |
| 手机袋子不出现 | 普通手指没有 hover 传感器；正常点按即可投喂 |
| Pencil 90/0 默认值 | 检查当前来源及实际变化；必要时用原生 WKWebView，不把默认值当实测 |
| 原生 App 是旧版 | 检查宿主 URL 和真实部署版本；GitHub 代码更新不代表 Pages 已发布 |
| 动作扭曲/漂移 | 检查映射、模型/配置版本是否一致，NLA 是否叠播，姿态 restore 是否调用 |

建议接手顺序：恢复并验证当前版本 → 真机补验 → 决定是否推进抓球/上下扑 → 优化移动加载和精确碰撞。不要先升级全部依赖。

## 9. 私有归档与删除约定

私有仓库 release `handoff-2026-11-06` 保存非缓存文件的分卷归档、逐文件 SHA-256 清单和整体分卷校验。包括当前工程、早期 `siamese_cat` 工程、Downloads 中明确归属的视频、旧交接目录内这两个项目的独立资料。重复输出及原始视频保留，避免删除唯一素材。共享的整份作品集/其他项目文件不随本项目清理。

排除可重新生成的 `node_modules`、Python venv、`__pycache__`、`.git`（另存 Git bundle）、Xcode build/signing 产物、系统 `.DS_Store`。开发者密钥及签名证书不上传。当前可部署 dist 单独提供 Release ZIP，并包含于完整归档。归档只覆盖本机明确识别的项目资料；聊天记录、全局记忆、浏览器历史、系统快照和其他项目内对 Heihei 的文字提及不作删除对象。

恢复全量：先获取私有仓库访问权，用 `gh release download handoff-2026-11-06 --repo purryc/interactive-pet-archive --dir archive`，在下载目录运行 `shasum -a 256 -c SHA256SUMS`。按文件名顺序拼接 `heihei_full_2026_11_06.tar.gz.part*` 后解压，内含 `files/` 与 `manifest.json`。`.git` 历史可从 bundle 恢复；日常开发直接克隆公开仓库更方便。

删除门槛：远端 commit 对齐、恢复克隆所有追踪文件逐个 hash 一致、恢复克隆测试/构建通过、全量归档各分卷下载回读 hash 一致、Notion 手册及规格可读取。门槛未通过不能宣称已完全备份或删除。最终执行结果记录在 `qa/backup_verification_2026_11_06.md`。
