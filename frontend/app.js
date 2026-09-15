const articleTemplate = document.querySelector('#article-template');
const articlesContainer = document.querySelector('#articles');

function applySiteContent(siteContent) {
  document.querySelectorAll('[data-content]').forEach((element) => {
    const key = element.dataset.content;
    if (siteContent[key]) {
      element.textContent = siteContent[key];
      if (key === 'contactEmail' && element.tagName === 'A') {
        element.href = `mailto:${siteContent[key]}`;
      }
    }
  });
}

function getUserId() {
  let userId = localStorage.getItem('valere-user-id');

  if (!userId) {
    userId = `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('valere-user-id', userId);
  }

  return userId;
}

function getLikedArticleIds() {
  try {
    const stored = JSON.parse(localStorage.getItem('valere-liked-articles') || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function toggleLikedArticle(articleId, liked) {
  const likedIds = getLikedArticleIds();
  const nextIds = liked ? [...new Set([...likedIds, articleId])] : likedIds.filter((id) => id !== articleId);
  localStorage.setItem('valere-liked-articles', JSON.stringify(nextIds));
}

async function fetchArticles() {
  const response = await fetch('/api/articles');
  const data = await response.json();
  return data;
}

function renderComment(comment) {
  const item = document.createElement('div');
  item.className = 'comment-item';
  item.innerHTML = `
    <strong>${escapeHtml(comment.author || 'Anonyme')}</strong>
    <p>${escapeHtml(comment.content || '')}</p>
  `;
  return item;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function renderArticles(articles) {
  if (!articlesContainer || !articleTemplate) return;
  articlesContainer.innerHTML = '';

  if (!articles.length) {
    articlesContainer.innerHTML = '<p class="empty-state">Aucune actualité pour le moment.</p>';
    return;
  }

  articles.forEach((article) => {
    const fragment = articleTemplate.content.cloneNode(true);
    const img = fragment.querySelector('.article-image');
    const category = fragment.querySelector('.category');
    const date = fragment.querySelector('.date');
    const title = fragment.querySelector('.article-title');
    const excerpt = fragment.querySelector('.article-excerpt');
    const content = fragment.querySelector('.article-content');
    const likeButton = fragment.querySelector('.like-button');
    const likeCount = fragment.querySelector('.like-count');
    const commentsList = fragment.querySelector('.comments-list');
    const form = fragment.querySelector('.comment-form');
    const isAlreadyLiked = getLikedArticleIds().includes(article.id);

    img.src = article.imageUrl;
    img.alt = article.title;
    category.textContent = article.category || 'Actualité';
    date.textContent = formatDate(article.createdAt);
    title.textContent = article.title;
    excerpt.textContent = article.excerpt || 'Aucune description.';
    content.innerHTML = article.content
      .split('\n')
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
    likeCount.textContent = article.likes || 0;
    likeButton.dataset.articleId = article.id;
    likeButton.textContent = isAlreadyLiked ? '♥ Vous aimez' : '❤ J’aime';

    (article.comments || []).forEach((comment) => {
      commentsList.appendChild(renderComment(comment));
    });

    likeButton.addEventListener('click', async () => {
      const userId = getUserId();
      const articleId = article.id;
      const isLiked = getLikedArticleIds().includes(articleId);
      const method = isLiked ? 'DELETE' : 'POST';
      const response = await fetch(`/api/articles/${articleId}/like`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Action impossible.');
        return;
      }

      toggleLikedArticle(articleId, data.liked);
      likeCount.textContent = data.likes;
      likeButton.textContent = data.liked ? '♥ Vous aimez' : '❤ J’aime';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const author = formData.get('author')?.toString().trim() || 'Anonyme';
      const contentValue = formData.get('content')?.toString().trim();

      if (!contentValue) {
        alert('Saisissez un commentaire avant de l’envoyer.');
        return;
      }

      const response = await fetch(`/api/articles/${article.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, content: contentValue })
      });

      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Impossible d’ajouter le commentaire.');
        return;
      }

      const commentItem = renderComment(data.comment);
      commentsList.appendChild(commentItem);
      form.reset();
      alert('Votre commentaire a bien été envoyé et est en attente de modération.');
    });

    articlesContainer.appendChild(fragment);
  });
}

async function init() {
  const data = await fetchArticles();
  applySiteContent(data.siteContent || {});
  renderArticles(data.articles || []);
}

init();
