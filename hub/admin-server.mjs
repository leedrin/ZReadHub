import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';

const ROOT = 'F:/ZReadHub';
const HUB_DATA = path.join(ROOT, 'hub-data');
const PROJECTS_DIR = path.join(HUB_DATA, 'projects');
const CATALOG_PATH = path.join(HUB_DATA, 'catalog.json');

function withCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, '');
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(stripBom(raw));
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function hashProjectId(input) {
  return `p-${crypto.createHash('sha1').update(input).digest('hex').slice(0, 12)}`;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function extractProjectInfo(projectRoot) {
  const readmePath = path.join(projectRoot, 'README.md');
  if (!(await pathExists(readmePath))) {
    return {
      title: path.basename(projectRoot),
      summary: 'Markdown project'
    };
  }

  const readme = stripBom(await fs.readFile(readmePath, 'utf8'));
  const lines = readme.split(/\r?\n/).map((line) => line.trim());
  const heading = lines.find((line) => line.startsWith('#'));
  const summary = lines.find((line) => line && !line.startsWith('#'));
  return {
    title: heading ? heading.replace(/^#+\s*/, '').trim() : path.basename(projectRoot),
    summary: summary || 'Markdown project'
  };
}

function findProjectRootFromVersionPath(versionPath) {
  const normalized = path.resolve(versionPath);
  const marker = `${path.sep}.zread${path.sep}wiki${path.sep}versions${path.sep}`.toLowerCase();
  const lower = normalized.toLowerCase();
  const index = lower.indexOf(marker);
  if (index >= 0) {
    return normalized.slice(0, index);
  }
  return path.dirname(normalized);
}

async function resolveWikiVersionFromInput(inputPath) {
  const resolved = path.resolve(inputPath.trim().replace(/^"|"$/g, ''));
  const stat = await fs.stat(resolved);

  if (stat.isFile()) {
    const fileName = path.basename(resolved).toLowerCase();
    if (fileName === 'current') {
      const wikiRoot = path.dirname(resolved);
      const pointer = stripBom(await fs.readFile(resolved, 'utf8')).trim();
      return {
        type: 'zread',
        versionPath: path.resolve(path.join(wikiRoot, pointer)),
        projectRoot: path.resolve(path.join(wikiRoot, '..', '..'))
      };
    }
    if (fileName === 'wiki.json') {
      const versionPath = path.dirname(resolved);
      return {
        type: 'zread',
        versionPath,
        projectRoot: findProjectRootFromVersionPath(versionPath)
      };
    }
    if (fileName.endsWith('.md')) {
      return {
        type: 'plain-file',
        filePath: resolved,
        rootDir: path.dirname(resolved),
        projectRoot: path.dirname(resolved)
      };
    }
    throw new Error('不支持的文件类型。请提供 .md 文件、目录路径、wiki.json 或 .zread/wiki/current');
  }

  const currentUnderDir = path.join(resolved, '.zread', 'wiki', 'current');
  if (await pathExists(currentUnderDir)) {
    const pointer = stripBom(await fs.readFile(currentUnderDir, 'utf8')).trim();
    const versionPath = path.resolve(path.join(resolved, '.zread', 'wiki', pointer));
    return {
      type: 'zread',
      versionPath,
      projectRoot: resolved
    };
  }

  const currentInWikiDir = path.join(resolved, 'current');
  const versionsDir = path.join(resolved, 'versions');
  if ((await pathExists(currentInWikiDir)) && (await pathExists(versionsDir))) {
    const pointer = stripBom(await fs.readFile(currentInWikiDir, 'utf8')).trim();
    const versionPath = path.resolve(path.join(resolved, pointer));
    return {
      type: 'zread',
      versionPath,
      projectRoot: path.resolve(path.join(resolved, '..', '..'))
    };
  }

  const wikiJsonPath = path.join(resolved, 'wiki.json');
  if (await pathExists(wikiJsonPath)) {
    return {
      type: 'zread',
      versionPath: resolved,
      projectRoot: findProjectRootFromVersionPath(resolved)
    };
  }

  if (stat.isDirectory()) {
    return {
      type: 'plain',
      rootDir: resolved,
      projectRoot: resolved
    };
  }

  throw new Error('路径未识别。请提供 Markdown 目录、.md 文件或 zread wiki 路径。');
}

function ensureInside(baseDir, targetPath, label) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  const relative = path.relative(base, target);
  const escaped = relative.startsWith('..') || path.isAbsolute(relative);
  if (escaped) {
    throw new Error(`${label} 路径越界: ${target}`);
  }
  return target;
}

async function scanMarkdownFiles(rootDir) {
  const SKIP_DIRS = new Set([
    'node_modules', '.git', '.svn', '.hg', '.zread',
    '__pycache__', '.idea', '.vs', '.vscode',
    'dist', 'build', 'out', 'bin', 'obj', '.next', '.nuxt'
  ]);

  const results = [];

  async function walk(dir, depth) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const mdFiles = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name.toLowerCase()) || entry.name.startsWith('.')) continue;
        await walk(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        mdFiles.push({ fullPath, name: entry.name, dir, depth });
      }
    }

    mdFiles.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    results.push(...mdFiles);
  }

  await walk(rootDir, 0);
  return results;
}

