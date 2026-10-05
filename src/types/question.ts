/**
 * 题库领域模型（与 schema/question.schema.json 对齐）。
 * 题目题干、选项、答案、解析等内容始终为中文，不参与 i18n。
 */

export type QuestionType = 'single' | 'short_answer' | 'essay'

export type SourceKind = 'exam' | 'chapter_exercise' | 'notes'

export type Difficulty = 1 | 2 | 3 | 4 | 5

export interface QuestionSource {
  kind: SourceKind
  /** 真题考期（exam 专用，如 "2410"） */
  year?: string
  /** 来源文件名 */
  file?: string
  /** 来源位置 */
  page?: number
}

export interface Question {
  /** 全局唯一、稳定，如 15043-2410-single-1 */
  id: string
  type: QuestionType
  /** 章节，如 第一章 */
  chapter: string
  /** 知识点（可选，用于专项练习） */
  knowledgePoint?: string
  difficulty: Difficulty
  /** 题干 */
  stem: string
  /** 仅 single：选项数组 */
  options?: string[]
  /** 仅 single：正确选项字母，如 "A" */
  answer?: string
  /** 仅 short_answer / essay：参考答案全文 */
  referenceAnswer?: string
  /** 解析 / 考点说明（可选） */
  explanation?: string
  source: QuestionSource
  /** 标签，如 ["鸦片战争", "南京条约"] */
  tags?: string[]
}

/** 题库元信息（由 tools/generate/bundle.cjs 生成） */
export interface BankMeta {
  subjectCode: string
  subject: string
  version: string
  generatedAt: string
  /** 参与打包的 source 文件（相对项目根目录） */
  sourceFiles: string[]
  /** 按教材顺序排序的章节名 */
  chapters: string[]
  counts: Record<QuestionType | 'total', number>
}
