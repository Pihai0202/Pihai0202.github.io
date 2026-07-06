import { useState } from 'react'
import { CloseIcon, WarningIcon, CheckIcon, LockOpenIcon, KeyIcon, TaiwanIcon } from './SvgIcon'
import { auth } from '../firebase'
import { useTranslation } from '../utils/i18n.tsx'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider
} from 'firebase/auth'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'

interface LoginPageProps {
  onLoginSuccess: (user: { nickname: string; email: string }) => void
  onCancel: () => void
}


export function LoginPage({ onLoginSuccess, onCancel }: LoginPageProps) {
  const { t, lang } = useTranslation()
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.includes('@')) {
      setErrorMsg(t('emailFormatError'))
      return
    }
    if (password.length < 6) {
      setErrorMsg(t('passwordLengthError'))
      return
    }
    if (isRegisterMode && !nickname.trim()) {
      setErrorMsg(t('nicknameEmptyError'))
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
        setErrorMsg(lang === 'zh-TW' ? '此信箱已被註冊！' : 'This email is already in use!')
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrorMsg(lang === 'zh-TW' ? '信箱或密碼錯誤！' : 'Invalid email or password!')
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg(lang === 'zh-TW' ? '電子信箱格式不正確！' : 'Invalid email address!')
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg(lang === 'zh-TW' ? '密碼強度不足，必須至少為 6 個字元！' : 'Password must be at least 6 characters!')
      } else {
        setErrorMsg(err.message || (lang === 'zh-TW' ? '認證失敗，請稍後再試！' : 'Authentication failed, please try again!'))
      }
    } finally {
      setIsLoading(false)
    }
  }


  const handleGuestLogin = () => {
    onLoginSuccess({
      nickname: lang === 'zh-TW' ? '訪客樂迷' : 'Guest Fan',
      email: 'guest@example.com',
    })
  }


  const handleGoogleSignInPopup = async () => {
    setIsLoading(true)
    setErrorMsg('')
    try {
      if (typeof (window as any).Capacitor !== 'undefined') {
        // Native App (Capacitor) Google Sign-in
        const result = await FirebaseAuthentication.signInWithGoogle()
        const idToken = (result.credential as any)?.idToken
        if (idToken) {
          const credential = GoogleAuthProvider.credential(idToken)
          const userCredential = await signInWithCredential(auth, credential)
          const firebaseUser = userCredential.user
          onLoginSuccess({
            nickname: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || (lang === 'zh-TW' ? 'Google樂迷' : 'Google Fan'),
            email: firebaseUser.email || '',
          })
        } else {
          throw new Error('No ID Token received from Google native sign-in.')
        }
      } else {
        // Web Browser Google Sign-in
        const provider = new GoogleAuthProvider()
        const userCredential = await signInWithPopup(auth, provider)
        const firebaseUser = userCredential.user
        onLoginSuccess({
          nickname: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || (lang === 'zh-TW' ? 'Google樂迷' : 'Google Fan'),
          email: firebaseUser.email || '',
        })
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err)
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('closed')) {
        setErrorMsg(lang === 'zh-TW' ? '登入視窗已關閉！' : 'Login popup closed!')
      } else if (err.code === 'auth/cancelled-popup-request' || err.message?.includes('cancel')) {
        setErrorMsg(lang === 'zh-TW' ? '登入請求已被取消！' : 'Login request cancelled!')
      } else {
        setErrorMsg(err.message || (lang === 'zh-TW' ? 'Google 登入失敗！' : 'Google Sign-In failed!'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page-container">
      <div className="login-card">
        <button className="login-back-btn" type="button" onClick={onCancel}>
          <CloseIcon />
        </button>

        <div className="login-header">
          <div className="login-logo"><TaiwanIcon size="2.2em" /></div>
          <h2>{isRegisterMode ? t('joinApp') : t('loginApp')}</h2>
          <p className="login-subtitle">
            {isRegisterMode
              ? t('signUpSubtitle')
              : t('signInSubtitle')}
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
              <label htmlFor="login-nickname">{t('nicknameForm')}</label>
              <input
                id="login-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={lang === 'zh-TW' ? 'e.g. 搖滾區小精靈' : 'e.g. Rock精靈'}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-email">{t('emailForm')}</label>
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
            <label htmlFor="login-password">{t('passwordForm')}</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              required
            />
          </div>

          <button className="login-submit-btn" type="submit" disabled={isLoading}>
            {isLoading ? (
              lang === 'zh-TW' ? '處理中...' : 'Processing...'
            ) : isRegisterMode ? (
              <>
                {lang === 'zh-TW' ? '註冊帳戶' : 'Sign Up'} <CheckIcon size="1.1em" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </>
            ) : (
              <>
                {lang === 'zh-TW' ? '信箱登入' : 'Sign In'} <LockOpenIcon size="1.1em" style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
              </>
            )}
          </button>
        </form>

        <div className="login-divider">
          <span>{lang === 'zh-TW' ? '或使用以下方式快捷登入' : 'Or quick sign in with'}</span>
        </div>

        <div className="login-oauth-group">
          <button
            className="oauth-btn google-btn"
            type="button"
            onClick={handleGoogleSignInPopup}
            disabled={isLoading}
            style={{ width: '100%' }}
          >
            <span className="oauth-icon g-icon" />
            {t('googleSignIn')}
          </button>
        </div>

        <button
          className="guest-login-btn"
          type="button"
          onClick={handleGuestLogin}
          disabled={isLoading}
        >
          <KeyIcon size="1.1em" style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          {lang === 'zh-TW' ? '快速免登入體驗 (訪客模式)' : 'Guest Mode (No Sign In)'}
        </button>

        <div className="login-footer">
          {isRegisterMode ? (
            <p>
              {lang === 'zh-TW' ? '已經有帳戶了？ ' : 'Already have an account? '}
              <button type="button" onClick={() => setIsRegisterMode(false)}>
                {lang === 'zh-TW' ? '立即登入' : 'Log In'}
              </button>
            </p>
          ) : (
            <p>
              {lang === 'zh-TW' ? '還沒有帳戶？ ' : "Don't have an account? "}
              <button type="button" onClick={() => setIsRegisterMode(true)}>
                {lang === 'zh-TW' ? '立即註冊' : 'Sign Up'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
