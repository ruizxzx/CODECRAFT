const url=process.env.OFFSCRPT_DEPLOYMENT_URL;
if(!url){console.error('Set OFFSCRPT_DEPLOYMENT_URL to run the deployment health check.');process.exit(2);}
const target=new URL(url); target.pathname=target.pathname||'/';
const started=Date.now();
try{const res=await fetch(target,{redirect:'follow',headers:{'user-agent':'OFFSCRPT-deployment-health/71.5'}});const body=await res.text();
 if(!res.ok) throw new Error(`HTTP ${res.status}`);
 const markers=['<div id="root"></div>','OFFSCRPT'];
 const missing=markers.filter(m=>!body.includes(m));
 if(missing.length) throw new Error(`deployment response missing expected markers: ${missing.join(', ')}`);
 console.log(`DEPLOYMENT HEALTH OK — HTTP ${res.status} — ${Date.now()-started}ms — ${target.origin}`);
}catch(error){console.error(`DEPLOYMENT HEALTH FAILED — ${error instanceof Error?error.message:String(error)}`);process.exit(1);}
