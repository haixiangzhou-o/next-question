#!/usr/bin/env node
/**
 * 题库打包脚本：把 question-bank/ 下的结构化 JSON 合并为 src/data/questions.ts，
 * 供小程序直接打包使用（MVP 单包，纯文字题量可控）。
 *
 * 用法：
 *   node tools/generate/bundle.cjs
 *
 * 步骤：
 *   1. 读取 question-bank/exam/*.json、chapters/*.json、notes/*.json
 *   2. 逐题校验（id 唯一、字段完整、题型/答案匹配）
 *   3. 归一化空字段（空串 -> 省略，减小包体）
 *   4. 生成 src/data/questions.ts（含 bankMeta + questions）
 *   5. 打印统计
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const BANK_DIR = path.join(ROOT, 'question-bank')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'questions.ts')

const QUESTION_TYPES = new Set(['single', 'short_answer', 'essay'])
const SOURCE_KINDS = new Set(['exam', 'chapter_exercise', 'notes'])

/** 章节中文数字 -> 数值，用于排序（第一~十章） */
const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }

function chapterRank(chapter) {
  const m = /^第([一二三四五六七八九十]+)章$/.exec(chapter || '')
  if (!m) return Number.MAX_SAFE_INTEGER
  const s = m[1]
  if (s.length === 1) return CN_NUM[s] != null ? CN_NUM[s] : 999
  if (s === '十') return 10
  if (s[0] === '十') return 10 + (CN_NUM[s[1]] || 0)
  if (s[1] === '十') return (CN_NUM[s[0]] || 0) * 10
  return 999
}

function collectBanks() {
  const dirs = ['exam', 'chapters', 'notes'].map((d) => path.join(BANK_DIR, d))
  const files = []
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir).sort()) {
      if (name.endsWith('.json')) files.push(path.join(dir, name))
    }
  }
  return files
}

/** 归一化：删除空字符串 / 空数组等冗余字段 */
function normalizeQuestion(q) {
  const out = { ...q }
  for (const k of ['knowledgePoint', 'explanation']) {
    if (out[k] === '' || out[k] == null) delete out[k]
  }
  if (Array.isArray(out.tags) && out.tags.length === 0) delete out.tags
  if (out.source && typeof out.source === 'object') {
    const src = { ...out.source }
    if (src.year === '' || src.year == null) delete src.year
    if (src.file === '' || src.file == null) delete src.file
    out.source = src
  }
  return out
}

function validateQuestion(q, loc) {
  if (!q || typeof q !== 'object') return [`${loc} 不是对象`]
  const errors = []
  if (!q.id || typeof q.id !== 'string') errors.push(`${loc} 缺 id`)
  if (!QUESTION_TYPES.has(q.type)) errors.push(`${loc} 未知题型: ${q.type}`)
  if (!q.chapter || typeof q.chapter !== 'string') errors.push(`${loc} 缺 chapter`)
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) {
    errors.push(`${loc} difficulty 非法: ${q.difficulty}`)
  }
  if (!q.stem || typeof q.stem !== 'string') errors.push(`${loc} 缺 stem`)
  if (q.type === 'single') {
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${loc} single 缺 options 或少于 2 项`)
    if (!q.answer) errors.push(`${loc} single 缺 answer`)
  } else {
    if (!q.referenceAnswer) errors.push(`${loc} ${q.type} 缺 referenceAnswer`)
  }
  if (!q.source || !SOURCE_KINDS.has(q.source.kind)) errors.push(`${loc} 缺 source.kind`)
  return errors
}

function main() {
  const files = collectBanks()
  if (files.length === 0) {
    console.error('未找到题库 JSON，请确认 question-bank/ 存在有效数据。')
    process.exit(1)
  }

  const questions = []
  const seenIds = new Set()
  const sourceFiles = []
  const counts = { total: 0, single: 0, short_answer: 0, essay: 0 }
  const chapters = new Set()
  let errorCount = 0

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/')
    let data
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      console.error(`[失败] ${rel}: JSON 解析失败 - ${e.message}`)
      errorCount++
      continue
    }
    const qs = Array.isArray(data) ? data : data.questions
    if (!Array.isArray(qs)) {
      console.error(`[失败] ${rel}: 既不是数组也不是 {questions}`)
      errorCount++
      continue
    }

    sourceFiles.push(rel)
    qs.forEach((q, i) => {
      const loc = `${path.basename(file)}[${i}]`
      const errs = validateQuestion(q, loc)
      if (errs.length) {
        errorCount += errs.length
        errs.forEach((e) => console.error(`  - ${e}`))
        return
      }
      if (seenIds.has(q.id)) {
        console.error(`  - ${loc} id 重复: ${q.id}`)
        errorCount++
        return
      }
      seenIds.add(q.id)
      const norm = normalizeQuestion(q)
      questions.push(norm)
      counts[norm.type]++
      counts.total++
      chapters.add(norm.chapter)
    })
  }

  if (errorCount > 0) {
    console.error(`\n校验失败：${errorCount} 个错误，未生成文件。`)
    process.exit(1)
  }

  const orderedChapters = [...chapters].sort((a, b) => chapterRank(a) - chapterRank(b))

  const meta = {
    subjectCode: '15043',
    subject: '中国近现代史纲要',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceFiles,
    chapters: orderedChapters,
    counts,
  }

  const header = `// 此文件由 tools/generate/bundle.cjs 自动生成，请勿手动编辑。
// 重新生成：pnpm gen:data
import type { Question, BankMeta } from '../types/question'

export const bankMeta: BankMeta = ${JSON.stringify(meta, null, 2)}

export const questions: Question[] = ${JSON.stringify(questions, null, 2)}
`

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  fs.writeFileSync(OUT_FILE, header, 'utf8')

  console.log(`打包完成: ${counts.total} 题 -> ${path.relative(ROOT, OUT_FILE)}`)
  console.log(`  单选 ${counts.single} / 简答 ${counts.short_answer} / 论述 ${counts.essay}`)
  console.log(`  章节: ${orderedChapters.join('、')}`)
}

main()
