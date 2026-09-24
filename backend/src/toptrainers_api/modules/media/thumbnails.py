from __future__ import annotations

import subprocess
from pathlib import Path

THUMBNAIL_WIDTH = 320
THUMBNAIL_HEIGHT = 180
MAX_THUMBNAIL_BYTES = 100 * 1024
WEBP_QUALITIES = (60, 50, 40, 30)


class ThumbnailTranscodeError(RuntimeError):
    """A sanitized thumbnail conversion failure safe for persisted error codes."""


class WebpThumbnailTranscoder:
    def transcode(self, source_path: Path, output_path: Path) -> int:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        for quality in WEBP_QUALITIES:
            self._encode(source_path, output_path=output_path, quality=quality)
            if output_path.stat().st_size <= MAX_THUMBNAIL_BYTES:
                return output_path.stat().st_size
        raise ThumbnailTranscodeError("THUMBNAIL_TOO_LARGE")

    @staticmethod
    def _encode(source_path: Path, output_path: Path, quality: int) -> None:
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(source_path),
                    "-frames:v",
                    "1",
                    "-vf",
                    "scale=320:180:force_original_aspect_ratio=increase,crop=320:180",
                    "-c:v",
                    "libwebp",
                    "-q:v",
                    str(quality),
                    str(output_path),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )
        except (OSError, subprocess.CalledProcessError) as error:
            raise ThumbnailTranscodeError("THUMBNAIL_INVALID_IMAGE") from error
