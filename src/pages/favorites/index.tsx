import { useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
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

export default function Favorites() {
  const { t } = useI18n()
  const [favIds, setFavIds] = useState<string[]>(() => userDataRepository.snapshot().favorites)
  const [chapter, setChapter] = useState('')
  const [type, setType] = useState<QuestionType | ''>('')

  useDidShow(() => setFavIds(userDataRepository.snapshot().favorites))

  const chapters = questionRepository.listChapters()
  const list = useMemo(() => {
    const ids = [...favIds].reverse()
    return questionRepository.getByIds(ids).filter((q) =>
      (!chapter || q.chapter === chapter) && (!type || q.type === type)
    )
  }, [favIds, chapter, type])

  const unfavorite = (id: string) => {
    userDataRepository.toggleFavorite(id)
    setFavIds(userDataRepository.snapshot().favorites)
  }

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

      {favIds.length === 0 ? (
        <View className='empty-wrap'>
          <Text className='empty'>{t('favorites.empty')}</Text>
        </View>
      ) : (
        <View>
          {list.length === 0 && <Text className='empty'>{t('practice.empty')}</Text>}
          {list.map((q) => (
            <QuestionListItem key={q.id} q={q} actionLabel={t('favorites.remove')} onAction={unfavorite} />
          ))}
        </View>
      )}
    </View>
  )
}
