require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 🐬 MySQL Pool (Railway Public Proxy) 설정
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
});

// MongoDB 연결
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("🍃 MongoDB 연결 성공!"))
        .catch(err => console.error("❌ MongoDB 오류:", err));
} else {
    console.log("⚠️ MongoDB 사용 안함 (환경변수 없음)");
}

const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    createdAt: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);

// 메인 페이지
app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 지원서 제출
app.post('/submit', upload.single('resume'), async (req, res) => {
    const { name, age, gender, phone, address } = req.body;
    let resumeFile = null;

    if (req.file) {
        try {
            const doc = await ResumeImage.create({
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                imageBase64: req.file.buffer.toString('base64')
            });
            resumeFile = doc._id.toString();
        } catch (err) {
            console.error("❌ 이미지 MongoDB 저장 실패:", err);
        }
    }

    try {
        await pool.execute(
            `INSERT INTO applicants (name, age, gender, phone_number, address, resume_file) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, age, gender, phone, address, resumeFile]
        );

        res.send('<script>alert("지원 완료!"); location.href="/";</script>');
    } catch (err) {
        console.error("❌ MySQL 저장 실패:", err);
        res.send('<script>alert("DB 오류 발생"); history.back();</script>');
    }
});

// 📌 공지사항 CRUD
app.post('/api/admin/notices', async (req, res) => {
    const { title, content } = req.body;
    try {
        await pool.execute("INSERT INTO notices (title, content) VALUES (?, ?)", [
            title, content
        ]);
        res.json({ message: "등록 완료" });
    } catch (err) {
        console.error("공지 등록 오류:", err);
        res.status(500).json({ error: "DB 오류" });
    }
});

app.get('/api/admin/notices', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT id, title, created_at FROM notices ORDER BY id DESC LIMIT 5"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "오류" });
    }
});

app.get('/api/admin/notices/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT * FROM notices WHERE id = ?", [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "없음" });
        res.json(rows[0]);
    } catch {
        res.status(500).json({ error: "DB 오류" });
    }
});

app.delete('/api/admin/notices/:id', async (req, res) => {
    try {
        await pool.execute("DELETE FROM notices WHERE id=?", [req.params.id]);
        res.json({ message: "삭제 완료" });
    } catch {
        res.status(500).json({ error: "DB 오류" });
    }
});

// 지원자 목록
app.get('/api/applicants', async (_, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM applicants ORDER BY id DESC");
        res.json(rows);
    } catch {
        res.status(500).json({ error: "오류" });
    }
});

// 문의사항 목록
app.get('/api/admin/inquiries', async (_, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM inquiries ORDER BY id DESC");
        res.json(rows);
    } catch {
        res.status(500).json({ error: "오류" });
    }
});

// 문의 상세
app.get('/api/admin/inquiries/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT * FROM inquiries WHERE id=?", [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: "없음" });
        res.json(rows[0]);
    } catch {
        res.status(500).json({ error: "DB 오류" });
    }
});

app.listen(PORT, "0.0.0.0", () =>
    console.log(`🚀 MySQL Admin Server Running on PORT ${PORT}`)
);
