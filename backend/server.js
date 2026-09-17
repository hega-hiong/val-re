const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOADS_DIR = path.join(FRONTEND_DIR, 'uploads');
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE !== 'false';
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `image-${Date.now()}${extension}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    callback(null, file.mimetype.startsWith('image/'));
  }
});

const DEFAULT_SITE_CONTENT = {
  brandSubtitle: 'journal de terrain',
  homeEyebrow: 'Analyse, contexte, débat',
  homeTitle: 'Des idées claires, des faits sans bruit.',
  homeDescription: 'Valère est un espace de publication personnelle pour raconter l’actualité, donner du sens aux sujets de fond et laisser la conversation se développer avec les lecteurs.',
  homeButton: 'Lire les dernières infos',
  spotlightLabel: 'Le point du jour',
  spotlightTitle: 'Le débat public revient au centre de la vie politique.',
  spotlightDescription: 'Entre urgence sociale, exigence de clarté et besoin de confiance, les décideurs doivent reprendre la parole avec plus de cohérence.',
  newsEyebrow: 'Fil d’actualités',
  newsTitle: 'Dernières publications',
  newsDescription: 'Les analyses et récits publiés récemment par Valère.',
  aboutEyebrow: 'À propos',
  aboutTitle: 'Un regard attentif sur le monde qui nous entoure.',
  aboutDescription: 'Valère privilégie les faits, le contexte et les conversations utiles pour mieux comprendre les sujets qui traversent notre époque.',
  contactEyebrow: 'Contact',
  contactTitle: 'Poursuivons la conversation.',
  contactDescription: 'Une question, une idée ou une réaction ? Écrivez-nous et nous vous répondrons avec attention.',
  contactEmail: 'bonjour@valere.fr'
};

const ADMIN = {
  username: process.env.ADMIN_USERNAME || 'valère',
  password: process.env.ADMIN_PASSWORD || 'valère'
};

function ensureDb() {
  const dataDir = path.join(__dirname, 'data');
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const seed = {
      articles: [
        {
          id: 'article-1',
          title: 'La réforme de la transition écologique prend du rythme',
          excerpt: 'Les acteurs de terrain appellent à une mise en œuvre plus rapide et plus lisible des engagements publics.',
          content: 'Le débat sur la transition écologique se consolide face à l’urgence climatique et à la nécessité de réconcilier ambition environnementale et cohérence budgétaire. Les premières mesures sont déjà visibles sur le terrain, tandis que la concertation s’intensifie entre administrations, élus et citoyens. L’objectif est simple : accélérer la mise en place des infrastructures nécessaires sans perdre le sens de la confiance publique.',
          imageUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
          category: 'Politique',
          createdAt: '2026-09-10T09:30:00.000Z',
          status: 'published',
          likes: 28,
          comments: [
            {
              id: 'comment-1',
              author: 'Claire',
              content: 'Un sujet crucial pour les prochaines années. Il faut plus de clarté dans les décisions publiques.',
              status: 'approved',
              createdAt: '2026-09-10T10:15:00.000Z'
            }
          ]
        },
        {
          id: 'article-2',
          title: 'Le renforcement du dialogue citoyen au cœur de la vie démocratique',
          excerpt: 'Les institutions cherchent à retrouver une proximité plus tangible avec les attentes locales et les besoins des quartiers.',
          content: 'Dans un contexte où les citoyens demandent plus de lisibilité, la priorité semble désormais donnée à des dispositifs de dialogue plus réguliers, plus simples et plus proches des réalités du quotidien. La qualité du débat public dépend aussi de sa capacité à organiser des échanges honnêtes, utiles et constructifs.',
          imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
          category: 'Société',
          createdAt: '2026-09-08T18:00:00.000Z',
          status: 'published',
          likes: 17,
          comments: [
            {
              id: 'comment-2',
              author: 'Romain',
              content: 'C’est exactement ce qu’il faut : plus de proximité et moins de distance entre les institutions et les citoyens.',
              status: 'approved',
              createdAt: '2026-09-08T18:45:00.000Z'
            }
          ]
        }
      ]
    };

    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2));
  }
}

function readDb() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getSiteContent(db) {
  return { ...DEFAULT_SITE_CONTENT, ...(db.siteContent || {}) };
}

function normalizeArticle(article) {
  let likedBy = Array.isArray(article.likedBy) ? [...new Set(article.likedBy.filter(Boolean))] : [];

  if (!likedBy.length && Number(article.likes || 0) > 0) {
    likedBy = Array.from({ length: Number(article.likes || 0) }, (_, index) => `legacy-${article.id}-${index}`);
  }

  const likes = likedBy.length;

  return {
    ...article,
    status: article.status || 'published',
    likedBy,
    likes,
    comments: Array.isArray(article.comments) ? article.comments : []
  };
}

function getPublicArticles(db) {
  return [...db.articles]
    .map(normalizeArticle)
    .filter((article) => article.status === 'published')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((article) => ({
      ...article,
      comments: article.comments.filter((comment) => comment.status === 'approved')
    }));
}

function migrateDb() {
  const db = readDb();
  db.articles = (db.articles || []).map((article) => {
    const normalized = normalizeArticle(article);
    return {
      ...article,
      ...normalized,
      likes: normalized.likes,
      likedBy: normalized.likedBy,
      comments: Array.isArray(article.comments) ? article.comments : []
    };
  });
  db.siteContent = getSiteContent(db);
  writeDb(db);
}

ensureDb();
migrateDb();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'valere-news-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.get(['/admin', '/admin.html', '/admin/'], (req, res) => {
  return res.sendFile(path.join(FRONTEND_DIR, 'admin.html'));
});

function renderMaintenancePage() {
  return `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title> TicTac</title>
        <style>
          :root {
            --paper: #efe7d7;
            --paper-deep: #e1d3b0;
            --ink: #130f0d;
            --ink-soft: #41392f;
            --rule: #8d775c;
            --accent: #7b1d1d;
            --shadow: rgba(0,0,0,0.18);
          }

          * { box-sizing: border-box; }

          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background:
              radial-gradient(circle at center, rgba(33,27,17,0.08), transparent 60%),
              repeating-linear-gradient(
                0deg,
                #d7c9aa 0,
                #d7c9aa 2px,
                #efe7d7 2px,
                #efe7d7 4px
              );
            font-family: Georgia, "Times New Roman", serif;
            color: var(--ink);
            letter-spacing: 0.02em;
          }

          .notice {
            width: min(880px, calc(100% - 28px));
            background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(0,0,0,0.02)), var(--paper);
            border: 4px solid var(--ink);
            box-shadow: 10px 10px 0 var(--shadow);
            padding: 20px 30px 28px;
            position: relative;
          }

          .notice::before {
            content: "";
            position: absolute;
            inset: 12px;
            border: 2px solid var(--rule);
            pointer-events: none;
          }

          .topline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding-bottom: 10px;
            margin-bottom: 12px;
            border-bottom: 3px double var(--ink);
            font-size: 0.68rem;
            letter-spacing: 0.26em;
            text-transform: uppercase;
            color: var(--ink-soft);
          }

          .brand {
            font-weight: 700;
          }

          .tag {
            display: inline-block;
            margin-top: 8px;
            border: 3px solid var(--accent);
            padding: 9px 14px;
            color: var(--accent);
            background: rgba(123,29,29,0.04);
            font-weight: 800;
            letter-spacing: 0.18em;
            font-size: 0.85rem;
            text-transform: uppercase;
          }

          h1 {
            margin: 18px 0 16px;
            text-align: center;
            font-size: clamp(2.8rem, 9vw, 6.2rem);
            line-height: 0.9;
            letter-spacing: 0.12em;
            font-weight: 900;
            color: var(--accent);
            text-transform: uppercase;
          }

          .subtitle {
            text-align: center;
            max-width: 640px;
            margin: 0 auto 16px;
            font-size: clamp(1.1rem, 2vw, 1.5rem);
            line-height: 1.6;
            color: var(--ink-soft);
            font-style: italic;
          }

          .rule {
            width: 100%;
            height: 2px;
            background: var(--ink);
            margin: 18px 0 16px;
          }

          p {
            margin: 0 auto;
            max-width: 660px;
            text-align: center;
            font-size: clamp(1rem, 2vw, 1.15rem);
            line-height: 1.8;
            color: var(--ink);
          }
        </style>
      </head>
      <body>
        <main class="notice" aria-live="polite">
          <div class="topline">
            <span class="brand"> </span>
            <span>Information</span>
          </div>

          <div class="tag">ATTENTION</div>
          <h1>ATTENTION</h1>

          <div class="subtitle"></div>
          <div class="bar"></div>
          <p></p>
        </main>
      </body>
    </html>
  `;
}

if (MAINTENANCE_MODE) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(503).json({ error: 'ATTENTION : site temporairement bloqué pour maintenance.' });
    }
    return res.send(renderMaintenancePage());
  });
}

app.use(express.static(FRONTEND_DIR));

function requireAuth(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  next();
}

app.get('/api/session', (req, res) => {
  const loggedIn = Boolean(req.session && req.session.admin);
  res.json({ loggedIn, username: req.session && req.session.admin ? req.session.admin : null });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (username === ADMIN.username && password === ADMIN.password) {
    req.session.admin = username;
    return req.session.save((error) => {
      if (error) {
        return res.status(500).json({ error: 'Impossible d’enregistrer la session.' });
      }
      return res.json({ success: true, username });
    });
  }

  return res.status(401).json({ error: 'Identifiants invalides.' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/articles', (req, res) => {
  const db = readDb();
  res.json({ articles: getPublicArticles(db), siteContent: getSiteContent(db) });
});

app.get('/api/site-content', (req, res) => {
  res.json({ siteContent: getSiteContent(readDb()) });
});

app.post('/api/articles/:id/like', (req, res) => {
  const db = readDb();
  const { userId } = req.body || {};
  const article = db.articles.find((item) => item.id === req.params.id);

  if (!article) {
    return res.status(404).json({ error: 'Article introuvable.' });
  }

  article.likedBy = Array.isArray(article.likedBy) ? [...new Set(article.likedBy.filter(Boolean))] : [];

  if (!userId) {
    return res.status(400).json({ error: 'Identifiant utilisateur requis.' });
  }

  if (article.likedBy.includes(userId)) {
    return res.json({ success: true, liked: true, likes: article.likedBy.length });
  }

  article.likedBy.push(userId);
  article.likes = article.likedBy.length;
  writeDb(db);
  return res.json({ success: true, liked: true, likes: article.likes });
});

app.delete('/api/articles/:id/like', (req, res) => {
  const db = readDb();
  const { userId } = req.body || {};
  const article = db.articles.find((item) => item.id === req.params.id);

  if (!article) {
    return res.status(404).json({ error: 'Article introuvable.' });
  }

  article.likedBy = Array.isArray(article.likedBy) ? [...new Set(article.likedBy.filter(Boolean))] : [];

  if (!userId) {
    return res.status(400).json({ error: 'Identifiant utilisateur requis.' });
  }

  const index = article.likedBy.indexOf(userId);
  if (index >= 0) {
    article.likedBy.splice(index, 1);
  }

  article.likes = article.likedBy.length;
  writeDb(db);

  return res.json({ success: true, liked: false, likes: article.likes });
});

app.post('/api/articles/:id/comments', (req, res) => {
  const { author, content } = req.body || {};
  const db = readDb();
  const article = db.articles.find((item) => item.id === req.params.id);

  if (!article) {
    return res.status(404).json({ error: 'Article introuvable.' });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Le commentaire est vide.' });
  }

  const comment = {
    id: `comment-${Date.now()}`,
    author: author && author.trim() ? author.trim() : 'Anonyme',
    content: content.trim(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  article.comments = Array.isArray(article.comments) ? article.comments : [];
  article.comments.push(comment);
  writeDb(db);

  res.status(201).json({ success: true, comment });
});

app.get('/api/admin/dashboard', requireAuth, (req, res) => {
  const db = readDb();
  const articles = [...db.articles]
    .map(normalizeArticle)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const allComments = articles.flatMap((article) => article.comments.map((comment) => ({
    ...comment,
    articleId: article.id,
    articleTitle: article.title
  })));

  const stats = {
    totalArticles: articles.length,
    publishedArticles: articles.filter((article) => article.status === 'published').length,
    hiddenArticles: articles.filter((article) => article.status === 'hidden').length,
    totalComments: allComments.length,
    pendingComments: allComments.filter((comment) => comment.status === 'pending').length,
    totalLikes: articles.reduce((sum, article) => sum + Number(article.likes || 0), 0)
  };

  res.json({
    username: req.session.admin,
    stats,
    articles,
    siteContent: getSiteContent(db)
  });
});

app.patch('/api/admin/site-content', requireAuth, (req, res) => {
  const updates = req.body || {};
  const db = readDb();
  const current = getSiteContent(db);

  db.siteContent = Object.keys(DEFAULT_SITE_CONTENT).reduce((content, key) => {
    content[key] = typeof updates[key] === 'string' ? updates[key].trim() : current[key];
    return content;
  }, {});

  writeDb(db);
  res.json({ success: true, siteContent: db.siteContent });
});

app.post('/api/admin/articles', requireAuth, upload.single('image'), (req, res) => {
  const { title, content, imageUrl, category, status } = req.body || {};

  if (!title || !content || !title.trim() || !content.trim()) {
    return res.status(400).json({ error: 'Le titre et le contenu sont obligatoires.' });
  }

  const db = readDb();
  const article = {
    id: `article-${Date.now()}`,
    title: title.trim(),
    excerpt: (content.trim().slice(0, 150) + (content.trim().length > 150 ? '...' : '')).trim(),
    content: content.trim(),
    imageUrl: req.file ? `/uploads/${req.file.filename}` : (imageUrl && imageUrl.trim() ? imageUrl.trim() : 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=80'),
    category: category && category.trim() ? category.trim() : 'Actualité',
    status: status === 'hidden' ? 'hidden' : 'published',
    createdAt: new Date().toISOString(),
    likes: 0,
    comments: []
  };

  db.articles.unshift(article);
  writeDb(db);

  res.status(201).json({ success: true, article });
});

app.patch('/api/admin/articles/:id', requireAuth, upload.single('image'), (req, res) => {
  const { title, excerpt, content, imageUrl, category } = req.body || {};
  if (!title || !content || !title.trim() || !content.trim()) {
    return res.status(400).json({ error: 'Le titre et le contenu sont obligatoires.' });
  }

  const db = readDb();
  const article = db.articles.find((item) => item.id === req.params.id);
  if (!article) {
    return res.status(404).json({ error: 'Article introuvable.' });
  }

  article.title = title.trim();
  article.excerpt = excerpt && excerpt.trim() ? excerpt.trim() : content.trim().slice(0, 150);
  article.content = content.trim();
  article.imageUrl = req.file ? `/uploads/${req.file.filename}` : (imageUrl && imageUrl.trim() ? imageUrl.trim() : article.imageUrl);
  article.category = category && category.trim() ? category.trim() : 'Actualité';
  writeDb(db);

  res.json({ success: true, article: normalizeArticle(article) });
});

app.patch('/api/admin/articles/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  if (!['published', 'hidden'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  const db = readDb();
  const article = db.articles.find((item) => item.id === req.params.id);

  if (!article) {
    return res.status(404).json({ error: 'Article introuvable.' });
  }

  article.status = status;
  writeDb(db);
  res.json({ success: true, status: article.status });
});

app.delete('/api/admin/articles/:id', requireAuth, (req, res) => {
  const db = readDb();
  const articleExists = db.articles.some((article) => article.id === req.params.id);

  if (!articleExists) {
    return res.status(404).json({ error: 'Article introuvable.' });
  }

  db.articles = db.articles.filter((article) => article.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

app.patch('/api/admin/comments/:commentId/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const allowedStatus = ['approved', 'pending', 'hidden'];

  if (!allowedStatus.includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  const db = readDb();
  let found = false;

  db.articles.forEach((article) => {
    article.comments = Array.isArray(article.comments) ? article.comments : [];
    const comment = article.comments.find((item) => item.id === req.params.commentId);

    if (comment) {
      comment.status = status;
      found = true;
    }
  });

  if (!found) {
    return res.status(404).json({ error: 'Commentaire introuvable.' });
  }

  writeDb(db);
  res.json({ success: true });
});

app.delete('/api/admin/comments/:commentId', requireAuth, (req, res) => {
  const db = readDb();
  let found = false;

  db.articles.forEach((article) => {
    article.comments = Array.isArray(article.comments) ? article.comments : [];
    const before = article.comments.length;
    article.comments = article.comments.filter((comment) => {
      if (comment.id === req.params.commentId) {
        found = true;
        return false;
      }
      return true;
    });

    if (before !== article.comments.length) {
      found = true;
    }
  });

  if (!found) {
    return res.status(404).json({ error: 'Commentaire introuvable.' });
  }

  writeDb(db);
  res.json({ success: true });
});

app.get('*', (req, res) => {
  const indexFile = path.join(FRONTEND_DIR, 'index.html');
  return res.sendFile(indexFile);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur lancé sur http://0.0.0.0:${PORT}`);
});
