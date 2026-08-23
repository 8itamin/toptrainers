# Инфраструктура TopTrainers

`infra/` — единственный контур запуска приложения. Он не использует архив `arc/` и не открывает базу данных, Redis или внутренние контейнеры в сеть хоста.

```text
Tailscale Serve (HTTPS)
        |
        v
127.0.0.1:${TT_EDGE_PORT:-8080}
        |
     gateway (Nginx) ── edge ── PWA / SSR showcase / FastAPI
                                       |
                                     data (internal)
                                       |
                                PostgreSQL + Redis
```

## Что гарантирует Compose

- Единственный опубликованный порт — `127.0.0.1:${TT_EDGE_PORT:-8080}` у `gateway`.
- `TT_SERVER_IP` из корневого env-файла служит только ориентиром для оператора; Compose не привязывает к нему сокеты.
- `postgres` и `redis` имеют только `expose`; Docker не публикует их на хосте.
- Сеть `data` помечена `internal`; к ней подключены лишь API, миграции, PostgreSQL и Redis.
- Миграции — отдельный одноразовый сервис `migrate`, а не скрытая команда старта API.
- Nginx принимает только сконфигурированные доменные имена. Неизвестный `Host` получает закрытый ответ, кроме `/__gateway_health`.
- Angular SSR получает явный allowlist корневого домена и его поддоменов через `NG_ALLOWED_HOSTS`; это сохраняет встроенную SSRF-защиту Angular при работе за gateway.
- Frontend production-build требует зафиксированный `frontend/pnpm-lock.yaml`. Если его ещё нет, сборка завершается понятной ошибкой, а не выбирает произвольные версии пакетов.

## Маршрутизация

При `TT_PUBLIC_DOMAIN=example.com` gateway направляет:

| Имя | Назначение |
| --- | --- |
| `app.example.com` | Angular PWA тренера и клиента |
| `api.example.com` | FastAPI / OpenAPI |
| `example.com`, `www.example.com`, `{slug}.example.com` | Angular SSR-витрина |
| `/api/...` на PWA и витрине | тот же FastAPI по same-origin |

Wildcard рассчитан на один уровень поддомена тренера. Содержимое витрины по-прежнему должно проходить валидацию в API; gateway не выполняет код, переданный пользователем.

## Локальная проверка контура

Скопируйте корневой [`.env.example`](../.env.example) в неотслеживаемый `.env` и замените все тестовые секреты. Затем можно проверить конфигурацию и запустить только приватные зависимости:

```bash
docker compose --env-file .env -f infra/compose/compose.yaml config -q
docker compose --env-file .env -f infra/compose/compose.yaml up -d postgres redis
```

If a developer runs FastAPI natively rather than in Compose, add
`-f infra/compose/compose.dev.yaml` to publish the two dependencies only on
`127.0.0.1`. That overlay is local-only and must never be used on the Tailnet host.
In that mode the native API uses `127.0.0.1` in `TT_DATABASE_URL` and `TT_REDIS_URL`;
the Compose API continues to use the service names `postgres` and `redis`.

Полный frontend-build будет доступен после появления `frontend/pnpm-lock.yaml`. Одноразовый, только тестовый обход допускается переменной `TT_ALLOW_UNLOCKED_FRONTEND_BUILD=true`; её нельзя помещать в production env-файл.

## Развёртывание на `100.90.138.119`

Адрес `100.90.138.119` относится к диапазону Tailnet/CGNAT. Он не является публичным IP для A-записи. Не направляйте публичный DNS на этот адрес и не меняйте Compose так, чтобы база данных или Redis слушали сеть.

Перед первым запуском на Linux-хосте должны быть установлены Docker Engine с Compose v2 и Tailscale. Рабочая копия релиза располагается, например, в `/opt/toptrainers`; на production не следует выполнять `git pull` из скрипта развёртывания.

