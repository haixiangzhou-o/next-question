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
  const { current, index, total, submitted, result, remainingSeconds, autoSubmitted, questions, results } = session

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
            const answered = q.id in results
            const mark = answered ? (results[q.id] ? '✓' : '✗') : '—'
            return (
              <View key={q.id} className='review-item'>
                <Text className={answered ? (results[q.id] ? 'mark ok' : 'mark bad') : 'mark'}>
                  {i + 1}. {mark}
                </Text>
                <Text className='review-stem'>{q.stem}</Text>
                {q.type === 'single' && <Text className='review-answer'>{t('practice.answer')}: {q.answer}</Text>}
              </View>
            )
          })}
        </View>

        <Button className='btn primary' onClick={session.restart}>{t('exam.restart')}</Button>
        <Button className='btn' onClick={() => navigateBack()}>{t('practice.backHome')}</Button>
      </View>
    )
  }

  const isSingle = current.type === 'single'
  const selected = (session.answers[current.id] as string) || ''
  const answered = current.id in session.results
  const resultMark = session.results[current.id]
  const revealed = session.revealed[current.id] === true

  const choose = (letter: string) => {
    if (answered) return
    session.select(current.id, letter)
  }

  const submit = () => {
    if (!selected) return
    session.submit(current.id, selected)
  }

  const optionClass = (letter: string): string => {
    if (!answered) return selected === letter ? 'option selected' : 'option'
    if (letter === current.answer) return 'option correct'
    if (selected === letter) return 'option wrong'
    return 'option'
  }

  const danger = remainingSeconds < 60

  return (
    <View className='exam'>
      <View className='exam-top'>
        <Text className={danger ? 'timer danger' : 'timer'}>{t('exam.timeLeft')} {formatDuration(remainingSeconds)}</Text>
        <Button className='btn submit-exam' onClick={confirmSubmit}>{t('exam.submit')}</Button>
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
          <Text className={resultMark ? 'feedback-text correct' : 'feedback-text wrong'}>
            {resultMark ? t('practice.correct') : t('practice.wrong')}
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

      {isSingle && !answered && (
        <Button className='btn primary submit' disabled={!selected} onClick={submit}>{t('practice.submit')}</Button>
      )}

      <View className='footer'>
        <Button className='btn nav' disabled={index === 0} onClick={session.prev}>{t('practice.prev')}</Button>
        <Button className='btn nav primary' disabled={index >= total - 1} onClick={session.next}>{t('practice.next')}</Button>
      </View>
    </View>
  )
}
