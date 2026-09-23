const { pptList, initialSchedule, timeSlots, formatDate } = require('../../config/constants.js');

Page({
  data: {
    classList: ['2606', '2607', '2608', '2609'],
    classIndex: 0,
    pptList: pptList,
    pptNames: pptList.map(p => p.name),
    pptIndex: 0,
    totalPage: pptList[0].totalPage,
    status: 'completed',
    currentPage: '',
    isSubmitting: false,
    recommendedClass: '',
    recommendLabel: ''
  },

  onLoad() {
    this.smartRecommend();
    this.fixLegacyTotalPages();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  // 智能推荐：按"上课中 -> 刚下课(60分内) -> 离当前最近的未来第一节课"层级匹配
  async smartRecommend() {
    try {
      const now = new Date();
      const currentWeek = now.getDay() || 7; // 1(周一) - 7(周日)
      const currentMins = now.getHours() * 60 + now.getMinutes();

      // 获取某星期某节次的实际班级（支持 customSchedule 调课覆盖）
      const getScheduleClass = (week, slot) => {
        const customSchedule = wx.getStorageSync('customSchedule') || {};
        const key = `${week}-${slot}`;
        if (customSchedule[key] !== undefined) {
          return customSchedule[key] === 'none' ? null : customSchedule[key];
        }
        const target = initialSchedule.find(s => s.week === week && s.slot === slot);
        return target ? target.classId : null;
      };

      const timeToMins = (timeStr) => {
        const [h, m] = timeStr.split(':');
        return parseInt(h, 10) * 60 + parseInt(m, 10);
      };

      let targetClassId = null;
      let recommendLabel = '';

      // 1. 检查今天正在上课的 slot
      for (let slot of timeSlots) {
        const start = timeToMins(slot.startTime);
        const end = timeToMins(slot.endTime);
        const classId = getScheduleClass(currentWeek, slot.slot);
        if (classId && currentMins >= start && currentMins <= end) {
          targetClassId = classId;
          recommendLabel = '上课中';
          break;
        }
      }

      // 2. 若无正在上课，检查今天刚下课 60 分钟内的 slot（取最近下课的）
      if (!targetClassId) {
        for (let i = timeSlots.length - 1; i >= 0; i--) {
          const slot = timeSlots[i];
          const end = timeToMins(slot.endTime);
          const classId = getScheduleClass(currentWeek, slot.slot);
          if (classId && currentMins > end && (currentMins - end) <= 60) {
            targetClassId = classId;
            recommendLabel = '刚下课';
            break;
          }
        }
      }

      // 3. 若不在即时打卡窗口，寻找离当前时间最近的"下节课"
      if (!targetClassId) {
        // 3.1 今天后续尚未开始的课程（按时段从早到晚）
        for (let slot of timeSlots) {
          const start = timeToMins(slot.startTime);
          const classId = getScheduleClass(currentWeek, slot.slot);
          if (classId && currentMins < start) {
            targetClassId = classId;
            recommendLabel = '下节课';
            break;
          }
        }

        // 3.2 若今天后续无课，向后逐天查找未来 7 天内最早的一节排课
        if (!targetClassId) {
          for (let offset = 1; offset <= 7; offset++) {
            const nextWeek = ((currentWeek - 1 + offset) % 7) + 1;
            for (let slot of timeSlots) {
              const classId = getScheduleClass(nextWeek, slot.slot);
              if (classId) {
                targetClassId = classId;
                recommendLabel = '下节课';
                break;
              }
            }
            if (targetClassId) break;
          }
        }
      }

      if (!targetClassId) {
        this.setData({ classIndex: 0, recommendedClass: '', recommendLabel: '' });
        return this.applyPpt(0);
      }

      // 查该班最新课件
      const pptIndex = await this.getLatestPptIndex(targetClassId);

      const idx = this.data.classList.indexOf(targetClassId);
      this.setData({
        classIndex: idx >= 0 ? idx : 0,
        recommendedClass: targetClassId,
        recommendLabel: recommendLabel
      });
      wx.showToast({ title: `推荐打卡：${targetClassId}班`, icon: 'none' });
      this.applyPpt(Math.min(pptIndex, this.data.pptNames.length - 1));
    } catch (err) {
      console.log('智能推荐异常:', err);
      this.setData({ classIndex: 0, pptIndex: 0, recommendedClass: '', recommendLabel: '' });
    }
  },

  // 取某班最新课件索引：无记录→第一个；最后记录未讲完→同课件；全讲完→下一个
  async getLatestPptIndex(classId) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('progress')
        .where({ class_id: classId })
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (res.data.length === 0) return 0;

      const last = res.data[0];
      const idx = this.data.pptNames.findIndex(name => name === last.ppt_name);
      if (idx === -1) return 0;
      if (last.status === 'completed') {
        return Math.min(idx + 1, this.data.pptNames.length - 1);
      }
      return idx;
    } catch (err) {
      console.log('数据库尚未初始化或无记录', err);
      return 0;
    }
  },

  // 获取当前选中班级和选中课件的历史打卡记录
  async checkPptHistory() {
    const className = this.data.classList[this.data.classIndex];
    const pptName = this.data.pptNames[this.data.pptIndex];
    try {
      const db = wx.cloud.database();
      const res = await db.collection('progress')
        .where({ class_id: className, ppt_name: pptName })
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (res.data.length > 0) {
        const item = res.data[0];
        item.date = formatDate(item.date || item.timestamp);
        this.setData({ historyState: item });
      } else {
        this.setData({ historyState: null });
      }
    } catch (err) {
      this.setData({ historyState: null });
    }
  },

  // 一次性回补：旧打卡记录(未讲完)的 totalPage 按固定总页数修正
  async fixLegacyTotalPages() {
    if (wx.getStorageSync('legacyPagesFixed')) return;
    try {
      const db = wx.cloud.database();
      const total = (await db.collection('progress').count()).total;
      const pageSize = 100;
      let fixed = 0;
      for (let i = 0; i < total; i += pageSize) {
        const res = await db.collection('progress').skip(i).limit(pageSize).get();
        for (const r of res.data) {
          const ppt = pptList.find(p => p.name === r.ppt_name);
          if (ppt && r.status === 'partial' && Number(r.totalPage) !== ppt.totalPage) {
            await db.collection('progress').doc(r._id).update({ data: { totalPage: ppt.totalPage } });
            fixed++;
          }
        }
      }
      wx.setStorageSync('legacyPagesFixed', true);
      if (fixed) console.log('已回补 totalPage 记录数：' + fixed);
    } catch (err) {
      console.log('旧数据回补失败：', err);
    }
  },

  bindClassChange(e) {
    // 徽章是全局状态，切换班级时保留
    this.setData({ classIndex: e.detail.value });
    const classId = this.data.classList[e.detail.value];
    this.getLatestPptIndex(classId).then(pptIndex => {
      this.applyPpt(pptIndex);
    });
  },

  bindPptChange(e) {
    this.applyPpt(e.detail.value);
  },

  // 切换课件：自动填入固定总页数，再查历史
  applyPpt(index) {
    this.setData({
      pptIndex: index,
      totalPage: this.data.pptList[index].totalPage
    });
    this.checkPptHistory();
  },

  bindStatusChangeManual(e) {
    this.setData({ status: e.currentTarget.dataset.val });
  },

  bindCurrentPage(e) {
    this.setData({ currentPage: e.detail.value });
  },

  async submitRecord() {
    if (this.data.status === 'partial' && !this.data.currentPage) {
      return wx.showToast({ title: '请填写当前页数', icon: 'error' });
    }

    this.setData({ isSubmitting: true });

    try {
      const db = wx.cloud.database();
      const record = {
        class_id: this.data.classList[this.data.classIndex],
        ppt_name: this.data.pptNames[this.data.pptIndex],
        status: this.data.status,
        currentPage: this.data.currentPage,
        totalPage: this.data.totalPage,
        date: formatDate(new Date()),
        timestamp: db.serverDate()
      };

      await db.collection('progress').add({ data: record });
      wx.showToast({ title: '打卡成功', icon: 'success' });

      // 提交后立即刷新历史状态，让"上次记录"小字马上显示
      await this.checkPptHistory();

      // 延迟清除状态
      setTimeout(() => {
        this.setData({ isSubmitting: false });
      }, 1500);
    } catch (err) {
      this.setData({ isSubmitting: false });
      wx.showModal({
        title: '打卡失败',
        content: '请确已在云开发控制台创建[progress]集合。详细错误：' + err.message,
        showCancel: false
      });
    }
  }
});