1. На доверенной машине выполните обычную установку зависимостей в `frontend/`, проверьте результат и закоммитьте созданный `pnpm-lock.yaml` вместе с исходным кодом. Без этого production frontend-build намеренно остановится.
2. На хосте создайте каталог секретов и подготовьте отдельный файл окружения:

   ```bash
   sudo install -d -m 700 /etc/toptrainers
   sudo cp /opt/toptrainers/.env.example /etc/toptrainers/prod.env
   sudo chmod 600 /etc/toptrainers/prod.env
   sudoedit /etc/toptrainers/prod.env
   ```

   В нём обязательно замените `POSTGRES_PASSWORD`, `TT_JWT_SIGNING_KEY`, `TT_DATABASE_URL`, `TT_ALLOWED_HOSTS`, `TT_CORS_ORIGINS` и `TT_PUBLIC_DOMAIN` на production-значения, а также установите `TT_ENVIRONMENT=production` и `TT_OPENAPI_ENABLED=false`. Сам файл не коммитится.

3. Запустите проверенный checkout:

   ```bash
   sudo bash /opt/toptrainers/infra/scripts/deploy-tailnet.sh
   ```

   Скрипт проверяет права на env-файл, стартует приватные хранилища, ждёт их готовности, запускает Alembic отдельным контейнером, собирает сервисы и проверяет loopback health endpoint. Он не подключается к Git и не выполняет удалённых команд.

4. После успешной локальной проверки опубликуйте **только gateway** в Tailnet:

   ```bash
   sudo tailscale serve --https=443 http://127.0.0.1:8080
   sudo tailscale serve status
   ```

`Tailscale Serve` делает доступным имя самого tailnet-хоста. Для реальных адресов `app.<домен>`, `api.<домен>` и `*.<домен>` потребуются отдельные DNS/TLS и утверждённый публичный ingress. До этого Tailnet разумно использовать для эксплуатации и health-check, а не выдавать его за готовую публичную публикацию.

## CI/CD через GitHub webhook

Проверки CI запускаются GitHub Actions на pull request и push в `main`: frontend проходит install/lint/typecheck/build, backend — ruff/mypy/pytest. Production-деплой отделён от GitHub Actions: GitHub отправляет push-webhook на `https://toptrainers.ru/deploy/github`, а сервер принимает только подписанный HMAC-SHA256 запрос для `refs/heads/main`.

На хосте работают два systemd-сервиса: `toptrainers-webhook` (непривилегированный приёмник на `127.0.0.1:9003`) и `toptrainers-deploy` (один последовательный job). Job получает актуальный `origin/main` через `git fetch`, отключая Git hooks, переключает checkout на точный commit, создаёт миграционный контейнер и проверяет gateway health. Обычный `git pull` на production не используется. При первом webhook текущая неуправляемая директория `/opt/toptrainers` переименовывается в timestamped backup, а вместо неё создаётся Git checkout; поэтому первый push должен содержать все нужные production-изменения.

Для включения контура администратор репозитория добавляет server deploy key как **read-only** key в *Settings → Deploy keys* и создаёт webhook в *Settings → Webhooks*:

- Payload URL: `https://toptrainers.ru/deploy/github`
- Content type: `application/json`
- Secret: значение `WEBHOOK_SECRET` из `/etc/toptrainers/webhook.env` на сервере
- Events: только **Just the push event**
- Active: включено

Секрет webhook и приватный deploy key живут только на сервере, имеют права `600` и никогда не попадают в Git. После каждого деплоя статус и логи проверяются командами `systemctl status toptrainers-deploy` и `journalctl -u toptrainers-deploy -n 100`; откат приложения выполняется только до commit, совместимого с уже применённой схемой БД.

## Обновление и откат

- Собирайте и проверяйте релиз до переноса на сервер; используйте тег checkout или закреплённые образы.
- Перед миграциями сделайте и проверьте резервную копию PostgreSQL. Миграции должны быть backward-compatible хотя бы на один релиз.
- Откат приложения допустим только до версии, совместимой с уже применённой схемой БД. Автоматического downgrade здесь намеренно нет.
- После обновления проверьте `http://127.0.0.1:8080/__gateway_health` на самом хосте и `docker compose ... ps`/`logs` через тот же env-файл.

### Production migration gate

Push/merge в `main` запускает production webhook deploy автоматически. Поэтому релиз, который добавляет или меняет Alembic migration, **нельзя merge'ить в `main` до создания и проверки pre-migration backup**.

Перед merge такого релиза оператор обязан:

1. Зафиксировать текущий production commit и текущую Alembic revision.
2. Создать свежий PostgreSQL backup в защищённом каталоге вне Git.
3. Проверить, что backup не пустой, читается штатными PostgreSQL tools и имеет сохранённую checksum.
4. Убедиться, что для этого типа backup существует проверенная процедура восстановления в отдельном контуре.
5. Только после этого разрешить merge/push migration release в `main`.

