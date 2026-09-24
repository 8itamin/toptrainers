from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

from toptrainers_api.modules.media.hls import INIT_FILENAME, MANIFEST_FILENAME, SEGMENT_NAME


class TranscodeError(RuntimeError):
    """A sanitized failure to create the fixed HLS rendition."""


@dataclass(frozen=True)
class TranscodeResult:
    duration_seconds: int
    manifest_filename: str


class FfmpegTranscoder:
    def transcode(self, source_path: Path, output_dir: Path) -> TranscodeResult:
        output_dir.mkdir(parents=True, exist_ok=True)
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            "-map",
            "0:v:0",
            "-map",
            "0:a:0?",
            "-vf",
            "scale=1280:720:force_original_aspect_ratio=decrease",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "48",
            "-keyint_min",
            "48",
            "-sc_threshold",
            "0",
            "-c:a",
            "aac",
            "-hls_time",
            "2",
            "-hls_segment_type",
            "fmp4",
            "-hls_fmp4_init_filename",
            INIT_FILENAME,
            "-hls_segment_filename",
            str(output_dir / "segment_%03d.m4s"),
            str(output_dir / MANIFEST_FILENAME),
        ]
        try:
            subprocess.run(
                command,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                text=True,
            )
            duration_seconds = self._probe_duration_seconds(source_path)
        except (OSError, subprocess.CalledProcessError, ValueError) as error:
            raise TranscodeError("FFmpeg could not create the HLS rendition") from error

        artifact_names = {path.name for path in output_dir.iterdir() if path.is_file()}
        if (
            MANIFEST_FILENAME not in artifact_names
            or INIT_FILENAME not in artifact_names
            or not any(SEGMENT_NAME.fullmatch(name) is not None for name in artifact_names)
        ):
            raise TranscodeError("FFmpeg output is incomplete")
        return TranscodeResult(
            duration_seconds=duration_seconds,
            manifest_filename=MANIFEST_FILENAME,
        )

    @staticmethod
    def _probe_duration_seconds(source_path: Path) -> int:
        result = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(source_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return max(1, round(float(result.stdout.strip())))
