import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { I18nProvider } from './locales/I18nProvider'

import './app.css'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
  })

  // children 是将要会渲染的页面
  return (
    <I18nProvider>
      {children}
    </I18nProvider>
  )
}

export default App
