# PROJECT_STATE.md — 项目当前状态

> 回答：一个完全不知道历史聊天的新会话，现在进入仓库最少要知道什么？
> 只保留当前状态，不写历史流水。Last Updated: 2026-09-18

## Current Phase

**维护期（Phase 1/2 已全部完成并经用户验收，Phase 3 暂缓）。**
用户 2026-09-18 决定：功能先开发到这一步，暂不推进 Phase 3。

## Current Objective

保持现状可用。无排期中的开发目标；后续仅做必要维护（bug 修复、兼容性保障）。

## Current Task

无进行中 Task。无下一个 Task。

## 当前实现状态

- 三个 tab 页全部可用且经用户验收：打卡（index）、课表（schedule）、概览（overview，排名式进度对比）+ custom-tab-bar。
- 业务数据：云库 `progress` 集合（客户端直写，无业务云函数）。
- 业务配置唯一来源：`miniprogram/config/constants.js`（pptList 23 项含 totalPage、initialSchedule 四班课表、timeSlots 11 节次）。
- 本地缓存：`customSchedule`（调课覆盖）、`legacyPagesFixed`（回补标记）。
- 云函数 `cloudfunctions/quickstartFunctions` = CloudBase 模板 sales 演示代码，**业务零依赖**。
- Git：main 分支，与 https://github.com/Tjl925/ClassManager 同步，工作区干净。

## 已验证结果（全部，截至 2026-09-18）

- 全部 JS 通过 `node --check`；23 条 totalPage 映射逐条核对一致。
- 概览页排序/差距/百分比逻辑经模拟数据验证 + 用户目检。
- 配色三件套（#502BD8/#00C48C/#FF7B52）过 dataviz 校验。
- 用户开发者工具全量验收：课表滚动归零、总页只读居中、旧数据回补、三页主流程、概览页新 UI —— 全部通过。

## 当前已知问题（低优先级，未排期）

1. 云函数模板残留（sales 演示代码）。无害，但不要误当业务代码。
2. `smartRecommend` 的"明天"逻辑 `tomorrow = (currentWeek % 7) + 1` 周末边界未专门验证。
3. `overview.js` 查询失败仅 console.error，回退占位卡不提示（有意为之）。

## 当前阻塞项

无。

## 当前尚未验证的假设

无。

## 当前活跃约束

KISS / 无 npm / 单用户 / 不新增业务云函数 / 不改 progress 字段名 / UI 设计系统不可破坏（详见 `AGENTS.md` §4–§5）。

## Next Steps

无排期。若用户提出新需求：先确认方向 → `PLAN.md` 细化为 Task → 开工；开工前重读 `AGENTS.md` §4–§5 约束（KISS / 无 npm / 不改 `progress` 字段名 / UI 设计系统）。

## Verification Status

| 项 | 状态 |
|---|---|
| JS 语法（全部业务文件） | ✅ 通过 |
| totalPage 23 条映射 | ✅ 一致 |
| 概览页排序/差距逻辑（模拟数据） | ✅ 正确 |
| 配色校验（dataviz 脚本） | ✅ 通过 |
| 用户开发者工具全量验收 | ✅ 全部通过（2026-09-18） |
| 待验证项 | 无 |