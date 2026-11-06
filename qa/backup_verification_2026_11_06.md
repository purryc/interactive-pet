# Heihei 云端备份与本地清理记录

日期：2026-11-06，America/Toronto。

## 当前核验

- 原工作副本测试：35/35 通过；Vite build 成功。
- 原远端与本机起点均为 ccacfb52124f4f5d24bfd81bfdfcd6f1d444502f。
- 原站点部署改为手动触发，本次备份不部署。
- 私有全量档案包含两个项目和单独发现的资料副本，不上传签名或依赖缓存。
- 云端回读与本地清理完成后追加最终结果。

## 清理范围

- AIGC/projects/interactive_pet：当前应用、模型、构建、缓存、录屏及历史交付包。
- AIGC/projects/siamese_cat：原始生成素材、历史建模与动作、V0 网页及渲染。
- Documents/Codex/2026-10-14/task-2/handoff-batch2/source-documents/AIGC/projects 下对应的 interactive_pet 与 siamese_cat 独立子目录。
- Downloads 内三个 siamese_cat 视频副本。
- 本次产生的临时归档、恢复验证克隆与临时文件。

不删除 AIGC 根目录、其他项目、共享作品集文档、全局依赖、Blender、Xcode、Apple 签名钥匙串、聊天及记忆记录。


## 最终云端核验与原件清理

- 主仓库运行代码提交：e256d0f66354ac0f0a27aa6b51e40244edb24236。
- 重新克隆 GitHub，118 个追踪文件逐字节一致，npm ci、35/35 测试和 build 成功。
- 私有归档已上传并下载回读：37 分卷、41 个资产；分卷与内部 4605 个文件全部 SHA-256 一致（4498518290 字节非缓存原件）。
- 私有归档：https://github.com/purryc/interactive-pet-archive/releases/tag/handoff-2026-11-06 。
- 可部署网页 ZIP：https://github.com/purryc/interactive-pet/releases/tag/handoff-2026-11-06 。
- Notion 交接手册：https://app.notion.com/p/410194db24c381cab622d92ab5da91ec 。
- 上述 7 个本机目录/文件已删除，共 13810 个文件（含缓存），逻辑大小约 4.97 GB。
- 本次临时恢复克隆、上传分卷和云端回读文件均已删除并确认路径不存在；其他项目、共享文件及系统记录不在范围内。
- 本次未重新部署公开 Pages；仅 GitHub 源码、文档与 Release 更新。
- 依赖安全告警及真实设备验收边界见 HANDOFF.md，不以自动测试替代真机证明。
