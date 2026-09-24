from __future__ import annotations

from toptrainers_api.app.factory import create_app


def test_exercise_video_routes_expose_private_presigned_flow() -> None:
    paths = create_app().openapi()["paths"]

    assert "/api/v1/exercises/video-uploads" in paths
    assert "/api/v1/exercises/video-uploads/{media_id}/confirm" in paths
    assert "/api/v1/exercises/{exercise_id}/video/read-url" in paths
    assert "/api/v1/exercises/thumbnail-uploads" in paths
    assert "/api/v1/exercises/thumbnail-uploads/{media_id}/confirm" in paths
    assert "/api/v1/exercises/{exercise_id}/thumbnail/read-url" in paths


def test_exercise_video_upload_request_restricts_size_and_type() -> None:
    schema = create_app().openapi()["components"]["schemas"]["ExerciseVideoUploadRequest"]

    assert schema["properties"]["content_length"]["maximum"] == 200 * 1024 * 1024
    assert schema["properties"]["content_type"]["enum"] == [
        "video/mp4",
        "video/webm",
        "video/quicktime",
    ]


def test_exercise_thumbnail_upload_request_restricts_size_and_type() -> None:
    schema = create_app().openapi()["components"]["schemas"]["ExerciseThumbnailUploadRequest"]

    assert schema["properties"]["content_length"]["maximum"] == 100 * 1024
    assert schema["properties"]["content_type"]["enum"] == [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]
