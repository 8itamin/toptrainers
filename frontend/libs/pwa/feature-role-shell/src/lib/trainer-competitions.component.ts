import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface LeaderboardEntry {
  rank: number;
  name: string;
  workouts: number;
  points: string;
  tone: 'gold' | 'silver' | 'copper' | 'blue' | 'muted';
}

const LEADERBOARD: readonly LeaderboardEntry[] = [
  { rank: 1, name: 'Дмитрий Р.', workouts: 22, points: '1 840', tone: 'gold' },
  { rank: 2, name: 'Мария К.', workouts: 20, points: '1 705', tone: 'silver' },
  { rank: 3, name: 'Анна В.', workouts: 19, points: '1 620', tone: 'copper' },
  { rank: 4, name: 'Иван П.', workouts: 18, points: '1 540', tone: 'blue' },
  { rank: 5, name: 'Олег С.', workouts: 14, points: '1 180', tone: 'muted' },
];

@Component({
  selector: 'tt-trainer-competitions',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="competitions-shell">
      <aside class="sidebar desktop-only">
        <a class="sidebar-logo" routerLink="/trainer" aria-label="TopTrainers: Сегодня"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg></a>
        <nav class="sidebar-nav" aria-label="Навигация тренера">
          <a class="side-item" routerLink="/trainer"><span class="side-icon">⌂</span><span>Сегодня</span></a>
          <a class="side-item" routerLink="/trainer/clients"><span class="side-icon">♙</span><span>Клиенты</span></a>
          <a class="side-item" routerLink="/trainer/programs"><span class="side-icon">▦</span><span>Программы</span></a>
          <a class="side-item" routerLink="/trainer/chats"><span class="side-icon">◌</span><span>Чаты</span></a>
          <a class="side-item is-active" routerLink="/trainer/competitions"><span class="side-icon">♜</span><span>Соревн.</span></a>
          <a class="side-item" routerLink="/trainer/showcase"><span class="side-icon">▣</span><span>Витрина</span></a>
        </nav><span class="sidebar-avatar" aria-hidden="true"></span>
      </aside>

      <main class="main">
        <header class="toolbar"><div><h1>Соревнования</h1><span>1 активное</span></div><button type="button" class="create" (click)="createCompetition()">＋ Создать</button></header>
        <section class="challenge"><div class="trophy">♜</div><div class="challenge-copy"><p>АКТИВНЫЙ ЧЕЛЛЕНДЖ</p><h2>Кубок клуба · Август</h2><span>Больше всего тренировок за месяц · до 31 авг</span></div><div class="challenge-stats"><div><strong>27</strong><span>участников</span></div><div><strong>18</strong><span>дней осталось</span></div></div></section>
        @if (message()) { <p class="message">{{ message() }}</p> }
        <section class="leaderboard"><div class="leaderboard-head"><span>#</span><span>УЧАСТНИК</span><span>ТРЕНИРОВОК</span><span>БАЛЛЫ</span></div><div class="leaderboard-list">@for (entry of leaderboard; track entry.rank) { <article class="leaderboard-row" [attr.data-tone]="entry.tone"><strong>{{ entry.rank }}</strong><div class="participant"><span class="avatar"></span><span>{{ entry.name }}</span></div><span class="workouts">{{ entry.workouts }}</span><b>{{ entry.points }}</b></article> }</div></section>
      </main>

      <aside class="rules"><p>УСЛОВИЯ</p><div class="prize"><span>ПРИЗ</span><strong>−50% на след. месяц + мерч</strong></div><ul><li>+100 баллов за тренировку</li><li>+50 за видеоотчёт</li><li>×2 за серию без пропусков</li></ul><button type="button" class="rules-button" (click)="configureRules()">Настроить правила</button></aside>
      <nav class="mobile-nav mobile-only" aria-label="Навигация тренера"><a routerLink="/trainer"><span>⌂</span>Сегодня</a><a routerLink="/trainer/clients"><span>♙</span>Клиенты</a><a routerLink="/trainer/programs"><span>▦</span>Программы</a><a routerLink="/trainer/chats"><span>◌</span>Чаты</a><a class="is-active" routerLink="/trainer/competitions"><span>♜</span>Ещё</a><a routerLink="/trainer/showcase"><span>▣</span>Витрина</a></nav>
    </div>
  `,
  styles: `
    :host{display:block}.competitions-shell{min-height:100dvh;display:flex;background:#14181d;color:#f5f7fa;font-family:'Golos Text',system-ui,sans-serif}.sidebar{width:5.5rem;height:100dvh;position:sticky;top:0;flex-shrink:0;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:1.5rem 0;background:#0e1116;border-right:1px solid rgb(245 247 250 / 6%);box-sizing:border-box}.sidebar-logo{color:#c9f24b}.sidebar-nav{display:flex;flex-direction:column;align-items:center;gap:1.375rem;margin-top:2rem}.side-item{display:flex;flex-direction:column;align-items:center;gap:.3125rem;color:#8a94a6;text-decoration:none;font-size:.5625rem}.side-icon{display:grid;place-items:center;width:2.75rem;height:2.75rem;border-radius:.75rem;font-size:1.25rem}.side-item.is-active{color:#c9f24b;font-weight:600}.side-item.is-active .side-icon{background:rgb(201 242 75 / 12%)}.sidebar-avatar,.avatar{border-radius:999px;background:repeating-linear-gradient(135deg,#2a323d,#2a323d 6px,#242b34 6px,#242b34 12px)}.sidebar-avatar{width:2.5rem;height:2.5rem;margin-top:auto}.main{min-width:0;flex:1;padding:1.625rem 1.875rem}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:1rem}.toolbar div{display:flex;align-items:baseline;gap:.75rem}.toolbar h1{margin:0;font-family:'Unbounded',sans-serif;font-size:1.375rem;letter-spacing:-.02em}.toolbar span{font-family:'JetBrains Mono',monospace;font-size:.75rem;color:#8a94a6}.create{height:2.625rem;border:0;border-radius:.6875rem;padding:0 1rem;background:#c9f24b;color:#14181d;font:inherit;font-size:.875rem;font-weight:700;cursor:pointer}.challenge{display:flex;align-items:center;gap:1.5rem;margin-top:1.25rem;padding:1.5rem;border:1px solid rgb(201 242 75 / 18%);border-radius:1.125rem;background:linear-gradient(120deg,#1c222b,#20272f)}.trophy{display:grid;place-items:center;width:4.375rem;height:4.375rem;border-radius:1.125rem;background:rgb(231 181 74 / 16%);color:#e7b54a;font-size:2rem}.challenge-copy{min-width:0;flex:1}.challenge-copy p,.rules>p,.prize span{margin:0;font-family:'JetBrains Mono',monospace;font-size:.625rem;letter-spacing:.12em;color:#c9f24b}.challenge-copy h2{margin:.375rem 0 0;font-family:'Unbounded',sans-serif;font-size:1.375rem;letter-spacing:-.02em}.challenge-copy>span{display:block;margin-top:.375rem;font-size:.8125rem;color:#8a94a6}.challenge-stats{display:flex;gap:1.625rem;text-align:center}.challenge-stats strong{display:block;font-family:'Unbounded',sans-serif;font-size:1.625rem;line-height:1}.challenge-stats div:last-child strong{color:#e7b54a}.challenge-stats span{display:block;margin-top:.3125rem;font-size:.6875rem;color:#8a94a6}.message{margin:.875rem 0 0;font-size:.8125rem;color:#8a94a6}.leaderboard{margin-top:1.375rem}.leaderboard-head,.leaderboard-row{display:grid;grid-template-columns:3.5rem 2.4fr 1.4fr 1fr;gap:1rem;align-items:center}.leaderboard-head{padding:.625rem 1.125rem;font-family:'JetBrains Mono',monospace;font-size:.625rem;letter-spacing:.1em;color:#5b6472}.leaderboard-list{display:flex;flex-direction:column;gap:.5rem}.leaderboard-row{padding:.875rem 1.125rem;border-radius:.875rem;border-left:3px solid transparent;background:#1c222b}.leaderboard-row>strong{font-family:'Unbounded',sans-serif;font-size:1.25rem}.leaderboard-row[data-tone='gold']{border-left-color:#e7b54a}.leaderboard-row[data-tone='gold']>strong{color:#e7b54a}.leaderboard-row[data-tone='silver']{border-left-color:#8a94a6}.leaderboard-row[data-tone='copper']{border-left-color:#e8833a}.leaderboard-row[data-tone='copper']>strong{color:#e8833a}.leaderboard-row[data-tone='blue']{border-left-color:#2f5cff;background:rgb(47 92 255 / 8%)}.leaderboard-row[data-tone='muted']>strong{color:#5b6472}.participant{display:flex;align-items:center;gap:.75rem;font-size:.9375rem;font-weight:600}.avatar{width:2.375rem;height:2.375rem}.workouts{font-family:'JetBrains Mono',monospace;font-size:.875rem}.leaderboard-row b{font-family:'Unbounded',sans-serif;font-size:1rem}.leaderboard-row[data-tone='gold'] b{color:#c9f24b}.rules{width:20rem;min-height:100dvh;display:flex;flex-direction:column;gap:1rem;padding:1.625rem 1.5rem;box-sizing:border-box;background:#0e1116;border-left:1px solid rgb(245 247 250 / 6%)}.rules>p{color:#f5f7fa;font-weight:700;font-size:.6875rem}.prize{padding:1.125rem;border-radius:.875rem;background:#1c222b}.prize span{color:#8a94a6}.prize strong{display:block;margin-top:.5rem;font-family:'Unbounded',sans-serif;font-size:1.125rem;line-height:1.2;color:#c9f24b}.rules ul{display:flex;flex-direction:column;gap:.75rem;margin:0;padding:0;list-style:none}.rules li{display:flex;align-items:center;gap:.6875rem;font-size:.8125rem;color:#c7cdd6}.rules li::before{content:'✓';display:grid;place-items:center;width:1.375rem;height:1.375rem;flex-shrink:0;border-radius:.375rem;background:rgb(201 242 75 / 14%);color:#c9f24b;font-weight:700}.rules-button{height:2.875rem;margin-top:auto;border:1px solid rgb(245 247 250 / 16%);border-radius:.75rem;background:transparent;color:#f5f7fa;font:inherit;font-size:.875rem;font-weight:600;cursor:pointer}.mobile-only{display:none}@media(max-width:1079.98px){.rules{width:17.5rem}.main{padding:1.25rem}.challenge{gap:1rem}.challenge-stats{gap:1rem}}@media(max-width:859.98px){.desktop-only,.rules{display:none}.competitions-shell{display:block}.main{min-height:100dvh;padding:1.25rem 1.25rem 6.5rem}.mobile-only{display:flex}.toolbar h1{font-size:1.25rem}.challenge{align-items:flex-start;flex-wrap:wrap;padding:1.125rem}.trophy{width:3.5rem;height:3.5rem;font-size:1.5rem}.challenge-copy{flex-basis:calc(100% - 4.5rem)}.challenge-copy h2{font-size:1.0625rem}.challenge-stats{width:100%;justify-content:flex-start;margin-left:4.5rem}.leaderboard-head,.leaderboard-row{grid-template-columns:2rem minmax(0,1fr) auto auto;gap:.625rem}.leaderboard-head{padding:.625rem .75rem;font-size:.5625rem}.leaderboard-head span:nth-child(3){display:none}.leaderboard-row{padding:.75rem}.workouts{display:none}.participant{gap:.5rem;font-size:.8125rem}.avatar{width:2rem;height:2rem}.leaderboard-row>strong{font-size:1rem}.leaderboard-row b{font-size:.8125rem}.mobile-nav{position:fixed;z-index:10;inset-inline:0;bottom:0;justify-content:space-around;padding:.625rem 1rem calc(.625rem + env(safe-area-inset-bottom));background:rgb(14 17 22 / 96%);border-top:1px solid rgb(245 247 250 / 8%);backdrop-filter:blur(12px)}.mobile-nav a{display:flex;flex-direction:column;align-items:center;gap:.2rem;color:#8a94a6;text-decoration:none;font-size:.625rem}.mobile-nav a span{font-size:1.125rem;line-height:1}.mobile-nav .is-active{color:#c9f24b;font-weight:700}}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerCompetitionsComponent {
  protected readonly leaderboard = LEADERBOARD;
  protected readonly message = signal('');
  protected createCompetition(): void { this.message.set('Создание соревнования появится вместе с модулем соревнований.'); }
  protected configureRules(): void { this.message.set('Настройка правил станет доступна после подключения доменного модуля.'); }
}
