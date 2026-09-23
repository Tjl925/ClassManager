# ARCHITECTURE.md — 系统实际结构

> 回答：系统现在实际上是什么样？以当前代码为准，架构变化时同步更新本文件。
> 最后核对代码时间：2026-09-23

## 整体架构

```
┌──────────────────────── 微信原生小程序（无编译框架、无 npm）────────────────────────┐
│                                                                                    │
│  custom-tab-bar（打卡 / 课表 / 概览，各页 onShow 同步 selected）                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                             │
│  │ pages/index  │  │ pages/       │  │ pages/       │                             │
│  │ 打卡首页      │  │ schedule     │  │ overview     │                             │
│  └───┬──────┬───┘  └──────┬───────┘  └──────┬───────┘                             │
│      │      │             │                 │                                      │
│      │      └─────────────┴─────────────────┘                                      │
│      │                    ▼                                                        │
│      │       utils/scheduleStore.js  ← 调课覆盖云端读写（课表页与智能推荐共用）        │
│      │                    │                                                        │
│  config/constants.js ◄────┴─────────────────── （业务配置唯一来源 + mondayTag）       │
└──────┼─────────────────────────────────────────────────────────────────────────────┘
       │ wx.cloud.database()  客户端直连（权限：所有用户可读，仅创建者可读写；白名单方案见 D009）
       ▼
   云开发 CloudBase（DYNAMIC_CURRENT_ENV）
   集合 progress：打卡记录
   集合 schedule：调课覆盖（weekTag 分区，当周有效，见 D015）
   云函数 quickstartFunctions：模板残留，业务零依赖（见 D006）

   本地 wx.storage：只剩一项
   - legacyPagesFixed_v2：旧数据回补一次性标记
```

## 目录结构（业务相关部分）

```
D:\ClassManager
├── AGENTS.md                    # Agent 工作规则 + 上下文维护机制
├── docs/
│   ├── PLAN.md                  # 路线图
│   ├── PROJECT_STATE.md         # 当前状态
│   ├── DECISIONS.md             # 决策记录
│   └── ARCHITECTURE.md          # 本文件
├── miniprogram/
│   ├── app.js                   # wx.cloud.init（DYNAMIC_CURRENT_ENV）
│   ├── app.json                 # 3 个 tab 页 + custom tabBar
│   ├── app.wxss                 # 全局设计系统（CSS 变量、hover-scale、animate-fade-up）
│   ├── config/constants.js      # ★ 业务配置唯一来源（含 formatDate / mondayTag）
│   ├── custom-tab-bar/          # 自定义 tab 栏
│   ├── utils/
│   │   └── scheduleStore.js     # 调课覆盖的云端读写（课表页与打卡页共用）
│   ├── envList.js               # 模板残留（空 envList + isMac），零引用。保留原因见下
│   └── pages/
│       ├── index/               # 打卡首页（含进度轴与确认弹窗）
│       ├── schedule/            # 课表页（含左右滑动手势）
│       └── overview/            # 概览页
└── cloudfunctions/quickstartFunctions/   # 模板演示代码，非业务
```

> **已清理的模板残留（2026-09-18）**：`pages/example/`、`components/cloudTipModal/`、`images/`（31 个文件）已删除，包体 1.4M → 85K。删除前逐项验证过引用链（唯一被引用的 `icons/close.png` 只服务于 `cloudTipModal`，而后者只被 `pages/example` 引用）。文件保留在 Git 历史中。
> **`envList.js` 故意未删**：零引用，但属 CloudBase 模板约定文件，无法离线确认开发者工具是否读取它，仅 100 字节，保留成本为零。

## 核心模块与职责

### config/constants.js（唯一配置源）

| 导出 | 内容 |
|---|---|
| `pptList` | ★导出。23 个课件 `{ id, name, shortLabel, shortName, totalPage }`。`totalPage` 由模块内 `pptTotalPages` 按**下标一一对应** map 生成（改课件必须两数组同步）；`shortLabel`/`shortName` 由 `shortLabelOf`/`shortNameOf` 派生，供进度轴上下两行显示 |
| ~~`pptTotalPages`~~ | 23 个总页数（PPT 实测，见 D001）。**模块内定义，不从 `module.exports` 导出**，外部只能读 `pptList[i].totalPage` |
| `initialSchedule` | 四班化学课固定排布 `{ classId, week(1-5), slot(1-11) }`，每班 3 节正课 + 1 节晚自习 |
| `timeSlots` | 11 个节次 `{ slot, name, startTime, endTime }`，08:00–21:40 |
| `formatDate(d)` | 统一日期格式化为 `YYYY-MM-DD`，兼容 Date/时间戳/字符串/云开发 toDate 对象 |
| `mondayTag(d)` | 本周周一的日期，用作"第几周"标识。调课覆盖按它分区实现当周有效（见 D015） |

