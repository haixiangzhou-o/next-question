/**
 * 题库数据访问层：只读查询接口 + 本地静态数据实现。
 * 业务层只依赖 QuestionRepository 接口，二期若远程加载题库，可替换实现。
 */
import type { Question, QuestionType, SourceKind, Difficulty } from '../types/question'
import { questions } from '../data'

export interface QuestionQuery {
  /** 按 id 精确匹配 */
  ids?: string[]
  /** 排除的 id */
  excludeIds?: string[]
  types?: QuestionType[]
  chapters?: string[]
  knowledgePoints?: string[]
  difficulties?: Difficulty[]
  sourceKinds?: SourceKind[]
  /** 真题考期（如 2410），仅 exam 来源有 */
  years?: string[]
  tags?: string[]
  limit?: number
  offset?: number
}

export interface QuestionRepository {
  readonly total: number
  getById(id: string): Question | undefined
  getByIds(ids: string[]): Question[]
  list(query?: QuestionQuery): Question[]
  count(query?: QuestionQuery): number
  listChapters(): string[]
  listKnowledgePoints(chapter?: string): string[]
  listTags(): string[]
  listYears(): string[]
}

const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

/** 章节名 -> 排序值（第一~十章；无法识别时排最后） */
function chapterRank(chapter: string): number {
  const m = /^第([一二三四五六七八九十]+)章$/.exec(chapter || '')
  if (!m) return Number.MAX_SAFE_INTEGER
  const s = m[1]
  if (s.length === 1) return CN_NUM[s] != null ? CN_NUM[s] : 999
  if (s === '十') return 10
  if (s[0] === '十') return 10 + (CN_NUM[s[1]] || 0)
  if (s[1] === '十') return (CN_NUM[s[0]] || 0) * 10
  return 999
}

export class LocalQuestionRepository implements QuestionRepository {
  private readonly all: Question[]
  private readonly byId: Map<string, Question>
  private readonly chapterOrder: string[]

  constructor(source: Question[] = questions) {
    this.all = source
    this.byId = new Map(source.map((q) => [q.id, q]))
    this.chapterOrder = [...new Set(source.map((q) => q.chapter))]
      .sort((a, b) => chapterRank(a) - chapterRank(b))
  }

  get total(): number {
    return this.all.length
  }

  getById(id: string): Question | undefined {
    return this.byId.get(id)
  }

  getByIds(ids: string[]): Question[] {
    const out: Question[] = []
    for (const id of ids) {
      const q = this.byId.get(id)
      if (q) out.push(q)
    }
    return out
  }

  list(query: QuestionQuery = {}): Question[] {
    let result = this.all

    if (query.ids) {
      const set = new Set(query.ids)
      result = result.filter((q) => set.has(q.id))
    }
    if (query.excludeIds) {
      const set = new Set(query.excludeIds)
      result = result.filter((q) => !set.has(q.id))
    }
    if (query.types) {
      const set = new Set(query.types)
      result = result.filter((q) => set.has(q.type))
    }
    if (query.chapters) {
      const set = new Set(query.chapters)
      result = result.filter((q) => set.has(q.chapter))
    }
    if (query.difficulties) {
      const set = new Set(query.difficulties)
      result = result.filter((q) => set.has(q.difficulty))
    }
    if (query.sourceKinds) {
      const set = new Set(query.sourceKinds)
      result = result.filter((q) => set.has(q.source.kind))
    }
    if (query.years) {
      const set = new Set(query.years)
      result = result.filter((q) => q.source.year != null && set.has(q.source.year))
    }
    if (query.knowledgePoints) {
      const set = new Set(query.knowledgePoints)
      result = result.filter((q) => q.knowledgePoint != null && set.has(q.knowledgePoint))
    }
    if (query.tags) {
      const set = new Set(query.tags)
      result = result.filter((q) => q.tags != null && q.tags.some((t) => set.has(t)))
    }

    if (query.offset) result = result.slice(query.offset)
    if (query.limit != null) result = result.slice(0, query.limit)
    return result
  }

  count(query: QuestionQuery = {}): number {
    return this.list(query).length
  }

  listChapters(): string[] {
    return [...this.chapterOrder]
  }

  listKnowledgePoints(chapter?: string): string[] {
    const set = new Set<string>()
    for (const q of this.all) {
      if (q.knowledgePoint && (!chapter || q.chapter === chapter)) set.add(q.knowledgePoint)
    }
    return [...set]
  }

  listTags(): string[] {
    const set = new Set<string>()
    for (const q of this.all) {
      if (q.tags) q.tags.forEach((t) => set.add(t))
    }
    return [...set]
  }

  listYears(): string[] {
    const set = new Set<string>()
    for (const q of this.all) {
      if (q.source.year) set.add(q.source.year)
    }
    return [...set].sort()
  }
}
