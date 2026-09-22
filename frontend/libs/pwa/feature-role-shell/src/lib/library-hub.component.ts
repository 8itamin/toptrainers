import { ChangeDetectionStrategy, Component, computed, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ExerciseEditorComponent } from './exercise-editor.component';
import {
  closeExerciseModal,
  openExerciseModal,
  type ExerciseModalMode,
  type ExerciseModalState,
} from './exercise-modal-state';
import { TrainerTasksComponent } from './trainer-tasks.component';
import { TrainerSidebarComponent } from './trainer-sidebar.component';

type Tab = 'exercises' | 'workouts' | 'programs' | 'tasks';
type Direction = 'all' | 'strength' | 'speed' | 'endurance' | 'mobility' | 'technique';
type ExerciseDirection = Exclude<Direction, 'all'>;

interface ExerciseCard {
  id: string;
  title: string;
  duration: string | null;
  direction: ExerciseDirection;
  directionLabel: string;
  directionTone: 'lime' | 'copper' | 'blue';
  group: string;
  count: string;
}

interface WorkoutRow { id: string; title: string; meta: string; tone: 'lime' | 'blue'; }
interface ProgramRow { id: string; title: string; meta: string; assigned: number; }

const DIRECTIONS: readonly { key: Direction; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'strength', label: 'Сила' },
  { key: 'speed', label: 'Скорость' },
  { key: 'endurance', label: 'Выносливость' },
  { key: 'mobility', label: 'Мобильность' },
  { key: 'technique', label: 'Техника' },
];

const MUSCLES: readonly { name: string; count: number }[] = [
  { name: 'Ноги', count: 42 }, { name: 'Грудь', count: 28 }, { name: 'Спина', count: 34 },
  { name: 'Плечи', count: 21 }, { name: 'Руки', count: 30 }, { name: 'Кор', count: 26 }, { name: 'Всё тело', count: 33 },
];

const EXERCISES: readonly ExerciseCard[] = [
  { id: 'squat', title: 'Присед со штангой', duration: '0:42', direction: 'strength', directionLabel: 'СИЛА', directionTone: 'lime', group: 'НОГИ', count: 'КГ×ПОВТ' },
  { id: 'legpress', title: 'Жим ногами', duration: '0:31', direction: 'strength', directionLabel: 'СИЛА', directionTone: 'lime', group: 'НОГИ', count: 'КГ×ПОВТ' },
  { id: 'lunges', title: 'Выпады с гантелями', duration: '0:28', direction: 'strength', directionLabel: 'СИЛА', directionTone: 'lime', group: 'НОГИ', count: 'КГ×ПОВТ' },
  { id: 'bulgarian', title: 'Болгарский присед', duration: null, direction: 'strength', directionLabel: 'СИЛА', directionTone: 'lime', group: 'НОГИ', count: 'ПОВТ' },
  { id: 'plank', title: 'Планка на локтях', duration: '0:19', direction: 'endurance', directionLabel: 'ВЫНОСЛ.', directionTone: 'blue', group: 'КОР', count: 'ВРЕМЯ' },
  { id: 'sprint', title: 'Спринт 30 м', duration: '0:24', direction: 'speed', directionLabel: 'СКОРОСТЬ', directionTone: 'copper', group: 'НОГИ', count: 'МЕТРЫ' },
  { id: 'pullups', title: 'Подтягивания', duration: '0:36', direction: 'strength', directionLabel: 'СИЛА', directionTone: 'lime', group: 'СПИНА', count: 'ПОВТ' },
];

const WORKOUTS: readonly WorkoutRow[] = [
  { id: 'legs', title: 'Ноги + кор', meta: '6 УПР · 55 МИН', tone: 'lime' },
  { id: 'chest', title: 'Грудь + трицепс', meta: '5 УПР · 50 МИН', tone: 'lime' },
  { id: 'back', title: 'Спина + бицепс', meta: '6 УПР · 55 МИН', tone: 'lime' },
  { id: 'cardio', title: 'Кардио + мобильность', meta: '4 УПР · 35 МИН', tone: 'blue' },
];

