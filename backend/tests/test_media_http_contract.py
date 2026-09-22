from __future__ import annotations

from toptrainers_api.app.factory import create_app


def test_private_media_routes_expose_only_presigned_upload_flow() -> None:
    paths = create_app().openapi()["paths"]

    assert "/api/v1/media/uploads" in paths
    assert "/api/v1/media/uploads/{media_id}/confirm" in paths
    assert "/api/v1/media/{media_id}/read-url" in paths
    assert paths["/api/v1/media/uploads"]["post"]["responses"].get("201")


def test_media_upload_request_limits_image_types_and_size() -> None:
    schema = create_app().openapi()["components"]["schemas"]["CreateUploadRequest"]

    assert schema["properties"]["content_length"]["maximum"] == 10 * 1024 * 1024
    assert schema["properties"]["content_type"]["enum"] == [
        "image/jpeg",
        "image/png",
        "image/webp",
    ]
