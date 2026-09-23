const { initialSchedule, timeSlots } = require('../../config/constants.js');
const { fetchWeekOverrides, addOverride } = require('../../utils/scheduleStore.js');

Page({
  data: {
    currentWeek: 1,
    timeSlots: timeSlots,
    todaySchedule: {}, // key: slotId, value: schedule obj
    slideClass: '', // 切周过渡动画类，空串表示不播
    // 本周调课覆盖 { "星期-节次": 班级id | "none" }，来自云库（两人共享，跨周自动失效）
    customSchedule: {}
  },

  onLoad() {
    let currentWeek = new Date().getDay();
    if (currentWeek === 0 || currentWeek === 6) {
      currentWeek = 1; // 周末默认展示周一
    }
    this.setData({ currentWeek });
    // 先用原始课表画出来，别让页面空着；覆盖数据由 onShow 里的 loadSchedule 补上
    this.renderSchedule();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    // 切回本页时回到顶部，避免 sticky 日期条与时间轴重叠
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
    // 每次进入都重新拉本周调课，否则看不到对方刚做的调课
    this.loadSchedule();
  },

  // 拉本周调课覆盖后重渲染。失败就按原始课表显示，不阻塞页面
  async loadSchedule() {
    try {
      const customSchedule = await fetchWeekOverrides();
      this.setData({ customSchedule });
    } catch (err) {
      console.log('调课覆盖读取失败，按原始课表显示：', err);
      this.setData({ customSchedule: {} });
    }
    this.renderSchedule();
  },

  switchWeek(e) {
    const week = Number(e.currentTarget.dataset.week);
    if (week === this.data.currentWeek) return;
    const dir = week > this.data.currentWeek ? 'slide-next' : 'slide-prev';
    this.setData({ currentWeek: week });
    this.renderSchedule();
    this.playSlide(dir);
  },

  // ==================== 左右滑动切周 ====================
  // 方向：手指左滑(dx<0) -> 后一天；手指右滑(dx>0) -> 前一天
  onTouchStart(e) {
    const t = e.touches[0];
    this._startX = t.clientX;
    this._startY = t.clientY;
  },

  onTouchEnd(e) {
    if (this._startX === undefined) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - this._startX;
    const dy = t.clientY - this._startY;
    this._startX = undefined;

    // 横向意图判定：位移够大，且明显比纵向更横，避免误吞其它交互
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

    // 标记这次触摸已被横滑消费。微信 tap 的位移阈值官方未公布，
    // 万一 tap 仍被合成，changeSchedule 会读这个标记并忽略它，防止误弹调课面板。
    this._swipeConsumed = true;
    setTimeout(() => { this._swipeConsumed = false; }, 400);

    const next = dx < 0 ? this.data.currentWeek + 1 : this.data.currentWeek - 1;
    if (next < 1 || next > 5) {
      // 已到周一/周五，播一次回弹：静默无反应会让人以为页面卡死
      // 回弹方向跟随手指（左滑则内容左移），符合橡皮筋手感
      this.playSlide(dx < 0 ? 'bounce-left' : 'bounce-right');
      return;
    }

    this.setData({ currentWeek: next });
    this.renderSchedule();
    this.playSlide(dx < 0 ? 'slide-next' : 'slide-prev');
  },

  // 播一次切周动画：同名 class 不会重播，必须先清空、下一帧再挂上
  playSlide(cls) {
    this.setData({ slideClass: '' });
    wx.nextTick(() => this.setData({ slideClass: cls }));
  },

  renderSchedule() {
    const week = this.data.currentWeek;
    const customSchedule = this.data.customSchedule || {};
    
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
    // 刚被横滑消费过的这次触摸，忽略其上可能被合成的 tap
    if (this._swipeConsumed) return;

    const slot = e.currentTarget.dataset.slot;
    const classList = ['2606', '2607', '2608', '2609', '取消该课'];

    wx.showActionSheet({
      itemList: classList,
      success: async (res) => {
        // 追加一条覆盖（不修改旧文档）：靠"同键取最新"让双方都能改对方的调课
        const classId = res.tapIndex === 4 ? 'none' : classList[res.tapIndex];

        try {
          await addOverride(this.data.currentWeek, slot, classId);
          wx.showToast({ title: '已调课', icon: 'success' });
          await this.loadSchedule(); // 重新拉一遍，让新覆盖生效
        } catch (err) {
          wx.showModal({
            title: '调课失败',
            content: '请确认云开发控制台已创建 [schedule] 集合。详细错误：' + err.message,
            showCancel: false
          });
        }
      }
    });
  }
});
