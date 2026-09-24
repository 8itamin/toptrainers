# Optimized Exercise Thumbnail Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Store newly uploaded exercise covers as private 320×180 WebP images under 100 KiB and obtain their URLs in batches.

**Architecture:** The browser immediately prepares the 16:9 preview, while a durable backend job and thumbnail worker perform the authoritative transform. Only READY media can be saved with an exercise. Trainer and client list views request all eligible signed thumbnail URLs at once; client authorization remains constrained by the immutable assignment snapshot.

**Tech Stack:** Angular 21 canvas and signals, FastAPI, SQLAlchemy/Alembic, private S3-compatible storage, FFmpeg/libwebp, Docker Compose, generated OpenAPI contracts, pytest, Vitest.

**Spec:** docs/superpowers/specs/2026-09-24-exercise-thumbnail-delivery-design.md

## Global Constraints

- Central cover-crop at exactly 320×180, WebP, maximum 100 KiB.
- Signed URLs remain private and short-lived; logs never contain signed URLs or storage credentials.
- Do not rewrite legacy thumbnail_url, legacy thumbnail_media_id, or existing assignment snapshots.
- The API request only confirms and queues; it never transcodes image bytes.
- Generated TypeScript contracts are regenerated from FastAPI OpenAPI, not edited directly.

## Review Focus

- A high-detail source must become at most 100 KiB or fail safely.
- A fake WebP must fail and never become READY.
- Batch trainer access cannot expose another trainer’s cover.
- Assignment batch access cannot expose media outside the frozen snapshot.
- A lease left by a stopped worker must retry at most three times without publishing partial data.

---

### Task 1: Add persistent thumbnail processing state

**Files:**

- Modify: backend/src/toptrainers_api/modules/media/models.py
- Modify: backend/src/toptrainers_api/modules/media/repository.py
- Create: backend/migrations/versions/20260924_0016_exercise_thumbnail_jobs.py
- Create: backend/tests/test_exercise_thumbnail_jobs.py
- Modify: backend/tests/test_training_programs_migration.py

**Interfaces:**

- Produces ExerciseThumbnailJob with source_media_id, status, attempt_count, lease_expires_at, and last_error_code.
- Produces repository queries get_exercise_thumbnail_job, get_ready_owned_exercise_thumbnails, and get_ready_assignment_thumbnails.

- [ ] **Step 1: Write failing persistence tests**

~~~python
async def test_ready_owned_thumbnails_omit_unready_and_other_trainer_media(session):
    rows = await repository.get_ready_owned_exercise_thumbnails(
        session, "trainer-a", {"ready-a", "pending-a", "ready-b"}
    )
    assert [row.id for row in rows] == ["ready-a"]


async def test_thumbnail_job_is_unique(session):
    session.add(ExerciseThumbnailJob(source_media_id="m" * 36, status="PENDING"))
    await session.commit()
    assert await repository.get_exercise_thumbnail_job(session, "m" * 36)
~~~

- [ ] **Step 2: Verify the tests fail**

Run: cd backend; pytest tests/test_exercise_thumbnail_jobs.py -v

Expected: FAIL because the job and ready-only repository queries do not exist.

- [ ] **Step 3: Implement the model and migration**

