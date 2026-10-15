import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { AppError } from '../api/supabaseApi';
import { isKey } from '../i18n';
import { useLang } from '../state';

export function Logo({ big = false }: { big?: boolean }) {
  return (
    <span className={`logo ${big ? 'logo-big' : ''}`}>
      <svg viewBox="0 0 64 64" aria-hidden className="logo-mark">
        <circle cx="32" cy="32" r="28" fill="var(--peach)" />
        <circle cx="32" cy="32" r="20" fill="var(--lavender)" />
        <circle cx="32" cy="32" r="8" fill="var(--bg)" />
      </svg>
      <span>Snack<b>Task</b></span>
    </span>
  );
}

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="seg small">
      <button className={lang === 'sl' ? 'on' : ''} onClick={() => setLang('sl')}>SL</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
    </div>
  );
}

export default function Login() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fail = (e: unknown) => {
    const k = 'err.' + (e instanceof AppError ? e.code : 'unknown');
    setError(isKey(k) ? t(k) : t('err.unknown'));
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.sendCode(email.trim().toLowerCase()); setSent(true); } catch (err) { fail(err); }
    setBusy(false);
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.verifyCode(email.trim().toLowerCase(), code); } catch (err) { fail(err); }
    setBusy(false);
  };

  return (
    <div className="login">
      <div className="login-card card">
        <div className="row between"><Logo big /><LangSwitch /></div>
        <p className="muted">{t('app.tagline')}</p>
        {api.demo ? (
          <>
            <p className="demo-note">{t('demo.banner')}</p>
            <button className="btn primary wide" onClick={() => void api.verifyCode('', '')}>{t('login.demo')} →</button>
          </>
        ) : !sent ? (
          <form onSubmit={send}>
            <label className="field"><span>{t('login.email')}</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </label>
            <button className="btn primary wide" disabled={busy}>{t('login.send')}</button>
          </form>
        ) : (
          <form onSubmit={verify}>
            <p>{t('login.sent', { email })}</p>
            <label className="field"><span>{t('login.code')}</span>
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                maxLength={10} required autoFocus className="code-input" />
            </label>
            <button className="btn primary wide" disabled={busy || code.length < 6}>{t('login.verify')}</button>
            <button type="button" className="btn ghost wide" onClick={() => { setSent(false); setCode(''); }}>{t('login.other')}</button>
          </form>
        )}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export function Blocked({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <div className="login">
      <div className="login-card card">
        <Logo big />
        <p>{text}</p>
        <div className="row gap">
          {onRetry && <button className="btn primary" onClick={onRetry}>{t('login.retry')}</button>}
          <button className="btn ghost" onClick={() => void api.signOut()}>{t('login.signOut')}</button>
        </div>
      </div>
    </div>
  );
}
