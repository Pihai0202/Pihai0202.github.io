import { useState, useEffect } from 'react'
import { CloseIcon, WarningIcon, CheckIcon, LockOpenIcon, KeyIcon, MusicIcon } from './SvgIcon'
import { auth } from '../firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithCredential,
  GoogleAuthProvider
} from 'firebase/auth'

interface LoginPageProps {
  onLoginSuccess: (user: { nickname: string; email: string }) => void
  onCancel: () => void
}


export function LoginPage({ onLoginSuccess, onCancel }: LoginPageProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleSdkReady, setIsGoogleSdkReady] = useState(false)

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.includes('@')) {
      setErrorMsg('請輸入格式正確的信箱！')
      return
    }
    if (password.length < 6) {
      setErrorMsg('密碼長度必須至少為 6 個字元！')
      return
    }
    if (isRegisterMode && !nickname.trim()) {
      setErrorMsg('請輸入暱稱！')
      return
    }

    setIsLoading(true)
    try {
      if (isRegisterMode) {
        // Real Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        const firebaseUser = userCredential.user
        // Save user nickname as display name
        await updateProfile(firebaseUser, { displayName: nickname.trim() })
        onLoginSuccess({
          nickname: nickname.trim(),
          email: firebaseUser.email || email.trim(),
        })
      } else {
        // Real Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password)
        const firebaseUser = userCredential.user
        onLoginSuccess({
          nickname: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || email.split('@')[0],
          email: firebaseUser.email || email.trim(),
        })
      }
    } catch (err: any) {
      console.error('Email Auth Error:', err)
      if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('此信箱已被註冊！')
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrorMsg('信箱或密碼錯誤！')
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('電子信箱格式不正確！')
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('密碼強度不足，必須至少為 6 個字元！')
      } else {
        setErrorMsg(err.message || '認證失敗，請稍後再試！')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Fallback Mock Login
  const handleMockGoogleLogin = () => {
    setIsLoading(true)
    setErrorMsg('')
    setTimeout(() => {
      setIsLoading(false)
      onLoginSuccess({
        nickname: 'Google樂迷小王',
        email: 'fan-google@example.com',
      })
    }, 1000)
  }

  const handleGuestLogin = () => {
    onLoginSuccess({
      nickname: '訪客樂迷',
      email: 'guest@example.com',
    })
  }


  // Load Google Sign-In SDK
  useEffect(() => {
    const win = window as any
    // If SDK is already loaded globally
    if (win.google && win.google.accounts) {
      setIsGoogleSdkReady(true)
      return
    }

    const scriptId = 'google-gsi-client'
    const existingScript = document.getElementById(scriptId)
    if (existingScript) return

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      if (win.google && win.google.accounts) {
        setIsGoogleSdkReady(true)
      }
    }
    script.onerror = () => {
      console.warn('Google GSI SDK failed to load. Falling back to mock login.')
    }
    document.body.appendChild(script)
  }, [])

  // Initialize and render Google button when SDK is ready or when states update
  useEffect(() => {
    const win = window as any
    if (!isGoogleSdkReady || !win.google || !win.google.accounts) return

    try {
      win.google.accounts.id.initialize({
        client_id: '214241689990-k3f18pigogq6i5r15cstmh3t4vl33lhn.apps.googleusercontent.com',
        callback: async (response: any) => {
          setIsLoading(true)
          setErrorMsg('')
          try {
            const credential = GoogleAuthProvider.credential(response.credential)
            const userCredential = await signInWithCredential(auth, credential)
            const firebaseUser = userCredential.user
            onLoginSuccess({
              nickname: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Google樂迷',
              email: firebaseUser.email || '',
            })
          } catch (err: any) {
            console.error('Google Sign-In Error:', err)
            setErrorMsg(err.message || 'Google 登入失敗！')
          } finally {
            setIsLoading(false)
          }
        },
      })

      const container = document.getElementById('google-signin-btn-container')
      if (container) {
        win.google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: container.clientWidth || 360,
        })
      }
    } catch (err) {
      console.error('Failed to render Google login button:', err)
    }
  }, [isGoogleSdkReady, isRegisterMode, isLoading])

  return (
    <div className="login-page-container">
      <div className="login-card">
        <button className="login-back-btn" type="button" onClick={onCancel}>
          <CloseIcon />
        </button>

        <div className="login-header">
          <div className="login-logo"><MusicIcon size="2em" /></div>
          <h2>{isRegisterMode ? '加入台灣演唱會地圖' : '登入您的帳戶'}</h2>
          <p className="login-subtitle">
            {isRegisterMode
              ? '註冊以開啟發佈功能，分享專屬樂迷心得！'
              : '登入帳戶，記錄與分享你的音樂現場足跡'}
          </p>
        </div>

        {errorMsg && (
          <div className="login-error-alert">
            <WarningIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            {errorMsg}
          </div>
        )}

        <form className="login-form" onSubmit={handleEmailAuthSubmit}>
          {isRegisterMode && (
            <div className="form-group">
              <label htmlFor="login-nickname">暱稱</label>
              <input
                id="login-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. 搖滾區小精靈"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-email">電子信箱</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">密碼</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位密碼"
              required
            />
          </div>

          <button className="login-submit-btn" type="submit" disabled={isLoading}>
            {isLoading ? (
              '處理中...'
            ) : isRegisterMode ? (
              <>
                註冊帳戶 <CheckIcon size="1.1em" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </>
            ) : (
              <>
                信箱登入 <LockOpenIcon size="1.1em" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </>
            )}
          </button>
        </form>

        <div className="login-divider">
          <span>或使用以下方式快捷登入</span>
        </div>

        <div className="login-oauth-group">
          {isGoogleSdkReady ? (
            <div
              id="google-signin-btn-container"
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                minHeight: '40px',
              }}
            />
          ) : (
            <button
              className="oauth-btn google-btn"
              type="button"
              onClick={handleMockGoogleLogin}
              disabled={isLoading}
            >
              <span className="oauth-icon g-icon" />
              使用 Google 帳戶登入 (Mock Fallback)
            </button>
          )}
        </div>

        <button
          className="guest-login-btn"
          type="button"
          onClick={handleGuestLogin}
          disabled={isLoading}
        >
          <KeyIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          快速免登入體驗 (訪客模式)
        </button>

        <div className="login-footer">
          {isRegisterMode ? (
            <p>
              已經有帳戶了？{' '}
              <button type="button" onClick={() => setIsRegisterMode(false)}>
                立即登入
              </button>
            </p>
          ) : (
            <p>
              還沒有帳戶？{' '}
              <button type="button" onClick={() => setIsRegisterMode(true)}>
                立即註冊
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
