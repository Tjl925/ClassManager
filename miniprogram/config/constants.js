// 课件总页数（按 PPT 文件实测固定，与上方列表一一对应）
const pptTotalPages = [31, 28, 23, 28, 25, 27, 27, 31, 29, 32, 30, 27, 26, 33, 29, 30, 34, 23, 26, 28, 35, 24, 43];

// 课件列表
const pptList = [
  "1.1.1 物质的分类",
  "1.1.2 分散系及其分类",
  "1.1.3 物质的转化",
  "1.2.1 电解质的电离",
  "1.2.2 离子反应",
  "1.2.3 离子反应的应用",
  "1.3.1 氧化还原反应的特征和本质",
  "1.3.2 氧化剂和还原剂 电子转移表示法",
  "1.3.3 氧化还原反应的规律",
  "2.1.1 活泼的金属单质—钠",
  "2.1.2 钠的氧化物",
  "2.1.3 碳酸钠和碳酸氢钠",
  "2.2.1 氯气的性质",
  "2.2.2 氯气的性质2与氯离子的检验",
  "2.2.3 氯气的实验室制法",
  "2.3.1 物质的量 摩尔质量",
  "2.3.2 气体摩尔体积",
  "2.3.3 物质的量浓度",
  "2.3.4 配制一定物质的量浓度的溶液",
  "第一章 物质及其变化 章末习题课",
  "第一章 物质及其变化 章末复习",
  "第二章 海水中的重要元素——钠和氯 章末习题课",
  "第二章 海水中的重要元素——钠和氯 章末复习"
].map((name, index) => ({ id: index + 1, name, totalPage: pptTotalPages[index] }));

// 班级默认课表 (根据用户修正后的排课)
// week: 1(周一)-5(周五)
// slot: 1-8为正课，9为晚1，10为晚2，11为晚3
const initialSchedule = [
  // 2606班: 周二第7节, 周三第3节, 周四第4节. 晚自习: 周一晚3
  { classId: '2606', week: 2, slot: 7 },
  { classId: '2606', week: 3, slot: 3 },
  { classId: '2606', week: 4, slot: 4 },
  { classId: '2606', week: 1, slot: 11 },
  // 2607班: 周二第4节, 周三第5节, 周四第6节. 晚自习: 周四晚3
  { classId: '2607', week: 2, slot: 4 },
  { classId: '2607', week: 3, slot: 5 },
  { classId: '2607', week: 4, slot: 6 },
  { classId: '2607', week: 4, slot: 11 },
  // 2608班: 周一第4节, 周二第6节, 周五第2节. 晚自习: 周四晚1
  { classId: '2608', week: 1, slot: 4 },
  { classId: '2608', week: 2, slot: 6 },
  { classId: '2608', week: 5, slot: 2 },
  { classId: '2608', week: 4, slot: 9 },
  // 2609班: 周二第5节, 周三第6节, 周五第1节. 晚自习: 周四晚2
  { classId: '2609', week: 2, slot: 5 },
  { classId: '2609', week: 3, slot: 6 },
  { classId: '2609', week: 5, slot: 1 },
  { classId: '2609', week: 4, slot: 10 }
];

// 作息时间定义
const timeSlots = [
  { slot: 1, name: "第一节", startTime: "08:00", endTime: "08:45" },
  { slot: 2, name: "第二节", startTime: "08:55", endTime: "09:40" },
  { slot: 3, name: "第三节", startTime: "10:10", endTime: "10:55" },
  { slot: 4, name: "第四节", startTime: "11:05", endTime: "11:50" },
  { slot: 5, name: "第五节", startTime: "14:20", endTime: "15:05" },
  { slot: 6, name: "第六节", startTime: "15:15", endTime: "16:00" },
  { slot: 7, name: "第七节", startTime: "16:10", endTime: "16:55" },
  { slot: 8, name: "第八节", startTime: "17:05", endTime: "17:30" },
  { slot: 9, name: "晚一", startTime: "19:00", endTime: "19:45" },
  { slot: 10, name: "晚二", startTime: "20:00", endTime: "20:45" },
  { slot: 11, name: "晚三", startTime: "20:55", endTime: "21:40" },
];

// 统一日期格式化：统一输出为 YYYY-MM-DD，兼容字符串/时间戳/Date/云开发对象
function formatDate(d) {
  if (!d) return '';
  let date;
  if (d instanceof Date) {
    date = d;
  } else if (typeof d === 'number') {
    date = new Date(d);
  } else if (typeof d === 'string') {
    date = new Date(d);
  } else if (d && typeof d === 'object' && typeof d.toDate === 'function') {
    date = d.toDate();
  }
  if (!date || isNaN(date.getTime())) {
    return String(d || '');
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  pptList,
  initialSchedule,
  timeSlots,
  formatDate
};

