# Exercise editor: persistent fields and private instructional video

## Purpose and scope

A trainer can create or edit an owned exercise from the Programs library: set its name and client-visible description, choose one or more muscle groups, and upload one instructional video. The video is stored in the configured S3-compatible private bucket, never as a public URL.

The scope includes one video per exercise, `video/mp4`, `video/webm`, and `video/quicktime`, with a 200 MiB maximum. It does not add thumbnails, transcoding, video deletion, arbitrary muscle-group creation, or a public media CDN.

## Ownership and immutable history

The `exercises` module remains the owner of exercise writes and all exercise-specific routes. The `media` module remains responsible for private object storage, signed URLs, and object confirmation. The `assignments` module independently authorizes a client to read a video referenced by that client's immutable workout snapshot.

An exercise keeps the current `muscle_group` as its primary group so existing workout and snapshot consumers remain compatible. A new `muscle_groups` JSONB column holds an ordered list of 1--7 distinct supported groups; the first item is copied to `muscle_group`. Migration backfills each existing row with a one-item list.

An exercise receives nullable `video_media_id`, referencing a ready media object. Existing URL fields remain supported for legacy records but newly uploaded instructional video is represented only by the private media ID. On program issuance, the snapshot gains `muscle_groups` and `video_media_id` alongside its existing primary-group and legacy-video fields. Existing snapshots are never altered. Replacing a video never deletes the old object because historical snapshots may still reference it.

## API contract

All endpoints require the trainer role and the exercise owner unless noted otherwise.

- `PATCH /api/v1/exercises/{exercise_id}` accepts changed `title`, `instruction`, `muscle_groups`, and a ready `video_media_id`. It returns the complete exercise. The API rejects an empty title, an empty/duplicated/unknown muscle-group list, a media object owned by another account, non-ready media, or media that is not an exercise video.
- `POST /api/v1/exercises/video-uploads` accepts a permitted video MIME type and byte length, creates a `PENDING` media object with purpose `EXERCISE_VIDEO`, and returns a short-lived signed PUT URL plus required headers.
- `POST /api/v1/exercises/video-uploads/{media_id}/confirm` confirms the exact object type and byte length using the storage provider, then marks it `READY`.
- `POST /api/v1/exercises/{exercise_id}/video/read-url` returns a short-lived owner read URL for the editor preview.
- `POST /api/v1/assignments/{assignment_id}/exercise-media/{media_id}/read-url` is available to the assigned client only when the immutable assignment snapshot references that media ID. It returns a short-lived read URL for the workout player.

`media_objects` gains a typed purpose. Task-photo upload routes remain image-only and cannot request exercise-video capacity. Exercise uploads are keyed under an exercise-video prefix. The production S3 bucket must allow browser PUT requests from the PWA origin with the `Content-Type` header; credentials remain only in `/etc/toptrainers/prod.env`.

## UI and data flow

The Programs library uses the typed exercise API rather than static card data. Selecting a card loads the exercise into the existing modal; the add action starts an empty draft.

The modal exposes editable name and description. Muscle groups use the library's controlled vocabulary (`Ноги`, `Грудь`, `Спина`, `Плечи`, `Руки`, `Кор`, `Всё тело`): a trainer can add several groups and remove selected ones, while the first remains primary.

Choosing a video validates MIME type and size in the browser. The save sequence is:

1. Request a signed video upload URL.
2. PUT the selected file directly to S3, with visible byte progress.
3. Confirm the uploaded object through the API.
4. PATCH the exercise fields and confirmed media ID.

Save is disabled during the sequence. An upload or API error is shown in the modal without losing edits. Reopening an existing exercise fetches a fresh signed owner preview URL. After a successful save, the library card is updated locally without a full reload.

The workout player requests a fresh authorized URL only when its snapshot has `video_media_id`; it otherwise retains legacy URL behavior.

## Validation and tests

Backend tests cover: trainer/owner authorization, update validation, migration backfill, media-purpose and video size/type validation, confirmation failure, and client read authorization tied to an immutable assignment. Assignment tests assert that new snapshots contain the video media ID and multiple groups while existing snapshots remain valid.

Frontend tests cover: opening populated and blank editor drafts, name/description persistence payloads, group add/remove and primary ordering, rejected files, PUT/confirm/PATCH ordering, preserved draft after an error, and preview/read URL rendering.

## Acceptance criteria

1. A trainer uploads an allowed video up to 200 MiB; the database stores its private media ID and no public S3 URL.
2. The trainer changes title, description, and several muscle groups; a refresh shows the saved values.
3. Another trainer cannot update the exercise, bind its media, or obtain its preview URL.
4. A client can view only the video referenced by their assigned workout snapshot; unrelated media and revoked/nonexistent assignments are denied.
5. Existing exercises and historical assignments continue to render using the compatibility fields.
