import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { BoardTask, TaskInput } from '../api/types';
import { EMOJIS } from '../api/types';
import { Card, Empty, StatusChip } from '../components/ui';
import { useApp, useLang, useNow, useToast } from '../state';
import { celebrate } from '../lib/confetti';
import { elapsedNow, pointsFor } from '../lib/rules';
import { fmtDate, fmtDuration, fmtMinutes, hhmm } from '../lib/time';

const QUICK = [15, 30, 60, 90, 120];

function TaskForm({ initial, onDone, submitLabel }: { initial?: BoardTask; onDone?: () => void; submitLabel: string }) {
  const { snap, act } = useApp();
  const { t } = useLang();
  const presets = snap.settings.stake_presets;
  const initStake = initial?.stake ?? presets[0] ?? '';
  const [title, setTitle] = useState(initial?.title ?? '');
  const [estimate, setEstimate] = useState<number>(initial?.estimate_min ?? 30);
  const [stakeChoice, setStakeChoice] = useState(presets.includes(initStake) ? initStake : '__custom');
  const [custom, setCustom] = useState(presets.includes(initStake) ? '' : initStake);
  const [isPrivate, setPrivate] = useState(initial?.is_private ?? false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const input: TaskInput = { title, estimate, stake: stakeChoice === '__custom' ? custom : stakeChoice, isPrivate };
    const ok = await act(async () => {
      if (initial) await api.editTask(initial.id, input);
      else await api.addTask(input);
      return true;
    });
    setBusy(false);
    if (ok) {
      if (!initial) { setTitle(''); setPrivate(false); }
      onDone?.();
    }
  };

  return (
    <form className="task-form" onSubmit={submit}>
      <label className="field">
        <span>{t('today.taskTitle')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required autoFocus={!!initial} />
      </label>
      <div className="field">
        <span>{t('today.estimate')}</span>
        <div className="quick">
          {QUICK.filter((q) => q >= snap.settings.min_estimate && q <= snap.settings.max_estimate).map((q) => (
            <button type="button" key={q} className={`pill ${estimate === q ? 'on' : ''}`} onClick={() => setEstimate(q)}>
              {fmtMinutes(q)}
            </button>
          ))}
          <label className="num">
            <input type="number" inputMode="numeric" min={snap.settings.min_estimate} max={snap.settings.max_estimate}
              value={estimate} onChange={(e) => setEstimate(Number(e.target.value))} aria-label={t('today.estimate')} />
            <span>{t('today.minutes')}</span>
          </label>
        </div>
      </div>
      <label className="field">
        <span>{t('today.stake')}</span>
        <select value={stakeChoice} onChange={(e) => setStakeChoice(e.target.value)}>
          {presets.map((p) => <option key={p} value={p}>{p}</option>)}
          <option value="__custom">{t('today.stakeCustom')}</option>
        </select>
      </label>
      {stakeChoice === '__custom' && (
        <label className="field">
          <span className="sr-only">{t('today.stakeCustom')}</span>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={80} placeholder={t('today.stakeCustomPh')} required />
        </label>
      )}
      <label className="check">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} />
        <span>🔒 {t('today.private')}</span>
      </label>
      <div className="row gap">
        <button className="btn primary" disabled={busy}>{submitLabel}</button>
        {onDone && initial && <button type="button" className="btn ghost" onClick={onDone}>{t('common.cancel')}</button>}
      </div>
    </form>
  );
}

