Page({
  data: {
    progressData: [
      { classId: '2606' },
      { classId: '2607' },
      { classId: '2608' },
      { classId: '2609' }
    ]
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
      const _ = db.command;
      const classList = ['2606', '2607', '2608', '2609'];
      
      const promises = classList.map(cid => {
        return db.collection('progress')
          .where({ class_id: cid })
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();
      });

      const results = await Promise.all(promises);
      const newData = classList.map((cid, index) => {
        const res = results[index];
        if (res.data.length > 0) {
          const r = res.data[0];
          return {
            classId: cid,
            pptName: r.ppt_name,
            status: r.status,
            currentPage: r.currentPage,
            totalPage: r.totalPage,
            lastUpdate: r.date
          };
        }
        return { classId: cid };
      });

      this.setData({ progressData: newData });

    } catch (err) {
      console.error(err);
    }
  }
});
