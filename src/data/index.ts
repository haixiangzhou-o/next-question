/**
 * 打包进小程序的题库数据入口。
 * 数据由 tools/generate/bundle.cjs 从 question-bank/ 自动生成，
 * 如需拆分子包，仅需在此处调整导入来源。
 */
export { questions, bankMeta } from './questions'
