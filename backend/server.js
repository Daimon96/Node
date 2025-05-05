const express = require('express');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:8000' }));
app.use(express.json());

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: './Uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Подключение к базе данных
const db = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
});

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Регистрация
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const [existingUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            console.log('Email already exists:', email);
            return res.status(400).json({ error: 'Email already exists' });
        }

        await db.query('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [email, password, 'user']);
        res.status(201).json({ message: 'User registered' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Логин
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'User not found' });

        const user = users[0];
        if (password !== user.password) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, role: user.role });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// ==================== Устройства (Devices) ====================

// Получить список устройств с пагинацией
app.get('/api/devices', authenticateToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const [devices] = await db.query('SELECT * FROM devices LIMIT ? OFFSET ?', [limit, offset]);
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM devices');
        const total = countResult[0].total;
        res.json({ devices, total, page, limit });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch devices' });
    }
});

// Добавить устройство
app.post('/api/devices', authenticateToken, upload.single('image'), async (req, res) => {
    const { name, model, description, price, status, client_name, client_phone } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '/uploads/placeholder.jpg';

    try {
        await db.query(
            'INSERT INTO devices (name, model, description, image, price, status, client_name, client_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, model, description, image, price, status, client_name, client_phone]
        );
        res.status(201).json({ message: 'Device added' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add device' });
    }
});

// Обновить устройство
app.put('/api/devices/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { name, model, description, price, status, client_name, client_phone } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;

    try {
        await db.query(
            'UPDATE devices SET name = ?, model = ?, description = ?, image = ?, price = ?, status = ?, client_name = ?, client_phone = ? WHERE id = ?',
            [name, model, description, image, price, status, client_name, client_phone, id]
        );
        res.json({ message: 'Device updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update device' });
    }
});

// Удалить устройство
app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM devices WHERE id = ?', [id]);
        res.json({ message: 'Device deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete device' });
    }
});

// ==================== Услуги (Services) ====================

// Получить список услуг с пагинацией
app.get('/api/services', authenticateToken, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        const [services] = await db.query('SELECT * FROM services LIMIT ? OFFSET ?', [limit, offset]);
        const [countResult] = await db.query('SELECT COUNT(*) as total FROM services');
        const total = countResult[0].total;
        res.json({ services, total, page, limit });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});


// Добавить услугу (измененный метод)
app.post('/api/services', authenticateToken, upload.single('image'), async (req, res) => {
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const { title, description, price, duration, category, is_available, technician } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '/uploads/placeholder.jpg';

    try {
        console.log('Inserting service with:', { 
            title, description, price, duration, category, is_available, technician 
        });
        
        await db.query(
            'INSERT INTO services (title, description, price, image, duration, category, is_available, technician) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                title, 
                description, 
                parseFloat(price), 
                image, 
                duration, 
                category, 
                is_available === 'true' || is_available === true ? 1 : 0, 
                technician
            ]
        );
        res.status(201).json({ message: 'Service added' });
    } catch (error) {
        console.error('Error saving service:', error);
        res.status(500).json({ 
            error: 'Failed to add service',
            details: error.message,
            sqlMessage: error.sqlMessage 
        });
    }
});

// Обновить услугу
app.put('/api/services/:id', authenticateToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { title, description, price, duration, category, is_available, technician } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;

    try {
        await db.query(
            'UPDATE services SET title = ?, description = ?, price = ?, image = ?, duration = ?, category = ?, is_available = ?, technician = ? WHERE id = ?',
            [title, description, price, image, duration, category, is_available, technician, id]
        );
        res.json({ message: 'Service updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update service' });
    }
});

// Удалить услугу
app.delete('/api/services/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        await db.query('DELETE FROM services WHERE id = ?', [id]);
        res.json({ message: 'Service deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete service' });
    }
});

// Статические файлы для загрузок
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});