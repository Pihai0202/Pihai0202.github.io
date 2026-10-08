import React, { useState, useEffect, useRef } from 'react'

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode
}

export function LazyImage({ src, alt, fallback, ...props }: LazyImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src)
  const [hasError, setHasError] = useState(false)
  const [triedFallback, setTriedFallback] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setCurrentSrc(src)
    setHasError(false)
    setTriedFallback(false)
  }, [src])

  useEffect(() => {
    return () => {
      // Force memory release on unmount by setting src to a tiny transparent data URL
      if (imgRef.current) {
        try {
          imgRef.current.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        } catch (e) {
          console.warn('Failed to clear image src on unmount:', e)
        }
      }
    }
  }, [])

  const handleError = () => {
    if (!triedFallback && currentSrc && currentSrc.startsWith('/') && !currentSrc.startsWith('//')) {
      setTriedFallback(true)
      setCurrentSrc(`https://raw.githubusercontent.com/Pihai0202/Pihai0202.github.io/main/public${currentSrc}`)
    } else {
      setHasError(true)
    }
  }

  if (!currentSrc || hasError) {
    return <>{fallback || null}</>
  }

  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={handleError}
      {...props}
    />
  )
}
