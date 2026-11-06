# 冻干投喂 v1 验收

日期：2026-10-01。当前为本地工作区版本，未推送 GitHub／未发布 Pages。预览地址 `http://localhost:5179/`。

## 自动测试与资源

- 32/32 Node 测试通过：保留原 23 项模型／动作／Pencil／绳链验证，增加 9 项冻干投喂测试。
- 新增覆盖：屏幕 XY 与高度映射、点击去重、触屏不伪造 hover、原生接触与网页 pen 去重、快晃与慢移区分、资产结构、袋子优先级、30/60/120 Hz 投掷与吃完、进食中断恢复、连续投喂上限。
- `npm run build` 通过。默认 JS 主包约 30 KB（未压缩），不再从入口加载 Rapier 与旧绳球。
- 道具 GLB 418096 bytes，14644 个三角面，根对象 `TreatBag`、`PawTreat`。无外部 buffer 或图片依赖；中文字为网格。猫的原始 12 动作和 32 骨骼完整。
- Blender 源已保存；同一脚本二次重建成功。猫爪按材质合并为 3 个绘制批次，多个食物共享几何与材质。

## 浏览器实测（电脑运行，非真机）

| 环境／操作 | 结果 |
| --- | --- |
| Chromium，1280×800，慢移悬停 | FOLLOW_BAG / walk，持续看袋子，靠近后 WAIT_FOR_TREAT |
| Chromium，快速左右来回晃动 | RUN_TO_BAG / run，excited=true |
| Chromium，点击后保留鼠标在画布 | 一颗落地，consumed=0，袋子优先 |
| Chromium，移出画布 | SEEK_FOOD → EAT → SATISFIED，食物从部分消耗到移除，eaten=1 |
| Chromium，390×844 | 袋子中文可读，猫和设置入口完整显示，屏幕上下移动可升降袋子 |
| WebKit 26.6，iPhone 13 模拟 | 真实模拟触屏 tap，经 Pointer Events 投喂，hover=false，进食完成，eaten=1 |
| WebKit，16 次连续投喂 | 最多 8 颗，28 次绘制，7 个 geometry / 6 个 texture，无未处理异常 |
| WebKit，竖屏转 844×390 横屏 | 重新构图，无横向溢出，猫继续进食 |
| WebKit，设置抽屉 | 正常打开；弹窗内不投喂 |

上述采样里 Chromium P95 约 17–18 ms，WebKit P95 约 18 ms。测量运行在这台 Mac 的浏览器进程，不能据此宣称 iPad/iPhone 达到相同帧率。启动时曾发现旧阴影模式弃用警告和 favicon 404，已换为当前阴影模式并内嵌 favicon；最终重载后的 Chromium 和 WebKit 控制台均为 0 错误、0 警告。

## 视觉证据

- [道具 Blender 预览](treats_v1_preview.png)
- [桌面悬停与注视](feeding_bag_hover.png)
- [奔跑触发](feeding_run.png)
- [进食姿态](feeding_eating.png)
- [手机竖屏袋子](feeding_portrait_hover.png)
- [WebKit 手机进食](feeding_webkit_iphone_eat.png)
- [WebKit 设置](feeding_webkit_settings.png)
- [WebKit 横屏](feeding_webkit_landscape.png)

## 连续动作检查

保存了本地浏览器录屏，并截取 [17 秒互动预览](../../output/feeding_demo_v1.mp4)。成片 1280×800、25 FPS，完整解码通过；检查了袋子跟随、猫转身／奔跑、投掷、低头进食和恢复待机的连续帧。原始录屏位于被 Git 忽略的 `qa/device/`，不是设备实拍。

## 待真机与边界

设备查询显示两台已配对 iPad 与 iPhone 当前 unavailable，未进行本版真实 Pencil 采样或手机 WebView 性能验收。原生通道的事件优先级由自动测试覆盖；真机仍需检查悬停离开／接触交接、触屏手势、长时间发热与帧率。

注视使用现有头颈骨骼；未新做独立眼球转动。进食为低头保持加轻微咀嚼节奏，原模型没有新的可见张嘴形变。食物是可控的抛物运动，未引入零食与猫体的全刚体碰撞；落点会避开猫身体。
