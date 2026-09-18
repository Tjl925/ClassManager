Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '打卡' },
      { pagePath: '/pages/schedule/schedule', text: '课表' },
      { pagePath: '/pages/overview/overview', text: '概览' }
    ]
  },

  methods: {
    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      this.setData({ selected: index });
      wx.switchTab({ url: path });
    }
  }
});