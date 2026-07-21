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

## Обновление и откат

- Собирайте и проверяйте релиз до переноса на сервер; используйте тег checkout или закреплённые образы.
- Перед миграциями сделайте и проверьте резервную копию PostgreSQL. Миграции должны быть backward-compatible хотя бы на один релиз.
- Откат приложения допустим только до версии, совместимой с уже применённой схемой БД. Автоматического downgrade здесь намеренно нет.
- После обновления проверьте `http://127.0.0.1:8080/__gateway_health` на самом хосте и `docker compose ... ps`/`logs` через тот же env-файл.

Пример резервной копии запускают из защищённого каталога на хосте (путь должен быть вне Git):

```bash
docker compose --env-file /etc/toptrainers/prod.env -f /opt/toptrainers/infra/compose/compose.yaml \
  exec -T postgres sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  > /srv/toptrainers-backups/toptrainers-$(date +%F).sql
```

Резервные копии содержат персональные данные и должны шифроваться, иметь ограниченные права доступа и проверяться восстановлением в отдельном контуре.