function MyTaskCard({ task }: { task: BoardTask }) {
  const { act, phase, snap } = useApp();
  const { t } = useLang();
  const { toast } = useToast();
  const tick = useNow(1000);
  const [editing, setEditing] = useState(false);
  const elapsed = elapsedNow(task, tick);
  const pct = Math.min(1.5, elapsed / (task.estimate_min * 60));
  const live = task.eff_status !== 'done' && task.eff_status !== 'failed';
  const canPlan = phase === 'planning' && task.eff_status !== 'done';
  const reactions = snap.reactions.filter((r) => r.task_id === task.id);

  const finish = async () => {
    const onTime = await act(() => api.finishTask(task.id));
    if (onTime === undefined) return;
    celebrate(onTime);
    const p = pointsFor('done', onTime, snap.settings);
    toast(t(onTime ? 'today.onTime' : 'today.late', { p }), 'success', onTime ? '🎉' : '✅');
  };

  if (editing) {
    return <Card className="task editing"><TaskForm initial={task} submitLabel={t('common.save')} onDone={() => setEditing(false)} /></Card>;
  }

  return (
    <Card className={`task task-${task.eff_status} ${task.eff_status === 'running' ? 'pulse' : ''}`}>
      <div className="task-head">
        <h3>{task.is_private && <span title={t('common.private')}>🔒 </span>}{task.title}</h3>
        <StatusChip task={task} />
      </div>
      <div className="task-meta">
        <span>⏱ {fmtMinutes(task.estimate_min)}</span>
        <span className="chip stake">🍩 {task.stake}</span>
        {task.eff_status !== 'planned' && task.eff_status !== 'failed' && (
          <span className="mono">{fmtDuration(elapsed)} / {fmtDuration(task.estimate_min * 60)}</span>
        )}
      </div>
      {(task.used_timer || task.eff_status === 'running') && (
        <div className={`progress ${pct > 1 ? 'over' : ''}`} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.min(100, pct * 100)}%` }} />
        </div>
      )}
      {reactions.length > 0 && (
        <div className="reaction-summary">
          {EMOJIS.map((e) => {
            const n = reactions.filter((r) => r.emoji === e.key).length;
            return n ? <span key={e.key}>{e.char} {n}</span> : null;
          })}
        </div>
      )}
      {live && (
        <div className="row gap wrap actions">
          {task.eff_status === 'running' ? (
            <button className="btn" onClick={() => act(() => api.pauseTask(task.id))}>❚❚ {t('today.pause')}</button>
          ) : (
            phase !== 'nonworking' && (
              <button className="btn lavender" onClick={() => act(() => api.startTask(task.id))}>
                ▶ {task.eff_status === 'paused' ? t('today.resume') : t('today.start')}
              </button>
            )
          )}
          {(task.eff_status === 'running' || task.eff_status === 'paused') && (
            <button className="btn primary" onClick={finish}>✓ {t('today.finish')}</button>
          )}
          {task.eff_status === 'planned' && (
            <button className="btn ghost small" onClick={finish}>{t('today.doneNoTimer')}</button>
          )}
          {canPlan && (
            <>
              <span className="spacer" />
              <button className="btn ghost small" onClick={() => setEditing(true)}>{t('common.edit')}</button>
              <button className="btn ghost small danger" onClick={() => { if (confirm(t('today.confirmDelete'))) void act(() => api.deleteTask(task.id)); }}>
                {t('common.delete')}
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function LookRequests() {
  const { me, snap, act, nameOf } = useApp();
  const { t } = useLang();
  const mine = new Map([...snap.today, ...snap.myTasks].filter((x) => x.user_id === me.id).map((x) => [x.id, x]));
  const open = snap.looks.filter((l) => !l.seen && mine.has(l.task_id));
  if (!open.length) return null;
  return (
    <Card className="looks">
      <h2>👀 {t('today.looksTitle')}</h2>
      <ul>
        {open.map((l) => (
          <li key={l.task_id + l.from_user}>{t('today.looksText', { name: nameOf(l.from_user), task: mine.get(l.task_id)?.title ?? '' })}</li>
        ))}
      </ul>
      <button className="btn small" onClick={() => act(() => api.markLooksSeen())}>{t('today.looksSeen')}</button>
    </Card>
  );
}

export default function Today() {
  const { me, snap, today, phase, act } = useApp();
  const { t, lang } = useLang();
  const mine = snap.today.filter((x) => x.user_id === me.id);
  const away = snap.away.some((a) => a.user_id === me.id && a.day === today);
  const points = mine.reduce((n, x) => n + x.points, 0);
  const done = mine.filter((x) => x.eff_status === 'done').length;
  const canAdd = phase === 'planning' && !away && mine.length < snap.settings.max_tasks;

  return (
    <div className="page today">
      <header className="page-head">
        <div>
          <p className="eyebrow">{fmtDate(today, lang)}</p>
          <h1>{t('today.title')}</h1>
        </div>
      </header>

      <div className="stat-row">
        <div className="stat"><span className="stat-n">{points > 0 ? '+' : ''}{points}</span><span className="stat-l">{t('today.pointsToday')}</span></div>
        <div className="stat"><span className="stat-n">{done}/{mine.length}</span><span className="stat-l">{t('status.done')}</span></div>
      </div>

      <LookRequests />

      {phase === 'nonworking' && <Card><Empty icon="🌴">{t('today.nonworking')}</Empty></Card>}

      {away && (
        <Card className="away-card">
          <p>🏖️ {t('today.awayOn')}</p>
          {phase === 'planning' && <button className="btn small" onClick={() => act(() => api.setAway(false))}>{t('today.awayOff')}</button>}
        </Card>
      )}

      <div className="task-list">
        {mine.map((x) => <MyTaskCard key={x.id} task={x} />)}
      </div>

      {!away && phase !== 'nonworking' && mine.length === 0 && phase !== 'planning' && (
        <Card><Empty icon="🗒️">{t('today.emptyLocked')}</Empty></Card>
      )}

      {canAdd && (
        <Card className="add-card">
          <h2>{t('today.addTitle')} <span className="muted small">{mine.length}/{snap.settings.max_tasks}</span></h2>
          {mine.length === 0 && <p className="muted">{t('today.empty')}</p>}
          <TaskForm submitLabel={`+ ${t('today.add')}`} />
        </Card>
      )}
      {phase === 'planning' && !away && mine.length >= snap.settings.max_tasks && <p className="muted center">{t('today.limit', { n: snap.settings.max_tasks })}</p>}
      {phase === 'working' && !away && mine.length > 0 && <p className="muted center small">🔒 {t('today.locked', { t: hhmm(snap.settings.lock_time) })}</p>}

      {phase === 'planning' && !away && mine.length === 0 && (
        <p className="center"><button className="btn ghost" onClick={() => act(() => api.setAway(true))}>🏖️ {t('today.awayToggle')}</button></p>
      )}
    </div>
  );
}
