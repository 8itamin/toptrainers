import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tt-showcase-home',
  standalone: true,
  template: `
    <main class="landing">
      <header class="topbar shell">
        <a class="brand" href="/" aria-label="TopTrainers — главная">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 8-7 8 7M4 19l8-7 8 7" /></svg>
          <span>toptrainers</span>
        </a>
        <nav aria-label="Навигация">
          <a href="#opportunities">Возможности</a>
          <a href="#competition">Соревнования</a>
          <a href="#showcase">Витрины</a>
          <a href="#pricing">Тарифы</a>
        </nav>
        <div class="nav-actions">
          <a class="outline-button" href="https://app.toptrainers.ru/trainer">Войти</a>
          <a class="nav-cta" href="https://app.toptrainers.ru/trainer">Начать бесплатно</a>
        </div>
      </header>

      <section class="hero shell">
        <div class="hero-copy">
          <p class="eyebrow"><i></i> ПЛАТФОРМА ДЛЯ ТРЕНЕРОВ И КЛИЕНТОВ</p>
          <h1>Где тренеры растят <em>чемпионов</em></h1>
          <p class="lead">Инструмент, витрина и соревнования в одном приложении. Тренировки, оплаты и прогресс клиентов — без Excel, WhatsApp и App Store.</p>
          <div class="hero-actions">
            <a class="lime-button" href="https://app.toptrainers.ru/trainer">Создать кабинет тренера <span>→</span></a>
            <a class="ghost-button" href="https://app.toptrainers.ru/client">Я клиент — войти по ссылке</a>
          </div>
          <div class="hero-proof"><span>✓ Первые 3 клиента бесплатно</span><span>✓ Перенос из Excel под ключ</span></div>
        </div>
        <aside class="mission-card" aria-label="Цели первого года">
          <p>ЦЕЛЬ ПЕРВОГО ГОДА · ТАБЛО</p>
          <div class="mission-grid">
            <div><b>1 500<i>+</i></b><span>активных тренеров</span></div>
            <div><b>25K<i>+</i></b><span>довольных клиентов</span></div>
            <div><b>100<i>+</i></b><span>соревнований</span></div>
            <div><b class="lime">№1</b><span>в нише РФ</span></div>
          </div>
        </aside>
      </section>

      <section class="pulse shell" aria-label="Лента недели">
        <div class="pulse-head">
          <p>ЛЕНТА НЕДЕЛИ <span>·</span> ФИРМЕННЫЙ ПУЛЬС</p>
          <b class="pulse-streak">🔥 12</b>
        </div>
        <div class="pulse-track"><i></i><i></i><i class="muted"></i><i></i><i></i><i class="alert"></i><i class="future"></i></div>
        <div class="pulse-days"><span>ПН</span><span>ВТ</span><span>СР</span><span>ЧТ</span><span>ПТ</span><span>СБ</span><span>ВС</span></div>
      </section>

      <section class="migration-strip" aria-label="Переезд на TopTrainers">
        <div class="shell"><span>ПЕРЕЕЗЖАЙ С</span><s>Trainerize</s><s>TrueCoach</s><s>Google Sheets</s><s>WhatsApp</s><b>→ TOPTRAINERS</b></div>
      </section>

      <section id="product" class="problem shell">
        <div class="section-kicker">01 <span>ПРОБЛЕМА</span></div>
        <h2>Trainerize и TrueCoach<br />больше <em>не оплатить</em></h2>
        <p>Хватит вести клиентов в Google-таблицах, WhatsApp и Telegram: хаос в программах, ручной сбор оплат, ноль аналитики прогресса.</p>
      </section>

      <section id="opportunities" class="ecosystem shell" aria-label="Три слоя экосистемы">
        <div class="section-kicker">02 <span>ТРИ СЛОЯ ОДНОЙ ЭКОСИСТЕМЫ</span></div>
        <div class="section-heading"><h2>Всё, что раньше жило<br />в пяти сервисах</h2><p>Всё нужное для роста тренера — от первой программы до собственного медиа и сообщества.</p></div>
        <div class="layer-grid">
          <article class="layer tool"><span>01</span><h3>Приложение</h3><p>Кабинет, конструктор программ, CRM клиентов и чаты. На десктопе — «режим силы».</p><ul><li>Программы и тренировки</li><li>Клиенты и прогресс</li><li>Команды и клубы</li></ul></article>
          <article class="layer market"><span>02</span><h3>Маркетплейс</h3><p>Витрина-сайт на поддомене, каталог тренеров и товары. SEO-трафик без своего сайта.</p><ul><li>Страница тренера</li><li>Программы и офферы</li><li>Рекомендации</li></ul></article>
          <article class="layer game"><span>03</span><h3>Азарт</h3><p>Соревнования, стрики, команды и клубы, рейтинг по результатам подопечных.</p><ul><li>Челленджи</li><li>Команды и клубы</li><li>Достижения</li></ul></article>
        </div>
      </section>

      <section id="advantages" class="advantages shell">
        <div class="section-kicker">03 <span>ПРЕИМУЩЕСТВО</span></div>
        <h2>Чего нет<br />ни у кого</h2>
        <div class="advantage-list">
          <article><b>01</b><div><h3>Рейтинг по результатам подопечных</h3><p>Верифицированные дельты замеров и медали, а не только отзывы.</p></div></article>
          <article><b>02</b><div><h3>Без магазинов приложений</h3><p>PWA на телефон в один тап, офлайн и push. Без App Store и RuStore.</p></div></article>
          <article><b>03</b><div><h3>Витрина-сайт на поддомене</h3><p>Твоя страница с программами и товарами внутри TopTrainers.</p></div></article>
          <article><b>04</b><div><h3>Соревнования как продукт</h3><p>Продавай участие: команды и клубы соревнуются между собой.</p></div></article>
        </div>
        <aside id="showcase" class="showcase-preview" aria-label="Предпросмотр витрины тренера"><span>ВИТРИНА ТРЕНЕРА</span><strong>ivanov<br />.toptrainers.ru</strong><small>Программы · товары · результаты</small></aside>
      </section>

      <section id="pricing" class="pricing shell">
        <div class="section-kicker">04 <span>ТАРИФЫ ТРЕНЕРА</span></div>
        <h2>Платишь, когда растёшь</h2>
        <div class="price-grid">
          <article><p>Старт</p><h3>0 ₽</h3><span>до 3 клиентов · комиссия 7%</span><a href="https://app.toptrainers.ru/trainer">Начать</a></article>
          <article class="featured"><i>ХИТ</i><p>Профи</p><h3>1 490 ₽</h3><span>до 30 · витрина, товары, 4%</span><a href="https://app.toptrainers.ru/trainer">Выбрать</a></article>
          <article><p>Бизнес</p><h3>3 490 ₽</h3><span>до 100 · аналитика, 3%</span><a href="https://app.toptrainers.ru/trainer">Выбрать</a></article>
          <article><p>Клуб / Студия</p><h3>7 990 ₽</h3><span>без лимита · API, 2,5%</span><a href="mailto:hello@toptrainers.ru">Связаться</a></article>
        </div>
      </section>

      <section id="competition" class="competition shell">
        <div class="section-kicker">05 <span>СОРЕВНОВАНИЯ</span></div>
        <div class="section-heading"><h2>Азарт —<br /><em>часть тренировки</em></h2><p>Создавай челленджи, объединяй клиентов в команды и показывай результат на общем табло.</p></div>
        <div class="layer-grid"><article class="layer tool"><span>01</span><h3>Челленджи</h3><p>Личные и командные цели, стрики и достижения.</p></article><article class="layer market"><span>02</span><h3>Команды и клубы</h3><p>Объединяй участников вокруг общей цели.</p></article><article class="layer game"><span>03</span><h3>Рейтинг</h3><p>Результат подопечных — главный показатель тренера.</p></article></div>
      </section>

      <section class="final shell">
        <div><p>ПЕРВЫЙ ШАГ</p><h2>Первые 3 клиента —<br />навсегда бесплатно</h2><span>Перенесём твои программы из Excel вручную. Онбординг за 10 минут.</span></div>
        <a href="https://app.toptrainers.ru/trainer">Создать кабинет <b>→</b></a>
      </section>

      <footer class="footer shell"><a class="brand" href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 8-7 8 7M4 19l8-7 8 7" /></svg><span>toptrainers.ru</span></a><nav><a href="#product">Тренерам</a><a href="https://app.toptrainers.ru/client">Клиентам</a><a href="#competition">Соревнования</a><a href="mailto:hello@toptrainers.ru">Контакты</a></nav><small>© 2026</small></footer>
    </main>
  `,
  styles: `
    :host{display:block}.landing{min-height:100vh;overflow:hidden;background:#14181d;color:#f5f7fa;font-family:"Golos Text","Segoe UI",sans-serif}.shell{width:min(100% - 48px,1200px);margin-inline:auto}.topbar{height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:inline-flex;align-items:center;gap:9px;color:#f5f7fa;text-decoration:none;font-weight:700;font-size:17px;letter-spacing:-.02em}.brand svg{width:24px;height:24px;stroke:#c9f24b;stroke-width:2.6;fill:none;stroke-linecap:round;stroke-linejoin:round}.topbar nav,.footer nav{display:flex;gap:28px}.topbar nav a,.footer nav a{color:#8a94a6;text-decoration:none;font-size:14px}.topbar nav a:hover,.footer nav a:hover{color:#c9f24b}.outline-button{border:1px solid rgb(245 247 250 / .24);border-radius:9px;padding:11px 19px;color:#f5f7fa;font-size:14px;font-weight:600;text-decoration:none}.nav-actions{display:flex;align-items:center;gap:12px}.nav-cta{display:inline-flex;align-items:center;justify-content:center;background:#c9f24b;color:#14181d;font-weight:700;font-size:15px;padding:11px 20px;border-radius:9px;text-decoration:none}.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;padding:72px 0 80px}.eyebrow,.mission-card>p,.pulse p,.section-kicker,.final>div>p,.migration-strip span,.showcase-preview>span{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.13em;color:#8a94a6}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;margin:0;border:1px solid rgb(201 242 75 / .25);border-radius:999px;color:#c9f24b;background:rgb(201 242 75 / .08)}.eyebrow i{width:6px;height:6px;background:#c9f24b;border-radius:50%}.hero h1,.problem h2,.section-heading h2,.advantages h2,.pricing h2,.final h2{font-family:"Unbounded","Arial Black",sans-serif;font-weight:700;letter-spacing:-.05em}.hero h1{max-width:720px;margin:26px 0 0;font-size:clamp(48px,5.5vw,66px);line-height:1}.hero h1 em,.section-heading em{font-style:normal;color:#c9f24b}.problem em{font-style:normal;color:#e8833a}.lead{max-width:540px;margin:24px 0 0;color:#b9c2cc;font-size:19px;line-height:1.5}.hero-actions{display:flex;gap:14px;margin-top:34px}.lime-button,.ghost-button{display:inline-flex;align-items:center;justify-content:center;gap:16px;min-height:54px;border-radius:11px;padding:0 24px;text-decoration:none;font-weight:700;font-size:16px}.lime-button{background:#c9f24b;color:#14181d}.lime-button span{font-size:22px}.ghost-button{border:1px solid rgb(245 247 250 / .2);color:#f5f7fa}.hero-proof{display:flex;flex-wrap:wrap;gap:18px 22px;margin-top:28px;color:#8a94a6;font-size:14px}.hero-proof span::first-letter{color:#c9f24b}.mission-card{padding:30px;background:#1c222b;border:1px solid rgb(245 247 250 / .07);border-radius:22px;box-shadow:0 24px 60px rgb(0 0 0 / .35)}.mission-card>p{margin:0 0 25px}.mission-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px 20px}.mission-grid div{display:grid;gap:6px}.mission-grid b{font-family:"Unbounded",sans-serif;font-size:30px;letter-spacing:-.06em}.mission-grid b i{font-style:normal;color:#c9f24b}.mission-grid small{font-family:inherit;font-size:13px;color:#8a94a6}.mission-grid span{color:#8a94a6;font-size:13px}.lime{color:#c9f24b}.pulse{padding:0 0 72px}.pulse-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.pulse-head p{margin:0}.pulse p span{color:#c9f24b}.pulse-streak{font-family:"JetBrains Mono",monospace;font-weight:700;font-size:13px;color:#e8833a}.pulse-days{display:flex;justify-content:space-between;margin-top:8px;font-family:"JetBrains Mono",monospace;font-size:10px;color:#8a94a6}.pulse-track{display:flex;gap:6px;padding:12px;border:1px solid rgb(245 247 250 / .07);border-radius:999px;background:#1c222b}.pulse-track i{height:14px;flex:1;background:#c9f24b;border-radius:999px}.pulse-track .muted{background:rgb(245 247 250 / .1)}.pulse-track .alert{background:rgb(255 77 94 / .55)}.pulse-track .future{background:transparent;border:1px dashed rgb(245 247 250 / .24)}.migration-strip{border-block:1px solid rgb(245 247 250 / .06);background:#1c222b}.migration-strip>div{display:flex;align-items:center;justify-content:center;gap:16px;padding:20px 0}.migration-strip s{color:#5b6472;font-size:16px;font-weight:600}.migration-strip b{font-family:"JetBrains Mono",monospace;color:#c9f24b;font-size:12px}.problem{padding:96px 0 72px}.section-kicker{display:flex;gap:18px;color:#c9f24b}.section-kicker span{color:#8a94a6}.problem h2{margin:26px 0 0;font-size:clamp(36px,5vw,60px);line-height:1.06}.problem>p{max-width:640px;margin:24px 0 0;color:#aeb6c4;font-size:18px;line-height:1.55}.ecosystem,.advantages,.pricing{padding:80px 0}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:40px;margin:22px 0 44px}.section-heading h2,.advantages h2{margin:0;font-size:clamp(34px,4.6vw,58px);line-height:1.08}.section-heading>p{max-width:360px;margin:0;color:#aeb6c4;font-size:16px;line-height:1.55}.layer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.layer{min-height:300px;padding:30px;border-radius:18px;background:#1c222b}.layer>span{font-family:"JetBrains Mono",monospace;color:#8a94a6;font-size:12px}.layer h3{margin:42px 0 10px;font-family:"Unbounded",sans-serif;font-size:22px;letter-spacing:-.04em}.layer p{min-height:66px;margin:0;color:#b9c2cc;line-height:1.55}.layer ul{display:none}.tool{border-top:3px solid #2f5cff}.market{border-top:3px solid #c9f24b}.game{border-top:3px solid #e7b54a}.advantages{display:grid;grid-template-columns:.7fr 1.1fr .9fr;gap:56px;align-items:center}.advantages .section-kicker{grid-column:1/-1}.advantage-list{border-top:1px solid rgb(245 247 250 / .12)}.advantage-list article{display:grid;grid-template-columns:38px 1fr;gap:16px;padding:20px 0;border-bottom:1px solid rgb(245 247 250 / .12)}.advantage-list b{font-family:"JetBrains Mono",monospace;color:#c9f24b;font-size:13px}.advantage-list h3{margin:0;font-size:18px}.advantage-list p{margin:7px 0 0;color:#8a94a6;line-height:1.5}.showcase-preview{height:400px;display:flex;flex-direction:column;justify-content:end;gap:14px;padding:30px;border:1px solid rgb(245 247 250 / .08);border-radius:22px;background:linear-gradient(180deg,transparent 35%,rgb(20 24 29 / .92)),repeating-linear-gradient(135deg,#1c222b,#1c222b 14px,#20272f 14px,#20272f 28px)}.showcase-preview strong{font-family:"Unbounded",sans-serif;font-size:25px;line-height:1.2;color:#f5f7fa}.showcase-preview small{color:#8a94a6}.price-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.price-grid article{min-height:250px;display:flex;flex-direction:column;padding:28px;border:1px solid rgb(245 247 250 / .08);border-radius:18px;background:#1c222b}.price-grid h3{margin:16px 0 4px;font-family:"Unbounded",sans-serif;font-size:32px;letter-spacing:-.05em;color:#c9f24b}.price-grid span{color:#8a94a6;font-size:13px}.price-grid a{margin-top:auto;padding:12px;border:1px solid rgb(245 247 250 / .18);border-radius:9px;color:#f5f7fa;text-align:center;text-decoration:none;font-size:14px;font-weight:600}.price-grid .featured{position:relative;border-color:#2f5cff}.price-grid i{font-style:normal;color:#fff;background:#2f5cff;border-radius:999px;padding:3px 7px;font-size:10px}.price-grid .featured i{position:absolute;top:-11px;left:28px}.price-grid p{margin:0;font-family:"Unbounded",sans-serif;font-weight:600;font-size:18px;color:#f5f7fa;letter-spacing:-.02em}.pricing h2{margin:26px 0 44px;font-size:clamp(30px,3.8vw,42px);line-height:1.1}.final{display:flex;align-items:center;justify-content:space-between;gap:40px;margin-top:24px;margin-bottom:76px;padding:58px 60px;border-radius:24px;background:#c9f24b;color:#14181d}.final>div>p{margin:0;color:#4a5526}.final h2{margin:16px 0 0;font-size:clamp(30px,4vw,50px);line-height:1.1}.final span{display:block;margin-top:15px;opacity:.68}.final>a{display:inline-flex;align-items:center;gap:18px;white-space:nowrap;border-radius:11px;padding:19px 25px;background:#14181d;color:#f5f7fa;text-decoration:none;font-weight:700}.final b{font-size:21px}.footer{display:flex;align-items:center;justify-content:space-between;padding:32px 0 40px;border-top:1px solid rgb(245 247 250 / .08)}.footer .brand{font-size:14px}.footer .brand span{color:#8a94a6}.footer small{font-family:"JetBrains Mono",monospace;color:#5b6472;font-size:11px}@media(max-width:800px){.shell{width:min(100% - 44px,600px)}.topbar{height:72px}.topbar nav{display:none}.outline-button{padding:9px 14px}.nav-cta{display:none}.hero{grid-template-columns:1fr;gap:30px;padding:46px 0 36px}.hero h1{font-size:42px}.lead{font-size:15px}.hero-actions{flex-direction:column;margin-top:24px}.hero-proof{font-size:13px;gap:10px;display:grid}.mission-card{padding:22px}.pulse{padding-bottom:30px}.migration-strip>div{justify-content:flex-start;overflow:hidden;white-space:nowrap;gap:14px}.migration-strip span,.migration-strip b{font-size:10px}.migration-strip s{font-size:13px}.problem,.ecosystem,.advantages,.pricing{padding:56px 0}.problem h2{font-size:22px}.problem>p{font-size:14.5px}.section-heading{display:block;margin-bottom:28px}.section-heading>p{margin-top:18px}.layer-grid,.price-grid{grid-template-columns:1fr}.layer{min-height:auto;padding:18px;border-radius:14px}.layer>span{display:none}.layer h3{margin:0;font-size:15px}.layer p{min-height:auto;margin-top:5px;font-size:13px}.advantages{grid-template-columns:1fr;gap:30px}.advantages .section-kicker{grid-column:auto}.advantages h2{font-size:22px}.pricing h2{font-size:22px;margin:20px 0 24px}.showcase-preview{height:200px;order:4;padding:22px;border-radius:16px}.showcase-preview strong{font-size:18px}.price-grid{gap:10px}.price-grid article{min-height:0;display:grid;grid-template-columns:1fr auto;align-items:center;padding:15px 18px;border-radius:12px}.price-grid h3{grid-column:2;grid-row:1/3;margin:0;font-size:18px;color:#f5f7fa}.price-grid span{font-size:12px}.price-grid a{display:none}.final{display:block;margin-bottom:42px;padding:31px 24px;border-radius:19px}.final>a{width:100%;justify-content:center;margin-top:25px}.footer{align-items:flex-start;gap:24px;flex-wrap:wrap}.footer nav{order:3;width:100%;gap:18px;flex-wrap:wrap}.footer small{margin-left:auto}}@media(max-width:380px){.shell{width:min(100% - 28px,600px)}.hero h1{font-size:38px}.mission-grid b{font-size:23px}.final h2{font-size:28px}}
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseHomeComponent {}
