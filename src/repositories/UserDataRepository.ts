/**
 * 用户数据访问层：Taro Storage 持久化实现。
 * 业务层只依赖 UserDataRepository 接口，二期接入云开发时替换实现即可。
 *
 * 说明：
 * - 懒加载：首次真正读写时才访问 Taro Storage，避免模块加载期副作用。
 * - stats.byChapter（各章节刷题数/正确率）依赖题目章节信息，
 *   由统计服务在拥有题库访问能力时统一计算，本层仅做原始 CRUD。
 */
import Taro from '@tarojs/taro'
import type { UserData, AnswerRecord, ExamRecord, CheckIn } from '../types/userData'

const STORAGE_KEY = 'next_question_user_data'

export interface UserDataRepository {
  /** 返回当前用户数据的深拷贝（用于渲染/读取） */
  snapshot(): UserData
  reset(): void
  getProgress(id: string): AnswerRecord | undefined
  /** 记录客观题作答（单选判分），更新 progress + 错题本 + 客观题统计 */
  recordAnswer(id: string, answer: string | string[], correct: boolean): void
  /** 记录主观题自评（掌握/未掌握），更新 progress + 错题本 + 掌握数 */
  recordMemorization(id: string, mastered: boolean): void
  isWrong(id: string): boolean
  addWrong(id: string): void
  removeWrong(id: string): void
  isFavorite(id: string): boolean
  /** 切换收藏，返回切换后是否已收藏 */
  toggleFavorite(id: string): boolean
  getCheckIn(): CheckIn
  /** 每日打卡，返回当前连续天数 */
  checkInToday(): number
  addExamRecord(record: ExamRecord): void
  getExamHistory(): ExamRecord[]
  clearExamHistory(): void
}

function emptyUserData(): UserData {
  return {
    progress: {},
    wrongBook: [],
    favorites: [],
    stats: { totalAnswered: 0, totalCorrect: 0, memorized: 0, byChapter: {} },
    checkIn: { lastDate: '', streak: 0, totalDays: 0 },
    examHistory: [],
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function today(): string {
  return formatDate(new Date())
}

function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 容错读取：填充缺失字段，避免历史/损坏数据导致运行时崩溃 */
function normalize(raw: unknown): UserData {
  if (!raw || typeof raw !== 'object') return emptyUserData()
  const data = raw as Partial<UserData>
  return {
    progress: data.progress && typeof data.progress === 'object' ? data.progress : {},
    wrongBook: Array.isArray(data.wrongBook) ? data.wrongBook : [],
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    stats: {
      totalAnswered: data.stats?.totalAnswered ?? 0,
      totalCorrect: data.stats?.totalCorrect ?? 0,
      memorized: data.stats?.memorized ?? 0,
      byChapter: data.stats?.byChapter && typeof data.stats.byChapter === 'object' ? data.stats.byChapter : {},
    },
    checkIn: {
      lastDate: data.checkIn?.lastDate ?? '',
      streak: data.checkIn?.streak ?? 0,
      totalDays: data.checkIn?.totalDays ?? 0,
    },
    examHistory: Array.isArray(data.examHistory) ? data.examHistory : [],
  }
}

export class StorageUserDataRepository implements UserDataRepository {
  private _data: UserData | null = null

  /** 懒加载：首次访问时才读 Storage */
  private get data(): UserData {
    if (this._data === null) this._data = this.load()
    return this._data
  }

  private load(): UserData {
    try {
      const raw = Taro.getStorageSync(STORAGE_KEY)
      return normalize(raw)
    } catch (e) {
      return emptyUserData()
    }
  }

  private persist(): void {
    if (this._data === null) return
    try {
      Taro.setStorageSync(STORAGE_KEY, this._data)
    } catch (e) {
      // 存储失败不阻断流程（如容量超限），静默降级
    }
  }

  private addWrongLocal(id: string): void {
    if (!this.data.wrongBook.includes(id)) this.data.wrongBook.push(id)
  }

  private removeWrongLocal(id: string): void {
    const i = this.data.wrongBook.indexOf(id)
    if (i >= 0) this.data.wrongBook.splice(i, 1)
  }

  snapshot(): UserData {
    return clone(this.data)
  }

  reset(): void {
    this._data = emptyUserData()
    this.persist()
  }

  getProgress(id: string): AnswerRecord | undefined {
    return this.data.progress[id]
  }

  recordAnswer(id: string, answer: string | string[], correct: boolean): void {
    const prev = this.data.progress[id]
    const first = !prev || !prev.answered
    this.data.progress[id] = {
      answered: true,
      correct,
      lastAnswer: answer,
      times: (prev ? prev.times : 0) + 1,
    }
    if (correct) this.removeWrongLocal(id)
    else this.addWrongLocal(id)

    const stats = this.data.stats
    if (first) stats.totalAnswered += 1
    if (correct && (!prev || !prev.correct)) stats.totalCorrect += 1
    if (!correct && prev && prev.correct) stats.totalCorrect = Math.max(0, stats.totalCorrect - 1)
    this.persist()
  }

  recordMemorization(id: string, mastered: boolean): void {
    const prev = this.data.progress[id]
    this.data.progress[id] = {
      answered: true,
      correct: mastered,
      lastAnswer: mastered ? 'mastered' : 'unmastered',
      times: (prev ? prev.times : 0) + 1,
    }
    if (mastered) this.removeWrongLocal(id)
    else this.addWrongLocal(id)

    const stats = this.data.stats
    if (mastered && (!prev || !prev.correct)) stats.memorized += 1
    if (!mastered && prev && prev.correct) stats.memorized = Math.max(0, stats.memorized - 1)
    this.persist()
  }

  isWrong(id: string): boolean {
    return this.data.wrongBook.includes(id)
  }

  addWrong(id: string): void {
    this.addWrongLocal(id)
    this.persist()
  }

  removeWrong(id: string): void {
    this.removeWrongLocal(id)
    this.persist()
  }

  isFavorite(id: string): boolean {
    return this.data.favorites.includes(id)
  }

  toggleFavorite(id: string): boolean {
    const i = this.data.favorites.indexOf(id)
    if (i >= 0) {
      this.data.favorites.splice(i, 1)
      this.persist()
      return false
    }
    this.data.favorites.push(id)
    this.persist()
    return true
  }

  getCheckIn(): CheckIn {
    return { ...this.data.checkIn }
  }

  checkInToday(): number {
    const c = this.data.checkIn
    if (c.lastDate === today()) return c.streak
    c.streak = c.lastDate === yesterday() ? c.streak + 1 : 1
    c.lastDate = today()
    c.totalDays += 1
    this.persist()
    return c.streak
  }

  addExamRecord(record: ExamRecord): void {
    this.data.examHistory.push(record)
    this.persist()
  }

  getExamHistory(): ExamRecord[] {
    return this.data.examHistory.slice()
  }

  clearExamHistory(): void {
    this.data.examHistory = []
    this.persist()
  }
}
