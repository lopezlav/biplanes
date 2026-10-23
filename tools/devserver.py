import http.server, sys, os, urllib.parse
ROOT = sys.argv[1]; OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s):
        s.send_header('Cache-Control', 'no-store'); super().end_headers()
    def do_POST(s):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(s.path).query)
        n = os.path.basename(q.get('n', ['shot'])[0])
        data = s.rfile.read(int(s.headers['Content-Length']))
        open(os.path.join(OUT, n + '.png'), 'wb').write(data)
        s.send_response(200); s.end_headers(); s.wfile.write(b'ok')
    def log_message(s, *a): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 8642), H).serve_forever()
