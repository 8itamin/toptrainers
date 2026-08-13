import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Conversation {
  id: string;
  name: string;
  status: string;
  preview: string;
  time: string;
  unread: number;
}

interface ChatMessage {
  id: number;
  direction: 'incoming' | 'outgoing' | 'video';
  text: string;
  time: string;
}

const CONVERSATIONS: readonly Conversation[] = [
  { id: 'ivan', name: 'Иван П.', status: 'онлайн · стрик 30', preview: 'Видеоотчёт · присед, подход 3', time: '9:32', unread: 2 },
  { id: 'maria', name: 'Мария К.', status: 'была 2 ч назад', preview: 'Спасибо! А сколько белка в день?', time: '8:10', unread: 0 },
  { id: 'oleg', name: 'Олег С.', status: 'был вчера', preview: 'Вы: Олег, всё ок? Давно не виделись', time: 'вчера', unread: 0 },
  { id: 'anna', name: 'Анна В.', status: 'была вчера', preview: 'Отправила замеры за неделю 💪', time: 'вчера', unread: 0 },
];

const INITIAL_MESSAGES: readonly ChatMessage[] = [
  { id: 1, direction: 'incoming', text: 'Антон, залил видео приседа за 3 подход. Норм?', time: '9:28' },
  { id: 2, direction: 'video', text: 'присед · подход 3 · 0:42', time: '9:29' },
  { id: 3, direction: 'outgoing', text: 'Техника чистая 👍 Колени не заваливай на последнем повторе — держи носки. Добавляй 2,5 кг на след. неделе.', time: '9:31' },
  { id: 4, direction: 'incoming', text: 'Понял, спасибо! 🔥', time: '9:32' },
];

