import { useMemo } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import { usePracticeSession } from '../../hooks/usePracticeSession'
import { useFavorite } from '../../hooks/useFavorite'
import { userDataRepository } from '../../repositories'
import type { PracticeMode } from '../../services/practice'
import type { QuestionType } from '../../types/question'
import './index.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const TYPE_KEY: Record<QuestionType, string> = {
  single: 'practice.single',
  short_answer: 'practice.shortAnswer',
  essay: 'practice.essay',
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch (e) {
    return s
  }
}

/** 去掉选项文本里自带的 "A." 前缀 */
function stripLetter(opt: string): string {
  return opt.replace(/^\s*[A-ZＡ-Ｚ]\s*[.．、:：]\s*/, '')
}

export default function Practice() {
  const { t } = useI18n()
  const router = useRouter()

  const options = useMemo(() => {
    const mode = (router.params.mode as PracticeMode) || 'sequential'
    if (mode === 'wrong') {
      return { mode, ids: userDataRepository.snapshot().wrongBook }
    }
    const rawChapter = router.params.chapter
    const chapter = rawChapter ? safeDecode(rawChapter) : undefined
    return { mode, chapter }
  }, [router.params.mode, router.params.chapter])

  const session = usePracticeSession(options)
  const { current, index, total, finished, answeredCount, correctCount, clearProgress } = session
  const { fav, toggle: toggleFavorite } = useFavorite(current?.id)

  const clearAndExit = () => {
    clearProgress()
    navigateBack()
  }

  if (!current) {
    return (
      <View className='practice'>
        <Text className='empty'>{t('practice.empty')}</Text>
        <Button className='btn' onClick={() => navigateBack()}>{t('practice.backHome')}</Button>
      </View>
    )
  }

  if (finished) {
    const accuracy = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100)
    return (
      <View className='practice summary'>
        <Text className='summary-title'>{t('practice.summary')}</Text>
        <View className='summary-stats'>
          <View className='stat'>
            <Text className='num'>{answeredCount}</Text>
            <Text className='lbl'>{t('practice.answered')}</Text>
          </View>
          <View className='stat'>
            <Text className='num'>{correctCount}</Text>
            <Text className='lbl'>{t('practice.correctCount')}</Text>
          </View>
          <View className='stat'>
            <Text className='num'>{accuracy}%</Text>
            <Text className='lbl'>{t('practice.accuracy')}</Text>
          </View>
        </View>
        <Button className='btn primary' onClick={session.restart}>{t('practice.restart')}</Button>
        <Button className='btn' onClick={() => navigateBack()}>{t('practice.backHome')}</Button>
      </View>
    )
  }

  const isSingle = current.type === 'single'
  const selected = (session.answers[current.id] as string) || ''
  const answered = current.id in session.results
  const result = session.results[current.id]
  const revealed = session.revealed[current.id] === true

  const choose = (letter: string) => {
    if (answered) return
    session.select(current.id, letter)
  }

  const submit = () => {
    if (!selected) {
      showToast({ title: t('practice.chooseAnswer'), icon: 'none' })
      return
    }
    session.submit(current.id, selected)
  }

  const goNext = () => session.next()

  const optionClass = (letter: string): string => {
    if (!answered) return selected === letter ? 'option selected' : 'option'
    if (letter === current.answer) return 'option correct'
    if (selected === letter) return 'option wrong'
    return 'option'
  }

  return (
    <View className='practice'>
      <View className='practice-top'>
        <Button className='btn clear-exit' onClick={clearAndExit}>{t('practice.clearExit')}</Button>
      </View>
      <View className='progress-bar'>
        <View className='fill' style={{ width: `${((index + 1) / total) * 100}%` }} />
      </View>
      <Text className='progress-text'>{t('practice.progress')} {index + 1} / {total}</Text>

      <View className='meta'>
        <Text className='tag'>{t(TYPE_KEY[current.type])}</Text>
        <Text className='tag'>{current.chapter}</Text>
        <Text className='tag'>{t('practice.difficulty')} {current.difficulty}</Text>
        <Text className='fav-tag' onClick={toggleFavorite}>{fav ? '★ ' : '☆ '}{t(fav ? 'practice.unfavorite' : 'practice.favorite')}</Text>
      </View>

      <Text className='stem'>{current.stem}</Text>

      {isSingle ? (
        <View className='options'>
          {(current.options || []).map((opt, i) => {
            const letter = LETTERS[i]
            return (
              <View key={letter} className={optionClass(letter)} onClick={() => choose(letter)}>
                <Text className='letter'>{letter}</Text>
                <Text className='option-text'>{stripLetter(opt)}</Text>
              </View>
            )
          })}
        </View>
      ) : (
        <View className='subjective'>
          {!revealed && (
            <Button className='btn reveal' onClick={() => session.reveal(current.id)}>
              {t('practice.showAnswer')}
            </Button>
          )}
          {revealed && (
            <View>
              <View className='reference'>
                <Text className='label'>{t('practice.referenceAnswer')}</Text>
                <Text className='content'>{current.referenceAnswer}</Text>
              </View>
              {!answered && (
                <View className='assess'>
                  <Button className='btn assess mastered' onClick={() => session.assess(current.id, true)}>
                    {t('practice.mastered')}
                  </Button>
                  <Button className='btn assess unmastered' onClick={() => session.assess(current.id, false)}>
                    {t('practice.unmastered')}
                  </Button>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {isSingle && answered && (
        <View className='feedback'>
          <Text className={result ? 'feedback-text correct' : 'feedback-text wrong'}>
            {result ? t('practice.correct') : t('practice.wrong')}
          </Text>
          <Text className='answer-line'>{t('practice.answer')}: {current.answer}</Text>
          {current.explanation && (
            <View className='explanation'>
              <Text className='label'>{t('practice.explanation')}</Text>
              <Text className='content'>{current.explanation}</Text>
            </View>
          )}
        </View>
      )}

      {!isSingle && answered && (
        <View className='feedback'>
          <Text className={result ? 'feedback-text correct' : 'feedback-text wrong'}>
            {result ? t('practice.mastered') : t('practice.unmastered')}
          </Text>
        </View>
      )}

      {isSingle && !answered && (
        <Button className='btn primary submit' onClick={submit}>{t('practice.submit')}</Button>
      )}

      <View className='footer'>
        <Button className='btn nav' disabled={index === 0} onClick={session.prev}>{t('practice.prev')}</Button>
        <Button className='btn nav primary' onClick={goNext}>
          {index === total - 1 ? t('practice.finish') : t('practice.next')}
        </Button>
      </View>
    </View>
  )
}
