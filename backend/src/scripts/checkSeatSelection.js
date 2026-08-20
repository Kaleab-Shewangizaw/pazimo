const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

/**
 * Proves seat selection holds under contention.
 *
 * Seat selection has exactly one hard problem: two people clicking the same
 * chair at the same instant must not both get it, and a hold must not outlive a
 * checkout that was abandoned. Everything else about assigned seating is
 * presentation. This exercises that problem directly — three concurrent buyers
 * racing for one seat, partial-claim rollback, gaps and blocked seats, expiry,
 * and the indexes the guarantee actually rests on.
 *
 * Runs against a SCRATCH DATABASE it creates and drops, never the app's own, so
 * it is safe to run anywhere and needs no fixtures. MONGODB_URI is used only for
 * its host; the database name is replaced.
 *
 *   npm run check:seats
 *
 * Exits 0 when every check passes, 1 otherwise.
 */

const SCRATCH_DB = "pazimo_seat_check";

const baseUri = () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";

  // Swap the database name, keeping scheme, credentials, hosts and options. A
  // check that wrote into the real database would be worse than no check.
  //
  // Parsed by hand rather than with a regex over the whole string: a connection
  // string's database is the segment after the FIRST slash that follows the
  // host list, and a naive "last path segment" pattern happily eats the host
  // when the URI has no database on it at all (mongodb://localhost:27017).
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
const CinemaHall = require("../models/CinemaHall");
const CinemaShowtime = require("../models/CinemaShowtime");
const CinemaMovie = require("../models/CinemaMovie");
const CinemaSeatHold = require("../models/CinemaSeatHold");
const seats = require("../services/cinemaSeatService");

let pass=0, fail=0;
const check=(label, cond, extra='')=>{ if(cond){pass++; console.log('  ok   '+label);} else {fail++; console.log('  FAIL '+label+(extra?'  -> '+extra:''));} };

// Build a room: 3 rows, an aisle down the middle of row B, a blocked house seat,
// a short VIP back row that is offset and curved.
const buildRows = () => ([
  { label:'A', curve:30, offset:0, seats:[
      {number:'1',categoryKey:'floor'},{number:'2',categoryKey:'floor'},
      {number:'3',categoryKey:'floor'},{number:'4',categoryKey:'floor'} ] },
  { label:'B', curve:15, offset:0, seats:[
      {number:'1',categoryKey:'standard'},{number:'2',categoryKey:'standard'},
      {number:'X',categoryKey:'standard',exists:false},          // aisle
      {number:'3',categoryKey:'standard'},
      {number:'4',categoryKey:'standard',blocked:true} ] },      // house seat
  { label:'K', curve:0, offset:20, seats:[
      {number:'1',categoryKey:'vip'},{number:'2',categoryKey:'vip'} ] },
]);