const PROGRAMS: readonly ProgramRow[] = [
  { id: 'hyper', title: 'Гипертрофия · 8 недель', meta: '17 трен · 9 задач', assigned: 14 },
  { id: 'start', title: 'Старт с нуля · 4 недели', meta: '8 трен · 4 задачи', assigned: 6 },
  { id: 'fatloss', title: 'Жиросжигание · 12 недель', meta: '24 трен · 12 задач', assigned: 9 },
];

@Component({
  selector: 'tt-library-hub',
  standalone: true,
  imports: [RouterLink, ExerciseEditorComponent, TrainerSidebarComponent, TrainerTasksComponent],
  template: `
    <div class="hub">
      <tt-trainer-sidebar />

      <div class="main">
        <div class="topbar">
          <div class="title-row">
            <div class="title-left">
              <span class="h1">Программы</span>
              <span class="sub">БИБЛИОТЕКА · 214 УПРАЖНЕНИЙ</span>
            </div>
            <div class="tools">
              <label class="search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b6472" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4.5-4.5" /></svg><input type="search" placeholder="Поиск по названию · /" /></label>
              <button type="button" class="add" (click)="openExerciseModal('create')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>Упражнение</button>
            </div>
          </div>
          <div class="tabs">
            <button type="button" [class.is-active]="tab() === 'exercises'" (click)="tab.set('exercises')">Упражнения <b>214</b></button>
            <button type="button" [class.is-active]="tab() === 'workouts'" (click)="tab.set('workouts')">Тренировки <b>38</b></button>
            <button type="button" [class.is-active]="tab() === 'programs'" (click)="tab.set('programs')">Программы <b>9</b></button>
            <button type="button" [class.is-active]="tab() === 'tasks'" (click)="tab.set('tasks')">Задачи <b>12</b></button>
          </div>
        </div>

        @switch (tab()) {
          @case ('exercises') {
            <div class="body">
              <aside class="filters">
                <h2>Фильтры</h2>
                <div class="filter-group">
                  <div class="filter-label">НАПРАВЛЕНИЕ</div>
                  <div class="dir-chips">
                    @for (d of directions; track d.key) {
                      <button type="button" class="dir" [class.is-active]="d.key === direction()" (click)="direction.set(d.key)">{{ d.label }}</button>
                    }
                  </div>
                </div>
                <div class="filter-group">
                  <div class="filter-label">ГРУППА МЫШЦ</div>
                  <div class="muscle-list">
                    @for (m of muscles; track m.name) {
                      <button type="button" class="muscle" [class.is-active]="selectedMuscles().has(m.name)" (click)="toggleMuscle(m.name)">
                        <span class="mcheck"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#14181d" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4 10-10" /></svg></span>
                        <span class="mname">{{ m.name }}</span>
                        <span class="mcount">{{ m.count }}</span>
                      </button>
                    }
                  </div>
                </div>
                <button type="button" class="reset" (click)="resetFilters()">Сброс фильтров</button>
              </aside>

              <div class="grid-col">
                <div class="grid-head">
                  <span>{{ exerciseFilterSummary() }} · {{ filteredExercises().length }} НАЙДЕНО</span>
                  <span>сортировка: по популярности ▾</span>
                </div>
                <div class="grid">
                  @for (ex of filteredExercises(); track ex.id) {
                    <button type="button" class="card" (click)="openExerciseModal('edit')">
                      <div class="card-media">
                        @if (ex.duration) { <span class="card-play"><svg width="16" height="16" viewBox="0 0 24 24" fill="#14181d" stroke="none"><path d="M8 5v14l11-7z" /></svg></span><span class="card-dur">{{ ex.duration }}</span> }
                        @else { <span class="card-novideo">БЕЗ ВИДЕО</span> }
                      </div>
                      <div class="card-body">
                        <div class="card-name">{{ ex.title }}</div>
                        <div class="card-tags">
                          <span class="ctag" [attr.data-tone]="ex.directionTone">{{ ex.directionLabel }}</span>
                          <span class="ctag ctag--muted">{{ ex.group }}</span>
                          <span class="ctag ctag--muted">{{ ex.count }}</span>
                        </div>
                      </div>
                    </button>
                  }
                  <button type="button" class="card card--add" (click)="openExerciseModal('create')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                    <span class="add-title">Новое упражнение</span>
                    <span class="add-hint">ИЛИ ПЕРЕТАЩИТЕ ВИДЕО</span>
                  </button>
                </div>
              </div>
            </div>
          }
          @case ('workouts') {
            <div class="rows">
              @for (w of workouts; track w.id) {
                <a class="row-item" routerLink="/trainer/library/workout">
                  <span class="row-bar" [attr.data-tone]="w.tone"></span>
                  <span class="row-text"><span class="row-name">{{ w.title }}</span><span class="row-meta">{{ w.meta }}</span></span>
                  <span class="row-arrow">›</span>
                </a>
              }
              <a class="row-add" routerLink="/trainer/library/workout">＋ Новая тренировка</a>
            </div>
          }
          @case ('programs') {
            <div class="rows">
              @for (p of programs; track p.id) {
                <a class="row-item" routerLink="/trainer/library/program">
                  <span class="row-text"><span class="row-name">{{ p.title }}</span><span class="row-meta">{{ p.meta }}</span></span>
                  <span class="row-assigned">НАЗНАЧЕНА {{ p.assigned }}</span>
                  <span class="row-arrow">›</span>
                </a>
              }
              <a class="row-add" routerLink="/trainer/library/program">＋ Новая программа</a>
            </div>
          }
          @case ('tasks') {
            <div class="tasks-wrap"><tt-trainer-tasks /></div>
          }
        }
      </div>

      @if (exerciseModal()) {
        <div class="exercise-overlay" (click)="closeExerciseModal()">
          <div class="exercise-dialog" role="dialog" aria-modal="true" [attr.aria-label]="exerciseModal()?.mode === 'create' ? 'Создание упражнения' : 'Редактирование упражнения'" (click)="$event.stopPropagation()">
            <tt-exercise-editor [embedded]="true" [mode]="exerciseModal()!.mode" (closeRequested)="closeExerciseModal()" />
          </div>
        </div>
      }

      <nav class="tabbar" aria-label="Навигация">
        <a class="tab" routerLink="/trainer"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9M5 10v10h14V10" /></svg><span>Сегодня</span></a>
        <a class="tab" routerLink="/trainer/clients"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="4" /><path d="M2 21c0-3.5 3-5 7-5M16 3.5a4 4 0 0 1 0 7.5M15 21c.5-3 3-5 7-5" /></svg><span>Клиенты</span></a>
        <a class="tab is-active" routerLink="/trainer/library"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 4v16" /></svg><span>Программы</span></a>
        <a class="tab" href="#chats"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8 8.4 8.4 0 0 1-4-1L3 20l1.5-4a8.4 8.4 0 0 1-1-4 8.4 8.4 0 0 1 8.5-8 8.4 8.4 0 0 1 9 7.5z" /></svg><span>Чаты</span></a>
        <a class="tab" href="#more"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg><span>Ещё</span></a>
      </nav>
    </div>
  `,
  styles: `
    :host { display: block; }
    .hub { min-height: 100dvh; background: #14181d; color: #f5f7fa; font-family: 'Golos Text', system-ui, sans-serif; }
    .sidebar { display: none; }
    .main { padding-bottom: 5.5rem; }
    .topbar { padding: 1.25rem 1.25rem 0; border-bottom: 1px solid rgb(245 247 250 / 6%); }
    .title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .title-left { display: flex; align-items: baseline; gap: 0.75rem; }
    .h1 { font-family: 'Unbounded', sans-serif; font-weight: 600; font-size: 1.375rem; letter-spacing: -0.02em; color: #f5f7fa; }
    .sub { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; letter-spacing: 0.08em; }
    .tools { display: flex; align-items: center; gap: 0.625rem; }
    .search { display: flex; align-items: center; gap: 0.5625rem; height: 2.5rem; padding: 0 0.875rem; background: #1c222b; border: 1px solid rgb(245 247 250 / 8%); border-radius: 0.625rem; color: #5b6472; }
    .search input { background: transparent; border: 0; color: #f5f7fa; font: inherit; font-size: 0.8125rem; min-width: 0; }
    .search input:focus { outline: none; }
    .add { display: flex; align-items: center; gap: 0.4375rem; border: 0; font: inherit; font-size: 0.875rem; font-weight: 700; color: #14181d; background: #c9f24b; padding: 0.6875rem 1rem; border-radius: 0.625rem; text-decoration: none; white-space: nowrap; cursor: pointer; }
    .tabs { display: flex; gap: 1.625rem; margin-top: 1.125rem; overflow-x: auto; }
    .tabs button { border: 0; background: none; font: inherit; font-weight: 500; font-size: 0.875rem; color: #8a94a6; padding-bottom: 0.75rem; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; }
    .tabs button.is-active { font-weight: 600; color: #f5f7fa; border-bottom-color: #c9f24b; }
    .tabs b { font-family: 'JetBrains Mono', monospace; font-weight: 400; font-size: 0.6875rem; color: #5b6472; }
    .tabs button.is-active b { color: #8a94a6; }
    .body { display: flex; flex-direction: column; }
    .filters { padding: 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 1.375rem; border-bottom: 1px solid rgb(245 247 250 / 6%); }
    .filters h2 { margin: 0; font-family: 'Unbounded', sans-serif; font-size: 0.875rem; color: #f5f7fa; }
    .filter-label { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.1em; color: #8a94a6; margin-bottom: 0.625rem; }
    .dir-chips { display: flex; flex-wrap: wrap; gap: 0.4375rem; }
    .dir { font: inherit; font-size: 0.75rem; font-weight: 500; color: #f5f7fa; background: #1c222b; border: 1px solid rgb(245 247 250 / 8%); padding: 0.4375rem 0.6875rem; border-radius: 0.5rem; cursor: pointer; }
    .dir.is-active { font-weight: 700; color: #14181d; background: #c9f24b; border-color: #c9f24b; }
    .muscle-list { display: flex; flex-direction: column; gap: 0.125rem; }
    .muscle { display: flex; align-items: center; justify-content: space-between; padding: 0.5625rem 0.625rem; border-radius: 0.5625rem; background: transparent; border: 0; cursor: pointer; font: inherit; }
    .muscle.is-active { background: #1c222b; }
    .mcheck { display: flex; align-items: center; justify-content: center; width: 0.9375rem; height: 0.9375rem; border-radius: 0.25rem; border: 1.5px solid rgb(245 247 250 / 18%); }
    .muscle.is-active .mcheck { background: #c9f24b; border-color: #c9f24b; }
    .muscle .mcheck svg { opacity: 0; }
    .muscle.is-active .mcheck svg { opacity: 1; }
    .mname { flex: 1; text-align: left; margin-left: 0.5625rem; font-size: 0.8125rem; color: #8a94a6; }
    .muscle.is-active .mname { color: #f5f7fa; font-weight: 600; }
    .mcount { font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #5b6472; }
    .cat-list { display: flex; flex-direction: column; gap: 0.4375rem; }
    .cat { display: flex; align-items: center; gap: 0.5625rem; padding: 0.625rem 0.75rem; border-radius: 0.5625rem; }
    .cat:first-child { background: #1c222b; border: 1px solid rgb(245 247 250 / 8%); }
    .cat-tag { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; background: #1c222b; padding: 0.1875rem 0.375rem; border-radius: 0.3125rem; }
    .cat:first-child .cat-tag { color: #c9f24b; background: rgb(201 242 75 / 12%); }
    .cat-name { font-size: 0.75rem; color: #8a94a6; }
    .cat:first-child .cat-name { color: #f5f7fa; }
    .reset { align-self: flex-start; font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #5b6472; background: none; border: 0; cursor: pointer; padding: 0; }
    .grid-col { padding: 1.25rem 1.25rem; }
    .grid-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.6875rem; color: #8a94a6; letter-spacing: 0.06em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: 0.875rem; }
    .card { width: 100%; padding: 0; text-align: left; font: inherit; background: #1c222b; border: 1px solid rgb(245 247 250 / 6%); border-radius: 1rem; overflow: hidden; text-decoration: none; color: inherit; cursor: pointer; }
    .card:first-child { border-color: #c9f24b; }
    .card-media { height: 7.375rem; background: repeating-linear-gradient(135deg, #1c222b, #1c222b 12px, #20272f 12px, #20272f 24px); display: flex; align-items: center; justify-content: center; position: relative; }
    .card-play { width: 2.375rem; height: 2.375rem; border-radius: 999px; background: rgb(201 242 75 / 90%); display: flex; align-items: center; justify-content: center; }
    .card-dur { position: absolute; right: 0.5625rem; bottom: 0.5625rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #f5f7fa; background: rgb(14 17 22 / 75%); padding: 0.1875rem 0.375rem; border-radius: 0.3125rem; }
    .card-novideo { position: absolute; left: 0.5625rem; top: 0.5625rem; font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; color: #e8833a; background: rgb(232 131 58 / 16%); padding: 0.1875rem 0.375rem; border-radius: 0.3125rem; }
    .card-body { padding: 0.8125rem 0.875rem 0.9375rem; }
    .card-name { font-weight: 600; font-size: 0.875rem; color: #f5f7fa; line-height: 1.3; }
    .card-tags { display: flex; flex-wrap: wrap; gap: 0.3125rem; margin-top: 0.625rem; }
    .ctag { font-family: 'JetBrains Mono', monospace; font-size: 0.5625rem; letter-spacing: 0.06em; padding: 0.25rem 0.4375rem; border-radius: 0.375rem; color: #c9f24b; background: rgb(201 242 75 / 12%); }
    .ctag[data-tone='copper'] { color: #e8833a; background: rgb(232 131 58 / 16%); }
    .ctag[data-tone='blue'] { color: #2f5cff; background: rgb(47 92 255 / 16%); }
    .ctag--muted { color: #8a94a6; background: #14181d; }
    .card--add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; border: 1.5px dashed rgb(245 247 250 / 18%); background: transparent; color: #8a94a6; min-height: 12.25rem; }
    .add-title { font-size: 0.8125rem; font-weight: 600; }
    .add-hint { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #5b6472; }
    .rows { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.625rem; }
    .row-item { display: flex; align-items: center; gap: 0.75rem; background: #1c222b; border-radius: 0.875rem; padding: 0.9375rem 1rem; text-decoration: none; color: inherit; }
    .row-bar { width: 0.25rem; align-self: stretch; border-radius: 999px; }
    .row-bar[data-tone='lime'] { background: #c9f24b; }
    .row-bar[data-tone='blue'] { background: #2f5cff; }
    .row-text { flex: 1; min-width: 0; }
    .row-name { display: block; font-weight: 600; font-size: 0.9375rem; color: #f5f7fa; }
    .row-meta { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; margin-top: 0.1875rem; }
    .row-assigned { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #c9f24b; background: rgb(201 242 75 / 12%); padding: 0.25rem 0.5rem; border-radius: 999px; }
    .row-arrow { color: #8a94a6; }
    .row-add { text-align: center; padding: 0.875rem; border: 1.5px dashed rgb(245 247 250 / 18%); border-radius: 0.875rem; color: #8a94a6; text-decoration: none; font-size: 0.8125rem; font-weight: 600; }
    .tasks-wrap { padding: 1.25rem; }
    .exercise-overlay { position: fixed; inset: 0; z-index: 20; display: grid; align-items: start; justify-items: center; overflow: auto; padding: clamp(1rem, 4vw, 2.5rem) 1rem; background: rgb(14 17 22 / 78%); }
    .exercise-dialog { width: min(100%, 61.25rem); }
    .tabbar { position: fixed; inset-inline: 0; bottom: 0; display: flex; justify-content: space-between; padding: 0.75rem 1.25rem calc(0.75rem + env(safe-area-inset-bottom)); background: #14181d; border-top: 1px solid rgb(245 247 250 / 6%); }
    .tab { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; color: #5b6472; text-decoration: none; font-size: 0.625rem; }
    .tab.is-active { color: #c9f24b; font-weight: 600; }

    @media (min-width: 1080px) {
      .hub { display: flex; }
      .tabbar { display: none; }
      .main { flex: 1; min-width: 0; padding-bottom: 0; }
      .sidebar { width: 5.5rem; flex: none; background: #0e1116; border-right: 1px solid rgb(245 247 250 / 6%); display: flex; flex-direction: column; align-items: center; padding: 1.5rem 0; gap: 1.625rem; }
      .sidebar-logo { color: #c9f24b; }
      .sidebar-nav { display: flex; flex-direction: column; align-items: center; gap: 1.375rem; margin-top: 0.5rem; }
      .side-item { display: flex; flex-direction: column; align-items: center; gap: 0.3125rem; color: #8a94a6; text-decoration: none; font-size: 0.5625rem; }
      .side-icon { display: flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; }
      .side-item.is-active { color: #c9f24b; font-weight: 600; }
      .side-item.is-active .side-icon { background: rgb(201 242 75 / 12%); }
      .sidebar-avatar { margin-top: auto; width: 2.5rem; height: 2.5rem; border-radius: 999px; background: repeating-linear-gradient(135deg, #2a323d, #2a323d 6px, #242b34 6px, #242b34 12px); }
      .topbar { padding: 1.5rem 1.75rem 0; }
      .body { flex-direction: row; }
      .filters { width: 15.5rem; flex: none; border-bottom: 0; border-right: 1px solid rgb(245 247 250 / 6%); }
      .grid-col { flex: 1; min-width: 0; padding: 1.375rem 1.75rem; }
    }
    @media (max-width: 860px) {
      .exercise-overlay { padding: 0; }
      .exercise-dialog { width: 100%; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryHubComponent {
  protected readonly directions = DIRECTIONS;
  protected readonly muscles = MUSCLES;
  protected readonly exercises = EXERCISES;
  protected readonly workouts = WORKOUTS;
  protected readonly programs = PROGRAMS;

  protected readonly tab = signal<Tab>('exercises');
  protected readonly exerciseModal = signal<ExerciseModalState | null>(null);
  protected readonly direction = signal<Direction>('all');
  protected readonly selectedMuscles = signal<ReadonlySet<string>>(new Set());
  protected readonly filteredExercises = computed(() => {
    const direction = this.direction();
    const selectedMuscles = this.selectedMuscles();

    return this.exercises.filter(
      (exercise) =>
        (direction === 'all' || exercise.direction === direction) &&
        (selectedMuscles.size === 0 || selectedMuscles.has(this.muscleNameFor(exercise.group))),
    );
  });
  protected readonly exerciseFilterSummary = computed(() => {
    const direction = this.directions.find((item) => item.key === this.direction())?.label ?? 'Все';
    const muscles = [...this.selectedMuscles()];

    return [direction, ...muscles].join(' · ').toLocaleUpperCase('ru-RU');
  });

  protected toggleMuscle(name: string): void {
    this.selectedMuscles.update((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  protected resetFilters(): void {
    this.direction.set('all');
    this.selectedMuscles.set(new Set());
  }

  protected openExerciseModal(mode: ExerciseModalMode): void {
    this.exerciseModal.set(openExerciseModal(mode));
  }

  protected closeExerciseModal(): void {
    this.exerciseModal.set(closeExerciseModal());
  }

  @HostListener('document:keydown.escape')
  protected closeExerciseModalOnEscape(): void {
    if (this.exerciseModal()) {
      this.closeExerciseModal();
    }
  }

  private muscleNameFor(group: string): string {
    return group.charAt(0) + group.slice(1).toLocaleLowerCase('ru-RU');
  }
}
