const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ExcelJS = require('exceljs');

const PORT = 3000;
const DB_PATH = path.join(__dirname, 'presenze.db');
const TOKEN_LIFETIME = 25000;
const EXCEL_PATH = path.join(__dirname, 'presenze.xlsx');

const workbook = new ExcelJS.Workbook();
let sheet;

if (fs.existsSync(EXCEL_PATH)) {
    workbook.xlsx.readFile(EXCEL_PATH)
        .then(() => {
            sheet = workbook.getWorksheet('Presenze') || workbook.addWorksheet('Presenze');
            if (!sheet.columns || sheet.columns.length === 0) {
                sheet.columns = [
                    { header: 'Matricola', key: 'matricola', width: 20 },
                    { header: 'IP', key: 'ip', width: 20 }
                ];
            }
        })
        .catch(() => {
            sheet = workbook.addWorksheet('Presenze');
            sheet.columns = [
                { header: 'Matricola', key: 'matricola', width: 20 },
                { header: 'IP', key: 'ip', width: 20 }
            ];
        });
} else {
    sheet = workbook.addWorksheet('Presenze');
    sheet.columns = [
        { header: 'Matricola', key: 'matricola', width: 20 },
        { header: 'IP', key: 'ip', width: 20 }
    ];
}

async function exportToExcelRow(matricola, ip) {
    sheet.addRow({ matricola, ip });
    await workbook.xlsx.writeFile(EXCEL_PATH);
    console.log(`Riga aggiunta a ${EXCEL_PATH}`);
}

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log("DB esistente eliminato.");
}

// --- DATABASE ---
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) {
    console.error("Errore apertura DB:", err);
    process.exit(1);
  }
});

// Creazione tabelle
db.serialize(() => {
  db.run(`CREATE TABLE presenze (
    matricola TEXT PRIMARY KEY,
    ip TEXT UNIQUE
  )`);

  db.run(`CREATE TABLE token (
    value TEXT PRIMARY KEY,
    expires INTEGER
  )`);
});

// --- TOKEN ---
function generateToken() {
  const token = crypto.randomBytes(3).toString('hex'); // 6 caratteri
  const expires = Date.now() + TOKEN_LIFETIME;

  db.run("INSERT OR REPLACE INTO token(value, expires) VALUES(?,?)", [token, expires], err => {
    if (err) console.error("Errore inserimento token:", err);
  });

  console.log("Nuovo token:", token);
  return token;
}

generateToken();
setInterval(generateToken, TOKEN_LIFETIME);

// --- SERVER ---
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- API registrazione ---
app.post('/registra', (req, res) => {
  const { matricola, token } = req.body;
  if (!matricola || !token)
    return res.status(400).json({ status: "error", msg: "Campi mancanti" });

  const ip = (req.ip || req.connection.remoteAddress).replace(/^::ffff:/, '');

  db.get("SELECT * FROM token WHERE value=? AND expires>?", [token, Date.now()], (err, row) => {
    if (err) return res.status(500).json({ status: "error", msg: "Errore server" });
    if (!row) return res.status(403).json({ status: "error", msg: "Token non valido o scaduto" });

    db.get("SELECT * FROM presenze WHERE ip=?", [ip], (err, existing) => {
      if (err) return res.status(500).json({ status: "error", msg: "Errore server" });

      if (!existing) {
        db.run("INSERT INTO presenze(matricola,ip) VALUES(?,?)",
          [matricola, ip],
          async err => {
            if (err) console.error("Errore inserimento presenza:", err);
            else {
              console.log(`Registrata: ${matricola} (${ip})`);
              await exportToExcelRow(matricola, ip); // aggiunge riga solo se IP unico
            }
          }
        );
      } else {
        console.log(`IP già registrato: ${ip}, matricola ${matricola} non salvata`);
      }

      res.json({ status: "ok", msg: "Presenza registrata" });
    });
  });
});

// --- Endpoint debug ---
app.get('/presenze', (req, res) => {
  db.all("SELECT * FROM presenze", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Errore DB" });
    res.json(rows);
  });
});

// --- Endpoint token (solo localhost) ---
app.get('/token', (req, res) => {
  if (!req.ip.startsWith('127.') && !req.ip.startsWith('::1')) {
    return res.status(403).send("Accesso negato");
  }

  db.get("SELECT * FROM token WHERE expires>?", [Date.now()], (err, row) => {
    if (err || !row) return res.status(404).send("Nessun token valido");
    res.send(row.value);
  });
});

// --- Trova IP locale ---
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

app.get('/server-ip', (req, res) => {
  res.send(getLocalIP());
});

// --- Avvio server ---
const localIP = getLocalIP();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server in LAN su http://${localIP}:${PORT}`);
});