### utils/scheduleStore.js — 调课覆盖云端读写

课表页与打卡页（智能推荐）共用，避免两处各写一份云查询。

- `fetchWeekOverrides()`：查 `schedule` 集合中 `weekTag === 本周一` 的全部文档（分页，步长 20），按 `timestamp asc` 遍历，返回 `{ "星期-节次": classId | "none" }`。**同键后写者胜出** —— 这样双方都能改对方的调课，不依赖 D009。
- `addOverride(week, slot, classId)`：**追加**一条覆盖文档（不修改旧文档），带 `weekTag` 与 `serverDate`。
- **跨周失效是查询条件自带的**：只查本周 `weekTag`，上周文档匹配不到，无需删除、无需定时任务。
- 集合不存在或读取失败时抛错，由调用方降级为"按原始课表"。

### pages/index — 打卡首页

关键方法与调用链：

- `onLoad` → `smartRecommend()`（异步，查库）+ `fixLegacyTotalPages()`（一次性回补，D002/D016）。
- `smartRecommend()`：先 `fetchWeekOverrides()` 拉本周调课（失败则按原始课表），再按 D007 算法推导推荐班级 → `fetchClassProgress(classId)` 查该班进度 → `setAxis()` + `applyPpt()`。**用 `_axisReady` 标记**防止它与 `onShow` 里的进度轴刷新互相覆盖。
- `fetchClassProgress(classId)`：★ 拉该班**全部**记录（分页，步长 20），返回 `{ axisIndex, axisDone }`。`axisDone` 按真实 `completed` 记录点亮，跳过的课件保持灰（D013）。取代了旧的 `getLatestPptIndex`（只取最新 1 条，信息量不足以判断跳过）。
- `applyPpt(index)`：★ 切课件唯一收口点。`setData({ pptIndex, totalPage })` + `checkPptHistory()`。**刻意不驱动进度轴** —— 轴表示班级实际进度，与本次选哪个课件无关。
- `setAxis(index)` / `refreshAxis()`：进度轴的位置与滚动。触发时机只有 换班级 / 提交 / 撤销 / `onShow` 回页。
- `centerTrack(index)`：用 `scroll-left` 把节点滚到屏幕正中（`scroll-into-view` 只能对齐左边缘）。节点宽与内边距常量必须与 WXSS 同步。
- `checkPptHistory()`：按 `class_id + ppt_name` 取最新 1 条存 `historyState`，驱动"上次记录"徽章，**同时决定撤销按钮的可用性**。
- `submitRecord()`：校验 → **只开确认弹窗**；真正写库在 `doSubmit()`。
- `doSubmit()` / `doUndo()`：均由弹窗"确认"按钮经 `confirmAction()` 分派。`doUndo()` 删的是 `historyState._id`（即徽章显示的那条），不限于本次会话。
- `fixLegacyTotalPages()`：storage 有 `legacyPagesFixed_v2` 则跳过；否则 count + `orderBy('_id')` + **skip/limit 20 条/批**拉全量，对 `status==='partial'` 且 `Number(totalPage) !== 固定值` 的记录逐条 `doc().update()`，最后置标记。

### pages/schedule — 课表页

- `onLoad`：默认 `currentWeek = 今天周几`（周末 → 1），先用原始课表画一版。
- `onShow`：同步 tab selected + `wx.pageScrollTo`（D004 遗留）+ **`loadSchedule()`**（每次进入重拉调课，否则看不到对方刚做的调课）。
- `loadSchedule()`：`fetchWeekOverrides()` → `setData({ customSchedule })` → `renderSchedule()`；失败降级为 `{}`。
- `renderSchedule()`：`initialSchedule.filter(week)` 建 map → 用 `this.data.customSchedule` 中 `星期-节次` key 覆盖（`'none'` = 删课）→ `setData({ todaySchedule })`。
- `changeSchedule(e)`：actionSheet → `addOverride()` 写云端 → `loadSchedule()` 重拉重渲染。
- **左右滑动手势**：`onTouchStart`/`onTouchEnd` 挂在 `.container` 上，位移 ≥ 60px 且明显横向才判定。左滑 = 后一天，右滑 = 前一天；边界播放回弹。`_swipeConsumed` 标记吞掉横滑后被合成的 `tap`（D014）。
- 切周动画挂在新加的 `.timeline-wrap` 包裹层上，**不能挂在 `.timeline-box`**（后者已有 `animate-fade-up` 含 `opacity:0`，两个 animation 会冲突）。
- WXML：`.week-pills`（周一~五）+ 时间轴三列（时间 / 圆点竖线 / 课程卡片）。

