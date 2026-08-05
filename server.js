const express = require("express");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error("DB error:", err.message);
    console.log("Conectado a SQLite en", dbPath);
});

const initClienteTable = () => {
    db.run(
        `CREATE TABLE IF NOT EXISTS Cliente (
      id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
      documento TEXT,
      nombres TEXT,
      apellidos TEXT,
      email TEXT,
      telefono TEXT,
      ciudad TEXT,
      estado TEXT,
      password TEXT,
      ultimo_ingreso TEXT
    )`
    );

    db.all("PRAGMA table_info('Cliente')", (err, cols) => {
        if (err) {
            console.error('Error al leer esquema Cliente:', err.message);
            return;
        }
        const names = cols.map((col) => col.name);
        const migrations = [];

        if (!names.includes('password')) {
            migrations.push("ALTER TABLE Cliente ADD COLUMN password TEXT");
        }
        if (!names.includes('ultimo_ingreso')) {
            migrations.push("ALTER TABLE Cliente ADD COLUMN ultimo_ingreso TEXT");
        }

        const applyMigration = (index) => {
            if (index >= migrations.length) {
                seedData();
                return;
            }
            db.run(migrations[index], (migrationErr) => {
                if (migrationErr) {
                    console.error('Error al aplicar migración:', migrationErr.message);
                }
                applyMigration(index + 1);
            });
        };

        applyMigration(0);
    });
};

const seedData = () => {
    db.get("SELECT COUNT(*) as cnt FROM Cliente", (err, row) => {
        if (err) {
            console.error('Error al contar clientes:', err.message);
            return;
        }

        if (row && row.cnt === 0) {
            const stmt = db.prepare(
                `INSERT INTO Cliente (documento, nombres, apellidos, email, telefono, ciudad, estado, password, ultimo_ingreso) VALUES (?,?,?,?,?,?,?,?,?)`
            );
            stmt.run("12345678", "Jose", "Marin", "jose@example.com", "3205828750", "Medellin", "activo", "Password123", null);
            stmt.run("87654321", "Ana", "Lopez", "ana@example.com", "3125551234", "Bogota", "activo", "Password123", null);
            stmt.run("00000000", "Admin", "Undergraun", "josedavidmarin311@gmail.com", "3205828750", "Medellin", "admin", "3205828750jJ$", null);
            stmt.finalize();
            console.log("Datos de ejemplo insertados en Cliente");
        }
    });

    db.get("SELECT COUNT(*) as cnt FROM Cliente WHERE email = ?", ["josedavidmarin311@gmail.com"], (errAdmin, adminRow) => {
        if (errAdmin) {
            console.error('Error al verificar admin:', errAdmin.message);
            return;
        }
        if (adminRow && adminRow.cnt === 0) {
            db.run(
                `INSERT INTO Cliente (documento, nombres, apellidos, email, telefono, ciudad, estado, password, ultimo_ingreso) VALUES (?,?,?,?,?,?,?,?,?)`,
                ["00000000", "Admin", "Undergraun", "josedavidmarin311@gmail.com", "3205828750", "Medellin", "admin", "3205828750jJ$", null],
                (insertErr) => {
                    if (insertErr) {
                        console.error('Error al insertar admin:', insertErr.message);
                    } else {
                        console.log("Usuario administrador insertado en Cliente");
                    }
                }
            );
        }
    });
};

db.serialize(initClienteTable);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/login', (req, res) => {
    const { email = '', password = '' } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    db.get(
        `SELECT id_cliente, documento, nombres, apellidos, email, telefono, ciudad, estado FROM Cliente WHERE email = ? AND password = ?`,
        [email, password],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
            }
            const now = new Date().toISOString();
            db.run(`UPDATE Cliente SET ultimo_ingreso = ? WHERE id_cliente = ?`, [now, row.id_cliente], (updateErr) => {
                if (updateErr) {
                    console.error(updateErr);
                }
                return res.json({ success: true, cliente: row, admin: row.estado === 'admin' });
            });
        }
    );
});

app.get('/health', (req, res) => {
    res.json({ ok: true, cwd: process.cwd(), dirname: __dirname, env: process.env.NODE_ENV || 'undefined' });
});

app.use((req, res, next) => {
    console.log('REQUEST', req.method, req.path);
    next();
});

const printRoutes = () => {
    console.log('Rutas registradas:');
    const stack = app._router?.stack || [];
    stack.forEach((middleware, index) => {
        const name = middleware.name || '<anon>';
        const path = middleware.route ? middleware.route.path : middleware.regexp?.toString();
        console.log(`#${index} name=${name} path=${path}`);
        if (middleware.route) {
            const methods = Object.keys(middleware.route.methods).join(',').toUpperCase();
            console.log(`  ROUTE ${methods} ${middleware.route.path}`);
        }
    });
};

app.get('/clientes', (req, res) => {
    db.all(
        `SELECT id_cliente, documento, nombres, apellidos, email, telefono, ciudad, estado, ultimo_ingreso FROM Cliente`,
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send(err.message);
            }
            res.json(rows);
        }
    );
});

app.get('/clientes/:id', (req, res) => {
    const clienteId = Number(req.params.id);
    if (!clienteId) {
        return res.status(400).json({ error: 'ID de cliente inválido.' });
    }
    db.get(
        `SELECT id_cliente, documento, nombres, apellidos, email, telefono, ciudad, estado, ultimo_ingreso FROM Cliente WHERE id_cliente = ?`,
        [clienteId],
        (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(404).json({ error: 'Cliente no encontrado.' });
            }
            res.json(row);
        }
    );
});

app.post('/clientes', (req, res) => {
    const { documento = '', nombres = '', apellidos = '', email = '', telefono = '', ciudad = '', estado = 'activo', password = '' } = req.body;
    if (!documento || !nombres || !apellidos || !email || !telefono || !password) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos.' });
    }

    db.get(`SELECT id_cliente FROM Cliente WHERE email = ?`, [email], (checkErr, existing) => {
        if (checkErr) {
            console.error(checkErr);
            return res.status(500).json({ error: checkErr.message });
        }
        if (existing) {
            return res.status(409).json({ error: 'El correo ya está registrado.' });
        }

        const sql = `INSERT INTO Cliente (documento, nombres, apellidos, email, telefono, ciudad, estado, password) VALUES (?,?,?,?,?,?,?,?)`;
        db.run(sql, [documento, nombres, apellidos, email, telefono, ciudad, estado, password], function (err) {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: err.message });
            }
            db.get(
                `SELECT id_cliente, documento, nombres, apellidos, email, telefono, ciudad, estado, ultimo_ingreso FROM Cliente WHERE id_cliente = ?`,
                [this.lastID],
                (getErr, row) => {
                    if (getErr) {
                        console.error(getErr);
                        return res.status(500).json({ error: getErr.message });
                    }
                    res.status(201).json(row);
                }
            );
        });
    });
});

app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
    printRoutes();
});