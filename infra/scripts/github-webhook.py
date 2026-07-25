#!/usr/bin/env python3
"""Minimal authenticated GitHub webhook receiver for production deployment."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import subprocess
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


SECRET = os.environ["WEBHOOK_SECRET"].encode("utf-8")
HOST = os.environ.get("WEBHOOK_HOST", "127.0.0.1")
PORT = int(os.environ.get("WEBHOOK_PORT", "9003"))
BRANCH = os.environ.get("WEBHOOK_BRANCH", "refs/heads/main")
MAX_BODY_BYTES = 1_048_576


class WebhookHandler(BaseHTTPRequestHandler):
    server_version = "TopTrainersWebhook/1.0"

    def do_GET(self) -> None:
        if self.path == "/health":
            self._text(HTTPStatus.OK, "ok\n")
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        if self.path != "/deploy/github":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            content_length = int(self.headers.get("content-length", "0"))
        except ValueError:
            self.send_error(HTTPStatus.BAD_REQUEST, "invalid content length")
            return

        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            self.send_error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return

        body = self.rfile.read(content_length)
        if not self._valid_signature(body):
            self.send_error(HTTPStatus.UNAUTHORIZED, "invalid signature")
            return

        if self.headers.get("x-github-event") != "push":
            self._text(HTTPStatus.ACCEPTED, "ignored event\n")
            return

        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "invalid json")
            return

        if payload.get("ref") != BRANCH:
            self._text(HTTPStatus.ACCEPTED, "ignored ref\n")
            return

        self._text(HTTPStatus.ACCEPTED, "deploy queued\n")
        threading.Thread(target=self._start_deploy, daemon=True).start()

    @staticmethod
    def _start_deploy() -> None:
        subprocess.run(
            ["sudo", "/bin/systemctl", "start", "--no-block", "toptrainers-deploy.service"],
            check=False,
        )

    def _valid_signature(self, body: bytes) -> bool:
        signature = self.headers.get("x-hub-signature-256", "")
        if not signature.startswith("sha256="):
            return False
        expected = "sha256=" + hmac.new(SECRET, body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)

    def _text(self, status: HTTPStatus, value: str) -> None:
        body = value.encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "text/plain; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), WebhookHandler).serve_forever()
