# AGENTS.md — Agent 长期工作规则

本文件是本项目的最高层级长期上下文。任何 Agent（无论新旧会话）在本仓库工作前，必须先读完本文件。

## 1. 项目总体目标

为高中化学老师定制的微信小程序「课程进度管理与课表」：

- 老师管理 4 个教学班（2606 / 2607 / 2608 / 2609）的高一化学必修第一册教学进度。
- 核心场景：每节课后 1 分钟内完成"哪个班 + 哪个课件 + 讲到哪页"的打卡。
- 配套能力：固定课表 + 极简调课（覆盖显示）、四班进度总览对比。

## 2. 核心原则

1. **KISS（简洁至上）**：优先微信原生能力，不引入 npm 依赖、不引入编译框架、不引入多余抽象层。能用一个数组 + 一个 storage key 解决的，不建第二个数据库集合。
2. **单用户假设**：当前只有一个老师账号使用。涉及"多用户/权限/同步"的方案默认过度设计，需要用户明确提出才做。
3. **配置集中**：课件列表、课表、作息时间、总页数等业务常量，唯一来源是 `miniprogram/config/constants.js`。禁止在页面里硬编码这些值。
4. **代码优先**：实际代码和可验证的运行结果，永远优先于任何上下文文档。

## 3. 技术栈与运行环境

- 前端：微信原生小程序（无编译框架，无 npm 依赖）。
- 后端：微信云开发 CloudBase，云数据库集合 `progress`。
- 客户端权限：云集合 `progress` 实际权限为**「所有用户可读，仅创建者可读写」**（2026-09-18 用户念的原文）。两条实际后果：
  1. **读**：任何微信用户打开小程序都能读到全部记录，读查询不需要也无法按 openid 过滤。第二人一旦写入，其记录会混入老师看到的四班进度视图。
  2. **写**：只能更新/删除自己 openid 创建的记录，跨用户写入不可行。
- 该权限是"单用户假设"被打破时的第一道坎：任何"多人共用"需求都要先重审此权限（见 DECISIONS D002、D006、D009）。
- **写权限收敛方案已定**：改用自定义安全规则做 openid 白名单（`read: true` + `write: auth.openid in [...]`），见 D009。执行前 `progress` 仍是任何用户可写自己记录的状态。
- 环境 ID：`wx.cloud.DYNAMIC_CURRENT_ENV`（app.js 中初始化）。
- 本地缓存（wx storage）：
  - `customSchedule`：调课覆盖，结构 `{ "周-节次": 班级id | "none" }`。
  - `legacyPagesFixed`：旧数据回补一次性标记（布尔）。
- 开发环境：微信开发者工具（Windows，本机路径 `D:\ClassManager`）。
- 云函数：`cloudfunctions/quickstartFunctions` 目前**未被业务使用**，是 CloudBase 模板自带的 sales 演示代码，不要依赖它、不要假设它已部署。

## 4. 重要开发约束

- 不引入 npm 包 / UI 组件库 / 编译框架。
- 不新增云函数承载业务逻辑，除非用户明确要求（当前数据量极小，客户端直连云库足够）。
- 不修改 `progress` 集合已有字段名：`class_id, ppt_name, status, currentPage, totalPage, date, timestamp`。新增字段可以，改名/删除不行（已有历史数据）。
- 课件固定 23 个，总页数固定。`constants.js` 内 `pptTotalPages`（23 项**模块内数组，不导出**）与课件名列表按**下标一一对应**，`pptList[i].totalPage` 由它 map 生成；外部只能读 `pptList[i].totalPage`。**课件增删必须同步改两个数组**，顺序错位会静默产生错误总页数。
- 班级固定 4 个：2606 / 2607 / 2608 / 2609。
- 状态枚举固定：`status: 'completed' | 'partial'`。

## 5. 编码规范

- 注释、文案、Toast 提示一律中文；代码标识符用英文。
- 页面结构遵循现有 `Page({ data, onLoad, onShow, ... })` 模式；tab 页必须在 `onShow` 同步 custom-tab-bar 的 `selected`。
- UI 必须遵守现有设计系统（Awwwards 风格，改 UI 时先读 `miniprogram/app.wxss` 的 CSS 变量）：
  - 背景 `#F2F4F8`，主字 `#1A1D20`，强调靛蓝 `#502BD8`，强调青绿 `#00C48C`。
  - 大圆角卡片（≈32–40rpx），无默认表单线框。
  - 按钮/卡片按压弹簧手感：`hover-scale`（scale(0.97) + 贝塞尔过渡）。
  - 入场动效：`animate-fade-up` + 交错 `animation-delay`。
  - 注意：`.glass-input` 是 `<input>` 专用，给 `<view>` 加 flex 居中要用独立类（如 `.total-fixed`），不要把 flex 写进 input 的类上。
- 数据库操作：查询后先判空再取 `res.data[0]`；写入用 `db.serverDate()` 打时间戳；所有云调用包 try/catch，失败给用户中文提示（Toast/Modal），不静默。

## 6. 测试与验证要求

- 本项目无自动化测试框架（KISS，不为测试引入依赖）。验证方式：
  1. 语法层：`node --check <file.js>`（改过的 JS 必须过）。
  2. 数据映射层：涉及常量/映射的改动，用 `node -e` 加载模块逐条核对。
  3. UI/交互层：微信开发者工具人工验证，关键路径逐一走一遍（见 `docs/PROJECT_STATE.md` 的 Verification Status）。
  4. 数据层：开发者工具 Storage 面板 + 云开发控制台看真实写入。
