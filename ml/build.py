"""Reproduce the English commentary baseline from immutable public sources."""
import concurrent.futures, hashlib, json, random, re, time, urllib.parse, urllib.request
from collections import Counter
from pathlib import Path
import joblib, numpy as np, sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix, f1_score, accuracy_score, balanced_accuracy_score

ROOT=Path(__file__).resolve().parent
ECHOES='7105a85b7a8c1c000a31a30d0c29c388105c3de5'
LABELS_REV='8e01649fe968da9f541c91019b65b3028b2425fc'
TOKEN=r'(?u)\b[a-z0-9][a-z0-9]+\b'
LABELS={'Goal':'goal','Yellow card':'card','Red card':'card','Yellow->red card':'card','Shots on target':'shot','Shots off target':'shot'}
def fetch(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=35) as r:return r.read()
        except Exception:
            if attempt==2:raise
            time.sleep(1+attempt)
def download():
    (ROOT/'raw').mkdir(parents=True,exist_ok=True)
    tree=json.loads(fetch(f'https://api.github.com/repos/SoccerNet/sn-echoes/git/trees/{ECHOES}?recursive=1'))
    paths={x['path'] for x in tree['tree'] if x['type']=='blob'}
    prefix='Dataset/whisper_v2_en/'
    games=sorted({p[len(prefix):].rsplit('/',1)[0] for p in paths if p.startswith(prefix) and p.endswith('1_asr.json') and p.replace('1_asr.json','2_asr.json') in paths})
    random.Random(42).shuffle(games);games=games[:120]
    manifest={'echoes_revision':ECHOES,'labels_revision':LABELS_REV,'seed':42,'requested_matches':120,'files':[],'errors':[]}
    tasks=[]
    for i,g in enumerate(games):
        for half in (1,2):
            tasks.append((i,g,f'{half}_asr.json',f'https://raw.githubusercontent.com/SoccerNet/sn-echoes/{ECHOES}/'+urllib.parse.quote(prefix+g+f'/{half}_asr.json')))
        tasks.append((i,g,'labels.json',f'https://huggingface.co/datasets/SoccerNet/SN-Labels/resolve/{LABELS_REV}/'+urllib.parse.quote(g+'/Labels-v2.json')))
    def get(task):
        i,g,name,url=task;d=ROOT/'raw'/f'{i:03d}';d.mkdir(exist_ok=True);p=d/name
        try:
            b=fetch(url);json.loads(b);p.write_bytes(b)
            return {'game':g,'match_id':i,'file':str(p.relative_to(ROOT)),'url':url,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
        except Exception as e:return {'error':str(e),'url':url,'match_id':i}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for n,res in enumerate(ex.map(get,tasks),1):
            manifest['errors' if 'error' in res else 'files'].append(res)
            if n%30==0:print(f'Download {n}/{len(tasks)}',flush=True)
    manifest['files'].sort(key=lambda x:x['file'])
    (ROOT/'data_manifest.json').write_text(json.dumps(manifest,indent=2))
    return manifest
def build(manifest):
    names={x['match_id']:x['game'] for x in manifest['files']}
    games=[i for i in sorted(names) if all((ROOT/'raw'/f'{i:03d}'/f).exists() for f in ['1_asr.json','2_asr.json','labels.json'])]
    if len(games)<25:raise RuntimeError('Need at least 25 complete matches')
    # The saved original experiment had 104 complete matches. Do not silently change its cohort.
    if len(games)!=104:raise RuntimeError(f'Expected 104 complete matches for reproduction, found {len(games)}; inspect download failures.')
    n=len(games);a=int(n*.7);b=int(n*.85)
    split={g:'train' if j<a else 'validation' if j<b else 'test' for j,g in enumerate(games)}
    rows=[];segments_count=0
    for g in games:
        d=ROOT/'raw'/f'{g:03d}';lab=json.loads((d/'labels.json').read_text())['annotations']
        for half in (1,2):
            raw=json.loads((d/f'{half}_asr.json').read_text())['segments']
            segs=sorted((float(v[0]),float(v[1]),str(v[2]).strip()) for v in raw.values() if len(v)==3 and v[2])
            segments_count+=len(segs)
            if not segs:continue
            events=[(float(x['position'])/1000,LABELS[x['label']]) for x in lab if int(x['gameTime'].split(' - ')[0])==half and x['label'] in LABELS]
            for end in range(15,int(max(s[1] for s in segs))+1,10):
                text=' '.join(s[2] for s in segs if end-15<s[1]<=end)
                if len(re.findall(TOKEN,text.lower()))<4:continue
                types={c for t,c in events if end-15<t<=end}
                if 'goal' in types:y='goal'
                elif len(types)>1:continue
                elif types:y=next(iter(types))
                else:y='background'
                rows.append({'game':names[g],'match_id':g,'half':half,'window_end_s':end,'text':text,'label':y,'split':split[g]})
    seen=set();clean=[];removed=0
    for part in ['train','validation','test']:
        for r in rows:
            if r['split']!=part:continue
            key=' '.join(re.findall(TOKEN,r['text'].lower()))
            if key in seen:removed+=1;continue
            seen.add(key);clean.append(r)
    (ROOT/'dataset.jsonl').write_text('\n'.join(json.dumps(r,ensure_ascii=False) for r in clean)+'\n')
    return clean,{'matches':len(games),'transcript_segments_downloaded':segments_count,'duplicate_windows_removed':removed,'matches_per_split':dict(Counter(split.values())),'source_revisions':{'echoes':ECHOES,'labels':LABELS_REV}}
def main():
    manifest=download();rows,meta=build(manifest)
    parts={p:[r for r in rows if r['split']==p] for p in ['train','validation','test']}
    groups={p:{r['game'] for r in rs} for p,rs in parts.items()}
    assert not groups['train']&groups['test'] and not groups['train']&groups['validation'] and not groups['validation']&groups['test']
    for f in manifest['files']:assert hashlib.sha256((ROOT/f['file']).read_bytes()).hexdigest()==f['sha256']
    X={p:[r['text'] for r in rs] for p,rs in parts.items()};y={p:[r['label'] for r in rs] for p,rs in parts.items()}
    candidates=[]
    for c in [1.,4.]:
        model=Pipeline([('tfidf',TfidfVectorizer(ngram_range=(1,2),min_df=2,max_features=25000,sublinear_tf=True,token_pattern=TOKEN)),('classifier',LogisticRegression(C=c,max_iter=500,class_weight='balanced',solver='lbfgs',random_state=42))])
        model.fit(X['train'],y['train'])
        score=f1_score(y['validation'],model.predict(X['validation']),average='macro')
        print('C',c,'validation macro F1',score,flush=True);candidates.append((score,c,model))
    _,chosen,model=max(candidates,key=lambda x:x[0]);classes=model.classes_.tolist()
    pv=model.predict_proba(X['validation']);gates={};gate_metrics={}
    for k,label in enumerate(classes):
        if label=='background':continue
        eligible=[]
        for threshold in np.arange(.50,.951,.025):
            mask=(pv.argmax(1)==k)&(pv[:,k]>=threshold);n=int(mask.sum())
            precision=float(np.mean(np.array(y['validation'])[mask]==label)) if n else 0
            if n>=8 and precision>=.80:eligible.append((n,float(threshold),precision))
        if eligible:
            n,t,p=max(eligible);gates[label]=round(t,3);gate_metrics[label]={'selected_windows':n,'precision':p}
        else:gates[label]=None;gate_metrics[label]={'reason':'No threshold reached 80% validation precision on at least 8 windows.'}
    pred=model.predict(X['test']);probs=model.predict_proba(X['test'])
    report={**meta,'task':'Weakly labelled English commentary-window classification; not verified live event detection','classes':classes,'window_seconds':15,'stride_seconds':10,'split_unit':'whole match','sklearn_version':sklearn.__version__,'selected_C':chosen,'validation_candidates':[{'C':c,'macro_f1':s} for s,c,_ in candidates],'samples_per_split':{p:len(v) for p,v in parts.items()},'class_counts':{p:dict(Counter(r['label'] for r in rs)) for p,rs in parts.items()},'test':{'accuracy':accuracy_score(y['test'],pred),'balanced_accuracy':balanced_accuracy_score(y['test'],pred),'macro_f1':f1_score(y['test'],pred,average='macro'),'classification_report':classification_report(y['test'],pred,output_dict=True,zero_division=0),'confusion_matrix':confusion_matrix(y['test'],pred,labels=classes).tolist(),'majority_baseline_accuracy':float(np.mean(np.array(y['test'])=='background'))},'haptic_thresholds':gates,'validation_gate_metrics':gate_metrics,'limitations':['Noisy timestamp-aligned labels, not manually verified transcript labels.','ASR and English machine-translation errors.','No raw audio model or ASR model trained here.','Window metrics are not event-level detection metrics.','No physical phone or accessibility user study.'],'deployment_policy':'Automatic alerts remain paused in this research release.'}
    (ROOT/'reports').mkdir(exist_ok=True);(ROOT/'models').mkdir(exist_ok=True);(ROOT.parent/'ai').mkdir(exist_ok=True)
    (ROOT/'reports/metrics.json').write_text(json.dumps(report,indent=2))
    joblib.dump(model,ROOT/'models/commentary_model.joblib')
    vector=model.named_steps['tfidf'];cl=model.named_steps['classifier']
    exported={'schema_version':1,'classes':classes,'vocabulary':{k:int(v) for k,v in vector.vocabulary_.items()},'idf':vector.idf_.tolist(),'coefficients':cl.coef_.tolist(),'intercepts':cl.intercept_.tolist(),'haptic_thresholds':gates,'automatic_alerts_enabled':False,'metrics':{'matches':meta['matches'],'windows':len(rows),'test_macro_f1':report['test']['macro_f1'],'test_balanced_accuracy':report['test']['balanced_accuracy'],'test_samples':len(pred)},'haptic_patterns':{'goal':[400,100,400,100,900],'card':[150,80,150],'shot':[250],'background':[]}}
    (ROOT.parent/'ai/model.json').write_text(json.dumps(exported,separators=(',',':')))
    idx=np.random.default_rng(42).choice(len(parts['test']),size=min(20,len(pred)),replace=False)
    examples=[{**parts['test'][i],'predicted':pred[i],'scores':dict(zip(classes,probs[i].tolist()))} for i in idx]
    (ROOT.parent/'ai/examples.json').write_text(json.dumps(examples,indent=2))
    fixtures=[{'text':r['text'],'scores':dict(zip(classes,model.predict_proba([r['text']])[0].tolist()))} for r in examples]
    for t in ['', 'GOAL! He scores and the ball is in the net.','The referee shows a yellow card.','That was not a goal.']:
        fixtures.append({'text':t,'scores':dict(zip(classes,model.predict_proba([t])[0].tolist()))})
    (ROOT/'reports/parity_fixtures.json').write_text(json.dumps(fixtures))
    (ROOT/'reports/data_checks.json').write_text(json.dumps({'status':'passed','hashes_checked':len(manifest['files']),'whole_match_splits_disjoint':True}))
    print(json.dumps(report,indent=2),flush=True)
if __name__=='__main__':main()
