const video = document.getElementById("video");
const stage = document.getElementById("stage");
const stickersDiv = document.getElementById("stickers");
const overlayImg = document.getElementById("overlay");
const downloadBtn = document.getElementById("download");

let stream = null;
let facing = "user";
let selectedSticker = null;
let lastImageURL = null;

/* KAMERA */
async function startCamera(){
  if(stream) stream.getTracks().forEach(t=>t.stop());
  stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:facing } });
  video.srcObject = stream;
  video.style.transform = facing==="user" ? "scaleX(-1)" : "none";
}
document.getElementById("flip").onclick = ()=>{
  facing = facing==="user" ? "environment" : "user";
  startCamera();
};
startCamera();

/* FILTRI */
document.querySelectorAll(".filter").forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll(".filter").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    overlayImg.src = btn.dataset.img;
  };
});

/* IZBIRA / BRISANJE */
function selectSticker(el){
  document.querySelectorAll(".sticker").forEach(s=>s.classList.remove("selected"));
  selectedSticker = el;
  if(el) el.classList.add("selected");
}
document.getElementById("deleteSelected").onclick = ()=>{
  if(selectedSticker){ selectedSticker.remove(); selectedSticker=null; }
};
document.getElementById("clearAll").onclick = ()=>{
  stickersDiv.innerHTML=""; selectedSticker=null;
};
stage.addEventListener("click", e=>{
  if(!e.target.classList.contains("sticker")) selectSticker(null);
});

/* POMOŽNE */
function applyTransform(el){
  el.style.left = el.dataset.x + "%";
  el.style.top  = el.dataset.y + "%";
  el.style.transform =
    `translate(-50%,-50%) rotate(${el.dataset.r}deg) scale(${el.dataset.s})`;
}
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

/* GESTE */
function enableGestures(el){
  let dragging=false, offset=null;
  let startDist=0, startAngle=0, startScale=1, startRot=0, lastMid=null;

  function rect(){ return stage.getBoundingClientRect(); }
  function pts(t){ return Array.from(t).map(p=>({x:p.clientX,y:p.clientY})); }
  function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
  function angle(a,b){ return Math.atan2(b.y-a.y,b.x-a.x); }
  function mid(a,b){ return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}; }

  el.addEventListener("touchstart", e=>{
    e.stopPropagation(); selectSticker(el);
    const r=rect(), t=e.touches;
    if(t.length===1){
      e.preventDefault(); dragging=true;
      const p=t[0];
      offset={
        dx:(p.clientX-r.left)-(el.dataset.x/100*r.width),
        dy:(p.clientY-r.top)-(el.dataset.y/100*r.height)
      };
    }
    if(t.length===2){
      e.preventDefault(); dragging=false;
      const [a,b]=pts(t);
      startDist=dist(a,b);
      startAngle=angle(a,b);
      startScale=+el.dataset.s;
      startRot=+el.dataset.r;
      lastMid=mid(a,b);
    }
  },{passive:false});

  el.addEventListener("touchmove", e=>{
    const r=rect(), t=e.touches;
    if(t.length===1 && dragging){
      e.preventDefault();
      const p=t[0];
      let x=((p.clientX-r.left-offset.dx)/r.width)*100;
      let y=((p.clientY-r.top-offset.dy)/r.height)*100;
      el.dataset.x=clamp(x,2,98);
      el.dataset.y=clamp(y,2,98);
      applyTransform(el);
    }
    if(t.length===2){
      e.preventDefault();
      const [a,b]=pts(t);
      el.dataset.s=clamp(startScale*(dist(a,b)/startDist),0.4,3);
      el.dataset.r=startRot+(angle(a,b)-startAngle)*180/Math.PI;
      if(lastMid){
        const m=mid(a,b);
        el.dataset.x=clamp(+el.dataset.x+(m.x-lastMid.x)/r.width*100,2,98);
        el.dataset.y=clamp(+el.dataset.y+(m.y-lastMid.y)/r.height*100,2,98);
        lastMid=m;
      }
      applyTransform(el);
    }
  },{passive:false});
}

/* DODAJ NALEPKO */
function addSticker(text, type){
  const el=document.createElement("div");
  el.className=`sticker ${type}`;
  el.textContent=text;
  el.dataset.x=50; el.dataset.y=50; el.dataset.s=1; el.dataset.r=0;
  applyTransform(el);
  enableGestures(el);
  el.onclick=e=>{ e.stopPropagation(); selectSticker(el); };
  stickersDiv.appendChild(el);
  selectSticker(el);
}

/* GUMBI */
document.querySelectorAll(".emojis button").forEach(b=>{
  b.onclick=()=>addSticker(b.textContent,"emoji");
});
document.querySelectorAll(".text-stickers button").forEach(b=>{
  b.onclick=()=>addSticker(b.textContent,"text");
});

/* FOTOGRAFIRANJE */
document.getElementById("shot").onclick=()=>{
  const W=1080,H=1920;
  const c=document.createElement("canvas");
  c.width=W;c.height=H;
  const ctx=c.getContext("2d");

  const vw=video.videoWidth,vh=video.videoHeight;
  if(!vw) return;
  const tr=W/H,vr=vw/vh;
  let sx=0,sy=0,sw=vw,sh=vh;
  if(vr>tr){ sw=vh*tr; sx=(vw-sw)/2; }
  else{ sh=vw/tr; sy=(vh-sh)/2; }

  if(facing==="user"){ ctx.translate(W,0); ctx.scale(-1,1); }
  ctx.drawImage(video,sx,sy,sw,sh,0,0,W,H);
  ctx.setTransform(1,0,0,1,0,0);

  const ow=overlayImg.naturalWidth,oh=overlayImg.naturalHeight;
  const sc=Math.min(W/ow,H/oh);
  ctx.drawImage(overlayImg,(W-ow*sc)/2,(H-oh*sc)/2,ow*sc,oh*sc);

  document.querySelectorAll(".sticker").forEach(el=>{
    ctx.save();
    ctx.translate(el.dataset.x/100*W,el.dataset.y/100*H);
    ctx.rotate(el.dataset.r*Math.PI/180);
    if(el.classList.contains("text")){
      ctx.font=`900 ${34*el.dataset.s}px system-ui`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="rgba(0,0,0,.55)";
      const w=ctx.measureText(el.textContent).width+40;
      ctx.fillRect(-w/2,-30,w,60);
      ctx.fillStyle="#fff";
    }else{
      ctx.font=`${80*el.dataset.s}px system-ui`;
      ctx.textAlign="center"; ctx.textBaseline="middle";
    }
    ctx.fillText(el.textContent,0,0);
    ctx.restore();
  });

  lastImageURL=c.toDataURL("image/png");
  downloadBtn.disabled=false;
};

/* PRENOS */
downloadBtn.onclick=()=>{
  if(!lastImageURL) return;
  const a=document.createElement("a");
  a.href=lastImageURL;
  a.download="fotofilter.png";
  a.click();
};
