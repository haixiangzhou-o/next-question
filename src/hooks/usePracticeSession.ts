/**
 * 刷题会话 hook：用 useReducer 轻量管理当前会话进度。
 * - 状态：题目列表、当前题号、作答、判分结果、参考答案展开、是否结束
 * - 副作用：提交/自评时通过 userDataRepository 持久化到本机
 * - 顺序/随机练习的会话进度写入 Storage，退出重进自动恢复
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { Question } from '../types/question'
import { questionRepository, userDataRepository } from '../repositories'
import { buildPracticeQuestions, judgeObjective, type PracticeOptions, type PracticeMode } from '../services/practice'
import { clearPracticeSession, loadPracticeSession, savePracticeSession } from '../services/session'

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

/** 需要保存并恢复进度的练习模式 */
const PERSISTED_MODES: PracticeMode[] = ['sequential', 'random']

function freshState(questions: Question[]): SessionState {
  return { questions, index: 0, answers: {}, results: {}, revealed: {}, finished: false }
}

function initSession(options: PracticeOptions): SessionState {
  if (PERSISTED_MODES.includes(options.mode)) {
    const saved = loadPracticeSession(options.mode)
    if (saved && saved.chapter === options.chapter) {
      const questions = questionRepository.getByIds(saved.ids)
      if (questions.length > 0 && questions.length === saved.ids.length) {
        return {
          questions,
          index: Math.min(Math.max(saved.index, 0), questions.length - 1),
          answers: saved.answers,
          results: saved.results,
          revealed: saved.revealed,
          finished: false,
        }
      }
    }
  }
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
  const { mode, chapter } = options

  // 每日首次作答时打卡一次
  const checkInRef = useRef(false)
  const ensureCheckIn = useCallback(() => {
    if (!checkInRef.current) {
      checkInRef.current = true
      userDataRepository.checkInToday()
    }
  }, [])

  // 顺序/随机练习：随作答进度持久化，退出重进恢复；完成后清除，下次从头开始
  useEffect(() => {
    if (!PERSISTED_MODES.includes(mode)) return
    if (state.finished) {
      clearPracticeSession(mode)
      return
    }
    savePracticeSession({
      mode,
      chapter,
      ids: state.questions.map((q) => q.id),
      index: state.index,
      answers: state.answers,
      results: state.results,
      revealed: state.revealed,
    })
  }, [mode, chapter, state])

  const select = useCallback((id: string, answer: string | string[]) => {
    dispatch({ type: 'select', id, answer })
  }, [])

  /** 提交客观题作答并判分，返回是否正确 */
  const submit = useCallback((id: string, answer: string | string[]): boolean => {
    ensureCheckIn()
    const q = questionRepository.getById(id)
    const correct = q ? judgeObjective(q, answer) : false
    dispatch({ type: 'submit', id, result: correct })
    userDataRepository.recordAnswer(id, answer, correct)
    return correct
  }, [ensureCheckIn])

  const reveal = useCallback((id: string) => {
    dispatch({ type: 'reveal', id })
  }, [])

  /** 主观题自评掌握/未掌握 */
  const assess = useCallback((id: string, mastered: boolean) => {
    ensureCheckIn()
    dispatch({ type: 'assess', id, mastered })
    userDataRepository.recordMemorization(id, mastered)
  }, [ensureCheckIn])

  const next = useCallback(() => dispatch({ type: 'next' }), [])
  const prev = useCallback(() => dispatch({ type: 'prev' }), [])

  const restart = useCallback(() => {
    // 错题重做模式重启时重新读取最新错题列表（作答后错题可能已移除）
    const ids = mode === 'wrong' ? userDataRepository.snapshot().wrongBook : options.ids
    dispatch({ type: 'restart', questions: buildPracticeQuestions(questionRepository, { ...options, ids }) })
  }, [mode, chapter, options.type, options.ids])

  const clearProgress = useCallback(() => {
    clearPracticeSession(mode)
  }, [mode])

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
    clearProgress,
  }
}

export type PracticeSession = ReturnType<typeof usePracticeSession>
