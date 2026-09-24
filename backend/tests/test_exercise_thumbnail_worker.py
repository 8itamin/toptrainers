from pathlib import Path

import pytest

from toptrainers_api.modules.media.thumbnails import (
    ThumbnailTranscodeError,
    WebpThumbnailTranscoder,
)


def test_transcoder_rejects_an_image_when_no_quality_meets_size_limit(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """A cover that cannot meet the delivery budget must never be published."""
    transcoder = WebpThumbnailTranscoder()

    def write_oversized_candidate(*_args: object, output_path: Path, **_kwargs: object) -> None:
        output_path.write_bytes(b"x" * (100 * 1024 + 1))

    monkeypatch.setattr(transcoder, "_encode", write_oversized_candidate)

    with pytest.raises(ThumbnailTranscodeError, match="THUMBNAIL_TOO_LARGE"):
        transcoder.transcode(tmp_path / "source.webp", tmp_path / "output.webp")
