import { createContext, useContext, useState, ReactNode } from 'react'
import { getLanguage, setLanguage, translate, Locale, Messages } from './index'

interface I18nContextValue {
  lang: Locale
  t: (key: keyof Messages) => string
  setLang: (lang: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(() => getLanguage())

  const setLang = (l: Locale) => {
    setLanguage(l)
    setLangState(l)
  }

  const t = (key: keyof Messages) => translate(lang, key)

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
