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
const Beverage=require("../models/ConcessionProduct");
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
    customerName:'Test Buyer',customerPhone:'+14155550100',customerEmail:''});
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


  // ---------------------------------------------------------------------
  // A hall that gains a seat map when screenings are ALREADY booked into it.
  //
  // The real-world upgrade path, and the one that silently breaks: those
  // screenings price a NUMBER OF SEATS, not a seat CATEGORY, so every seat in
  // the picker refuses to be added until they are re-saved. What matters is
  // that it fails loudly and is repairable, not that it cannot happen.
  // ---------------------------------------------------------------------
  const legacyCinemaId = new m.Types.ObjectId();
  console.log('\n--- a hall that sells by capacity, with screenings already booked ---');
  const legacyHall=await CinemaHall.create({cinema:legacyCinemaId,name:'Legacy Screen',capacity:96});
  const legacyMovie=await CinemaMovie.create({cinema:legacyCinemaId,title:'Old Film',durationMinutes:100,publicationStatus:'published'});
  const legacySt=await CinemaShowtime.create({cinema:legacyCinemaId,movie:legacyMovie._id,hall:legacyHall._id,
    startsAt:new Date(Date.now()+86400000),
    ticketTypes:[{name:'Regular',price:200,allocation:70},{name:'VIP',price:400,allocation:26}]});
  check('showtime created the old way', legacySt.ticketTypes[0].allocation===70);

  console.log('\n--- the cinema now adds a seat map to that hall ---');
  legacyHall.hasAssignedSeating=true;
  legacyHall.seatCategories=[{key:'standard',label:'Standard'},{key:'vip',label:'VIP'}];
  legacyHall.seatMap={rows:[
    {label:'A',curve:20,seats:Array.from({length:12},(_,i)=>({number:String(i+1),categoryKey:'standard'}))},
    {label:'B',curve:10,seats:Array.from({length:12},(_,i)=>({number:String(i+1),categoryKey:'vip'}))}]};
  await legacyHall.save();
  check('capacity re-derived from the map', legacyHall.capacity===24, legacyHall.capacity);

  console.log('\n--- the existing screening is now un-bookable, and says why ---');
  const legacyMap=await seats.getSeatMapForShowtime(legacySt._id);
  check('seat map flags needsRepricing', legacyMap.needsRepricing===true);
  check('no category carries a price', legacyMap.categories.every(c=>c.price===undefined));
  err=null;
  try{ await checkout.priceBasket({showtimeId:legacySt._id,seatKeys:['A-1']}); }catch(e){err=e;}
  check('pricing fails with an actionable message', !!err && /scheduled before the hall had a seat map/.test(err.message), err&&err.message);

  console.log('\n--- the cinema re-prices per category, WITH a ticket already sold ---');
  // A prior sale on the Regular tier, written with updateOne so it does not
  // trip the validation this test is about to exercise deliberately.
  await CinemaShowtime.updateOne(
    { _id: legacySt._id, 'ticketTypes._id': legacySt.ticketTypes[0]._id },
    { $set: { 'ticketTypes.$.sold': 3 } }
  );
  const fresh=await CinemaShowtime.findById(legacySt._id);
  check('the prior sale is recorded', fresh.ticketTypes[0].sold===3);
  fresh.ticketTypes = [
    { _id: fresh.ticketTypes[0]._id, name:'Standard', price:220, allocation:0, seatCategoryKey:'standard', sold:3 },
    { _id: fresh.ticketTypes[1]._id, name:'VIP', price:450, allocation:0, seatCategoryKey:'vip', sold:0 },
  ];
  err=null; try{ await fresh.save(); }catch(e){err=e;}
  check('re-pricing a screening that has sales is allowed', !err, err&&err.message);
  const alloc=Object.fromEntries(fresh.ticketTypes.map(t=>[t.seatCategoryKey,t.allocation]));
  check('allocations now derived from the map', alloc.standard===12&&alloc.vip===12, JSON.stringify(alloc));

  console.log('\n--- and it becomes bookable ---');
  const legacyMap2=await seats.getSeatMapForShowtime(legacySt._id);
  check('needsRepricing cleared', legacyMap2.needsRepricing===false);
  const legacyBasket=await checkout.priceBasket({showtimeId:legacySt._id,seatKeys:['A-1','B-1']});
  check('a standard + a VIP seat price correctly (220 + 450)', legacyBasket.total===670, legacyBasket.total);

  console.log('\n--- refund releases BOTH locks ---');
  const ticketSvc2 = require("../services/cinemaTicketService");
  const soldTicket = result.tickets.find((t) => t.seat?.seatKey === 'K-1');
  const beforeTier = (await CinemaShowtime.findById(st._id)).ticketTypes
    .find((t) => t.seatCategoryKey === 'vip').sold;
  await ticketSvc2.refundTicket(soldTicket._id, { reason: 'test refund' });
  const afterTier = (await CinemaShowtime.findById(st._id)).ticketTypes
    .find((t) => t.seatCategoryKey === 'vip').sold;
  check('refund returns the tier counter', afterTier === beforeTier - 1, `${beforeTier} -> ${afterTier}`);
  check('refund releases the seat lock too',
    (await CinemaSeatHold.countDocuments({ showtime: st._id, seatKey: 'K-1' })) === 0);

  // The point of the pair: the freed chair has to be genuinely re-sellable.
  // Returning only the tier counter leaves the picker refusing a seat the tier
  // says is free, which is worse than not refunding at all.
  let resold = null, resoldErr = null;
  try {
    resold = await checkout.startCheckout({ showtimeId: st._id, seatKeys: ['K-1'], reference: 'after-refund' });
  } catch (e) { resoldErr = e; }
  check('the refunded seat can be booked again', !!resold && !resoldErr, resoldErr && resoldErr.message);

  console.log('\n--- collecting pre-bought snacks at the counter ---');
  const bevSvc = require("../services/cinemaBeverageSalesService");
  const CinemaBeverageSale = require("../models/CinemaBeverageSale");

  // A fresh paid order carrying popcorn.
  const order2 = await checkout.startCheckout({ showtimeId: st._id, seatKeys: ['A-3'],
    concessions: [{ cinemaBeverage: String(pop._id), quantity: 2 }], reference: 'collect-me' });
  await settle.settleCinemaOrder({ order: order2, reference: 'collect-me', customerName: 'Snacker' });

  let owed = await bevSvc.listOutstandingForOrder({ paymentReference: 'collect-me', cinemaId: cinema._id });
  check('the order shows one item owed at the counter', owed.length === 1 && owed[0].quantity === 2,
    JSON.stringify(owed.map(o => ({ n: o.beverageName, q: o.quantity }))));

  // Two tills scanning the same order at once must hand it over ONCE.
  const saleId = (await CinemaBeverageSale.findOne({ paymentReference: 'collect-me' }))._id;
  const both = await Promise.allSettled([
    bevSvc.redeemSale({ saleId, cinemaId: cinema._id }),
    bevSvc.redeemSale({ saleId, cinemaId: cinema._id }),
  ]);
  const handedOver = both.filter(r => r.status === 'fulfilled').length;
  check('two tills collecting at once hand it over exactly once', handedOver === 1, handedOver + ' succeeded');
  check('the loser is told when it was collected',
    both.some(r => r.status === 'rejected' && /Already collected/.test(r.reason.message)),
    JSON.stringify(both.filter(r=>r.status==='rejected').map(r=>r.reason.message)));

  owed = await bevSvc.listOutstandingForOrder({ paymentReference: 'collect-me', cinemaId: cinema._id });
  check('nothing outstanding once collected', owed.length === 0);

  // A counter sale was handed over as it was rung up; it must never appear owed.
  await bevSvc.recordSale({ cinemaBeverageId: pop._id, quantity: 1, channel: 'manual',
    paymentReference: 'walk-up', cinemaId: cinema._id });
  const counterOwed = await bevSvc.listOutstandingForOrder({ paymentReference: 'walk-up', cinemaId: cinema._id });
  check('a counter sale is never owed at collection', counterOwed.length === 0);

  // Another cinema must not be able to collect against this one's sale.
  let crossErr = null;
  try {
    await bevSvc.redeemSale({ saleId, cinemaId: new m.Types.ObjectId() });
  } catch (e) { crossErr = e; }
  check('another cinema cannot collect this order', !!crossErr && /not on this order/.test(crossErr.message),
    crossErr && crossErr.message);

  console.log('\n--- cancelling releases the seats immediately ---');
  const Payment = require("../models/Payment");
  const { cancelCheckout } = require("../controllers/cinemaCheckoutController");

  const cancelRef = 'cancel-me';
  const cancelOrder = await checkout.startCheckout({
    showtimeId: st._id, seatKeys: ['K-2'], reference: cancelRef });
  await Payment.create({ transactionId: cancelRef, status: 'PENDING', salesContext: 'CINEMA',
    provider: 'chapa', price: cancelOrder.total, currency: cancelOrder.currency });
  check('seat is held while paying',
    (await CinemaSeatHold.countDocuments({ reference: cancelRef, status: 'held' })) === 1);

  const res = { _c: 200, status(c) { this._c = c; return this; }, json(b) { this.body = b; return this; } };
  await cancelCheckout({ params: { transactionId: cancelRef } }, res);
  check('cancel succeeds', res.body?.success === true, JSON.stringify(res.body));
  check('the seat is free again, without waiting for the hold to expire',
    (await CinemaSeatHold.countDocuments({ reference: cancelRef })) === 0);
  check('the order is marked cancelled',
    (await Payment.findOne({ transactionId: cancelRef })).status === 'CANCELLED');

  // The same seat must be immediately bookable by the next customer.
  let rebook = null;
  try { rebook = await checkout.startCheckout({ showtimeId: st._id, seatKeys: ['K-2'], reference: 'next-buyer' }); } catch (e) { rebook = null; }
  check('the next customer can take that seat right away', !!rebook);
  await seats.releaseHolds('next-buyer');

  // A paid order must never be cancellable this way — that is a refund, which
  // returns money as well as a seat.
  await Payment.create({ transactionId: 'paid-order-x', status: 'PAID', salesContext: 'CINEMA',
    provider: 'chapa', price: 100, currency: 'ETB' });
  const paidRes = { _c: 200, status(c) { this._c = c; return this; }, json(b) { this.body = b; return this; } };
  await cancelCheckout({ params: { transactionId: 'paid-order-x' } }, paidRes);
  check('a PAID order cannot be cancelled from the page',
    paidRes.body?.success === false && /already been paid/.test(paidRes.body?.message || ''),
    JSON.stringify(paidRes.body));

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await m.connection.dropDatabase(); await m.disconnect();
  process.exit(fail?1:0);
})().catch(async (e) => {
  console.error("\ncheckCinemaCheckout crashed:", e);
  await m.connection.dropDatabase().catch(() => {});
  await m.disconnect().catch(() => {});
  process.exit(1);
});
