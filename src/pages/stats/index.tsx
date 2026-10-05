import { useMemo, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { useDidShow, navigateBack } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import { questionRepository, userDataRepository } from '../../repositories'
import { computeStats } from '../../services/stats'
import type { UserData } from '../../types/userData'
import './index.css'

export default function Stats() {
  const { t } = useI18n()
  const [data, setData] = useState<UserData>(() => userDataRepository.snapshot())

  useDidShow(() => setData(userDataRepository.snapshot()))

  const report = useMemo(() => computeStats(questionRepository, data.progress), [data])
  const accuracy = Math.round(report.accuracy * 100)

  return (
    <View className='stats'>
      <View className='cards'>
        <View className='card'>
          <Text className='num'>{report.totalAnswered}</Text>
          <Text className='lbl'>{t('stats.answered')}</Text>
        </View>
        <View className='card'>
          <Text className='num'>{accuracy}%</Text>
          <Text className='lbl'>{t('stats.accuracy')}</Text>
        </View>
        <View className='card'>
          <Text className='num'>{report.memorized}</Text>
          <Text className='lbl'>{t('stats.memorized')}</Text>
        </View>
        <View className='card'>
          <Text className='num'>{data.checkIn.streak}</Text>
          <Text className='lbl'>{t('home.streak')}</Text>
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>{t('stats.weak')}</Text>
        {report.weakChapters.length === 0 ? (
          <Text className='weak-empty'>{t('stats.noWeak')}</Text>
        ) : (
          <View className='weak-list'>
            {report.weakChapters.map((c) => <Text key={c} className='weak-chip'>{c}</Text>)}
          </View>
        )}
      </View>

      <View className='section'>
        <Text className='section-title'>{t('stats.chapter')}</Text>
        {report.chapters.map((c) => (
          <View key={c.chapter} className='chapter-row'>
            <Text className='chapter-name'>{c.chapter}</Text>
            <View className='chapter-bar'>
              <View className='fill' style={{ width: `${Math.round(c.accuracy * 100)}%` }} />
            </View>
            <Text className='chapter-stat'>{c.correct}/{c.answered} · {Math.round(c.accuracy * 100)}%</Text>
          </View>
        ))}
      </View>

      <Button className='btn' onClick={() => navigateBack()}>{t('history.backHome')}</Button>
    </View>
  )
}
