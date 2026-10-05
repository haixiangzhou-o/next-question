/**
 * 刷题会话纯逻辑：抽题、洗牌、判分。
 * 不依赖 React / Taro，可独立单元测试。
 */
import type { Question, QuestionType } from '../types/question'
import type { QuestionQuery, QuestionRepository } from '../repositories/QuestionRepository'

export type PracticeMode = 'sequential' | 'random' | 'targeted' | 'memorize'

export interface PracticeOptions {
  mode: PracticeMode
  /** 章节范围（专项/随机/背题可选） */
  chapter?: string
  /** 题型范围（专项可选） */
  type?: QuestionType
}

/** Fisher-Yates 洗牌，返回新数组 */
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

/** 客观题（单选）判分 */
export function judgeObjective(question: Question, answer: string | string[]): boolean {
  if (question.type !== 'single') return false
  return question.answer === answer
}

/** 按章节顺序（repository.listChapters 顺序）稳定排序 */
function sortByChapter(qs: Question[], repo: QuestionRepository): Question[] {
  const order = new Map(repo.listChapters().map((c, i) => [c, i]))
  return qs
    .map((q, i) => ({ q, i }))
    .sort((a, b) => {
      const da = order.get(a.q.chapter) ?? 999
      const db = order.get(b.q.chapter) ?? 999
      return da - db || a.i - b.i
    })
    .map((x) => x.q)
}

/** 根据练习模式与范围构建题目列表 */
export function buildPracticeQuestions(repo: QuestionRepository, options: PracticeOptions): Question[] {
  switch (options.mode) {
    case 'random': {
      const query: QuestionQuery = options.chapter ? { chapters: [options.chapter] } : {}
      return shuffle(repo.list(query))
    }
    case 'targeted': {
      const query: QuestionQuery = {}
      if (options.chapter) query.chapters = [options.chapter]
      if (options.type) query.types = [options.type]
      return sortByChapter(repo.list(query), repo)
    }
    case 'memorize': {
      const query: QuestionQuery = { types: ['short_answer', 'essay'] }
      if (options.chapter) query.chapters = [options.chapter]
      return sortByChapter(repo.list(query), repo)
    }
    case 'sequential':
    default:
      return sortByChapter(repo.list(), repo)
  }
}
