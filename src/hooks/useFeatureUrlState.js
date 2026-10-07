import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isFeatureEnabled } from '../lib/features'

/**
 * Estado persistido en la URL, pero solo si la feature que lo pide está
 * prendida en src/lib/features.ts — si está apagada, cae a un useState
 * local normal (el comportamiento de antes de la feature, sin tocar la
 * URL). `featureKey` no cambia en la vida de la app (es estático), así
 * que alternar entre los dos caminos de abajo nunca rompe el orden de
 * hooks de React.
 */
export function useFeatureUrlState(featureKey, paramKey, defaultValue) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [localValue, setLocalValue] = useState(defaultValue)

  if (!isFeatureEnabled(featureKey)) {
    return [localValue, setLocalValue]
  }

  const value = searchParams.get(paramKey) ?? defaultValue
  const setValue = (v) => setSearchParams((prev) => {
    const next = new URLSearchParams(prev)
    v === defaultValue ? next.delete(paramKey) : next.set(paramKey, v)
    return next
  }, { replace: true })
  return [value, setValue]
}
