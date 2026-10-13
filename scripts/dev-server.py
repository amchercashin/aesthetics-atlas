"""Локальный сервер для разработки: раздаёт родительскую папку (сайт доступен по /aesthetics-atlas/,
как на GitHub Pages) и запрещает кэширование, чтобы правки были видны сразу."""
import functools, http.server, os, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
handler = functools.partial(NoCache, directory=root)
http.server.ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()
