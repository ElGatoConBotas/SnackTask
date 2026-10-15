import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import type { Invite, Settings } from '../api/types';
import { Avatar, Card } from '../components/ui';
import { prizeFor } from '../lib/stats';
import { useApp, useLang, useToast } from '../state';
import { fmtShortDate, hhmm, weekStart } from '../lib/time';

function Invites() {
  const { act } = useApp();
  const { t } = useLang();
  const [list, setList] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [asAdmin, setAsAdmin] = useState(false);
  const refresh = () => api.listInvites().then(setList).catch(() => setList([]));
  useEffect(() => { void refresh(); }, []);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    // allow pasting several addresses at once (comma, space or new line separated)
    const emails = email.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    for (const em of emails) await act(() => api.addInvite(em, asAdmin));
    setEmail('');
    void refresh();
  };
  return (
    <Card>
      <h2>✉️ {t('admin.invites')} <span className="muted small">{list.length}</span></h2>
      <p className="muted small">{t('admin.invitesHelp')}</p>
      <form className="row gap wrap" onSubmit={add}>
        <input className="grow" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('admin.inviteEmail')} required />
        <label className="check"><input type="checkbox" checked={asAdmin} onChange={(e) => setAsAdmin(e.target.checked)} /><span>{t('admin.asAdmin')}</span></label>
        <button className="btn primary">{t('common.add')}</button>
      </form>
      <ul className="admin-list">
        {list.map((i) => (
          <li key={i.email}>
            <span className="grow">{i.email}{i.is_admin && <span className="chip butter small">{t('admin.asAdmin')}</span>}</span>
            <button className="btn ghost small danger" onClick={async () => { await act(() => api.removeInvite(i.email)); void refresh(); }}>{t('common.delete')}</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Users() {
  const { snap, me, act } = useApp();
  const { t } = useLang();
  return (
    <Card>
      <h2>👥 {t('admin.users')} <span className="muted small">{snap.profiles.length}</span></h2>
      <ul className="admin-list">
        {snap.profiles.map((p) => (
          <li key={p.id} className={p.active ? '' : 'inactive'}>
            <Avatar p={p} size={30} />
            <span className="grow"><strong>{p.display_name}</strong><br /><span className="muted small">{p.email}</span></span>
            <select value={p.role} disabled={p.id === me.id} onChange={(e) => act(() => api.adminSetProfile(p.id, e.target.value as 'member' | 'admin', p.active))} aria-label={t('admin.role')}>
              <option value="member">{t('admin.member')}</option>
              <option value="admin">{t('admin.admin')}</option>
            </select>
            <label className="check">
              <input type="checkbox" checked={p.active} disabled={p.id === me.id} onChange={(e) => act(() => api.adminSetProfile(p.id, p.role, e.target.checked))} />
              <span>{t('admin.active')}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Rules() {
  const { snap, act } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const [s, setS] = useState<Settings>(snap.settings);
  const [presets, setPresets] = useState(snap.settings.stake_presets.join('\n'));
  const num = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });
  const time = (k: 'lock_time' | 'close_time') => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: e.target.value + ':00' });
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await act(async () => {
      await api.updateSettings({ ...s, stake_presets: presets.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12) });
      return true;
    });
    if (ok) toast(t('common.saved'), 'success', '✓');
  };
  return (
    <Card>
      <h2>🎲 {t('admin.settings')}</h2>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="field"><span>{t('admin.maxTasks')}</span><input type="number" min={1} max={20} value={s.max_tasks} onChange={num('max_tasks')} /></label>
          <label className="field"><span>{t('admin.minEst')}</span><input type="number" min={1} value={s.min_estimate} onChange={num('min_estimate')} /></label>
          <label className="field"><span>{t('admin.maxEst')}</span><input type="number" min={1} value={s.max_estimate} onChange={num('max_estimate')} /></label>
          <label className="field"><span>{t('admin.lock')}</span><input type="time" value={hhmm(s.lock_time)} onChange={time('lock_time')} /></label>
          <label className="field"><span>{t('admin.close')}</span><input type="time" value={hhmm(s.close_time)} onChange={time('close_time')} /></label>
          <label className="field"><span>{t('admin.pDone')}</span><input type="number" value={s.points_done} onChange={num('points_done')} /></label>
          <label className="field"><span>{t('admin.pBonus')}</span><input type="number" value={s.points_on_time_bonus} onChange={num('points_on_time_bonus')} /></label>
          <label className="field"><span>{t('admin.pFailed')}</span><input type="number" value={s.points_failed} onChange={num('points_failed')} /></label>
        </div>
        <label className="field"><span>{t('admin.presets')}</span><textarea rows={5} value={presets} onChange={(e) => setPresets(e.target.value)} /></label>
        <button className="btn primary">{t('common.save')}</button>
      </form>
    </Card>
  );
}

function Prize() {
  const { snap, today, act } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const w = weekStart(today);
  const [text, setText] = useState(prizeFor(snap.prizes, w));
  return (
    <Card>
      <h2>🎁 {t('admin.prize')}</h2>
      <form className="row gap wrap" onSubmit={async (e) => { e.preventDefault(); const ok = await act(async () => { await api.setPrize(w, text); return true; }); if (ok) toast(t('common.saved'), 'success', '✓'); }}>
        <input className="grow" value={text} maxLength={120} onChange={(e) => setText(e.target.value)} placeholder={t('admin.prizePh')} />
        <button className="btn primary">{t('common.save')}</button>
      </form>
    </Card>
  );
}

function Holidays() {
  const { snap, act } = useApp();
  const { t, lang } = useLang();
  const [day, setDay] = useState('');
  const [name, setName] = useState('');
  return (
    <Card>
      <h2>🌴 {t('admin.holidays')}</h2>
      <form className="row gap wrap" onSubmit={async (e) => { e.preventDefault(); await act(() => api.addHoliday(day, name)); setDay(''); setName(''); }}>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('admin.holidayName')} maxLength={60} />
        <button className="btn primary">{t('common.add')}</button>
      </form>
      {snap.holidays.length === 0 ? <p className="muted small">{t('admin.none')}</p> : (
        <ul className="admin-list">
          {snap.holidays.map((h) => (
            <li key={h.day}>
              <span className="grow">{fmtShortDate(h.day, lang)} · {h.name}</span>
              <button className="btn ghost small danger" onClick={() => act(() => api.removeHoliday(h.day))}>{t('common.delete')}</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Adjustments() {
  const { snap, today, act, nameOf } = useApp();
  const { t, lang } = useLang();
  const [user, setUser] = useState(snap.profiles[0]?.id ?? '');
  const [points, setPoints] = useState(5);
  const [reason, setReason] = useState('');
  return (
    <Card>
      <h2>± {t('admin.adjust')}</h2>
      <form className="row gap wrap" onSubmit={async (e) => { e.preventDefault(); await act(() => api.addAdjustment(user, today, points, reason)); setReason(''); }}>
        <select value={user} onChange={(e) => setUser(e.target.value)}>
          {snap.profiles.map((p) => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
        <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} aria-label={t('admin.adjustPoints')} style={{ width: 90 }} />
        <input className="grow" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('admin.adjustReason')} required maxLength={200} />
        <button className="btn primary">{t('common.add')}</button>
      </form>
      {snap.adjustments.length === 0 ? <p className="muted small">{t('admin.none')}</p> : (
        <ul className="admin-list">
          {snap.adjustments.slice(0, 30).map((a) => (
            <li key={a.id}>
              <span className="grow"><strong>{nameOf(a.user_id)}</strong> {a.points > 0 ? '+' : ''}{a.points} · {a.reason} <span className="muted small">{fmtShortDate(a.day, lang)}</span></span>
              <button className="btn ghost small danger" onClick={() => act(() => api.removeAdjustment(a.id))}>{t('common.delete')}</button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function Admin() {
  const { isAdmin } = useApp();
  const { t } = useLang();
  if (!isAdmin) return <Navigate to="/" replace />;
  return (
    <div className="page admin">
      <header className="page-head"><h1>⚙️ {t('admin.title')}</h1></header>
      <div className="admin-grid">
        <Invites />
        <Users />
        <Rules />
        <div className="stack">
          <Prize />
          <Holidays />
          <Adjustments />
        </div>
      </div>
    </div>
  );
}
