const DEFAULT_REPO = {
  owner: 'SzaBee13',
  repo: 'AdGuardLists',
  branch: 'main',
};

const WEBSITE_URL = 'https://adguardlists.szabee.me';

const RAW_BASE_URL = (repo = DEFAULT_REPO) =>
  `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch}`;

const GITHUB_TREE_API = (repo = DEFAULT_REPO) =>
  `https://api.github.com/repos/${repo.owner}/${repo.repo}/git/trees/${repo.branch}?recursive=1`;

const KNOWN_LIST_PATHS = [
  'block/linux/metrics.txt',
  'unblock/linux/arch/mirrors.txt',
  'unblock/linux/debian/mirrors.txt',
  'unblock/linux/kali/mirrors.txt',
];

function normalizePath(path) {
  return path.replace(/^\/+/, '');
}

function buildListEntry(path, category) {
  const normalized = normalizePath(path);
  const parts = normalized.split('/');
  const name = parts[parts.length - 1];
  const folderLabel = parts.length > 1 ? parts[parts.length - 2] : '';
  const rawTitle = name
    .replace(/\.txt$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
  const title = folderLabel
    ? `${folderLabel.replace(/[-_]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())} ${rawTitle}`
    : rawTitle;

  return {
    id: normalized,
    category,
    path: normalized,
    title,
    description: '',
    url: `${RAW_BASE_URL()}/${normalized}`,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function parseHeaders(content) {
  const lines = content.split(/\r?\n/);
  const metadata = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') continue; // skip blank lines between headers

    if (!trimmed.startsWith('!')) break; // real content starts, stop

    const colonIdx = trimmed.indexOf(':', 1);
    if (colonIdx === -1) continue;

    const key = trimmed.slice(1, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (key && value) {
      metadata[key] = value;
    }
  }

  return metadata;
}

// Main function to load lists from either GitHub or local source
// Returns an object with success status, source, and an array of list entries
export async function loadLists({ source = 'github', repo = DEFAULT_REPO } = {}) {
  if (source === 'local') {
    return {
      success: true,
      source: 'local',
      lists: KNOWN_LIST_PATHS.map((path) => {
        const category = path.startsWith('block/') ? 'block' : 'unblock';
        return {
          ...buildListEntry(path, category),
          url: `${WEBSITE_URL}/${normalizePath(path)}`,
        };
      }),
    };
  }

  const tree = await fetchJson(GITHUB_TREE_API(repo));
  const candidates = (tree.tree || []).filter(
    (item) => item.type === 'blob' && item.path.match(/\.(txt|list)$/i)
  );

  const lists = candidates
    .filter((item) => item.path.startsWith('block/') || item.path.startsWith('unblock/'))
    .map((item) => {
      const category = item.path.startsWith('block/') ? 'block' : 'unblock';
      return {
        ...buildListEntry(item.path, category),
        url: `${WEBSITE_URL}/${normalizePath(item.path)}`,
      };
    });

  return {
    success: true,
    source: 'github',
    repository: `${repo.owner}/${repo.repo}@${repo.branch}`,
    lists,
  };
}

export async function fetchListContent(path, { source = 'github', repo = DEFAULT_REPO } = {}) {
  const normalized = normalizePath(path);
  const url = source === 'local'
    ? `${window.location.origin}/${normalized}`
    : `${WEBSITE_URL}/${normalized}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load list content from ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function loadListMetadata(path, options = {}) {
  const content = await fetchListContent(path, options);
  const headers = parseHeaders(content);
  const normalized = normalizePath(path);

  return {
    path: normalized,
    url: `${WEBSITE_URL}/${normalized}`,
    title: headers.title || path,
    description: headers.description || headers.title || '',
    generated: headers.generated || null,
    version: headers.version || null,
    totalEntries: headers['total entries'] || null,
    tags: headers.tags ? headers.tags.split(',').map((t) => t.trim()) : [],
  };
}

export default {
  loadLists,
  fetchListContent,
  loadListMetadata,
};

