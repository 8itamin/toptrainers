# Exercise Editor Private Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trainer persist exercise title, description, multiple muscle groups, and one private S3 instructional video; an assigned client can view the snapshotted video.

**Architecture:** `exercises` owns edits and video endpoints, using private `media` for signed object operations. Exercise rows retain a legacy primary group and add ordered groups plus private media identity. Assignment snapshots copy the fields and `assignments` authorizes client read URLs.

**Tech Stack:** Angular 21, generated OpenAPI contracts, FastAPI, SQLAlchemy/Alembic/PostgreSQL JSONB, boto3-compatible private S3, pytest, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-23-exercise-editor-media-design.md`

## Global Constraints

- Permit only `video/mp4`, `video/webm`, `video/quicktime` and at most `200 * 1024 * 1024` bytes.
- Store private `media_id`, not a permanent public S3 URL.
- Require trainer ownership for exercise writes/previews and assignment-client authorization for playback.
- Keep legacy `muscle_group`, URL fields and historical snapshots compatible.
- Accept one to seven unique groups from `Ноги`, `Грудь`, `Спина`, `Плечи`, `Руки`, `Кор`, `Всё тело`; the first is primary.
- Do not commit S3 credentials. S3 CORS permits PWA-origin PUT with `Content-Type`.

## Review Focus

- A 200 MiB MOV is accepted and a 200 MiB + 1 byte MOV is rejected before a signed URL is requested (Tasks 2, 4).
- A trainer cannot attach another trainer's `READY` video (Task 2).
- A historical assignment keeps original values after a live exercise edit (Task 3).
- A client receives 404 for guessed/unreferenced media IDs (Task 3).
- A failed PUT, confirmation or PATCH retains the modal draft and never binds unconfirmed media (Task 4).

---

### Task 1: Persist editable exercise data

**Files:**
- Create: `backend/migrations/versions/20260923_0013_exercise_editor_private_video.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/models.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/schemas.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/repository.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/service.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/router.py`
- Test: `backend/tests/test_exercise_schemas.py`
- Test: `backend/tests/test_exercises_integration.py`

**Interfaces:** Produces `ExercisePatch`, `ExerciseResponse.muscle_groups`, `ExerciseResponse.video_media_id`, `update_exercise(session, account, exercise_id, payload)`, and `get_owned_exercise(session, trainer_id, exercise_id)`.

- [ ] **Step 1: Write the failing schema tests**

```python
def test_patch_preserves_ordered_primary_group() -> None:
    assert ExercisePatch(muscle_groups=["Спина", "Руки"]).muscle_groups == ["Спина", "Руки"]

def test_patch_rejects_duplicate_or_unknown_groups() -> None:
    with pytest.raises(ValidationError):
        ExercisePatch(muscle_groups=["Спина", "Спина"])
    with pytest.raises(ValidationError):
        ExercisePatch(muscle_groups=["Шея"])
```

- [ ] **Step 2: Verify RED**

Run: `pytest backend/tests/test_exercise_schemas.py -q`

Expected: FAIL because `ExercisePatch` and `muscle_groups` are absent.

- [ ] **Step 3: Implement data and mutation contracts**

```python
if "muscle_groups" in values:
    exercise.muscle_groups = values["muscle_groups"]
    exercise.muscle_group = values["muscle_groups"][0]
```

Use a non-null JSONB list, backfilled from `[muscle_group]`, and nullable `video_media_id`. PATCH must return 404 for a non-owner without disclosing the row.

- [ ] **Step 4: Verify GREEN**

Run: `pytest backend/tests/test_exercise_schemas.py backend/tests/test_exercises_integration.py -q`

Expected: PASS; an owner persists title, instruction and groups.

- [ ] **Step 5: Commit**

Run: `git add backend/migrations/versions/20260923_0013_exercise_editor_private_video.py backend/src/toptrainers_api/modules/exercises backend/tests/test_exercise_schemas.py backend/tests/test_exercises_integration.py && git commit -m "feat: persist editable exercise details"`

### Task 2: Add purpose-scoped private video uploads

**Files:**
- Modify: `backend/src/toptrainers_api/modules/media/models.py`
- Modify: `backend/src/toptrainers_api/modules/media/repository.py`
- Modify: `backend/src/toptrainers_api/modules/media/service.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/schemas.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/service.py`
- Modify: `backend/src/toptrainers_api/modules/exercises/router.py`
- Test: `backend/tests/test_media_service.py`
- Test: `backend/tests/test_exercise_video_service.py`
- Test: `backend/tests/test_exercise_http_contract.py`

**Interfaces:** Consumes Task 1. Produces `ExerciseVideoUploadRequest`, `create_video_upload`, `confirm_video_upload`, `create_exercise_video_read_url`, plus video-upload, confirmation and owner-read routes.

- [ ] **Step 1: Write failing size/type/ownership tests**

```python
@pytest.mark.parametrize("content_type", ["video/mp4", "video/webm", "video/quicktime"])
def test_video_upload_accepts_allowed_content_types(content_type: str) -> None:
    assert ExerciseVideoUploadRequest(content_type=content_type, content_length=200 * 1024 * 1024)

