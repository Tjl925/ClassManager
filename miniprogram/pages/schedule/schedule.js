const { initialSchedule, timeSlots } = require('../../config/constants.js');

Page({
  data: {
    currentWeek: 1,
    timeSlots: timeSlots,
    todaySchedule: {} // key: slotId, value: schedule obj
  },

  onLoad() {
    let currentWeek = new Date().getDay();
    if (currentWeek === 0 || currentWeek === 6) {
      currentWeek = 1; // 周末默认展示周一
    }
    this.setData({ currentWeek });
    this.renderSchedule();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    // 切回本页时回到顶部，避免 sticky 日期条与时间轴重叠
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },

  switchWeek(e) {
    const week = e.currentTarget.dataset.week;
    this.setData({ currentWeek: week });
    this.renderSchedule();
  },

  renderSchedule() {
    const week = this.data.currentWeek;
    const customSchedule = wx.getStorageSync('customSchedule') || {};
    
    const scheduleForWeek = initialSchedule.filter(s => s.week === week);
    const todayMap = {};
    
    // 载入初始课表
    scheduleForWeek.forEach(s => {
      todayMap[s.slot] = s;
    });

    // 载入调课记录进行覆盖
    for (const key in customSchedule) {
      const [kWeek, kSlot] = key.split('-');
      if (parseInt(kWeek) === week) {
        const classId = customSchedule[key];
        if (classId === 'none') {
          delete todayMap[kSlot];
        } else {
          todayMap[kSlot] = { week: week, slot: parseInt(kSlot), classId: classId };
        }
      }
    }

    this.setData({ todaySchedule: todayMap });
  },

  changeSchedule(e) {
    const slot = e.currentTarget.dataset.slot;
    const classList = ['2606', '2607', '2608', '2609', '取消该课'];
    
    wx.showActionSheet({
      itemList: classList,
      success: (res) => {
        const customSchedule = wx.getStorageSync('customSchedule') || {};
        const key = `${this.data.currentWeek}-${slot}`;
        
        if (res.tapIndex === 4) {
          customSchedule[key] = 'none';
        } else {
          customSchedule[key] = classList[res.tapIndex];
        }
        
        wx.setStorageSync('customSchedule', customSchedule);
        wx.showToast({ title: '已调课', icon: 'success' });
        this.renderSchedule();
      }
    });
  }
});