~~~python
class ExerciseThumbnailJob(Base):
    __tablename__ = "exercise_thumbnail_jobs"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED')"),
        CheckConstraint("attempt_count >= 0"),
        Index("ix_exercise_thumbnail_jobs_status_lease_expires_at", "status", "lease_expires_at"),
    )
    source_media_id: Mapped[str] = mapped_column(
        ForeignKey("media_objects.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(64))
~~~

Expand the MediaObject status constraint to PENDING, PROCESSING, READY, FAILED. Queries require both an Exercise thumbnail reference and READY media. Assignment query reads stored snapshot IDs only.

- [ ] **Step 4: Verify**

Run: cd backend; pytest tests/test_exercise_thumbnail_jobs.py tests/test_training_programs_migration.py -v

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/media/models.py backend/src/toptrainers_api/modules/media/repository.py backend/migrations/versions/20260924_0016_exercise_thumbnail_jobs.py backend/tests/test_exercise_thumbnail_jobs.py backend/tests/test_training_programs_migration.py
git commit -m "feat: persist exercise thumbnail jobs"
~~~

### Task 2: Implement WebP canonicalization worker

**Files:**

- Create: backend/src/toptrainers_api/modules/media/thumbnails.py
- Create: backend/src/toptrainers_api/workers/exercise_thumbnails.py
- Modify: backend/src/toptrainers_api/modules/media/storage.py
- Modify: backend/Dockerfile
- Modify: infra/compose/compose.yaml
- Create: backend/tests/test_exercise_thumbnail_worker.py

**Interfaces:**

- Produces WebpThumbnailTranscoder.transcode(source: Path, output: Path) -> int.
- Produces claim_next_exercise_thumbnail_job(session, now) and process_next_exercise_thumbnail_job() -> bool.

- [ ] **Step 1: Write failing worker tests**

~~~python
async def test_successful_job_replaces_source_with_ready_webp_under_limit(storage, session):
    await run_exercise_thumbnail_job("media-id", storage, WebpThumbnailTranscoder())
    media = await session.get(MediaObject, "media-id")
    assert (media.status, media.content_type) == ("READY", "image/webp")
    assert media.content_length <= 100 * 1024


async def test_invalid_image_marks_job_failed_without_publishing_source(storage, session):
    await run_exercise_thumbnail_job("bad-media-id", storage, WebpThumbnailTranscoder())
    assert (await session.get(MediaObject, "bad-media-id")).status == "FAILED"
~~~

- [ ] **Step 2: Verify the tests fail**

Run: cd backend; pytest tests/test_exercise_thumbnail_worker.py -v

Expected: FAIL because the worker and transcoder do not exist.

- [ ] **Step 3: Implement crop, bounded compression, and job processing**

Use the same SELECT FOR UPDATE SKIP LOCKED, fifteen-minute lease, five-second poll, and three-attempt behavior as exercise_video_streams.py. Claiming sets the job and media to PROCESSING. A successful job uploads only a completed temporary file to the existing private key, updates content_type/content_length, then marks job and media READY. Terminal failure marks both FAILED using only THUMBNAIL_INVALID_IMAGE, THUMBNAIL_TOO_LARGE, or THUMBNAIL_PROCESSING_FAILED.

~~~python
filter_graph = "scale=320:180:force_original_aspect_ratio=increase,crop=320:180"
for quality in (60, 50, 40, 30):
    run_ffmpeg(source, candidate, filter_graph, quality)
    if candidate.stat().st_size <= 100 * 1024:
        return candidate.stat().st_size
raise ThumbnailTranscodeError("THUMBNAIL_TOO_LARGE")
~~~

Add thumbnail-worker to Compose using image toptrainers-api and command python -m toptrainers_api.workers.exercise_thumbnails. Match video-worker environment, hardening, read-only root, tmpfs, and one CPU limit. Docker build verifies FFmpeg includes libwebp.

- [ ] **Step 4: Verify worker and Compose**

Run: cd backend; pytest tests/test_exercise_thumbnail_worker.py -v; docker compose -f ../infra/compose/compose.yaml config --quiet

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/media/thumbnails.py backend/src/toptrainers_api/workers/exercise_thumbnails.py backend/src/toptrainers_api/modules/media/storage.py backend/Dockerfile infra/compose/compose.yaml backend/tests/test_exercise_thumbnail_worker.py
git commit -m "feat: process optimized exercise thumbnails"
~~~

### Task 3: Add queue confirmation and batch authorization APIs

**Files:**

- Modify: backend/src/toptrainers_api/modules/exercises/schemas.py
- Modify: backend/src/toptrainers_api/modules/exercises/service.py
- Modify: backend/src/toptrainers_api/modules/exercises/router.py
- Modify: backend/src/toptrainers_api/modules/assignments/schemas.py
- Modify: backend/src/toptrainers_api/modules/assignments/service.py
- Modify: backend/src/toptrainers_api/modules/assignments/router.py
- Modify: backend/src/toptrainers_api/modules/media/service.py
- Modify: backend/openapi/openapi.json
- Create: backend/tests/test_exercise_thumbnail_http.py
- Modify: backend/tests/test_assignment_exercise_media_access.py
- Modify: backend/tests/test_exercise_http_contract.py

**Interfaces:**

- Produces ExerciseThumbnailConfirmResponse(media_id, status), MediaReadUrlsRequest(media_ids), and MediaReadUrlsResponse(items).
- Produces POST /exercises/thumbnail-read-urls and POST /assignments/{assignment_id}/exercise-media/read-urls.

- [ ] **Step 1: Write failing HTTP and authorization tests**

~~~python
async def test_thumbnail_confirm_enqueues_processing_job(client, trainer_token):
    response = await client.post(
        f"/api/v1/exercises/thumbnail-uploads/{media_id}/confirm", headers=trainer_token
    )
    assert response.json() == {"media_id": media_id, "status": "PROCESSING"}


async def test_trainer_batch_omits_other_trainer_and_unready_media(client, trainer_token):
    response = await client.post(
        "/api/v1/exercises/thumbnail-read-urls",
        json={"media_ids": [owned_ready, other_owner, pending]}, headers=trainer_token
    )
    assert [item["media_id"] for item in response.json()["items"]] == [owned_ready]


async def test_client_batch_rejects_media_outside_snapshot(client, client_token):
    response = await client.post(
        f"/api/v1/assignments/{assignment_id}/exercise-media/read-urls",
        json={"media_ids": [later_replaced_cover]}, headers=client_token
    )
    assert response.status_code == 404
~~~

- [ ] **Step 2: Verify the tests fail**

Run: cd backend; pytest tests/test_exercise_thumbnail_http.py tests/test_assignment_exercise_media_access.py tests/test_exercise_http_contract.py -v

Expected: FAIL because the response and batch operations do not exist.

- [ ] **Step 3: Implement the API**

Thumbnail confirmation must HEAD the object, create the unique job, and return PROCESSING without marking media READY. Existing ExercisePatch ready-media validation therefore prevents attachment until the worker succeeds.

MediaReadUrlsRequest accepts 1–200 unique 36-character IDs. Trainer batch output returns ready IDs belonging to caller-owned exercises in request order, omitting stale/unready values. Assignment batch output first checks active client access, then returns 404 for an ID not present in that immutable snapshot. Keep legacy single-URL endpoints intact. Generate OpenAPI through the existing backend generator.

- [ ] **Step 4: Verify API**

Run: cd backend; pytest tests/test_exercise_thumbnail_http.py tests/test_assignment_exercise_media_access.py tests/test_exercise_http_contract.py -v; python -m mypy src

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add backend/src/toptrainers_api/modules/exercises backend/src/toptrainers_api/modules/assignments backend/src/toptrainers_api/modules/media/service.py backend/openapi/openapi.json backend/tests/test_exercise_thumbnail_http.py backend/tests/test_assignment_exercise_media_access.py backend/tests/test_exercise_http_contract.py
git commit -m "feat: batch private exercise thumbnail URLs"
~~~

### Task 4: Update PWA compression and batch loading

**Files:**

- Modify: frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.ts
- Modify: frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts
- Modify: frontend/libs/pwa/feature-role-shell/src/lib/library-hub.component.ts
- Modify: frontend/libs/pwa/feature-role-shell/src/lib/client-workout-list.component.ts
- Modify: frontend/libs/pwa/feature-role-shell/src/lib/workout-player.component.ts
- Modify: frontend/libs/pwa/feature-role-shell/src/lib/client-workout-list.component.test.ts
- Modify: frontend/libs/pwa/feature-role-shell/src/lib/workout-player.component.test.ts
- Modify: frontend/libs/shared/data-access/src/lib/exercises.ts
- Modify: frontend/libs/shared/data-access/src/lib/exercises.test.ts
- Modify: frontend/libs/shared/data-access/src/lib/workout-assignments.ts
- Modify: frontend/libs/shared/data-access/src/lib/workout-assignments.test.ts
- Modify: frontend/libs/shared/contracts/src/generated files

**Interfaces:**

- Produces prepareExerciseThumbnail(file: File | HTMLVideoElement): Promise<File>.
- Produces ExercisesApi.createThumbnailReadUrls(mediaIds) and WorkoutAssignmentsApi.createExerciseMediaReadUrls(assignmentId, mediaIds).

- [ ] **Step 1: Write failing frontend tests**

~~~ts
it('creates a 320 by 180 WebP cover below 100 KiB', async () => {
  const result = await prepareExerciseThumbnail(sourceFile);
  expect(result.type).toBe('image/webp');
  expect(result.size).toBeLessThanOrEqual(100 * 1024);
});

it('loads shared cover URLs in one deduplicated request', () => {
  component.loadExercisesWithSharedCoverId();
  expect(exercisesApi.createThumbnailReadUrls).toHaveBeenCalledWith(['cover-id']);
});

it('marks grid cover images for async lazy decoding', () => {
  const image = fixture.nativeElement.querySelector('img');
  expect(image).toHaveAttribute('decoding', 'async');
  expect(image).toHaveAttribute('loading', 'lazy');
});
~~~

- [ ] **Step 2: Verify the tests fail**

Run: cd frontend; pnpm vitest run libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts libs/pwa/feature-role-shell/src/lib/client-workout-list.component.test.ts libs/pwa/feature-role-shell/src/lib/workout-player.component.test.ts libs/shared/data-access/src/lib/exercises.test.ts libs/shared/data-access/src/lib/workout-assignments.test.ts

Expected: FAIL because the helper and batch methods do not exist.

- [ ] **Step 3: Implement the browser and delivery paths**

Replace the current canvas helpers with one central 16:9 320×180 helper that tries WebP qualities 0.60, 0.50, 0.40, 0.30 and returns the first file under 100 KiB. The file input still accepts JPEG/PNG/WebP, but upload receives only prepared WebP.

Regenerate contracts with pnpm api:generate. Replace loops issuing createExerciseMediaReadUrl with a deduplicated batch call in library-hub, client-workout-list, and workout-player. Merge returned URLs into current signals, retain legacy thumbnail_url fallback, and leave absent results as a per-card placeholder.

Grid covers receive width 320, height 180, decoding async, and loading lazy. Client workout row covers keep their fixed CSS geometry and async decode without lazy loading.

- [ ] **Step 4: Generate and verify**

Run: cd frontend; pnpm api:generate; pnpm typecheck; pnpm vitest run libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts libs/pwa/feature-role-shell/src/lib/client-workout-list.component.test.ts libs/pwa/feature-role-shell/src/lib/workout-player.component.test.ts libs/shared/data-access/src/lib/exercises.test.ts libs/shared/data-access/src/lib/workout-assignments.test.ts

Expected: PASS.

- [ ] **Step 5: Commit**

~~~bash
git add frontend/libs/pwa/feature-role-shell frontend/libs/shared/data-access frontend/libs/shared/contracts
git commit -m "feat: optimize and batch exercise cover delivery"
~~~

### Task 5: Document, verify, and prepare production release

**Files:**

- Modify: DOC/DECISIONS.md
- Modify: DOC/PROJECT_MEMORY.md
- Modify: backend/tests/test_hls_deployment_config.py

**Interfaces:**

- Produces a documented production thumbnail-worker requirement and release verification evidence.

- [ ] **Step 1: Write the failing Compose regression test**

~~~python
def test_compose_runs_thumbnail_worker_from_the_api_image() -> None:
    compose = yaml.safe_load(COMPOSE_PATH.read_text())
    worker = compose["services"]["thumbnail-worker"]
    assert worker["image"] == compose["services"]["api"]["image"]
    assert worker["command"] == [
        "python", "-m", "toptrainers_api.workers.exercise_thumbnails"
    ]
~~~

- [ ] **Step 2: Verify the Compose regression**

Run: cd backend; pytest tests/test_hls_deployment_config.py -v

Expected: PASS after Task 2.

- [ ] **Step 3: Update project docs**

Add an ADR for authoritative private WebP derivatives and batched authorization. Add a concise project-memory entry covering the user-visible behavior and thumbnail-worker production requirement.

- [ ] **Step 4: Run full verification**

Run: cd backend; pytest; ruff check src tests; python -m mypy src

Run: cd frontend; pnpm api:generate; pnpm lint; pnpm typecheck; pnpm vitest run

Run: docker compose -f infra/compose/compose.yaml config --quiet

Expected: PASS. Report an external Google-font build fetch separately if it prevents a production frontend build; never count it as a code pass.

- [ ] **Step 5: Commit**

~~~bash
git add DOC/DECISIONS.md DOC/PROJECT_MEMORY.md backend/tests/test_hls_deployment_config.py
git commit -m "docs: record optimized exercise cover delivery"
~~~