def test_video_upload_rejects_more_than_200_mib() -> None:
    with pytest.raises(ValidationError):
        ExerciseVideoUploadRequest(content_type="video/mp4", content_length=200 * 1024 * 1024 + 1)
```

Also test PATCH rejects foreign-owner, `PENDING`, and `TASK_PHOTO` media.

- [ ] **Step 2: Verify RED**

Run: `pytest backend/tests/test_media_service.py backend/tests/test_exercise_video_service.py backend/tests/test_exercise_http_contract.py -q`

Expected: FAIL because the typed policy and exercise routes do not exist.

- [ ] **Step 3: Implement policy-scoped media and APIs**

```python
EXERCISE_VIDEO_POLICY = UploadPolicy(
    purpose="EXERCISE_VIDEO", key_prefix="exercise-video",
    content_types=frozenset({"video/mp4", "video/webm", "video/quicktime"}),
    max_content_length=200 * 1024 * 1024,
)
```

Add `purpose` to `MediaObject`, default old rows to `TASK_PHOTO`, validate purpose at confirmation/binding/read, and keep generic task upload routes image-only. Signed API responses expose URLs/headers, never object keys.

- [ ] **Step 4: Verify GREEN and regenerate contracts**

Run: `pytest backend/tests/test_media_service.py backend/tests/test_exercise_video_service.py backend/tests/test_exercise_http_contract.py -q && cd frontend && pnpm api:generate && pnpm typecheck`

Expected: PASS; storage sees `exercise-video/{owner_id}/...`, exact content type and exact length.

- [ ] **Step 5: Commit**

Run: `git add backend/src/toptrainers_api/modules/media backend/src/toptrainers_api/modules/exercises backend/tests/test_media_service.py backend/tests/test_exercise_video_service.py backend/tests/test_exercise_http_contract.py frontend/libs/shared/contracts/src/generated && git commit -m "feat: add private exercise video uploads"`

### Task 3: Snapshot and authorize client playback

**Files:**
- Modify: `backend/src/toptrainers_api/modules/assignments/schemas.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/service.py`
- Modify: `backend/src/toptrainers_api/modules/assignments/router.py`
- Test: `backend/tests/test_assignments_domain.py`
- Test: `backend/tests/test_assignments_http_contract.py`
- Test: `backend/tests/test_assignment_exercise_media_access.py`

**Interfaces:** Consumes media purpose from Task 2. Produces `WorkoutSnapshotExerciseV1.muscle_groups`, `.video_media_id`, and `create_assignment_exercise_media_read_url(session, account, assignment_id, media_id, storage)`.

- [ ] **Step 1: Write failing snapshot and access tests**

```python
def test_snapshot_copies_groups_and_private_video() -> None:
    item = build_workout_snapshot_v1(workout, {exercise.id: exercise}).blocks[0].exercises[0]
    assert item.muscle_groups == ["Спина", "Руки"]
    assert item.video_media_id == "media-video-1"

@pytest.mark.asyncio
async def test_client_cannot_read_unreferenced_media() -> None:
    with pytest.raises(HTTPException, match="not found"):
        await create_assignment_exercise_media_read_url(session, client, assignment.id, "other-media", storage)
```

- [ ] **Step 2: Verify RED**

Run: `pytest backend/tests/test_assignments_domain.py backend/tests/test_assignment_exercise_media_access.py -q`

Expected: FAIL because snapshot fields and assignment media route do not exist.

- [ ] **Step 3: Implement immutable reference check**

```python
def snapshot_references_media(snapshot: WorkoutSnapshotV1, media_id: str) -> bool:
    return any(item.video_media_id == media_id for block in snapshot.blocks for item in block.exercises)
```

Use the existing assignment/client relationship authorization. Return 404 for missing, foreign, revoked or unreferenced access and do not modify stored snapshots.

- [ ] **Step 4: Verify GREEN and generated contracts**

Run: `pytest backend/tests/test_assignments_domain.py backend/tests/test_assignments_http_contract.py backend/tests/test_assignment_exercise_media_access.py -q && cd frontend && pnpm api:generate && pnpm typecheck`

Expected: PASS; old snapshot fixtures deserialize with optional new fields.

- [ ] **Step 5: Commit**

Run: `git add backend/src/toptrainers_api/modules/assignments backend/tests/test_assignments_domain.py backend/tests/test_assignments_http_contract.py backend/tests/test_assignment_exercise_media_access.py frontend/libs/shared/contracts/src/generated && git commit -m "feat: authorize snapshotted exercise video playback"`

### Task 4: Connect the modal and workout player to real APIs

**Files:**
- Create: `frontend/libs/shared/data-access/src/lib/exercises.ts`
- Create: `frontend/libs/shared/data-access/src/lib/exercises.test.ts`
- Modify: `frontend/libs/shared/data-access/src/index.ts`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor-state.ts`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor-state.test.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/library-hub.component.ts`
- Modify: `frontend/libs/pwa/feature-role-shell/src/lib/workout-player.component.ts`
- Create: `frontend/libs/pwa/feature-role-shell/src/lib/workout-player-video.test.ts`

**Interfaces:** Consumes generated contracts from Tasks 1--3. Produces `ExercisesDataAccess`, `ExerciseEditorDraft`, `addMuscleGroup`, `removeMuscleGroup`, `validateVideoFile`, `saveExerciseDraft`, and assignment media read client state.

- [ ] **Step 1: Write failing data and editor-state tests**

```typescript
it('rejects a 200 MiB plus one byte MOV before upload', () => {
  expect(validateVideoFile({ type: 'video/quicktime', size: 200 * 1024 * 1024 + 1 } as File)).toEqual({
    kind: 'error', message: 'Видео должно быть не больше 200 МБ.',
  });
});