### pages/overview — 概览页

- `onShow` → `fetchData()`；`onPullDownRefresh` 同。
- `fetchData()`：四班并行查 `progress` 各最新 1 条（`Promise.all`）→ 每班算**累计进度**：`idx = pptList.findIndex(ppt_name)`，`sub = completed ? 1 : currentPage/totalPage`，`frac = (idx + sub) / 23` → 按 `frac` **升序排序（最慢在前）** → 计算与末位（榜首）差距 → `setData({ progressData })`。
- 展示：排名卡片列表。每卡 = 班级号 + 位置标签（进度最快 / 落后 N 讲 / 基本持平）+ 第 N 讲/23 + 百分比 + 细进度条 + 当前课件（单行省略号）+ 状态（点+文字）+ 更新日期。
- 兜底：无记录或查询失败 → `makePlaceholders()` 四张占位卡（`hasRecord: false`），页面不空白。
- 颜色分工见 DECISIONS D008，改动前必读。

### custom-tab-bar

- 三 tab：打卡 / 课表 / 概览。每页 `onShow` 各自 `getTabBar().setData({ selected })` 同步高亮。

## 数据模型

### 云集合 progress（字段名不可改，见 AGENTS.md §4）

| 字段 | 类型 | 说明 |
|---|---|---|
| `class_id` | string | `'2606'/'2607'/'2608'/'2609'` |
| `ppt_name` | string | 与 `pptList[].name` 完全一致（**按名字关联，不是 id**，注意空格/破折号必须逐字相同） |
| `status` | string | `'completed'` / `'partial'` |
| `currentPage` | string | 手填当前页（partial 时有值；input 来的字符串） |
| `totalPage` | number/string | 课件总页数（新记录为固定值；历史 partial 记录经 T2.4 回补对齐） |
| `date` | string | `new Date().toLocaleDateString()`（本地时区） |
| `timestamp` | serverDate | 排序依据，全部查询按它 desc |

### 云集合 schedule（调课覆盖，见 D015）

| 字段 | 类型 | 说明 |
|---|---|---|
| `weekTag` | string | **该周周一的日期** `YYYY-MM-DD`。查询只按它过滤，跨周自动失效 |
| `week` | number | 星期几 `1`(周一)–`5`(周五) |
| `slot` | number | 节次 `1`–`11` |
| `classId` | string | `'2606'`–`'2609'`，或 `'none'` 表示取消该课 |
| `timestamp` | serverDate | 同一「week-slot」多条时取最新者胜出 |

**写入是追加式**（改调课 = 新增一条，不修改旧文档），原因见 D015：云库预设权限下改不了别人创建的文档，靠"后写的胜出"让双方都能改。

### 本地 storage

| key | 结构 | 写入方 |
|---|---|---|
| `legacyPagesFixed_v2` | boolean | index 页 fixLegacyTotalPages（true 后回补不再重跑；要重跑须删此 key）。键带版本号是为了让 D016 修好分页后能重跑一次 |

> 调课覆盖**已不在本地**（2026-09-23 迁到云集合 `schedule`，见 D015）。老设备上残留的 `customSchedule` 键不再被读取，留着无害。

## 关键数据流

1. **打卡**：选班/选课件（或智能推荐）→ 选状态 → 填当前页（partial）→ 点"记录进度"**开确认弹窗** → 确认后 `progress.add` → 刷新"上次记录"徽章 + 刷新进度轴。
2. **撤销**：点"撤销这条记录"→ 确认弹窗 → 删掉**徽章显示的那条**（`historyState._id`）→ 重新查徽章与进度轴。
3. **调课**：点课表卡片 → actionSheet → `addOverride()` 追加一条云端覆盖 → `loadSchedule()` 重拉重渲染。智能推荐读同一份覆盖。
4. **概览**：四班并行查最新记录 → 排名式卡片列表渲染（升序，见 D008）。
5. **回补（一次性）**：启动打卡页 → storage 检查 → 分页（步长 20）拉全量 → 逐条对齐 totalPage → 置标记。

## 外部依赖

- 微信基础库 + 云开发 CloudBase（`wx.cloud`，基础库 ≥ 2.2.3，app.js 有版本检查）。
- 无任何 npm 依赖、无第三方 UI 库。
- 云函数模板（quickstartFunctions）存在但**不被调用**；其 package.json 含 wx-server-sdk，部署与否不影响小程序运行。
