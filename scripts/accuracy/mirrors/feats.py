import re,json,math
def dims(t):
    t=t.replace(',', '.').replace('×','x')
    N=r'(\d{2,3}(?:\.\d+)?)'
    m=re.search(r'(\d(?:\.\d+)?)\s*m\s*x\s*(\d(?:\.\d+)?)\s*m\b',t)
    if m: return float(m.group(1))*100,float(m.group(2))*100
    m=re.search(N+r'\s*cm\s*(?:w|wide)\s*x\s*'+N+r'\s*cm\s*(?:h|high|t|tall)\b',t,re.I)
    if m: return float(m.group(2)),float(m.group(1))
    h=re.search(N+r'\s*cm\s*(?:high|tall|h\b)',t,re.I); w=re.search(N+r'\s*cm\s*(?:wide|w\b)',t,re.I)
    if h: return float(h.group(1)),(float(w.group(1)) if w else None)
    m=re.search(r'\b(?:H|Haut|Hauteur|Height)\.?\s*[_:.]?\s*:?\s*'+N+r'\s*(?:cm)?[^0-9]{0,25}?\b(?:L|l|W|Larg|Largeur|Width)\.?\s*[_:.]?\s*:?\s*'+N,t)
    if m: return float(m.group(1)),float(m.group(2))
    m=re.search(N+r'\s*(?:cm)?\s*x\s*'+N+r'\s*cm',t)
    if m: return float(m.group(1)),float(m.group(2))
    m=re.search(r'\b(?:H|Haut|Hauteur|Height)\.?\s*[_:.]?\s*:?\s*'+N+r'\s*cm',t)
    if m: return float(m.group(1)),None
    m=re.findall(N+r'\s*cm\b',t)
    if len(m)==1: return float(m[0]),None
    return None,None
def feats(t):
    s=t.lower()
    f={}
    f['period']=bool(re.search(r"[ée]poque (louis|r[ée]gence|xviii|napol|restauration|empire|louis-philippe)|d'[ée]poque|xviii(e|ème|°)? si[eè]cle|18th[- ]century|18[eè]me|\bperiod\b|travail (proven[cç]al )?du xviii|milieu du xviii|fin du xviii",s)) and not re.search(r'\bde style|\bstyle (louis|r[ée]gence)',s)
    f['style']=bool(re.search(r'\bstyle\b',s)) and not f['period']
    f['c18']=bool(re.search(r'xviii|18th|18[eè]me|louis xv\b|louis xvi|r[ée]gence|louis xiv',s)) and f['period']
    f['stucco']=bool(re.search(r'stuc|p[âa]te|composition|gesso|stuqu',s))
    f['carved']=bool(re.search(r'sculpt|carved|ajour',s))
    f['gilt']=bool(re.search(r'dor[ée]|gilt|giltwood|dorure',s))
    f['painted']=bool(re.search(r'peint|laqu|painted|rechamp|cream|cr[eè]me|gris|grey|vert|green',s))
    f['replaced']=bool(re.search(r'rapport[ée]|remplac[ée]|replaced',s))
    f['parcloses']=bool(re.search(r'parclose|pare-close|pareclose|marginal',s))
    f['crest']=bool(re.search(r'fronton|crest|pediment',s))
    f['trumeau']=bool(re.search(r'trumeau|overmantel|haut de chemin',s))
    f['lp_n3']=bool(re.search(r'louis[- ]philippe|napol[ée]on iii|second empire|restauration',s))
    f['provence']=bool(re.search(r'proven',s))
    h,w=dims(t); f['h']=h; f['w']=w
    return f
