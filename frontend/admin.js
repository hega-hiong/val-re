const loginPanel = document.querySelector('#loginPanel');
const dashboardPanel = document.querySelector('#dashboardPanel');
const loginForm = document.querySelector('#loginForm');
const articleForm = document.querySelector('#articleForm');
const moderationList = document.querySelector('#moderationList');
const articleList = document.querySelector('#articleList');
const logoutBtn = document.querySelector('#logoutBtn');
const contentForm = document.querySelector('#contentForm');
const dashboardViews = document.querySelectorAll('[data-dashboard-view]');

function showRequestError(response, data, fallback) {
  if (response.status === 401) {
    alert('Votre session admin a expiré. Reconnectez-vous.');
  } else {
    alert(data?.error || fallback);
  }
}

document.querySelectorAll('[data-view-target]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-view-target]').forEach((item) => item.classList.remove('active'));
    dashboardViews.forEach((view) => view.classList.toggle('hidden', view.dataset.dashboardView !== button.dataset.viewTarget));
    button.classList.add('active');
  });
});

function fillContentForm(siteContent) {
  Object.entries(siteContent || {}).forEach(([key, value]) => {
    const field = contentForm.elements.namedItem(key);
    if (field) field.value = value;
  });
}

function setStats(data) {
  document.querySelector('#stat-total-articles').textContent = data.stats.totalArticles || 0;
  document.querySelector('#stat-published').textContent = data.stats.publishedArticles || 0;
  document.querySelector('#stat-hidden').textContent = data.stats.hiddenArticles || 0;
  document.querySelector('#stat-comments').textContent = data.stats.totalComments || 0;
  document.querySelector('#stat-likes').textContent = data.stats.totalLikes || 0;
  document.querySelector('#stat-pending').textContent = data.stats.pendingComments || 0;
}

async function checkSession() {
  const response = await fetch('/api/session');
  const data = await response.json();

  if (data.loggedIn) {
    loginPanel.classList.add('hidden');
    dashboardPanel.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadDashboard();
  } else {
    loginPanel.classList.remove('hidden');
    dashboardPanel.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const payload = {
    username: formData.get('username'),
    password: formData.get('password')
  };

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || 'Connexion impossible.');
    return;
  }

  loginPanel.classList.add('hidden');
  dashboardPanel.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
  loadDashboard();
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  checkSession();
});

contentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(contentForm);
  const payload = Object.fromEntries(formData.entries());
  const response = await fetch('/api/admin/site-content', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    showRequestError(response, data, 'Enregistrement impossible.');
    return;
  }

  fillContentForm(data.siteContent);
  alert('Les textes du site ont été enregistrés.');
});

articleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(articleForm);
  const payload = {
    title: formData.get('title')?.toString().trim(),
    category: formData.get('category')?.toString().trim(),
    imageUrl: formData.get('imageUrl')?.toString().trim(),
    content: formData.get('content')?.toString().trim()
  };

  const response = await fetch('/api/admin/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    showRequestError(response, data, 'Publication impossible.');
    return;
  }

  articleForm.reset();
  loadDashboard();
  alert('Article publié avec succès.');
});

