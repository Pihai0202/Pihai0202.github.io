import React, { useState, useEffect, useRef } from 'react'

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode
}

export function LazyImage({ src, alt, fallback, ...props }: LazyImageProps) {
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    setHasError(false)
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

  if (!src || hasError) {
    return <>{fallback || null}</>
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      {...props}
    />
  )
}
