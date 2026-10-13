import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ClientsApi, ProgramsApi, WorkoutHistoryApi } from '@toptrainers/shared/data-access';
import {
  type ClientCardResponse,
  type ProgramResponse,
  type TrainerClientSummary,
  type WorkoutHistoryPage,
} from '@toptrainers/shared/contracts';
import { TrainerSidebarComponent } from './trainer-sidebar.component';
import { RequestSelection, issueKey } from './trainer-clients-state';

@Component({
  selector: 'tt-trainer-clients',
  standalone: true,
  imports: [FormsModule, RouterLink, TrainerSidebarComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="crm">
    <tt-trainer-sidebar />
    <main [class.mobile-hidden]="selected()">
      <header>
        <div>
          <h1>Клиенты</h1>
          <small>{{ counts()['active'] || 0 }} активных</small>
        </div>
        <button class="primary" (click)="newCard()">+ Клиент</button>
      </header>
      <label
        >Поиск по имени или email<input
          type="search"
          [(ngModel)]="query"
          (ngModelChange)="search()"
      /></label>
      <nav aria-label="Группы клиентов">
        @for (tab of tabs; track tab.key) {
          <button [class.active]="group() === tab.key" (click)="setGroup(tab.key)">
            {{ tab.label }}
            @if (tab.key !== 'all') {
              · {{ counts()[tab.key] || 0 }}
            }
          </button>
        }
      </nav>
      @if (loading()) {
        <p role="status">Загружаем клиентов…</p>
      }
      @if (listError()) {
        <p role="alert">{{ listError() }}</p>
        <button (click)="load()">Повторить</button>
      }
      <div class="rows">
        @for (card of cards(); track card.id) {
          <button class="row" [class.active]="selected()?.id === card.id" (click)="select(card)">
            <span class="avatar">{{ card.display_name.slice(0, 1).toUpperCase() }}</span>
            <span
              ><strong>{{ card.display_name }}</strong
              ><small>{{ card.contact_email || 'Без email' }}</small></span
            >
            <span class="badge">{{ label(card.group) }}</span>
          </button>
        } @empty {
          @if (!loading() && !listError()) {
            <p>Клиентов пока нет. Создайте карточку и пригласите клиента.</p>
          }
        }
      </div>
      @if (cursor()) {
        <button [disabled]="loading()" (click)="load(true)">Загрузить ещё</button>
      }
      <nav class="mobile-nav">
        <a routerLink="/trainer">Сегодня</a><a routerLink="/trainer/clients">Клиенты</a
        ><a routerLink="/trainer/programs">Программы</a>
      </nav>
    </main>
    @if (selected(); as card) {
      <aside>
        <button (click)="close()" [disabled]="busy()">← К списку</button>
        <h2>{{ card.display_name }}</h2>
        <p>{{ card.contact_email || 'Email не указан' }} · {{ label(card.group) }}</p>
        <button (click)="editCard(card)" [disabled]="busy()">Редактировать</button>
        @if (card.group !== 'active') {
          <section>
            <h3>Приглашение</h3>
            <p>Новая ссылка отменяет прежнюю и действует 7 дней.</p>
            <button [disabled]="busy()" (click)="invite(false)">Выпустить ссылку</button>
            <button [disabled]="busy() || !card.contact_email" (click)="invite(true)">
              Отправить по email
            </button>
            <button [disabled]="busy()" (click)="cancelInvite()">Отменить приглашение</button>
            @if (inviteUrl()) {
              <label>Персональная ссылка<input readonly [value]="inviteUrl()" /></label>
              <button (click)="copy()">Копировать</button
              ><a class="button" [href]="telegramUrl()" target="_blank" rel="noopener noreferrer"
                >Поделиться в Telegram</a
              >
            }
          </section>
        }
        @if (detailLoading()) {
          <p>Загружаем карточку…</p>
        }
        @if (detailError()) {
          <p role="alert">{{ detailError() }}</p>
          <button (click)="select(card)">Повторить</button>
        }
        @if (summary(); as data) {
          <section>
            <h3>Тренировки</h3>
            <p>Завершено: {{ data.completed_workouts }}</p>
            <p>
              Последняя тренировка:
              {{
                data.last_completed_at ? (data.last_completed_at | date: 'dd.MM.yyyy HH:mm') : '—'
              }}
            </p>
          </section>
          <section>
            <h3>Программы</h3>
            @for (p of data.programs; track p.id) {
              <article>
                <strong>{{ p.title }}</strong>
                <p>
                  Старт {{ p.start_date | date: 'dd.MM.yyyy' }} ·
                  {{ p.status === 'CANCELLED' ? 'Отменена' : 'Назначена' }}
                </p>
                <p>
                  {{ p.completed }} / {{ p.total }} тренировок ·
                  {{ p.completion === null ? '—' : p.completion + '%' }}
                </p>
              </article>
            } @empty {
              <p>Программа ещё не назначена.</p>
            }
          </section>
        }
        @if (card.group === 'active') {
          <section>
            <h3>Назначить программу</h3>
            @if (programError()) {
              <p role="alert">{{ programError() }}</p>
              <button (click)="loadPrograms()">Повторить загрузку программ</button>
            }
            <form (ngSubmit)="issue()">
              <label
                >Программа<select name="program" [(ngModel)]="programId" required>
                  <option value="">Выберите программу</option>
                  @for (p of programs(); track p.id) {
                    <option [value]="p.id">{{ p.title }}</option>
                  }
                </select></label
              >
              <label
                >Дата старта<input name="startDate" type="date" [(ngModel)]="startDate" required
              /></label>
              <button class="primary" [disabled]="busy() || !programId || !startDate">
                Назначить
              </button>
            </form>
            @if (!programs().length && !programError()) {
              <p>Создайте и сохраните программу с тренировками или задачами.</p>
              <a routerLink="/trainer/programs">К программам</a>
            }
          </section>
        }
        @if (history(); as data) {
          <section>
            <h3>История тренировок</h3>
            @for (item of data.items; track item.assignment_id) {
              <article>
                <strong>{{ item.workout_title }}</strong
                ><small>{{ item.completed_at | date: 'dd.MM.yyyy HH:mm' }}</small>
              </article>
            } @empty {
              <p>Завершённых тренировок пока нет.</p>
            }
            @if (data.next_cursor) {
              <button [disabled]="busy()" (click)="moreHistory()">Ещё</button>
            }
          </section>
        }
        @if (card.relationship_id) {
          <button class="danger" [disabled]="busy()" (click)="terminate()">
            Завершить сотрудничество
          </button>
        }
        @if (message()) {
          <p role="status">{{ message() }}</p>
        }
      </aside>
    }
    @if (formOpen()) {
      <div class="overlay">
        <section role="dialog" aria-modal="true" aria-labelledby="form-title">
          <h2 id="form-title">{{ editingId ? 'Редактировать клиента' : 'Новый клиент' }}</h2>
          <form (ngSubmit)="save()">
            <label>Имя<input name="name" [(ngModel)]="name" maxlength="120" required /></label>
            <label>Email (для письма)<input name="email" type="email" [(ngModel)]="email" /></label>
            <p>Аккаунт клиента подключится после принятия приглашения.</p>
            <button class="primary" [disabled]="busy() || !name.trim()">Сохранить</button
            ><button type="button" [disabled]="busy()" (click)="formOpen.set(false)">Отмена</button>
          </form>
          @if (formError()) {
            <p role="alert">{{ formError() }}</p>
          }
        </section>
      </div>
    }
  </div>`,
  styles: `
    :host {
      display: block;
    }
    .crm {
      min-height: 100dvh;
      background: #14181d;
      color: #f5f7fa;
      font-family: 'Golos Text', system-ui;
      display: flex;
    }
    main {
      flex: 1;
      padding: 2rem;
      min-width: 0;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
    }
    h1 {
      font-family: Unbounded, system-ui;
      font-size: 1.6rem;
      margin: 0;
    }
    h2,
    h3 {
      margin: 0.75rem 0;
    }
    small {
      display: block;
      color: #8a94a6;
      margin-top: 0.4rem;
    }
    button,
    .button {
      font: inherit;
      padding: 0.7rem 1rem;
      border: 1px solid #36404e;
      background: #1c222b;
      border-radius: 0.65rem;
      color: #f5f7fa;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      margin: 0.2rem;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .primary {
      background: #c9f24b;
      color: #14181d;
      border: 0;
    }
    .danger {
      color: #ff9ba5;
    }
    input,
    select {
      box-sizing: border-box;
      width: 100%;
      background: #14181d;
      color: #f5f7fa;
      border: 1px solid #586273;
      border-radius: 0.5rem;
      padding: 0.8rem;
      font: inherit;
    }
    label {
      display: grid;
      gap: 0.4rem;
      margin: 0.8rem 0;
    }
    .active {
      border-color: #c9f24b;
      color: #c9f24b;
    }
    .rows {
      margin-top: 1.5rem;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 1rem;
      width: 100%;
      text-align: left;
      padding: 1rem;
      margin: 0.5rem 0;
    }
    .avatar {
      background: #35402a;
      color: #c9f24b;
      border-radius: 50%;
      width: 2.5rem;
      height: 2.5rem;
      display: grid;
      place-items: center;
    }
    .badge {
      margin-left: auto;
      font-size: 0.8rem;
      color: #8a94a6;
    }
    aside {
      width: 24rem;
      flex-shrink: 0;
      padding: 1.5rem;
      border-left: 1px solid #2b3340;
      box-sizing: border-box;
    }
    section {
      padding: 1rem 0;
      border-bottom: 1px solid #2b3340;
    }
    p {
      color: #b6bfcc;
      line-height: 1.5;
    }
    a {
      color: #c9f24b;
    }
    article {
      padding: 0.75rem;
      background: #1c222b;
      border-radius: 0.6rem;
      margin: 0.5rem 0;
    }
    .overlay {
      position: fixed;
      inset: 0;
      background: #0009;
      z-index: 100;
      display: grid;
      place-items: center;
      padding: 1rem;
    }
    .overlay section {
      width: min(26rem, 100%);
      padding: 1.5rem;
      background: #1c222b;
      border-radius: 1rem;
      box-sizing: border-box;
    }
    .mobile-nav {
      display: none;
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid #c9f24b;
      outline-offset: 3px;
    }
    @media (max-width: 800px) {
      main {
        padding: 1rem 1rem 5rem;
      }
      aside {
        width: 100%;
        border: 0;
      }
      .mobile-hidden {
        display: none;
      }
      .mobile-nav {
        display: flex;
        gap: 1rem;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #1c222b;
        padding: 1rem;
      }
      .badge {
        font-size: 0.7rem;
      }
    }
  `,
})
export class TrainerClientsComponent {
  private readonly api = inject(ClientsApi);
  private readonly programsApi = inject(ProgramsApi);
  private readonly historyApi = inject(WorkoutHistoryApi);
  private readonly selection = new RequestSelection();
  private readonly listing = new RequestSelection();
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly requests = new Map<string, string>();
  protected readonly tabs = [
    { key: 'all', label: 'Все' },
    { key: 'active', label: 'Активные' },
    { key: 'pending', label: 'Ожидают подключения' },
    { key: 'past', label: 'Прошлые' },
  ];
  protected readonly cards = signal<ClientCardResponse[]>([]);
  protected readonly counts = signal<Record<string, number>>({});
  protected readonly group = signal('all');
  protected readonly cursor = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly listError = signal('');
  protected readonly selected = signal<ClientCardResponse | null>(null);
  protected readonly summary = signal<TrainerClientSummary | null>(null);
  protected readonly history = signal<WorkoutHistoryPage | null>(null);
  protected readonly programs = signal<ProgramResponse[]>([]);
  protected readonly programError = signal('');
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly inviteUrl = signal('');
  protected readonly formOpen = signal(false);
  protected readonly formError = signal('');
  protected query = '';
  protected name = '';
  protected email = '';
  protected editingId = '';
  protected programId = '';
  protected startDate = '';
  constructor() {
    this.load();
    this.loadPrograms();
  }
  protected loadPrograms() {
    this.programError.set('');
    this.programsApi.list().subscribe({
      next: (p) => this.programs.set(p.filter((x) => x.slots.length > 0)),
      error: () =>
        this.programError.set('Не удалось загрузить список программ. Попробуйте ещё раз.'),
    });
  }
  protected label(group: string) {
    return this.tabs.find((t) => t.key === group)?.label || group;
  }
  protected search() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 250);
  }
  protected setGroup(group: string) {
    this.group.set(group);
    this.load();
  }
  protected load(more = false) {
    const version = this.listing.next();
    this.loading.set(true);
    this.listError.set('');
    this.api.list(this.group(), this.query, more ? this.cursor() || '' : '').subscribe({
      next: (r) => {
        if (!this.listing.current(version)) return;
        this.cards.set(more ? [...this.cards(), ...r.items] : r.items);
        this.counts.set(r.counts);
        this.cursor.set(r.next_cursor);
        this.loading.set(false);
      },
      error: () => {
        if (this.listing.current(version)) {
          this.listError.set('Не удалось загрузить клиентов.');
          this.loading.set(false);
        }
      },
    });
  }
  protected select(card: ClientCardResponse) {
    const version = this.selection.next();
    this.selected.set(card);
    this.inviteUrl.set('');
    this.message.set('');
    this.summary.set(null);
    this.history.set(null);
    this.detailError.set('');
    this.programId = '';
    this.startDate = '';
    if (!card.client_account_id) {
      this.detailLoading.set(false);
      return;
    }
    this.detailLoading.set(true);
    forkJoin({
      summary: this.api.summary(card.client_account_id),
      history: this.historyApi.listTrainerClient(card.client_account_id),
    }).subscribe({
      next: (r) => {
        if (this.selection.current(version)) {
          this.summary.set(r.summary);
          this.history.set(r.history);
          this.detailLoading.set(false);
        }
      },
      error: () => {
        if (this.selection.current(version)) {
          this.detailError.set('Не удалось загрузить программы и историю.');
          this.detailLoading.set(false);
        }
      },
    });
  }
  protected close() {
    if (this.busy()) return;
    this.selection.next();
    this.selected.set(null);
  }
  protected newCard() {
    this.editingId = '';
    this.name = '';
    this.email = '';
    this.formError.set('');
    this.formOpen.set(true);
  }
  protected editCard(card: ClientCardResponse) {
    this.editingId = card.id;
    this.name = card.display_name;
    this.email = card.contact_email || '';
    this.formError.set('');
    this.formOpen.set(true);
  }
  private online() {
    if (!navigator.onLine) {
      this.message.set('Для сохранения нужен интернет.');
      return false;
    }
    return true;
  }
  protected save() {
    if (this.busy()) return;
    if (!this.online()) {
      this.formError.set('Для сохранения нужен интернет.');
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    const payload = { display_name: this.name.trim(), contact_email: this.email.trim() || null };
    (this.editingId
      ? this.api.update(this.editingId, payload)
      : this.api.create(payload)
    ).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.formOpen.set(false);
        this.load();
        this.select(r);
      },
      error: (e) => {
        this.busy.set(false);
        this.formError.set(
          e.error?.detail?.code === 'CONTACT_EMAIL_LOCKED'
            ? 'Email нельзя менять после подключения или при действующем приглашении.'
            : 'Не удалось сохранить. Проверьте поля; возможно, такой email уже добавлен.',
        );
      },
    });
  }
  protected invite(email: boolean) {
    const card = this.selected();
    if (!card || this.busy() || !this.online()) return;
    if (!confirm('Выпустить новое приглашение? Прежняя ссылка перестанет действовать.')) return;
    this.busy.set(true);
    this.api.invite(card.id, email).subscribe({
      next: (r) => {
        this.busy.set(false);
        if (this.selected()?.id !== card.id) return;
        this.inviteUrl.set(r.url);
        this.message.set(
          r.delivery_status === 'FAILED'
            ? 'Письмо не отправлено. Повторите отправку или поделитесь ссылкой.'
            : email
              ? 'Письмо отправлено.'
              : 'Ссылка готова. Она действует 7 дней.',
        );
      },
      error: () => {
        this.busy.set(false);
        this.message.set('Не удалось выпустить приглашение. Проверьте email или попробуйте позже.');
      },
    });
  }
  protected cancelInvite() {
    const card = this.selected();
    if (!card || this.busy() || !this.online()) return;
    this.busy.set(true);
    this.api.cancelInvite(card.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.inviteUrl.set('');
        this.message.set('Приглашение отменено.');
      },
      error: () => {
        this.busy.set(false);
        this.message.set('Не удалось отменить приглашение.');
      },
    });
  }
  protected telegramUrl() {
    return `https://t.me/share/url?url=${encodeURIComponent(this.inviteUrl())}&text=${encodeURIComponent('Приглашаю подключиться к тренировкам в TopTrainers')}`;
  }
  protected copy() {
    navigator.clipboard.writeText(this.inviteUrl()).then(
      () => this.message.set('Ссылка скопирована.'),
      () => this.message.set('Выделите и скопируйте ссылку из поля.'),
    );
  }
  protected issue() {
    const card = this.selected();
    if (!card?.client_account_id || !card.relationship_id || this.busy() || !this.online()) return;
    const key = issueKey(card.id, this.programId, this.startDate);
    const request = this.requests.get(key) || crypto.randomUUID();
    this.requests.set(key, request);
    this.busy.set(true);
    this.programsApi
      .issue(this.programId, {
        client_id: card.client_account_id,
        start_date: this.startDate,
        request_id: request,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.requests.delete(key);
          if (this.selected()?.id === card.id) {
            this.select(card);
            this.message.set('Программа назначена.');
          }
        },
        error: () => {
          this.busy.set(false);
          this.message.set('Не удалось назначить программу. Можно повторить без дублирования.');
        },
      });
  }
  protected terminate() {
    const card = this.selected();
    if (!card?.relationship_id || this.busy() || !this.online()) return;
    if (
      !confirm('Завершить сотрудничество? История сохранится, новые назначения будут недоступны.')
    )
      return;
    this.busy.set(true);
    this.api.terminate(card.relationship_id).subscribe({
      next: () => {
        this.busy.set(false);
        if (this.selected()?.id === card.id)
          this.select({ ...card, group: 'past', relationship_id: null });
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.message.set('Не удалось завершить сотрудничество.');
      },
    });
  }
  protected moreHistory() {
    const card = this.selected();
    const previous = this.history();
    if (!card?.client_account_id || !previous?.next_cursor || this.busy()) return;
    this.busy.set(true);
    this.historyApi.listTrainerClient(card.client_account_id, previous.next_cursor).subscribe({
      next: (r) => {
        this.busy.set(false);
        if (this.selected()?.id === card.id)
          this.history.set({ ...r, items: [...previous.items, ...r.items] });
      },
      error: () => {
        this.busy.set(false);
        this.message.set('Не удалось загрузить историю.');
      },
    });
  }
}
