/**
 * 收藏状态 hook：读取/切换某题的收藏状态，切换后同步持久化。
 */
import { useCallback, useEffect, useState } from 'react'
import { userDataRepository } from '../repositories'

export function useFavorite(id: string | undefined) {
  const [fav, setFav] = useState(false)

  useEffect(() => {
    setFav(id ? userDataRepository.isFavorite(id) : false)
  }, [id])

  const toggle = useCallback((): boolean => {
    if (!id) return false
    const next = userDataRepository.toggleFavorite(id)
    setFav(next)
    return next
  }, [id])

  return { fav, toggle }
}
