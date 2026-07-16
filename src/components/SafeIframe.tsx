import React, { useEffect, useRef } from 'react'

export interface SafeIframeProps extends React.IframeHTMLAttributes<HTMLIFrameElement> {}

export const SafeIframe: React.FC<SafeIframeProps> = (props) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    return () => {
      // Force memory release on unmount by clearing src to about:blank
      if (iframeRef.current) {
        try {
          iframeRef.current.src = 'about:blank'
        } catch (e) {
          console.warn('Failed to clear iframe src on unmount:', e)
        }
      }
    }
  }, [])

  return <iframe ref={iframeRef} {...props} />
}
