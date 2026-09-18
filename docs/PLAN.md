# PLAN.md — 项目路线图

> 回答：我们准备怎么走？
> 规划方式：Rolling-Wave —— 当前 Phase 细化到 Task，下一 Phase 中等粒度，更远只留方向。

## 最终目标

老师日常可无感使用的高一化学（必修一）进度管理工具：课后打卡 < 1 分钟，随时知道四个班各自讲到哪，调课零摩擦。

## Phase 划分总览

| Phase | 目标 | 粒度 | 状态 |
|---|---|---|---|
| Phase 1 | 核心三页 MVP + Awwwards UI 重构 | 已归档 | ✅ Completed |
| Phase 2 | 健壮性修复与数据治理 | 详细（当前） | In Progress |
| Phase 3 | 增强功能（方向待定，见下） | 中等 | Planned |
| Phase 4+ | 远期方向 | 方向级 | Planned |

---

## Phase 1 — 核心 MVP（已完成，仅留摘要）

目标：三 tab 页可用。

- 打卡首页：智能推荐刚下课的班级 + 一键选班/选课件 + 上次记录高亮。
- 课表页：极简时间轴 + 起止时间 + 点卡片底部 actionSheet 调课（存本地 `customSchedule`）。
- 概览页：2x2 Bento Grid 四班最新进度对比 + 下拉刷新。
- UI：Studio Monochrome 配色、大圆角卡片、弹簧按压、fadeUp 交错入场。

Exit Criteria（已全部满足）：三页主流程可用，UI 体系统一。

---

## Phase 2 — 健壮性修复与数据治理（当前 Phase）

**目标**：修掉实际使用中暴露的 bug，把"课件总页数"从手填变成固定数据，清掉历史脏数据，建立长期项目上下文体系。

**Exit Criteria（完成标准）**：
1. 课表页切 tab 再切回，滚动位置归零，无 sticky 重叠。
2. 打卡页"未讲完"只需填当前页，总页自动取自固定值。
3. 旧 `progress` 记录中 partial 的 totalPage 与固定值一致（回补跑过且确认）。
4. 三页在开发者工具中完整回归通过，无新增异常。
5. 长期上下文文件体系（AGENTS.md + docs/ 四件套）建立，与代码一致。

### Task 列表

| ID | Task | 状态 | 验证情况 |
|---|---|---|---|
| T2.1 | 课表页切回后滚动归零（onShow + pageScrollTo） | ✅ Completed | `node --check` 过；UI 行为待开发者工具人工确认 |
| T2.2 | 课件总页数固定入 constants.js（23 个，按 PPT 实测），打卡页总页改只读展示 | ✅ Completed | `node --check` 过；23 条页数映射逐条核对正确；UI 待人工确认 |
| T2.3 | 总页展示值垂直居中（独立 `.total-fixed` 类） | ✅ Completed | 样式已改，待开发者工具目检 |
| T2.4 | 旧数据 totalPage 一次性回补（客户端 `fixLegacyTotalPages`，storage 防重） | In Progress | 代码完成，语法过；**回补是否实际执行、回补条数待用户在开发者工具确认** |
| T2.5 | Git 初始化 + 长期上下文文件体系（AGENTS.md / PLAN / STATE / DECISIONS / ARCHITECTURE） | In Progress | 文件创建中 |
| T2.6 | 开发者工具全量回归（三页主流程 + 调课 + 回补控制台输出） | Planned | — |

---

## Phase 3 — 增强功能（中等粒度，方向待用户确认）

**目标**：从"能用"到"好用"。具体 Task 在 Phase 2 完成、方向确认后细化。

候选方向（按当前信息推测的价值排序，**均未定，TBD**）：
- 周/月进度统计：某班某周完成了几讲、整体进度百分比（数据都在 progress，纯查询 + 展示）。
- 课表导出：把当前周课表（含调课覆盖）生成图片/长图，方便发工作群。
- 课件列表维护：23 个课件写死在 constants.js，换学期/增删课件要改代码；可能需要一个极简的本地编辑入口（KISS 优先，倾向继续写死 + 改一行代码）。
- 数据兜底：`progress` 集合误删/环境迁移时的备份与恢复脚本。

Exit Criteria（预判）：所选方向实现并通过验证，不破坏 Phase 1/2 的兼容性约束。

## Phase 4+ — 远期方向（方向级，不细化）

- 多老师/多账号（需重新评估权限模型，当前"仅创建者可读写"架构会失效，见 DECISIONS D002）。
- 多学期 / 多教材册切换。
- 家长/学生端只读视图。

**以上全部在单用户假设被打破之前不做。**
