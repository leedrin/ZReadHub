const state = {
  catalog: null,
  query: '',
  activeProjectId: null,
  activeSlug: null,
  pageCache: new Map(),
  notice: '',
  userConfig: {
    deletedIds: [],
    edits: {},
    customProjects: []
  }
};

const renderingConfig = {
  zreadBrowseBaseUrl: 'http://localhost:9681',
  preferIframeReader: false
};
const STORAGE_KEY = 'wikihub.projectPortal.v1';
const adminApiConfig = {
  baseUrl: 'http://127.0.0.1:4174'
};

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function escapeHtml(str) {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function mdToHtml(md) {
  if (!window.marked) {
    return `<pre><code>${escapeHtml(md)}</code></pre>`;
  }

  window.marked.setOptions({
    gfm: true,
    breaks: true
  });

  const renderer = new window.marked.Renderer();

  renderer.code = (codeOrToken, infoString) => {
    let code = '';
    let lang = '';

    if (codeOrToken && typeof codeOrToken === 'object') {
      code = String(codeOrToken.text ?? '');
      lang = String(codeOrToken.lang ?? '').trim().toLowerCase();
    } else {
      code = String(codeOrToken ?? '');
      lang = String(infoString ?? '').trim().toLowerCase();
    }

    if (lang === 'mermaid') {
      return (
        `<div class="mermaid-container">` +
        `<div class="mermaid-header">mermaid</div>` +
        `<div class="mermaid-body"><pre class="mermaid">${escapeHtml(code)}</pre></div>` +
        `</div>`
      );
    }

    const langLabel = lang || 'text';
    const cls = lang ? ` class="language-${lang}"` : '';
    return (
      `<div class="code-block">` +
      `<div class="code-block-header"><span class="lang-label">${escapeHtml(langLabel)}</span></div>` +
      `<pre class="code-block-body"><code${cls}>${escapeHtml(code)}</code></pre>` +
      `</div>`
    );
  };

  renderer.heading = function (textOrToken, level, raw) {
    let text = '';
    let depth = level;
    if (textOrToken && typeof textOrToken === 'object') {
      text = textOrToken.text ?? '';
      depth = textOrToken.depth ?? level;
    } else {
      text = textOrToken ?? '';
      depth = level ?? 1;
    }
    const slug = slugifyHeading(String(text));
    return `<h${depth} id="${slug}">${text}</h${depth}>`;
  };

  renderer.table = function (header, body) {
    if (header && typeof header === 'object' && !body) {
      return renderTableFromToken(header);
    }
    return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`;
  };

  renderer.tablerow = function (content) {
    if (content && typeof content === 'object') {
      const cells = content;
      return `<tr>${cells}</tr>`;
    }
    return `<tr>${content}</tr>`;
  };

  renderer.tablecell = function (content, flags) {
    if (content && typeof content === 'object' && !flags) {
      const cell = content;
      const tag = cell.header ? 'th' : 'td';
      const align = cell.align ? ` style="text-align:${cell.align}"` : '';
      return `<${tag}${align}>${cell.tokens ? cell.tokens.map(t => t.raw || t.text || '').join('') : cell.text || ''}</${tag}>`;
    }
    const tag = flags && flags.header ? 'th' : 'td';
    const align = flags && flags.align ? ` style="text-align:${flags.align}"` : '';
    return `<${tag}${align}>${content}</${tag}>`;
  };

  return window.marked.parse(md, { renderer });
}

function renderTableFromToken(token) {
  let html = '<table><thead>';
  html += '<tr>';
  for (const cell of (token.header || [])) {
    const align = cell.align ? ` style="text-align:${cell.align}"` : '';
    html += `<th${align}>${cell.text || ''}</th>`;
  }
  html += '</tr></thead>';
  html += '<tbody>';
  for (const row of (token.rows || [])) {
    html += '<tr>';
    for (const cell of row) {
      const align = cell.align ? ` style="text-align:${cell.align}"` : '';
      html += `<td${align}>${cell.text || ''}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-');
}

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized || !window.mermaid) return;
  mermaidInitialized = true;
  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'default'
  });
}

