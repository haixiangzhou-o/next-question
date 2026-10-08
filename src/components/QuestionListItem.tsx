import { useState } from 'react'
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
  /** 默认隐藏答案，点击「显示答案」展开（错题本用） */
  hideAnswer?: boolean
}

/** 去掉选项文本里自带的 "A." 前缀 */
function stripLetter(opt: string): string {
  return opt.replace(/^\s*[A-ZＡ-Ｚ]\s*[.．、:：]\s*/, '')
}

/** 全角字母 -> 半角 */
function toHalfWidth(ch: string): string {
  return ch.replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
}

/** 单选题：把答案字母映射为选项文本（不含 "A." 前缀），映射失败时回退字母本身 */
function answerText(q: Question): string {
  const ans = (q.answer || '').trim()
  if (!ans) return ''
  const letter = toHalfWidth(ans.charAt(0)).toUpperCase()
  const opt = (q.options || []).find((o) => {
    const m = /^\s*([A-ZＡ-Ｚａ-ｚ])/.exec(o || '')
    return m != null && toHalfWidth(m[1]).toUpperCase() === letter
  })
  return opt ? stripLetter(opt) : ans
}

/** 错题本 / 收藏夹共用的题目列表项：题干 + 答案 + 操作按钮 */
export function QuestionListItem({ q, actionLabel, onAction, hideAnswer = false }: Props) {
  const { t } = useI18n()
  const [revealed, setRevealed] = useState(false)
  const showAnswer = !hideAnswer || revealed

  return (
    <View className='q-item'>
      <View className='q-meta'>
        <Text className='q-tag'>{t(TYPE_KEY[q.type])}</Text>
        <Text className='q-tag'>{q.chapter}</Text>
      </View>
      <Text className='q-stem'>{q.stem}</Text>
      {showAnswer && q.type === 'single' && (
        <Text className='q-answer'>{t('practice.answer')}: {answerText(q)}</Text>
      )}
      {showAnswer && q.type !== 'single' && q.referenceAnswer && (
        <Text className='q-ref'>{t('practice.referenceAnswer')}: {q.referenceAnswer}</Text>
      )}
      <View className='q-actions'>
        {hideAnswer && (
          <Button className='q-reveal' onClick={() => setRevealed((v) => !v)}>
            {revealed ? t('list.hideAnswer') : t('list.showAnswer')}
          </Button>
        )}
        <Button className='q-action' onClick={() => onAction(q.id)}>{actionLabel}</Button>
      </View>
    </View>
  )
}