function renderArticleAdminList(items) {
  articleList.innerHTML = '';

  if (!items.length) {
    articleList.innerHTML = '<p class="empty-state">Aucun article pour le moment.</p>';
    return;
  }

  items.forEach((article) => {
    const template = document.querySelector('#articleAdminTemplate');
    const node = template.content.cloneNode(true);
    const statusPill = node.querySelector('.status-pill');

    node.querySelector('.admin-article-title').textContent = article.title;
    node.querySelector('.admin-article-meta').textContent = `${article.category || 'Actualité'} • ${article.likes || 0} likes`;
    statusPill.textContent = article.status === 'published' ? 'Publié' : 'Masqué';
    statusPill.classList.add(article.status === 'published' ? 'published' : 'hidden');

    const editForm = node.querySelector('.article-edit-form');
    editForm.elements.title.value = article.title || '';
    editForm.elements.excerpt.value = article.excerpt || '';
    editForm.elements.category.value = article.category || '';
    editForm.elements.imageUrl.value = article.imageUrl || '';
    editForm.elements.content.value = article.content || '';

    node.querySelector('[data-action="edit"]').addEventListener('click', () => {
      editForm.classList.remove('hidden');
    });
    node.querySelector('[data-action="cancel-edit"]').addEventListener('click', () => {
      editForm.classList.add('hidden');
    });
    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      updateArticle(article.id, editForm);
    });

    const toggleButton = node.querySelector('[data-action="toggle"]');
    toggleButton.textContent = article.status === 'published' ? 'Masquer' : 'Publier';
    toggleButton.addEventListener('click', () => {
      const nextStatus = article.status === 'published' ? 'hidden' : 'published';
      updateArticleStatus(article.id, nextStatus);
    });

    node.querySelector('[data-action="delete"]').addEventListener('click', () => deleteArticle(article.id));
    articleList.appendChild(node);
  });
}

async function updateArticle(articleId, form) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const response = await fetch(`/api/admin/articles/${articleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    showRequestError(response, data, 'Modification impossible.');
    return;
  }

  loadDashboard();
  alert('Article modifié avec succès.');
}

function renderModeration(items) {
  moderationList.innerHTML = '';

  if (!items.length) {
    moderationList.innerHTML = '<p class="empty-state">Aucun commentaire pour l’instant.</p>';
    return;
  }

  items.forEach((comment) => {
    const template = document.querySelector('#moderationItemTemplate');
    const node = template.content.cloneNode(true);

    node.querySelector('.comment-author').textContent = `${comment.author || 'Anonyme'} • ${comment.articleTitle || 'Article'}`;
    node.querySelector('.comment-status').textContent = comment.status;
    node.querySelector('.comment-text').textContent = comment.content;

    node.querySelector('[data-action="approve"]').addEventListener('click', () => updateCommentStatus(comment.id, 'approved'));
    node.querySelector('[data-action="hide"]').addEventListener('click', () => updateCommentStatus(comment.id, 'hidden'));
    node.querySelector('[data-action="delete"]').addEventListener('click', () => deleteComment(comment.id));

    moderationList.appendChild(node);
  });
}

async function updateArticleStatus(articleId, status) {
  const response = await fetch(`/api/admin/articles/${articleId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (response.ok) {
    loadDashboard();
  } else {
    const data = await response.json();
    showRequestError(response, data, 'Impossible de modifier le statut.');
  }
}

async function deleteArticle(articleId) {
  const response = await fetch(`/api/admin/articles/${articleId}`, {
    method: 'DELETE'
  });

  if (response.ok) {
    loadDashboard();
  } else {
    const data = await response.json();
    showRequestError(response, data, 'Impossible de supprimer cet article.');
  }
}

async function updateCommentStatus(commentId, status) {
  const response = await fetch(`/api/admin/comments/${commentId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (response.ok) {
    loadDashboard();
  } else {
    const data = await response.json();
    showRequestError(response, data, 'Impossible de modifier ce commentaire.');
  }
}

async function deleteComment(commentId) {
  const response = await fetch(`/api/admin/comments/${commentId}`, {
    method: 'DELETE'
  });

  if (response.ok) {
    loadDashboard();
  } else {
    const data = await response.json();
    showRequestError(response, data, 'Impossible de supprimer ce commentaire.');
  }
}

async function loadDashboard() {
  const response = await fetch('/api/admin/dashboard');
  const data = await response.json();

  if (!response.ok) {
    alert(data.error || 'Impossible d’accéder au tableau de bord.');
    return;
  }

  setStats(data);
  fillContentForm(data.siteContent);
  renderArticleAdminList(data.articles || []);

  const comments = [];
  (data.articles || []).forEach((article) => {
    (article.comments || []).forEach((comment) => comments.push({ ...comment, articleTitle: article.title }));
  });

  renderModeration(comments);
}

checkSession();
