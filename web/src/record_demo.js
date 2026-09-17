/** Local canvas-only recording; no microphone or screen-capture permission. */
export function recordDemo(canvas,onStart,onComplete,onError){
 try{
  const mime=['video/mp4;codecs=avc1.42001E','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mime)throw new Error('当前浏览器不支持本地录制');
  const output=document.createElement('canvas');output.width=1280;output.height=Math.round(1280*canvas.height/canvas.width/2)*2;
  const ctx=output.getContext('2d');ctx.drawImage(canvas,0,0,output.width,output.height);
  const stream=output.captureStream(30),chunks=[],recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3500000});
  let captureFrame;const draw=()=>{ctx.drawImage(canvas,0,0,output.width,output.height);captureFrame=requestAnimationFrame(draw);};
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.onstop=()=>{cancelAnimationFrame(captureFrame);stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='heihei_interaction_v10.'+(mime.startsWith('video/mp4')?'mp4':'webm');link.textContent='下载互动演示';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);onComplete();};
  recorder.onerror=e=>onError(e.error);recorder.start();onStart();draw();setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},15000);
 }catch(error){onError(error);}
}
