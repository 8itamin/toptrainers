# TopTrainers — память проекта

> Deployment update (2026-07-24): current local changes to the showcase landing, document metadata, and `favicon.svg` were installed on production. The independently rebuilt `showcase` service is healthy, and the gateway returns the expected page title for `toptrainers.ru`; API, PWA, database, and migrations were not changed.

> CI/CD checkpoint (2026-07-24): GitHub Actions CI and a production CD receiver are prepared. The server runs the isolated `toptrainers-webhook` service on `127.0.0.1:9003`; Nginx exposes only `https://toptrainers.ru/deploy/github`, and invalid GitHub signatures are rejected with HTTP 401. The deployment job fetches `origin/main` without Git hooks or `git pull`, then runs the reviewed deployment script, migrations, Compose and health checks. A read-only server deploy key and webhook secret are stored outside Git under `/etc/toptrainers/`. Activation is pending repository-admin setup of that public key and webhook in GitHub; no deployment is triggered until then.

> CI/CD activation (2026-07-26): the read-only deploy key is accepted by GitHub and repository webhook `https://toptrainers.ru/deploy/github` is active for push events with JSON and SSL verification. The receiver HMAC smoke test passes. The first push to `main` after committing the CI/CD files will initialise the managed production checkout (preserving the prior unmanaged directory as a timestamped backup) and deploy that exact branch head.

> Deployment repair (2026-08-13): production CD was blocked because systemd parsed the unquoted `GIT_SSH_COMMAND` value as several invalid environment assignments, so deploy jobs connected to GitHub without the deploy key and failed before checkout. The unit now quotes the complete assignment; after applying it on the host, the managed checkout must be bootstrapped and deployed from the current `main` revision, with service and health checks verified.

> Deployment repair follow-up (2026-08-13): `deploy-github.sh` retains a restrictive umask, so the bootstrap checkout must explicitly be made readable/traversable before Docker builds images that run as unprivileged users. This normalisation applies only to tracked release files; production env files and deploy keys remain outside the checkout with restricted permissions.

_Обновлено: 19 июля 2026_

## Зачем существует продукт

TopTrainers.ru — платформа для независимых фитнес‑тренеров и их клиентов. Она объединяет три слоя:

1. рабочий SaaS-инструмент тренера: программы, упражнения, клиенты, коммуникации и оплаты;
2. клиентское mobile-first PWA: календарь, выполнение тренировок, прогресс, чат и оплаты;
3. публичная витрина и в дальнейшем социально-соревновательный слой: поддомены, каталог, достижения, рейтинги и рефералы.

Цель MVP — не «все функции», а 50 пилотных тренеров, которые ведут реальных клиентов и принимают реальные платежи.

## Источники требований

Оригинальные документы находятся в `._DOC/`:

- `TopTrainers_Общий_план_проекта.docx` — продуктовая стратегия, фазы и KPI;
- `TopTrainers_Дизайн_документ.docx` — mobile-first UX и дизайн-система «Стадион»;
- `TopTrainers_Архитектура.docx` — целевая архитектура;
- `TopTrainers_ТЗ_MVP.docx` — требования MVP и критерии приёмки.

При конфликте требований сначала уточнять у владельца продукта. До уточнения MVP-ТЗ определяет объём, а архитектурный документ — технические ограничения.

## Текущее состояние репозитория

19 июля 2026 года владелец проекта намеренно удалил старую заглушку (Astro/NestJS/Supabase). Она больше не является рабочей основой и не должна восстанавливаться из Git или `arc/` без отдельного поручения.

Активная структура — полиглотный монорепозиторий:

- `frontend/` — Nx-workspace с двумя Angular-приложениями: одной PWA для тренера и клиента и отдельной SSR-витриной;
- `backend/` — FastAPI-модульный монолит, миграции Alembic и единый OpenAPI-контракт;
- `infra/` — Docker Compose, Nginx gateway, шаблоны окружения и эксплуатационные скрипты;
- `DOC/` — постоянная память, ADR и дорожная карта;
- `arc/` — только архив материалов. Не переносить, не очищать и не деплоить его без явного разрешения.

