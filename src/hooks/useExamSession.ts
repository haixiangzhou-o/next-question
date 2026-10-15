/**
 * 模拟考试会话 hook：useReducer + setInterval 倒计时。
 * - 答题阶段只收集答案（单选选字母、主观题确认答完），不判分、不展示结果
 * - 交卷时自动判分单选题，主观题在成绩报告里自评「掌握/未掌握」计入总分
 * - 考试进度写入 Storage，退出重进恢复；交卷后清除，下次重新组卷
 */
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { Question } from '../types/question'
import { questionRepository, userDataRepository } from '../repositories'
import {
  buildExamPaper,
  flattenPaper,
  scoreExam,
  DEFAULT_EXAM_CONFIG,
  type ExamConfig,
  type ExamPaper,
  type ExamResult,
} from '../services/exam'
import { clearExamSession, loadExamSession, saveExamSession } from '../services/session'

interface ExamState {
  paper: ExamPaper
  questions: Question[]
  index: number
  /** 单选题已选答案（字母） */
  answers: Record<string, string | string[]>
  /** 主观题是否已「确认答完」 */
  subjectiveDone: Record<string, boolean>
  /** 判分结果：单选题交卷时自动判分；主观题在报告中自评 */
  results: Record<string, boolean>
  remainingSeconds: number
  submitted: boolean
  autoSubmitted: boolean
}

type Action =
  | { type: 'select'; id: string; answer: string | string[] }
  | { type: 'confirmSubjective'; id: string; done: boolean }
  | { type: 'assess'; id: string; mastered: boolean }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; index: number }
  | { type: 'tick' }
  | { type: 'submitExam' }
  | { type: 'restart'; paper: ExamPaper; remainingSeconds: number }

function freshExamState(paper: ExamPaper, remainingSeconds: number): ExamState {
  return {
    paper,
    questions: flattenPaper(paper),
    index: 0,
    answers: {},
    subjectiveDone: {},
    results: {},
    remainingSeconds,
    submitted: false,
    autoSubmitted: false,
  }
}

/** 交卷时对单选题自动判分（未作答记为错误） */
function gradeSingles(paper: ExamPaper, answers: Record<string, string | string[]>): Record<string, boolean> {
  const results: Record<string, boolean> = {}
  for (const q of paper.singles) {
    results[q.id] = answers[q.id] === q.answer
  }
  return results
}

function initExam(config: ExamConfig): ExamState {
  const saved = loadExamSession()
  if (saved) {
    const paper: ExamPaper = {
      singles: questionRepository.getByIds(saved.singles),
      shorts: questionRepository.getByIds(saved.shorts),
      essays: questionRepository.getByIds(saved.essays),
    }
    const questions = flattenPaper(paper)
    const totalIds = saved.singles.length + saved.shorts.length + saved.essays.length
    if (questions.length > 0 && questions.length === totalIds) {
      return {
        paper,
        questions,
        index: Math.min(Math.max(saved.index, 0), questions.length - 1),
        answers: saved.answers,
        subjectiveDone: saved.subjectiveDone,
        results: {},
        remainingSeconds: Math.max(0, saved.remainingSeconds),
        submitted: false,
        autoSubmitted: false,
      }
    }
  }
  return freshExamState(buildExamPaper(questionRepository, config), config.durationSeconds)
}

function reducer(state: ExamState, action: Action): ExamState {
  switch (action.type) {
    case 'select':
      return { ...state, answers: { ...state.answers, [action.id]: action.answer } }
    case 'confirmSubjective':
      return { ...state, subjectiveDone: { ...state.subjectiveDone, [action.id]: action.done } }
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
        return {
          ...state,
          remainingSeconds: 0,
          submitted: true,
          autoSubmitted: true,
          results: gradeSingles(state.paper, state.answers),
        }
      }
      return { ...state, remainingSeconds: state.remainingSeconds - 1 }
    case 'submitExam':
      return { ...state, submitted: true, results: gradeSingles(state.paper, state.answers) }
    case 'restart':
      return freshExamState(action.paper, action.remainingSeconds)
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

  // 手动清除进度后，倒计时 tick 仍会触发持久化，用该标记阻止再次写入
  const clearedRef = useRef(false)
  // 成绩是否已保存（写入考试记录）
  const savedRef = useRef(false)

  // 倒计时
  useEffect(() => {
    if (state.submitted) return
    const timer = setInterval(() => dispatch({ type: 'tick' }), 1000)
    return () => clearInterval(timer)
  }, [state.submitted])

  // 考试进度持久化：随作答/倒计时实时保存；交卷后清除，下次重新组卷
  useEffect(() => {
    if (clearedRef.current) return
    if (state.submitted) {
      clearExamSession()
      return
    }
    saveExamSession({
      singles: state.paper.singles.map((q) => q.id),
      shorts: state.paper.shorts.map((q) => q.id),
      essays: state.paper.essays.map((q) => q.id),
      index: state.index,
      answers: state.answers,
      subjectiveDone: state.subjectiveDone,
      remainingSeconds: state.remainingSeconds,
    })
  }, [state])

  const result: ExamResult | null = useMemo(() => {
    if (!state.submitted) return null
    return scoreExam(state.paper, state.results, config)
  }, [state.submitted, state.paper, state.results, config])

  const select = useCallback((id: string, answer: string | string[]) => {
    ensureCheckIn()
    dispatch({ type: 'select', id, answer })
  }, [ensureCheckIn])

  /** 主观题答题阶段「确认答完」/「取消确认」 */
  const confirmSubjective = useCallback((id: string, done: boolean) => {
    ensureCheckIn()
    dispatch({ type: 'confirmSubjective', id, done })
  }, [ensureCheckIn])

  /** 主观题在成绩报告里自评「掌握/未掌握」 */
  const assess = useCallback((id: string, mastered: boolean) => {
    dispatch({ type: 'assess', id, mastered })
  }, [])

  const next = useCallback(() => dispatch({ type: 'next' }), [])
  const prev = useCallback(() => dispatch({ type: 'prev' }), [])
  const goto = useCallback((index: number) => dispatch({ type: 'goto', index }), [])
  const submitExam = useCallback(() => dispatch({ type: 'submitExam' }), [])

  /** 自评完成后保存成绩到考试记录（只保存一次） */
  const saveResult = useCallback(() => {
    if (savedRef.current || !result) return
    savedRef.current = true
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
  }, [result, state.paper, state.results])

  const restart = useCallback(() => {
    savedRef.current = false
    clearedRef.current = false
    dispatch({ type: 'restart', paper: buildExamPaper(questionRepository, config), remainingSeconds: config.durationSeconds })
  }, [config])

  const clearProgress = useCallback(() => {
    clearedRef.current = true
    clearExamSession()
  }, [])

  const current = state.questions[state.index]

  return {
    current,
    index: state.index,
    total: state.questions.length,
    questions: state.questions,
    paper: state.paper,
    answers: state.answers,
    subjectiveDone: state.subjectiveDone,
    results: state.results,
    remainingSeconds: state.remainingSeconds,
    submitted: state.submitted,
    autoSubmitted: state.autoSubmitted,
    result,
    select,
    confirmSubjective,
    assess,
    next,
    prev,
    goto,
    submitExam,
    saveResult,
    restart,
    clearProgress,
  }
}

export type ExamSession = ReturnType<typeof useExamSession>
