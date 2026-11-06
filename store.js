// Lưu tài khoản: MongoDB nếu có MONGODB_URI, không thì lưu file data/players.json
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'players.json');

async function createStore() {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(uri);
    await client.connect();
    const col = client.db(process.env.MONGODB_DB || 'karaoke2d').collection('players');
    await col.createIndex({ key: 1 }, { unique: true });
    console.log('Lưu dữ liệu bằng MongoDB');
    return {
      async get(key) { return col.findOne({ key }, { projection: { _id: 0 } }); },
      async save(p) { await col.updateOne({ key: p.key }, { $set: p }, { upsert: true }); },
      async top(n) { return col.find({}, { projection: { _id: 0, name: 1, tips: 1 } }).sort({ tips: -1 }).limit(n).toArray(); },
    };
  }
  let db = {};
  try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { /* chưa có file */ }
  let timer = null;
  const flush = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); };
  console.log('Chưa có MONGODB_URI → lưu tạm vào file (sẽ mất khi Render khởi động lại)');
  return {
    async get(key) { return db[key] ? { ...db[key] } : null; },
    async save(p) { db[p.key] = { ...p }; clearTimeout(timer); timer = setTimeout(flush, 500); },
    async top(n) { return Object.values(db).sort((a, b) => b.tips - a.tips).slice(0, n).map(p => ({ name: p.name, tips: p.tips })); },
  };
}

module.exports = { createStore };
