// 注意：不要开启 lazyCodeLoading（按需注入）。
// Taro 4.3.0 编译产物中的内部组件 comp 与微信「按需注入」不兼容，
// 开启后模拟器/真机会报 "Component is not found in path 'comp'"。
export default defineAppConfig({
  pages: [
    'pages/index/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '刷题训练',
    navigationBarTextStyle: 'black'
  }
})
