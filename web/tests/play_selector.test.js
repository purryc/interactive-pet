import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaySelector} from '../src/play_selector.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('leaving while wand loads cannot reactivate it, and next visit reuses the asset',async()=>{
 const load=deferred(),applied=[];let calls=0;
 const selector=new PlaySelector({loadWand:()=>{calls++;return load.promise;},apply:(mode,wand)=>applied.push([mode,wand])});
 const pending=selector.select('wand');await selector.select('feed');load.resolve({ready:true});await pending;
 assert.equal(applied.at(-1)[0],'feed');await selector.select('wand');assert.equal(calls,1);assert.equal(applied.at(-1)[1].ready,true);
});
test('failed wand load can retry and never prevents selecting food',async()=>{
 let calls=0,errors=0;const modes=[];
 const selector=new PlaySelector({loadWand:async()=>{if(++calls===1)throw new Error('offline');return {ready:true};},apply:mode=>modes.push(mode),onError:()=>errors++});
 await selector.select('wand');assert.equal(errors,1);await selector.select('feed');assert.equal(modes.at(-1),'feed');await selector.select('wand');assert.equal(selector.wand.ready,true);
});
test('rapid repeated wand selection initializes one world',async()=>{
 const load=deferred();let calls=0,activations=0;
 const selector=new PlaySelector({loadWand:()=>{calls++;return load.promise;},apply:(_,wand)=>{if(wand)activations++;}});
 const a=selector.select('wand'),b=selector.select('wand');load.resolve({ready:true});await Promise.all([a,b]);assert.equal(calls,1);assert.equal(activations,1);
});
