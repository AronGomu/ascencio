import json,pathlib
repo=pathlib.Path.cwd(); app=repo/'.tmp/native-performance-final/startup-native-data/com.ascencio.storyduel'; root=app/'mods/native-acceptance'; root.mkdir(parents=True,exist_ok=True)
manifest={'schemaVersion':1,'id':'native-acceptance','version':'1.0.0','contentApi':1,'base':[{'packageId':'card-library','version':'1.1.0'},{'packageId':'freeplay','version':'1.1.0'}],'dependencies':[],'entities':[],'media':[]}
def entity(kind,package,id,path,value,operation='add'):
 manifest['entities'].append(dict(kind=kind,packageId=package,operation=operation,id=id,path=path,resolves=[]));(root/path).write_text(value if isinstance(value,str) else json.dumps(value))
cards=[]
for i in range(39):
 id=f'native-acceptance:card-{i}';cards.append(id)
 entity('cards','card-library',id,f'card-{i}.json',{'schemaVersion':1,'id':id,'engine':{'code':0,'alias':0,'setcodes':[],'level':4,'attack':1500,'defense':1000,'lscale':0,'rscale':0,'linkMarker':0,'scope':3},'classification':{'types':['monster','effect'],'attributes':['earth'],'races':['warrior']},'texts':[{'locale':'en','name':f'Native Mod Card {i}','description':'Isolated native engine acceptance fixture.','strings':['']*16}]})
 entity('scripts','card-library',f'card:{id}',f'card-{i}.lua','local s,id=GetID()\nfunction s.initial_effect(c)\nend\n')
deck=json.loads((repo/'generated/readable-content-v1/freeplay/decks/freeplay-player.json').read_text())
entity('decks','freeplay',deck['id'],'deck.json',{'fields':{'main':[97590747]+cards}},'override')
(root/'mod.json').write_text(json.dumps(manifest))
user=app/'user-data.json'; doc=json.loads(user.read_text());records=doc['records'];records=[r for r in records if not (r['namespace']=='preferences' and r['key']=='content-mods')]
records.append({'namespace':'preferences','key':'content-mods','revision':1,'payload':{'schemaVersion':1,'mode':'modded','root':{'kind':'managed','path':None},'enabled':['native-acceptance']}});doc['records']=records;doc['revision']+=1;user.write_text(json.dumps(doc));print('Enabled declared 39 effect cards, Lua scripts and one deck override in isolated fixture only.')
