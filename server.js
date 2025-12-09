const express = require('express');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer 설정
const upload = multer({ storage: multer.memoryStorage() });

// 정적 파일 & Body Parser
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ===== DB ENV LOG =====
console.log("===== DB ENV CHECK =====");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASS:", process.env.DB_PASS ? "SET" : "❌ NOT SET");
console.log("DB_NAME:", process.env.DB_NAME);
console.log("========================");

// PostgreSQL Pool 설정
const db = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

// DB 연결 테스트 라우트
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query("SELECT NOW()");
        res.json({ success: true, now: result.rows[0].now });
    } catch (err) {
        console.error("PostgreSQL Test Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// MongoDB 연결
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("🎯 MongoDB Connected"))
        .catch(err => console.error("❌ MongoDB Connection Error:", err));
} else {
    console.log("⚠️ MongoDB URI 없음");
}

// MongoDB Schema
const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    createdAt: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);

// 메인 페이지
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 지원서 제출
app.post('/submit', upload.single('resume'), async (req, res) => {
    const { name, age, gender, phone, address } = req.body;
    let resumeFile = "No Image";

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
        await db.query(`
        INSERT INTO applicants 
        (name, age, gender, phone_number, address, resume_file)
        VALUES ($1, $2, $3, $4, $5, $6)
        `, [name, age, gender, phone, address, resumeFile]);

        res.send('<script>alert("지원 완료!"); location.href="/";</script>');
    } catch (err) {
        console.error("❌ PostgreSQL 저장 실패:", err);
        res.send('<script>alert("DB 오류 발생"); history.back();</script>');
    }
});

// 서버 실행
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on PORT ${PORT}`));
