import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SpatialInputSystem} from '../v1/spatial_input.js';
import {CatBrain,CatPerceptionSystem} from '../v1/cat_brain.js';
import {PhysicalCatWand} from './wand.js';
export async function createWandMode(scene,cat,canvas,camera,focus,base,isBlocked){
 const gltf=await new GLTFLoader().loadAsync(new URL('assets/cat_wand_v3.glb',base).href);
 const wand=await PhysicalCatWand.create(scene,gltf,cat);
 const spatial=new SpatialInputSystem(canvas,camera,focus,{isBlocked});spatial.setMode('off');
 const perception=new CatPerceptionSystem();let brain=new CatBrain(cat),target=null;
 return {
  wand,spatial,get brain(){return brain;},
  enter(){spatial.deactivate();spatial.setMode('wand');brain=new CatBrain(cat);target=null;},
  exit(){spatial.setMode('off');wand.update(0,null);wand.debugGroup.visible=false;target=null;},
  suspend(){spatial.deactivate();wand.update(0,null);target=null;wand.clearAccumulation();},
  update(dt){
   if(isBlocked())spatial.deactivate();
   brain.update(dt,perception.perceive(target?{...target,kind:'feather'}:null,cat));
   cat.update(dt);target=wand.update(dt,spatial.filteredPointer,spatial.consumeSamples());
   for(const contact of wand.physics.contacts)brain.onContact(contact);
  }
 };
}
