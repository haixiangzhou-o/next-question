import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { navigateBack } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import { userDataRepository } from '../../repositories'
import type { ExamRecord } from '../../types/userData'
import './index.css'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function History() {
  const { t } = useI18n()
  const [records, setRecords] = useState<ExamRecord[]>(() => userDataRepository.getExamHistory())

  const clear = () => {
    userDataRepository.clearExamHistory()
    setRecords([])
  }

  return (
    <View className='history'>
      {records.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty'>{t('history.empty')}</Text>
          <Button className='btn' onClick={() => navigateBack()}>{t('history.backHome')}</Button>
        </View>
      ) : (
        <View>
          <View className='list'>
            {records.map((r) => (
              <View key={r.id} className='record'>
                <View className='record-main'>
                  <Text className='record-score'>{r.score}<Text className='record-total'> / {r.total}</Text></Text>
                  <Text className='record-date'>{formatDateTime(r.date)}</Text>
                </View>
                <View className='record-detail'>
                  {r.detail.map((d, i) => <Text key={i} className='detail-line'>{d}</Text>)}
                </View>
              </View>
            ))}
          </View>
          <Button className='btn clear' onClick={clear}>{t('history.clear')}</Button>
          <Button className='btn' onClick={() => navigateBack()}>{t('history.backHome')}</Button>
        </View>
      )}
    </View>
  )
}
