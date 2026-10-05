/**
 * 数据访问层统一出口：类型 + 接口 + 默认实现单例。
 */
import type { QuestionRepository } from './QuestionRepository'
import type { UserDataRepository } from './UserDataRepository'
import { LocalQuestionRepository } from './QuestionRepository'
import { StorageUserDataRepository } from './UserDataRepository'

export * from './QuestionRepository'
export * from './UserDataRepository'

/** 题库只读查询（本地静态数据） */
export const questionRepository: QuestionRepository = new LocalQuestionRepository()

/** 用户本地数据（Taro Storage 持久化） */
export const userDataRepository: UserDataRepository = new StorageUserDataRepository()
