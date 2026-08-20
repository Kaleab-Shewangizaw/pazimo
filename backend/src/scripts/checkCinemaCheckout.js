const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

/**
 * Proves the cinema checkout charges the right amount and delivers what was
 * paid for.
 *
 * Money and seats, end to end: server-side pricing that ignores anything the
 * client claims a thing costs, seats locked while payment runs, settlement that
 * issues one ticket per seat with its own scannable id, and a webhook that can
 * fire twice without selling anything twice.
 *
 * Runs against a SCRATCH DATABASE it creates and drops, never the app's own, so
 * it is safe to run anywhere and needs no fixtures. MONGODB_URI is used only for
 * its host; the database name is replaced.
 *
 *   npm run check:cinema-checkout
 *
 * Exits 0 when every check passes, 1 otherwise.
 */

const SCRATCH_DB = "pazimo_checkout_check";

const baseUri = () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
  // Swap the database name, keeping scheme, credentials, hosts and options — a
  // check that wrote into the real database would be worse than no check. See
  // checkSeatSelection.js for why this is parsed rather than regexed.
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
const CinemaHall=require("../models/CinemaHall");
const CinemaShowtime=require("../models/CinemaShowtime");
const CinemaMovie=require("../models/CinemaMovie");
const CinemaSeatHold=require("../models/CinemaSeatHold");
const CinemaTicket=require("../models/CinemaTicket");
const CinemaBeverage=require("../models/CinemaBeverage");
const Beverage=require("../models/Beverage");
const Cinema=require("../models/Cinema");
const checkout=require("../services/cinemaCheckoutService");
const settle=require("../services/cinemaSettlementService");
const seats=require("../services/cinemaSeatService");

let pass=0,fail=0;
const check=(l,c,e='')=>{ if(c){pass++;console.log('  ok   '+l);} else {fail++;console.log('  FAIL '+l+(e?'  -> '+e:''));} };

