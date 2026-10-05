import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { navigateTo, setNavigationBarTitle, useDidShow } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import { questionRepository, userDataRepository } from '../../repositories'
import type { PracticeMode } from '../../services/practice'
import './index.css'

export default function Index() {
  const { lang, t, setLang } = useI18n()
  const chapters = questionRepository.listChapters()
  const total = questionRepository.total
  const [streak, setStreak] = useState(() => userDataRepository.getCheckIn().streak)

  useEffect(() => {
    setNavigationBarTitle({ title: t('app.title') })
  }, [lang, t])

  useDidShow(() => setStreak(userDataRepository.getCheckIn().streak))

  const go = (mode: PracticeMode, chapter?: string) => {
    let url = `/pages/practice/index?mode=${mode}`
    if (chapter) url += `&chapter=${encodeURIComponent(chapter)}`
    navigateTo({ url })
  }

  const goExam = () => navigateTo({ url: '/pages/exam/index' })
  const goHistory = () => navigateTo({ url: '/pages/history/index' })
  const goWrongbook = () => navigateTo({ url: '/pages/wrongbook/index' })
  const goFavorites = () => navigateTo({ url: '/pages/favorites/index' })
  const goStats = () => navigateTo({ url: '/pages/stats/index' })

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

      <View className='checkin'>
        <Text className='checkin-streak'>{t('home.streak')} {streak} {t('home.days')}</Text>
        <Text className='checkin-hint'>{t('home.checkinHint')}</Text>
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
        <View className='mode-card exam-card' onClick={goExam}>
          <Text className='mode-name'>{t('home.exam')}</Text>
          <Text className='mode-hint'>{t('home.examHint')}</Text>
        </View>
        <View className='mode-card' onClick={goHistory}>
          <Text className='mode-name'>{t('home.history')}</Text>
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

      <View className='section'>
        <Text className='section-title'>{t('home.study')}</Text>
      </View>
      <View className='modes'>
        <View className='mode-card' onClick={goWrongbook}>
          <Text className='mode-name'>{t('home.wrongbook')}</Text>
        </View>
        <View className='mode-card' onClick={goFavorites}>
          <Text className='mode-name'>{t('home.favorites')}</Text>
        </View>
        <View className='mode-card' onClick={goStats}>
          <Text className='mode-name'>{t('home.stats')}</Text>
        </View>
      </View>
    </View>
  )
}
