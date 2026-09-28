import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ExercisesApi } from '@toptrainers/shared/data-access';
import type { ExerciseResponse } from '@toptrainers/shared/contracts';

import { ExerciseEditorComponent } from './exercise-editor.component';
import {
  closeExerciseModal,
  openExerciseModal,
  type ExerciseModalMode,
  type ExerciseModalState,
} from './exercise-modal-state';
import { TrainerTasksComponent } from './trainer-tasks.component';
import { TrainerSidebarComponent } from './trainer-sidebar.component';
import { WorkoutConstructorComponent, type WorkoutPreview } from './workout-constructor.component';

type Tab = 'exercises' | 'workouts' | 'programs' | 'tasks';
type Direction = 'all' | 'strength' | 'speed' | 'agility' | 'cardio';
type ExerciseDirection = Exclude<Direction, 'all'>;

interface WorkoutRow extends WorkoutPreview { id: string; tone: 'lime' | 'blue'; }
interface ProgramRow { id: string; title: string; meta: string; assigned: number; }

const DIRECTIONS: readonly { key: Direction; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'strength', label: 'Сила' },
  { key: 'speed', label: 'Скорость' },
  { key: 'agility', label: 'Ловкость' },
  { key: 'cardio', label: 'Кардио' },
];

const MUSCLES: readonly { name: string; count: number }[] = [
  { name: 'Ноги', count: 42 }, { name: 'Грудь', count: 28 }, { name: 'Спина', count: 34 },
  { name: 'Плечи', count: 21 }, { name: 'Руки', count: 30 }, { name: 'Кор', count: 26 }, { name: 'Всё тело', count: 33 },
];

const WORKOUTS: readonly WorkoutRow[] = [
  { id: 'legs', title: 'Ноги + кор', description: 'База на квадрицепс и заднюю поверхность, в конце — упражнения на кор.', tags: ['Сила', 'Ноги', 'Кор'], exerciseCount: 6, durationMinutes: 55, tone: 'lime' },
  { id: 'chest', title: 'Грудь + трицепс', description: 'Жимовые движения для груди и трицепса с полным отдыхом между подходами.', tags: ['Сила', 'Грудь', 'Руки'], exerciseCount: 5, durationMinutes: 50, tone: 'lime' },
  { id: 'back', title: 'Спина + бицепс', description: 'Тяговая тренировка для спины и рук с акцентом на технику.', tags: ['Сила', 'Спина', 'Руки'], exerciseCount: 6, durationMinutes: 55, tone: 'lime' },
  { id: 'cardio', title: 'Кардио + мобильность', description: 'Кардио в комфортном темпе и упражнения на подвижность суставов.', tags: ['Кардио', 'Мобильность'], exerciseCount: 4, durationMinutes: 35, tone: 'blue' },
];

const PROGRAMS: readonly ProgramRow[] = [
  { id: 'hyper', title: 'Гипертрофия · 8 недель', meta: '17 трен · 9 задач', assigned: 14 },
  { id: 'start', title: 'Старт с нуля · 4 недели', meta: '8 трен · 4 задачи', assigned: 6 },
  { id: 'fatloss', title: 'Жиросжигание · 12 недель', meta: '24 трен · 12 задач', assigned: 9 },
];

