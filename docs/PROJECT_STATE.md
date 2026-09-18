# PROJECT_STATE.md — 项目当前状态

> 回答：一个完全不知道历史聊天的新会话，现在进入仓库最少要知道什么？
> 只保留当前状态，不写历史流水。Last Updated: 2026-09-18

## Current Phase

**Phase 2 — 健壮性修复与数据治理**（详见 `docs/PLAN.md`）

## Current Objective

修完实际使用暴露的 bug、固化课件总页数、回补历史数据、建立长期上下文体系。

## Current Task

T2.5 — Git 初始化 + 长期上下文文件体系。文件创建中：AGENTS.md ✅ / PLAN.md ✅ / PROJECT_STATE.md（本文件）/ DECISIONS.md / ARCHITECTURE.md。

## 当前实现状态

- 三个 tab 页全部可用：打卡（index）、课表（schedule）、概览（overview）+ custom-tab-bar。
- 业务数据：云库 `progress` 集合（客户端直写，无业务云函数）。
- 业务配置唯一来源：`miniprogram/config/constants.js`（pptList 23 项含 totalPage、initialSchedule 四班课表、timeSlots 11 节次）。
- 本地缓存：`customSchedule`（调课覆盖）、`legacyPagesFixed`（回补标记）。
- 云函数 `cloudfunctions/quickstartFunctions` = CloudBase 模板 sales 演示代码，**业务零依赖**。

## 最近完成的 Task（已验证部分）

1. **T2.1 课表页滚动归零**：`schedule.js` onShow 加 `wx.pageScrollTo({scrollTop:0, duration:0})`。修复切 tab 回页后 sticky 周条压住时间轴。
2. **T2.2 总页数固定**：constants.js 加 `pptTotalPages`（23 值，按 `C:\Users\86173\Desktop\淡 化学必修一课件` 实际 PPT 文件数页核对）；打卡页删总页输入框改只读展示；`applyPpt(index)` 收口三处切课件路径，自动填 totalPage；校验只查 currentPage。
3. **T2.3 总页垂直居中**：独立 `.total-fixed` flex 类，不污染 input 用的 `.glass-input`。

## 当前已验证结果

- 三个改动的 JS 文件全部通过 `node --check`。
- 23 个课件的 totalPage 映射已用 `node -e` 加载 constants.js 逐条打印核对，与 PPT 实测页数一致。
- PPT 页数提取方式：PowerShell `System.IO.Compression` 读 pptx zip，数 `ppt/slides/slideN.xml`。

## 当前尚未验证的假设

1. `wx.pageScrollTo` 在 tab 页 onShow 中即时生效、无回弹（需开发者工具确认 T2.6）。
2. 客户端 `doc().update()` 在当前集合权限（仅创建者可读写）下能成功更新自己写的记录（理论上可以，未实际跑过回补）。
3. 回补函数 `fixLegacyTotalPages` 实际执行的回补条数未知（用户尚未在开发者工具看到控制台输出）。

## 当前已知问题

1. **回补未确认执行**：T2.4 代码就绪，等用户在开发者工具启动一次打卡页，控制台应输出 `已回补 totalPage 记录数：N`。
2. 云函数是模板残留（sales 演示）。无害，但如果以后部署云函数，别把演示逻辑当真。
3. `overview.js` 对 `err` 只 `console.error` 不提示用户（沿袭旧代码，属可接受范围，不擅改）。
4. `index.js` smartRecommend 的"明天"逻辑里 `tomorrow = (currentWeek % 7) + 1`，周日晚自习场景的边界未专门验证过（低优先级）。

## 当前阻塞项

无。

## 当前活跃约束

- KISS / 无 npm / 单用户 / 不新增业务云函数 / 不改 progress 字段名 / UI 设计系统不可破坏（详见 `AGENTS.md` §4–§5）。

## 最近的重要变化（2026-09-18）

- 修复课表页滚动残留 bug；总页数从手填改为 constants.js 固定值 + 只读展示；旧数据回补函数上线；总页居中修复；初始化 Git 仓库；建立本上下文体系。

## Next Steps

1. 完成 T2.5：写完 DECISIONS.md / ARCHITECTURE.md，git 初始提交。
2. 用户执行 T2.6：开发者工具全量回归 + 确认回补控制台输出。
3. T2.6 通过后 → Phase 2 收尾 Context Reconciliation → 与用户确认 Phase 3 方向。

## Verification Status

| 项 | 状态 |
|---|---|
| JS 语法（node --check） | ✅ 通过 |
| totalPage 23 条映射核对 | ✅ 逐条核对一致 |
| 课表滚动归零 UI 行为 | ⏳ 待开发者工具 |
| 打卡页总页只读 + 居中 | ⏳ 待开发者工具 |
| 旧数据回补实际执行 | ⏳ 待用户启动确认 |
| 三页全量回归 | ⏳ 待执行（T2.6） |
