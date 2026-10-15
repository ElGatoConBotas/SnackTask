import { useState } from 'react';
import { api } from '../api';
import type { BoardTask, Profile } from '../api/types';
import { EMOJIS } from '../api/types';
import { Avatar, Card, Empty, Flame, StatusChip } from '../components/ui';
import { RankList, useWeekRows } from '../components/Rank';
import { useApp, useLang, useNow } from '../state';
import { elapsedNow } from '../lib/rules';
import { fmtDate, fmtDuration, fmtMinutes } from '../lib/time';

export function BoardTaskRow({ task, interactive = true }: { task: BoardTask; interactive?: boolean }) {
  const { me, snap, act } = useApp();
  const { t } = useLang();
  const tick = useNow(task.eff_status === 'running' ? 1000 : 60000);
  const reactions = snap.reactions.filter((r) => r.task_id === task.id);
  const asked = snap.looks.some((l) => l.task_id === task.id && l.from_user === me.id);
  const own = task.user_id === me.id;
  const [open, setOpen] = useState(false);
  return (
    <li className={`btask btask-${task.eff_status}`}>
      <div className="btask-main">
        <StatusChip task={task} />
        <span className={`btask-title ${task.title === null ? 'private' : ''}`}>
          {task.title === null ? <>🔒 {t('common.private')}</> : <>{task.is_private && '🔒 '}{task.title}</>}
        </span>
      </div>
      <div className="btask-meta">
        <span>⏱ {fmtMinutes(task.estimate_min)}</span>
        {task.eff_status === 'running' && <span className="mono">{fmtDuration(elapsedNow(task, tick))}</span>}
        {task.stake && <span className="chip stake">🍩 {task.stake}</span>}
        {task.points !== 0 && <span className={`pts ${task.points > 0 ? 'plus' : 'minus'}`}>{task.points > 0 ? '+' : ''}{task.points}</span>}
      </div>
      {interactive && (
        <div className="btask-react">
          {EMOJIS.map((e) => {
            const n = reactions.filter((r) => r.emoji === e.key).length;
            const mineR = reactions.some((r) => r.emoji === e.key && r.user_id === me.id);
            if (!open && n === 0) return null;
            return (
              <button key={e.key} className={`react ${mineR ? 'on' : ''} ${n ? 'has' : ''}`} aria-pressed={mineR}
                onClick={() => act(() => api.toggleReaction(task.id, e.key))}>
                <span aria-hidden>{e.char}</span>{n > 0 && <span className="n">{n}</span>}
              </button>
            );
          })}
          <button className="react more" aria-expanded={open} onClick={() => setOpen(!open)} title="😊">{open ? '✕' : '☺+'}</button>
          {!own && task.eff_status === 'done' && (
            <button className={`react look ${asked ? 'on' : ''}`} disabled={asked} onClick={() => act(() => api.requestLook(task.id))}>
              👀 {asked ? t('board.lookAsked') : t('board.lookAsk')}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function PersonCard({ p, tasks, interactive = true }: { p: Profile; tasks: BoardTask[]; interactive?: boolean }) {
  const { snap, today, streakOf, me } = useApp();
  const { t } = useLang();
  const away = snap.away.some((a) => a.user_id === p.id && a.day === today);
  const pts = tasks.reduce((n, x) => n + x.points, 0);
  const done = tasks.filter((x) => x.eff_status === 'done').length;
  return (
    <Card className={`person ${p.id === me.id ? 'me' : ''}`}>
      <header className="person-head">
        <Avatar p={p} size={40} />
        <div className="person-name">
          <strong>{p.display_name}</strong>
          <span className="muted small">{away ? `🏖️ ${t('board.away')}` : tasks.length ? `${done}/${tasks.length} ✓` : t('board.noTasks')}</span>
        </div>
        <Flame n={streakOf(p.id).current} />
        <span className={`person-pts ${pts < 0 ? 'minus' : ''}`}>{pts > 0 ? '+' : ''}{pts}</span>
      </header>
      {tasks.length > 0 && <ul className="btasks">{tasks.map((x) => <BoardTaskRow key={x.id} task={x} interactive={interactive} />)}</ul>}
    </Card>
  );
}

export function useBoardPeople() {
  const { snap } = useApp();
  const byUser = new Map<string, BoardTask[]>();
  for (const x of snap.today) byUser.set(x.user_id, [...(byUser.get(x.user_id) ?? []), x]);
  const people = snap.profiles.filter((p) => p.active);
  const withTasks = people
    .filter((p) => byUser.has(p.id))
    .sort((a, b) => {
      const pa = byUser.get(a.id)!.reduce((n, x) => n + x.points, 0);
      const pb = byUser.get(b.id)!.reduce((n, x) => n + x.points, 0);
      return pb - pa || a.display_name.localeCompare(b.display_name);
    });
  const without = people.filter((p) => !byUser.has(p.id));
  return { byUser, withTasks, without };
}

export default function Board() {
  const { snap, today, phase, nameOf } = useApp();
  const { t, lang } = useLang();
  const { byUser, withTasks, without } = useBoardPeople();
  const weekRows = useWeekRows();
  const misses = snap.today.filter((x) => x.eff_status === 'failed');

  return (
    <div className="page board">
      <header className="page-head">
        <div>
          <p className="eyebrow">{fmtDate(today, lang)}</p>
          <h1>{t('board.title')}</h1>
        </div>
      </header>

      {phase === 'closed' && (
        <Card className={misses.length ? 'misses' : 'misses none'}>
          {misses.length ? (
            <>
              <h2>🍩 {t('board.misses')}</h2>
              <ul className="miss-list">
                {misses.map((m) => <li key={m.id}><strong>{nameOf(m.user_id)}</strong> · {m.stake}</li>)}
              </ul>
            </>
          ) : <p>🎉 {t('board.noMisses')}</p>}
        </Card>
      )}

      <div className="board-layout">
        <div className="people">
          {withTasks.length === 0 && <Card><Empty icon="🌱">{t('board.emptyDay')}</Empty></Card>}
          {withTasks.map((p) => <PersonCard key={p.id} p={p} tasks={byUser.get(p.id)!} />)}
          {without.length > 0 && (
            <div className="others">
              {without.map((p) => <PersonCard key={p.id} p={p} tasks={[]} />)}
            </div>
          )}
        </div>
        <aside className="side">
          <Card>
            <h2>🏆 {t('board.weekTop')}</h2>
            <RankList rows={weekRows} limit={10} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
