import { useMemo, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { useDidShow, navigateTo } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import { questionRepository, userDataRepository } from '../../repositories'
import { QuestionListItem } from '../../components/QuestionListItem'
import type { QuestionType } from '../../types/question'
import './index.css'

const TYPES: QuestionType[] = ['single', 'short_answer', 'essay']
const TYPE_KEY: Record<QuestionType, string> = {
  single: 'practice.single',
  short_answer: 'practice.shortAnswer',
  essay: 'practice.essay',
}

export default function WrongBook() {
  const { t } = useI18n()
  const [wrongIds, setWrongIds] = useState<string[]>(() => userDataRepository.snapshot().wrongBook)
  const [chapter, setChapter] = useState('')
  const [type, setType] = useState<QuestionType | ''>('')

  useDidShow(() => setWrongIds(userDataRepository.snapshot().wrongBook))

  const chapters = questionRepository.listChapters()
  const list = useMemo(() => {
    const ids = [...wrongIds].reverse()
    return questionRepository.getByIds(ids).filter((q) =>
      (!chapter || q.chapter === chapter) && (!type || q.type === type)
    )
  }, [wrongIds, chapter, type])

  const remove = (id: string) => {
    userDataRepository.removeWrong(id)
    setWrongIds(userDataRepository.snapshot().wrongBook)
  }

  const redo = () => navigateTo({ url: '/pages/practice/index?mode=wrong' })

  return (
    <View className='page'>
      <View className='filters'>
        <Text className={!chapter ? 'chip active' : 'chip'} onClick={() => setChapter('')}>{t('common.all')}</Text>
        {chapters.map((c) => (
          <Text key={c} className={chapter === c ? 'chip active' : 'chip'} onClick={() => setChapter(c)}>{c}</Text>
        ))}
      </View>
      <View className='filters'>
        <Text className={!type ? 'chip active' : 'chip'} onClick={() => setType('')}>{t('common.all')}</Text>
        {TYPES.map((tp) => (
          <Text key={tp} className={type === tp ? 'chip active' : 'chip'} onClick={() => setType(tp)}>{t(TYPE_KEY[tp])}</Text>
        ))}
      </View>

      {wrongIds.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty'>{t('wrongbook.empty')}</Text>
        </View>
      ) : (
        <View>
          <Button className='btn primary' onClick={redo}>{t('wrongbook.redo')}（{wrongIds.length}）</Button>
          {list.length === 0 && <Text className='empty'>{t('practice.empty')}</Text>}
          {list.map((q) => (
            <QuestionListItem key={q.id} q={q} actionLabel={t('wrongbook.remove')} onAction={remove} hideAnswer />
          ))}
        </View>
      )}
    </View>
  )
}
