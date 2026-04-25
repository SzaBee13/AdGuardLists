import { loadLists, loadListMetadata } from './load-lists.js';

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function toLabel(value) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value) {
	if (!value) {
		return 'Unknown';
	}

	return value;
}

function renderSummary(container, lists) {
	const blockCount = lists.filter((item) => item.category === 'block').length;
	const unblockCount = lists.filter((item) => item.category === 'unblock').length;

	container.innerHTML = `
		<div class="rounded-xl border border-slate-700 bg-slate-900/70 p-5">
			<p class="text-xs uppercase tracking-[0.2em] text-slate-400">Total Lists</p>
			<p class="mt-2 text-3xl font-semibold text-white">${lists.length}</p>
		</div>
		<div class="rounded-xl border border-emerald-700/70 bg-emerald-950/50 p-5">
			<p class="text-xs uppercase tracking-[0.2em] text-emerald-300">Block</p>
			<p class="mt-2 text-3xl font-semibold text-emerald-100">${blockCount}</p>
		</div>
		<div class="rounded-xl border border-cyan-700/70 bg-cyan-950/50 p-5">
			<p class="text-xs uppercase tracking-[0.2em] text-cyan-300">Unblock</p>
			<p class="mt-2 text-3xl font-semibold text-cyan-100">${unblockCount}</p>
		</div>
	`;
}

function renderListItems(lists) {
	return lists
		.map(
			(list) => `
				<article class="rounded-xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg shadow-black/20">
					<div class="flex items-center justify-between gap-4">
						<h2 class="text-lg font-semibold text-white">${escapeHtml(list.title)}</h2>
						<span class="rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
							list.category === 'block'
								? 'border-emerald-500/70 bg-emerald-900/40 text-emerald-200'
								: 'border-cyan-500/70 bg-cyan-900/40 text-cyan-200'
						}">${escapeHtml(toLabel(list.category))}</span>
					</div>
					<p class="mt-3 text-sm text-slate-300">${escapeHtml(list.description || 'No description available.')}</p>
					<dl class="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400">
						<div>
							<dt class="uppercase tracking-wide text-slate-500">Version</dt>
							<dd class="mt-1 text-slate-300">${escapeHtml(list.version || 'N/A')}</dd>
						</div>
						<div>
							<dt class="uppercase tracking-wide text-slate-500">Generated</dt>
							<dd class="mt-1 text-slate-300">${escapeHtml(formatDate(list.generated))}</dd>
						</div>
						<div>
							<dt class="uppercase tracking-wide text-slate-500">Entries</dt>
							<dd class="mt-1 text-slate-300">${escapeHtml(list.totalEntries || 'Unknown')}</dd>
						</div>
						<div>
							<dt class="uppercase tracking-wide text-slate-500">Path</dt>
							<dd class="mt-1 break-all text-slate-300">${escapeHtml(list.path)}</dd>
						</div>
					</dl>
					${Array.isArray(list.tags) && list.tags.length ? `
					<div class="mt-2">
						<span class="font-medium text-slate-500">Tags:</span>
						${list.tags.map((t) => `<span class="inline-block bg-slate-700 text-slate-200 rounded px-2 py-0.5 mr-1 text-xs">${escapeHtml(t)}</span>`).join('')}
					</div>` : ''}
					<div class="mt-4 flex flex-wrap gap-2">
						<a href="${escapeHtml(list.url)}" target="_blank" rel="noreferrer" class="rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-900 transition hover:bg-white">Open Raw</a>
						<button type="button" data-copy-url="${escapeHtml(list.url)}" class="rounded-md border border-slate-500 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-200 hover:text-white">Copy URL</button>
					</div>
				</article>
			`
		)
		.join('');
}

function renderCategory(container, lists, category) {
	if (lists.length > 0) {
		container.innerHTML = renderListItems(lists);
		return;
	}

	container.innerHTML = `
		<p class="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-5 text-sm text-slate-400">
			No ${escapeHtml(category)} list matches your search.
		</p>
	`;
}

function filterLists(lists, query) {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return lists;
	}

	return lists.filter((list) => {
		const haystack = [
			list.title,
			list.description,
			list.path,
			list.category,
				list.version,
				(list.tags || []).join(' '),
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return haystack.includes(normalizedQuery);
	});
}

function setStatus(container, message, isError = false) {
	container.textContent = message;
	container.className = isError
		? 'text-sm text-rose-300'
		: 'text-sm text-slate-300';
}

async function initListsPage() {
	const status = document.getElementById('listStatus');
	const summary = document.getElementById('listSummary');
	const blockGrid = document.getElementById('blockListGrid');
	const unblockGrid = document.getElementById('unblockListGrid');
	const searchInput = document.getElementById('listSearch');

	if (
		!status
		|| !summary
		|| !blockGrid
		|| !unblockGrid
		|| !(searchInput instanceof HTMLInputElement)
	) {
		return;
	}

	setStatus(status, 'Loading lists from repository...');

	let loaded;
	try {
		loaded = await loadLists({ source: 'github' });
	} catch (error) {
		try {
			loaded = await loadLists({ source: 'local' });
			setStatus(status, 'GitHub API was unavailable, showing local fallback list paths.');
		} catch {
			setStatus(status, 'Could not load list data. Please refresh and try again.', true);
			return;
		}
	}

	const ordered = [...loaded.lists].sort((a, b) => a.path.localeCompare(b.path));
	const metadataResults = await Promise.allSettled(
		ordered.map((entry) => loadListMetadata(entry.path, { source: loaded.source }))
	);

	const hydrated = ordered.map((entry, index) => {
		const metadata = metadataResults[index];
		if (metadata.status !== 'fulfilled') {
			return entry;
		}

		return {
			...entry,
			title: metadata.value.title || entry.title,
			description: metadata.value.description || entry.description,
			version: metadata.value.version,
			generated: metadata.value.generated,
			totalEntries: metadata.value.totalEntries,
			tags: metadata.value.tags || [],
		};
	});

	const metadataLoaded = metadataResults.filter((result) => result.status === 'fulfilled').length;
	const initialStatus = `Loaded ${hydrated.length} list(s). Metadata available for ${metadataLoaded}.`;

	function applyFilters() {
		const query = searchInput.value || '';
		const filtered = filterLists(hydrated, query);
		const blockLists = filtered.filter((item) => item.category === 'block');
		const unblockLists = filtered.filter((item) => item.category === 'unblock');

		renderSummary(summary, filtered);
		renderCategory(blockGrid, blockLists, 'block');
		renderCategory(unblockGrid, unblockLists, 'unblock');

		if (query.trim()) {
			setStatus(
				status,
				`Showing ${filtered.length} result(s) for "${query.trim()}". Metadata available for ${metadataLoaded}.`
			);
			return;
		}

		setStatus(status, initialStatus);
	}

	applyFilters();
	searchInput.addEventListener('input', applyFilters);

	document.addEventListener('click', async (event) => {
		const target = event.target;
		if (!(target instanceof HTMLButtonElement)) {
			return;
		}

		const url = target.getAttribute('data-copy-url');
		if (!url) {
			return;
		}

		try {
			await navigator.clipboard.writeText(url);
			target.textContent = 'Copied';
			setTimeout(() => {
				target.textContent = 'Copy URL';
			}, 1200);
		} catch {
			target.textContent = 'Copy Failed';
			setTimeout(() => {
				target.textContent = 'Copy URL';
			}, 1200);
		}
	});
}

if (document.body?.dataset.page === 'lists') {
	initListsPage();
}
