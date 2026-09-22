import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface LibraryItem { id: string; title: string; meta: string; }

interface Block {
  tag: string;
  name: string;
  category: string;
  group: 'A' | 'B';
  superset: boolean;
  sets: number;
  reps: string;
  weight: number | null;
  rest: number | null;
  timeSec?: number;
  chips?: string[];
}

const LIBRARY: readonly LibraryItem[] = [
  { id: 'rdl', title: 'Румынская тяга', meta: 'СИЛА · НОГИ · КГ×ПОВТ' },
  { id: 'legext', title: 'Разгибание ног', meta: 'СИЛА · НОГИ · КГ×ПОВТ' },
  { id: 'calf', title: 'Подъём на носки', meta: 'СИЛА · НОГИ · ПОВТ' },
  { id: 'sideplank', title: 'Боковая планка', meta: 'ВЫНОСЛ. · КОР · ВРЕМЯ' },
  { id: 'glute', title: 'Ягодичный мост', meta: 'СИЛА · НОГИ · КГ×ПОВТ' },
];

const INITIAL_BLOCKS: readonly Block[] = [
  { tag: 'A1', name: 'Присед со штангой', category: 'КГ × ПОВТОРЕНИЯ', group: 'A', superset: false, sets: 4, reps: '8', weight: 80, rest: 90 },
  { tag: 'A2', name: 'Румынская тяга', category: 'КГ × ПОВТОРЕНИЯ', group: 'A', superset: false, sets: 3, reps: '10', weight: 70, rest: 75, chips: ['3 × 10', '@ 70 кг', 'отдых 75 с'] },
  { tag: 'B1', name: 'Выпады с гантелями', category: '', group: 'B', superset: true, sets: 3, reps: '10 / нога', weight: 16, rest: null, chips: ['3 × 10 / нога', '@ 16 кг', 'без отдыха'] },
  { tag: 'B2', name: 'Планка на локтях', category: 'ВРЕМЯ, СЕК', group: 'B', superset: true, sets: 3, reps: '45 с', weight: null, rest: 60, chips: ['3 × 45 с', 'отдых 60 с'] },
];

