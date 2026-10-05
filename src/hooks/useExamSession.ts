/**
 * 模拟考试会话 hook：useReducer + setInterval 倒计时。
 * - 倒计时归零自动交卷
 * - 交卷后计分并把考试记录写入 userDataRepository
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { Question } from '../types/question'
import { questionRepository, userDataRepository } from '../repositories'
import { judgeObjective } from '../services/practice'
import {
  buildExamPaper,
  flattenPaper,
  scoreExam,
  DEFAULT_EXAM_CONFIG,
  type ExamConfig,
  type ExamPaper,
  type ExamResult,
} from '../services/exam'

interface ExamState {
  paper: ExamPaper
  questions: Question[]
  index: number
  answers: Record<string, string | string[]>
  results: Record<string, boolean>
  revealed: Record<string, boolean>
  remainingSeconds: number
  submitted: boolean
  autoSubmitted: boolean
}

type Action =
  | { type: 'select'; id: string; answer: string | string[] }
  | { type: 'submit'; id: string; result: boolean }
  | { type: 'reveal'; id: string }
  | { type: 'assess'; id: string; mastered: boolean }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; index: number }
  | { type: 'tick' }
  | { type: 'submitExam' }
  | { type: 'restart'; paper: ExamPaper; remainingSeconds: number }

function initExam(config: ExamConfig): ExamState {
  const paper = buildExamPaper(questionRepository, config)
  return {
    paper,
    questions: flattenPaper(paper),
    index: 0,
    answers: {},
    results: {},
    revealed: {},
    remainingSeconds: config.durationSeconds,
    submitted: false,
    autoSubmitted: false,
  }
}

function reducer(state: ExamState, action: Action): ExamState {
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
      if (state.index >= state.questions.length - 1) return state
      return { ...state, index: state.index + 1 }
    case 'prev':
      return { ...state, index: Math.max(0, state.index - 1) }
    case 'goto':
      return { ...state, index: Math.max(0, Math.min(state.questions.length - 1, action.index)) }
    case 'tick':
      if (state.submitted) return state
      if (state.remainingSeconds <= 1) {
        return { ...state, remainingSeconds: 0, submitted: true, autoSubmitted: true }
      }
      return { ...state, remainingSeconds: state.remainingSeconds - 1 }
    case 'submitExam':
      return { ...state, submitted: true }
    case 'restart':
      return {
        paper: action.paper,
        questions: flattenPaper(action.paper),
        index: 0,
        answers: {},
        results: {},
        revealed: {},
        remainingSeconds: action.remainingSeconds,
        submitted: false,
        autoSubmitted: false,
      }
    default:
      return state
  }
}

export function useExamSession(config: ExamConfig = DEFAULT_EXAM_CONFIG) {
  const [state, dispatch] = useReducer(reducer, config, initExam)

  // 每日首次作答时打卡一次
  const checkInRef = useRef(false)
  const ensureCheckIn = useCallback(() => {
    if (!checkInRef.current) {
      checkInRef.current = true
      userDataRepository.checkInToday()
    }
  }, [])

  // 倒计时
  useEffect(() => {
    if (state.submitted) return
    const timer = setInterval(() => dispatch({ type: 'tick' }), 1000)
    return () => clearInterval(timer)
  }, [state.submitted])

  const result: ExamResult | null = useMemo(() => {
    if (!state.submitted) return null
    return scoreExam(state.paper, state.results, config)
  }, [state.submitted, state.paper, state.results, config])

  // 交卷后持久化一次
  const persistedRef = useRef(false)
  useEffect(() => {
    if (!state.submitted || persistedRef.current) return
    persistedRef.current = true
    if (!result) return
    const singleCorrect = state.paper.singles.filter((q) => state.results[q.id] === true).length
    const shortMastered = state.paper.shorts.filter((q) => state.results[q.id] === true).length
    const essayMastered = state.paper.essays.filter((q) => state.results[q.id] === true).length
    userDataRepository.addExamRecord({
      id: `exam-${Date.now()}`,
      date: new Date().toISOString(),
      score: result.score,
      total: result.total,
      detail: [
        `single ${singleCorrect}/${state.paper.singles.length}`,
        `short ${shortMastered}/${state.paper.shorts.length}`,
        `essay ${essayMastered}/${state.paper.essays.length}`,
      ],
    })
  }, [state.submitted, state.paper, state.results, result])

  const select = useCallback((id: string, answer: string | string[]) => {
    dispatch({ type: 'select', id, answer })
  }, [])

  const submit = useCallback((id: string, answer: string | string[]): boolean => {
    ensureCheckIn()
    const q = questionRepository.getById(id)
    const correct = q ? judgeObjective(q, answer) : false
    dispatch({ type: 'submit', id, result: correct })
    return correct
  }, [ensureCheckIn])

  const reveal = useCallback((id: string) => dispatch({ type: 'reveal', id }), [])

  const assess = useCallback((id: string, mastered: boolean) => {
    ensureCheckIn()
    dispatch({ type: 'assess', id, mastered })
  }, [ensureCheckIn])

  const next = useCallback(() => dispatch({ type: 'next' }), [])
  const prev = useCallback(() => dispatch({ type: 'prev' }), [])
  const goto = useCallback((index: number) => dispatch({ type: 'goto', index }), [])
  const submitExam = useCallback(() => dispatch({ type: 'submitExam' }), [])

  const restart = useCallback(() => {
    persistedRef.current = false
    dispatch({ type: 'restart', paper: buildExamPaper(questionRepository, config), remainingSeconds: config.durationSeconds })
  }, [config])

  const current = state.questions[state.index]

  return {
    current,
    index: state.index,
    total: state.questions.length,
    questions: state.questions,
    paper: state.paper,
    answers: state.answers,
    results: state.results,
    revealed: state.revealed,
    remainingSeconds: state.remainingSeconds,
    submitted: state.submitted,
    autoSubmitted: state.autoSubmitted,
    result,
    select,
    submit,
    reveal,
    assess,
    next,
    prev,
    goto,
    submitExam,
    restart,
  }
}

export type ExamSession = ReturnType<typeof useExamSession>
