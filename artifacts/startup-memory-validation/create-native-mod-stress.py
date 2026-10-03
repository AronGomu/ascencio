import json,pathlib
app=pathlib.Path('.tmp/native-performance-final/startup-native-data/com.ascencio.storyduel'); ids=['native-acceptance']
for i in range(31):
 id=f'stress-{i}';ids.append(id);root=app/'mods'/id;root.mkdir(exist_ok=True)
 manifest={'schemaVersion':1,'id':id,'version':'1.0.0','contentApi':1,'base':[],'dependencies':[],'entities':[],'media':[]}
 (root/'mod.json').write_text(json.dumps(manifest))
p=app/'user-data.json';doc=json.loads(p.read_text())
for record in doc['records']:
 if record['namespace']=='preferences' and record['key']=='content-mods':record['payload']['enabled']=ids;record['revision']+=1
doc['revision']+=1;p.write_text(json.dumps(doc))
print('32 enabled mods; 39 additive effect cards/scripts and one overriding deck; existing scoped fixture only.')
