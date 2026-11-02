import urllib.request, urllib.error

url = 'http://hdfs-nn:9870/webhdfs/v1/golang-qq/files/matrix-%d.txt?op=CREATE&overwrite=true&user.name=root'

def probe(name, headers):
    req = urllib.request.Request(url % probe.n, method='PUT')
    for k, v in headers.items():
        req.add_header(k, v)
    probe.n += 1
    try:
        r = urllib.request.urlopen(req, timeout=10)
        print(name, '->', r.status)
        r.read()
    except urllib.error.HTTPError as e:
        print(name, '->', e.code, '| allow:', e.headers.get('Allow'))

probe.n = 1
probe('纯 python', {})
probe('Go UA', {'User-Agent': 'Go-http-client/1.1'})
probe('CL:0', {'Content-Length': '0'})
probe('Go UA + CL:0', {'User-Agent': 'Go-http-client/1.1', 'Content-Length': '0'})
probe('Accept-Encoding gzip', {'Accept-Encoding': 'gzip'})
probe('Go UA + gzip', {'User-Agent': 'Go-http-client/1.1', 'Accept-Encoding': 'gzip'})
