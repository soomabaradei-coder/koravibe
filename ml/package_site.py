from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'_site'
out.mkdir(exist_ok=True)
index=(ROOT/'index.html').read_text()
index=index.replace('<div class="tag">FIFA World Cup 2034 · Saudi Arabia</div>','<div class="tag"><a href="stadium.html" style="color:#FFB03A;text-decoration:none">Feel the stadium · Try KoraVibe ↗</a></div>',1)
if 'href="stadium.html"' not in index:raise RuntimeError('Landing-page integration target changed; review before publishing.')
(out/'index.html').write_text(index)
shutil.copy(ROOT/'ai.html',out/'ai.html')
shutil.copytree(ROOT/'ai',out/'ai',dirs_exist_ok=True)
shutil.copy(ROOT/'stadium.html',out/'stadium.html')
shutil.copytree(ROOT/'stadium',out/'stadium',dirs_exist_ok=True)
(out/'ml/reports').mkdir(parents=True,exist_ok=True)
shutil.copy(ROOT/'ml/README.md',out/'ml/README.md')
for name in ['metrics.json','data_checks.json','engine_tests.json','browser_tests.json']:
    shutil.copy(ROOT/'ml/reports'/name,out/'ml/reports'/name)
(out/'.nojekyll').write_text('')
print('Packaged site without raw training data.')
