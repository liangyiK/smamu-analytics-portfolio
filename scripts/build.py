"""Build a self-contained static Demo from the public source snapshot."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
src = root / 'src'
s = (src / 'template.html').read_text(encoding='utf-8')

for marker, name in [('STYLES', 'style.css'), ('DATA', 'data.js'), ('CORE', 'core.js'), ('APP', 'app.js')]:
    token = '/* ' + marker + ' */'
    if s.count(token) != 1:
        raise ValueError('Missing or duplicate build marker: ' + marker)
    content = (src / name).read_text(encoding='utf-8')
    if marker == 'DATA':
        # Embed the research notes so the offline page can show them in full.
        for key, filename in [('baseMakeupNotes', 'base_makeup_notes.md'), ('skincareNotes', 'skincare_notes.md')]:
            notes = (root / 'research' / filename).read_text(encoding='utf-8')
            content += 'window.SMAData.' + key + '=' + json.dumps(notes, ensure_ascii=False).replace('<', r'<') + ';'
    s = s.replace(token, content)

out = root / 'docs'
out.mkdir(exist_ok=True)
# write_bytes keeps LF line endings on Windows, so a rebuild is byte-identical.
data = s.encode('utf-8')
(out / 'index.html').write_bytes(data)
print('Built docs/index.html:', len(data), 'bytes')
