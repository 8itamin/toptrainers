from __future__ import annotations

import re
from pathlib import Path, PurePosixPath

from toptrainers_api.modules.media.storage import PrivateS3Storage

MANIFEST_FILENAME = "playlist.m3u8"
INIT_FILENAME = "init.mp4"
SEGMENT_NAME = re.compile(r"^segment_\d+\.m4s$")
MAP_URI_PREFIX = '#EXT-X-MAP:URI="'


def _validate_prefix(prefix: str) -> str:
    path = PurePosixPath(prefix)
    if not prefix or path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError("Unsafe HLS object prefix")
    return str(path)


def hls_segment_key(prefix: str, filename: str) -> str:
    if filename != INIT_FILENAME and SEGMENT_NAME.fullmatch(filename) is None:
        raise ValueError("Unsafe HLS filename")
    if Path(filename).name != filename:
        raise ValueError("Unsafe HLS filename")
    return f"{_validate_prefix(prefix)}/{filename}"


def render_signed_hls_manifest(
    manifest_text: str,
    segment_prefix: str,
    storage: PrivateS3Storage,
) -> str:
    rendered_lines: list[str] = []
    for line in manifest_text.splitlines():
        if line.startswith(MAP_URI_PREFIX):
            if not line.endswith('"'):
                raise ValueError("Unsafe HLS manifest map")
            filename = line.removeprefix(MAP_URI_PREFIX).removesuffix('"')
            signed_url = storage.create_hls_segment_read_url(
                hls_segment_key(segment_prefix, filename)
            )
            rendered_lines.append(f'{MAP_URI_PREFIX}{signed_url}"')
        elif line and not line.startswith("#"):
            rendered_lines.append(
                storage.create_hls_segment_read_url(hls_segment_key(segment_prefix, line))
            )
        else:
            rendered_lines.append(line)
    return "\n".join(rendered_lines) + "\n"


class HlsStorage:
    """Store and retrieve a worker-generated, private HLS rendition."""

    def __init__(self, storage: PrivateS3Storage) -> None:
        self.storage = storage

    def write_stream(self, object_prefix: str, local_directory: Path) -> tuple[str, str]:
        segment_prefix = _validate_prefix(object_prefix)
        manifest_path = local_directory / MANIFEST_FILENAME
        init_path = local_directory / INIT_FILENAME
        segment_paths = sorted(
            path
            for path in local_directory.iterdir()
            if path.is_file() and SEGMENT_NAME.fullmatch(path.name) is not None
        )
        if not manifest_path.is_file() or not init_path.is_file() or not segment_paths:
            raise ValueError("Worker output does not contain a complete HLS stream")

        manifest_key = f"{segment_prefix}/{MANIFEST_FILENAME}"
        self.storage.put_file(manifest_key, manifest_path, "application/vnd.apple.mpegurl")
        self.storage.put_file(
            hls_segment_key(segment_prefix, INIT_FILENAME),
            init_path,
            "video/mp4",
        )
        for segment_path in segment_paths:
            self.storage.put_file(
                hls_segment_key(segment_prefix, segment_path.name),
                segment_path,
                "video/iso.segment",
            )
        return manifest_key, segment_prefix

    def read_manifest(self, manifest_key: str) -> str:
        return self.storage.get_text(manifest_key)
