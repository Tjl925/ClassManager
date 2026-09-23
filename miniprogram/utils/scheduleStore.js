// 调课覆盖的云端读写。
//
// 为什么放云库而不是本地缓存：本地缓存绑定「设备 + 微信号」，她调的她看不到、你调的她也看不到，
// 换手机还会丢。课表是两个人共用的同一份事实，必须放云端。
//
// 集合 schedule，一条覆盖一个文档：
//   { weekTag: '2026-09-21',   // 该周周一的日期，作为"第几周"的标识
//     week: 3,                  // 星期几 1-5
//     slot: 5,                  // 节次 1-11
//     classId: '2607' | 'none', // 'none' 表示这节课取消
//     timestamp: serverDate }
//
// 两个关键设计：
//
// 1. **跨周自动失效**：查询只取 weekTag === 本周一的文档。上周的文档天然匹配不到，
//    所以"当周有效"不需要删除操作、也不需要定时任务，是查询条件自带的。
//
// 2. **追加式写入 + 同键取最新**：改调课不改旧文档，而是新增一条。
//    解析时同一「星期-节次」由 timestamp 最新的那条胜出。
//    这样做是因为云库预设权限「仅创建者可读写」下只能改自己创建的文档 ——
//    若用更新覆盖，她建的调课你就改不了。靠"后写的胜出"，双方都能改对方的调课。
//    代价是同一条调课改几次就留几条文档，量极小，可以忽略。

const { mondayTag } = require('../config/constants.js');

const COLLECTION = 'schedule';
const PAGE = 20; // 小程序端单次查询最多返回 20 条，超过会被静默截断
const MAX_PAGES = 5;

// 取本周全部调课覆盖，返回 { "3-5": "2607" | "none" }
async function fetchWeekOverrides() {
  const db = wx.cloud.database();
  const weekTag = mondayTag(new Date());
  let all = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await db.collection(COLLECTION)
      .where({ weekTag: weekTag })
      .orderBy('timestamp', 'asc') // 由旧到新，后写的在 map 里覆盖先写的
      .skip(page * PAGE)
      .limit(PAGE)
      .get();
    const batch = res.data || [];
    all = all.concat(batch);
    if (batch.length < PAGE) break;
  }

  const map = {};
  all.forEach(r => {
    map[r.week + '-' + r.slot] = r.classId;
  });
  return map;
}

// 写一条调课覆盖（追加，不修改已有文档）
async function addOverride(week, slot, classId) {
  const db = wx.cloud.database();
  await db.collection(COLLECTION).add({
    data: {
      weekTag: mondayTag(new Date()),
      week: week,
      slot: slot,
      classId: classId,
      timestamp: db.serverDate()
    }
  });
}

module.exports = { fetchWeekOverrides, addOverride };
