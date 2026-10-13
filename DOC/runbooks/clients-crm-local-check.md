# Локальная проверка CRM клиентов

Дата: 2026-10-13. Разработка: codex/clients-crm; релиз: main.

## Production release

Commit `45c879788c0b870f0441b1013584f565b5c9a3d2` выпущен GitHub webhook; CI run `38358755925` success. Systemd deploy Result=success, ExecMainStatus=0; новый API подтвердил Alembic `20261013_0018 (head)`. Все healthchecked контейнеры healthy; video-worker running. Публичные app clients route, API ready, gateway и сайт — HTTP 200; clients/cards без сессии — 401. Backup сохранён; временные test-контейнер/volume/network/image удалены. Подтверждение настоящего письма клиенту и ручной account-based E2E остаются пользовательской проверкой после выпуска.

## Production release preflight 2026-10-13

Владелец поручил migration/deploy. Production до выпуска: commit `42fb1fa`, revision `20260929_0017`. Свежий backup на сервере `/srv/toptrainers-backups/toptrainers-pre-clients-20261013T063742Z.dump`: 69 543 байт, mode 600; pg_restore list/checksum прошли. Восстановление выполнено в отдельной private PostgreSQL 17 без host ports; upgrade до `20261013_0018` прошёл. Upgrade всех миграций на пустой тестовой БД также прошёл.

Linux/Python 3.13 с настоящей PostgreSQL: полный backend suite — 222 passed, без пропусков. Дополнительный test_client_join_concurrency.py — 4 passed. Первые два конфигурационных теста не видели infra из-за неверного layout mount; полный повтор с правильным layout зелёный. Все операции выполнялись в отдельном временном контуре; production БД до webhook не менялась. Full mypy src (84 source files) и Ruff прошли.

## Проверено

- Backend: 146 tests passed, 76 skipped. Новые проверки покрывают контракт/валидацию, owner isolation, выдачу hash-токена на 7 дней, несовпадающий email, повторное принятие, ошибку SMTP, перенос invite в письмо подтверждения, legacy card sync, SQL read-side и обновление отменённого приглашения в реальной SQLAlchemy identity map.
- Frontend: 88 tests passed; компонентные проверки подтверждают отсутствие назначения до подключения, доступную Telegram-ссылку при ошибке письма, защиту выбранной карточки от позднего ответа и восстановимый сбой загрузки программ.
- Backend Ruff, frontend ESLint и TypeScript прошли; mypy прошёл для card_repository/card_service/join_service/card_router/crm_summary/mail.
- Alembic `upgrade 20260929_0017:head --sql` успешно генерирует PostgreSQL DDL и INSERT backfill. Это не доказывает фактическое применение миграции.
- Production PWA build прошёл с исходными JS/CSS оптимизацией и budget, при временном `optimization.fonts=false`. Исходный project.json восстановлен. Обычная сборка требует доступ к Google Fonts; существующий warning CSS budget library-hub остаётся.
- Независимое review: исправлены stale ORM cancellation race, отсутствие CRM-карточки при legacy accept, потеря invite при смене аккаунта; компонентными тестами исправлены late mutation selection и скрытая ошибка программ.

## Условия окружения

Windows sandbox ограничивает event-loop сокеты и realpath Vitest; тесты запускались вне этих ограничений после автоматического разрешения. На Python 3.14 имеются существующие deprecation warnings pytest-asyncio. Docker CLI установлен, но Linux engine недоступен; TT_TEST_DATABASE_URL отсутствует. Первоначальная попытка import asyncpg также выявила блокировку DLL системной Application Control. Эти ограничения не обходились.

## Перед выпуском

1. Поднять выделенную PostgreSQL 17 test database и Redis; TT_TEST_DATABASE_URL должен указывать на БД с именем toptrainers_test. Тестовая fixture удаляет и создаёт таблицы: никогда не использовать реальные данные.
2. Проверить миграцию `20261013_0018` на пустой БД и восстановленной тестовой копии revision `20260929_0017`; проверить уникальные контакты, backfill повторных/завершённых пар и сохранность назначений.
3. Запустить PostgreSQL integration/concurrency suites, включая test_client_join_integration.py; проверить параллельные accept/cancel/reissue и BecomeTrainer. SQLite identity-map тест подтверждает refresh, но не заменяет проверку PostgreSQL row locks.
4. Использовать test SMTP и вымышленные контакты. Создать карточку → отправить письмо → новый клиент регистрируется → подтверждает email в новой вкладке → входит → явно принимает → тренер назначает непустую программу → клиент завершает тренировку → тренер видит историю. Повторить с существующим аккаунтом и Telegram share.
5. Проверить неверный email/роль, отменённую/истёкшую ссылку, повторную отправку при ошибке SMTP, offline/error states, поиск/пагинацию и мобильную карточку. При ошибке SMTP карточка и новая ссылка должны сохраняться.
6. Завершить сотрудничество и повторно пригласить: карточка одна, прежняя история доступна, новая связь создаётся только после принятия.

После этих проверок публиковать только по отдельному поручению владельца. Downgrade удаляет новые CRM-карточки/приглашения; не использовать его как production rollback без оценки сохранения данных.
