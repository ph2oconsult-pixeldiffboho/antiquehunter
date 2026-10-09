import json,math,sys,statistics as st, itertools
import numpy as np
sys.path.insert(0,'.'); from feats import feats
REF=json.load(open('reference_mirrors.json'))
P=json.load(open(sys.argv[1] if len(sys.argv)>1 else 'pp_main.json')); L={l['lot_id']:l for l in json.load(open('lots_mirrors_auction.json'))['lots']}
def la(f): return math.log(f['h']*(f['w'] or f['h']*0.65)/1e4)
for r in REF: r['f']=feats(r['text']); r['la']=la(r['f']); r['ly']=math.log(r['hammer_eur'])
rows=[]
for r in P:
    if 'error' in r: continue
    f=feats(L[r['lot_id']]['text'])
    rows.append(dict(id=r['lot_id'],split=r['split'],f=f,la=la(f) if f['h'] else None,lo=r['app_low'],hi=r['app_high'],h=r['hammer_eur'],mid=(r['app_low']+r['app_high'])/2))
cal=[x for x in rows if x['split']=='calibration']
def X(x,fs): return [1,x['la']]+[float(bool(x['f'][k])) for k in fs]
def fitr(data,fs,lam=1.0):
    A=np.array([X(x,fs) for x in data]); y=np.array([x['ly'] for x in data]); I=np.eye(A.shape[1]); I[0,0]=0; I[1,1]=0.1
    return np.linalg.solve(A.T@A+lam*I,A.T@y)
def apply(x,b,fs,w,minratio):
    if x['la'] is None: return x['lo'],x['hi']
    ref=math.exp(float(np.dot(X(x,fs),b)))
    mid=math.exp(w*math.log(x['mid'])+(1-w)*math.log(ref))
    ratio=max(minratio,x['hi']/max(1,x['lo'])); s=math.sqrt(ratio)
    return mid/s,mid*s
def ev(data,ranges):
    hit=sum(lo<=x['h']<=hi for x,(lo,hi) in zip(data,ranges)); err=st.median(abs((lo+hi)/2-x['h'])/x['h']*100 for x,(lo,hi) in zip(data,ranges))
    return hit,round(err,1)
print('cal main',ev(cal,[(x['lo'],x['hi']) for x in cal]), 'median model ratio',st.median(x['hi']/x['lo'] for x in cal))
FL=['period','c18','carved','stucco','painted','parcloses','trumeau','replaced','crest','lp_n3']
res=[]
for k in range(0,3):
  for fs in itertools.combinations(FL,k):
    for w in [0.3,0.4,0.5,0.6,0.7]:
      for mr in [0,2.5,3]:
        rg=[]
        for x in cal:
            b=fitr([r for r in REF if r['id']!=x['id']],list(fs)); rg.append(apply(x,b,list(fs),w,mr))
        h,e=ev(cal,rg); res.append((h,-e,fs,w,mr))
res.sort(key=lambda t:(t[0]-t[1]/10),reverse=True)  # just for printing
for t in sorted(res,key=lambda t:(-t[0],-t[1]))[:15]: print(t)
print('--- by error'); 
for t in sorted(res,key=lambda t:(-t[1]))[:10]: print(t)
b=fitr(REF,['period','stucco']); print('coef period,stucco',np.round(b,2))
b=fitr(REF,[]); print('coef size only',np.round(b,2), 'n',len(REF))
print('=== pre-declared model: size + period + finish + glass + crest (+ parcloses)')
FS=['period','stucco','painted','replaced','crest','parcloses']
for lam in [1,3]:
  for w in [0.3,0.4,0.5,0.6]:
    rg=[]
    for x in cal:
        A=[r for r in REF if r['id']!=x['id']]; b=fitr(A,FS,lam); rg.append(apply(x,b,FS,w,0))
    print(lam,w,ev(cal,rg))
  print('coef',dict(zip(['c','la']+FS,np.round(fitr(REF,FS,lam),2))))
print('=== size only / size+period')
for FS in [[],['period'],['period','painted'],['period','parcloses']]:
  for w in [0.3,0.4,0.5,0.6,0.7]:
    rg=[]
    for x in cal:
        A=[r for r in REF if r['id']!=x['id']]; b=fitr(A,FS,1); rg.append(apply(x,b,FS,w,0))
    print(FS,w,ev(cal,rg))
print('=== mean |log2 error| (smoother), cal LOO')
def mae(data,rg): return round(st.mean(abs(math.log2(((lo*hi)**0.5)/x['h'])) for x,(lo,hi) in zip(data,rg)),3)
print('main',mae(cal,[(x['lo'],x['hi']) for x in cal]))
for FS in [[],['period'],['period','painted','replaced','crest','parcloses']]:
  out=[]
  for w in [0.2,0.3,0.4,0.5,0.6,0.7,0.8]:
    rg=[]
    for x in cal:
        A=[r for r in REF if r['id']!=x['id']]; b=fitr(A,FS,1); rg.append(apply(x,b,FS,w,0))
    out.append((w,mae(cal,rg)))
  print(FS,out)
