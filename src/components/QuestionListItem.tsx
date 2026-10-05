import { View, Text, Button } from '@tarojs/components'
import { useI18n } from '../locales/I18nProvider'
import type { Question, QuestionType } from '../types/question'

const TYPE_KEY: Record<QuestionType, string> = {
  single: 'practice.single',
  short_answer: 'practice.shortAnswer',
  essay: 'practice.essay',
}

interface Props {
  q: Question
  actionLabel: string
  onAction: (id: string) => void
}

/** 错题本 / 收藏夹共用的题目列表项：题干 + 答案 + 操作按钮 */
export function QuestionListItem({ q, actionLabel, onAction }: Props) {
  const { t } = useI18n()
  return (
    <View className='q-item'>
      <View className='q-meta'>
        <Text className='q-tag'>{t(TYPE_KEY[q.type])}</Text>
        <Text className='q-tag'>{q.chapter}</Text>
      </View>
      <Text className='q-stem'>{q.stem}</Text>
      {q.type === 'single' && <Text className='q-answer'>{t('practice.answer')}: {q.answer}</Text>}
      {q.type !== 'single' && q.referenceAnswer && (
        <Text className='q-ref'>{t('practice.referenceAnswer')}: {q.referenceAnswer}</Text>
      )}
      <Button className='q-action' onClick={() => onAction(q.id)}>{actionLabel}</Button>
    </View>
  )
}
