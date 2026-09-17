import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CatController} from '../src/cat_controller.js';
const config=JSON.parse(fs.readFileSync(new URL('../public/assets/cat_asset_config_v10.json',import.meta.url)));
// Load the actual delivered geometry, rig and clips without browser-only images.
// Materials remain covered by native browser visual acceptance.
const raw=fs.readFileSync(new URL('../public/assets/siamese_cat_quadruped_v10.glb',import.meta.url));
const jsonLength=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+jsonLength).toString());
const offset=20+jsonLength,bin=raw.subarray(offset+8,offset+8+raw.readUInt32LE(offset));
doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
delete doc.images;delete doc.textures;delete doc.materials;
for(const m of doc.meshes)for(const p of m.primitives)delete p.material;
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
async function fixture(){return new CatController(await new GLTFLoader().parseAsync(JSON.stringify(doc),''),config);}
function advance(cat,seconds){for(let i=0;i<Math.ceil(seconds*60);i++)cat.update(1/60);}
test('actual GLB contains 12 clips and 32 bones, normalized four-influence skin',async()=>{
 const cat=await fixture();assert.equal(Object.keys(cat.animation.actions).length,12);let bones=0;
 cat.model.traverse(o=>{if(o.isBone)bones++;if(o.isSkinnedMesh){const w=o.geometry.attributes.skinWeight;for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-4);}});
 assert.equal(bones,32);for(const [key,name] of Object.entries(config.boneMap))if(name)assert.ok(cat.bones[key]?.isBone,`missing bone mapping ${key}: ${name}`);cat.dispose();
});
test('jump sequence completes crouch, jump, land, idle; interruption clears sequence',async()=>{
 const cat=await fixture(),seen=new Set();cat.play('jump');for(let i=0;i<300;i++){cat.update(1/60);seen.add(cat.animation.current);}
 assert.deepEqual([...seen],['crouch','jump','land','idle']);
 cat.play('jump');advance(cat,.5);cat.play('pawRight');advance(cat,3);assert.equal(cat.animation.current,'idle');assert.equal(cat.animation.queue.length,0);cat.dispose();
});
test('look overlay stays bounded, does not accumulate, and restores animated pose',async()=>{
 const cat=await fixture();cat.look.bodyFollow=false;cat.animation.mixer.timeScale=0;
 cat.update(0);const original=cat.look.head.quaternion.clone().normalize();cat.setTarget({active:true,position:new Vector3(10,10,-2)});advance(cat,8);
 assert.ok(cat.look.yaw<=80*Math.PI/180+.00001);assert.ok(cat.look.pitch<=35*Math.PI/180+.00001);
 const steady=cat.look.head.quaternion.clone();advance(cat,20);assert.ok(steady.angleTo(cat.look.head.quaternion)<1e-5);
 cat.look.enabled=false;advance(cat,8);assert.ok(original.angleTo(cat.look.head.quaternion)<1e-4);cat.dispose();
});
test('moveTo turns and reaches ground target, slows down, then idles',async()=>{
 const cat=await fixture();cat.look.bodyFollow=false;const target=new Vector3(.23,1,-.16);cat.moveTo(target);const seen=new Set();let maxStep=0;let last=cat.root.position.clone();
 for(let i=0;i<1200;i++){cat.update(1/60);seen.add(cat.animation.current);maxStep=Math.max(maxStep,cat.root.position.distanceTo(last));last.copy(cat.root.position);}
 assert.ok(cat.root.position.distanceTo(new Vector3(.23,0,-.16))<.013);assert.equal(cat.movement.target,null);assert.equal(cat.animation.current,'idle');assert.ok(seen.has('walk'));assert.ok(maxStep<=cat.movement.walkSpeed/60+.0001);cat.dispose();
});
test('rapid action switches leave one contributing action after fade',async()=>{
 const cat=await fixture();for(const key of Object.keys(config.animationMap)){cat.play(key);advance(cat,.09);}cat.play('idle');advance(cat,2);
 assert.equal(Object.values(cat.animation.actions).filter(a=>a.isScheduled()&&a.getEffectiveWeight()>.001).length,1);cat.dispose();
});
