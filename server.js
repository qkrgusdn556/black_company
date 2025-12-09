const express = require('express');
const mysql = require('mysql2/promise');
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

// MySQL 커넥션 풀 - 연결 제한 줄임
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 3,  // 🔥 핵심 수정
    queueLimit: 0
});

// DB 연결 테스트 라우트
app.get('/api/time', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() AS now');
        res.json({ now: rows[0].now });
    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: 'DB error' });
    }
});

// MongoDB Atlas 연결 (최신 방식)
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

// 라우트
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 지원서 제출
app.post('/submit', upload.single('resume'), async (req, res) => {
    const { name, age, gender, phone, address } = req.body;
    let mongoImageId = "No Image";

    // 이미지 MongoDB 저장
    if (req.file) {
        try {
            const doc = await ResumeImage.create({
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                imageBase64: req.file.buffer.toString('base64')
            });
            mongoImageId = doc._id.toString();
        } catch (err) {
            console.error("❌ 이미지 저장 실패:", err);
        }
    }

    // MySQL 저장
    try {
        const sql = `
        INSERT INTO applicants 
        (name, age, gender, phone_number, address, resume_file)
        VALUES (?, ?, ?, ?, ?, ?)
        `;
        await db.query(sql, [name, age, gender, phone, address, mongoImageId]);

        res.send('<script>alert("지원 완료!"); location.href="/";</script>');
    } catch (err) {
        console.error("❌ MySQL 저장 실패:", err);
        res.send('<script>alert("DB 오류 발생"); history.back();</script>');
    }
});

// 서버 실행
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on PORT ${PORT}`));