(async()=>{
  await m.connect(baseUri(), { serverSelectionTimeoutMS: 8000 });
  console.log(`\nScratch database: ${m.connection.name}`);
  await m.connection.dropDatabase();
  await CinemaSeatHold.syncIndexes();          // the unique + TTL indexes

  const cinemaId=new m.Types.ObjectId();

  console.log('\n--- seat map validation ---');
  // capacity is deliberately wrong on input; the map should win.
  const hall = new CinemaHall({ cinema:cinemaId, name:'Screen 1', capacity:999,
    hasAssignedSeating:true,
    seatCategories:[{key:'floor',label:'Floor'},{key:'standard',label:'Standard'},{key:'vip',label:'VIP'}],
    seatMap:{ rows: buildRows() } });
  await hall.save();
  check('capacity derived from the map, not the input', hall.capacity===9, 'got '+hall.capacity);
  const counts=hall.seatCountsByCategory();
  check('floor=4 standard=3 vip=2', counts.get('floor')===4&&counts.get('standard')===3&&counts.get('vip')===2,
        JSON.stringify([...counts]));
  check('gap and blocked seat excluded from sellable', hall.sellableSeats().length===9);

  // unknown category must be refused
  const bad=new CinemaHall({cinema:cinemaId,name:'Bad',capacity:1,hasAssignedSeating:true,
    seatCategories:[{key:'standard',label:'Standard'}],
    seatMap:{rows:[{label:'A',seats:[{number:'1',categoryKey:'nope'}]}]}});
  let err=null; try{ await bad.save(); }catch(e){ err=e; }
  check('seat in an undefined category is refused', !!err && /does not define/.test(err.message), err&&err.message);

  // duplicate row label
  const dup=new CinemaHall({cinema:cinemaId,name:'Dup',capacity:1,hasAssignedSeating:true,
    seatCategories:[{key:'s',label:'S'}],
    seatMap:{rows:[{label:'A',seats:[{number:'1',categoryKey:'s'}]},{label:'A',seats:[{number:'2',categoryKey:'s'}]}]}});
  err=null; try{ await dup.save(); }catch(e){ err=e; }
  check('duplicate row label is refused', !!err && /both labelled/.test(err.message), err&&err.message);

  // assigned seating with no map
  const nomap=new CinemaHall({cinema:cinemaId,name:'NoMap',capacity:10,hasAssignedSeating:true});
  err=null; try{ await nomap.save(); }catch(e){ err=e; }
  check('assigned seating with no map is refused', !!err && /needs a seat map/.test(err.message), err&&err.message);

  // a hall WITHOUT assigned seating still works exactly as before
  const legacy=new CinemaHall({cinema:cinemaId,name:'Legacy',capacity:200});
  err=null; try{ await legacy.save(); }catch(e){ err=e; }
  check('unassigned hall still saves on capacity alone', !err && legacy.capacity===200, err&&err.message);

  console.log('\n--- showtime allocation derived from the map ---');
  const movie=await CinemaMovie.create({cinema:cinemaId,title:'Test Film',durationMinutes:100,publicationStatus:'published'});
  const st=new CinemaShowtime({cinema:cinemaId,movie:movie._id,hall:hall._id,
    startsAt:new Date(Date.now()+86400000),
    ticketTypes:[
      {name:'Floor',price:150,allocation:999,seatCategoryKey:'floor'},
      {name:'Standard',price:220,allocation:1,seatCategoryKey:'standard'},
      {name:'VIP',price:400,allocation:0,seatCategoryKey:'vip'} ]});
  await st.save();
  const alloc=Object.fromEntries(st.ticketTypes.map(t=>[t.seatCategoryKey,t.allocation]));
  check('allocation overwritten from the seat map', alloc.floor===4&&alloc.standard===3&&alloc.vip===2, JSON.stringify(alloc));

  const missing=new CinemaShowtime({cinema:cinemaId,movie:movie._id,hall:hall._id,
    startsAt:new Date(Date.now()+90000000),
    ticketTypes:[{name:'Floor',price:150,allocation:4,seatCategoryKey:'floor'}]});
  err=null; try{ await missing.save(); }catch(e){ err=e; }
  check('a category with no price is refused', !!err && /no tier prices them/.test(err.message), err&&err.message);

  console.log('\n--- the lock: concurrent claims on the same seat ---');
  const results=await Promise.allSettled([
    seats.holdSeats({showtimeId:st._id,seatKeys:['K-1'],reference:'buyer-1'}),
    seats.holdSeats({showtimeId:st._id,seatKeys:['K-1'],reference:'buyer-2'}),
    seats.holdSeats({showtimeId:st._id,seatKeys:['K-1'],reference:'buyer-3'}),
  ]);
  const won=results.filter(r=>r.status==='fulfilled').length;
  check('exactly one of three concurrent buyers gets K-1', won===1, won+' succeeded');
  check('losers are told the seat went', results.filter(r=>r.status==='rejected')
        .every(r=>/just took|cannot be booked/.test(r.reason.message)));

  console.log('\n--- all-or-nothing ---');
  err=null;
  try{ await seats.holdSeats({showtimeId:st._id,seatKeys:['A-1','A-2','K-1'],reference:'party'}); }catch(e){ err=e; }
  check('a party that clashes on one seat gets none', !!err);
  const stray=await CinemaSeatHold.countDocuments({reference:'party'});
  check('no partial holds left behind', stray===0, stray+' left');

  console.log('\n--- gaps and blocked seats cannot be booked ---');
  for (const [key,label] of [['B-X','aisle'],['B-4','blocked house seat'],['Z-9','nonexistent']]) {
    err=null; try{ await seats.holdSeats({showtimeId:st._id,seatKeys:[key],reference:'probe'}); }catch(e){ err=e; }
    check(`${label} (${key}) refused`, !!err && /cannot be booked/.test(err.message), err&&err.message);
  }

  console.log('\n--- picker view ---');
  const map=await seats.getSeatMapForShowtime(st._id);
  const flat=map.rows.flatMap(r=>r.seats);
  const byStatus=flat.reduce((a,s)=>{a[s.status]=(a[s.status]||0)+1;return a;},{});
  check('picker reports every seat incl. gap and blocked', flat.length===11, flat.length+' seats');
  check('statuses: '+JSON.stringify(byStatus), byStatus.gap===1&&byStatus.blocked===1&&byStatus.held===1&&byStatus.available===8);
  const vip=map.categories.find(c=>c.key==='vip');
  check('category carries its price from the showtime', vip&&vip.price===400, JSON.stringify(vip));
  check('row curve and offset preserved', map.rows[0].curve===30 && map.rows[2].offset===20);

  console.log('\n--- release and confirm ---');
  const before=await CinemaSeatHold.countDocuments({showtime:st._id});
  const winner=results.find(r=>r.status==='fulfilled').value;
  await seats.releaseHolds(winner.reference);
  check('releasing a held reference frees the seat', await CinemaSeatHold.countDocuments({reference:winner.reference})===0);

  const h=await seats.holdSeats({showtimeId:st._id,seatKeys:['K-1','K-2'],reference:'paid-order'});
  const ticketId=new m.Types.ObjectId();
  const c1=await seats.confirmHold({reference:'paid-order',seatKey:'K-1',ticketId});
  check('confirm marks the seat sold and clears expiry', c1 && c1.status==='sold' && c1.expiresAt===null);
  const c2=await seats.confirmHold({reference:'paid-order',seatKey:'K-1',ticketId});
  check('confirming twice is a no-op (webhook fires twice)', c2===null);
  const freed=await seats.releaseHolds('paid-order');
  check('release skips the sold seat, frees only the held one', freed===1, freed+' freed');
  check('sold seat survives a release', await CinemaSeatHold.countDocuments({seatKey:'K-1',status:'sold'})===1);

  console.log('\n--- a sold seat still blocks a new buyer ---');
  err=null; try{ await seats.holdSeats({showtimeId:st._id,seatKeys:['K-1'],reference:'latecomer'}); }catch(e){ err=e; }
  check('K-1 cannot be re-sold', !!err && /just took/.test(err.message), err&&err.message);

  console.log('\n--- TTL index is actually configured ---');
  const idx=await CinemaSeatHold.collection.indexes();
  const ttl=idx.find(i=>i.expireAfterSeconds!==undefined);
  check('TTL index on expiresAt with expireAfterSeconds 0', !!ttl && ttl.expireAfterSeconds===0 && ttl.key.expiresAt===1, JSON.stringify(ttl));
  const uniq=idx.find(i=>i.unique && i.key.showtime===1 && i.key.seatKey===1);
  check('unique index on (showtime, seatKey)', !!uniq);

  console.log('\n--- an expired hold does not block, even before the reaper runs ---');
  await CinemaSeatHold.create({showtime:st._id,cinema:cinemaId,seatKey:'A-4',row:'A',number:'4',
    categoryKey:'floor',status:'held',expiresAt:new Date(Date.now()-60000),reference:'stale'});
  const map2=await seats.getSeatMapForShowtime(st._id);
  const a4=map2.rows.find(r=>r.label==='A').seats.find(s=>s.number==='4');
  check('an expired hold reads as available', a4.status==='available', a4.status);

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await m.connection.dropDatabase();
  await m.disconnect();
  process.exit(fail?1:0);
})().catch(async (e) => {
  console.error("\ncheckSeatSelection crashed:", e);
  await m.connection.dropDatabase().catch(() => {});
  await m.disconnect().catch(() => {});
  process.exit(1);
});