async function renderMermaid(container) {
  const nodes = container.querySelectorAll('.mermaid');
  if (!nodes.length || !window.mermaid) return;

  initMermaid();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const code = node.textContent?.trim();
    if (!code) continue;

    const id = `mermaid-svg-${Date.now()}-${i}`;
    try {
      const { svg } = await window.mermaid.render(id, code);
      node.innerHTML = svg;
    } catch (error) {
      console.warn(`Mermaid diagram #${i} failed:`, error);
    }
  }

  container.querySelectorAll('.mermaid-container').forEach(mc => {
    mc.addEventListener('click', () => openMermaidFullscreen(mc));
  });
}

function openMermaidFullscreen(mc) {
  const svg = mc.querySelector('svg');
  if (!svg) return;

  const overlay = document.createElement('div');
  overlay.className = 'mermaid-overlay';

  const inner = document.createElement('div');
  inner.className = 'mermaid-overlay-inner';
  inner.innerHTML = svg.outerHTML;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'mermaid-overlay-close';
  closeBtn.textContent = '×';

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  closeBtn.addEventListener('click', close);

  overlay.append(inner, closeBtn);
  document.body.append(overlay);

  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

async function loadCatalog() {
  const res = await fetch('/hub-data/catalog.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('catalog load failed');
  return res.json();
}

async function reloadCatalog() {
  state.catalog = await loadCatalog();
}

async function callAdminApi(path, payload) {
  const res = await fetch(`${adminApiConfig.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `admin api failed: ${res.status}`);
  }
  return res.json();
}

function loadUserConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.userConfig = {
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
      edits: parsed.edits && typeof parsed.edits === 'object' ? parsed.edits : {},
      customProjects: Array.isArray(parsed.customProjects) ? parsed.customProjects : []
    };
  } catch (error) {
    console.warn('Failed to load user config', error);
  }
}

function saveUserConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.userConfig));
}

function showNotice(message) {
  state.notice = message;
}

function getMergedProjects() {
  const baseProjects = (state.catalog?.projects || [])
    .filter((project) => !state.userConfig.deletedIds.includes(project.id))
    .map((project) => {
      const edit = state.userConfig.edits[project.id] || {};
      return {
        ...project,
        title: edit.title || project.title,
        summary: edit.summary || project.summary,
        mode: 'scanned'
      };
    });

  const customProjects = state.userConfig.customProjects.map((project) => ({
    ...project,
    mode: 'external',
    pageCount: 0,
    tags: project.tags || ['custom'],
    pages: []
  }));

  return [...baseProjects, ...customProjects];
}

function filteredProjects() {
  const list = getMergedProjects();
  const q = state.query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(p => (p.title + ' ' + p.summary).toLowerCase().includes(q));
}

function promptRequired(message, initial = '') {
  const value = window.prompt(message, initial);
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
}

async function addProjectByLocalPath(app) {
  const wikiPath = promptRequired(
    '新增项目入口 - 请输入本地 wiki 路径（可填 .zread/wiki/current、版本目录或 wiki.json）'
  );
  if (!wikiPath) return;

  try {
    const result = await callAdminApi('/import-path', { wikiPath });
    const importedId = result?.entry?.id;
    const importedTitle = result?.entry?.title || importedId || '项目';

    if (importedId) {
      state.userConfig.deletedIds = state.userConfig.deletedIds.filter((id) => id !== importedId);
    }
    state.query = '';
    saveUserConfig();
    await reloadCatalog();
    showNotice(`添加项目成功：${importedTitle}`);
    renderDashboard(app);
  } catch (error) {
    const message = `导入失败：${error.message}`;
    showNotice(message);
    window.alert(message);
    renderDashboard(app);
  }
}

function addExternalEntry(app) {
  const title = promptRequired('新增外部入口 - 标题');
  if (!title) return;
  const summary = window.prompt('新增外部入口 - 简介', '自定义项目入口')?.trim() || '自定义项目入口';
  const entryUrl = promptRequired('新增外部入口 - URL（例如 http://localhost:9681/20-hao-you-yu-liao-tian-xi-tong）');
  if (!entryUrl) return;

  state.userConfig.customProjects.push({
    id: `custom-${Date.now()}`,
    title,
    summary,
    entryUrl
  });
  saveUserConfig();
  renderDashboard(app);
}

function editProjectCard(project) {
  if (project.mode === 'external') {
    const title = promptRequired('编辑项目 - 标题', project.title);
    if (!title) return;
    const summary = window.prompt('编辑项目 - 简介', project.summary || '')?.trim() || '';
    const entryUrl = promptRequired('编辑项目 - 入口 URL', project.entryUrl || '');
    if (!entryUrl) return;

    state.userConfig.customProjects = state.userConfig.customProjects.map((item) =>
      item.id === project.id ? { ...item, title, summary, entryUrl } : item
    );
  } else {
    const title = promptRequired('编辑项目 - 标题', project.title);
    if (!title) return;
    const summary = window.prompt('编辑项目 - 简介', project.summary || '')?.trim() || '';
    state.userConfig.edits[project.id] = { title, summary };
  }
  saveUserConfig();
}

function deleteProjectCard(project) {
  if (!window.confirm(`确认删除项目卡片「${project.title}」？`)) return;

  if (project.mode === 'external') {
    state.userConfig.customProjects = state.userConfig.customProjects.filter((item) => item.id !== project.id);
  } else if (!state.userConfig.deletedIds.includes(project.id)) {
    state.userConfig.deletedIds.push(project.id);
  }

  if (state.activeProjectId === project.id) {
    state.activeProjectId = null;
    state.activeSlug = null;
    history.pushState({}, '', '#/');
  }
  saveUserConfig();
}

function openProject(project, app, slug) {
  state.activeProjectId = project.id;
  state.activeSlug = slug || (project.mode === 'external' ? null : project.pages[0]?.slug || null);
  history.pushState({}, '', `#/${project.id}/${state.activeSlug || ''}`);
  render(app);
}

function renderDashboard(app) {
  app.innerHTML = '';
  const header = el('div', 'header');
  const mergedProjects = getMergedProjects();
  header.append(
    el('div', 'brand', 'Wiki Hub'),
    el('div', 'sub', `聚合 ${mergedProjects.length} 个项目入口（含本地扫描与自定义）`)
  );

  const actions = el('div', 'header-actions');
  const addPathBtn = el('button', 'header-btn', '导入本地Wiki路径');
  addPathBtn.onclick = async () => {
    await addProjectByLocalPath(app);
  };
  const addExternalBtn = el('button', 'header-btn', '新增外部入口');
  addExternalBtn.onclick = () => {
    addExternalEntry(app);
  };
  actions.append(addPathBtn, addExternalBtn);
  header.append(actions);

  if (state.notice) {
    const notice = el('div', 'notice', state.notice);
    const closeBtn = el('button', 'notice-close', '×');
    closeBtn.onclick = () => {
      state.notice = '';
      renderDashboard(app);
    };
    notice.append(closeBtn);
    header.append(notice);
  }

  const input = el('input', 'search');
  input.placeholder = '搜索项目名/简介';
  input.value = state.query;
  input.oninput = () => { state.query = input.value; renderDashboard(app); };
  header.append(input);
  app.append(header);

  const cards = el('div', 'cards');
  const projects = filteredProjects();
  if (!projects.length) {
    const empty = el('div', 'empty', '没有匹配到项目，请修改关键词。');
    app.append(empty);
    return;
  }

  projects.forEach(project => {
    const card = el('div', 'card');
    card.onclick = () => openProject(project, app);
    const cardActions = el('div', 'card-actions');
    const editBtn = el('button', 'card-action-btn', '编辑');
    editBtn.onclick = (event) => {
      event.stopPropagation();
      editProjectCard(project);
      renderDashboard(app);
    };
    const delBtn = el('button', 'card-action-btn danger', '删除');
    delBtn.onclick = (event) => {
      event.stopPropagation();
      deleteProjectCard(project);
      render(app);
    };
    cardActions.append(editBtn, delBtn);

    const t = el('h3', null, project.title);
    const d = el('p', null, project.summary || 'Local zread wiki project');
    const meta = el('div', 'meta');
    meta.append(
      el('span', null, `${project.pageCount ?? 0} pages`),
      el('span', null, project.mode === 'external' ? 'custom' : (project.generatedAt ? project.generatedAt.slice(0, 19).replace('T', ' ') : 'N/A'))
    );
    const tags = el('div', 'tags');
    (project.tags || []).slice(0, 4).forEach(tag => tags.append(el('span', 'tag', tag)));
    card.append(cardActions, t, d, meta, tags);
    cards.append(card);
  });

  app.append(cards);
}

async function loadPageContent(project, slug) {
  const key = `${project.id}:${slug}`;
  if (state.pageCache.has(key)) return state.pageCache.get(key);
  const page = project.pages.find(p => p.slug === slug);
  if (!page) return '# Not Found\n\nPage missing.';
  try {
    const url = `${adminApiConfig.baseUrl}/page-content?projectId=${encodeURIComponent(project.id)}&slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const txt = String(data?.content || '');
      state.pageCache.set(key, txt);
      return txt;
    }
  } catch {
    // fallback below
  }

  const legacyPath = `${project.dataBase}/pages/${page.file}`;
  const legacyRes = await fetch(legacyPath, { cache: 'no-store' });
  const txt = await legacyRes.text();
  state.pageCache.set(key, txt);
  return txt;
}

function renderIframeReader(main, slug) {
  const frame = el('iframe', 'reader-frame');
  frame.src = `${renderingConfig.zreadBrowseBaseUrl}/${slug}`;
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer';
  frame.title = `zread-page-${slug}`;
  main.append(frame);
}

function renderExternalReader(main, entryUrl) {
  const frame = el('iframe', 'reader-frame');
  frame.src = entryUrl;
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer';
  frame.title = 'custom-project-entry';
  main.append(frame);
}

function buildProjectToc(project) {
  const pages = project.pages || [];
  const canonicalTitle = (title) => String(title || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）\[\]【】|｜:：\-—_]/g, '')
    .replace(/v\d+(\.\d+)?$/g, '')
    .replace(/(标注版|思维导图|脑图|流程图|草案|draft|final|最终版)$/g, '');

  const pageScore = (page) => {
    const t = String(page?.title || '');
    let score = t.length;
    if (/标注版|思维导图|脑图|流程图|草案|draft|final|最终版/i.test(t)) score += 1000;
    if (/v\d+(\.\d+)?/i.test(t)) score += 100;
    return score;
  };

  const uniquePages = [];
  const seenSlug = new Set();
  const seenFile = new Set();
  const seenTitleKeyToIndex = new Map();

  for (const page of pages) {
    const slugKey = String(page?.slug || '').trim();
    const fileKey = String(page?.file || '').trim().toLowerCase();
    const titleKey = canonicalTitle(page?.title);
    if (slugKey && seenSlug.has(slugKey)) continue;
    if (fileKey && seenFile.has(fileKey)) continue;

    if (titleKey) {
      const existingIndex = seenTitleKeyToIndex.get(titleKey);
      if (existingIndex !== undefined) {
        const existingPage = uniquePages[existingIndex];
        if (pageScore(page) < pageScore(existingPage)) {
          uniquePages[existingIndex] = page;
          if (slugKey) seenSlug.add(slugKey);
          if (fileKey) seenFile.add(fileKey);
        }
        continue;
      }
    }

    if (slugKey) seenSlug.add(slugKey);
    if (fileKey) seenFile.add(fileKey);
    uniquePages.push(page);
    if (titleKey) seenTitleKeyToIndex.set(titleKey, uniquePages.length - 1);
  }

  const sections = new Map();
  const sectionOrder = [];

  for (const page of uniquePages) {
    const section = page.section || 'Default';
    if (!sections.has(section)) {
      sections.set(section, { groups: new Map(), groupOrder: [] });
      sectionOrder.push(section);
    }
    const sectionData = sections.get(section);
    const group = page.group || '';
    if (!sectionData.groups.has(group)) {
      sectionData.groups.set(group, []);
      sectionData.groupOrder.push(group);
    }
    sectionData.groups.get(group).push(page);
  }

  const toc = el('div', 'sidebar-section');

  for (const sectionName of sectionOrder) {
    const sectionData = sections.get(sectionName);
    const sectionTitle = el('div', 'toc-section-title', sectionName);
    toc.append(sectionTitle);

    for (const groupName of sectionData.groupOrder) {
      if (groupName) {
        const groupTitle = el('div', 'toc-group-title', groupName);
        toc.append(groupTitle);
      }
      const pagesInGroup = sectionData.groups.get(groupName);
      for (const page of pagesInGroup) {
        const item = el('div', `toc-item${page.slug === state.activeSlug ? ' active' : ''}`);
        item.textContent = page.title;
        item.onclick = () => {
          state.activeSlug = page.slug;
          history.pushState({}, '', `#/${state.activeProjectId}/${page.slug}`);
          renderReaderContent(document.getElementById('app'));
        };
        toc.append(item);
      }
    }
  }

  return toc;
}

