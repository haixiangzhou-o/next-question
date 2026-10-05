/**
 * 组卷 / 判分 / 计分纯逻辑（对齐自考 15043 试卷结构）。
 * 不依赖 React / Taro，可独立单元测试。
 */
import type { Question } from '../types/question'
import type { QuestionRepository } from '../repositories/QuestionRepository'
import { shuffle } from './practice'

export interface ExamConfig {
  singleCount: number
  shortCount: number
  /** 论述题出题数（15043 为 3 选 2） */
  essayCount: number
  /** 论述题计分题数（选做） */
  essayPick: number
  /** 限时（秒） */
  durationSeconds: number
  singleScore: number
  shortScore: number
  essayScore: number
}

/** 自考 15043 默认规则：单选 25×2 + 简答 5×6 + 论述 3选2×10 = 100 分 */
export const DEFAULT_EXAM_CONFIG: ExamConfig = {
  singleCount: 25,
  shortCount: 5,
  essayCount: 3,
  essayPick: 2,
  durationSeconds: 150 * 60,
  singleScore: 2,
  shortScore: 6,
  essayScore: 10,
}

export interface ExamPaper {
  singles: Question[]
  shorts: Question[]
  essays: Question[]
}

export interface ExamResult {
  score: number
  total: number
  singleEarned: number
  singleTotal: number
  shortEarned: number
  shortTotal: number
  essayEarned: number
  essayTotal: number
  /** 单选正确率 0–1 */
  singleAccuracy: number
}

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.max(0, n))
}

/** 按题型随机组卷（题量不足时取全部，需在调用方兜底提示） */
export function buildExamPaper(repo: QuestionRepository, config: ExamConfig = DEFAULT_EXAM_CONFIG): ExamPaper {
  return {
    singles: sample(repo.list({ types: ['single'] }), config.singleCount),
    shorts: sample(repo.list({ types: ['short_answer'] }), config.shortCount),
    essays: sample(repo.list({ types: ['essay'] }), config.essayCount),
  }
}

export function flattenPaper(paper: ExamPaper): Question[] {
  return [...paper.singles, ...paper.shorts, ...paper.essays]
}

/**
 * 计分。results 中 true = 客观题答对 / 主观题自评「掌握」。
 * 论述题按「N 选 M」取掌握的前 M 题计分。
 */
export function scoreExam(paper: ExamPaper, results: Record<string, boolean>, config: ExamConfig = DEFAULT_EXAM_CONFIG): ExamResult {
  const singleEarned = paper.singles.filter((q) => results[q.id] === true).length * config.singleScore
  const singleTotal = paper.singles.length * config.singleScore
  const shortEarned = paper.shorts.filter((q) => results[q.id] === true).length * config.shortScore
  const shortTotal = paper.shorts.length * config.shortScore
  const essayMastered = paper.essays.filter((q) => results[q.id] === true).length
  const essayCounted = Math.min(essayMastered, config.essayPick)
  const essayEarned = essayCounted * config.essayScore
  const essayTotal = config.essayPick * config.essayScore

  const score = singleEarned + shortEarned + essayEarned
  const total = singleTotal + shortTotal + essayTotal
  const singleAccuracy = singleTotal > 0 ? singleEarned / singleTotal : 0

  return {
    score,
    total,
    singleEarned,
    singleTotal,
    shortEarned,
    shortTotal,
    essayEarned,
    essayTotal,
    singleAccuracy,
  }
}

/** 秒 -> h:mm:ss 或 mm:ss */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
