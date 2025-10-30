const manifest = chrome.runtime.getManifest();

const utils = {};

const BLACKLISTED_PARAMS = ["utm_", "clid", "ref"];

utils.getId = (id) => document.getElementById(id);

utils.stringToDom = (string) =>
	document.createRange().createContextualFragment(string.trim());

utils.timeSince = (time) => {
	// from https://stackoverflow.com/a/12475270
  var time_formats = [
    [60, "seconds", 1],
    [120, "1 minute ago", "1 minute from now"],
    [3600, "minutes", 60],
    [7200, "1 hour ago", "1 hour from now"],
    [86400, "hours", 3600],
    [172800, "Yesterday", "Tomorrow"],
    [604800, "days", 86400],
    [1209600, "Last week", "Next week"],
    [2419200, "weeks", 604800],
    [4838400, "Last month", "Next month"],
    [29030400, "months", 2419200],
    [58060800, "Last year", "Next year"],
    [2903040000, "years", 29030400],
  ];
	var seconds = (+Date.now() - time) / 1000,
		token = "ago",
		list_choice = 1;

	if (seconds === 0) {
		return "Just now";
	}
	if (seconds < 0) {
		seconds = Math.abs(seconds);
		token = "from now";
		list_choice = 2;
	}
	var i = 0,
		format;
	while (i < time_formats.length) {
		format = time_formats[i++];
		if (seconds < format[0]) {
			if (typeof format[2] === "string") return format[list_choice];
			else return `${Math.floor(seconds / format[2])} ${format[1]} ${token}`;
		}
	}
	return time;
};

async function askReddit(url) {
	const encodedUrl = encodeURIComponent(url);
		// Use old.reddit.com search to get accurate results
		const searchUrl = `https://old.reddit.com/search?q=url:${encodedUrl}`;
		const response = await fetch(searchUrl, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; WhatRedditSays/1.0)" },
		});

		if (!response.ok) {
			throw new Error("Failed to fetch from Reddit");
		}

		const html = await response.text();

		// Parse HTML to extract search results
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, "text/html");

		const searchResults = doc.querySelectorAll(
			".search-result.search-result-link",
		);
		const posts = [];

		searchResults.forEach((result) => {
			try {
				const titleEl = result.querySelector(".search-title");
				const scoreEl = result.querySelector(".search-score");
				const commentsEl = result.querySelector(".search-comments");
				const timeEl = result.querySelector("time");
				const authorEl = result.querySelector(".author");
				const subredditEl = result.querySelector(".search-subreddit-link");
				const linkEl = result.querySelector(".search-link");

				if (!titleEl || !subredditEl) return; // Skip if essential data is missing

				// Extract data
				const title = titleEl.textContent.trim();
				const permalinkHref = titleEl.getAttribute("href");
				// Extract just the path (e.g., /r/subreddit/comments/...) from the full URL
				const permalink = permalinkHref.startsWith("http")
					? new URL(permalinkHref).pathname
					: permalinkHref;
				const score = parseInt(
					scoreEl?.textContent.replace(/[^\d]/g, "") || "0", 10
				);
				const numComments = parseInt(
					commentsEl?.textContent.replace(/[^\d]/g, "") || "0", 10
				);
				const createdUtc = timeEl
					? Math.floor(
							new Date(timeEl.getAttribute("datetime")).getTime() / 1000,
						)
					: 0;
				const author = authorEl?.textContent.trim() || "[deleted]";
				const subreddit = subredditEl.textContent.replace("r/", "").trim();
				const externalUrl = linkEl?.getAttribute("href") || "";

				// Create a post object similar to Reddit's JSON API format
				posts.push({
					kind: "t3",
					data: {
						title: title,
						permalink: permalink,
						score: score,
						num_comments: numComments,
						created_utc: createdUtc,
						author: author,
						subreddit: subreddit,
						url: externalUrl,
						_isExactMatch: true, // All results from URL search are exact matches
					},
				});
			} catch (e) {
				console.error("Error parsing search result:", e);
			}
		});

		// Return in Reddit API format
		return {
			kind: "Listing",
			data: {
				children: posts,
				exactMatchCount: posts.length,
			},
		};
}

function cleanUpParameters(url) {
	const urlObj = new URL(url);
	const params = urlObj.searchParams;
	const blacklistedKeys = [];

	for (const key of params.keys()) {
		if (BLACKLISTED_PARAMS.some((entry) => key.includes(entry))) {
			// Can't delete directly since it will mess up the iterator order
			// Saving it temporarily to delete later
			blacklistedKeys.push(key);
		}
	}

	for (const key of blacklistedKeys) {
		params.delete(key);
	}

	// Reconstruct search params after cleaning up
	urlObj.search = params.toString();

	return urlObj.toString();
}

