const express = require('express');
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer 설정
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 미들웨어 설정
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------------- MySQL 연결 ----------------
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// DB 연결 테스트
app.get('/api/time', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT NOW() AS now');
        res.json({ now: rows[0].now });
    } catch (err) {
        console.error("DB 연결 오류:", err);
        res.status(500).json({ error: "DB error" });
    }
});

// ---------------- MongoDB 연결 ----------------
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("🎯 MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// Schema
const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    uploadDate: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);

// ---------------- Routes ----------------

// 메인 페이지
app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, "public", "index.html"))
);

// 공지사항 목록
app.get('/api/notices', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM notices ORDER BY id DESC");
        res.json(rows);
    } catch {
        res.status(500).json({ error: "DB 오류" });
    }
});

// 공지사항 상세
app.get('/api/notices/:id', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM notices WHERE id = ?", [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "Not found" });
        res.json(rows[0]);
    } catch {
        res.status(500).json({ error: "DB 오류" });
    }
});

// 이미지 보기
app.get('/image/:id', async (req, res) => {
    try {
        const img = await ResumeImage.findById(req.params.id);
        if (!img) return res.status(404).send("이미지 없음");
        res.contentType(img.contentType);
        res.send(Buffer.from(img.imageBase64, "base64"));
    } catch {
        res.status(500).send("에러");
    }
});

// 지원서 제출 (이미지 저장 포함)
app.post('/submit', upload.single('resume'), async (req, res) => {
    const { name, age, gender, phone, address } = req.body;
    let mongoImageId = null;

    if (req.file) {
        try {
            const imgData = req.file.buffer.toString("base64");
            const savedImg = await new ResumeImage({
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                imageBase64: imgData
            }).save();

            mongoImageId = savedImg._id.toString();
            console.log("📎 MongoDB 이미지 저장:", mongoImageId);
        } catch (err) {
            console.error("❌ 이미지 저장 실패:", err);
        }
    }

    try {
        await db.query(
            "INSERT INTO applicants (name, age, gender, phone_number, address, resume_file) VALUES (?, ?, ?, ?, ?, ?)",
            [name, age, gender, phone, address, mongoImageId]
        );
        res.send('<script>alert("지원 완료!"); location.href="/";</script>');
    } catch (err) {
        console.error("❌ MySQL 저장 실패:", err);
        res.send('<script>alert("DB 오류 발생"); history.back();</script>');
    }
});

// ---------------- 서버 실행 ----------------
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on PORT ${PORT}`);
});