@Component({
  selector: 'tt-library-hub',
  standalone: true,
  imports: [RouterLink, ExerciseEditorComponent, TrainerSidebarComponent, TrainerTasksComponent, WorkoutConstructorComponent],
  host: { '(document:keydown.escape)': 'closeModalOnEscape()' },
  template: `
    <div class="hub">
      <tt-trainer-sidebar />

      <div class="main">
        <div class="topbar">
          <div class="title-row">
            <div class="title-left">
              <span class="h1">Программы</span>
              <span class="sub">БИБЛИОТЕКА · {{ exercises().length }} УПРАЖНЕНИЙ</span>
            </div>
            <div class="tools">
              <label class="search"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5b6472" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4.5-4.5" /></svg><input type="search" placeholder="Поиск по названию · /" /></label>
              <button type="button" class="add" (click)="openExerciseModal('create')"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>Упражнение</button>
            </div>
          </div>
          <div class="tabs">
            <button type="button" [class.is-active]="tab() === 'exercises'" (click)="tab.set('exercises')">Упражнения <b>{{ exercises().length }}</b></button>
            <button type="button" [class.is-active]="tab() === 'workouts'" (click)="tab.set('workouts')">Тренировки <b>{{ workouts.length }}</b></button>
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
                    <button type="button" class="card" (click)="openExerciseModal('edit', ex)">
                      <div class="card-media">
                        @if (thumbnailUrl(ex); as thumbnail) { <img class="card-thumbnail" [src]="thumbnail" [alt]="ex.title" width="320" height="180" loading="eager" decoding="async" /> }
                        @if (ex.video_media_id) { <span class="card-play"><svg width="16" height="16" viewBox="0 0 24 24" fill="#14181d" stroke="none"><path d="M8 5v14l11-7z" /></svg></span><span class="card-dur">ВИДЕО</span> }
                        @else { <span class="card-novideo">БЕЗ ВИДЕО</span> }
                      </div>
                      <div class="card-body">
                        <div class="card-name">{{ ex.title }}</div>
                        <div class="card-tags">
                          <span class="ctag" [attr.data-tone]="directionTone(ex.direction)">{{ directionLabel(ex.direction) }}</span>
                          <span class="ctag ctag--muted">{{ ex.muscle_groups[0] || ex.muscle_group }}</span>
                          <span class="ctag ctag--muted">КГ×ПОВТ</span>
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
            <div class="rows workout-rows">
              <div class="workout-header" aria-hidden="true"><span>ТРЕНИРОВКА</span><span>ТЕГИ</span><span>УПРАЖНЕНИЙ</span><span>ВРЕМЯ</span></div>
              @for (w of workouts; track w.id) {
                <button type="button" class="workout-row" (click)="openWorkoutModal(w)" [attr.aria-label]="'Открыть тренировку ' + w.title">
                  <span class="workout-title-cell"><span class="row-bar" [attr.data-tone]="w.tone"></span><span class="row-text"><span class="row-name">{{ w.title }}</span><span class="workout-description" [title]="w.description">{{ w.description }}</span></span></span>
                  <span class="workout-tags">@for (tag of w.tags; track tag) { <span class="workout-tag">{{ tag }}</span> }</span>
                  <span class="workout-exercise-count">{{ w.exerciseCount }}</span>
                  <span class="workout-duration">{{ w.durationMinutes }} мин</span>
                </button>
              }
              <button type="button" class="row-add" (click)="openWorkoutModal()">＋ Новая тренировка</button>
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
            <tt-exercise-editor [embedded]="true" [mode]="exerciseModal()!.mode" [exercise]="selectedExercise()" (closeRequested)="closeExerciseModal()" (saved)="saveExercise($event)" />
          </div>
        </div>
      }

      @if (workoutModalOpen()) {
        <div class="workout-overlay" (click)="closeWorkoutModal()">
          <div class="workout-dialog" role="dialog" aria-modal="true" [attr.aria-label]="selectedWorkout() ? 'Тренировка ' + selectedWorkout()!.title : 'Новая тренировка'" (click)="$event.stopPropagation()">
            <tt-workout-constructor [embedded]="true" [workout]="selectedWorkout()" [availableExercises]="exercises()" [exerciseThumbnailUrls]="thumbnailUrls()" (closeRequested)="closeWorkoutModal()" />
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
    .card-thumbnail { display: block; width: 100%; height: 100%; object-fit: cover; }
    .card-play { position: absolute; inset: 0; width: 2.375rem; height: 2.375rem; margin: auto; border-radius: 999px; background: rgb(201 242 75 / 90%); display: flex; align-items: center; justify-content: center; }
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
    .workout-header, .workout-row { display: grid; grid-template-columns: minmax(15rem, 2.4fr) minmax(11rem, 1.6fr) minmax(7rem, .7fr) minmax(6rem, .7fr); align-items: center; gap: 1rem; }
    .workout-header { padding: 0.25rem 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; letter-spacing: 0.08em; color: #8a94a6; }
    .workout-row { width: 100%; min-height: 5rem; padding: 0.8125rem 1rem; text-align: left; font: inherit; color: inherit; background: #1c222b; border: 1px solid rgb(245 247 250 / 6%); border-radius: 0.875rem; cursor: pointer; }
    .workout-row:hover, .workout-row:focus-visible { border-color: #c9f24b; }
    .workout-title-cell { display: flex; align-items: stretch; gap: 0.75rem; min-width: 0; }
    .workout-title-cell .row-bar { flex: none; }
    .workout-description { display: block; margin-top: 0.25rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #8a94a6; font-size: 0.75rem; }
    .workout-tags { display: flex; flex-wrap: wrap; gap: 0.3125rem; }
    .workout-tag { padding: 0.3125rem 0.5rem; border-radius: 0.375rem; background: rgb(201 242 75 / 10%); color: #c9f24b; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; }
    .workout-exercise-count, .workout-duration { color: #f5f7fa; font-family: 'JetBrains Mono', monospace; font-size: 0.8125rem; white-space: nowrap; }
    .row-item { display: flex; align-items: center; gap: 0.75rem; background: #1c222b; border-radius: 0.875rem; padding: 0.9375rem 1rem; text-decoration: none; color: inherit; }
    .row-bar { width: 0.25rem; align-self: stretch; border-radius: 999px; }
    .row-bar[data-tone='lime'] { background: #c9f24b; }
    .row-bar[data-tone='blue'] { background: #2f5cff; }
    .row-text { flex: 1; min-width: 0; }
    .row-name { display: block; font-weight: 600; font-size: 0.9375rem; color: #f5f7fa; }
    .row-meta { display: block; font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #8a94a6; margin-top: 0.1875rem; }
    .row-assigned { font-family: 'JetBrains Mono', monospace; font-size: 0.625rem; color: #c9f24b; background: rgb(201 242 75 / 12%); padding: 0.25rem 0.5rem; border-radius: 999px; }
    .row-arrow { color: #8a94a6; }
    .row-add { text-align: center; padding: 0.875rem; border: 1.5px dashed rgb(245 247 250 / 18%); border-radius: 0.875rem; color: #8a94a6; background: transparent; text-decoration: none; font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
    .tasks-wrap { padding: 1.25rem; }
    .exercise-overlay { position: fixed; inset: 0; z-index: 20; display: grid; align-items: start; justify-items: center; overflow: auto; padding: clamp(1rem, 4vw, 2.5rem) 1rem; background: rgb(14 17 22 / 78%); }
    .exercise-dialog { width: min(100%, 61.25rem); }
    .workout-overlay { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 1rem; background: rgb(14 17 22 / 78%); }
    .workout-dialog { width: min(100%, 90rem); max-height: calc(100dvh - 2rem); overflow: auto; border: 1px solid rgb(245 247 250 / 12%); border-radius: 1rem; box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 35%); }
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
      .workout-overlay { padding: 0; }
      .workout-dialog { width: 100%; max-height: 100dvh; min-height: 100dvh; border: 0; border-radius: 0; }
      .workout-header { display: none; }
      .workout-row { grid-template-columns: 1fr auto; gap: 0.625rem; }
      .workout-title-cell, .workout-tags { grid-column: 1 / -1; }
      .workout-exercise-count::after { content: ' упр.'; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryHubComponent {
  private readonly exercisesApi = inject(ExercisesApi);

  protected readonly directions = DIRECTIONS;
  protected readonly muscles = MUSCLES;
  protected readonly exercises = signal<readonly ExerciseResponse[]>([]);
  protected readonly thumbnailUrls = signal<Readonly<Record<string, string>>>({});
  protected readonly workouts = WORKOUTS;
  protected readonly programs = PROGRAMS;
  protected readonly workoutModalOpen = signal(false);
  protected readonly selectedWorkout = signal<WorkoutRow | null>(null);

  protected readonly tab = signal<Tab>('exercises');
  protected readonly exerciseModal = signal<ExerciseModalState | null>(null);
  protected readonly selectedExercise = signal<ExerciseResponse | null>(null);
  protected readonly direction = signal<Direction>('all');
  protected readonly selectedMuscles = signal<ReadonlySet<string>>(new Set());
  protected readonly filteredExercises = computed(() => {
    const direction = this.direction();
    const selectedMuscles = this.selectedMuscles();

    return this.exercises().filter(
      (exercise) =>
        (direction === 'all' || exercise.direction === direction) &&
        (selectedMuscles.size === 0 || exercise.muscle_groups.some((group) => selectedMuscles.has(group))),
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

  constructor() {
    void this.loadExercises();
  }

  protected openExerciseModal(mode: ExerciseModalMode, exercise: ExerciseResponse | null = null): void {
    this.selectedExercise.set(mode === 'edit' ? exercise : null);
    this.exerciseModal.set(openExerciseModal(mode));
  }

  protected closeExerciseModal(): void {
    this.exerciseModal.set(closeExerciseModal());
    this.selectedExercise.set(null);
  }

  protected openWorkoutModal(workout: WorkoutRow | null = null): void {
    this.selectedWorkout.set(workout);
    this.workoutModalOpen.set(true);
  }

  protected closeWorkoutModal(): void {
    this.workoutModalOpen.set(false);
    this.selectedWorkout.set(null);
  }

  protected closeModalOnEscape(): void {
    if (this.exerciseModal()) {
      this.closeExerciseModal();
    } else if (this.workoutModalOpen()) {
      this.closeWorkoutModal();
    }
  }

  protected saveExercise(exercise: ExerciseResponse): void {
    this.exercises.update((current) => {
      const existingIndex = current.findIndex((item) => item.id === exercise.id);
      if (existingIndex < 0) return [exercise, ...current];
      return current.map((item) => (item.id === exercise.id ? exercise : item));
    });
    this.closeExerciseModal();
  }

  protected directionLabel(direction: ExerciseDirection): string {
    return this.directions.find((item) => item.key === direction)?.label.toLocaleUpperCase('ru-RU') ?? direction;
  }

  protected thumbnailUrl(exercise: ExerciseResponse): string | null {
    return this.thumbnailUrls()[exercise.thumbnail_media_id ?? ''] ?? exercise.thumbnail_url ?? null;
  }

  protected directionTone(direction: ExerciseDirection): 'lime' | 'copper' | 'blue' {
    if (direction === 'speed') return 'copper';
    if (direction === 'cardio') return 'blue';
    return 'lime';
  }

  private async loadExercises(): Promise<void> {
    try {
      this.exercises.set(await firstValueFrom(this.exercisesApi.list()));
      const mediaIds = [...new Set(
        this.exercises()
          .map((exercise) => exercise.thumbnail_media_id)
          .filter((mediaId): mediaId is string => Boolean(mediaId)),
      )];
      if (mediaIds.length === 0) return;
      const previews = await firstValueFrom(this.exercisesApi.createThumbnailReadUrls(mediaIds));
      this.thumbnailUrls.update((current) => ({
        ...current,
        ...Object.fromEntries(previews.map((preview) => [preview.media_id, preview.read_url])),
      }));
    } catch {
      this.exercises.set([]);
    }
  }
}
