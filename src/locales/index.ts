import Taro from '@tarojs/taro'
import { zhCN } from './zh-CN'
import { enUS } from './en-US'

export type Locale = 'zh-CN' | 'en-US'
/**
 * 界面文案表。使用 Record<string, string> 便于随功能自由增删 key，
 * 缺 key 时 t() 回退为 key 本身，避免 locale 文件不同步导致编译失败。
 */
export type Messages = Record<string, string>

const STORAGE_KEY = 'app_language'

export const locales: Record<Locale, Messages> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

export function getSystemLanguage(): Locale {
  try {
    const info = Taro.getSystemInfoSync()
    const lang = (info && info.language) || 'zh_CN'
    return String(lang).toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
  } catch (e) {
    return 'zh-CN'
  }
}

export function getLanguage(): Locale {
  const saved = Taro.getStorageSync(STORAGE_KEY)
  if (saved === 'zh-CN' || saved === 'en-US') return saved
  return getSystemLanguage()
}

export function setLanguage(lang: Locale): void {
  Taro.setStorageSync(STORAGE_KEY, lang)
}

export function translate(lang: Locale, key: string): string {
  return locales[lang][key] ?? String(key)
}
