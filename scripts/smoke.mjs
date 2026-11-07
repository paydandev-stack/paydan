import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE_URL||'http://localhost:3107';
const origin=new URL(base).origin;
let checks=0;
for(const path of ['/','/login','/register','/dashboard','/track-order','/admin/login']){const response=await fetch(base+path);assert.equal(response.status,200,path);const html=await response.text();assert(!html.includes('ada.okafor@example.com'),path+' must not expose fixtures');checks++;}
const snapshot=await fetch(base+'/api/store').then(r=>r.json());
function privateField(value){if(!value||typeof value!=='object')return false;if(Array.isArray(value))return value.some(privateField);return Object.entries(value).some(([key,value])=>['price','compareAt','costPrice','vendorId'].includes(key)||privateField(value));}
assert.equal(privateField(snapshot.products),false);assert.equal(snapshot.orders.length,0);assert.equal(snapshot.customers.length,0);assert.equal(snapshot.vendors.length,0);checks++;
for(const path of ['/api/commands','/api/checkout','/api/media','/api/support']){const response=await fetch(base+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({name:'signInAdmin',role:'Super Admin',userId:'c-1'})});assert.equal(response.status,401,path+' requires an actual session');checks++;}
const webhook=await fetch(base+'/api/paystack/webhook',{method:'POST',body:JSON.stringify({event:'charge.success',data:{reference:'fake'}})});assert.equal(webhook.status,401);checks++;
console.log(`${checks} HTTP smoke checks passed. No credentials, payment or external account was used.`);