- **验证未通过前，Task 不算完成，不更新上下文文档。**

## 7. 兼容性要求（不可破坏）

- 已有 `progress` 历史数据可被新代码正确读取和展示（概览页、上次记录徽章）。
- 已有 `customSchedule` 缓存结构兼容（老缓存可被新代码正确解析）。
- 三个 tab 页 + custom-tab-bar 的现有信息架构不被推翻。

## 8. Git / 文件修改原则

- 仓库自 2026-09-18 起使用 Git。提交信息用中文，说清楚"改了什么、为什么"。
- 提交信息末尾必须带：
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- 小步提交：一个 Task 一次或几次提交，不攒大提交。
- **只改任务相关的文件**，不顺手重构无关代码、不顺手改格式。发现无关问题 → 记入 `docs/PROJECT_STATE.md` 的已知问题，报告给用户，不擅自修。
- 破坏性操作（删数据、改集合结构、force push）必须先征得用户同意。
- `project.private.config.json` 不入库（已在 .gitignore）。

## 9. 遇到不确定问题

**先验证，不猜测。** 至少做一件事再动手：读相关代码、查 storage / 云库真实数据、跑 `node --check` 或 `node -e`、开发者工具里实际点一遍。验证不了的，在回复中明确标注"未验证的假设"。

## 10. Persistent Project Memory（长期上下文文件清单）

以下文件构成项目的持久记忆，随代码一起版本化：

| 文件 | 职责 | 回答的问题 |
|---|---|---|
| `AGENTS.md`（本文件） | Agent 工作规则、约束、维护机制 | 在这个项目里该怎么工作？ |
| `docs/PLAN.md` | 路线图：Phase → Task，Rolling-Wave | 我们准备怎么走？ |
| `docs/PROJECT_STATE.md` | 项目此刻的真实状态（最小必要集） | 新会话进来最少要知道什么？ |
| `docs/DECISIONS.md` | 重要技术决策 + 失败方案记录 | 项目为什么变成现在这样？ |
| `docs/ARCHITECTURE.md` | 系统实际结构（以代码为准） | 系统现在实际上是什么样？ |

## 11. 上下文信息可信度优先级

恢复项目状态时按此优先级采信：

1. 实际运行结果 / 测试 / 验证输出
2. 当前实际代码
3. `git status` / `git diff` / `git log`
4. `docs/PROJECT_STATE.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DECISIONS.md`
7. `docs/PLAN.md`
8. 聊天中的旧描述

文档与代码不一致时：先验证代码和 Git，以实际实现为准，然后修正文档。**不要为了迁就文档而假设代码错了。**

## 12. 上下文自动维护规则

1. 不要因为一次普通对话或一次小修改就更新项目状态文档。
2. "对话轮次"不是持久化单位。
3. 主要持久化单位是"完成并验证的 meaningful task / checkpoint"。
4. 每完成并验证一个有意义的 Task：
   - 项目状态变化 → 更新 `PROJECT_STATE.md`
   - 计划/优先级/范围变化 → 更新 `PLAN.md`
   - 形成重要技术决策 → 更新 `DECISIONS.md`
   - 系统实际架构变化 → 更新 `ARCHITECTURE.md`
   - 只更新真正受影响的文件。
5. 每完成一个 Phase / Milestone，必须做一次完整 **Context Reconciliation**：
   - 检查代码实际状态、`git status`、`PLAN`、`STATE`、`DECISIONS`、`ARCHITECTURE`；
   - 修正文档之间、文档与代码之间的漂移；
   - 然后在回复中告知用户：Phase 是否完成、更新了哪些文件、下一阶段是什么。
6. Task 未完成但出现明显 handoff boundary（即将结束长会话 / 切换会话 / 形成稳定中间成果 / 技术路线重大变化 / 发现重要新问题）时，允许提前更新 `PROJECT_STATE.md`。
7. Agent 每次自动修改任何上下文文件后，必须在最终回复中明确列出：更新了哪些文件、为什么更新。
8. `PROJECT_STATE.md` 不写聊天日志，不无限累积历史，老旧状态及时清理。
9. 实际代码和可验证运行结果始终优先于上下文文档。
10. 文档与代码冲突：先验证代码和 Git → 以实际实现为准 → 修正文档。

## 13. 新会话恢复流程（必须按序执行）

1. 读 `AGENTS.md`（本文件）。
2. 读 `docs/PROJECT_STATE.md`。
3. 读 `docs/PLAN.md`。
4. 按当前任务需要读 `docs/DECISIONS.md`（涉及技术选型/历史方案时必读）。
5. 按当前任务需要读 `docs/ARCHITECTURE.md`（涉及跨模块改动时必读）。
6. `git status` 确认工作区干净程度。
7. 必要时 `git diff` 看未提交改动。
8. `git log --oneline -10` 看近期提交。
9. 读当前任务涉及的实际代码。
10. 必要时运行验证命令（`node --check`、`node -e` 映射核对、开发者工具）。
11. 若文档与代码不一致：以实际代码和验证结果为准，修正文档，并在回复中说明。
12. 然后再开始开发。
