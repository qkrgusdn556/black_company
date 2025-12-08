const express = require('express');
const mysql = require('mysql2/promise'); // promise 버전으로 변경
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000; // 환경변수 적용

// Multer 설정
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 정적 파일 & Body Parser
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// MySQL (필레스 연결)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// DB 연결 확인용 라우트(필수 테스트)
app.get('/api/time', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() AS now');
        res.json({ now: rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB error' });
    }
});

// MongoDB 연결
mongoose.connect(process.env.MONGO_URI || "")
    .then(() => console.log("MongoDB 연결 OK"))
    .catch(err => console.error("MongoDB 연결 오류:", err));

const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    uploadDate: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);

// 라우트
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// 공지사항 목록
app.get('/api/notices', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM notices ORDER BY id DESC');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'DB 오류' });
    }
});

// 상세 보기
app.get('/api/notices/:id', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM notices WHERE id = ?', [req.params.id]);
        if (results.length === 0) return res.status(404).json({ error: '없음' });
        res.json(results[0]);
    } catch (err) {
        res.status(500).json({ error: 'DB 오류' });
    }
});

// 이미지 조회
app.get('/image/:id', async (req, res) => {
    try {
        const doc = await ResumeImage.findById(req.params.id);
        if (!doc) return res.status(404).send('이미지 없음');
        res.contentType(doc.contentType);
        res.send(Buffer.from(doc.imageBase64, 'base64'));
    } catch {
        res.status(500).send('에러');
    }
});

// 서버 실행 (Fly.io용)
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server Started on PORT: ${PORT}`);
});