Если backup не подтверждён, migration release не выпускается. Сам факт успешного CI не заменяет production backup gate.

Пример backup перед migration release:

```bash
sudo install -d -m 700 /srv/toptrainers-backups
backup="/srv/toptrainers-backups/toptrainers-pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose --env-file /etc/toptrainers/prod.env -f /opt/toptrainers/infra/compose/compose.yaml \
  exec -T postgres sh -ec 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > "$backup"

test -s "$backup"
sha256sum "$backup" > "$backup.sha256"
sha256sum -c "$backup.sha256"
```

Backup содержит персональные данные. Каталог и файлы должны быть недоступны непривилегированным пользователям; перенос backup за пределы хоста должен использовать шифрование.

### Rollback policy для `20260824_0007`

Migration `20260824_0007` создаёт singleton-таблицу `workout_executions`. Её downgrade удаляет таблицу целиком. После первого production `Start` или `Complete` это становится destructive rollback: теряются `started_at`/`completed_at`, а Assignment history перестаёт иметь соответствующий Execution record.

Поэтому production policy следующая:

| Ситуация | Разрешённый механизм |
| --- | --- |
| Ошибка приложения после применения `0007`, данные БД корректны | **App-only rollback** на заранее проверенный commit, совместимый с уже применённой schema `0007` и текущими данными. Schema остаётся на `0007`. |
| После `0007` уже появился хотя бы один Execution write | `alembic downgrade 20260822_0006` **запрещён**. `workout_executions` не удаляется. |
| Требуется откатить саму БД/schema | Только **full database restore/PITR** к согласованной точке до migration/write, с остановкой новых writes. Это disaster recovery, а не обычный deploy rollback. |
| Старый app commit несовместим с schema/data после `0007` | Такой commit не используется для app-only rollback; выбирается совместимый release либо выполняется DR restore. |

`Assignment` остаётся lifecycle authority, а `Execution` — singleton history record. Rollback procedure не должна создавать состояние `IN_PROGRESS`/`COMPLETED` без сохранённого Execution из-за удаления таблицы.

### App-only rollback

Обычный production rollback после появления Execution writes выполняется без Alembic downgrade:

1. Остановить автоматическое продвижение новых release до выяснения причины.
2. Выбрать предыдущий commit, который проверен на совместимость с текущей schema `0007` и текущими Assignment status/data.
3. Переключить production checkout на этот exact commit штатным deploy-механизмом.
4. **Не запускать `alembic downgrade`.** Повторный `alembic upgrade head` допустим только если выбранный commit знает текущую schema; downgrade не является частью rollback.
5. Проверить gateway/API health, логи и критические Trainer/Client flows.

Extra table в PostgreSQL сама по себе не является причиной удалять данные. Если старый app commit не совместим с текущим содержимым БД, app-only rollback блокируется и применяется DR procedure.

### Full database restore / disaster recovery

DB rollback после destructive migration/write означает потерю всех изменений после выбранной recovery point. Перед restore оператор должен явно принять соответствующий RPO.

Минимальная процедура:

1. Остановить приложение или иным способом прекратить production writes.
2. Отключить/приостановить автоматический webhook deploy на время восстановления.
3. Сохранить текущую повреждённую/нежелательную БД отдельным forensic backup, если это технически возможно.
4. Выбрать проверенный pre-migration backup или PITR point и проверить его checksum/идентификатор.
5. Восстановить **всю PostgreSQL database**, а не отдельную таблицу `workout_executions`.
6. Развернуть exact app commit, соответствующий восстановленной schema/data.
7. Проверить Alembic revision, integrity критических таблиц, health endpoints и доменные smoke tests.
8. Только после верификации вернуть пользовательский трафик и автоматический deploy.

При restore из pre-migration backup RPO равен времени выбранного backup: все production writes после этой точки будут потеряны. RTO зависит от размера БД, скорости restore и обязательной post-restore verification. Поэтому database restore применяется только когда app-only rollback недостаточен.

Резервные копии содержат персональные данные и должны шифроваться, иметь ограниченные права доступа и регулярно проверяться полным восстановлением в отдельном контуре.
