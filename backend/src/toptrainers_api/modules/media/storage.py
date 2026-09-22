from __future__ import annotations

from typing import Any

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]

from toptrainers_api.core.config import Settings, settings

UPLOAD_EXPIRES_SECONDS = 600
READ_EXPIRES_SECONDS = 300


class PrivateS3Storage:
    def __init__(self, configured_settings: Settings = settings) -> None:
        values = (
            configured_settings.s3_endpoint_url,
            configured_settings.s3_bucket,
            configured_settings.s3_region,
            configured_settings.s3_access_key_id,
            configured_settings.s3_secret_access_key,
        )
        if not all(values):
            raise RuntimeError("S3 media storage is not configured")
        self.bucket = configured_settings.s3_bucket
        self.client: Any = boto3.client(
            "s3",
            endpoint_url=configured_settings.s3_endpoint_url,
            region_name=configured_settings.s3_region,
            aws_access_key_id=configured_settings.s3_access_key_id,
            aws_secret_access_key=configured_settings.s3_secret_access_key,
            config=Config(signature_version="s3v4"),
        )

    def create_upload_url(self, object_key: str, content_type: str, content_length: int) -> str:
        return str(
            self.client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": object_key,
                    "ContentType": content_type,
                    "ContentLength": content_length,
                },
                ExpiresIn=UPLOAD_EXPIRES_SECONDS,
                HttpMethod="PUT",
            )
        )

    def confirm_object(self, object_key: str, content_type: str, content_length: int) -> None:
        head = self.client.head_object(Bucket=self.bucket, Key=object_key)
        if head.get("ContentType") != content_type or head.get("ContentLength") != content_length:
            raise ValueError("Uploaded media metadata does not match the signed upload request")

    def create_read_url(self, object_key: str) -> str:
        return str(
            self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": object_key},
                ExpiresIn=READ_EXPIRES_SECONDS,
                HttpMethod="GET",
            )
        )
