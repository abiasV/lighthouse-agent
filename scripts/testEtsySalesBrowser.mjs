import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// Optional tooling paths keep browser dependencies out of the production install.
const {chromium: pw}=await import(process.env.LIGHTHOUSE_PLAYWRIGHT_MODULE || 'playwright');
const dist=new URL('../client/dist/', import.meta.url);
// All requests below are intercepted. This tests the built UI, not live Etsy/OAuth.
const browser=await pw.launch({headless:true,executablePath:process.env.LIGHTHOUSE_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox','--no-zygote','--single-process','--disable-gpu']});
const page=await browser.newPage();const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
await page.clock.install({time: new Date('2026-09-25T12:00:00Z')});
let mode='normal', salesRequests=0, release;
await page.route('**/*',async route=>{
 const url=new URL(route.request().url()); const path=url.pathname;
 const json=data=>route.fulfill({json:data});
 if(path==='/api/etsy/me') return json({connected:true});
 if(path==='/api/etsy/shop') return json({shopName:'Browser fixture shop'});
 if(path==='/api/etsy/shop/catalog') return json({source:'ETSY',shopId:'22',shopName:'Browser fixture shop',listings:[{id:'1',title:'Fixture planner'}]});
 if(path==='/api/etsy/shop/sales') {
  salesRequests++;
  const captured=mode;
  if(captured==='delayed') await new Promise(resolve=>{release=resolve;});
  if(captured==='failure') return route.fulfill({status:503,json:{error:'ETSY_SALES_NOT_READY'}});
  return json({source:'ETSY_RECEIPTS',shopId:'22',metric:'PAID_UNITS',reportingPeriod:{startDate:url.searchParams.get('startDate'),endDate:url.searchParams.get('endDate'),timeZone:'UTC'},listings:[{id:'1',sales:captured==='refund'?null:captured==='delayed'?99:5,previousSales:captured==='refund'?null:2,trendPercent:captured==='refund'?null:150,needsReview:captured==='refund'}]});
 }
 if(path.startsWith('/api/')) return json({});
 if(url.hostname!=='lighthouse.test') return route.abort();
 const file=path==='/'?'/index.html':path;
 try {return route.fulfill({body:await readFile(new URL('.'+file,dist)),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});}catch{return route.abort();}
});
try{
 await page.goto('https://lighthouse.test/?etsy=connected');
 await page.getByRole('button',{name:'Import My Etsy Listings',exact:true}).click();
 await page.getByRole('checkbox',{name:'Fixture planner'}).check();
 await page.getByRole('button',{name:'Import selected products (1)',exact:true}).click();
 await page.getByText('Sales and available trends imported.',{exact:false}).waitFor();
 const inputs=page.locator('#listing-card-1 input[type=number]');
 assert.equal(await inputs.nth(0).inputValue(),''); assert.equal(await inputs.nth(1).inputValue(),'5');
 const build=page.getByRole('button',{name:'Build My Weekly Growth Plan',exact:true});
 assert.equal(await build.isDisabled(),true);
 await inputs.nth(0).fill('200');assert.equal(await build.isEnabled(),true);
 console.log('PASS: selected product imports sales, leaves views blank, validates plan button');
 release=undefined;mode='delayed';await page.getByRole('button',{name:'Refresh sales for these dates'}).click();
 await page.waitForFunction(()=>document.body.textContent.includes('Importing sales for your selected dates'));
 await inputs.nth(1).fill('9');await inputs.nth(2).fill('10');
 assert.ok(release);release();await page.getByText('Sales and available trends imported.',{exact:false}).waitFor();
 assert.equal(await inputs.nth(1).inputValue(),'9');assert.equal(await inputs.nth(2).inputValue(),'10');
 console.log('PASS: manual edits made during sales request survive');
 mode='failure';await page.getByRole('button',{name:'Refresh sales for these dates'}).click();
 await page.getByText('Automatic sales import is not available yet.',{exact:false}).waitFor();
 assert.equal(await inputs.nth(1).inputValue(),'9');assert.equal(await inputs.nth(0).inputValue(),'200');
 console.log('PASS: unavailable import preserves seller data and explains manual fallback');
 mode='normal';await page.getByLabel('End date (inclusive)').fill('2026-09-19');
 await page.getByText('Sales and available trends imported.',{exact:false}).waitFor();
 release=undefined;mode='delayed';await page.getByRole('button',{name:'Refresh sales for these dates'}).click();
 await page.waitForFunction(()=>document.body.textContent.includes('Importing sales for your selected dates'));
 const releaseStale=release;assert.ok(releaseStale);mode='normal';
 await page.getByLabel('End date (inclusive)').fill('2026-09-20');
 await page.getByText('Sales and available trends imported.',{exact:false}).waitFor();
 releaseStale();
 // Give the old response a chance to arrive after the new period was applied.
 await page.waitForTimeout(100);
 assert.equal(await inputs.nth(1).inputValue(),'5');
 console.log('PASS: stale response from previous dates cannot overwrite the new period');
 mode='refund';await page.getByLabel('End date (inclusive)').fill('2026-09-21');
 await page.getByText('Sales received.',{exact:false}).waitFor();
 assert.equal(await inputs.nth(0).inputValue(),'');assert.equal(await inputs.nth(1).inputValue(),'');assert.equal(await build.isDisabled(),true);
 console.log('PASS: changing dates clears old figures; refund ambiguity stays blank and blocks incomplete plan');
 assert.deepEqual(errors,[]);console.log('PASS: no React runtime errors. Sales requests: '+salesRequests);
}finally{await browser.close();}
