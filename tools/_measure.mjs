import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createGzip } from 'node:zlib';
import { chromium } from 'playwright';
const ROOT='/home/user/Webseite/';
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.xml':'application/xml','.txt':'text/plain'};
const s=createServer(async(req,res)=>{const p=join(ROOT,req.url.split('?')[0]);
 try{const b=await readFile(p);res.writeHead(200,{'Content-Type':TYPES[extname(p)]??'application/octet-stream'});res.end(b);}catch{res.writeHead(404).end('x');}});
await new Promise(r=>s.listen(8903,r));
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
for (const page of ['index.html','it-sicherheit.html','betroffenheit.html']) {
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  const p=await ctx.newPage();
  const reqs=[];
  p.on('response', async r=>{ try{ const bodyLen=(await r.body()).length; reqs.push([r.url().replace('http://localhost:8903/',''), bodyLen]); }catch{} });
  await p.goto('http://localhost:8903/'+page,{waitUntil:'networkidle'});
  const m = await p.evaluate(()=>new Promise(res=>{
    const out={dom:document.querySelectorAll('*').length, sheets:document.styleSheets.length};
    let rules=0; try{ for(const sh of document.styleSheets) rules+=sh.cssRules.length; }catch{}
    out.rules=rules;
    new PerformanceObserver(list=>{ const e=list.getEntries().at(-1); out.lcp=Math.round(e.startTime); }).observe({type:'largest-contentful-paint',buffered:true});
    let cls=0; new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) cls+=e.value;}).observe({type:'layout-shift',buffered:true});
    setTimeout(()=>{ out.cls=+cls.toFixed(4);
      const nav=performance.getEntriesByType('navigation')[0];
      out.domContentLoaded=Math.round(nav.domContentLoadedEventEnd);
      const fcp=performance.getEntriesByName('first-contentful-paint')[0];
      out.fcp=fcp?Math.round(fcp.startTime):null;
      res(out); },1200);
  }));
  const total=reqs.reduce((a,[,n])=>a+n,0);
  console.log(`\n### ${page}`);
  console.log('Anfragen:', reqs.length, ' Gesamt:', (total/1024).toFixed(1)+' KB');
  reqs.sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([u,n])=>console.log('   ',(n/1024).toFixed(1).padStart(7)+' KB', u));
  console.log('   Metriken:', JSON.stringify(m));
  await ctx.close();
}
await b.close(); s.close();
