import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'tt-trainer-showcase-placeholder',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="page"><a class="back" routerLink="/trainer">← Сегодня</a><section><p>ВИТРИНА ТРЕНЕРА</p><h1>Ваша публичная<br /><em>витрина</em></h1><span>Здесь появится настройка профиля, программ, контактов и видимости блоков.</span><div class="url"><b>anton</b><i>.toptrainers.ru</i></div><a class="preview" href="https://anton.toptrainers.ru" target="_blank" rel="noopener noreferrer">Открыть пример витрины ↗</a><small>Редактор витрины появится следующим шагом.</small></section><nav><a routerLink="/trainer">Сегодня</a><a routerLink="/trainer/clients">Клиенты</a><a routerLink="/trainer/programs">Программы</a><a routerLink="/trainer/chats">Чаты</a><a routerLink="/trainer/competitions">Соревн.</a><a class="active" routerLink="/trainer/showcase">Витрина</a></nav></main>
  `,
  styles: `
    :host{display:block}.page{min-height:100dvh;box-sizing:border-box;padding:2rem;background:#14181d;color:#f5f7fa;font-family:'Golos Text',system-ui,sans-serif}.back{color:#8a94a6;text-decoration:none;font-size:.875rem}.page section{max-width:42rem;margin:10vh auto}.page p{font-family:'JetBrains Mono',monospace;font-size:.6875rem;letter-spacing:.12em;color:#c9f24b}.page h1{margin:.875rem 0 0;font-family:'Unbounded',sans-serif;font-size:clamp(2rem,6vw,4rem);line-height:1;letter-spacing:-.05em}.page h1 em{font-style:normal;color:#c9f24b}.page section>span{display:block;max-width:30rem;margin-top:1.25rem;color:#c7cdd6;line-height:1.55}.url{display:inline-flex;align-items:center;margin-top:2rem;padding:.75rem 1rem;border:1px solid rgb(201 242 75 / 25%);border-radius:.75rem;background:#1c222b;font-family:'JetBrains Mono',monospace}.url b{color:#c9f24b}.url i{font-style:normal;color:#8a94a6}.preview{display:flex;width:max-content;margin-top:1rem;padding:.875rem 1.125rem;border-radius:.6875rem;background:#c9f24b;color:#14181d;font-weight:700;text-decoration:none}.page small{display:block;margin-top:1rem;color:#8a94a6}nav{position:fixed;left:0;bottom:0;right:0;display:flex;justify-content:center;gap:1.5rem;padding:1rem;background:#0e1116;border-top:1px solid rgb(245 247 250 / 6%)}nav a{color:#8a94a6;text-decoration:none;font-size:.75rem}nav .active{color:#c9f24b;font-weight:700}@media(max-width:600px){.page{padding:1.25rem}.page section{margin:18vh 0}.preview{width:100%;justify-content:center}nav{justify-content:space-between;gap:.25rem;padding:.75rem .625rem;overflow-x:auto}nav a{font-size:.625rem;white-space:nowrap}}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainerShowcasePlaceholderComponent {}
