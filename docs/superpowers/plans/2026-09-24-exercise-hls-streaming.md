# Exercise HLS Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream every newly uploaded exercise video as a private 720p HLS rendition so seek loads only the target two-second segments.

**Architecture:** `media` owns an `ExerciseVideoStream` row that is a durable transcode job for one confirmed `EXERCISE_VIDEO` source object. A single Compose worker claims jobs transactionally, invokes FFmpeg and stores private fMP4 HLS objects. Trainer and client APIs authorize a dynamic playlist and substitute a signed S3 URL for each segment; the Angular player uses native HLS or `hls.js` while legacy MP4 remains unchanged.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, PostgreSQL, boto3/S3, FFmpeg, Docker Compose, Angular 21, hls.js, Vitest, pytest.

**Spec:** `docs/superpowers/specs/2026-09-24-exercise-hls-streaming-design.md`

## Global Constraints

- Process only new `EXERCISE_VIDEO` uploads; never migrate or delete existing MP4 objects.
- Keep source, manifest and every HLS segment private; no public bucket policy, object URL or user-controlled path.
- Produce one 720p-or-smaller H.264/AAC fMP4 HLS variant with a 2-second GOP and segment target.
- A trainer/client can receive a playlist only through the existing owner or active frozen-assignment authorization boundary.
- The worker processes one job at a time, cleans `/tmp` in `finally`, limits retries to three, and never passes user data as an FFmpeg argument.
- HLS segment URLs live 15 minutes; playlists are `Cache-Control: no-store`.
- Save remains disabled until a newly selected video stream and its required cover are `READY`.
- Existing private MP4 and legacy URL exercises retain their current player paths.

## Review Focus

- A source media ID belonging to another trainer must not produce a stream job or manifest; Task 1 and Task 5 assert 404/ownership isolation.
- A client with a terminated relationship or an assignment whose frozen snapshot lacks the media ID must not receive a playlist; Task 5 asserts both cases.
- A worker crash after claiming a job must make the expired lease retryable without two workers encoding it; Task 3 asserts the lease transition.
- A failed FFmpeg process must not expose stderr, leave local files, or let the exercise save; Task 3 and Task 6 assert sanitized failure and cleanup.
- A signed segment URL expiring during playback must cause one authenticated manifest refresh, not a fallback to public MP4; Task 7 asserts the recovery hook.

---

### Task 1: Persist one stream job per new exercise video

**Files:**
- Modify: `backend/src/toptrainers_api/modules/media/models.py`
- Modify: `backend/src/toptrainers_api/modules/media/repository.py`
- Modify: `backend/src/toptrainers_api/modules/media/service.py`
- Create: `backend/migrations/versions/20260924_0015_exercise_video_streams.py`
- Create: `backend/tests/test_exercise_video_streams.py`

**Interfaces:**
- Produces `ExerciseVideoStream(source_media_id, status, manifest_key, segment_prefix, duration_seconds, attempt_count, lease_expires_at, last_error_code)`.
- Produces `enqueue_exercise_video_stream(session, media_id) -> ExerciseVideoStream` and `get_exercise_video_stream(session, media_id) -> ExerciseVideoStream | None`.
- Consumes `MediaObject` with purpose `EXERCISE_VIDEO` and status `READY`.

- [ ] **Step 1: Write the failing persistence tests**

```python
async def test_enqueue_creates_one_pending_stream_for_ready_exercise_video(session, media):
    stream = await enqueue_exercise_video_stream(session, media.id)
    assert stream.status == "PENDING"
    assert stream.source_media_id == media.id

async def test_enqueue_rejects_media_owned_by_another_trainer(session, other_media):
    with pytest.raises(HTTPException, match="not found"):
        await enqueue_exercise_video_stream(session, other_media.id)
```

