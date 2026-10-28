"""Recalculate public snapshot findings without private data or external packages."""
import collections
import hashlib
import json
from pathlib import Path

p = Path(__file__).resolve().parents[1]
raw = (p / 'src/data.js').read_text(encoding='utf-8')
d = json.loads(raw.removeprefix('window.SMAData=').removesuffix(';'))
e = d['ecommerce']
s = d['social']

total = sum(r['amount'] for r in e)
units = sum(r['quantity'] for r in e)
products = collections.Counter()
for r in e:
    products[r['product']] += r['amount']
top = [x for x, _ in products.most_common(3)]
top_units = sum(r['quantity'] for r in e if r['product'] in top)

result = {
    'snapshot_sha256': hashlib.sha256((p / 'src/data.js').read_bytes()).hexdigest(),
    'sales': total,
    'units': units,
    'top3_products': top,
    'top3_sales': sum(products[x] for x in top),
    'top3_units': top_units,
    'top3_sales_share': sum(products[x] for x in top) / total,
    'top3_units_share': top_units / units,
    'multibrand_posts': sum(r['count'] for r in s if len(r['brands']) > 1),
    'posts': sum(r['count'] for r in s),
    'rfm': d['rfm']['segments'],
}

# The figures quoted in the README and the Demo must match the snapshot.
assert result['top3_sales'] == 27234980 and top_units == 9099
assert total == 42268160 and units == 28144 and result['multibrand_posts'] == 1436
print(json.dumps(result, ensure_ascii=False, indent=2))
