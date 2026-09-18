# ARCHITECTURE.md — 系统实际结构

> 回答：系统现在实际上是什么样？以当前代码为准，架构变化时同步更新本文件。
> 最后核对代码时间：2026-09-18

## 整体架构

```
┌──────────────────────── 微信原生小程序（无编译框架、无 npm）────────────────────────┐
│                                                                                    │
│  custom-tab-bar（打卡 / 课表 / 概览，各页 onShow 同步 selected）                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                             │
│  │ pages/index  │  │ pages/       │  │ pages/       │                             │
│  │ 打卡首页      │  │ schedule     │  │ overview     │                             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                             │
│         │                 │                 │                                      │
│  config/constants.js ◄────┴─────────────────┘   （业务配置唯一来源）                  │
└─────────┼─────────────────────────────────────────────────────────────────────────┘
          │ wx.cloud.database()  客户端直连（集合默认"仅创建者可读写"）
          ▼
   云开发 CloudBase（DYNAMIC_CURRENT_ENV）
   集合 progress：打卡记录
   云函数 quickstartFunctions：模板残留，业务零依赖（见 D006）

   本地 wx.storage：
   - customSchedule：调课覆盖 {"周-节次": 班级id | "none"}
   - legacyPagesFixed：旧数据回补一次性标记
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
│   ├── config/constants.js      # ★ 业务配置唯一来源
│   ├── custom-tab-bar/          # 自定义 tab 栏
│   └── pages/
│       ├── index/               # 打卡首页
│       ├── schedule/            # 课表页
│       └── overview/            # 概览页
└── cloudfunctions/quickstartFunctions/   # 模板演示代码，非业务
```

## 核心模块与职责

### config/constants.js（唯一配置源）

| 导出 | 内容 |
|---|---|
| `pptList` | 23 个课件 `{ id, name, totalPage }`。`totalPage` 来自 `pptTotalPages` 数组，按**下标一一对应**（改课件必须两数组同步） |
| `pptTotalPages` | 23 个总页数（PPT 实测，见 D001） |
| `initialSchedule` | 四班化学课固定排布 `{ classId, week(1-5), slot(1-11) }`，每班 3 节正课 + 1 节晚自习 |
| `timeSlots` | 11 个节次 `{ slot, name, startTime, endTime }`，08:00–21:40 |

### pages/index — 打卡首页

关键方法与调用链：

- `onLoad` → `smartRecommend()`（异步，查库）+ `fixLegacyTotalPages()`（一次性回补，D002）。
- `smartRecommend()`：按 D007 算法推导推荐班级 → `getLatestPptIndex(classId)` 查该班最新一条 progress → 未讲完续同一课件 / 已讲完进下一个 → `applyPpt(idx)`。
- `getLatestPptIndex(classId)`：`progress` 按 `class_id` + `timestamp desc` 取 1 条。
- `applyPpt(index)`：★ 切课件唯一收口点。`setData({ pptIndex, totalPage: pptList[index].totalPage })` + `checkPptHistory()`。三处路径（智能推荐 / 切班级 / 手选课件）全走它。
- `checkPptHistory()`：按 `class_id + ppt_name` 取最新 1 条存 `historyState`，驱动"上次记录"徽章。
- `submitRecord()`：partial 时仅校验 `currentPage` → `progress.add({ class_id, ppt_name, status, currentPage, totalPage, date, timestamp: serverDate() })` → 立即 `checkPptHistory()` 刷新徽章。
- `fixLegacyTotalPages()`：storage 有 `legacyPagesFixed` 则跳过；否则 count + skip/limit 100 条/批拉全量，对 `status==='partial'` 且 `Number(totalPage) !== 固定值` 的记录逐条 `doc().update()`，最后置标记。

### pages/schedule — 课表页

- `onLoad`：默认 `currentWeek = 今天周几`（周末 → 1）。
- `onShow`：同步 tab selected + `wx.pageScrollTo({scrollTop:0, duration:0})`（D004，切回归零）。
- `renderSchedule()`：`initialSchedule.filter(week)` 建 map → 遍历 storage `customSchedule` 中 `周-节次` key 覆盖（`'none'` = 删课）→ `setData({ todaySchedule })`。
- `changeSchedule(e)`：actionSheet（2606/2607/2608/2609/取消该课）→ 写 `customSchedule["当前周-slot"]` → 重渲染。
- WXML：sticky `.week-pills`（周一~五）+ 时间轴三列（时间 / 圆点竖线 / 课程卡片）。

### pages/overview — 概览页

- `onShow` → `fetchData()`；`onPullDownRefresh` 同。
- `fetchData()`：四班并行查 `progress` 各最新 1 条（`Promise.all`）→ 2x2 Bento Grid 展示最新课件 + 进度 + 日期。

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

### 本地 storage

| key | 结构 | 写入方 |
|---|---|---|
| `customSchedule` | `{ "2-7": "2606", "4-11": "none" }`（"周-节次" → 班级或 none） | schedule 页 changeSchedule |
| `legacyPagesFixed` | boolean | index 页 fixLegacyTotalPages（true 后回补永不重跑；要重跑须删此 key） |

## 关键数据流

1. **打卡**：选班/选课件（或智能推荐）→ 选状态 → 填当前页（partial）→ `progress.add` → 刷新上次记录徽章。
2. **调课**：点课表卡片 → actionSheet → 写 storage → 立即重渲染（无网络）。
3. **概览**：四班并行查最新记录 → Grid 渲染。
4. **回补（一次性）**：启动打卡页 → storage 检查 → 分页拉全量 → 逐条对齐 totalPage → 置标记。

## 外部依赖

- 微信基础库 + 云开发 CloudBase（`wx.cloud`，基础库 ≥ 2.2.3，app.js 有版本检查）。
- 无任何 npm 依赖、无第三方 UI 库。
- 云函数模板（quickstartFunctions）存在但**不被调用**；其 package.json 含 wx-server-sdk，部署与否不影响小程序运行。