async function renderReaderContent(app) {
  const mergedProjects = getMergedProjects();
  const project = mergedProjects.find(p => p.id === state.activeProjectId);
  if (!project) {
    state.activeProjectId = null;
    render(app);
    return;
  }

  const shell = el('div', 'reader');
  const left = el('aside', 'projects-pane');

  const projectSection = el('div', 'sidebar-section');
  const projectsTitle = el('div', 'section-title', 'Projects');
  projectSection.append(projectsTitle);
  mergedProjects.forEach(p => {
    const item = el('div', `project-item${p.id === project.id ? ' active' : ''}`, p.title);
    item.onclick = () => {
      openProject(p, app);
    };
    projectSection.append(item);
  });
  left.append(projectSection);

  if (project.mode === 'scanned' && project.pages?.length) {
    left.append(buildProjectToc(project));
  }

  const main = el('main', 'content-pane');
  const head = el('div', 'content-head');
  const back = el('button', 'back', '← 返回门户');
  back.onclick = () => {
    state.activeProjectId = null;
    state.activeSlug = null;
    history.pushState({}, '', '#/');
    render(app);
  };
  const ptitle = el('div', 'content-head-title', project.title);
  head.append(back, ptitle);

  const currentSlug = state.activeSlug || project.pages[0]?.slug;
  if (project.mode === 'external' && project.entryUrl) {
    renderExternalReader(main, project.entryUrl);
  } else if (renderingConfig.preferIframeReader && currentSlug) {
    renderIframeReader(main, currentSlug);
  } else {
    const md = await loadPageContent(project, currentSlug);
    const article = el('article', 'article');
    article.innerHTML = mdToHtml(md);
    main.append(article);
    await renderMermaid(article);
  }

  main.prepend(head);
  shell.append(left, main);
  app.innerHTML = '';
  app.append(shell);
}

function readHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) return;
  const [pid, ...slugParts] = hash.split('/');
  if (pid) state.activeProjectId = pid;
  if (slugParts.length) {
    const rawSlug = slugParts.join('/');
    try {
      state.activeSlug = decodeURIComponent(rawSlug);
    } catch {
      state.activeSlug = rawSlug;
    }
  }
}

async function render(app) {
  if (state.activeProjectId) {
    await renderReaderContent(app);
  } else {
    renderDashboard(app);
  }
}

async function boot() {
  const app = document.getElementById('app');
  try {
    initMermaid();
    loadUserConfig();
    await reloadCatalog();
    readHash();
    await render(app);
    window.addEventListener('popstate', () => { readHash(); render(app); });
  } catch (e) {
    app.innerHTML = `<div class="empty">加载失败：${e.message}</div>`;
  }
}

boot();