(async()=>{
  await m.connect(baseUri(), { serverSelectionTimeoutMS: 8000 });
  console.log(`\nScratch database: ${m.connection.name}`); await m.connection.dropDatabase();
  await CinemaSeatHold.syncIndexes();

  const cinema=await Cinema.create({name:'Test Cinema',account:new m.Types.ObjectId(),
    city:'Addis',address:'x',phoneNumber:'0900',beverageEligibility:'eligible'});
  const hall=await CinemaHall.create({cinema:cinema._id,name:'Screen 1',capacity:1,
    hasAssignedSeating:true,
    seatCategories:[{key:'standard',label:'Standard'},{key:'vip',label:'VIP'}],
    seatMap:{rows:[
      {label:'A',curve:20,seats:[{number:'1',categoryKey:'standard'},{number:'2',categoryKey:'standard'},{number:'3',categoryKey:'standard'}]},
      {label:'K',curve:0,seats:[{number:'1',categoryKey:'vip'},{number:'2',categoryKey:'vip'}]}]}});
  const movie=await CinemaMovie.create({cinema:cinema._id,title:'Dune',durationMinutes:120,publicationStatus:'published'});
  const st=await CinemaShowtime.create({cinema:cinema._id,movie:movie._id,hall:hall._id,
    startsAt:new Date(Date.now()+86400000),
    ticketTypes:[{name:'Standard',price:220,allocation:0,seatCategoryKey:'standard'},
                 {name:'VIP',price:400,allocation:0,seatCategoryKey:'vip'}]});

  const bev=await Beverage.create({name:'Popcorn',category:'snack',isActive:true});
  const soda=await Beverage.create({name:'Soda',category:'drink',isActive:true});
  const pop=await CinemaBeverage.create({cinema:cinema._id,beverage:bev._id,price:80,stockTotal:10});
  const fizz=await CinemaBeverage.create({cinema:cinema._id,beverage:soda._id,price:50,unlimitedStock:true});

  console.log('\n--- server-side pricing ---');
  const basket=await checkout.priceBasket({showtimeId:st._id,seatKeys:['A-1','K-1'],
    concessions:[{cinemaBeverage:String(pop._id),quantity:2},{cinemaBeverage:String(fizz._id),quantity:3}]});
  check('seat category sets the price (220 + 400)', basket.ticketTotal===620, basket.ticketTotal);
  check('snacks priced from the line-up (2x80 + 3x50)', basket.concessionTotal===310, basket.concessionTotal);
  check('total = 930', basket.total===930, basket.total);
  check('VIP seat resolved to the VIP tier', basket.tickets.find(t=>t.seatKey==='K-1').ticketType==='VIP');

  console.log('\n--- the client cannot set the price ---');
  const tampered=await checkout.priceBasket({showtimeId:st._id,seatKeys:['K-1'],
    concessions:[{cinemaBeverage:String(pop._id),quantity:1,unitPrice:1,price:1}]});
  check('a price in the request body is ignored', tampered.total===480, tampered.total);

  console.log('\n--- unlimited stock ---');
  const many=await checkout.priceBasket({showtimeId:st._id,seatKeys:['A-1'],
    concessions:[{cinemaBeverage:String(fizz._id),quantity:20}]});
  check('unlimited line prices 20 with no stock ceiling', many.concessionTotal===1000, many.concessionTotal);
  let err=null; try{ await checkout.priceBasket({showtimeId:st._id,seatKeys:['A-1'],
    concessions:[{cinemaBeverage:String(pop._id),quantity:11}]}); }catch(e){err=e;}
  check('counted line still refuses over-ordering', !!err && /Only 10 left/.test(err.message), err&&err.message);

  console.log('\n--- startCheckout locks the seats ---');
  const order=await checkout.startCheckout({showtimeId:st._id,seatKeys:['A-1','K-1'],
    concessions:[{cinemaBeverage:String(pop._id),quantity:2}],reference:'order-1'});
  check('seats held under the order reference', await CinemaSeatHold.countDocuments({reference:'order-1',status:'held'})===2);
  check('hold expiry surfaced for a countdown', !!order.expiresAt);
  err=null; try{ await checkout.startCheckout({showtimeId:st._id,seatKeys:['A-1'],reference:'order-2'}); }catch(e){err=e;}
  check('a second buyer cannot start on a held seat', !!err && /just took/.test(err.message), err&&err.message);

  console.log('\n--- settlement ---');
  const result=await settle.settleCinemaOrder({order,reference:'order-1',
    customerName:'Test Buyer',customerPhone:'0911',customerEmail:'t@x.com'});
  check('two tickets issued, one per seat', result.tickets.length===2, result.tickets.length);
  check('no failures', result.failedTickets.length===0 && result.failedConcessions.length===0,
        JSON.stringify([result.failedTickets,result.failedConcessions]));
  check('one concession sale recorded', result.concessions.length===1);
  const vipTicket=result.tickets.find(t=>t.seat?.seatKey==='K-1');
  check('ticket carries the seat snapshot', vipTicket && vipTicket.seat.row==='K' && vipTicket.seat.categoryLabel==='VIP',
        JSON.stringify(vipTicket&&vipTicket.seat));
  check('ticket charged the VIP price', vipTicket && vipTicket.totalAmount===400, vipTicket&&vipTicket.totalAmount);
  check('every ticket has a scannable id', result.tickets.every(t=>!!t.ticketId));
  check('holds became sold', await CinemaSeatHold.countDocuments({reference:'order-1',status:'sold'})===2);

  console.log('\n--- idempotence: the webhook fires twice ---');
  const again=await settle.settleCinemaOrder({order,reference:'order-1',customerName:'Test Buyer'});
  check('second settlement issues nothing new', again.alreadySettled===true && again.tickets.length===2);
  check('still only 2 tickets in the database', await CinemaTicket.countDocuments({paymentReference:'order-1'})===2);
  check('popcorn stock decremented once, not twice', (await CinemaBeverage.findById(pop._id)).sold===2,
        (await CinemaBeverage.findById(pop._id)).sold);

  console.log('\n--- a sold seat is gone for good ---');
  err=null; try{ await checkout.startCheckout({showtimeId:st._id,seatKeys:['K-1'],reference:'order-3'}); }catch(e){err=e;}
  check('K-1 cannot be bought again', !!err && /just took/.test(err.message), err&&err.message);

  console.log('\n--- assigned hall refuses a seatless sale ---');
  const ticketSvc=require("../services/cinemaTicketService");
  err=null;
  try{ await ticketSvc.issueTicket({showtimeId:st._id,ticketTypeId:String(st.ticketTypes[0]._id),
    quantity:1,customerName:'walkin',channel:'box_office',paymentStatus:'completed',
    cinemaId:cinema._id,requirePublished:false}); }catch(e){err=e;}
  check('box office must name a seat on an assigned hall', !!err && /seat must be chosen/.test(err.message), err&&err.message);

  console.log('\n--- box office CAN sell a named seat ---');
  err=null; let walkin=null;
  try{ walkin=await ticketSvc.issueTicket({showtimeId:st._id,ticketTypeId:String(st.ticketTypes[0]._id),
    quantity:1,customerName:'walkin',channel:'box_office',paymentStatus:'completed',
    cinemaId:cinema._id,requirePublished:false,
    seat:{seatKey:'A-2',row:'A',number:'2',categoryKey:'standard',categoryLabel:'Standard'}}); }catch(e){err=e;}
  check('counter sale of seat A-2 succeeds', !err && !!walkin, err&&err.message);
  check('A-2 now locked against the online picker', await CinemaSeatHold.countDocuments({seatKey:'A-2',status:'sold'})===1);

  const map=await seats.getSeatMapForShowtime(st._id);
  const flat=map.rows.flatMap(r=>r.seats);
  const st2=flat.reduce((a,s)=>{a[s.status]=(a[s.status]||0)+1;return a;},{});
  check('picker shows 3 sold, 2 available: '+JSON.stringify(st2), st2.sold===3 && st2.available===2);

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await m.connection.dropDatabase(); await m.disconnect();
  process.exit(fail?1:0);
})().catch(async (e) => {
  console.error("\ncheckCinemaCheckout crashed:", e);
  await m.connection.dropDatabase().catch(() => {});
  await m.disconnect().catch(() => {});
  process.exit(1);
});