- [ ] **Step 2: Run the new backend test file and verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exercise_video_streams.py -q` from `backend`.

Expected: FAIL because `ExerciseVideoStream` and `enqueue_exercise_video_stream` do not exist.

- [ ] **Step 3: Add the model, repository functions and migration**

```python
class ExerciseVideoStream(Base):
    __tablename__ = "exercise_video_streams"
    source_media_id: Mapped[str] = mapped_column(ForeignKey("media_objects.id"), primary_key=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    manifest_key: Mapped[str | None] = mapped_column(String(512))
    segment_prefix: Mapped[str | None] = mapped_column(String(512))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lease_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error_code: Mapped[str | None] = mapped_column(String(64))
```

Add checks for `PENDING|PROCESSING|READY|FAILED`, a foreign key cascade to `media_objects`, and an index that selects pending/retry jobs. Make enqueue idempotent with the primary key and commit only the source-media owner’s job.

- [ ] **Step 4: Run the stream persistence tests**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exercise_video_streams.py -q` from `backend`.

Expected: PASS.

- [ ] **Step 5: Commit the persistence slice**

```bash
git add backend/src/toptrainers_api/modules/media backend/migrations/versions/20260924_0015_exercise_video_streams.py backend/tests/test_exercise_video_streams.py
git commit -m "feat: persist exercise video stream jobs"
```

### Task 2: Build private HLS storage and manifest rendering

**Files:**
- Modify: `backend/src/toptrainers_api/modules/media/storage.py`
- Create: `backend/src/toptrainers_api/modules/media/hls.py`
- Create: `backend/tests/test_hls_manifest.py`

**Interfaces:**
- Produces `HlsStorage.write_stream(object_prefix, local_directory) -> tuple[str, str]` and `HlsStorage.read_manifest(manifest_key) -> str`.
- Produces `render_signed_hls_manifest(manifest_text, segment_prefix, storage) -> str`.
- Consumes a worker-generated playlist containing only safe relative `segment_*.m4s` and `init.mp4` filenames.

- [ ] **Step 1: Write failing manifest security tests**

```python
def test_renderer_replaces_only_relative_hls_artifacts_with_signed_urls(storage):
    rendered = render_signed_hls_manifest("#EXTM3U\n#EXT-X-MAP:URI=\"init.mp4\"\nsegment_000.m4s\n", "exercise-hls/m1", storage)
    assert "https://signed.example/exercise-hls/m1/init.mp4" in rendered
    assert "https://signed.example/exercise-hls/m1/segment_000.m4s" in rendered

def test_renderer_rejects_parent_paths_and_external_urls(storage):
    with pytest.raises(ValueError):
        render_signed_hls_manifest("../secret.m4s", "exercise-hls/m1", storage)
```

- [ ] **Step 2: Run the manifest tests and verify they fail**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_hls_manifest.py -q` from `backend`.

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement storage helpers and strict renderer**

```python
def hls_segment_key(prefix: str, filename: str) -> str:
    if Path(filename).name != filename or filename not in {"init.mp4", *SEGMENT_NAMES}:
        raise ValueError("Unsafe HLS filename")
    return f"{prefix}/{filename}"

def render_signed_hls_manifest(manifest_text: str, segment_prefix: str, storage: PrivateS3Storage) -> str:
    rendered_lines: list[str] = []
    for line in manifest_text.splitlines():
        if line.startswith('#EXT-X-MAP:URI="'):
            filename = line.removeprefix('#EXT-X-MAP:URI="').removesuffix('"')
            rendered_lines.append(f'#EXT-X-MAP:URI="{storage.create_hls_segment_read_url(hls_segment_key(segment_prefix, filename))}"')
        elif line and not line.startswith('#'):
            rendered_lines.append(storage.create_hls_segment_read_url(hls_segment_key(segment_prefix, line)))
        else:
            rendered_lines.append(line)
    return "\n".join(rendered_lines) + "\n"
```

Implement `put_file`, `get_file`, `get_text`, and `create_hls_segment_read_url(object_key: str) -> str` with `ExpiresIn=900`, without changing the existing five-minute MP4 read URL behavior.

- [ ] **Step 4: Run manifest tests**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_hls_manifest.py -q` from `backend`.

Expected: PASS.

- [ ] **Step 5: Commit the storage slice**

```bash
git add backend/src/toptrainers_api/modules/media/storage.py backend/src/toptrainers_api/modules/media/hls.py backend/tests/test_hls_manifest.py
git commit -m "feat: add private HLS manifest rendering"
```

### Task 3: Add the durable FFmpeg worker

**Files:**
- Create: `backend/src/toptrainers_api/workers/exercise_video_streams.py`
- Create: `backend/src/toptrainers_api/modules/media/transcoder.py`
- Create: `backend/tests/test_exercise_video_worker.py`
- Create: `backend/tests/test_hls_deployment_config.py`
- Modify: `backend/Dockerfile`
- Modify: `infra/compose/compose.yaml`
- Modify: `infra/scripts/deploy-tailnet.sh`

**Interfaces:**
- Produces `claim_next_exercise_video_stream(session, now) -> ExerciseVideoStream | None` and `run_exercise_video_stream_job(stream_id, storage, transcoder) -> None`.
- Produces `FfmpegTranscoder.transcode(source_path: Path, output_dir: Path) -> TranscodeResult(duration_seconds: int, manifest_filename: str)`.
- Consumes Task 1 durable jobs and Task 2 private storage helpers.

- [ ] **Step 1: Write failing worker tests**

```python
async def test_worker_claims_one_pending_job_and_marks_it_ready(fake_storage, fake_transcoder, session):
    await run_exercise_video_stream_job("media-1", fake_storage, fake_transcoder)
    assert (await get_exercise_video_stream(session, "media-1")).status == "READY"

async def test_expired_processing_lease_is_claimed_once_for_retry(session):
    claimed = await claim_next_exercise_video_stream(session, expired_lease_time)
    assert claimed.status == "PROCESSING"
    assert claimed.attempt_count == 2

async def test_failed_transcode_cleans_temp_files_and_hides_stderr(fake_transcoder, tmp_path):
    await run_exercise_video_stream_job("media-1", storage, fake_transcoder)
    assert stream.last_error_code == "TRANSCODE_FAILED"
    assert not list(tmp_path.iterdir())

def test_compose_declares_single_video_worker_with_tmpfs():
    compose = yaml.safe_load(Path('infra/compose/compose.yaml').read_text())
    assert compose['services']['video-worker']['read_only'] is True
    assert compose['services']['video-worker']['tmpfs'] == ['/tmp']
```

- [ ] **Step 2: Run worker tests and verify they fail**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exercise_video_worker.py -q` from `backend`.

Expected: FAIL because worker/transcoder modules do not exist.

- [ ] **Step 3: Implement transactional worker and fixed FFmpeg command**

```python
command = [
    "ffmpeg", "-y", "-i", str(source_path),
    "-vf", "scale=1280:720:force_original_aspect_ratio=decrease",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
    "-c:a", "aac", "-hls_time", "2", "-hls_segment_type", "fmp4",
    "-hls_fmp4_init_filename", "init.mp4", "-hls_segment_filename", str(output_dir / "segment_%03d.m4s"),
    str(output_dir / "playlist.m3u8"),
]
```

Set job `PROCESSING` and a lease in the claim transaction. On success upload only `playlist.m3u8`, `init.mp4`, and `segment_*.m4s`, then atomically set `READY`. On failure increment attempts, return `PENDING` while attempts are below three, otherwise set `FAILED` with a short code only. Install `ffmpeg` in the backend image and add a read-only, `/tmp`-backed `video-worker` Compose service with command `python -m toptrainers_api.workers.exercise_video_streams`; include it in deploy health/start handling.

- [ ] **Step 4: Run worker tests**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exercise_video_worker.py -q` from `backend`.

Expected: PASS.

- [ ] **Step 5: Commit the worker slice**

```bash
git add backend/src/toptrainers_api/workers backend/src/toptrainers_api/modules/media/transcoder.py backend/tests/test_exercise_video_worker.py backend/Dockerfile infra/compose/compose.yaml infra/scripts/deploy-tailnet.sh
git commit -m "feat: transcode exercise videos to private HLS"
```

### Task 4: Surface stream state in exercise upload and save rules

**Files:**
- Modify: `backend/src/toptrainers_api/modules/exercises/schemas.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/service.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/router.py`
- Modify: `backend/tests/test_exercise_video_uploads.py`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor-state.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor-state.test.ts`

**Interfaces:**
- Produces `video_stream_status: Literal["NONE", "PROCESSING", "READY", "FAILED"]` on `ExerciseResponse`.
- `confirm_video_upload` enqueues the Task 1 row and returns stream status `PROCESSING`.
- `canSaveExerciseWithThumbnail(video_upload_status, thumbnail_upload_status, thumbnail_required, video_stream_status) -> boolean`.

- [ ] **Step 1: Write failing API and state tests**

```python
async def test_confirmed_video_reports_processing_and_update_rejects_it_until_ready(client):
    assert (await confirm_video_upload()).stream_status == "PROCESSING"
    assert (await patch_exercise(video_media_id=media_id)).status_code == 422
```

```ts
it('blocks save while a newly uploaded video stream is processing', () => {
  expect(canSaveExerciseWithThumbnail('uploaded', 'uploaded', true, 'PROCESSING')).toBe(false);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exercise_video_uploads.py -q` from `backend` and `node_modules/.bin/vitest.cmd run libs/pwa/feature-role-shell/src/lib/exercise-editor-state.test.ts` from `frontend`.

Expected: FAIL because stream status is absent and save does not inspect it.

- [ ] **Step 3: Implement status responses, enqueue and server-side readiness guard**

```python
if values.get("video_media_id") and stream.status != "READY":
    raise HTTPException(status_code=422, detail="Exercise video stream is not ready")
```

Keep the existing thumbnail ownership/ready checks. Return `NONE` only for exercises without private video, `PROCESSING`/`FAILED` for new jobs, and `READY` only after worker completion.

- [ ] **Step 4: Run focused tests**

Run the commands from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit the upload-state slice**

```bash
git add backend/src/toptrainers_api/modules/exercises backend/tests/test_exercise_video_uploads.py frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor-state.ts frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor-state.test.ts
git commit -m "feat: track exercise video stream readiness"
```

### Task 5: Serve authorized dynamic HLS playlists

**Files:**
- Modify: `backend/src/toptrainers_api/modules/exercises/router.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/service.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/router.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/service.py`
- Modify: `backend/tests/test_exercise_hls_access.py`
- Modify: `backend/tests/test_assignment_exercise_media_access.py`

**Interfaces:**
- Produces trainer `GET /exercises/{exercise_id}/video/stream.m3u8` and client `GET /assignments/{assignment_id}/exercise-media/{media_id}/stream.m3u8`.
- Produces `Response(content=playlist, media_type="application/vnd.apple.mpegurl", headers={"Cache-Control": "no-store"})`.
- Consumes Task 2 renderer and existing owner/frozen snapshot checks.

- [ ] **Step 1: Write failing access tests**

```python
async def test_owner_manifest_contains_signed_segment_urls(client, ready_stream):
    response = await client.get(f"/api/v1/exercises/{ready_stream.exercise_id}/video/stream.m3u8")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/vnd.apple.mpegurl")
    assert "X-Amz-Signature" in response.text

async def test_client_cannot_read_manifest_for_media_absent_from_frozen_snapshot(client):
    response = await client.get("/api/v1/assignments/a1/exercise-media/other-media/stream.m3u8")
    assert response.status_code == 404
```

- [ ] **Step 2: Run the playlist tests and verify they fail**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_exercise_hls_access.py tests/test_assignment_exercise_media_access.py -q` from `backend`.

Expected: FAIL with 404 because stream routes do not exist.

- [ ] **Step 3: Implement routes through existing authorization services**

```python
async def create_authorized_stream_manifest(
    session: AsyncSession,
    media_id: str,
    storage: PrivateS3Storage,
) -> str:
    stream = await repository.get_ready_stream(session, media_id)
    if stream is None:
        raise _not_found("EXERCISE_STREAM_NOT_READY", "Exercise video is not ready")
    return render_signed_hls_manifest(await storage.get_text(stream.manifest_key), stream.segment_prefix, storage)
```

Authorize first, then load/render. Do not add a public segment API or return the source MP4 as fallback from a failed/processing new stream.

- [ ] **Step 4: Run playlist tests**

Run the commands from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit authorized manifest delivery**

```bash
git add backend/src/toptrainers_api/modules/exercises backend/src/toptrainers_api/modules/assignments backend/tests/test_exercise_hls_access.py backend/tests/test_assignment_exercise_media_access.py
git commit -m "feat: authorize private exercise HLS playlists"
```

### Task 6: Complete editor processing and retry interaction

**Files:**
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts`
- Modify: `frontend/libs/shared/contracts/src/generated/exercises.ts` (generated)
- Modify: `frontend/libs/shared/data-access/src/lib/exercises.ts`
- Modify: `backend/src/toptrainers_api/modules/exercises/router.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/service.py`
- Modify: `backend/tests/test_exercise_video_uploads.py`

**Interfaces:**
- Produces `POST /exercises/video-uploads/{media_id}/retry-stream` for the source owner when status is `FAILED`.
- Consumes `video_stream_status` from Task 4 and `retryVideoStream(mediaId)` generated/data-access API method.

- [ ] **Step 1: Write failing UI and retry tests**

```ts
it('shows processing after upload and keeps the save button disabled', () => {
  expect(fixture.nativeElement.textContent).toContain('Обрабатываем видео');
  expect(fixture.nativeElement.querySelector<HTMLButtonElement>('.save')?.disabled).toBe(true);
});
```

```python
async def test_owner_can_retry_failed_stream_once(client, failed_stream):
    response = await client.post(f"/api/v1/exercises/video-uploads/{failed_stream.source_media_id}/retry-stream")
    assert response.status_code == 200
    assert response.json()["stream_status"] == "PROCESSING"
```

- [ ] **Step 2: Run the focused UI and backend tests and verify they fail**

Run: `node_modules/.bin/vitest.cmd run libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts` from `frontend` and `./.venv/Scripts/python.exe -m pytest tests/test_exercise_video_uploads.py -q` from `backend`.

Expected: FAIL because no retry endpoint or processing message exists.

- [ ] **Step 3: Implement UI states and safe retry**

```ts
if (this.videoStreamStatus() === 'PROCESSING') return 'Обрабатываем видео…';
if (this.videoStreamStatus() === 'FAILED') return 'Повторить обработку';
```

The retry endpoint must reset only a failed source-media stream to `PENDING`, clear the sanitized error code, and reject `PROCESSING`/`READY` retries. Generate contracts with `pnpm api:generate`; do not edit generated type text manually.

- [ ] **Step 4: Run focused tests**

Run the commands from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit editor state and retry**

```bash
git add frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.ts frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts frontend/libs/shared/data-access/src/lib/exercises.ts frontend/libs/shared/contracts/src/generated/exercises.ts backend/src/toptrainers_api/modules/exercises backend/tests/test_exercise_video_uploads.py
git commit -m "feat: show exercise HLS processing state"
```

### Task 7: Play private HLS in the workout player

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-hls-player.directive.ts`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-hls-player.directive.test.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/workout-player.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/workout-player-video.test.ts`
- Modify: `frontend/libs/shared/data-access/src/lib/workout-assignments.ts`
- Modify: `frontend/libs/shared/contracts/src/generated/workout-assignments.ts` (generated)

**Interfaces:**
- Produces `ExerciseHlsPlayerDirective` input `manifestUrl: string | null` and output `manifestExpired`.
- Consumes client manifest route from Task 5 and native `HTMLVideoElement.canPlayType("application/vnd.apple.mpegurl")` or `Hls.isSupported()`.

- [ ] **Step 1: Write failing player tests**

```ts
it('uses a signed manifest for ready HLS media instead of the source MP4', () => {
  expect(component.exerciseStreamUrl('media-1')).toContain('/stream.m3u8');
  expect(fixture.nativeElement.querySelector('video')?.getAttribute('preload')).toBe('metadata');
});

it('refreshes the manifest once after an expired segment response', () => {
  directive.onHlsError({ response: { code: 403 }, fatal: true });
  expect(refreshManifest).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the player tests and verify they fail**

Run: `node_modules/.bin/vitest.cmd run libs/pwa/feature-role-shell/src/lib/exercise-hls-player.directive.test.ts libs/pwa/feature-role-shell/src/lib/workout-player-video.test.ts` from `frontend`.

Expected: FAIL because the directive and manifest operation do not exist.

- [ ] **Step 3: Install hls.js and implement native/fallback playback**

```ts
if (video.canPlayType('application/vnd.apple.mpegurl')) {
  video.src = manifestUrl;
} else if (Hls.isSupported()) {
  this.hls = new Hls({ xhrSetup: (xhr) => { xhr.withCredentials = true; } });
  this.hls.loadSource(manifestUrl);
  this.hls.attachMedia(video);
}
```

Destroy `Hls` on input change/component destruction. On the first fatal 401/403 segment load, emit `manifestExpired`; the player reloads the authorized manifest once. Retain the exact current MP4 `<video>` branch for legacy media and never select it for a new stream marked `READY`.

- [ ] **Step 4: Run player tests**

Run the commands from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit player support**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/libs/pwa/feature-role-shell/src/lib/exercise-hls-player.directive.ts frontend/libs/pwa/feature-role-shell/src/lib/exercise-hls-player.directive.test.ts frontend/libs/pwa/feature-role-shell/src/lib/workout-player.component.ts frontend/libs/pwa/feature-role-shell/src/lib/workout-player-video.test.ts frontend/libs/shared/data-access/src/lib/workout-assignments.ts frontend/libs/shared/contracts/src/generated/workout-assignments.ts
git commit -m "feat: play private exercise HLS streams"
```

### Task 8: Verify the complete release and document operations

**Files:**
- Modify: `infra/README.md`
- Modify: `DOC/PROJECT_MEMORY.md`
- Modify: `docs/superpowers/specs/2026-09-24-exercise-hls-streaming-design.md`
- Modify: `docs/superpowers/plans/2026-09-24-exercise-hls-streaming.md`

**Interfaces:**
- Consumes all prior tasks and the production worker health behavior.
- Produces documented FFmpeg/worker requirements, S3 CORS expose headers and an explicit release acceptance checklist.

- [ ] **Step 1: Add runbook and project-memory checkpoints**

Document FFmpeg image dependency, `video-worker` health/status command, exact S3 CORS exposed headers `Content-Range`/`Accept-Ranges`, processing failure triage, and that existing MP4s are intentionally unchanged.

- [ ] **Step 2: Run complete verification**

Run from `backend`:

```bash
./.venv/Scripts/python.exe -m ruff check --no-cache src tests
./.venv/Scripts/python.exe -m mypy --cache-dir "$env:TEMP\toptrainers-mypy-cache" src
./.venv/Scripts/python.exe -m pytest
```

Run from `frontend`:

```bash
pnpm api:generate
pnpm typecheck
pnpm test -- --run
pnpm build
```

Run `git diff --check`, then manually upload a short new MP4 in staging, wait for `READY`, seek in Chrome and Safari, verify segment `206` requests, try a terminated client and a non-snapshot media ID, and confirm legacy MP4 remains playable.

- [ ] **Step 3: Commit release documentation**

```bash
git add infra/README.md DOC/PROJECT_MEMORY.md docs/superpowers/specs/2026-09-24-exercise-hls-streaming-design.md docs/superpowers/plans/2026-09-24-exercise-hls-streaming.md
git commit -m "docs: record private exercise HLS operation"
```