Сейчас создаётся технический каркас; завершённых пользовательских MVP-сценариев ещё нет. Разработка функций начинается только внутри этой структуры и по вертикальному сценарию из ADR-002.

### Контур развёртывания

Первый целевой хост — `100.90.138.119`. Это адрес Tailnet из диапазона CGNAT, поэтому он не является публичным IP для DNS-записей. Базовый безопасный контур:

```text
интернет / Tailnet-пользователь
        │
Tailscale Serve (HTTPS, если настроен домен Tailnet)
        │
127.0.0.1:8080 на хосте 100.90.138.119
        │
Nginx gateway в Compose
  ├─ Angular PWA
  ├─ Angular SSR showcase
  └─ FastAPI /api/v1
        │
PostgreSQL и Redis во внутренней Docker-сети
```

PostgreSQL, Redis и будущее S3-совместимое хранилище не публикуют порты на хост. Настоящие секреты хранятся на хосте вне репозитория (например, `/etc/toptrainers/prod.env`, с правами только для администратора); в Git допускается только `.env.example`. Публичный домен и внешний ingress принимаются отдельным решением: до этого нельзя направлять публичный DNS на `100.90.138.119`.

SSR-витрина принимает только явный allowlist корневого домена и его поддоменов через
`NG_ALLOWED_HOSTS`; это сохраняет SSRF-защиту Angular за доверенным Nginx gateway. Не
использовать `*` как универсальный allowlist.

## Принятый целевой контур

Выбран контур из архитектурного документа: Angular PWA/SSR + FastAPI + PostgreSQL/Redis/S3-совместимое хранилище. Он заменяет удалённую заглушку и сохраняет необходимую базу для российского хранения ПДн, денежного леджера, фоновых задач и строгих доменных границ.

```text
frontend/
  apps/
    app/                       Angular PWA: trainer/client role-layouts
    showcase/                  Angular SSR: публичные витрины и SEO
  libs/
    ui/                        дизайн-токены и доступные UI-компоненты
    shared/{config,contracts,data-access,domain}/
    offline/                   IndexedDB и очередь синхронизации
    pwa/feature-role-shell/    маршруты и оболочки ролей PWA
    showcase/blocks/           типы, реестр и рендер блоков витрины
backend/
  src/toptrainers_api/
    app/                       фабрика приложения и маршрутизация
    core/                      конфигурация, БД, Redis, логирование
    modules/<module>/          router, schemas, service, repository, models, tests
    workers/                   фоновые задачи, когда появятся реальные потребители
  migrations/                  Alembic
infra/
  compose/                     локальный и Tailnet-контуры Compose
  nginx/                       единая точка входа HTTP
  scripts/                     проверяемые ручные операции развёртывания
DOC/                            память, ADR и дорожная карта
```

PWA — одно устанавливаемое приложение с разными role-layouts; не создавать отдельные приложения для тренера и клиента. SSR-витрина не импортирует PWA- или Service Worker-код, а PWA не зависит от feature-библиотек витрины. Общими могут быть только явно разрешённые `shared/*` и `ui` библиотеки.

Бэкенд остаётся одним развёртываемым приложением, но каждый модуль владеет своими `router → service → repository → models → migrations/tests`. Запрещены прямые импорты чужих repository; связь — через публичный сервисный контракт или доменное событие/outbox. FastAPI OpenAPI — единственный источник HTTP-контракта; TypeScript-клиент генерируется из него, а не поддерживается вручную параллельно.

## Доменные блоки

1. `identity` — аккаунты, роли, сессии, согласия, удаление аккаунта.
2. `trainers` и `clients` — профили, CRM и связь тренер↔клиент.
3. `exercises` — библиотека упражнений и медиа.
4. `programs` — программы, недели, дни, блоки, офферы и публикация.
5. `assignments` и `workouts` — назначения, календарь, выполнение, видеоотчёты.
6. `metrics` — замеры, чек-ины, динамика.
7. `chat` и `notifications` — диалоги, вложения, доставка событий.
8. `billing` — леджер, платежи, подписки, возвраты, выплаты.
9. `showcase` — поддомены, SEO, редактор блоков, OG-карточки и рефералы.
10. `admin` — модерация, возвраты, тикеты, аудит и метрики запуска.

