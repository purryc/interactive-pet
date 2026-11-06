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
