(() => {
  'use strict';
  const canvas = document.querySelector('#world'), ctx = canvas.getContext('2d');
  const mini = document.querySelector('#minimap'), mtx = mini.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const ui = { health:$('#healthBar'), healthValue:$('#healthValue'), stamina:$('#staminaBar'), staminaValue:$('#staminaValue'), distance:$('#distance'), objective:$('#objectiveText'), progress:$('#progressBar'), interaction:$('#interaction'), toast:$('#toast'), toastText:$('#toast strong'), vehicleHud:$('#vehicleHud'), speed:$('#speedValue'), gear:$('#gearValue'), pause:$('#pauseOverlay'), pauseMission:$('#pauseMission') };
  const world = { w:2400, h:1800 }, road = { x:1200, y:900, w:390, h:world.h+200 }, blockW=road.w/2+10;
  const player={x:1200,y:1440,angle:-Math.PI/2,health:100,stamina:100,speed:0,inCar:false,hop:0};
  const car={x:1265,y:1370,angle:-Math.PI/2,speed:0,color:'#db4d45'};
  const target={x:1200,y:295};
  const keys=new Set(); let paused=false, complete=false, toastTimer=0, last=performance.now(), elapsed=0, width=0,height=0,dpr=1,camX=0,camY=0,nearCar=false,particles=[];
  const buildings=[];
  const rnd=(n)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
  for(let row=0;row<7;row++) for(let side of [-1,1]){
    const x=road.x+side*(road.w/2+155+rnd(row*4+(side+2))*30), y=110+row*245;
    const h=145+rnd(row*9+(side+4))*230,w=145+rnd(row*13+(side+1))*60,d=130+rnd(row*6+(side+3))*60;
    buildings.push({x,y,w,d,h,hue:[192,205,219,24,278][Math.floor(rnd(row*11+side*9)*5)],seed:row*20+(side+5),sign:row%3===1,store:row===1&&side===1});
  }
  const peds=Array.from({length:15},(_,i)=>({x:1010+rnd(i+42)*380,y:230+rnd(i+5)*1400,a:rnd(i+24)*6.28,s:14+rnd(i+2)*14,phase:rnd(i+66)*8,color:['#f5bb87','#b1d8d0','#e19aa0','#aab5ed','#dfd7c1'][i%5],flee:0}));
  const traffic=Array.from({length:6},(_,i)=>({x:1090+(i%2)*225,y:80+i*280,speed:70+rnd(i+39)*55,color:['#34afa7','#6574d9','#d58d4b','#bd5961'][i%4],a:Math.PI/2}));
  function resize(){dpr=Math.min(devicePixelRatio||1,2);width=innerWidth;height=innerHeight;canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();
  function toast(text){ui.toastText.textContent=text;ui.toast.classList.add('show');toastTimer=3.2}
  function project(x,y,z=0){const scale=1.12-Math.max(0,y-camY+height*.04)/Math.max(1,height)*.00046;return [width*.51+(x-camX)*scale,height*.59+(y-camY)*scale-z*scale,scale]}
  function polygon(points,fill,stroke=null,lw=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function line(points,color,lw=1){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.stroke()}
  function box(b){const [x,y,s]=project(b.x,b.y),w=b.w*s,d=b.d*s,h=b.h*s,depth=d*.38;const hue=b.hue;
    const top=`hsl(${hue} 22% 29%)`,front=`hsl(${hue} 25% 18%)`,side=`hsl(${hue} 22% 12%)`;
    polygon([[x-w/2,y-h],[x-w/2+depth,y-h-depth*.24],[x+w/2+depth,y-h-depth*.24],[x+w/2,y-h]],top,'#bdebe716',.8);
    polygon([[x-w/2,y-h],[x+w/2,y-h],[x+w/2,y],[x-w/2,y]],front,'#9ce3df14',.6);
    polygon([[x+w/2,y-h],[x+w/2+depth,y-h-depth*.24],[x+w/2+depth,y-depth*.24],[x+w/2,y]],side);
    // Window grids, clipped to the building face.
    ctx.save();ctx.beginPath();ctx.rect(x-w/2+3,y-h+4,w-6,h-6);ctx.clip();
    const cols=Math.max(3,Math.floor(b.w/22)),rows=Math.floor(b.h/25);
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const lit=rnd(b.seed+r*cols+c)>.30;const wx=x-w/2+(c+.5)*(w/cols),wy=y-h+(r+.5)*(h/rows),ww=Math.max(1.2,2.2*s),wh=Math.max(2,6.2*s);
      ctx.fillStyle=lit?`hsla(${b.store?40:177} 96% ${b.store?68:61}% / ${.19+rnd(r+c+b.seed)*.37})`:'#18262c';ctx.fillRect(wx-ww/2,wy-wh/2,ww,wh);
    }
    ctx.restore();
    if(b.sign){ctx.shadowColor='#ff5697';ctx.shadowBlur=15;ctx.fillStyle='#ff79a6';ctx.font=`${Math.max(6,9*s)}px monospace`;ctx.textAlign='center';ctx.fillText(b.store?'N E O N':'A F T E R',x,y-h*.45);ctx.shadowBlur=0}
  }
  function ground(){ctx.fillStyle='#131b1d';ctx.fillRect(0,0,width,height);
    const [rx1,ry1,s1]=project(road.x-road.w/2,0),[rx2]=project(road.x+road.w/2,0),[,ry2]=project(road.x-road.w/2,world.h);
    ctx.fillStyle='#202629';ctx.fillRect(rx1,ry1,rx2-rx1,ry2-ry1);
    // Sidewalks and curb lighting.
    for(const side of [-1,1]){const x=road.x+side*road.w/2;const [sx,sy,ss]=project(x,0);const [,ey]=project(x,world.h);ctx.fillStyle='#42474a';ctx.fillRect(sx-7*ss,sy,14*ss,ey-sy);line([[sx,sy],[sx,ey]],'#92b9b133',1)}
    // Lane paint and crosswalks.
    const [cx,cy,sc]=project(road.x,0),[,bottom]=project(road.x,world.h);
    for(let y=cy%42;y<height;y+=42)line([[cx,y],[cx,y+21]],'#d4d1bd61',2*sc);
    for(let y=cy+220;y<height;y+=510){for(let i=-5;i<=5;i++){const xx=cx+i*17*sc;ctx.fillStyle='#e8e5d45a';ctx.fillRect(xx,y,8*sc,36*sc)}}
    // Sidewalk slabs, streetlights and planted trees.
    for(let i=0;i<15;i++){const y=(Math.floor((camY-500)/180)+i)*180;for(const side of [-1,1]){
      const tx=road.x+side*(road.w/2+45),[x,sy,s]=project(tx,y),[,gy]=project(tx,y+50);if(sy<-100||sy>height+30)continue;
      ctx.fillStyle='#6bcaad18';ctx.beginPath();ctx.ellipse(x,gy,13*s,5*s,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#796e58';ctx.fillRect(x-2*s,sy-14*s,4*s,17*s);ctx.fillStyle='#24675c';ctx.beginPath();ctx.arc(x,sy-19*s,10*s,0,Math.PI*2);ctx.fill();ctx.fillStyle='#409281';ctx.beginPath();ctx.arc(x-3*s,sy-23*s,6*s,0,Math.PI*2);ctx.fill();
      if(i%2===0){const lx=road.x+side*(road.w/2-24),[px,py,ps]=project(lx,y);ctx.fillStyle='#252e30';ctx.fillRect(px-1*ps,py-43*ps,2*ps,43*ps);ctx.shadowColor='#f4d49a';ctx.shadowBlur=12;ctx.fillStyle='#ffe0a6';ctx.beginPath();ctx.arc(px,py-44*ps,3*ps,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
    }}
    // Park pocket on one block.
    const [px,py,ps]=project(road.x+road.w/2+155,780);ctx.fillStyle='#15352c';ctx.fillRect(px-70*ps,py-38*ps,125*ps,72*ps);for(let i=0;i<7;i++){const tx=px+(i%4)*28*ps-55*ps,ty=py+Math.floor(i/4)*30*ps-15*ps;ctx.fillStyle='#397357';ctx.beginPath();ctx.arc(tx,ty,7*ps,0,Math.PI*2);ctx.fill()}
  }
  function drawCar(x,y,a,color,scale=1){const [cx,cy,s]=project(x,y);ctx.save();ctx.translate(cx,cy);ctx.rotate(a+Math.PI/2);const w=21*s*scale,h=42*s*scale;
    ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(0,4*s,w*.9,h*.58,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#161c20';ctx.fillRect(-w*.52,-h*.4,w*.16,h*.3);ctx.fillRect(w*.36,-h*.4,w*.16,h*.3);ctx.fillRect(-w*.52,h*.14,w*.16,h*.29);ctx.fillRect(w*.36,h*.14,w*.16,h*.29);
    ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,4*s);ctx.fill();ctx.fillStyle='#c0ebdf';ctx.beginPath();ctx.roundRect(-w*.35,-h*.25,w*.7,h*.29,3*s);ctx.fill();ctx.fillStyle='#263a3c';ctx.beginPath();ctx.roundRect(-w*.34,h*.06,w*.68,h*.2,2*s);ctx.fill();
    ctx.shadowBlur=8*s;ctx.shadowColor='#ff5166';ctx.fillStyle='#ff6b76';ctx.fillRect(-w*.34,h*.42,w*.2,2*s);ctx.fillRect(w*.14,h*.42,w*.2,2*s);ctx.shadowColor='#fff4c0';ctx.fillStyle='#fff1bb';ctx.fillRect(-w*.34,-h*.47,w*.2,2*s);ctx.fillRect(w*.14,-h*.47,w*.2,2*s);ctx.restore();
  }
  function drawPerson(p){const [x,y,s]=project(p.x,p.y);if(y<-30||y>height+40)return;const bob=Math.sin(elapsed*8+p.phase)*1.5*s;
    ctx.fillStyle='#0007';ctx.beginPath();ctx.ellipse(x,y+2*s,5*s,2*s,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#171c20';ctx.lineWidth=2.3*s;ctx.lineCap='round';line([[x-1*s,y-5*s+bob],[x-2*s,y]],'#172027',2*s);line([[x+1*s,y-5*s+bob],[x+3*s,y]],'#172027',2*s);
    ctx.strokeStyle=p.color;ctx.lineWidth=4*s;line([[x,y-14*s+bob],[x,y-5*s+bob]],p.color,4*s);ctx.fillStyle='#ddb597';ctx.beginPath();ctx.arc(x,y-18*s+bob,3.4*s,0,Math.PI*2);ctx.fill();
    if(p.flee>0){ctx.font=`${8*s}px monospace`;ctx.fillStyle='#e9d39c';ctx.fillText('!',x+5*s,y-20*s)}
  }
  function drawPlayer(){if(player.inCar)return;const [x,y,s]=project(player.x,player.y);if(y<-40||y>height+50)return;const jump=Math.max(0,player.hop)*48*s,bob=Math.sin(elapsed*9)*.6*s;
    ctx.fillStyle='#0009';ctx.beginPath();ctx.ellipse(x,y+2*s,7*s,3*s,0,0,Math.PI*2);ctx.fill();
    const footY=y-jump;
    // Compact, readable courier silhouette with a cyan jacket and shoulder bag.
    ctx.lineCap='round';line([[x-2*s,footY-5*s],[x-3*s,footY]],'#18212a',2.5*s);line([[x+2*s,footY-5*s],[x+3*s,footY]],'#18212a',2.5*s);
    line([[x-2*s,footY-12*s+bob],[x-5*s,footY-7*s+bob]],'#a9e9dd',2*s);line([[x+2*s,footY-12*s+bob],[x+5*s,footY-7*s+bob]],'#a9e9dd',2*s);
    ctx.fillStyle='#57c9bd';ctx.beginPath();ctx.moveTo(x,footY-16*s+bob);ctx.lineTo(x+4*s,footY-14*s+bob);ctx.lineTo(x+3*s,footY-6*s);ctx.lineTo(x-3*s,footY-6*s);ctx.lineTo(x-4*s,footY-14*s+bob);ctx.closePath();ctx.fill();
    ctx.fillStyle='#9b6349';ctx.fillRect(x-6*s,footY-13*s+bob,2*s,7*s);ctx.fillStyle='#d9b49a';ctx.beginPath();ctx.arc(x,footY-19*s+bob,3.2*s,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#62ecdf';ctx.lineWidth=1*s;ctx.beginPath();ctx.ellipse(x,footY-9*s+bob,8*s,13*s,0,0,Math.PI*2);ctx.stroke();
  }
  function drawTarget(){const [x,y,s]=project(target.x,target.y);const pulse=1+Math.sin(elapsed*3)*.12;ctx.save();ctx.translate(x,y);ctx.strokeStyle='#ffbd6e';ctx.lineWidth=1.4;ctx.shadowColor='#ffad58';ctx.shadowBlur=12;ctx.beginPath();ctx.ellipse(0,0,18*s*pulse,7*s*pulse,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(0,-35*s);ctx.lineTo(0,-4*s);ctx.stroke();ctx.fillStyle='#ffd08d';ctx.beginPath();ctx.arc(0,-37*s,3*s,0,Math.PI*2);ctx.fill();ctx.restore()}
  function render(){ctx.clearRect(0,0,width,height);ground();buildings.filter(b=>b.y>camY-300&&b.y<camY+height+300).sort((a,b)=>b.y-a.y).forEach(box);drawTarget();
    traffic.forEach(t=>drawCar(t.x,t.y,t.a,t.color,.82));peds.forEach(drawPerson);if(!player.inCar)drawCar(car.x,car.y,car.angle,car.color,1);if(player.inCar)drawCar(player.x,player.y,player.angle,car.color,1);else drawPlayer();
    // A little rain glints in the streetlight cones.
    ctx.strokeStyle='#bfe7f21c';for(const drop of particles){const x=(drop.x+elapsed*drop.v)%width,y=(drop.y+elapsed*drop.v*2)%height;line([[x,y],[x-2,y+7]],'#c6e7f024',1)}
  }
  function drawMap(){const w=mini.width,h=mini.height;mtx.clearRect(0,0,w,h);mtx.fillStyle='#132027';mtx.fillRect(0,0,w,h);mtx.fillStyle='#243034';mtx.fillRect(w*.42,0,w*.18,h);mtx.fillRect(0,h*.5,w,h*.13);buildings.forEach(b=>{const x=b.x/world.w*w,y=b.y/world.h*h;mtx.fillStyle='#36444a';mtx.fillRect(x-8,y-7,12,12)});mtx.fillStyle='#ffb565';mtx.beginPath();mtx.arc(target.x/world.w*w,target.y/world.h*h,3,0,Math.PI*2);mtx.fill();const px=player.x/world.w*w,py=player.y/world.h*h;mtx.fillStyle='#62ecdf';mtx.shadowColor='#62ecdf';mtx.shadowBlur=8;mtx.beginPath();mtx.arc(px,py,3.5,0,Math.PI*2);mtx.fill();mtx.shadowBlur=0}
  function update(dt){elapsed+=dt;const actor=player.inCar?car:player;const dx=target.x-actor.x,dy=target.y-actor.y,dist=Math.hypot(dx,dy);ui.distance.textContent=`${Math.round(dist/4)} m`;ui.progress.style.width=`${Math.max(5,100-Math.min(95,dist/(world.h)*100))}%`;
    if(!complete&&dist<90){complete=true;ui.objective.textContent='Package delivered';ui.pauseMission.textContent='COMPLETE';ui.progress.style.width='100%';toast('HANDOFF COMPLETE  ·  ¢ 2,400 EARNED');}
    nearCar=!player.inCar&&Math.hypot(player.x-car.x,player.y-car.y)<110;ui.interaction.classList.toggle('show',nearCar);
    const forward=(keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),side=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),sprinting=keys.has('shift')&&!player.inCar&&player.stamina>1&&forward>0;
    if(sprinting)player.stamina=Math.max(0,player.stamina-26*dt);else player.stamina=Math.min(100,player.stamina+15*dt);
    if(player.inCar){car.speed+=(forward*220*dt)-car.speed*1.1*dt;car.speed=Math.max(-100,Math.min(520,car.speed));car.angle+=side*dt*Math.min(2,Math.abs(car.speed)/100)*Math.sign(car.speed||1);car.x+=Math.cos(car.angle)*car.speed*dt;car.y+=Math.sin(car.angle)*car.speed*dt;player.x=car.x;player.y=car.y;player.angle=car.angle;ui.speed.textContent=String(Math.round(Math.abs(car.speed)*.24)).padStart(3,'0');ui.gear.textContent=car.speed>4?'D':car.speed<-4?'R':'P'}else{const speed=sprinting?245:150;if(forward||side){player.angle=Math.atan2(side,forward)+Math.PI/2;player.x+=side*speed*dt;player.y-=forward*speed*dt}}player.hop=Math.max(0,player.hop-dt);
    player.x=Math.max(80,Math.min(world.w-80,player.x));player.y=Math.max(45,Math.min(world.h-45,player.y));car.x=Math.max(70,Math.min(world.w-70,car.x));car.y=Math.max(45,Math.min(world.h-45,car.y));
    for(const t of traffic){t.y+=t.speed*dt;if(t.y>world.h+80)t.y=-60}
    for(const p of peds){if(!player.inCar&&Math.hypot(p.x-player.x,p.y-player.y)<85)p.flee=2;if(p.flee>0)p.flee-=dt;const speed=p.flee>0?p.s*2:p.s;p.x+=Math.cos(p.a)*speed*dt;p.y+=Math.sin(p.a)*speed*dt;if(p.x<980||p.x>1420)p.a=Math.PI-p.a;if(p.y<50||p.y>world.h-50)p.a=-p.a;if(rnd(Math.floor(elapsed*2)+p.phase*30)>.997)p.a+=(rnd(p.phase*100+Math.floor(elapsed))*2-1)*1.3}
    camX+=(actor.x-camX)*Math.min(1,dt*3.4);camY+=(actor.y-camY)*Math.min(1,dt*3.4);ui.health.style.width=`${player.health}%`;ui.healthValue.textContent=`${Math.round(player.health)}%`;ui.stamina.style.width=`${player.stamina}%`;ui.staminaValue.textContent=`${Math.round(player.stamina)}%`;
    if(toastTimer>0&&(toastTimer-=dt)<=0)ui.toast.classList.remove('show');drawMap();
  }
  function frame(now){const dt=Math.min((now-last)/1000,.045);last=now;if(!paused)update(dt);render();requestAnimationFrame(frame)}
  function interact(){if(player.inCar){player.inCar=false;player.x=car.x+Math.cos(car.angle+Math.PI/2)*55;player.y=car.y+Math.sin(car.angle+Math.PI/2)*55;ui.vehicleHud.classList.remove('show');toast('ON FOOT  ·  PACKAGE SECURED')}else if(nearCar){player.inCar=true;ui.vehicleHud.classList.add('show');toast('VELA GT  ·  READY TO DRIVE')}}
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='escape'){paused=!paused;ui.pause.classList.toggle('show',paused);return}if(k==='e'&&!e.repeat){interact();return}if(k===' '&&!e.repeat&&!player.inCar)player.hop=.32;keys.add(k)});
  addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());$('#resumeButton').addEventListener('click',()=>{paused=false;ui.pause.classList.remove('show')});
  ui.toastText.textContent='NEXORA CITY  ·  AFTERLIGHT DISTRICT';ui.toast.classList.add('show');toastTimer=4;
  particles=Array.from({length:90},(_,i)=>({x:rnd(i+45)*innerWidth,y:rnd(i+900)*innerHeight,v:45+rnd(i+88)*80}));
  requestAnimationFrame(frame);
})();
