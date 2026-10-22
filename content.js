// content.js - reads the site's words from files in Media, so the text lives in
// plain .txt and .md files you can edit, not inside the HTML.
//   - an element with data-src="Media/about.txt" is filled with that one file
//   - an element with data-list="Media/notes/order.txt" is filled with every file
//     that list names, in order (see the comments at the top of order.txt)
//   - an element with data-page also gets the project-page rules (see the top of
//     Media/renderer.md): video windows, the facts box and problem blocks
// .md files are read as Markdown (needs Lib/marked.min.js on the page);
// .txt files as plain text, with line breaks kept and addresses made into links.
// When it has finished, it fires a "contentloaded" event so desktop.js can
// re-fit any window whose text just arrived.

(() => {
  const folderOf = (path) => path.slice(0, path.lastIndexOf("/") + 1);
  const isMarkdown = (path) => /\.md$/i.test(path);
  // a video's poster is a .jpg with the same name next to it: Cubes.mp4 -> Cubes.jpg
  const posterOf = (src) => src.replace(/\.(mp4|webm)$/i, ".jpg");

  async function load(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(path + " (" + response.status + ")");
    return response.text();
  }

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // web addresses, email addresses and file names (cv.pdf) become links
  function linkify(escaped, folder) {
    return escaped
      .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}">${url}</a>`)
      .replace(/(^|[\s(])([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g, (m, before, mail) => `${before}<a href="mailto:${mail}">${mail}</a>`)
      .replace(/(^|[\s(])([\w-]+\.(?:pdf|png|jpg|jpeg|gif|mp4|txt|md))(?=$|[\s),.])/gim, (m, before, file) => `${before}<a href="${folder}${file}">${file}</a>`);
  }

  function renderText(text, folder) {
    const box = document.createElement("div");
    const paragraphs = text.replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/);
    box.innerHTML = paragraphs.map((p) => `<p>${linkify(escapeHtml(p), folder).replace(/\n/g, "<br>")}</p>`).join("");
    return box;
  }

  // shift: how many levels to move headings down, so a write-up's "# Title"
  // can sit under the page's own headings
  function renderMarkdown(text, folder, shift) {
    const box = document.createElement("div");
    if (!window.marked) return renderText(text, folder);
    // breaks: a single line break in the file is a line break on the page
    box.innerHTML = window.marked.parse(text, { breaks: true });

    if (shift) {
      for (const h of box.querySelectorAll("h1, h2, h3, h4, h5")) {
        const moved = document.createElement("h" + Math.min(6, Number(h.tagName[1]) + shift));
        moved.innerHTML = h.innerHTML;
        h.replaceWith(moved);
      }
    }
    // pictures and links are written relative to the file, not the page
    for (const el of box.querySelectorAll("[src], [href]")) {
      const attr = el.hasAttribute("src") ? "src" : "href";
      const value = el.getAttribute(attr);
      if (!/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(value)) el.setAttribute(attr, folder + value);
    }
    // a "picture" whose file is a video becomes a video
    for (const img of box.querySelectorAll("img")) {
      if (!/\.(mp4|webm)$/i.test(img.getAttribute("src"))) continue;
      const video = document.createElement("video");
      for (const [name, value] of [["src", img.getAttribute("src")], ["poster", posterOf(img.getAttribute("src"))], ["controls", ""], ["muted", ""], ["loop", ""], ["playsinline", ""], ["preload", "metadata"], ["aria-label", img.getAttribute("title") || img.alt], ["data-title", img.alt], ["data-caption", img.getAttribute("title") || ""]]) {
        video.setAttribute(name, value);
      }
      img.replaceWith(video);
    }
    return box;
  }

  // ---------- project-page rules ----------
  const esc = escapeHtml;
  function videoWindow(video) {
    const title = video.dataset.title || "", caption = video.dataset.caption || "";
    const figure = document.createElement("figure");
    figure.innerHTML = `
      <div class="window" data-title="${esc(title)}">
        <div class="titlebar"><span class="title">${esc(title)}</span><span class="winbuttons"><button type="button" data-action="minimise" aria-label="Minimise ${esc(title)}">_</button><button type="button" data-action="maximise" aria-label="Maximise ${esc(title)}">&#9633;</button><span class="fakebutton" aria-hidden="true">&times;</span></span></div>
        <div class="viewport"><video src="${esc(video.getAttribute("src"))}" poster="${esc(posterOf(video.getAttribute("src")))}" muted loop playsinline controls preload="metadata" aria-label="${esc(caption || title)}"></video></div>
      </div>` + (caption ? `<figcaption>${esc(caption)}</figcaption>` : "");
    return figure;
  }

  function pageRules(box) {
    // the first paragraph after the title is the grey line under it
    box.querySelector("h1 + p")?.classList.add("standfirst");

    // a paragraph holding only a video becomes a window
    for (const video of box.querySelectorAll("p > video")) {
      const p = video.parentElement;
      if (p.textContent.trim() === "" && p.children.length === 1) p.replaceWith(videoWindow(video));
    }

    // a quote block of "**Label:** value" lines becomes the facts box
    for (const quote of box.querySelectorAll("blockquote")) {
      const dl = document.createElement("dl");
      dl.className = "facts";
      const lines = quote.innerHTML.split(/<br\s*\/?>|<\/p>\s*<p>/i).map((l) => l.replace(/<\/?p>/gi, "").trim()).filter(Boolean);
      let ok = lines.length > 0;
      for (const line of lines) {
        const m = line.match(/^<strong>(.*?):?<\/strong>:?\s*(.*)$/s);
        if (!m) { ok = false; break; }
        dl.insertAdjacentHTML("beforeend", `<dt>${m[1].replace(/:$/, "")}</dt><dd>${m[2]}</dd>`);
      }
      if (ok) quote.replaceWith(dl);
    }

    // each ### heading starts a problem block that runs to the next heading
    for (const h3 of [...box.querySelectorAll(":scope > h3")]) {
      const article = document.createElement("article");
      article.className = "problem";
      h3.before(article);
      let node = h3;
      while (node && !(node !== h3 && /^H[1-3]$/.test(node.tagName || ""))) {
        const next = node.nextSibling;
        // a paragraph that is only a link (Source on GitHub) ends the block
        if (node !== h3 && node.nodeType === 1 && node.tagName === "P" && node.children.length === 1 && node.firstElementChild.tagName === "A" && node.textContent.trim() === node.firstElementChild.textContent.trim()) break;
        article.append(node);
        node = next;
      }
    }
    return box;
  }

  function render(text, path, shift = 0) {
    return isMarkdown(path) ? renderMarkdown(text, folderOf(path), shift) : renderText(text, folderOf(path));
  }

  function failure(path) {
    const box = document.createElement("p");
    box.className = "loadfail";
    box.innerHTML = `Couldn't load <a href="${path}">${path}</a>.` +
      (location.protocol === "file:"
        ? ` Browsers block a page opened straight from your computer from reading other files. Double-click preview.bat in the Portfolio folder; if it's already running, open <a href="http://localhost:8000/${location.pathname.split("/").pop()}">this page on localhost:8000</a>.`
        : "");
    return box;
  }

  async function fillOne(el) {
    const path = el.dataset.src;
    try {
      let box = render(await load(path), path);
      if (el.hasAttribute("data-page")) box = pageRules(box);
      // a paragraph can't hold paragraphs: fill it with the first one's contents
      if (el.tagName === "P") box = box.querySelector("p") || box;
      el.replaceChildren(...box.childNodes);
    } catch {
      el.replaceChildren(failure(path));
    }
  }

  async function fillList(el) {
    const listPath = el.dataset.list;
    const folder = folderOf(listPath);
    let names;
    try {
      names = (await load(listPath)).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    } catch {
      el.replaceChildren(failure(listPath));
      return;
    }
    const texts = await Promise.all(names.map((n) => load(folder + n).then((t) => t, () => null)));
    const parts = names.map((name, i) => {
      const path = folder + name;
      const wrap = document.createElement(i === 0 ? "div" : "article");
      wrap.className = i === 0 ? "note-intro" : "note";
      if (texts[i] === null) wrap.append(failure(path));
      else wrap.append(...render(texts[i], path, i === 0 ? 0 : 2).childNodes);
      return wrap;
    });
    el.replaceChildren(...parts);
  }

  const jobs = [
    ...[...document.querySelectorAll("[data-src]")].map(fillOne),
    ...[...document.querySelectorAll("[data-list]")].map(fillList),
  ];
  Promise.all(jobs).then(() => {
    document.documentElement.dataset.content = "loaded";
    window.dispatchEvent(new Event("contentloaded"));
  });
})();