Модули соревнований, рейтингов, товаров, команд, AI и питания — после MVP, согласно `DOC/ROADMAP.md`.

## Блочный принцип

Есть три разных уровня «блоков»:

- **доменный блок** — независимая бизнес-возможность из списка выше;
- **UI-блок** — переиспользуемый компонент из `libs/ui`, управляемый дизайн-токенами;
- **контентный блок витрины** — строго типизированный элемент публичной страницы: `hero`, `credentials`, `metrics`, `program-grid`, `product-grid`, `reviews`, `gallery`, `cta`, `contacts` и т. п.

Витрина хранит только версионированную JSON-конфигурацию:

```json
{
  "schemaVersion": 1,
  "blocks": [
    { "id": "hero-01", "type": "hero", "visible": true, "props": {} }
  ]
}
```

Тип блока выбирается из реестра, его `props` валидируются JSON Schema/Pydantic, порядок меняется drag-and-drop, а публикация имеет draft/published-версию. Это позволяет редактировать блоки безопасно без произвольного HTML и без правок кода для каждого тренера.

Конструктор тренировок не является CMS: `program → week → day → day_block → set` хранится строго типизированными доменными сущностями. Так сохраняются история выполнения, офлайн-синхронизация и корректные изменения только будущих тренировочных дней.

## Границы MVP

**Входит:** регистрация и приглашения, программы и конструктор, упражнения, CRM, клиентский плеер и базовый офлайн, чат/видеоотчёты, базовые замеры, платежи и выплаты, витрина тренера, уведомления, базовый шаринг/рефералы, админка и требования 152‑ФЗ.

**Не входит:** полноценные соревнования, рейтинг, товары, каталог, витрины клиентов, XP/бейджи/уровни, команды, AI-конструктор, питание, звонки, нативные приложения и носимые устройства.

## Открытые решения

| Вопрос | Рекомендуемый ответ | Статус |
| --- | --- | --- |
| Бэкенд | FastAPI + PostgreSQL/Redis/S3-совместимое хранилище, модульный монолит | принято (ADR-005) |
| Фронтенд | Angular PWA + отдельное Angular SSR-приложение в Nx | принято (ADR-005) |
| Роли в PWA | Одна устанавливаемая PWA с разными role-layouts и переключением роли без перелогина | принято (ADR-008) |
| Топология репозитория | `frontend/`, `backend/`, `infra/` как отдельные рантаймы в одном репозитории | принято (ADR-008) |
| Развёртывание | Tailnet-хост `100.90.138.119`, gateway слушает только `127.0.0.1:8080`, внешний вход через Tailscale Serve | принято для первого контура (ADR-009) |
| Домены и публичный ingress | После выбора домена: `app.<домен>`, `api.<домен>`, `{slug}.<домен>`; не использовать черновой `toptr.ru` и не указывать публичный DNS на Tailnet-IP | требуется подтверждение |
| Сессии | Разрешить управляемые сессии на телефоне и desktop; не ограничивать тренера одним устройством без подтверждённой причины | требуется подтверждение |
| Удалённые Astro/NestJS/Supabase заготовки | не восстанавливать и не развивать; `arc/` оставить неизменяемым архивом | принято |
| Платёжный провайдер и НПД | ЮKassa + партнёрский контур «Мой налог» после юрпроверки | требуется юридическое подтверждение |
| Стартовая медиабиблиотека | Получить лицензии или собственные съёмки минимум для 150 упражнений; не использовать неатрибутированные ролики | требуется контент-план |
| Дизайн-артефакты | Figma-токены и 12 mobile-first MVP-экранов до интенсивной UI-разработки | требуется подготовка |

Перед фазой 0 также синхронизировать номера версий документов: общий план v1.3, дизайн v1.2, архитектура v1.1 и ТЗ v1.1 содержат ссылки на более ранние версии. Это редакционное расхождение не должно приводить к тихой смене требований.

## Передача следующей сессии

### Deployment checkpoint (2026-07-19)

