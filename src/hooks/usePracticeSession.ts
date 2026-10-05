/**
 * 刷题会话 hook：用 useReducer 轻量管理当前会话进度。
 * - 状态：题目列表、当前题号、作答、判分结果、参考答案展开、是否结束
 * - 副作用：提交/自评时通过 userDataRepository 持久化到本机
 */
import { useCallback, useMemo, useReducer } from 'react'
import type { Question } from '../types/question'
import { questionRepository, userDataRepository } from '../repositories'
import { buildPracticeQuestions, judgeObjective, type PracticeOptions } from '../services/practice'

export interface SessionState {
  questions: Question[]
  index: number
  /** 当前作答（客观题存选项字母；主观题存自评标记） */
  answers: Record<string, string | string[]>
  /** 判分/自评结果（客观题 correct；主观题 mastered） */
  results: Record<string, boolean>
  /** 主观题参考答案是否已展开 */
  revealed: Record<string, boolean>
  finished: boolean
}

type Action =
  | { type: 'select'; id: string; answer: string | string[] }
  | { type: 'submit'; id: string; result: boolean }
  | { type: 'reveal'; id: string }
  | { type: 'assess'; id: string; mastered: boolean }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'restart'; questions: Question[] }

function freshState(questions: Question[]): SessionState {
  return { questions, index: 0, answers: {}, results: {}, revealed: {}, finished: false }
}

function initSession(options: PracticeOptions): SessionState {
  return freshState(buildPracticeQuestions(questionRepository, options))
}

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'select':
      return { ...state, answers: { ...state.answers, [action.id]: action.answer } }
    case 'submit':
      return { ...state, results: { ...state.results, [action.id]: action.result } }
    case 'reveal':
      return { ...state, revealed: { ...state.revealed, [action.id]: true } }
    case 'assess':
      return { ...state, results: { ...state.results, [action.id]: action.mastered } }
    case 'next':
      if (state.index >= state.questions.length - 1) return { ...state, finished: true }
      return { ...state, index: state.index + 1 }
    case 'prev':
      return { ...state, index: Math.max(0, state.index - 1) }
    case 'restart':
      return freshState(action.questions)
    default:
      return state
  }
}

export function usePracticeSession(options: PracticeOptions) {
  const [state, dispatch] = useReducer(reducer, options, initSession)

  const select = useCallback((id: string, answer: string | string[]) => {
    dispatch({ type: 'select', id, answer })
  }, [])

  /** 提交客观题作答并判分，返回是否正确 */
  const submit = useCallback((id: string, answer: string | string[]): boolean => {
    const q = questionRepository.getById(id)
    const correct = q ? judgeObjective(q, answer) : false
    dispatch({ type: 'submit', id, result: correct })
    userDataRepository.recordAnswer(id, answer, correct)
    return correct
  }, [])

  const reveal = useCallback((id: string) => {
    dispatch({ type: 'reveal', id })
  }, [])

  /** 主观题自评掌握/未掌握 */
  const assess = useCallback((id: string, mastered: boolean) => {
    dispatch({ type: 'assess', id, mastered })
    userDataRepository.recordMemorization(id, mastered)
  }, [])

  const next = useCallback(() => dispatch({ type: 'next' }), [])
  const prev = useCallback(() => dispatch({ type: 'prev' }), [])

  const restart = useCallback(() => {
    dispatch({ type: 'restart', questions: buildPracticeQuestions(questionRepository, options) })
  }, [options.mode, options.chapter, options.type])

  const current = state.questions[state.index]
  const total = state.questions.length

  const answeredCount = useMemo(() => Object.keys(state.results).length, [state.results])
  const correctCount = useMemo(
    () => Object.values(state.results).filter(Boolean).length,
    [state.results],
  )

  return {
    current,
    index: state.index,
    total,
    answers: state.answers,
    results: state.results,
    revealed: state.revealed,
    finished: state.finished,
    answeredCount,
    correctCount,
    select,
    submit,
    reveal,
    assess,
    next,
    prev,
    restart,
  }
}

export type PracticeSession = ReturnType<typeof usePracticeSession>
