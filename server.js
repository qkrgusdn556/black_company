const express = require('express');
const mysql = require('mysql2');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;

// [1] Multer 설정 (메모리 저장)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// [2] MySQL 연결
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root@1234', 
    database: 'black_company'
});
db.connect(err => console.log(err ? '❌ MySQL 연결 실패' : '✅ MySQL 연결 성공!'));

// [3] MongoDB Atlas 연결
const uri = "mongodb+srv://qkrgusdn556_db_user:1234@cluster0.xlmcslo.mongodb.net/?appName=Cluster0";

mongoose.connect(uri)
    .then(() => console.log('✅ MongoDB Atlas 연결 성공!'))
    .catch(err => console.error('❌ MongoDB 연결 실패:', err));

// 몽고DB 스키마
const ResumeImageSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    imageBase64: String,
    uploadDate: { type: Date, default: Date.now }
});
const ResumeImage = mongoose.model('ResumeImage', ResumeImageSchema);


// --- [라우트 처리] ---

// 메인 페이지
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));


// 1. 공지사항 목록 가져오기 API (전체 목록)
app.get('/api/notices', (req, res) => {
    // [수정 완료] date 컬럼이 없어서 에러가 나므로, id 역순(최신 등록순)으로 변경했습니다.
    db.query('SELECT * FROM notices ORDER BY id DESC', (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'DB 오류' });
        }
        res.json(results);
    });
});

// 1-1. 공지사항 검색 API
app.get('/api/search', (req, res) => {
    const keyword = req.query.q; 
    if (!keyword) return res.json([]);

    // [수정 완료] 여기도 date 정렬을 제거하고 id 역순으로 변경했습니다.
    const sql = 'SELECT * FROM notices WHERE title LIKE ? ORDER BY id DESC';
    const searchPattern = `%${keyword}%`;

    db.query(sql, [searchPattern], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'DB 검색 오류' });
        }
        res.json(results);
    });
});

// 2. 공지사항 상세 보기 API
app.get('/api/notices/:id', (req, res) => {
    db.query('SELECT * FROM notices WHERE id = ?', [req.params.id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: '없음' });
        res.json(results[0]);
    });
});


// 3. 문의하기 기능
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;
    db.query('INSERT INTO inquiries (name, email, message) VALUES (?, ?, ?)', 
        [name, email, message], 
        (err) => {
            if (err) {
                console.error(err);
                return res.send('<script>alert("오류 발생"); history.back();</script>');
            }
            res.send('<script>alert("문의가 접수되었습니다. (답변은 보장하지 않습니다)"); location.href="/";</script>');
        }
    );
});


// 4. 지원서 제출
app.post('/submit', upload.single('resume'), async (req, res) => {
    const { name, age, gender, phone, address } = req.body;
    let mongoImageId = "No Image";

    if (req.file) {
        try {
            const imgData = req.file.buffer.toString('base64');
            const newImage = new ResumeImage({
                filename: req.file.originalname,
                contentType: req.file.mimetype,
                imageBase64: imgData
            });
            const savedDoc = await newImage.save();
            mongoImageId = savedDoc._id.toString();
            console.log(`📸 몽고DB 저장 완료! ID: ${mongoImageId}`);
        } catch (e) {
            console.error('몽고DB 에러:', e);
        }
    }

    const sql = `INSERT INTO applicants (name, age, gender, phone_number, address, resume_file) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(sql, [name, age, gender, phone, address, mongoImageId], (err) => {
        if (err) {
            console.error(err);
            return res.send('<script>alert("DB 에러: 관리자에게 문의하세요."); history.back();</script>');
        }
        res.send('<script>alert("계약이 체결되었습니다. 환영합니다."); location.href="/";</script>');
    });
});

// 5. 이미지 보기 기능
app.get('/image/:id', async (req, res) => {
    try {
        const doc = await ResumeImage.findById(req.params.id);
        if (!doc) return res.status(404).send('이미지 없음');
        res.contentType(doc.contentType);
        res.send(Buffer.from(doc.imageBase64, 'base64'));
    } catch (e) { res.status(500).send('에러'); }
});

app.listen(PORT, () => {
    console.log(`🚀 [홈페이지] 서버 가동: http://localhost:${PORT}`);
});