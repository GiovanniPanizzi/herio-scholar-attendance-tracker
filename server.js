const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const PORT_WS = 8080;
const PORT_HTTP = 3000;

// --- DATABASE ---
const db = new sqlite3.Database('./presenze.db');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS presenze (matricola TEXT PRIMARY KEY, email TEXT, timestamp INTEGER)");
  db.run("CREATE TABLE IF NOT EXISTS token (value TEXT, expires INTEGER)");
});

// --- GENERA TOKEN ---
function generateToken() {
  const token = crypto.randomBytes(3).toString('hex'); // es: 6 caratteri
  const expires = Date.now() + 10000; // 10 secondi
  db.run("DELETE FROM token");
  db.run("INSERT INTO token(value, expires) VALUES(?,?)", [token, expires]);
  return token;
}

// Primo token subito
generateToken();

// Aggiorna token ogni 10 secondi
setInterval(() => {
  const token = generateToken();
  console.log("Nuovo token:", token);
}, 10000);

// --- SERVER HTTP (opzionale) ---
const app = express();
app.use(cors());

// Endpoint per recuperare token via fetch (frontend)
app.get('/token', (req,res) => {
  db.get("SELECT * FROM token WHERE expires>?", [Date.now()], (err,row) => {
    if(row) res.send(row.value);
    else res.status(404).send("Nessun token valido");
  });
});

// Endpoint per esportare presenze in CSV
app.get('/export', (req,res)=>{
  db.all("SELECT * FROM presenze", [], (err, rows)=>{
    if(err) return res.status(500).send("Errore DB");
    const csv = rows.map(r=>`${r.matricola},${r.email},${new Date(r.timestamp).toISOString()}`).join('\n');
    fs.writeFileSync('presenze.csv', csv);
    res.download('presenze.csv');
  });
});

app.listen(PORT_HTTP, () => console.log(`Server HTTP in ascolto su http://localhost:${PORT_HTTP}`));

// --- SERVER WEBSOCKET ---
const wss = new WebSocket.Server({ port: PORT_WS });
wss.on('connection', ws => {
  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      const { matricola, email, token } = data;

      if(!matricola || !email || !token)
        return ws.send(JSON.stringify({status:"error", msg:"Campi mancanti"}));

      // Controlla token valido
      db.get("SELECT * FROM token WHERE value=? AND expires>?", [token, Date.now()], (err, row) => {
        if (!row) return ws.send(JSON.stringify({ status: "error", msg: "Token scaduto" }));

        // Controlla duplicati
        db.get("SELECT * FROM presenze WHERE matricola=?", [matricola], (err, existing) => {
          if (existing) return ws.send(JSON.stringify({ status: "error", msg: "Presenza già registrata" }));

          // Inserisci nel DB
          db.run("INSERT INTO presenze(matricola,email,timestamp) VALUES(?,?,?)", [matricola,email,Date.now()]);
          ws.send(JSON.stringify({ status: "ok", msg: "Presenza registrata" }));
        });
      });

    } catch(e) {
      ws.send(JSON.stringify({ status: "error", msg: "Formato messaggio errato" }));
    }
  });
});

console.log("Server WebSocket in ascolto su ws://localhost:"+PORT_WS);