function buildSlugFromRelative(relPath) {
  return relPath
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff_\-\/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function extractTitleFromContent(content, fallbackName) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headings = lines
    .filter((line) => /^#{1,6}\s+/.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/, '').trim())
    .filter(Boolean);

  const genericTitle = (title) => /^sheet[:：]\s*目录$/i.test(title) || /^目录$/.test(title);
  const firstMeaningful = headings.find((title) => !genericTitle(title));
  if (firstMeaningful) return firstMeaningful;

  if (headings[0] && !genericTitle(headings[0])) {
    return headings[0];
  }

  return fallbackName.replace(/\.md$/i, '');
}

function normalizeTitleKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .trim();
}

function formatFileLabel(filePath) {
  const base = path.basename(filePath || '', '.md');
  return base.replace(/[_-]+/g, ' ').trim();
}

function disambiguatePlainPages(pages) {
  const groups = new Map();
  for (const page of pages) {
    const sectionKey = String(page.section || '');
    const groupKey = String(page.group || '');
    const titleKey = normalizeTitleKey(page.title);
    const key = `${sectionKey}::${groupKey}::${titleKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(page);
  }

  for (const [, list] of groups) {
    if (list.length <= 1) continue;
    for (const page of list) {
      const label = formatFileLabel(page.file);
      page.title = `${page.title}（${label}）`;
    }
  }
}

async function importPlainMarkdownDir(rootDir, projectRoot) {
  const files = await scanMarkdownFiles(rootDir);

  if (!files.length) {
    throw new Error(`目录中没有找到 .md 文件: ${rootDir}`);
  }

  const projectId = hashProjectId(path.resolve(rootDir));
  const destDir = path.join(PROJECTS_DIR, projectId);
  await fs.mkdir(destDir, { recursive: true });

  const pages = [];
  const sections = new Set();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relToRoot = path.relative(rootDir, file.fullPath);
    const relDir = path.relative(rootDir, file.dir);
    const relFile = relToRoot.replace(/\\/g, '/');

    const content = stripBom(await fs.readFile(file.fullPath, 'utf8'));
    const title = extractTitleFromContent(content, file.name);
    const slug = buildSlugFromRelative(relFile) || `${i + 1}`;

    const section = relDir && relDir !== '.' ? relDir.replace(/\\/g, ' / ') : 'Root';
    sections.add(section);

    pages.push({
      slug,
      title,
      file: relFile,
      sourceFilePath: file.fullPath,
      section,
      level: '1'
    });
  }

  disambiguatePlainPages(pages);

  const projectInfo = await extractProjectInfo(projectRoot);
  const entry = {
    id: projectId,
    title: projectInfo.title,
    summary: projectInfo.summary,
    rootPath: projectRoot,
    versionId: null,
    generatedAt: new Date().toISOString(),
    language: null,
    pageCount: pages.length,
    tags: Array.from(sections),
    pages,
    sourceType: 'plain',
    sourceBasePath: rootDir,
    dataBase: `/hub-data/projects/${projectId}`
  };

  await writeJson(path.join(destDir, 'wiki.json'), entry);
  await upsertCatalog(entry);
  return entry;
}

async function importPlainMarkdownFile(filePath, projectRoot) {
  const absoluteFile = path.resolve(filePath);
  const stat = await fs.stat(absoluteFile);
  if (!stat.isFile() || !absoluteFile.toLowerCase().endsWith('.md')) {
    throw new Error(`不是有效的 Markdown 文件: ${filePath}`);
  }

  const projectId = hashProjectId(absoluteFile);
  const destDir = path.join(PROJECTS_DIR, projectId);
  await fs.mkdir(destDir, { recursive: true });

  const content = stripBom(await fs.readFile(absoluteFile, 'utf8'));
  const baseName = path.basename(absoluteFile);
  const title = extractTitleFromContent(content, baseName);
  const slug = buildSlugFromRelative(baseName) || 'index';
  const destFile = `${slug}.md`;

  const projectInfo = await extractProjectInfo(projectRoot);
  const entry = {
    id: projectId,
    title: projectInfo.title || title,
    summary: projectInfo.summary || 'Markdown project',
    rootPath: projectRoot,
    versionId: null,
    generatedAt: new Date().toISOString(),
    language: null,
    pageCount: 1,
    tags: ['Root'],
    pages: [
      {
        slug,
        title,
        file: destFile,
        sourceFilePath: absoluteFile,
        section: 'Root',
        level: '1'
      }
    ],
    sourceType: 'plain-file',
    sourceBasePath: path.dirname(absoluteFile),
    dataBase: `/hub-data/projects/${projectId}`
  };

  await writeJson(path.join(destDir, 'wiki.json'), entry);
  await upsertCatalog(entry);
  return entry;
}

async function importZreadWiki(versionPath, projectRoot) {
  const wikiJsonPath = path.join(versionPath, 'wiki.json');
  if (!(await pathExists(wikiJsonPath))) {
    throw new Error(`wiki.json 不存在: ${wikiJsonPath}`);
  }

  const wiki = await readJson(wikiJsonPath);
  const projectId = hashProjectId(path.resolve(projectRoot));
  const destinationProjectDir = path.join(PROJECTS_DIR, projectId);
  await fs.mkdir(destinationProjectDir, { recursive: true });

  const projectInfo = await extractProjectInfo(projectRoot);
  const pages = (wiki.pages || []).map((page) => {
    if (!page?.file) return page;
    const src = ensureInside(versionPath, path.join(versionPath, page.file), '源文件');
    return { ...page, sourceFilePath: src };
  });

  const entry = {
    id: projectId,
    title: projectInfo.title,
    summary: projectInfo.summary,
    rootPath: projectRoot,
    versionId: wiki.id || null,
    generatedAt: wiki.generated_at || null,
    language: wiki.language || null,
    pageCount: Array.isArray(pages) ? pages.length : 0,
    tags: Array.from(new Set((pages || []).map((page) => page.section).filter(Boolean))),
    pages,
    sourceType: 'zread',
    sourceBasePath: versionPath,
    dataBase: `/hub-data/projects/${projectId}`
  };

  await writeJson(path.join(destinationProjectDir, 'wiki.json'), entry);
  await upsertCatalog(entry);
  return entry;
}

async function loadCatalog() {
  if (!(await pathExists(CATALOG_PATH))) {
    return { generatedAt: new Date().toISOString(), totalProjects: 0, projects: [] };
  }
  return readJson(CATALOG_PATH);
}

async function resolveSourceFileFromProjectPage(project, page) {
  if (page?.sourceFilePath) return page.sourceFilePath;

  if (project?.sourceBasePath && page?.file) {
    return ensureInside(project.sourceBasePath, path.join(project.sourceBasePath, page.file), '源文件');
  }

  if (project?.rootPath && page?.file) {
    // Reconstruct zread source path from rootPath + versionId/current, so hub-data/projects cache is optional.
    const wikiRoot = path.join(project.rootPath, '.zread', 'wiki');
    if (await pathExists(wikiRoot)) {
      let versionDir = '';

      if (project.versionId) {
        const directVersion = path.join(wikiRoot, 'versions', String(project.versionId));
        if (await pathExists(directVersion)) {
          versionDir = directVersion;
        }
      }

      if (!versionDir) {
        const currentFile = path.join(wikiRoot, 'current');
        if (await pathExists(currentFile)) {
          const pointer = stripBom(await fs.readFile(currentFile, 'utf8')).trim();
          const resolved = path.resolve(path.join(wikiRoot, pointer));
          if (await pathExists(resolved)) {
            versionDir = resolved;
          }
        }
      }

      if (versionDir) {
        return ensureInside(versionDir, path.join(versionDir, page.file), '推导源文件');
      }
    }

    // Plain markdown project fallback: treat page.file as path relative to project root.
    const plainCandidate = path.resolve(path.join(project.rootPath, page.file));
    if (await pathExists(plainCandidate)) {
      return ensureInside(project.rootPath, plainCandidate, '普通项目源文件');
    }
  }

  if (project?.dataBase && page?.file) {
    const legacyProjectDir = path.join(ROOT, project.dataBase.replace(/^\//, ''));
    return ensureInside(path.join(legacyProjectDir, 'pages'), path.join(legacyProjectDir, 'pages', page.file), '旧缓存文件');
  }

  throw new Error('无法定位页面源文件');
}

async function upsertCatalog(entry) {
  const catalog = (await pathExists(CATALOG_PATH))
    ? await readJson(CATALOG_PATH)
    : { generatedAt: new Date().toISOString(), totalProjects: 0, projects: [] };

  const projects = (catalog.projects || []).filter((project) => project.id !== entry.id);
  projects.push(entry);
  projects.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-CN'));

  const nextCatalog = {
    generatedAt: new Date().toISOString(),
    totalProjects: projects.length,
    projects
  };

  await writeJson(CATALOG_PATH, nextCatalog);
}

async function importProjectByPath(wikiPath) {
  const resolved = await resolveWikiVersionFromInput(wikiPath);

  if (resolved.type === 'plain-file') {
    return importPlainMarkdownFile(resolved.filePath, resolved.projectRoot);
  }

  if (resolved.type === 'plain') {
    return importPlainMarkdownDir(resolved.rootDir, resolved.projectRoot);
  }

  return importZreadWiki(resolved.versionPath, resolved.projectRoot);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  withCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/page-content?')) {
    try {
      const requestUrl = new URL(req.url, 'http://127.0.0.1:4174');
      const projectId = requestUrl.searchParams.get('projectId') || '';
      const slug = requestUrl.searchParams.get('slug') || '';
      if (!projectId || !slug) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('projectId and slug are required');
        return;
      }

      const catalog = await loadCatalog();
      const project = (catalog.projects || []).find((p) => p.id === projectId);
      if (!project) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('project not found');
        return;
      }

      const page = (project.pages || []).find((p) => p.slug === slug);
      if (!page) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('page not found');
        return;
      }

      const sourcePath = await resolveSourceFileFromProjectPage(project, page);
      const content = stripBom(await fs.readFile(sourcePath, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, content, sourcePath }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : 'load page failed');
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/import-path') {
    try {
      const body = await readBody(req);
      const wikiPath = String(body.wikiPath || '').trim();
      if (!wikiPath) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('wikiPath is required');
        return;
      }

      const entry = await importProjectByPath(wikiPath);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, entry }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(error instanceof Error ? error.message : 'import failed');
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('not found');
});

server.listen(4174, '127.0.0.1', () => {
  console.log('hub admin api listening on http://127.0.0.1:4174');
});