@Component({
  selector: 'tt-trainer-chats',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="chats-shell">
      <aside class="sidebar desktop-only">
        <a class="sidebar-logo" routerLink="/trainer" aria-label="TopTrainers: Сегодня"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 12 5 20 12" /><polyline points="4 19 12 12 20 19" /></svg></a>
        <nav class="sidebar-nav" aria-label="Навигация тренера">
          <a class="side-item" routerLink="/trainer"><span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg></span><span>Сегодня</span></a>
          <a class="side-item" routerLink="/trainer/clients"><span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.5 3-5 7-5M16 3.5a4 4 0 0 1 0 7.5M15 21c.5-3 3-5 7-5" /></svg></span><span>Клиенты</span></a>
          <a class="side-item" routerLink="/trainer/programs"><span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg></span><span>Программы</span></a>
          <a class="side-item is-active" routerLink="/trainer/chats"><span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg></span><span>Чаты</span></a>
          <a class="side-item" routerLink="/trainer/competitions"><span class="side-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5" /></svg></span><span>Соревн.</span></a>
          <a class="side-item" routerLink="/trainer/showcase"><span class="side-icon">▣</span><span>Витрина</span></a>
        </nav>
        <span class="sidebar-avatar" aria-hidden="true"></span>
      </aside>

      <section class="conversation-list" [class.is-hidden-mobile]="mobileThreadOpen()">
        <header><h1>Чаты</h1><label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg><input type="search" placeholder="Поиск" [value]="query()" (input)="setQuery($event)" /></label></header>
        <div class="conversation-scroll">
          @for (conversation of visibleConversations(); track conversation.id) {
            <button type="button" class="conversation" [class.is-active]="conversation.id === selectedId()" (click)="selectConversation(conversation.id)">
              <span class="avatar"></span><span class="conversation-copy"><span><strong>{{ conversation.name }}</strong><time>{{ conversation.time }}</time></span><small>{{ conversation.preview }}</small></span>
              @if (conversation.unread) { <span class="unread">{{ conversation.unread }}</span> }
            </button>
          } @empty { <p class="empty">Диалоги не найдены.</p> }
        </div>
      </section>

      <main class="thread" [class.is-hidden-mobile]="!mobileThreadOpen()">
        @if (selectedConversation(); as conversation) {
          <header class="thread-head"><button type="button" class="back mobile-only" (click)="closeMobileThread()" aria-label="К списку чатов">←</button><span class="avatar"></span><span><strong>{{ conversation.name }}</strong><small>{{ conversation.status }}</small></span><a routerLink="/trainer/clients" class="profile-link">Профиль</a></header>
          <div class="messages"><span class="day">СЕГОДНЯ</span>@for (message of messages(); track message.id) {
            @if (message.direction === 'video') { <article class="video-report"><div class="video-preview"><span>▶</span></div><small>{{ message.text }}</small></article> }
            @else { <article class="message" [class.is-outgoing]="message.direction === 'outgoing'"><p>{{ message.text }}</p><small>{{ message.time }}@if (message.direction === 'outgoing') { · ✓✓ }</small></article> }
          }</div>
          <footer class="composer"><div class="quick-replies"><button type="button" (click)="useQuickReply('👍 Отлично')">👍 Отлично</button><button type="button" (click)="useQuickReply('Разберём на созвоне')">Разберём на созвоне</button><button type="button" (click)="useQuickReply('Прикрепить программу')">Прикрепить программу</button></div><form (submit)="send($event)"><button type="button" class="attach" aria-label="Прикрепить файл">⌇</button><input placeholder="Сообщение…" [value]="draft()" (input)="setDraft($event)" /><button type="submit" class="send" aria-label="Отправить"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg></button></form></footer>
        }
      </main>

      <nav class="mobile-nav mobile-only" aria-label="Навигация тренера"><a routerLink="/trainer"><span>⌂</span>Сегодня</a><a routerLink="/trainer/clients"><span>♙</span>Клиенты</a><a routerLink="/trainer/programs"><span>▦</span>Программы</a><a class="is-active" routerLink="/trainer/chats"><span>◌</span>Чаты</a><a routerLink="/trainer/competitions"><span>♜</span>Ещё</a><a routerLink="/trainer/showcase"><span>▣</span>Витрина</a></nav>
    </div>
  `,
  styles: `
    :host { display:block; } .chats-shell { min-height:100dvh; background:#14181d; color:#f5f7fa; font-family:'Golos Text',system-ui,sans-serif; display:flex; }
    .sidebar { width:5.5rem; height:100dvh; position:sticky; top:0; flex-shrink:0; overflow-y:auto; background:#0e1116; border-right:1px solid rgb(245 247 250 / 6%); display:flex; flex-direction:column; align-items:center; padding:1.5rem 0; box-sizing:border-box; } .sidebar-logo{color:#c9f24b}.sidebar-nav{display:flex;flex-direction:column;align-items:center;gap:1.375rem;margin-top:2rem}.side-item{display:flex;flex-direction:column;align-items:center;gap:.3125rem;color:#8a94a6;text-decoration:none;font-size:.5625rem}.side-icon{display:flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border-radius:.75rem}.side-item.is-active{color:#c9f24b;font-weight:600}.side-item.is-active .side-icon{background:rgb(201 242 75 / 12%)}.sidebar-avatar,.avatar{border-radius:999px;background:repeating-linear-gradient(135deg,#2a323d,#2a323d 6px,#242b34 6px,#242b34 12px)}.sidebar-avatar{margin-top:auto;width:2.5rem;height:2.5rem}
    .conversation-list{width:21.25rem;min-height:100dvh;border-right:1px solid rgb(245 247 250 / 6%);display:flex;flex-direction:column;flex-shrink:0}.conversation-list header{padding:1.375rem 1.375rem .875rem}.conversation-list h1{margin:0;font-family:'Unbounded',sans-serif;font-size:1.25rem;letter-spacing:-.02em}.search{display:flex;align-items:center;gap:.5625rem;height:2.5rem;padding:0 .8125rem;margin-top:.875rem;background:#1c222b;border:1px solid rgb(245 247 250 / 8%);border-radius:.6875rem;color:#5b6472}.search input,.composer input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#f5f7fa;font:inherit}.search input::placeholder,.composer input::placeholder{color:#5b6472}.conversation-scroll{overflow-y:auto}.conversation{width:100%;display:flex;align-items:center;gap:.75rem;padding:.875rem 1.25rem;border:0;border-bottom:1px solid rgb(245 247 250 / 5%);border-left:3px solid transparent;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.conversation.is-active{background:rgb(201 242 75 / 8%);border-left-color:#c9f24b}.avatar{width:2.75rem;height:2.75rem;flex-shrink:0}.conversation-copy{min-width:0;flex:1}.conversation-copy>span{display:flex;justify-content:space-between;gap:.5rem}.conversation strong{font-size:.875rem}.conversation time,.conversation small,.thread-head small,.message small,.video-report small{font-family:'JetBrains Mono',monospace;font-size:.625rem;color:#8a94a6}.conversation-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:.1875rem;font-family:inherit;font-size:.78125rem}.unread{width:1.125rem;height:1.125rem;display:grid;place-items:center;border-radius:999px;background:#c9f24b;color:#14181d;font-size:.625rem;font-weight:700}.empty{padding:1.5rem;text-align:center;color:#8a94a6;font-size:.875rem}
    .thread{min-width:0;min-height:100dvh;flex:1;display:flex;flex-direction:column}.thread-head{display:flex;align-items:center;gap:.75rem;padding:1rem 1.5rem;border-bottom:1px solid rgb(245 247 250 / 6%)}.thread-head strong,.thread-head small{display:block}.thread-head small{margin-top:.1875rem;color:#c9f24b}.profile-link{margin-left:auto;padding:.5rem .875rem;border:1px solid rgb(245 247 250 / 16%);border-radius:.5625rem;color:#f5f7fa;text-decoration:none;font-size:.8125rem;font-weight:600}.messages{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:.875rem;overflow-y:auto;padding:1.5rem 1.75rem;background:linear-gradient(180deg,#14181d,#12161b)}.day{align-self:center;font-family:'JetBrains Mono',monospace;font-size:.625rem;letter-spacing:.1em;color:#5b6472}.message{align-self:flex-start;max-width:64%;padding:.75rem .9375rem;background:#1c222b;border-radius:1rem 1rem 1rem .25rem}.message.is-outgoing{align-self:flex-end;background:#c9f24b;border-radius:1rem 1rem .25rem 1rem;color:#14181d}.message p{margin:0;font-size:.875rem;line-height:1.45}.message small{display:block;margin-top:.3125rem;color:#5b6472}.message.is-outgoing small{color:rgb(20 24 29 / 55%);text-align:right}.video-report{align-self:flex-start;width:13.75rem;padding:.625rem;background:#1c222b;border:1px solid rgb(245 247 250 / 6%);border-radius:1rem}.video-preview{height:7.5rem;display:grid;place-items:center;border-radius:.625rem;background:repeating-linear-gradient(135deg,#20272f,#20272f 12px,#252d36 12px,#252d36 24px)}.video-preview span{display:grid;place-items:center;width:2.75rem;height:2.75rem;border-radius:999px;background:#c9f24b;color:#14181d}.video-report small{display:block;margin:.5rem .125rem 0}.composer{padding:.75rem 1.5rem 1.125rem;border-top:1px solid rgb(245 247 250 / 6%)}.quick-replies{display:flex;gap:.5rem;margin-bottom:.75rem;overflow-x:auto}.quick-replies button{white-space:nowrap;border:1px solid rgb(245 247 250 / 8%);border-radius:999px;padding:.4375rem .75rem;background:#1c222b;color:#c7cdd6;font-family:'JetBrains Mono',monospace;font-size:.6875rem;cursor:pointer}.composer form{display:flex;align-items:center;gap:.75rem;height:3.25rem;padding:0 .5rem 0 1rem;border:1px solid rgb(245 247 250 / 8%);border-radius:.875rem;background:#1c222b}.attach{border:0;background:transparent;color:#8a94a6;font-size:1.5rem;cursor:pointer}.send{display:grid;place-items:center;width:2.5rem;height:2.5rem;border:0;border-radius:.6875rem;background:#c9f24b;color:#14181d;cursor:pointer}
    .mobile-only{display:none}@media(max-width:859.98px){.desktop-only{display:none}.chats-shell{display:block}.conversation-list,.thread{width:100%;min-height:100dvh;padding-bottom:5.5rem}.conversation-list header{padding:1.25rem}.thread-head{padding:1rem 1.25rem}.messages{padding:1.25rem}.composer{padding:.75rem 1.25rem calc(6.25rem + env(safe-area-inset-bottom))}.mobile-only{display:flex}.is-hidden-mobile{display:none}.back{border:0;background:transparent;color:#c9f24b;font-size:1.25rem;cursor:pointer}.mobile-nav{position:fixed;z-index:10;inset-inline:0;bottom:0;justify-content:space-around;padding:.625rem 1rem calc(.625rem + env(safe-area-inset-bottom));border-top:1px solid rgb(245 247 250 / 8%);background:rgb(14 17 22 / 96%);backdrop-filter:blur(12px)}.mobile-nav a{display:flex;flex-direction:column;align-items:center;gap:.2rem;color:#8a94a6;text-decoration:none;font-size:.625rem}.mobile-nav a span{font-size:1.125rem;line-height:1}.mobile-nav .is-active{color:#c9f24b;font-weight:700}.message{max-width:82%}.profile-link{font-size:.75rem;padding:.4375rem .625rem}}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerChatsComponent {
  protected readonly query = signal('');
  protected readonly selectedId = signal('ivan');
  protected readonly draft = signal('');
  protected readonly mobileThreadOpen = signal(false);
  protected readonly messages = signal<readonly ChatMessage[]>(INITIAL_MESSAGES);
  protected readonly visibleConversations = computed(() => {
    const term = this.query().trim().toLocaleLowerCase();
    return CONVERSATIONS.filter((item) => !term || item.name.toLocaleLowerCase().includes(term));
  });
  protected readonly selectedConversation = computed(() => CONVERSATIONS.find((item) => item.id === this.selectedId()) ?? null);

  protected setQuery(event: Event): void { this.query.set((event.target as HTMLInputElement).value); }
  protected setDraft(event: Event): void { this.draft.set((event.target as HTMLInputElement).value); }
  protected selectConversation(id: string): void { this.selectedId.set(id); this.mobileThreadOpen.set(true); }
  protected closeMobileThread(): void { this.mobileThreadOpen.set(false); }
  protected useQuickReply(text: string): void { this.draft.set(text); }
  protected send(event: SubmitEvent): void {
    event.preventDefault();
    const text = this.draft().trim();
    if (!text) return;
    this.messages.update((items) => [...items, { id: items.length + 1, direction: 'outgoing', text, time: 'сейчас' }]);
    this.draft.set('');
  }
}
