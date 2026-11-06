/** One active play mode; an old async load must never reclaim the scene. */
export class PlaySelector {
 constructor({loadWand,apply,onLoading=()=>{},onError=()=>{}}){Object.assign(this,{loadWand,apply,onLoading,onError});this.version=0;this.wand=null;this.pending=null;}
 async select(mode){
  const version=++this.version;
  this.apply(mode,this.wand);
  if(mode!=='wand'||this.wand){this.onLoading(false);return;}
  this.onLoading(true);
  try{
   this.pending??=this.loadWand();this.wand=await this.pending;
   if(version===this.version){this.apply(mode,this.wand);this.onLoading(false);}
  }catch(error){this.pending=null;if(version===this.version){this.onLoading(false);this.onError(error);}}
 }
}
