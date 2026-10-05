/**
 * 学习统计纯逻辑：从 progress 推导刷题量、正确率、各章节正确率、薄弱章节。
 * 不依赖 React / Taro，可独立单元测试。
 */
import type { QuestionRepository } from '../repositories/QuestionRepository'
import type { UserData } from '../types/userData'

export interface ChapterStat {
  chapter: string
  answered: number
  correct: number
  /** 0–1，未作答为 0 */
  accuracy: number
}

export interface StatsReport {
  /** 客观题已答数 */
  totalAnswered: number
  /** 客观题答对数 */
  totalCorrect: number
  /** 主观题自评「掌握」数 */
  memorized: number
  /** 客观题正确率 0–1 */
  accuracy: number
  bankTotal: number
  chapters: ChapterStat[]
  /** 正确率低于阈值的章节，按正确率升序（最薄弱在前） */
  weakChapters: string[]
}

const WEAK_THRESHOLD = 0.6

export function computeStats(repo: QuestionRepository, progress: UserData['progress']): StatsReport {
  let totalAnswered = 0
  let totalCorrect = 0
  const byChapter = new Map<string, { answered: number; correct: number }>()

  for (const q of repo.list({ types: ['single'] })) {
    const rec = progress[q.id]
    const cs = byChapter.get(q.chapter) ?? { answered: 0, correct: 0 }
    if (rec && rec.answered) {
      totalAnswered += 1
      cs.answered += 1
    }
    if (rec && rec.correct) {
      totalCorrect += 1
      cs.correct += 1
    }
    byChapter.set(q.chapter, cs)
  }

  let memorized = 0
  for (const q of repo.list({ types: ['short_answer', 'essay'] })) {
    if (progress[q.id] && progress[q.id].correct) memorized += 1
  }

  const chapters = repo.listChapters().map((chapter) => {
    const cs = byChapter.get(chapter) ?? { answered: 0, correct: 0 }
    return {
      chapter,
      answered: cs.answered,
      correct: cs.correct,
      accuracy: cs.answered > 0 ? cs.correct / cs.answered : 0,
    }
  })

  const weakChapters = chapters
    .filter((c) => c.answered > 0 && c.accuracy < WEAK_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((c) => c.chapter)

  return {
    totalAnswered,
    totalCorrect,
    memorized,
    accuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
    bankTotal: repo.total,
    chapters,
    weakChapters,
  }
}
