import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { COLORS, type Color } from '../api/types';
import { Avatar, Card } from '../components/ui';
import { BADGES } from '../lib/stats';
import { useApp, useLang, useToast } from '../state';
import type { Key } from '../i18n';
import { resetDemo } from '../api/demoApi';

const EMOJI_CHOICES = ['', '😎', '🌸', '🎧', '⚡', '☕', '🚲', '🦊', '🐻', '🌻', '🍀', '🎸', '🏀', '🍕', '🚀', '🐢', '🦄'];

export default function Profile() {
  const { me, act, streakOf, badgesOf, isAdmin, demo } = useApp();
  const { t, setLang } = useLang();
  const { toast } = useToast();
  const [name, setName] = useState(me.display_name);
  const [color, setColor] = useState<Color>(me.avatar_color);
  const [emoji, setEmoji] = useState(me.avatar_emoji);
  const streak = streakOf(me.id);
  const earned = badgesOf(me.id);

  const save = async (patch: Partial<{ language: 'sl' | 'en'; theme: 'light' | 'dark' }> = {}) => {
    const next = { display_name: name.trim() || me.display_name, avatar_color: color, avatar_emoji: emoji, language: me.language, theme: me.theme, ...patch };
    const ok = await act(async () => { await api.updateMyProfile(next); return true; });
    if (ok && patch.language) setLang(patch.language);
    if (ok && !patch.language && !patch.theme) toast(t('common.saved'), 'success', '✓');
  };

  const preview = { ...me, display_name: name || me.display_name, avatar_color: color, avatar_emoji: emoji };

  return (
    <div className="page profile">
      <header className="page-head"><h1>{t('profile.title')}</h1></header>

      <Card className="profile-card">
        <div className="profile-top">
          <Avatar p={preview} size={72} />
          <div className="profile-streaks">
            <div className="stat"><span className="stat-n">🔥 {streak.current}</span><span className="stat-l">{t('profile.streak')}</span></div>
            <div className="stat"><span className="stat-n">{streak.best}</span><span className="stat-l">{t('profile.best')}</span></div>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="profile-form">
          <label className="field"><span>{t('profile.name')}</span><input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
          <div className="field">
            <span>{t('profile.color')}</span>
            <div className="swatches">
              {COLORS.map((c) => (
                <button type="button" key={c} className={`swatch c-${c} ${c === color ? 'on' : ''}`} aria-label={c} aria-pressed={c === color} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>
          <div className="field">
            <span>{t('profile.emoji')}</span>
            <div className="emoji-pick">
              {EMOJI_CHOICES.map((e) => (
                <button type="button" key={e || 'none'} className={`pill ${e === emoji ? 'on' : ''}`} onClick={() => setEmoji(e)}>
                  {e || t('profile.noEmoji')}
                </button>
              ))}
            </div>
          </div>
          <button className="btn primary">{t('common.save')}</button>
        </form>
      </Card>

      <Card>
        <div className="settings-grid">
          <div className="field">
            <span>{t('profile.language')}</span>
            <div className="seg">
              <button className={me.language === 'sl' ? 'on' : ''} onClick={() => save({ language: 'sl' })}>{t('lang.sl')}</button>
              <button className={me.language === 'en' ? 'on' : ''} onClick={() => save({ language: 'en' })}>{t('lang.en')}</button>
            </div>
          </div>
          <div className="field">
            <span>{t('profile.theme')}</span>
            <div className="seg">
              <button className={me.theme === 'light' ? 'on' : ''} onClick={() => save({ theme: 'light' })}>☀️ {t('theme.light')}</button>
              <button className={me.theme === 'dark' ? 'on' : ''} onClick={() => save({ theme: 'dark' })}>🌙 {t('theme.dark')}</button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2>{t('profile.badges')} <span className="muted small">{earned.size}/{BADGES.length}</span></h2>
        <ul className="badges">
          {BADGES.map((b) => (
            <li key={b.key} className={earned.has(b.key) ? 'earned' : 'locked'}>
              <span className="badge-icon" aria-hidden>{b.icon}</span>
              <strong>{t(`badge.${b.key}` as Key)}</strong>
              <span className="muted small">{t(`badge.${b.key}.d` as Key)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="more-links">
        <h2>{t('profile.more')}</h2>
        <div className="row gap wrap">
          <Link className="btn ghost" to="/leaderboard">🏆 {t('nav.leaderboard')}</Link>
          <Link className="btn ghost" to="/stats">📊 {t('nav.stats')}</Link>
          <Link className="btn ghost" to="/tv">📺 {t('nav.tv')}</Link>
          {isAdmin && <Link className="btn ghost" to="/admin">⚙️ {t('nav.admin')}</Link>}
          {demo && <button className="btn ghost" onClick={() => { resetDemo(); location.reload(); }}>↺ {t('demo.reset')}</button>}
          <button className="btn ghost danger" onClick={() => void api.signOut()}>{t('login.signOut')}</button>
        </div>
      </Card>
    </div>
  );
}
