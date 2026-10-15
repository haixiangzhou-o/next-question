/**
 * 会话进度持久化：把顺序/随机练习与模拟考试的作答进度写入 Taro Storage，
 * 退出重进时恢复，避免每次都从第一题重新开始。
 * - 仅覆盖顺序练习、随机练习与模拟考试
 * - 会话完成后由调用方清除，下次进入重新开始
 */
import Taro from '@tarojs/taro'
import type { PracticeMode } from './practice'

const PRACTICE_SESSION_PREFIX = 'next_question_practice_session'
const EXAM_SESSION_KEY = 'next_question_exam_session'

/** 每个练习模式使用独立的存储 key，进度互不覆盖 */
function practiceSessionKey(mode: PracticeMode): string {
  return `${PRACTICE_SESSION_PREFIX}_${mode}`
}

export interface PracticeSessionSnapshot {
  mode: PracticeMode
  chapter?: string
  /** 有序题目 id 列表（随机模式需保持洗牌后的顺序） */
  ids: string[]
  index: number
  answers: Record<string, string | string[]>
  results: Record<string, boolean>
  revealed: Record<string, boolean>
}

export interface ExamSessionSnapshot {
  singles: string[]
  shorts: string[]
  essays: string[]
  index: number
  /** 单选题已选答案（字母） */
  answers: Record<string, string | string[]>
  /** 主观题是否已「确认答完」 */
  subjectiveDone: Record<string, boolean>
  remainingSeconds: number
}

function read<T>(key: string): T | null {
  try {
    const raw = Taro.getStorageSync(key)
    if (raw == null || raw === '') return null
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    Taro.setStorageSync(key, value)
  } catch {
    // 存储失败静默降级（如容量超限）
  }
}

function remove(key: string): void {
  try {
    Taro.removeStorageSync(key)
  } catch {
    // ignore
  }
}

// ---- 刷题会话 ----

export function savePracticeSession(snap: PracticeSessionSnapshot): void {
  write(practiceSessionKey(snap.mode), snap)
}

export function loadPracticeSession(mode: PracticeMode): PracticeSessionSnapshot | null {
  const s = read<Partial<PracticeSessionSnapshot>>(practiceSessionKey(mode))
  if (!s || !Array.isArray(s.ids) || s.ids.length === 0) return null
  return {
    mode,
    chapter: typeof s.chapter === 'string' ? s.chapter : undefined,
    ids: s.ids,
    index: typeof s.index === 'number' ? s.index : 0,
    answers: s.answers && typeof s.answers === 'object' ? s.answers : {},
    results: s.results && typeof s.results === 'object' ? s.results : {},
    revealed: s.revealed && typeof s.revealed === 'object' ? s.revealed : {},
  }
}

export function clearPracticeSession(mode: PracticeMode): void {
  remove(practiceSessionKey(mode))
}

// ---- 模拟考试会话 ----

export function saveExamSession(snap: ExamSessionSnapshot): void {
  write(EXAM_SESSION_KEY, snap)
}

export function loadExamSession(): ExamSessionSnapshot | null {
  const s = read<Partial<ExamSessionSnapshot>>(EXAM_SESSION_KEY)
  if (!s) return null
  const singles = Array.isArray(s.singles) ? s.singles : []
  const shorts = Array.isArray(s.shorts) ? s.shorts : []
  const essays = Array.isArray(s.essays) ? s.essays : []
  if (singles.length + shorts.length + essays.length === 0) return null
  return {
    singles,
    shorts,
    essays,
    index: typeof s.index === 'number' ? s.index : 0,
    answers: s.answers && typeof s.answers === 'object' ? s.answers : {},
    subjectiveDone: s.subjectiveDone && typeof s.subjectiveDone === 'object' ? s.subjectiveDone : {},
    remainingSeconds: typeof s.remainingSeconds === 'number' ? s.remainingSeconds : 0,
  }
}

export function clearExamSession(): void {
  remove(EXAM_SESSION_KEY)
}
