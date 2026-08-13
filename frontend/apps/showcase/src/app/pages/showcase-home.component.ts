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
          <a href="#opportunities">Соревнования</a>
          <a href="#showcase">Витрины</a>
          <a href="#pricing">Тарифы</a>
        </nav>
        <div class="nav-actions">
          <a class="outline-button" href="https://app.toptrainers.ru/auth?mode=login">Войти</a>
          <a class="nav-cta" href="https://app.toptrainers.ru/auth?mode=login">Войти</a>
        </div>
      </header>

      <section class="hero shell">
        <div class="hero-copy">
          <p class="eyebrow"><i></i> ПЛАТФОРМА ДЛЯ ТРЕНЕРОВ И КЛИЕНТОВ</p>
          <h1>Где тренеры растят <em>чемпионов</em></h1>
          <p class="lead">Инструмент, витрина и соревнования в одном приложении. Тренировки, оплаты и прогресс клиентов — без Excel, WhatsApp и App Store.</p>
          <div class="hero-actions">
            <a class="lime-button" href="https://app.toptrainers.ru/auth?mode=register&role=trainer">Создать кабинет тренера <span>→</span></a>
            <a class="ghost-button" href="https://app.toptrainers.ru/auth?mode=login&role=client">Я клиент — войти по ссылке</a>
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
          <div class="mission-pulse">
            <div class="pulse-head">
              <p>ЛЕНТА НЕДЕЛИ</p>
              <b class="pulse-streak">🔥 12</b>
            </div>
            <div class="pulse-track"><i></i><i></i><i class="muted"></i><i></i><i></i><i class="alert"></i><i class="future"></i></div>
            <div class="pulse-days"><span>ПН</span><span>ВТ</span><span>СР</span><span>ЧТ</span><span>ПТ</span><span>СБ</span><span>ВС</span></div>
          </div>
        </aside>
      </section>

      <section class="migration-strip" aria-label="Переезд на TopTrainers">
        <div class="shell"><span>ПЕРЕЕЗЖАЙ С</span><s>Trainerize</s><s>TrueCoach</s><s>Google Sheets</s><s>WhatsApp</s><b>→ TOPTRAINERS</b></div>
      </section>

      <section id="opportunities" class="ecosystem shell" aria-label="Три слоя экосистемы">
        <p class="section-kicker">ТРИ СЛОЯ ОДНОЙ ЭКОСИСТЕМЫ</p>
        <h2>Всё, что раньше жило<br />в пяти сервисах</h2>
        <div class="layer-grid">
          <article class="layer tool"><h3>Приложение</h3><p>Кабинет, конструктор программ, CRM клиентов, чаты и платежи. На десктопе раскрывается в «режим силы».</p></article>
          <article class="layer market"><h3>Маркетплейс</h3><p>Витрина-сайт на поддомене, каталог тренеров и товары. SEO-трафик без своего сайта.</p></article>
          <article class="layer game"><h3>Азарт</h3><p>Соревнования, стрики, команды и клубы, рейтинг по результатам подопечных.</p></article>
        </div>
      </section>

      <section id="advantages" class="advantages shell">
        <p class="section-kicker">ЧЕГО НЕТ НИ У КОГО</p>
        <div class="advantages-grid">
          <div class="advantage-list">
            <article><b>01</b><div><h3>Рейтинг по результатам подопечных</h3><p>Верифицированные дельты замеров и медали, а не только отзывы.</p></div></article>
            <article><b>02</b><div><h3>Без магазинов приложений</h3><p>PWA на телефон в один тап, офлайн и push. Без App Store и RuStore.</p></div></article>
            <article><b>03</b><div><h3>Витрина-сайт на поддомене</h3><p>ivanov.toptrainers.ru с программами, товарами и учениками.</p></div></article>
            <article><b>04</b><div><h3>Соревнования как продукт</h3><p>Продавай участие, команды и клубы соревнуются между собой.</p></div></article>
          </div>
          <aside id="showcase" class="showcase-preview" aria-label="Предпросмотр витрины тренера">
            <span>ВИТРИНА «ИНСТАГРАМ-КАЧЕСТВА»</span>
            <div class="showcase-placeholder">[ скриншот публичной витрины тренера ]</div>
          </aside>
        </div>
      </section>

      <section id="pricing" class="pricing shell">
        <p class="section-kicker">ТАРИФЫ ТРЕНЕРА</p>
        <h2>Платишь, когда растёшь</h2>
        <div class="price-grid">
          <article><p>Старт</p><h3>0 ₽</h3><span>до 3 клиентов · комиссия 7%</span><a href="https://app.toptrainers.ru/auth?mode=register&role=trainer">Начать</a></article>
          <article class="featured"><i>ХИТ</i><p>Профи</p><h3>1 490 ₽</h3><span>до 30 · витрина, товары, 4%</span><a href="https://app.toptrainers.ru/auth?mode=register&role=trainer">Выбрать</a></article>
          <article><p>Бизнес</p><h3>3 490 ₽</h3><span>до 100 · аналитика, 3%</span><a href="https://app.toptrainers.ru/auth?mode=register&role=trainer">Выбрать</a></article>
          <article><p>Клуб / Студия</p><h3>7 990 ₽</h3><span>без лимита · API, 2,5%</span><a href="mailto:hello@toptrainers.ru">Связаться</a></article>
        </div>
      </section>

      <section class="final shell">
        <div><h2>Первые 3 клиента —<br />навсегда бесплатно</h2><span>Перенесём твои программы из Excel вручную. Онбординг за 10 минут.</span></div>
        <a href="https://app.toptrainers.ru/auth?mode=register&role=trainer">Создать кабинет <b>→</b></a>
      </section>

      <footer class="footer shell">
        <a class="brand" href="/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 8-7 8 7M4 19l8-7 8 7" /></svg><span>toptrainers.ru</span></a>
        <nav><a href="#opportunities">Тренерам</a><a href="https://app.toptrainers.ru/auth?mode=login&role=client">Клиентам</a><a href="#opportunities">Соревнования</a><a href="mailto:hello@toptrainers.ru">Контакты</a></nav>
        <small>© 2026</small>
      </footer>
    </main>
  `,
  styles: `
    :host{display:block}
    .landing{min-height:100vh;overflow:hidden;background:#14181d;color:#f5f7fa;font-family:"Golos Text","Segoe UI",sans-serif}
    .shell{width:min(100% - 48px,1200px);margin-inline:auto}
    .topbar{height:88px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .brand{display:inline-flex;align-items:center;gap:9px;color:#f5f7fa;text-decoration:none;font-weight:700;font-size:17px;letter-spacing:-.02em}
    .brand svg{width:24px;height:24px;stroke:#c9f24b;stroke-width:2.6;fill:none;stroke-linecap:round;stroke-linejoin:round}
    .topbar nav,.footer nav{display:flex;gap:28px}
    .topbar nav a,.footer nav a{color:#8a94a6;text-decoration:none;font-size:14px}
    .topbar nav a:hover,.footer nav a:hover{color:#c9f24b}
    .outline-button{border:1px solid rgb(245 247 250 / .24);border-radius:9px;padding:11px 19px;color:#f5f7fa;font-size:14px;font-weight:600;text-decoration:none}
    .nav-actions{display:flex;align-items:center;gap:12px}
    .nav-cta{display:inline-flex;align-items:center;justify-content:center;background:#c9f24b;color:#14181d;font-weight:700;font-size:15px;padding:11px 20px;border-radius:9px;text-decoration:none}

    .eyebrow,.mission-card>p,.pulse-head p,.migration-strip span,.showcase-preview>span{font-family:"JetBrains Mono",monospace;font-size:11px;letter-spacing:.13em;color:#8a94a6}
    .section-kicker{font-family:"JetBrains Mono",monospace;font-size:12px;letter-spacing:.14em;color:#c9f24b;margin:0 0 14px}
    .hero h1,.ecosystem h2,.pricing h2,.final h2{font-family:"Unbounded","Arial Black",sans-serif;font-weight:700;letter-spacing:-.05em}
    .eyebrow{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;margin:0;border:1px solid rgb(201 242 75 / .25);border-radius:999px;color:#c9f24b;background:rgb(201 242 75 / .08)}
    .eyebrow i{width:6px;height:6px;background:#c9f24b;border-radius:50%}

    .hero{display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center;padding:72px 0 80px}
    .hero h1{max-width:720px;margin:26px 0 0;font-size:clamp(48px,5.5vw,66px);line-height:1}
    .hero h1 em{font-style:normal;color:#c9f24b}
    .lead{max-width:540px;margin:24px 0 0;color:#b9c2cc;font-size:19px;line-height:1.5}
    .hero-actions{display:flex;gap:14px;margin-top:34px}
    .lime-button,.ghost-button{display:inline-flex;align-items:center;justify-content:center;gap:16px;min-height:54px;border-radius:11px;padding:0 24px;text-decoration:none;font-weight:700;font-size:16px}
    .lime-button{background:#c9f24b;color:#14181d}
    .lime-button span{font-size:22px}
    .ghost-button{border:1px solid rgb(245 247 250 / .2);color:#f5f7fa}
    .hero-proof{display:flex;flex-wrap:wrap;gap:18px 22px;margin-top:28px;color:#8a94a6;font-size:14px}
    .hero-proof span::first-letter{color:#c9f24b}

    .mission-card{padding:30px;background:#1c222b;border:1px solid rgb(245 247 250 / .07);border-radius:22px;box-shadow:0 24px 60px rgb(0 0 0 / .35)}
    .mission-card>p{margin:0 0 25px}
    .mission-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px 20px}
    .mission-grid div{display:grid;gap:6px}
    .mission-grid b{font-family:"Unbounded",sans-serif;font-size:30px;letter-spacing:-.06em}
    .mission-grid b i{font-style:normal;color:#c9f24b}
    .mission-grid span{color:#8a94a6;font-size:13px}
    .lime{color:#c9f24b}
    .mission-pulse{margin-top:26px;padding-top:24px;border-top:1px solid rgb(245 247 250 / .08)}
    .pulse-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
    .pulse-head p{margin:0}
    .pulse-streak{font-family:"JetBrains Mono",monospace;font-weight:700;font-size:13px;color:#e8833a}
    .pulse-days{display:flex;justify-content:space-between;margin-top:8px;font-family:"JetBrains Mono",monospace;font-size:10px;color:#8a94a6}
    .pulse-track{display:flex;gap:6px;padding:12px;border:1px solid rgb(245 247 250 / .07);border-radius:999px;background:#1c222b}
    .pulse-track i{height:14px;flex:1;background:#c9f24b;border-radius:999px}
    .pulse-track .muted{background:rgb(245 247 250 / .1)}
    .pulse-track .alert{background:rgb(255 77 94 / .55)}
    .pulse-track .future{background:transparent;border:1px dashed rgb(245 247 250 / .24)}

    .migration-strip{border-block:1px solid rgb(245 247 250 / .06);background:#1c222b}
    .migration-strip>div{display:flex;align-items:center;justify-content:center;gap:16px;padding:20px 0}
    .migration-strip s{color:#5b6472;font-size:16px;font-weight:600}
    .migration-strip b{font-family:"JetBrains Mono",monospace;color:#c9f24b;font-size:12px}

    .ecosystem{padding:80px 0}
    .ecosystem h2{margin:0 0 44px;font-size:clamp(34px,4.6vw,58px);line-height:1.08}
    .layer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
    .layer{min-height:220px;padding:30px;border-radius:18px;background:#1c222b}
    .layer h3{margin:0 0 10px;font-family:"Unbounded",sans-serif;font-size:22px;letter-spacing:-.04em}
    .layer p{min-height:66px;margin:0;color:#b9c2cc;line-height:1.55}
    .tool{border-top:3px solid #2f5cff}
    .market{border-top:3px solid #c9f24b}
    .game{border-top:3px solid #e7b54a}

    .advantages{padding:80px 0}
    .advantages-grid{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;margin-top:14px}
    .advantage-list{border-top:1px solid rgb(245 247 250 / .12)}
    .advantage-list article{display:grid;grid-template-columns:38px 1fr;gap:16px;padding:20px 0;border-bottom:1px solid rgb(245 247 250 / .12)}
    .advantage-list b{font-family:"JetBrains Mono",monospace;color:#c9f24b;font-size:13px}
    .advantage-list h3{margin:0;font-size:18px}
    .advantage-list p{margin:7px 0 0;color:#8a94a6;line-height:1.5}
    .showcase-preview{display:flex;flex-direction:column;gap:14px}
    .showcase-placeholder{height:480px;border-radius:22px;border:1px solid rgb(245 247 250 / .08);background:repeating-linear-gradient(135deg,#1c222b,#1c222b 14px,#20272f 14px,#20272f 28px);display:flex;align-items:center;justify-content:center;color:#8a94a6;font-family:"JetBrains Mono",monospace;font-size:13px;text-align:center;padding:0 40px}

    .pricing{padding:80px 0}
    .pricing h2{margin:26px 0 44px;font-size:clamp(30px,3.8vw,42px);line-height:1.1}
    .price-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
    .price-grid article{min-height:250px;display:flex;flex-direction:column;padding:28px;border:1px solid rgb(245 247 250 / .08);border-radius:18px;background:#1c222b}
    .price-grid p{margin:0;font-family:"Unbounded",sans-serif;font-weight:600;font-size:18px;color:#f5f7fa;letter-spacing:-.02em}
    .price-grid h3{margin:16px 0 4px;font-family:"Unbounded",sans-serif;font-size:32px;letter-spacing:-.05em;color:#c9f24b}
    .price-grid span{color:#8a94a6;font-size:13px}
    .price-grid a{margin-top:auto;padding:12px;border:1px solid rgb(245 247 250 / .18);border-radius:9px;color:#f5f7fa;text-align:center;text-decoration:none;font-size:14px;font-weight:600}
    .price-grid .featured{position:relative;border-color:#2f5cff}
    .price-grid i{font-style:normal;color:#fff;background:#2f5cff;border-radius:999px;padding:3px 7px;font-size:10px}
    .price-grid .featured i{position:absolute;top:-11px;left:28px}

    .final{display:flex;align-items:center;justify-content:space-between;gap:40px;margin-top:24px;margin-bottom:76px;padding:58px 60px;border-radius:24px;background:#c9f24b;color:#14181d}
    .final h2{margin:0;font-size:clamp(30px,4vw,50px);line-height:1.1}
    .final span{display:block;margin-top:15px;opacity:.68;color:#4a5526}
    .final>a{display:inline-flex;align-items:center;gap:18px;white-space:nowrap;border-radius:11px;padding:19px 25px;background:#14181d;color:#f5f7fa;text-decoration:none;font-weight:700}
    .final b{font-size:21px}

    .footer{display:flex;align-items:center;justify-content:space-between;padding:32px 0 40px;border-top:1px solid rgb(245 247 250 / .08)}
    .footer .brand{font-size:14px}
    .footer .brand span{color:#8a94a6}
    .footer small{font-family:"JetBrains Mono",monospace;color:#5b6472;font-size:11px}

    @media(max-width:800px){
      .shell{width:min(100% - 44px,600px)}
      .topbar{height:72px}
      .topbar nav{display:none}
      .outline-button{padding:9px 14px}
      .nav-cta{display:none}
      .hero{grid-template-columns:1fr;gap:30px;padding:46px 0 36px}
      .hero h1{font-size:42px}
      .lead{font-size:15px}
      .hero-actions{flex-direction:column;margin-top:24px}
      .hero-proof{font-size:13px;gap:10px;display:grid}
      .mission-card{padding:22px}
      .mission-pulse{margin-top:20px;padding-top:18px}
      .migration-strip>div{justify-content:flex-start;overflow:hidden;white-space:nowrap;gap:14px}
      .migration-strip span,.migration-strip b{font-size:10px}
      .migration-strip s{font-size:13px}
      .ecosystem,.advantages,.pricing{padding:56px 0}
      .ecosystem h2{font-size:22px;margin:0 0 24px}
      .layer-grid,.price-grid{grid-template-columns:1fr}
      .layer{min-height:auto;padding:18px;border-radius:14px}
      .layer h3{margin:0;font-size:15px}
      .layer p{min-height:auto;margin-top:5px;font-size:13px}
      .advantages-grid{grid-template-columns:1fr;gap:24px}
      .pricing h2{font-size:22px;margin:20px 0 24px}
      .showcase-placeholder{height:220px;padding:0 20px;border-radius:16px;font-size:12px}
      .price-grid{gap:10px}
      .price-grid article{min-height:0;display:grid;grid-template-columns:1fr auto;align-items:center;padding:15px 18px;border-radius:12px}
      .price-grid h3{grid-column:2;grid-row:1/3;margin:0;font-size:18px;color:#f5f7fa}
      .price-grid span{font-size:12px}
      .price-grid a{display:none}
      .final{display:block;margin-bottom:42px;padding:31px 24px;border-radius:19px}
      .final>a{width:100%;justify-content:center;margin-top:25px}
      .footer{align-items:flex-start;gap:24px;flex-wrap:wrap}
      .footer nav{order:3;width:100%;gap:18px;flex-wrap:wrap}
      .footer small{margin-left:auto}
    }
    @media(max-width:380px){
      .shell{width:min(100% - 28px,600px)}
      .hero h1{font-size:38px}
      .mission-grid b{font-size:23px}
      .final h2{font-size:28px}
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseHomeComponent {}