- Production bootstrap is running on `ab@100.90.138.119` under `/opt/toptrainers`.
- Public DNS resolves `toptrainers.ru`, `www`, `app`, and `api` to `153.75.248.98`.
- Host Nginx proxies these names to the isolated Compose gateway on `127.0.0.1:8080`; existing `aibaro` and `velio` sites were not changed.
- Let’s Encrypt certificate `toptrainers.ru` covers apex, `www`, `app`, and `api`; renewal is scheduled by Certbot.
- Compose services `postgres`, `redis`, `api`, `pwa`, `showcase`, and `gateway` are healthy. Public checks: apex/www/app return 200; `api` returns JSON 404 on `/` (service is reachable).
- `frontend/pnpm-lock.yaml` is generated and committed to the working tree. Production Dockerfiles explicitly allow dependency build scripts with pnpm 11.
- Showcase currently uses an Express static shell because Angular 21 SSR engine manifest handling was incompatible with the custom entrypoint; SSR can be reintroduced after aligning the generated server entrypoint.
- Next engineering step: implement the first trainer-to-client vertical slice and add CI/build checks. Wildcard `*.toptrainers.ru` TLS still requires DNS-01 credentials if needed.
- Vertical slice progress: PostgreSQL `accounts`/`programs` tables, Alembic revision `20260719_0001`, registration/login endpoints, signed bearer tokens, protected trainer program creation endpoint, and the first program form in the trainer PWA are now deployed and passing API readiness checks.
- The trainer PWA now includes registration and login controls; successful authentication persists the bearer token only in browser local storage for this bootstrap phase.
- Landing update (2026-07-21): `frontend/apps/showcase/src/app/pages/showcase-home.component.ts` was redesigned from the supplied TopTrainers landing reference with responsive desktop and mobile layouts, then deployed to `https://toptrainers.ru`. The `showcase` container was rebuilt and recreated independently; it is healthy, the public HTTPS endpoint returns 200, and a 390 px viewport check found no horizontal overflow. The landing was then refined against the complete supplied reference and redeployed: its exact messaging, migration strip, hero proof points, dashboard card, ecosystem cards, trainer-showcase preview and tariff CTAs are represented as maintainable Angular blocks rather than embedded arbitrary HTML. A matching `favicon.svg` is served from the showcase public assets. The production build and health check completed successfully; the earlier full Compose rebuild was replaced with a targeted build using `--project-directory /opt/toptrainers`. Optimise frontend dependency-layer caching separately before the next full deployment.

Landing follow-up (2026-07-21, same day): diffing the component against the source design (`Лендинг TopTrainers - Табло.dc.html`, imported via the Claude Design MCP) found that the "Тарифы тренера" pricing section had CSS fully prepared (`.price-grid`, incl. mobile responsive rules) but no matching markup had ever been added, and the `#pricing` anchor was wrongly attached to the competition/gamification section instead. Added the missing four-tier pricing section (Старт/Профи/Бизнес/Клуб), moved `#pricing` onto it, gave the competition section its own `#competition` id, added `#opportunities`/`#showcase` anchors, added the missing "Начать бесплатно" nav CTA button, and added the day-of-week labels + 🔥 streak badge to the weekly-pulse widget that the reference shows but the shipped version omitted. Not yet rebuilt/redeployed to the Tailnet/production host — `frontend/node_modules` and `pnpm` are not installed in this working environment, so only static tag-balance checks were run, not a real Angular build.

Архитектурное решение принято, старая заглушка удалена, а новый каркас создан.
Статически проверены JSON-конфигурации, Node-инструменты и Python-синтаксис; полноценные
Angular/Nx и Docker-проверки не выполнялись, потому что в текущем окружении нет Docker,
а `frontend/pnpm-lock.yaml` ещё не создан. Следующий разумный шаг — завершить фазу 0:

1. выполнить доверенную чистую установку в `frontend/`, закоммитить `pnpm-lock.yaml`, затем проверить PWA, SSR, API, миграции и health-checks;
2. поднять Compose на Tailnet-хосте без публикации data-сервисов и подключить Tailscale Serve;
3. зафиксировать OpenAPI и первую миграцию для `identity`, `programs` и `assignments`;
4. реализовать первый вертикальный сценарий «тренер → программа/витрина → приглашённый клиент → выполненная тренировка»;
5. до публичного запуска отдельно утвердить домен, TLS/ingress, резервное копирование и мониторинг.
