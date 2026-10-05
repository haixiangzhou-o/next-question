/**
 * 用户本地数据模型（Taro Storage 持久化，与 PLAN.md §4.4 对齐）。
 * 仅存本机，MVP 无后端。
 */

export interface AnswerRecord {
  answered: boolean
  /** 客观题判分结果；主观题 = 自评「掌握」 */
  correct: boolean
  /** 客观题作答；主观题存自评标记（如 'mastered' / 'unmastered'） */
  lastAnswer: string | string[]
  times: number
}

export interface ChapterStat {
  answered: number
  correct: number
}

export interface Stats {
  /** 客观题已答数 */
  totalAnswered: number
  /** 客观题答对数 */
  totalCorrect: number
  /** 主观题自评「掌握」数 */
  memorized: number
  byChapter: Record<string, ChapterStat>
}

export interface CheckIn {
  /** 最近一次打卡日期，格式 YYYY-MM-DD */
  lastDate: string
  /** 连续打卡天数 */
  streak: number
  /** 累计打卡天数 */
  totalDays: number
}

export interface ExamRecord {
  id: string
  date: string
  score: number
  total: number
  detail: string[]
}

export interface UserData {
  progress: Record<string, AnswerRecord>
  /** 错题 id 列表（含主观题自评「未掌握」） */
  wrongBook: string[]
  /** 收藏 id 列表 */
  favorites: string[]
  stats: Stats
  checkIn: CheckIn
  examHistory: ExamRecord[]
}
