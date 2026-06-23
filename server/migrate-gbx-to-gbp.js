/*
 * One-time migration: remove GBX (pence) from the DB so only GBP remains.
 *
 *  - ps2.trades (currency GBX): value-preserving -> price/100, fee/100, rate*100, currency GBP.
 *    (price*rate*volume unchanged; just re-expressed in pounds.) All such trades belong to
 *    deleted test portfolios.
 *  - Aktia.Symbols / Aktia.OldSymbols: relabel currency-named fields GBX->GBP and divide the
 *    paired `Price` (pence) by 100.
 *  - top.instruments: relabel currency GBX->GBP.
 *  - Any other field whose NAME contains "currency" and equals "GBX" is relabelled to GBP.
 *    Fields named symbol/Symbol/Symbol-Ric/symbolRec are NEVER touched (GBX is a real ticker).
 *
 * Every affected document is backed up (pre-change) to ./migrations-backup/<ts>/ before writes.
 * Run with --dry to preview without writing.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");

const DRY = process.argv.includes("--dry");
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(__dirname, "migrations-backup", `gbx-${ts}`);

function backup(name, docs) {
  if (!docs.length) return;
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(docs, null, 2));
  console.log(`  backed up ${docs.length} -> ${name}.json`);
}

// discover field names (containing "currency", case-insensitive) that hold "GBX" in a collection
async function currencyFieldsWithGBX(coll) {
  const sample = await coll.find({}).limit(300).toArray();
  const names = new Set();
  for (const d of sample) for (const k of Object.keys(d)) if (/currency/i.test(k)) names.add(k);
  const hits = [];
  for (const f of names) {
    const n = await coll.countDocuments({ [f]: "GBX" });
    if (n > 0) hits.push({ field: f, count: n });
  }
  return hits;
}

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  console.log(DRY ? "=== DRY RUN (no writes) ===" : "=== APPLYING MIGRATION ===");
  console.log("backup dir:", backupDir, "\n");

  // 1) ps2.trades --------------------------------------------------------------
  const trades = c.db("ps2").collection("trades");
  const gbxTrades = await trades.find({ currency: "GBX" }).toArray();
  console.log(`ps2.trades GBX: ${gbxTrades.length}`);
  backup("ps2.trades", gbxTrades);
  if (!DRY) {
    const ops = gbxTrades.map((t) => ({
      updateOne: {
        filter: { _id: t._id },
        update: {
          $set: {
            currency: "GBP",
            ...(typeof t.price === "number" ? { price: t.price / 100 } : {}),
            ...(typeof t.fee === "number" ? { fee: t.fee / 100 } : {}),
            ...(typeof t.rate === "number" ? { rate: t.rate * 100 } : {}),
          },
        },
      },
    }));
    if (ops.length) await trades.bulkWrite(ops);
    console.log(`  -> updated ${ops.length} trades`);
  }

  // 2) Aktia.Symbols & Aktia.OldSymbols ---------------------------------------
  for (const [dbn, coln, priceIsString] of [["Aktia", "Symbols", false], ["Aktia", "OldSymbols", true]]) {
    const coll = c.db(dbn).collection(coln);
    const fields = await currencyFieldsWithGBX(coll);
    console.log(`\n${dbn}.${coln} currency fields with GBX:`, fields);
    const orFilter = { $or: fields.map((f) => ({ [f.field]: "GBX" })) };
    const affected = fields.length ? await coll.find(orFilter).project(
      fields.reduce((o, f) => ((o[f.field] = 1), o), { Symbol: 1, "Symbol-Mic": 1, Price: 1 })
    ).toArray() : [];
    backup(`${dbn}.${coln}`, affected);
    if (!DRY && fields.length) {
      // relabel each currency-named field GBX -> GBP
      for (const f of fields) {
        await coll.updateMany({ [f.field]: "GBX" }, { $set: { [f.field]: "GBP" } });
      }
      // scale the paired Price (pence -> pounds) where "Price - Currency" was GBX
      if (fields.some((f) => f.field === "Price - Currency")) {
        const priceExpr = priceIsString
          ? { $toString: { $divide: [{ $convert: { input: "$Price", to: "double", onError: null, onNull: null } }, 100] } }
          : { $divide: [{ $convert: { input: "$Price", to: "double", onError: null, onNull: null } }, 100] };
        // re-find docs that originally had Price - Currency GBX (now GBP) via backup ids
        const ids = affected.filter((d) => true).map((d) => d._id);
        await coll.updateMany(
          { _id: { $in: ids }, Price: { $ne: null } },
          [{ $set: { Price: priceExpr } }]
        );
      }
      console.log(`  -> relabelled fields + scaled Price for ${affected.length} docs`);
    }
  }

  // 3) top.instruments ---------------------------------------------------------
  const ti = c.db("top").collection("instruments");
  const tiFields = await currencyFieldsWithGBX(ti);
  console.log(`\ntop.instruments currency fields with GBX:`, tiFields);
  const tiAffected = tiFields.length
    ? await ti.find({ $or: tiFields.map((f) => ({ [f.field]: "GBX" })) }).toArray()
    : [];
  backup("top.instruments", tiAffected);
  if (!DRY) for (const f of tiFields) await ti.updateMany({ [f.field]: "GBX" }, { $set: { [f.field]: "GBP" } });

  // 4) Verify: any GBX left in currency-named fields anywhere -------------------
  console.log("\n=== post-migration GBX scan (currency-named fields) ===");
  const dbs = (await c.db().admin().listDatabases()).databases.map((d) => d.name)
    .filter((n) => !["admin", "config", "local"].includes(n));
  for (const dbn of dbs) {
    const cols = (await c.db(dbn).listCollections().toArray()).map((x) => x.name);
    for (const col of cols) {
      const coll = c.db(dbn).collection(col);
      const hits = await currencyFieldsWithGBX(coll);
      for (const h of hits) console.log(`  STILL GBX: ${dbn}.${col}.${h.field} = ${h.count}`);
    }
  }
  console.log("done.");
  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });
