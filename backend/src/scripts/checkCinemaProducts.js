const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

/**
 * Proves a cinema can stock its own counter without reaching anyone else's.
 *
 * The catalogue is shared by every channel, so "let a cinema add Coke" is not a
 * simple write: it has to not collide with another cinema's Coke, not shadow the
 * platform's, not appear in anyone else's picker, and not be editable by them.
 * Each of those is a separate way to get it wrong.
 *
 * Runs against a SCRATCH DATABASE it creates and drops. MONGODB_URI is used only
 * for its host; the database name is replaced.
 *
 *   npm run check:cinema-products
 */

const SCRATCH_DB = "pazimo_products_check";

const baseUri = () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
  const [head, query] = uri.split("?");
  const schemeEnd = head.indexOf("://");
  if (schemeEnd === -1) throw new Error(`MONGODB_URI is not a connection string: ${head}`);
  const scheme = head.slice(0, schemeEnd + 3);
  const rest = head.slice(schemeEnd + 3);
  const slash = rest.indexOf("/");
  const hosts = slash === -1 ? rest : rest.slice(0, slash);
  return `${scheme}${hosts}/${SCRATCH_DB}${query ? `?${query}` : ""}`;
};

const m = mongoose;
const Beverage = require("../models/Beverage");
const Cinema = require("../models/Cinema");
const ctrl = require("../controllers/cinemaBeverageController");

let pass=0,fail=0;
const check=(l,c,e='')=>{c?(pass++,console.log('  ok   '+l)):(fail++,console.log('  FAIL '+l+(e?' -> '+e:'')));};
const call=async(fn,req)=>{let out={};const res={status(c){out.code=c;return this;},json(b){out.body=b;return this;}};await fn(req,res);return out;};

(async()=>{
  await m.connect(baseUri(), { serverSelectionTimeoutMS: 8000 });
  console.log(`\nScratch database: ${m.connection.name}`); await m.connection.dropDatabase();
  await Beverage.syncIndexes();

  const a=await Cinema.create({name:'Cinema A',account:new m.Types.ObjectId(),city:'Addis',address:'x',phoneNumber:'09',beverageEligibility:'eligible'});
  const b=await Cinema.create({name:'Cinema B',account:new m.Types.ObjectId(),city:'Addis',address:'y',phoneNumber:'09',beverageEligibility:'eligible'});
  // The platform catalogue.
  await Beverage.create({name:'Heineken',category:'drink',ownerCinema:null});

  const reqFor=(cinema,body,params={})=>({cinema,params,body,query:{},user:{userId:String(cinema.account),role:"cinema"},file:null});

  console.log('\n--- a cinema adds its own products ---');
  let r=await call(ctrl.createOwnProduct, reqFor(a,{name:'Coke',category:'drink'}));
  check('Cinema A can add Coke', r.body?.success===true, JSON.stringify(r.body?.message));
  const cokeA=r.body?.data;
  r=await call(ctrl.createOwnProduct, reqFor(a,{name:'Popcorn',category:'snack'}));
  check('Cinema A can add Popcorn', r.body?.success===true);

  console.log('\n--- the old global unique name no longer blocks another cinema ---');
  r=await call(ctrl.createOwnProduct, reqFor(b,{name:'Coke',category:'drink'}));
  check('Cinema B can also add its own Coke', r.body?.success===true, JSON.stringify(r.body?.message));

  console.log('\n--- but duplicates within one catalogue are refused ---');
  r=await call(ctrl.createOwnProduct, reqFor(a,{name:'coke',category:'drink'}));
  check('Cinema A cannot add "coke" twice (case-insensitive)', r.body?.success===false && /already have/.test(r.body.message||''), r.body?.message);
  r=await call(ctrl.createOwnProduct, reqFor(a,{name:'Heineken',category:'drink'}));
  check('cannot shadow a platform product', r.body?.success===false && /platform catalogue/.test(r.body.message||''), r.body?.message);

  console.log('\n--- what each cinema can see ---');
  const catA=await call(ctrl.listSellableCatalog, reqFor(a,{},{}));
  const namesA=(catA.body?.data||[]).map(x=>x.name).sort();
  check('Cinema A sees platform + its own: '+namesA.join(','), namesA.join(',')==='Coke,Heineken,Popcorn');
  const catB=await call(ctrl.listSellableCatalog, reqFor(b,{},{}));
  const namesB=(catB.body?.data||[]).map(x=>x.name).sort();
  check('Cinema B sees platform + its own only: '+namesB.join(','), namesB.join(',')==='Coke,Heineken');
  check('own products are flagged isOwn', (catA.body.data.find(x=>x.name==='Popcorn')||{}).isOwn===true);
  check('platform products are not', (catA.body.data.find(x=>x.name==='Heineken')||{}).isOwn===false);

  console.log('\n--- ownership is enforced on write ---');
  r=await call(ctrl.updateOwnProduct, reqFor(b,{name:'Stolen'},{productId:String(cokeA._id)}));
  check('Cinema B cannot edit another cinema’s product', r.body?.success===false && /not one you added/.test(r.body.message||''), r.body?.message);
  const heineken=await Beverage.findOne({name:'Heineken'});
  r=await call(ctrl.updateOwnProduct, reqFor(a,{name:'Hijacked'},{productId:String(heineken._id)}));
  check('a cinema cannot edit a PLATFORM product', r.body?.success===false && /not one you added/.test(r.body.message||''), r.body?.message);

  console.log('\n--- editing and removing your own ---');
  r=await call(ctrl.updateOwnProduct, reqFor(a,{name:'Coca-Cola'},{productId:String(cokeA._id)}));
  check('Cinema A can rename its own product', r.body?.success===true && r.body.data.name==='Coca-Cola', JSON.stringify(r.body?.message));
  r=await call(ctrl.removeOwnProduct, reqFor(a,{},{productId:String(cokeA._id)}));
  check('and remove one that never sold', r.body?.success===true, JSON.stringify(r.body?.message));
  check('it is really gone', (await Beverage.countDocuments({_id:cokeA._id}))===0);

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await m.connection.dropDatabase(); await m.disconnect();
  process.exit(fail?1:0);
})().catch(async (e) => {
  console.error("\ncheckCinemaProducts crashed:", e);
  await m.connection.dropDatabase().catch(() => {});
  await m.disconnect().catch(() => {});
  process.exit(1);
});
