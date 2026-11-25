"""Single-file export of the VN SERVICE demo: python3 export.py -> ../vn-service.html

The page itself (index.html + assets/) is the build the taste-skill gate checks. A file sent over WhatsApp opens
from file://, where the kit's ES modules cannot load, so the export inlines every stylesheet and photograph, drops
the module scripts and the waits that expect them (the hero's entrance, the moment's guard), and keeps two small
scripts: the phone menu (the kit's classes) and the RU/KZ switch already in the page.
"""
import base64, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "index.html"), encoding="utf-8").read()


def css(m):
    path = os.path.join(HERE, m.group(1))
    return "<style>\n" + open(path, encoding="utf-8").read() + "\n</style>"


def img(m):
    data = base64.b64encode(open(os.path.join(HERE, m.group(1)), "rb").read()).decode()
    return f'src="data:image/jpeg;base64,{data}"'


out = re.sub(r'<link rel="stylesheet" href="(assets/[^"]+)">', css, src)
out = re.sub(r'src="(img/[^"]+\.jpg)"', img, out)
out = out.replace('href="favicon.svg"', 'href="data:image/svg+xml,' + open(os.path.join(HERE, "favicon.svg")).read().replace('#', '%23').replace('<', '%3C').replace('>', '%3E').replace("'", "%27") + '"')
# scripts that only make sense next to the kit's modules
out = re.sub(r"<script>document\.documentElement\.classList\.add\('m-enter'\).*?</script>\n", "", out)
out = re.sub(r"<script>document\.documentElement\.classList\.add\('mo-js'\).*?</script>\n", "", out)
out = re.sub(r'<script src="assets/[^"]+"></script>\n', "", out)
out = re.sub(r'<link rel="modulepreload"[^>]*>\n', "", out)
out = re.sub(r'<script type="module" src="assets/[^"]+"></script>\n', "", out)
out = out.replace('<meta property="og:image" content="share.jpg">\n', "")
menu = """<script>
/* the phone menu without the kit's modules: the same classes system.js sets */
(() => {
  const nav = document.querySelector('header.nav'), t = nav && nav.querySelector('.nav__toggle');
  if (!t) return;
  const set = o => { nav.classList.toggle('is-open', o); t.setAttribute('aria-expanded', String(o)); };
  t.addEventListener('click', () => set(!nav.classList.contains('is-open')));
  nav.addEventListener('click', e => { if (e.target.closest('a[href]')) set(false); });
})();
</script>
"""
out = out.replace("</body>", menu + "</body>")
dest = os.path.join(os.path.dirname(HERE), "vn-service.html")
open(dest, "w", encoding="utf-8").write(out)
print(dest, len(out))