@Component({
  selector: 'tt-workout-constructor',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="screen">
      <header class="toolbar">
        <div class="left">
          <a class="back" routerLink="/trainer/library"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Тренировки</a>
          <span class="wname">Ноги + кор</span>
          <span class="pill">{{ blocks().length }} УПР · ~55 МИН</span>
        </div>
        <div class="right">
          <span class="hotkeys">⌘S сохранить · D дубль</span>
          <button type="button" class="outline" (click)="preview()">Предпросмотр клиента</button>
          <button type="button" class="fill" (click)="save()">Сохранить</button>
        </div>
      </header>

      <div class="panels">
        <aside class="picker">
          <div class="picker-label">БИБЛИОТЕКА · ПЕРЕТАЩИТЕ В СПИСОК</div>
          <div class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b6472" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4.5-4.5" /></svg><span>Поиск упражнения</span></div>
          <div class="picker-chips"><span class="pc is-active">Ноги</span><span class="pc">Кор</span><span class="pc">Сила</span></div>
          <div class="picker-list">
            @for (item of library; track item.id) {
              <button type="button" class="pick-row" (click)="addFromLibrary(item)">
                <span class="pick-thumb"></span>
                <span class="pick-text"><span class="pick-name">{{ item.title }}</span><span class="pick-meta">{{ item.meta }}</span></span>
                <span class="pick-plus">＋</span>
              </button>
            }
          </div>
        </aside>

        <section class="editor">
          <div class="field">
            <div class="label">НАЗВАНИЕ ТРЕНИРОВКИ</div>
            <div class="value value--name">Ноги + кор</div>
          </div>
          <div class="field">
            <div class="label">ОПИСАНИЕ</div>
            <div class="value value--desc">База на квадрицепс и заднюю поверхность + кор в конце. Блок A — тяжёлый, отдых полный. Блок B — объёмный, темп держим.</div>
          </div>

          <div class="ex-head">
            <span class="label">УПРАЖНЕНИЯ · {{ blocks().length }}</span>
            <span class="label">объём: {{ totalSets() }} подходов · ~55 мин</span>
          </div>

          <div class="blocks">
            <div class="block-label">БЛОК A · СИЛА</div>
            @for (block of blocks(); track block.tag; let i = $index) {
              @if (block.tag === 'B1') { <div class="block-label">БЛОК B · ОБЪЁМ · СУПЕРСЕТ</div> }
              <article class="block" [class.is-selected]="block.tag === selectedTag()" [class.is-superset]="block.superset" (click)="select(block.tag)">
                <div class="block-row">
                  <span class="drag">⠿</span>
                  <span class="tag" [class.tag--blue]="block.tag === selectedTag()">{{ block.tag }}</span>
                  <span class="thumb"></span>
                  <span class="block-text"><span class="block-name">{{ block.name }}</span>@if (block.category) {<span class="block-cat">КАТЕГОРИЯ: {{ block.category }}</span>}</span>
                  <button type="button" class="rm" (click)="remove(block.tag); $event.stopPropagation()">✕</button>
                </div>
                @if (block.tag === selectedTag()) {
                  <div class="steppers">
                    <div class="stp"><div class="stp-label">ПОДХОДЫ</div><div class="stp-box"><button type="button" (click)="bump(block.tag,'sets',-1); $event.stopPropagation()">−</button><span>{{ block.sets }}</span><button type="button" class="plus" (click)="bump(block.tag,'sets',1); $event.stopPropagation()">+</button></div></div>
                    <span class="mult">×</span>
                    <div class="stp"><div class="stp-label">ПОВТОРЫ</div><div class="stp-box"><button type="button" (click)="bump(block.tag,'reps',-1); $event.stopPropagation()">−</button><span>{{ block.reps }}</span><button type="button" class="plus" (click)="bump(block.tag,'reps',1); $event.stopPropagation()">+</button></div></div>
                    <div class="stp"><div class="stp-label">ВЕС, КГ</div><div class="stp-box"><button type="button" (click)="bump(block.tag,'weight',-1); $event.stopPropagation()">−</button><span class="lime">{{ block.weight }}</span><button type="button" class="plus" (click)="bump(block.tag,'weight',1); $event.stopPropagation()">+</button></div></div>
                    <div class="stp"><div class="stp-label">ОТДЫХ</div><div class="stp-box"><button type="button" (click)="bump(block.tag,'rest',-1); $event.stopPropagation()">−</button><span>{{ block.rest }}</span><button type="button" class="plus" (click)="bump(block.tag,'rest',1); $event.stopPropagation()">+</button></div></div>
                  </div>
                } @else if (block.chips) {
                  <div class="chip-row">
                    @for (c of block.chips; track c; let first = $first; let last = $last) {
                      <span class="chip" [class.chip--lime]="!first && !last && block.weight !== null">{{ c }}</span>
                    }
                  </div>
                }
              </article>
            }
            <div class="add-row">
              <button type="button" class="dashed" (click)="addBlock()">＋ Упражнение</button>
              <button type="button" class="dashed" (click)="addBlock()">＋ Суперсет</button>
              <button type="button" class="dashed" (click)="addTask()">＋ Задача в конец</button>
            </div>
          </div>
        </section>

        <aside class="summary">
          <div class="sum-title">СВОДКА ТРЕНИРОВКИ</div>
          <div class="sum-scores">
            <div class="sum-cell"><span class="sum-val lime">{{ totalSets() }}</span><span class="sum-lbl">ПОДХОДОВ</span></div>
            <div class="sum-cell"><span class="sum-val">55</span><span class="sum-lbl">МИНУТ</span></div>
          </div>
          <div>
            <div class="label">НАГРУЗКА ПО ГРУППАМ</div>
            <div class="load">
              <div class="load-row"><div class="load-head">Ноги <span>11</span></div><div class="load-bar"><i style="width:78%;background:#c9f24b"></i></div></div>
              <div class="load-row"><div class="load-head">Кор <span>5</span></div><div class="load-bar"><i style="width:36%;background:#2f5cff"></i></div></div>
              <div class="load-row"><div class="load-head">Спина <span>2</span></div><div class="load-bar"><i style="width:14%;background:#8a94a6"></i></div></div>
            </div>
          </div>
          <div>
            <div class="label">ИСПОЛЬЗУЕТСЯ В ПРОГРАММАХ</div>
            <div class="used">
              <div class="used-row"><span>Гипертрофия · 8 нед</span><span class="x">×3</span></div>
              <div class="used-row"><span>Старт с нуля · 4 нед</span><span class="x">×1</span></div>
            </div>
          </div>
          <div class="warn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8833a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            <span>Правка тренировки обновит её во всех программах. Чтобы изменить точечно — «Дублировать».</span>
          </div>
          @if (message()) { <p class="message">{{ message() }}</p> }
        </aside>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .screen { min-height: 100dvh; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 1.125rem 1.75rem; border-bottom: 1px solid rgb(245 247 250 / 6%); gap: 1rem; flex-wrap: wrap; }
    .left { display: flex; align-items: center; gap: 0.875rem; flex-wrap: wrap; }
    .back { display: inline-flex; align-items: center; gap: 0.5rem; color: #8a94a6; text-decoration: none; font-size: 0.875rem; }
    .wname { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.125rem; color: #f5f7fa; }
    .pill { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; background: #1c222b; padding: 0.25rem 0.5rem; border-radius: 999px; }
    .right { display: flex; align-items: center; gap: 0.625rem; }
    .hotkeys { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; }
    .outline, .fill { font: inherit; font-weight: 600; font-size: 0.875rem; padding: 0.5625rem 1rem; border-radius: 0.5625rem; cursor: pointer; }
    .outline { border: 1px solid rgb(245 247 250 / 16%); background: transparent; color: #f5f7fa; }
    .fill { border: 0; font-weight: 700; color: #14181d; background: #c9f24b; }
    .panels { display: flex; min-height: calc(100dvh - 4.5rem); }
    .picker { width: 20rem; flex: none; border-right: 1px solid rgb(245 247 250 / 6%); padding: 1.25rem 1.125rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .picker-label, .label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; }
    .search { display: flex; align-items: center; gap: 0.5625rem; height: 2.5rem; padding: 0 0.8125rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 8%); border-radius: 0.625rem; color: #5b6472; font-size: 0.8125rem; }
    .picker-chips { display: flex; gap: 0.375rem; }
    .pc { font-size: 0.6875rem; color: #8a94a6; background: #1c222b; padding: 0.375rem 0.625rem; border-radius: 0.4375rem; }
    .pc.is-active { font-weight: 700; color: #14181d; background: #c9f24b; }
    .picker-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.25rem; }
    .pick-row { display: flex; align-items: center; gap: 0.6875rem; padding: 0.625rem; background: #1c222b; border: 0; border-radius: 0.6875rem; cursor: pointer; text-align: left; color: inherit; font: inherit; }
    .pick-thumb { width: 3.25rem; height: 2.375rem; border-radius: 0.4375rem; flex: none; background: repeating-linear-gradient(135deg, #242b34, #242b34 8px, #20272f 8px, #20272f 16px); }
    .pick-text { flex: 1; min-width: 0; }
    .pick-name { display: block; font-size: 0.8125rem; font-weight: 600; color: #f5f7fa; }
    .pick-meta { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #8a94a6; margin-top: 0.1875rem; }
    .pick-plus { color: #c9f24b; font-size: 1rem; }
    .editor { flex: 1; min-width: 0; border-right: 1px solid rgb(245 247 250 / 6%); padding: 1.5rem 1.75rem; }
    .field + .field { margin-top: 0.75rem; }
    .field .label { display: block; margin-bottom: 0.4375rem; }
    .value { background: #1c222b; border: 1px solid rgb(245 247 250 / 10%); border-radius: 0.6875rem; padding: 0.8125rem 0.9375rem; color: #f5f7fa; }
    .value--name { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.25rem; letter-spacing: -0.02em; }
    .value--desc { font-size: 0.875rem; line-height: 1.5; }
    .ex-head { display: flex; align-items: center; justify-content: space-between; margin: 1.5rem 0 0.75rem; }
    .blocks { display: flex; flex-direction: column; gap: 0.625rem; }
    .block-label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #c9f24b; margin-top: 0.5rem; }
    .block { background: #1c222b; border-radius: 0.875rem; padding: 0.9375rem 1.0625rem; border: 1px solid transparent; cursor: pointer; }
    .block.is-selected { border-color: #2f5cff; }
    .block.is-superset { border-left: 3px solid #c9f24b; }
    .block-row { display: flex; align-items: center; gap: 0.75rem; }
    .drag { color: #5b6472; }
    .tag { width: 1.625rem; height: 1.625rem; border-radius: 0.4375rem; background: #2a323d; color: #f5f7fa; font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; flex: none; }
    .tag--blue { background: #2f5cff; color: #fff; }
    .thumb { width: 3rem; height: 2.125rem; border-radius: 0.4375rem; flex: none; background: repeating-linear-gradient(135deg, #242b34, #242b34 8px, #20272f 8px, #20272f 16px); }
    .block-text { flex: 1; min-width: 0; }
    .block-name { display: block; font-weight: 600; font-size: 0.9375rem; color: #f5f7fa; }
    .block-cat { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #8a94a6; margin-top: 0.125rem; }
    .rm { border: 0; background: none; color: #5b6472; font: inherit; font-size: 0.875rem; cursor: pointer; }
    .steppers { display: flex; align-items: flex-end; gap: 0.625rem; margin-top: 0.8125rem; }
    .stp { flex: 1; }
    .stp-label { font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; letter-spacing: 0.08em; color: #8a94a6; margin-bottom: 0.3125rem; }
    .stp-box { display: flex; align-items: center; justify-content: space-between; background: #14181d; border-radius: 0.5625rem; padding: 0.5625rem 0.75rem; }
    .stp-box button { border: 0; background: none; color: #5b6472; font: inherit; font-size: 1rem; cursor: pointer; padding: 0; }
    .stp-box button.plus { color: #c9f24b; }
    .stp-box span { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1rem; color: #f5f7fa; }
    .stp-box span.lime { color: #c9f24b; }
    .mult { font-family: 'JetBrains Mono', monospace; color: #5b6472; padding-bottom: 0.6875rem; }
    .chip-row { display: flex; gap: 0.5rem; margin-top: 0.75rem; flex-wrap: wrap; }
    .chip { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; background: #14181d; color: #f5f7fa; padding: 0.4375rem 0.75rem; border-radius: 0.5rem; }
    .chip--lime { color: #c9f24b; }
    .add-row { display: flex; gap: 0.625rem; margin-top: 0.25rem; }
    .dashed { flex: 1; text-align: center; padding: 0.75rem; border: 1.5px dashed rgb(245 247 250 / 18%); border-radius: 0.75rem; background: transparent; color: #8a94a6; font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
    .summary { width: 18.75rem; flex: none; border-left: 1px solid rgb(245 247 250 / 6%); padding: 1.5rem 1.375rem; display: flex; flex-direction: column; gap: 1.125rem; }
    .sum-title { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #f5f7fa; font-weight: 700; }
    .sum-scores { display: flex; gap: 0.5rem; }
    .sum-cell { flex: 1; background: #1c222b; border-radius: 0.75rem; padding: 0.8125rem; }
    .sum-val { display: block; font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.375rem; color: #f5f7fa; }
    .sum-val.lime { color: #c9f24b; }
    .sum-lbl { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; letter-spacing: 0.08em; color: #8a94a6; margin-top: 0.25rem; }
    .load { display: flex; flex-direction: column; gap: 0.5625rem; margin-top: 0.625rem; }
    .load-head { display: flex; justify-content: space-between; font-size: 0.75rem; color: #f5f7fa; margin-bottom: 0.3125rem; }
    .load-head span { font-family: 'JetBrains Mono', monospace; color: #8a94a6; }
    .load-bar { height: 0.375rem; border-radius: 999px; background: rgb(245 247 250 / 8%); }
    .load-bar i { display: block; height: 100%; border-radius: 999px; }
    .used { display: flex; flex-direction: column; gap: 0.4375rem; margin-top: 0.625rem; }
    .used-row { display: flex; align-items: center; justify-content: space-between; background: #1c222b; border-radius: 0.625rem; padding: 0.6875rem 0.75rem; font-size: 0.8125rem; color: #f5f7fa; }
    .used-row .x { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; }
    .warn { margin-top: auto; display: flex; align-items: flex-start; gap: 0.5625rem; padding: 0.75rem 0.8125rem; background: rgb(232 131 58 / 10%); border-radius: 0.6875rem; }
    .warn svg { flex: none; margin-top: 0.0625rem; }
    .warn span { font-size: 0.75rem; line-height: 1.45; color: #8a94a6; }
    .message { margin: 0; font-size: 0.75rem; color: #8a94a6; }
    @media (max-width: 1200px) {
      .panels { flex-wrap: wrap; }
      .picker, .summary { width: 100%; border-right: 0; border-left: 0; border-bottom: 1px solid rgb(245 247 250 / 6%); }
      .editor { flex: 1 1 100%; border-right: 0; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutConstructorComponent {
  protected readonly library = LIBRARY;
  protected readonly blocks = signal<Block[]>([...INITIAL_BLOCKS.map((b) => ({ ...b }))]);
  protected readonly selectedTag = signal<string>('A1');
  protected readonly message = signal('');

  protected readonly totalSets = computed(() => this.blocks().reduce((sum, b) => sum + b.sets, 0));

  protected select(tag: string): void {
    this.selectedTag.set(tag);
  }

  protected bump(tag: string, field: 'sets' | 'reps' | 'weight' | 'rest', delta: number): void {
    this.blocks.update((items) =>
      items.map((b) => {
        if (b.tag !== tag) return b;
        if (field === 'sets') return { ...b, sets: Math.max(1, b.sets + delta) };
        if (field === 'weight') return { ...b, weight: Math.max(0, (b.weight ?? 0) + delta * 2.5) };
        if (field === 'rest') return { ...b, rest: Math.max(0, (b.rest ?? 0) + delta * 15) };
        const n = Number.parseInt(b.reps, 10);
        return { ...b, reps: Number.isNaN(n) ? b.reps : String(Math.max(1, n + delta)) };
      }),
    );
  }

  protected remove(tag: string): void {
    this.blocks.update((items) => items.filter((b) => b.tag !== tag));
  }

  protected addFromLibrary(item: LibraryItem): void {
    const next = this.blocks().length + 1;
    this.blocks.update((items) => [
      ...items,
      { tag: `A${next}`, name: item.title, category: 'КГ × ПОВТОРЕНИЯ', group: 'A', superset: false, sets: 3, reps: '10', weight: 20, rest: 60 },
    ]);
  }

  protected addBlock(): void {
    this.addFromLibrary({ id: 'new', title: 'Новое упражнение', meta: '' });
  }

  protected addTask(): void {
    this.message.set('Добавление задачи в тренировку появится вместе с модулем «Задачи».');
  }

  protected preview(): void {
    this.message.set('Предпросмотр клиента появится вместе с сохранением тренировки.');
  }

  protected save(): void {
    this.message.set('Сохранение появится вместе с обновлением модели тренировки.');
  }
}
