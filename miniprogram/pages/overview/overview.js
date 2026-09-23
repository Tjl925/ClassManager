const { pptList, formatDate } = require('../../config/constants.js');

const TOTAL_LESSONS = pptList.length; // 全书 23 讲
const CLASS_LIST = ['2606', '2607', '2608', '2609'];

// 兜底：无记录/查询失败时也要显示四个班卡片
function makePlaceholders() {
  return CLASS_LIST.map(cid => ({ classId: cid, hasRecord: false }));
}

Page({
  data: {
    progressData: makePlaceholders()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.fetchData();
  },

  onPullDownRefresh() {
    this.fetchData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async fetchData() {
    try {
      const db = wx.cloud.database();

      const results = await Promise.all(CLASS_LIST.map(cid =>
        db.collection('progress')
          .where({ class_id: cid })
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get()
      ));

      // 每班最新记录 → 累计进度（占全书比例）
      const items = CLASS_LIST.map((cid, i) => {
        const rec = results[i].data[0];
        if (!rec) {
          return { classId: cid, hasRecord: false, _frac: 0 };
        }

        const idx = Math.max(0, pptList.findIndex(p => p.name === rec.ppt_name));
        const totalPage = Number(rec.totalPage) || pptList[idx].totalPage;
        const currentPage = Number(rec.currentPage) || 0;
        // 本讲内部推进：已讲完结算一整讲，未讲完按页占比
        const sub = rec.status === 'completed' ? 1 : Math.min(Math.max(currentPage / totalPage, 0), 1);
        const frac = (idx + sub) / TOTAL_LESSONS;
        const pct = Math.round(frac * 100);

        return {
          classId: cid,
          hasRecord: true,
          lessonNo: idx + 1,
          totalLessons: TOTAL_LESSONS,
          pct,
          // 有进度就至少留一小截可见的填充
          meterPct: frac > 0 ? Math.max(pct, 2) : 0,
          pptName: rec.ppt_name,
          status: rec.status,
          currentPage,
          totalPage,
          lastUpdate: formatDate(rec.date || rec.timestamp),
          _frac: frac
        };
      });

      // 升序：进度最慢的排最前，方便定位该加快的班
      items.sort((a, b) => (a._frac - b._frac) || (a.classId < b.classId ? -1 : 1));

      const lastIndex = items.length - 1;
      const leadFrac = items[lastIndex] ? items[lastIndex]._frac : 0;

      const progressData = items.map((it, index) => {
        const isTop = index === lastIndex;
        let tagText = '';
        if (it.hasRecord) {
          if (isTop && leadFrac > 0) {
            tagText = '进度最快';
          } else {
            const gap = Math.round((leadFrac - it._frac) * TOTAL_LESSONS);
            tagText = gap >= 1 ? `落后 ${gap} 讲` : '基本持平';
          }
        }
        const out = Object.assign({}, it, { isLeader: isTop && leadFrac > 0, tagText });
        delete out._frac;
        return out;
      });

      this.setData({ progressData });
    } catch (err) {
      console.error(err);
      // 查询失败时退回占位卡片，不让页面空白
      this.setData({ progressData: makePlaceholders() });
    }
  }
});