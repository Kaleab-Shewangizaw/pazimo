const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

/**
 * Proves the admin's allow list is what decides a cinema's counter.
 *
 * An allow list reads the opposite way to the deny list it replaced: empty
 * means NOTHING, not everything. That inversion is easy to get wrong in a way
 * that fails open — a cinema quietly able to sell the whole catalogue — so it
 * is asserted directly, along with the ownership rule that one cinema's grant
 * says nothing about another's.
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

(async () => {
  await m.connect(baseUri(), { serverSelectionTimeoutMS: 8000 });
  console.log(`\nScratch database: ${m.connection.name}`);
  await m.connection.dropDatabase();
  await Beverage.syncIndexes();

  const mk = (name) => Cinema.create({ name, account: new m.Types.ObjectId(),
    city: 'Addis', address: 'x', phoneNumber: '09', beverageEligibility: 'eligible' });
  const a = await mk('Cinema A');
  const b = await mk('Cinema B');

  const coke = await Beverage.create({ name: 'Coke', category: 'drink', image: '/uploads/coke.png' });
  const popcorn = await Beverage.create({ name: 'Popcorn', category: 'snack', image: '/uploads/pop.png' });
  const retired = await Beverage.create({ name: 'Old Stock', category: 'drink', isActive: false });

  const reqFor = (cinema, body = {}, params = {}) => ({
    cinema, params, body, query: {},
    user: { userId: String(cinema.account), role: 'cinema' }, file: null,
  });
  const call = async (fn, req) => {
    let out = {};
    const res = { status(c) { out.code = c; return this; }, json(x) { out.body = x; return this; } };
    await fn(req, res);
    return out;
  };
  const catalogue = async (cinema) =>
    ((await call(ctrl.listSellableCatalog, reqFor(cinema))).body?.data || []).map((x) => x.name).sort();

  console.log('\n--- an empty allow list means NOTHING, not everything ---');
  check('a cinema granted nothing sells nothing', (await catalogue(a)).length === 0,
    JSON.stringify(await catalogue(a)));

  console.log('\n--- the admin grants, and only what was granted appears ---');
  a.allowedBeverages = [coke._id];
  await a.save();
  check('Cinema A sees only Coke', (await catalogue(a)).join(',') === 'Coke', JSON.stringify(await catalogue(a)));
  check('Cinema B still sees nothing', (await catalogue(b)).length === 0);

  b.allowedBeverages = [popcorn._id];
  await b.save();
  check('one grant says nothing about another cinema',
    (await catalogue(a)).join(',') === 'Coke' && (await catalogue(b)).join(',') === 'Popcorn');

  console.log('\n--- an inactive product stays out even when granted ---');
  a.allowedBeverages = [coke._id, retired._id];
  await a.save();
  check('a retired product is not offered', (await catalogue(a)).join(',') === 'Coke',
    JSON.stringify(await catalogue(a)));

  console.log('\n--- the artwork customers see is the admin\'s ---');
  const withImages = (await call(ctrl.listSellableCatalog, reqFor(a))).body.data;
  check('the catalogue carries the admin image', withImages[0].image === '/uploads/coke.png',
    withImages[0].image);

  console.log('\n--- cinemas cannot create products any more ---');
  check('createOwnProduct is gone', typeof ctrl.createOwnProduct === 'undefined');
  check('updateOwnProduct is gone', typeof ctrl.updateOwnProduct === 'undefined');
  check('removeOwnProduct is gone', typeof ctrl.removeOwnProduct === 'undefined');

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await m.connection.dropDatabase();
  await m.disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => {
  console.error("\ncheckCinemaProducts crashed:", e);
  await m.connection.dropDatabase().catch(() => {});
  await m.disconnect().catch(() => {});
  process.exit(1);
});
