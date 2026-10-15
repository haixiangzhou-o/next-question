import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import { navigateBack, showModal } from '@tarojs/taro'
import { useI18n } from '../../locales/I18nProvider'
import { useExamSession } from '../../hooks/useExamSession'
import { formatDuration } from '../../services/exam'
import type { QuestionType } from '../../types/question'
import './index.css'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const TYPE_KEY: Record<QuestionType, string> = {
  single: 'practice.single',
  short_answer: 'practice.shortAnswer',
  essay: 'practice.essay',
}

function stripLetter(opt: string): string {
  return opt.replace(/^\s*[A-ZＡ-Ｚ]\s*[.．、:：]\s*/, '')
}

export default function Exam() {
  const { t } = useI18n()
  const session = useExamSession()
  const { current, index, total, submitted, result, remainingSeconds, autoSubmitted, questions, clearProgress } = session
  const [saved, setSaved] = useState(false)

  const clearAndExit = () => {
    clearProgress()
    navigateBack()
  }

  const confirmSubmit = () => {
    showModal({
      title: t('app.title'),
      content: t('exam.submitConfirm'),
      confirmText: t('exam.submit'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (res.confirm) session.submitExam()
      },
    })
  }

  const saveResult = () => {
    session.saveResult()
    setSaved(true)
  }

  const restart = () => {
    setSaved(false)
    session.restart()
  }

  if (!current) {
    return (
      <View className='exam'>
        <Text className='empty'>{t('exam.empty')}</Text>
        <Button className='btn' onClick={() => navigateBack()}>{t('practice.backHome')}</Button>
      </View>
    )
  }

  if (submitted && result) {
    const accuracy = Math.round(result.singleAccuracy * 100)
    return (
      <View className='exam report'>
        <Text className='report-title'>{t('exam.reportTitle')}</Text>
        <View className='score-box'>
          <Text className='score'>{result.score}</Text>
          <Text className='score-total'> / {result.total}</Text>
        </View>
        {autoSubmitted && <Text className='auto-note'>{t('exam.autoSubmit')}</Text>}

        <View className='sections'>
          <View className='section-row'>
            <Text className='s-name'>{t('exam.single')}</Text>
            <Text className='s-score'>{result.singleEarned} / {result.singleTotal}</Text>
          </View>
          <View className='section-row'>
            <Text className='s-name'>{t('exam.short')}</Text>
            <Text className='s-score'>{result.shortEarned} / {result.shortTotal}</Text>
          </View>
          <View className='section-row'>
            <Text className='s-name'>{t('exam.essay')}</Text>
            <Text className='s-score'>{result.essayEarned} / {result.essayTotal}</Text>
          </View>
        </View>

        <Text className='accuracy-line'>{t('exam.accuracy')}: {accuracy}%</Text>

        <View className='review'>
          <Text className='review-title'>{t('exam.review')}</Text>
          {questions.map((q, i) => {
            if (q.type === 'single') {
              const sel = session.answers[q.id] as string | undefined
              const answered = sel != null
              const correct = session.results[q.id] === true
              return (
                <View key={q.id} className='review-item'>
                  <Text className={answered ? (correct ? 'mark ok' : 'mark bad') : 'mark'}>
                    {i + 1}. {answered ? (correct ? '✓' : '✗') : '—'}
                  </Text>
                  <Text className='review-stem'>{q.stem}</Text>
                  {answered && <Text className='review-your'>{t('exam.yourAnswer')}: {sel}</Text>}
                  <Text className='review-answer'>{t('practice.answer')}: {q.answer}</Text>
                </View>
              )
            }
            const assessed = q.id in session.results
            return (
              <View key={q.id} className='review-item'>
                <Text className={assessed ? (session.results[q.id] ? 'mark ok' : 'mark bad') : 'mark'}>
                  {i + 1}. {assessed ? (session.results[q.id] ? '✓' : '✗') : '—'}
                </Text>
                <Text className='review-stem'>{q.stem}</Text>
                <View className='reference'>
                  <Text className='label'>{t('practice.referenceAnswer')}</Text>
                  <Text className='content'>{q.referenceAnswer}</Text>
                </View>
                <View className='assess'>
                  <Button className='btn assess mastered' onClick={() => session.assess(q.id, true)}>
                    {session.results[q.id] === true ? '✓ ' : ''}{t('practice.mastered')}
                  </Button>
                  <Button className='btn assess unmastered' onClick={() => session.assess(q.id, false)}>
                    {session.results[q.id] === false ? '✗ ' : ''}{t('practice.unmastered')}
                  </Button>
                </View>
              </View>
            )
          })}
        </View>

        {!saved && (
          <Button className='btn primary' onClick={saveResult}>{t('exam.saveResult')}</Button>
        )}
        {saved && <Text className='saved-note'>{t('exam.saved')}</Text>}
        <Button className='btn primary' onClick={restart}>{t('exam.restart')}</Button>
        <Button className='btn' onClick={() => navigateBack()}>{t('practice.backHome')}</Button>
      </View>
    )
  }

  const isSingle = current.type === 'single'
  const selected = (session.answers[current.id] as string) || ''
  const subjectDone = session.subjectiveDone[current.id] === true

  const choose = (letter: string) => {
    session.select(current.id, letter)
  }

  const optionClass = (letter: string): string => {
    return selected === letter ? 'option selected' : 'option'
  }

  const danger = remainingSeconds < 60

  return (
    <View className='exam'>
      <View className='exam-top'>
        <View className='exam-top-right'>
          <Button className='btn clear-exit' onClick={clearAndExit}>{t('practice.clearExit')}</Button>
        </View>
        <View className='exam-bar'>
          <Text className={danger ? 'timer danger' : 'timer'}>{t('exam.timeLeft')} {formatDuration(remainingSeconds)}</Text>
          <Button className='btn submit-exam' onClick={confirmSubmit}>{t('exam.submit')}</Button>
        </View>
      </View>

      <View className='progress-bar'>
        <View className='fill' style={{ width: `${((index + 1) / total) * 100}%` }} />
      </View>
      <Text className='progress-text'>{t('practice.progress')} {index + 1} / {total}</Text>

      <View className='meta'>
        <Text className='tag'>{t(TYPE_KEY[current.type])}</Text>
        <Text className='tag'>{current.chapter}</Text>
        <Text className='tag'>{t('practice.difficulty')} {current.difficulty}</Text>
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
          <Button
            className={subjectDone ? 'btn confirm-done done' : 'btn confirm-done'}
            onClick={() => session.confirmSubjective(current.id, !subjectDone)}
          >
            {subjectDone ? t('exam.answeredDone') : t('exam.confirmDone')}
          </Button>
        </View>
      )}

      <View className='footer'>
        <Button className='btn nav' disabled={index === 0} onClick={session.prev}>{t('practice.prev')}</Button>
        <Button className='btn nav primary' disabled={index >= total - 1} onClick={session.next}>{t('practice.next')}</Button>
      </View>
    </View>
  )
}
