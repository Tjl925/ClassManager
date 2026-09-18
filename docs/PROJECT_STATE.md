# PROJECT_STATE.md — 项目当前状态

> 回答：一个完全不知道历史聊天的新会话，现在进入仓库最少要知道什么？
> 只保留当前状态，不写历史流水。Last Updated: 2026-09-18

## Current Phase

**Phase 2 — 健壮性修复与数据治理**（详见 `docs/PLAN.md`）

## Current Objective

修完实际使用暴露的 bug、固化课件总页数、回补历史数据、建立长期上下文体系、概览页重做。除"概览页开发者工具目检"外全部完成。

## Current Task

T2.7 — 概览页重做（排名式进度对比）。代码完成并通过 `node --check` + 模拟数据验证，**待用户微信开发者工具目检**。通过后 Phase 2 收官。

## 当前实现状态

- 三个 tab 页全部可用：打卡（index）、课表（schedule）、概览（overview，已重做）+ custom-tab-bar。
- 业务数据：云库 `progress` 集合（客户端直写，无业务云函数）。
- 业务配置唯一来源：`miniprogram/config/constants.js`（pptList 23 项含 totalPage、initialSchedule 四班课表、timeSlots 11 节次）。
- 本地缓存：`customSchedule`（调课覆盖）、`legacyPagesFixed`（回补标记）。
- 云函数 `cloudfunctions/quickstartFunctions` = CloudBase 模板 sales 演示代码，**业务零依赖**。
- Git 仓库：main 分支，已推送 https://github.com/Tjl925/ClassManager（公开）。

## 最近完成的 Task（已验证部分）

1. **T2.1 课表页滚动归零**：onShow + `wx.pageScrollTo({scrollTop:0})`，修复切 tab 后 sticky 周条压时间轴。用户已验收。
2. **T2.2/T2.3 总页数固定 + 只读居中**：constants.js `pptTotalPages`（23 个 PPT 实测值），打卡页总页改只读 flex 居中展示，`applyPpt` 收口切课件路径。用户已验收。
3. **T2.4 旧数据回补**：`fixLegacyTotalPages()` 客户端一次性回补 partial 记录的 totalPage。用户已验收。
4. **T2.5 上下文体系 + Git**：AGENTS.md + docs 四件套，已推送 GitHub。
5. **T2.6 全量回归**：用户在开发者工具全部验收通过。
6. **T2.7 概览页重做**：2x2 卡片 → 排名卡片列表。每班显示：第 N 讲/23、全书百分比、细进度条（靛蓝单色）、当前课件（单行省略号）、状态（绿点已讲完/橙点讲到 X/Y 页）、与榜首差距（"落后 N 讲"/"进度最快"）。升序排列=最慢的排最前=最需加快。DB 无数据/查询失败回退 4 张占位卡。代码验证过，UI 待目检。

## 当前已知问题

1. 云函数模板残留（sales 演示代码）。无害，但不要误当业务代码。
2. `smartRecommend` 的"明天"逻辑 `tomorrow = (currentWeek % 7) + 1` 周末边界未专门验证（低优先级）。
3. `overview.js` 查询失败仅 console.error，不提示用户（有意为之：回退占位卡不阻塞）。

## 当前尚未验证的假设

仅 T2.7 的 UI 目检（见 Verification Status）。其余已验证。

## 当前阻塞项

无。

## 当前活跃约束

KISS / 无 npm / 单用户 / 不新增业务云函数 / 不改 progress 字段名 / UI 设计系统不可破坏（详见 `AGENTS.md` §4–§5）。

## Next Steps

1. 用户开发者工具目检概览页（T2.7）→ 通过后 Phase 2 Exit Criteria 全满足。
2. 执行 Phase 2 Context Reconciliation 收尾。
3. 与用户确认 Phase 3 方向（周统计 / 导出课表图 / 其他，见 PLAN）。

## Verification Status

| 项 | 状态 |
|---|---|
| JS 语法（node --check，含 overview 重做后） | ✅ 通过 |
| totalPage 23 条映射核对 | ✅ 逐条核对一致 |
| 课表滚动归零 / 总页只读居中 / 旧数据回补 / 三页回归 | ✅ 用户开发者工具全部验收通过（2026-09-18） |
| 概览页排序/差距计算（模拟数据） | ✅ 逻辑核对正确 |
| 概览页新 UI 目检 | ⏳ 待用户开发者工具确认 |
| 配色校验（#502BD8/#00C48C/#FF7B52 三件套） | ✅ dataviz 校验通过，WARN 已用文字标签抵消 |
