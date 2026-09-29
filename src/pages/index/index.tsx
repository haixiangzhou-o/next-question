import { useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { useLoad, setNavigationBarTitle } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import './index.css'

export default function Index() {
  const { lang, t, setLang } = useI18n()

  useLoad(() => {
    console.log('Page loaded.')
  })

  useEffect(() => {
    setNavigationBarTitle({ title: t('app.title') })
  }, [lang, t])

  const toggle = () => {
    setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN')
  }

  return (
    <View className='index'>
      <Text className='hello'>{t('index.hello')}</Text>
      <Text className='lang'>{t('index.language')}: {lang}</Text>
      <Button className='btn' onClick={toggle}>{t('index.switch')}</Button>
    </View>
  )
}
