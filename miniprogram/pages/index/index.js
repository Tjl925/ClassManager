const { pptList, initialSchedule, timeSlots, formatDate } = require('../../config/constants.js');
const { fetchWeekOverrides } = require('../../utils/scheduleStore.js');

// 进度轴节点宽度（单位 rpx）。必须与 index.wxss 中 .track-node 的 width 严格一致，
// 改宽度时两处必须同步 —— centerTrack() 的居中算法依赖这个值。
const NODE_W_RPX = 180;
// 轨道左右内边距（rpx）：取 (设计宽 750 - 节点宽)/2，让首尾节点也能精确滚到屏幕正中。
// 若改成小边距，第 1 讲和第 23 讲会因滚动量被夹取而无法居中，只能贴边。
// 必须与 index.wxss 中 .track-inner 的 padding 一致。
const TRACK_PAD_RPX = (750 - NODE_W_RPX) / 2;

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
    recommendLabel: '',
    // 确认弹窗（提交与撤销共用一套）
    showConfirm: false,
    confirmMode: 'submit', // 'submit' | 'undo'
    confirmInfo: null,
    // 进度轴：axisIndex 是该班"实际讲到哪"，与表单当前选中的 pptIndex 解耦。
    // 换课件不会改动它，只有换班级、提交、撤销才刷新。
    axisIndex: 0,
    // 进度轴逐节点"确实讲完过"标记（23 项布尔数组，下标对应 pptList）。
    // 按真实记录点亮 —— 跳着上课时，被跳过的课件保持灰色，不会被误点亮。
    axisDone: [],
    // 进度轴横向滚动位置（px）
    trackScrollLeft: 0
  },

  onLoad() {
    this.smartRecommend();
    this.fixLegacyTotalPages();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    // 兜底关掉可能还开着的确认弹窗（切 tab 回来时它不会自己关）
    if (this.data.showConfirm) {
      this.setData({ showConfirm: false });
    }
    // 每次从别的页面切回来，都重新拉一次最新进度，让进度轴回到该班当前实际位置。
    // 首次进入不在这里拉：那时 smartRecommend 还没决定是哪个班，两边并发会互相覆盖结果。
    if (this._axisReady) {
      this.refreshAxis();
    }
  },

  // 智能推荐：按"上课中 -> 刚下课(60分内) -> 离当前最近的未来第一节课"层级匹配
  async smartRecommend() {
    try {
      const now = new Date();
      const currentWeek = now.getDay() || 7; // 1(周一) - 7(周日)
      const currentMins = now.getHours() * 60 + now.getMinutes();

      // 先拉本周调课覆盖（云库，两人共享）。取不到就按原始课表走，不让推荐整个失败
      let overrides = {};
      try {
        overrides = await fetchWeekOverrides();
      } catch (e) {
        console.log('调课覆盖读取失败，按原始课表推荐：', e);
      }

      // 获取某星期某节次的实际班级（本周调课覆盖优先）
      const getScheduleClass = (week, slot) => {
        const key = `${week}-${slot}`;
        if (overrides[key] !== undefined) {
          return overrides[key] === 'none' ? null : overrides[key];
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
        this.setAxis(0);
        return this.applyPpt(0);
      }

      // 查该班进度（同时得到实际该讲的一讲 + 已讲完课件集合）
      const progress = await this.fetchClassProgress(targetClassId);
      const safeIdx = Math.min(progress.axisIndex, this.data.pptNames.length - 1);

      const idx = this.data.classList.indexOf(targetClassId);
      this.setData({
        classIndex: idx >= 0 ? idx : 0,
        recommendedClass: targetClassId,
        recommendLabel: recommendLabel,
        axisDone: progress.axisDone
      });
      wx.showToast({ title: `推荐打卡：${targetClassId}班`, icon: 'none' });
      // 推荐课件 = 该班实际该讲的那一讲，进度轴停在它上面
      this.setAxis(safeIdx);
      this.applyPpt(safeIdx);
    } catch (err) {
      console.log('智能推荐异常:', err);
      // 走 applyPpt(0) 而不是裸 setData：pptIndex 与 totalPage 必须一起改，
      // 否则确认弹窗会显示错误的总页数
      this.setData({ classIndex: 0, recommendedClass: '', recommendLabel: '' });
      this.setAxis(0);
      this.applyPpt(0);
    } finally {
      // 首次定位完成，之后 onShow 里的进度轴刷新可以安全接管
      this._axisReady = true;
    }
  },

  // 拉某班全部打卡记录，一次算出进度轴需要的两样东西：
  //   axisIndex —— 该班实际该讲的那一讲（最新一条已讲完 → 下一讲；未讲完 → 同一讲；无记录 → 第一讲）
  //   axisDone  —— 23 项布尔数组，标记哪些课件"确实讲完过"
  //
  // axisDone 必须按真实记录点亮，不能按 index < axisIndex 这种位置切片：
  // 老师会跳着上课（跳过 1.2.3 先上 1.3.1），位置切片会把没上过的课件也点亮。
  async fetchClassProgress(classId) {
    const db = wx.cloud.database();
    // ⚠ 小程序端单次查询最多返回 20 条（官方限制），传更大的值会被静默截断，必须分页
    const PAGE = 20;
    const MAX_PAGES = 6; // 上限 120 条，足够覆盖 23 个课件的多轮重讲
    let all = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await db.collection('progress')
        .where({ class_id: classId })
        .orderBy('timestamp', 'desc')
        .skip(page * PAGE)
        .limit(PAGE)
        .get();
      const batch = res.data || [];
      all = all.concat(batch);
      if (batch.length < PAGE) break; // 已取完
    }

    const doneNames = {};
    all.forEach(r => {
      if (r.status === 'completed') doneNames[r.ppt_name] = true;
    });
    const axisDone = this.data.pptList.map(p => !!doneNames[p.name]);

    let axisIndex = 0;
    if (all.length) {
      const idx = this.data.pptNames.indexOf(all[0].ppt_name);
      if (idx >= 0) {
        axisIndex = all[0].status === 'completed'
          ? Math.min(idx + 1, this.data.pptNames.length - 1)
          : idx;
      }
    }

    return { axisIndex, axisDone };
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
  // 存储键带版本号：修复分页 bug 后改成 v2，这样老设备上那个"已跑过"的旧标记不会挡住重跑
  async fixLegacyTotalPages() {
    const FLAG = 'legacyPagesFixed_v2';
    if (wx.getStorageSync(FLAG)) return;
    try {
      const db = wx.cloud.database();
      const total = (await db.collection('progress').count()).total;
      // ⚠ 小程序端单次查询最多返回 20 条，写更大的值会被静默截断，步长必须与 limit 一致。
      // 旧代码用 100 作步长但每页只拿回 20 条，第 20 条之后的记录会被整段跳过。
      const pageSize = 20;
      let fixed = 0;
      for (let i = 0; i < total; i += pageSize) {
        // 显式排序：不带 orderBy 时 skip/limit 的分页顺序不保证稳定，可能漏读或重读
        const res = await db.collection('progress')
          .orderBy('_id', 'asc')
          .skip(i)
          .limit(pageSize)
          .get();
        for (const r of res.data) {
          const ppt = pptList.find(p => p.name === r.ppt_name);
          if (ppt && r.status === 'partial' && Number(r.totalPage) !== ppt.totalPage) {
            await db.collection('progress').doc(r._id).update({ data: { totalPage: ppt.totalPage } });
            fixed++;
          }
        }
      }
      wx.setStorageSync(FLAG, true);
      if (fixed) console.log('已回补 totalPage 记录数：' + fixed);
    } catch (err) {
      console.log('旧数据回补失败：', err);
    }
  },

  bindClassChange(e) {
    // 徽章是全局状态，切换班级时保留
    this.setData({ classIndex: e.detail.value });
    const classId = this.data.classList[e.detail.value];
    this.fetchClassProgress(classId).then(progress => {
      // 换班了：已讲完集合与进度位置一起切到该班
      this.setData({ axisDone: progress.axisDone });
      this.setAxis(progress.axisIndex);
      this.applyPpt(progress.axisIndex);
    }).catch(err => {
      console.log('切换班级加载进度失败：', err);
    });
  },

  bindPptChange(e) {
    this.applyPpt(e.detail.value);
  },

  // 切换课件：自动填入固定总页数，再查历史
  // 注意：这里刻意不动进度轴 —— 轴表示该班的"实际进度"，与本次选哪个课件无关
  applyPpt(index) {
    this.setData({
      pptIndex: index,
      totalPage: this.data.pptList[index].totalPage
    });
    this.checkPptHistory();
  },

  // ==================== 进度轴（只读的班级实际进度指示器）====================
  // 设置该班实际讲到哪，并把对应节点滚到屏幕正中
  setAxis(index) {
    this.setData({ axisIndex: index });
    this.centerTrack(index);
  },

  // 重新查库得出该班实际进度（提交 / 撤销后调用，进度可能前移或回退）
  async refreshAxis() {
    const classId = this.data.classList[this.data.classIndex];
    try {
      const progress = await this.fetchClassProgress(classId);
      this.setData({ axisDone: progress.axisDone });
      this.setAxis(progress.axisIndex);
    } catch (err) {
      console.log('进度轴刷新失败：', err);
    }
  },

  // 把第 index 个节点滚到轨道正中间
  // scroll-into-view 只能对齐左边缘，故用 scroll-left 精确计算（单位 px，需 rpx→px 换算）
  centerTrack(index) {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const pxPerRpx = info.windowWidth / 750;
      const nodeW = NODE_W_RPX * pxPerRpx;
      const padLeft = TRACK_PAD_RPX * pxPerRpx;
      const target = padLeft + index * nodeW + nodeW / 2 - info.windowWidth / 2;
      this.setData({ trackScrollLeft: Math.max(0, target) });
    } catch (err) {
      console.log('进度轴居中失败：', err);
    }
  },

  // 空方法：供 catchtap / catchtouchmove 吃掉冒泡
  noop() {},

  bindStatusChangeManual(e) {
    this.setData({ status: e.currentTarget.dataset.val });
  },

  bindCurrentPage(e) {
    this.setData({ currentPage: e.detail.value });
  },

  // 点"记录进度"：先校验，再开确认弹窗；真正写库在 doSubmit()
  submitRecord() {
    if (this.data.status === 'partial' && !this.data.currentPage) {
      return wx.showToast({ title: '请填写当前页数', icon: 'error' });
    }
    if (this.data.isSubmitting) return;

    const partial = this.data.status === 'partial';
    this.setData({
      showConfirm: true,
      confirmMode: 'submit',
      confirmInfo: {
        classId: this.data.classList[this.data.classIndex],
        pptName: this.data.pptNames[this.data.pptIndex],
        statusText: partial ? '未讲完' : '全讲完',
        status: this.data.status,
        pageText: partial
          ? `讲到 ${this.data.currentPage} / ${this.data.totalPage} 页`
          : `共 ${this.data.totalPage} 页`
      }
    });
  },

  // 点"撤销这条记录"：删数据不可逆，先过确认弹窗
  // 撤销的目标 = 上方"上次记录"徽章显示的那一条（当前班级 + 当前课件的最近一条）
  // 因此不限于"刚刚提交的"，误点过的历史记录也能删掉
  undoRecord() {
    const h = this.data.historyState;
    if (!h || !h._id) return;
    const partial = h.status === 'partial';
    this.setData({
      showConfirm: true,
      confirmMode: 'undo',
      confirmInfo: {
        classId: this.data.classList[this.data.classIndex],
        pptName: h.ppt_name,
        statusText: partial ? '未讲完' : '全讲完',
        status: h.status,
        pageText: partial
          ? `讲到 ${h.currentPage} / ${h.totalPage} 页`
          : `共 ${h.totalPage} 页`,
        date: h.date
      }
    });
  },

  // 弹窗"取消"
  cancelConfirm() {
    this.setData({ showConfirm: false });
  },

  // 弹窗主按钮统一入口，按模式分派
  confirmAction() {
    if (this.data.confirmMode === 'undo') return this.doUndo();
    return this.doSubmit();
  },

  async doSubmit() {
    this.setData({ showConfirm: false, isSubmitting: true });

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

      // 刷新"上次记录"徽章 —— 它同时是撤销按钮的目标来源
      await this.checkPptHistory();
      // 刚记录的这条可能让该班进度前移，进度轴跟着走
      await this.refreshAxis();

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
  },

  // 撤销：删除"上次记录"徽章显示的那一条
  // 云库权限"仅创建者可读写"下，本机账号创建的记录可删；删别的账号创建的记录会被服务端拒绝（预期行为）
  async doUndo() {
    const h = this.data.historyState;
    if (!h || !h._id || this._undoing) return;
    this._undoing = true;
    this.setData({ showConfirm: false });

    try {
      const db = wx.cloud.database();
      await db.collection('progress').doc(h._id).remove();

      wx.showToast({ title: '已撤销', icon: 'success' });

      // 记录没了，"上次记录"徽章还原成上一条，进度轴也跟着回退
      await this.checkPptHistory();
      await this.refreshAxis();
    } catch (err) {
      wx.showModal({
        title: '撤销失败',
        content: '这条记录可能已被删除，或者不是本机账号创建的（云库当前权限只允许删除自己创建的记录）。详细错误：' + err.message,
        showCancel: false
      });
    } finally {
      this._undoing = false;
    }
  }
});
