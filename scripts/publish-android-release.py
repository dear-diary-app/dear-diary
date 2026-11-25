#!/usr/bin/env python3
"""Publish an already signed APK to the private channel. Never commit credentials.
Use only after release verification. --token-file is an approved Supabase management
credential file. The catalog contains no bearer link: each client download gets a
fresh ten-minute URL. This script does not send a message or change bucket access.
"""
import argparse,hashlib,json,pathlib,secrets,subprocess,urllib.request
p=argparse.ArgumentParser();p.add_argument('--apk',required=True);p.add_argument('--token-file',required=True);p.add_argument('--build-tools',required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];meta=json.loads((root/'android-private/release.json').read_text());apk=pathlib.Path(a.apk);data=apk.read_bytes();cert='38e9be891a887b0c85621bf3a5607db3fe6ae26e6a9952074765b5d23d58bb17'
verified=subprocess.check_output([a.build_tools+'/apksigner','verify','--print-certs',str(apk)],text=True);assert cert in verified,'Wrong signer'
badging=subprocess.check_output([a.build_tools+'/aapt','dump','badging',str(apk)],text=True).splitlines()[0];assert "name='com.deardiary.privateapp'" in badging and "versionCode='"+str(meta['code'])+"'" in badging and "versionName='"+meta['version']+"'" in badging,'Wrong version/package'
project='etkjcywiaiiphsrthxqe';base='https://'+project+'.supabase.co';token=pathlib.Path(a.token_file).read_text().strip();management={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
keys=json.load(urllib.request.urlopen(urllib.request.Request('https://api.supabase.com/v1/projects/'+project+'/api-keys',headers=management)));key=next(k['api_key'] for k in keys if k['name']=='service_role')
def call(path,body=None,method=None,content='application/json',extra=None):
 h={'Authorization':'Bearer '+key,'apikey':key,'Content-Type':content};h.update(extra or {});return urllib.request.urlopen(urllib.request.Request(base+path,data=body,method=method,headers=h))
bucket=json.load(call('/storage/v1/bucket/private-android-releases'));assert bucket['public'] is False
# Refuse accidental replacement/downgrade. Every immutable release has a unique code.
old=json.load(call('/rest/v1/android_releases?select=version_code&order=version_code.desc&limit=1'));assert not old or old[0]['version_code']<meta['code'],'Release code already published or older'
path=secrets.token_hex(24)+'/Dear-Diary-'+meta['version']+'.apk';call('/storage/v1/object/private-android-releases/'+path,data,'POST','application/vnd.android.package-archive').read();sha=hashlib.sha256(data).hexdigest()
signed=json.load(call('/storage/v1/object/sign/private-android-releases/'+path,json.dumps({'expiresIn':60}).encode(),'POST'))['signedURL'];url=base+'/storage/v1'+signed if signed.startswith('/object/') else base+signed if signed.startswith('/') else signed
assert hashlib.sha256(urllib.request.urlopen(url).read()).hexdigest()==sha,'Uploaded bytes differ'
row={'version_code':meta['code'],'version_name':meta['version'],'notes':meta['notes'],'object_path':path,'sha256':sha,'bytes':len(data),'active':True}
payload=json.dumps(row).replace("'","''");query="insert into public.android_releases(version_code,version_name,notes,object_path,sha256,bytes,active) select version_code,version_name,notes,object_path,sha256,bytes,active from jsonb_populate_record(null::public.android_releases,'"+payload+"'::jsonb);";urllib.request.urlopen(urllib.request.Request('https://api.supabase.com/v1/projects/'+project+'/database/query',data=json.dumps({'query':query}).encode(),headers=management)).read();print(json.dumps({'published':meta['version'],'code':meta['code'],'sha256':sha,'bytes':len(data),'object_path':path}))
