import sys,re,json,urllib.parse,urllib.request
q=sys.argv[1]
req=urllib.request.Request("https://www.youtube.com/results?search_query="+urllib.parse.quote(q),headers={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36","Accept-Language":"ru-RU,ru;q=0.9","Cookie":"CONSENT=YES+1; SOCS=CAI"})
h=urllib.request.urlopen(req).read().decode()
m=re.search(r'ytInitialData = (\{.*?\});</script>',h)
d=json.loads(m.group(1))
def walk(o):
    if isinstance(o,dict):
        if 'videoRenderer' in o: yield o['videoRenderer']
        for v in o.values(): yield from walk(v)
    elif isinstance(o,list):
        for v in o: yield from walk(v)
for v in list(walk(d))[:12]:
    t=''.join(r['text'] for r in v['title']['runs'])
    print(v['videoId'],'|',t,'|',v.get('ownerText',{}).get('runs',[{}])[0].get('text'),'|',v.get('publishedTimeText',{}).get('simpleText'),'|',v.get('lengthText',{}).get('simpleText'))
