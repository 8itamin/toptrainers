import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type Direction = 'strength' | 'speed' | 'endurance' | 'mobility' | 'technique';
type CountKind = 'load' | 'bodyweight' | 'time' | 'distance';

interface DirectionOption { key: Direction; label: string; }
interface CountOption { key: CountKind; title: string; hint: string; }

const DIRECTIONS: readonly DirectionOption[] = [
  { key: 'strength', label: 'Сила' },
  { key: 'speed', label: 'Скорость' },
  { key: 'endurance', label: 'Выносл.' },
  { key: 'mobility', label: 'Мобильн.' },
  { key: 'technique', label: 'Техника' },
];

const COUNT_KINDS: readonly CountOption[] = [
  { key: 'load', title: 'Сила', hint: 'ВЕС, КГ × ПОВТОРЕНИЯ' },
  { key: 'bodyweight', title: 'Вес тела', hint: 'ПОВТОРЕНИЯ' },
  { key: 'time', title: 'Статика / кардио', hint: 'ВРЕМЯ, СЕК' },
  { key: 'distance', title: 'Дистанция', hint: 'МЕТРЫ · ВРЕМЯ' },
];

@Component({
  selector: 'tt-exercise-editor',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="backdrop">
      <div class="modal">
        <header class="modal-head">
          <div class="head-left">
            <span class="kicker">УПРАЖНЕНИЕ</span>
            <span class="name">Присед со штангой</span>
            <span class="usage">в 7 тренировках</span>
          </div>
          <div class="head-right">
            <button type="button" class="ghost" (click)="duplicate()">Дублировать</button>
            <button type="button" class="save" (click)="save()">Сохранить</button>
            <a class="close" routerLink="/trainer/library" aria-label="Закрыть">✕</a>
          </div>
        </header>

        <div class="body">
          <div class="video-col">
            <div class="label">ВИДЕО ТЕХНИКИ</div>
            <div class="video">
              <div class="video-placeholder">
                <span class="play"><svg width="22" height="22" viewBox="0 0 24 24" fill="#14181d" stroke="none"><path d="M8 5v14l11-7z" /></svg></span>
              </div>
              <div class="video-bar"><span class="track"><i></i></span><span class="time">0:16 / 0:42</span></div>
            </div>
            <div class="video-actions">
              <button type="button" class="outline" (click)="replaceVideo()">Заменить файл</button>
              <button type="button" class="outline" (click)="replaceVideo()">Ссылка YouTube</button>
            </div>
            <div class="note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f5cff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>
              <span>Клиент видит это видео в плеере перед первым подходом. Оптимум — 20–40 с, вертикаль 9:16.</span>
            </div>
          </div>

          <div class="fields">
            <div class="field">
              <div class="label">НАЗВАНИЕ</div>
              <div class="value value--name">Присед со штангой</div>
            </div>

            <div class="field">
              <div class="label">НАПРАВЛЕНИЕ · ОДНО</div>
              <div class="segmented">
                @for (dir of directions; track dir.key) {
                  <button type="button" [class.is-active]="dir.key === direction()" (click)="direction.set(dir.key)">{{ dir.label }}</button>
                }
              </div>
            </div>

            <div class="field">
              <div class="label-row">
                <span class="label">ГРУППА МЫШЦ · МОЖНО НЕСКОЛЬКО</span>
                <span class="hint">ПЕРВАЯ = ОСНОВНАЯ</span>
              </div>
              <div class="chips">
                @for (m of muscles(); track m; let first = $first) {
                  <span class="chip" [class.chip--primary]="first">{{ m }} <button type="button" class="chip-x" (click)="removeMuscle(m)">✕</button></span>
                }
                <button type="button" class="chip-add" (click)="addMuscle()">＋ Добавить</button>
              </div>
            </div>

            <div class="field">
              <div class="label">КАТЕГОРИЯ · КАК СЧИТАЕТСЯ ПОДХОД</div>
              <div class="count-grid">
                @for (c of countKinds; track c.key) {
                  <button type="button" class="count" [class.is-active]="c.key === countKind()" (click)="countKind.set(c.key)">
                    <span class="radio"><span class="radio-dot"></span></span>
                    <span class="count-text"><span class="count-title">{{ c.title }}</span><span class="count-hint">{{ c.hint }}</span></span>
                  </button>
                }
              </div>
            </div>

            <div class="field">
              <div class="label-row">
                <span class="label">ОПИСАНИЕ · ВИДИТ КЛИЕНТ</span>
                <span class="counter">184 / 600</span>
              </div>
              <div class="value value--desc">Стопы на ширине плеч, носки чуть врозь. Спина нейтральная, взгляд вперёд. Опускайся до параллели бедра с полом, колени по линии стоп. Вверх — через пятку, без рывка в пояснице.</div>
            </div>
          </div>
        </div>

        @if (message()) { <p class="message">{{ message() }}</p> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .backdrop { min-height: 100dvh; background: #0e1116; display: flex; align-items: flex-start; justify-content: center; padding: clamp(1rem, 4vw, 2.5rem) 1rem; font-family: 'Golos Text', system-ui, sans-serif; }
    .modal { position: relative; width: 100%; max-width: 61.25rem; background: #14181d; border: 1px solid rgb(245 247 250 / 8%); border-radius: 1.25rem; overflow: hidden; box-shadow: 0 30px 90px rgb(20 24 29 / 34%); color: #f5f7fa; }
    .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.125rem 1.5rem; border-bottom: 1px solid rgb(245 247 250 / 6%); flex-wrap: wrap; }
    .head-left { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .kicker { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.12em; color: #8a94a6; }
    .name { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.125rem; color: #f5f7fa; }
    .usage { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .head-right { display: flex; align-items: center; gap: 0.625rem; }
    .ghost { border: 0; background: none; color: #8a94a6; font: inherit; font-size: 0.8125rem; cursor: pointer; }
    .save { border: 0; font: inherit; font-size: 0.875rem; font-weight: 700; color: #14181d; background: #c9f24b; padding: 0.625rem 1.125rem; border-radius: 0.5625rem; cursor: pointer; }
    .close { color: #8a94a6; text-decoration: none; font-size: 1rem; }
    .body { display: flex; }
    .video-col { width: 25rem; flex: none; padding: 1.5rem; border-right: 1px solid rgb(245 247 250 / 6%); display: flex; flex-direction: column; gap: 0.875rem; }
    .label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; }
    .video { border-radius: 0.875rem; overflow: hidden; border: 1px solid rgb(245 247 250 / 8%); position: relative; }
    .video-placeholder { height: 18.75rem; background: repeating-linear-gradient(135deg, #1c222b, #1c222b 14px, #20272f 14px, #20272f 28px); display: flex; align-items: center; justify-content: center; }
    .play { width: 3.375rem; height: 3.375rem; border-radius: 999px; background: #c9f24b; display: flex; align-items: center; justify-content: center; }
    .video-bar { position: absolute; left: 0; right: 0; bottom: 0; padding: 0.75rem 0.875rem; background: linear-gradient(to top, rgb(14 17 22 / 90%), transparent); display: flex; align-items: center; gap: 0.625rem; }
    .video-bar .track { flex: 1; height: 0.25rem; border-radius: 999px; background: rgb(245 247 250 / 20%); overflow: hidden; }
    .video-bar .track i { display: block; width: 38%; height: 100%; background: #c9f24b; }
    .video-bar .time { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #f5f7fa; }
    .video-actions { display: flex; gap: 0.5rem; }
    .outline { flex: 1; text-align: center; font: inherit; font-size: 0.75rem; font-weight: 600; color: #f5f7fa; background: #1c222b; border: 1px solid rgb(245 247 250 / 12%); padding: 0.6875rem; border-radius: 0.5625rem; cursor: pointer; }
    .note { display: flex; align-items: flex-start; gap: 0.5625rem; padding: 0.75rem 0.8125rem; background: rgb(47 92 255 / 10%); border-radius: 0.6875rem; }
    .note svg { flex: none; margin-top: 0.0625rem; }
    .note span { font-size: 0.75rem; line-height: 1.45; color: #8a94a6; }
    .fields { flex: 1; min-width: 0; padding: 1.5rem 1.625rem; display: flex; flex-direction: column; gap: 1.25rem; }
    .label-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .label-row .label, .field > .label { display: block; margin-bottom: 0.5rem; }
    .label-row .label { margin: 0; }
    .hint, .counter { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #5b6472; }
    .value { background: #1c222b; border: 1px solid rgb(245 247 250 / 10%); border-radius: 0.6875rem; padding: 0.8125rem 0.9375rem; color: #f5f7fa; }
    .value--name { font-size: 0.9375rem; font-weight: 600; }
    .value--desc { font-size: 0.875rem; line-height: 1.5; }
    .segmented { display: flex; gap: 0.375rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 6%); border-radius: 0.75rem; padding: 0.3125rem; }
    .segmented button { flex: 1; text-align: center; padding: 0.625rem 0; border: 0; border-radius: 0.5625rem; background: transparent; color: #8a94a6; font: inherit; font-weight: 500; font-size: 0.8125rem; cursor: pointer; }
    .segmented button.is-active { background: #c9f24b; color: #14181d; font-weight: 700; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.4375rem; }
    .chip { display: inline-flex; align-items: center; gap: 0.4375rem; font-size: 0.8125rem; font-weight: 600; color: #f5f7fa; background: #2a323d; padding: 0.5rem 0.75rem; border-radius: 0.5rem; }
    .chip--primary { color: #14181d; background: #c9f24b; font-weight: 700; }
    .chip-x { border: 0; background: none; color: #8a94a6; font: inherit; cursor: pointer; padding: 0; }
    .chip--primary .chip-x { color: rgb(20 24 29 / 45%); }
    .chip-add { display: inline-flex; align-items: center; gap: 0.375rem; font: inherit; font-size: 0.8125rem; color: #8a94a6; border: 1.5px dashed rgb(245 247 250 / 18%); background: transparent; padding: 0.4375rem 0.75rem; border-radius: 0.5rem; cursor: pointer; }
    .count-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
    .count { display: flex; align-items: center; gap: 0.6875rem; padding: 0.8125rem 0.875rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 8%); border-radius: 0.6875rem; text-align: left; font: inherit; cursor: pointer; color: inherit; }
    .count.is-active { border-color: #c9f24b; }
    .radio { width: 1.0625rem; height: 1.0625rem; border-radius: 999px; border: 2px solid rgb(245 247 250 / 20%); display: flex; align-items: center; justify-content: center; flex: none; }
    .count.is-active .radio { border-color: #c9f24b; }
    .radio-dot { width: 0.5rem; height: 0.5rem; border-radius: 999px; background: transparent; }
    .count.is-active .radio-dot { background: #c9f24b; }
    .count-text { display: flex; flex-direction: column; gap: 0.1875rem; }
    .count-title { font-size: 0.8125rem; font-weight: 600; color: #f5f7fa; }
    .count-hint { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .message { margin: 0; padding: 0 1.625rem 1rem; font-size: 0.75rem; color: #8a94a6; }
    @media (max-width: 860px) {
      .body { flex-direction: column; }
      .video-col { width: auto; border-right: 0; border-bottom: 1px solid rgb(245 247 250 / 6%); }
      .count-grid { grid-template-columns: 1fr; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseEditorComponent {
  protected readonly directions = DIRECTIONS;
  protected readonly countKinds = COUNT_KINDS;
  protected readonly direction = signal<Direction>('strength');
  protected readonly countKind = signal<CountKind>('load');
  protected readonly muscles = signal<string[]>(['Ноги', 'Кор', 'Спина']);
  protected readonly message = signal('');

  protected removeMuscle(name: string): void {
    this.muscles.update((items) => items.filter((m) => m !== name));
  }

  protected addMuscle(): void {
    this.message.set('Выбор групп мышц появится вместе с расширением модели упражнения.');
  }

  protected replaceVideo(): void {
    this.message.set('Загрузка видео появится вместе с хранилищем медиа.');
  }

  protected duplicate(): void {
    this.message.set('Дублирование появится вместе с сохранением упражнений.');
  }

  protected save(): void {
    this.message.set('Сохранение появится вместе с расширением модели упражнения на бэкенде.');
  }
}