it('keeps selected muscle groups ordered and removable', () => {
  const draft = addMuscleGroup(emptyExerciseDraft(), 'Спина');
  expect(addMuscleGroup(draft, 'Руки').muscleGroups).toEqual(['Спина', 'Руки']);
});
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend && .\\node_modules\\.bin\\vitest.cmd run libs/shared/data-access/src/lib/exercises.test.ts libs/pwa/feature-role-shell/src/lib/exercise-editor-state.test.ts`

Expected: FAIL because typed exercise data access and draft state do not exist.

- [ ] **Step 3: Implement upload, save and playback flow**

```typescript
const mediaId = draft.videoFile ? await uploadAndConfirmVideo(draft.videoFile, api, setProgress) : draft.videoMediaId;
return draft.id
  ? firstValueFrom(api.update(draft.id, { title: draft.title, instruction: draft.instruction, muscle_groups: draft.muscleGroups, video_media_id: mediaId }))
  : firstValueFrom(api.create({ ...draft, video_media_id: mediaId }));
```

Use `XMLHttpRequest` for presigned S3 PUT progress and do not send API cookies to S3. Render editable inputs, controlled muscle chips, filename/progress/owner preview, disabled save, and retained draft errors. Replace static library cards with API data and update the saved card in place. The player requests a read URL only for `video_media_id`, renders native `<video controls>` on success, and otherwise keeps legacy video URL behavior.

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend && .\\node_modules\\.bin\\vitest.cmd run libs/shared/data-access/src/lib/exercises.test.ts libs/pwa/feature-role-shell/src/lib/exercise-editor-state.test.ts libs/pwa/feature-role-shell/src/lib/exercise-editor.component.test.ts libs/pwa/feature-role-shell/src/lib/library-hub.component.test.ts libs/pwa/feature-role-shell/src/lib/workout-player-video.test.ts && .\\node_modules\\.bin\\tsc.cmd --noEmit -p tsconfig.json`

Expected: PASS; edit/create, upload failure retention, group manipulation and private player request behavior are covered.

- [ ] **Step 5: Commit**

Run: `git add frontend/libs/shared/data-access frontend/libs/pwa/feature-role-shell/src/lib && git commit -m "feat: persist exercises with private video"`

### Task 5: Run end-to-end verification and release

**Files:**
- Modify: `DOC/PROJECT_MEMORY.md`
- Modify: `DOC/DECISIONS.md` only if an existing ADR is changed by the implementation.

**Interfaces:** Consumes Tasks 1--4 and produces a verified production release.

- [ ] **Step 1: Add and run migration/service verification**

```python
def test_existing_exercise_backfills_to_one_group() -> None:
    assert migrated_row['muscle_groups'] == [migrated_row['muscle_group']]
```

Run: `cd backend && pytest -q`

Expected: PASS.

- [ ] **Step 2: Verify the exact S3 browser contract outside Git**

Run a temporary authenticated trainer flow in production: create a small `video/mp4` upload, PUT with returned headers from the PWA origin, confirm, retrieve an owner read URL, and HEAD the URL. Bind it only to a disposable owned exercise; assert an unrelated account receives 404. Do not save URLs, object keys, cookies or credentials in Git or reports.

Expected: only the configured PWA origin can PUT, signed URLs expire, and unauthorized reads fail.

- [ ] **Step 3: Run full verification**

Run: `cd backend && pytest -q && cd ../frontend && pnpm test && pnpm lint && pnpm typecheck`

Expected: all suites pass. If local build cannot fetch Google Fonts, record that environmental failure and require a successful production Docker build before release.

- [ ] **Step 4: Update memory and commit**

Add a dated `DOC/PROJECT_MEMORY.md` entry for private exercise editing, immutable snapshot media and authorized client playback, without S3 configuration values.

Run: `git add DOC/PROJECT_MEMORY.md && git commit -m "docs: record private exercise video workflow"`

- [ ] **Step 5: Deploy and verify health**

Run: `git push origin main`; monitor `toptrainers-deploy.service` to the final revision; query production `/api/v1/health/ready` through the gateway.

Expected: the latest revision deploys and reports database and Redis `ok`.