function cleanUrl(url) {
	// (maybe) clean up analytics-related params
	url = url.includes("?") ? cleanUpParameters(url) : url;
	// strip protocol for better results
	url = url.replace(/(^\w+:|^)\/\//, "");
	// also, strip anchors
	url = url.replace(/(#.+?)$/, "");
	// also, strip index.php/html
	url = url.replace(/index\.(php|html?)/, "");
	// also, strip single leading slash, e.g. example.com/ -> example.com
	url =
		url.endsWith("/") && url.split("/").length < 3
			? url.replace(/\/+$/, "")
			: url;
	return url;
}

utils.getId("version-label").textContent = `Ver. ${manifest.version}`;

utils.getId("about-link").addEventListener("click", (e) => {
	e.preventDefault();
	chrome.tabs.create({
		url: manifest.homepage_url,
	});
});

const $content = utils.getId("content");
let _thisUrl = false;
let _thisTitle = false;
let _cleanUrl = false;

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
	_thisUrl = tabs[0].url;
	_thisTitle = tabs[0].title;
	//_thisFavicon = tabs[0].favIconUrl;
	if (/^https?:\/\/.+$/.test(_thisUrl)) {
		_cleanUrl = cleanUrl(_thisUrl);

		utils.getId("url-label").textContent = _cleanUrl;
		// This will show the full url on mouse hover when it's truncated (too long)
		utils.getId("url-label").title = _cleanUrl;

		askReddit(_cleanUrl).then(render).catch(render);
	} else {
		render(false);
	}
});

function render(data) {
	while ($content.firstChild) {
		$content.removeChild($content.lastChild);
	}

	if (data instanceof Error) {
		$content.appendChild(
			utils.stringToDom(
				`<li class="p2 my1"><p class="mb1">Sorry, something went wrong with the Reddit API call:</p><pre class="m0">${data.message}</pre></li>`,
			),
		);
		return;
	}

	if (!data) {
		$content.appendChild(
			utils.stringToDom(
				`<li class="p2 my1"><p class="mb1">Sorry, not a valid url: </p><pre class="m0">${_thisUrl}</pre></li>`,
			),
		);
		return;
	}

	// Reddit returns {kind: "Listing", data: {children: [{data: {...}}]}}
	const posts =
		data.kind === "Listing" && data.data && data.data.children
			? data.data.children
			: [];
	let _node = "";

	if (posts.length === 0) {
		_node = `<li class="p2 my1"><p class="mb1">No results for this url.</p><p class="m0"><button class="btn btn-small btn-primary h6 uppercase" data-link="https://www.reddit.com/submit?url=${encodeURIComponent(_thisUrl)}&title=${encodeURIComponent(_thisTitle)}">Submit to Reddit</button></p></li>`;
	} else {
		const maxPosts = posts.length > 4 ? 4 : posts.length;

		for (let i = 0; i < maxPosts; i++) {
			const post = posts[i].data;
			// Use the _isExactMatch flag we set earlier
			const isExactMatch = post._isExactMatch === true;
			const _related = !isExactMatch
				? `<span class="block h6 gray-4 truncate">For related url: <span class="monospace">${cleanUrl(post.url)}</span></span>`
				: "";
			_node += `
          <li class="py1 px2 border-bottom border-gray-2 hover-gray" data-link="https://reddit.com${post.permalink}">
            <span class="block font-weight-600">${post.title}</span>
            <span class="block h6 gray-4"><strong style="color:#FF4500">${post.score}</strong> points • <strong style="color:#FF4500">${post.num_comments || 0}</strong> comments • in <strong>r/${post.subreddit}</strong> • by u/${post.author} • ${utils.timeSince(post.created_utc * 1000)}</span>
            ${_related}
          </li>`;
		}

		if (posts.length > 4) {
			// Link to old.reddit.com search which shows all results
			_node += `<li class="py1 px2"><button class="btn btn-small h6 px0 weight-400" style="color:#FF4500" data-link="https://old.reddit.com/search?q=url:${encodeURIComponent(_cleanUrl)}">See all ${posts.length} discussions on Reddit</button></li>`;
		}
	}

	_node = utils.stringToDom(_node);
	$content.appendChild(_node);

	document.querySelectorAll("[data-link]").forEach((_link) => {
		_link.addEventListener("click", (e) => {
			e.preventDefault();
			chrome.tabs.create({
				url: _link.getAttribute("data-link"),
			});
		});
	});
}
