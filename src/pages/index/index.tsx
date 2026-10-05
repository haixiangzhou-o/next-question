import { useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { navigateTo, setNavigationBarTitle } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import { questionRepository } from '../../repositories'
import type { PracticeMode } from '../../services/practice'
import './index.css'

export default function Index() {
  const { lang, t, setLang } = useI18n()
  const chapters = questionRepository.listChapters()
  const total = questionRepository.total

  useEffect(() => {
    setNavigationBarTitle({ title: t('app.title') })
  }, [lang, t])

  const go = (mode: PracticeMode, chapter?: string) => {
    let url = `/pages/practice/index?mode=${mode}`
    if (chapter) url += `&chapter=${encodeURIComponent(chapter)}`
    navigateTo({ url })
  }

  const toggle = () => setLang(lang === 'zh-CN' ? 'en-US' : 'zh-CN')

  return (
    <View className='home'>
      <View className='topbar'>
        <Text className='title'>{t('app.title')}</Text>
        <Button className='lang-btn' onClick={toggle}>{lang === 'zh-CN' ? 'EN' : '中文'}</Button>
      </View>

      <View className='summary'>
        <Text className='summary-text'>{t('home.totalPrefix')} {total} {t('home.questionsSuffix')}</Text>
      </View>

      <View className='modes'>
        <View className='mode-card' onClick={() => go('sequential')}>
          <Text className='mode-name'>{t('home.sequential')}</Text>
        </View>
        <View className='mode-card' onClick={() => go('random')}>
          <Text className='mode-name'>{t('home.random')}</Text>
        </View>
        <View className='mode-card' onClick={() => go('memorize')}>
          <Text className='mode-name'>{t('home.memorize')}</Text>
          <Text className='mode-hint'>{t('home.subjectiveHint')}</Text>
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>{t('home.chapters')}</Text>
        <Text className='section-hint'>{t('home.chaptersHint')}</Text>
      </View>
      <View className='chapters'>
        {chapters.map((c) => (
          <View key={c} className='chapter-chip' onClick={() => go('targeted', c)}>
            <Text>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
