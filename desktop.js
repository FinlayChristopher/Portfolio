// desktop.js - makes the site behave a little like a desktop.
// Everything here is optional: without it every page is still complete
// (layout, links and still images all work). This adds:
//   - on the home page: a one-screen desktop where the icons open windows
//   - working minimise, maximise and close buttons (double-click a title bar too)
//   - dragging windows by their title bar (computer with a mouse only)
//   - videos that play while the pointer is over them
//   - a dock at the bottom centre (Start menu, Home, Notes), which
//     slides away on phones while scrolling down, and the date and time in the menu bar

(() => {
  document.documentElement.classList.add("js");
  // pages that read their text from files (content.js) build their windows from
  // it, so wait for it before setting the windows up
  const waiting = document.querySelector("[data-src], [data-list]") && document.documentElement.dataset.content !== "loaded";
  if (waiting) window.addEventListener("contentloaded", start, { once: true });
  else start();

  function start() {
  const root = document.documentElement;

  const desk = document.querySelector(".desk");
  const icons = document.querySelector(".icons");
  const windows = [...document.querySelectorAll(".window[data-title]")];
  const canDrag = window.matchMedia("(min-width: 761px) and (pointer: fine)");
  const phone = window.matchMedia("(max-width: 760px)");
  let topZ = 10;

  const setDragClass = () => root.classList.toggle("can-drag", canDrag.matches);
  setDragClass();
  canDrag.addEventListener("change", setDragClass);

  const isClosed = (win) => win.classList.contains("closed");
  const isMax = (win) => win.classList.contains("maximised");

  function activate(win) {
    topZ += 1;
    win.style.zIndex = String(topZ);
  }

  // ---------- video plays while hovered ----------
  const videoOf = (win) => win.querySelector("video");

  function play(win) {
    const v = videoOf(win);
    if (v) v.play().catch(() => {});      // a browser may refuse; the still image stays
  }

  function pause(win) {
    const v = videoOf(win);
    if (v && !isMax(win)) v.pause();
  }

  // ---------- minimise, maximise, close ----------
  function setMaximised(win, on) {
    win.classList.toggle("maximised", on);
    if (on) win.classList.remove("minimised");
    const v = videoOf(win);
    if (v) {
      v.dataset.hadControls ??= v.controls ? "yes" : "no";
      v.controls = on || v.dataset.hadControls === "yes";
      on ? play(win) : v.pause();
    }
    const btn = win.querySelector('[data-action="maximise"]');
    if (btn) btn.setAttribute("aria-label", (on ? "Restore " : "Maximise ") + win.dataset.title);
    if (!desk) document.body.style.overflow = windows.some(isMax) ? "hidden" : "";
    if (on) activate(win);
  }

  function setMinimised(win, on) {
    if (on && isMax(win)) setMaximised(win, false);
    win.classList.toggle("minimised", on);
    if (on) pause(win);
    const btn = win.querySelector('[data-action="minimise"]');
    if (btn) btn.setAttribute("aria-label", (on ? "Restore " : "Minimise ") + win.dataset.title);
  }

  // on a phone a window is either full screen or closed, nothing in between
  function toggleMaximised(win) {
    if (desk && phone.matches && isMax(win)) closeWindow(win);
    else setMaximised(win, !isMax(win));
  }

  function closeWindow(win) {
    if (isMax(win)) setMaximised(win, false);
    setMinimised(win, false);
    videoOf(win)?.pause();
    win.classList.add("closed");
    win.style.transform = "";
    win.style.height = "";
    win.classList.remove("sized");
    delete win.dataset.x;
    delete win.dataset.y;
    delete win.dataset.slot;
  }

  // ---------- placing windows on the desktop ----------
  // Windows open to the right of the icons, each new one stepped down and right
  // from the last, and shrink until they fit the height of the desktop.
  // A window marked data-place="right" (about.txt) sits against the right edge
  // instead, and the others share the space between it and the icons.
  // sizes in this file are written for a 16px root; u() scales them with the
  // site's root size (90% on computers, set in style.css)
  const u = (n) => n * parseFloat(getComputedStyle(root).fontSize) / 16;

  function place(win, slot) {
    win.dataset.slot = String(slot);
    const deskBox = desk.getBoundingClientRect();
    const iconsRight = Math.max(...[...icons.querySelectorAll(".icon")].map((i) => i.getBoundingClientRect().right)) - deskBox.left;
    const freeLeft = iconsRight + u(24);
    let freeRight = desk.clientWidth - u(24);

    if (win.dataset.place === "right") {
      const width = Math.min(freeRight - freeLeft, u(Number(win.dataset.width) || 420));
      win.style.width = width + "px";
      win.style.left = Math.round(freeRight - width) + "px";
      win.style.top = u(12) + "px";
      return;
    }

    const pinned = windows.filter((w) => w !== win && w.dataset.place === "right" && !isClosed(w) && !isMax(w) && !w.dataset.x);
    if (pinned.length) {
      const edge = Math.min(...pinned.map((w) => w.offsetLeft)) - u(24);
      if (edge - freeLeft >= u(480)) freeRight = edge;   // too narrow beside it: overlap instead
    }
    const freeWidth = freeRight - freeLeft;
    const top = u(12 + slot * 36);
    let width = Math.min(freeWidth - u(slot * 36), u(Number(win.dataset.width) || 640));
    win.style.width = width + "px";
    // too tall for the desktop: find the widest width that fits. Narrower text
    // wraps onto more lines, so the height doesn't shrink in step with the width.
    const fits = () => win.offsetHeight <= desk.clientHeight - top - 4;
    if (!fits()) {
      let lo = u(280), hi = width;
      while (hi - lo > 8) {
        const mid = Math.round((lo + hi) / 2);
        win.style.width = mid + "px";
        if (fits()) lo = mid; else hi = mid;
      }
      width = lo;
      win.style.width = width + "px";
    }
    // the first window sits in the middle of the free space; later ones step down and right
    const left = freeLeft + Math.max(0, (freeWidth - width) / 2 - u(54)) + u(slot * 36);
    win.style.left = Math.round(left) + "px";
    win.style.top = top + "px";
  }

  function openWindow(win) {
    if (!desk) return false;
    if (phone.matches && win.classList.contains("inline") && !isClosed(win)) {
      win.scrollIntoView({ block: "nearest" });
      return true;
    }
    if (isClosed(win)) {
      win.classList.remove("closed", "minimised");
      const others = windows.filter((w) => w !== win && !isClosed(w) && w.dataset.place !== "right");
      if (!phone.matches) place(win, others.length % 4);
    }
    if (phone.matches) setMaximised(win, true);
    else if (win.classList.contains("minimised")) setMinimised(win, false);
    activate(win);
    return true;
  }

  // re-fit windows the visitor hasn't moved, after a resize or once the font loads
  // (right-hand windows first, since the others make room for them)
  function refit() {
    if (!desk || phone.matches) return;
    const order = [...windows].sort((a, b) => (b.dataset.place === "right") - (a.dataset.place === "right"));
    for (const win of order) {
      if (!isClosed(win) && !isMax(win) && !win.dataset.x && !win.classList.contains("sized")) place(win, Number(win.dataset.slot || 0));
    }
  }

  // ---------- dragging by the title bar ----------
  function startDrag(win, event) {
    if (!canDrag.matches || isMax(win)) return;
    if (event.button !== 0 || event.target.closest("button")) return;

    const bar = event.currentTarget;
    const startX = event.clientX, startY = event.clientY;
    const fromX = Number(win.dataset.x || 0), fromY = Number(win.dataset.y || 0);
    const box = win.getBoundingClientRect();
    bar.setPointerCapture(event.pointerId);

    const move = (e) => {
      // keep the title bar on screen so the window can always be grabbed again
      let x = fromX + e.clientX - startX;
      let y = fromY + e.clientY - startY;
      const minX = fromX - box.left - box.width + 120, maxX = fromX + (innerWidth - box.left) - 120;
      const minY = fromY - box.top, maxY = fromY + (innerHeight - 44 - box.top) - 44;
      x = Math.min(Math.max(x, minX), maxX);
      y = Math.min(Math.max(y, minY), maxY);
      win.dataset.x = String(x);
      win.dataset.y = String(y);
      win.style.transform = `translate(${x}px, ${y}px)`;
    };
    const stop = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", stop);
      bar.removeEventListener("pointercancel", stop);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", stop);
    bar.addEventListener("pointercancel", stop);
  }

  function tidy() {
    let slot = 0;
    const order = [...windows].sort((a, b) => (b.dataset.place === "right") - (a.dataset.place === "right"));
    for (const win of order) {
      setMaximised(win, false);
      setMinimised(win, false);
      win.style.transform = "";
      win.style.zIndex = "";
      win.style.height = "";
      win.classList.remove("sized");
      delete win.dataset.x;
      delete win.dataset.y;
      if (desk && !isClosed(win) && !phone.matches) place(win, win.dataset.place === "right" ? 0 : slot++);
    }
  }

  // ---------- resizing from the bottom-right grip (desktop windows only) ----------
  // A window with a picture keeps the picture's shape, so only its width
  // changes; a text window changes width and height, and its text scrolls.
  function startResize(win, event) {
    if (!canDrag.matches || isMax(win) || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const grip = event.currentTarget;
    const box = win.getBoundingClientRect();
    const deskBox = desk.getBoundingClientRect();
    const startX = event.clientX, startY = event.clientY;
    const keepsShape = Boolean(videoOf(win));
    grip.setPointerCapture(event.pointerId);
    activate(win);
    hideTip();

    const move = (e) => {
      const width = Math.min(Math.max(u(280), box.width + e.clientX - startX), deskBox.right - box.left - 8);
      win.style.width = width + "px";
      if (keepsShape) {
        // shrink back if the new width would push the bottom past the desktop
        const over = win.getBoundingClientRect().bottom - (deskBox.bottom - 4);
        if (over > 0) win.style.width = Math.max(u(280), width - over * 16 / 9) + "px";
      } else {
        const height = Math.min(Math.max(u(140), box.height + e.clientY - startY), deskBox.bottom - box.top - 4);
        win.style.height = height + "px";
      }
      win.classList.add("sized");
    };
    const stop = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", stop);
      grip.removeEventListener("pointercancel", stop);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", stop);
    grip.addEventListener("pointercancel", stop);
  }

  const PLAY = '<svg viewBox="0 0 28 28" aria-hidden="true"><path class="line" d="M8 5v18l15-9Z"/></svg>';
  // the grip is the cut corner's edge: a band along the diagonal, as thick as the border
  function gripShape() {
    // read the CSS sizes in pixels (they're written in rem)
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:var(--cut);height:var(--border)";
    document.body.append(probe);
    const size = probe.offsetWidth || 20;
    const band = (probe.offsetHeight || 4) * Math.SQRT2;
    probe.remove();
    return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><polygon points="${size},0 0,${size} 0,${size - band} ${size - band},0" fill="currentColor"/></svg>`;
  }

  // ---------- wire up each window ----------
  // pixel-clean button faces: the font has no square or cross of its own
  const FACE = {
    minimise: '<path class="line" d="M2 10h8"/>',
    maximise: '<path class="line" d="M2 2h8v8H2Z M2 4h8"/>',
    close: '<path class="line" d="M2.5 2.5l7 7 M9.5 2.5l-7 7"/>',
  };
  const face = (inner) => `<svg viewBox="0 0 12 12" aria-hidden="true">${inner}</svg>`;

  for (const win of windows) {
    const bar = win.querySelector(".titlebar");
    for (const b of win.querySelectorAll(".winbuttons [data-action]")) b.innerHTML = face(FACE[b.dataset.action]);
    for (const f of win.querySelectorAll(".winbuttons .fakebutton")) f.innerHTML = face(FACE.close);

    // a play mark over each video until it plays
    const video = videoOf(win);
    if (video) {
      const viewport = video.closest(".viewport");
      const mark = document.createElement("span");
      mark.className = "playmark";
      mark.innerHTML = PLAY;
      viewport.append(mark);
      video.addEventListener("playing", () => viewport.classList.add("playing"));
      video.addEventListener("pause", () => viewport.classList.remove("playing"));
      video.addEventListener("ended", () => viewport.classList.remove("playing"));
    }

    // the resize grip, on the home page's desktop
    if (desk && desk.contains(win)) {
      const grip = document.createElement("span");
      grip.className = "grip";
      grip.setAttribute("aria-hidden", "true");
      grip.innerHTML = gripShape();
      win.classList.add("has-grip");
      win.append(grip);
      grip.addEventListener("pointerdown", (e) => startResize(win, e));
    }

    win.addEventListener("pointerdown", () => activate(win));
    // only the picture counts as hovering: not the title bar, buttons or grip
    const picture = win.querySelector(".viewport");
    picture?.addEventListener("pointerenter", () => play(win));
    picture?.addEventListener("pointerleave", () => pause(win));
    win.addEventListener("focusin", () => play(win));
    win.addEventListener("focusout", (e) => { if (!win.contains(e.relatedTarget)) pause(win); });

    win.querySelector('[data-action="minimise"]')?.addEventListener("click", () =>
      setMinimised(win, !win.classList.contains("minimised")));
    win.querySelector('[data-action="maximise"]')?.addEventListener("click", () => toggleMaximised(win));
    win.querySelector('[data-action="close"]')?.addEventListener("click", () => closeWindow(win));

    if (bar) {
      bar.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) toggleMaximised(win); });
      bar.addEventListener("pointerdown", (e) => startDrag(win, e));
    }

    // while maximised, clicking the picture is for watching, not for leaving the page
    win.querySelector(".body")?.addEventListener("click", (e) => {
      if (isMax(win) && e.target.closest(".viewport")) e.preventDefault();
    });
  }

  // ---------- tooltip: a window's description, following the pointer ----------
  // With a mouse, the sentence under each home-page picture moves into a
  // tooltip that appears after a moment and says how to open the project.
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.hidden = true;
  tooltip.setAttribute("role", "tooltip");
  const fine = window.matchMedia("(pointer: fine)");
  let tipTimer, lastPointer;

  function moveTip(e) {
    const pad = 12, w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    let x = e.clientX + 18, y = e.clientY + 22;
    if (x + w > innerWidth - pad) x = e.clientX - w - 12;    // flip to the left near the right edge
    if (y + h > innerHeight - pad) y = e.clientY - h - 12;   // and above near the bottom
    tooltip.style.left = Math.max(pad, x) + "px";
    tooltip.style.top = Math.max(pad, y) + "px";
  }
  function hideTip() { clearTimeout(tipTimer); tooltip.hidden = true; }

  for (const body of document.querySelectorAll(".window .body[href]")) {
    const text = body.querySelector(".about p")?.textContent.trim();
    if (!text) continue;
    const win = body.closest(".window");
    body.addEventListener("pointerenter", (e) => {
      lastPointer = e;
      if (!fine.matches || isMax(win)) return;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => {
        tooltip.innerHTML = "";
        tooltip.append(text, Object.assign(document.createElement("span"), { className: "cue", textContent: "Click to open the project" }));
        tooltip.hidden = false;
        moveTip(lastPointer);
      }, 350);
    });
    body.addEventListener("pointermove", (e) => { lastPointer = e; if (!tooltip.hidden) moveTip(e); });
    body.addEventListener("pointerleave", hideTip);
    body.addEventListener("pointerdown", hideTip);
  }
  document.addEventListener("scroll", hideTip, { passive: true });

  // ---------- line icons, the same drawings and stroke as the desktop icons ----------
  const svg = (inner, cls = "") => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 52 52" aria-hidden="true">${inner}</svg>`;
  const ICON = {
    start: `<rect x="3" y="3" width="20" height="20"/><rect x="29" y="3" width="20" height="20"/>
            <rect x="3" y="29" width="20" height="20"/><rect x="29" y="29" width="20" height="20"/>`,
    home: `<path class="line" d="M7 25 26 8l19 17 M12 21v24h28V21 M22 45V32h8v13"/>`,
    pen: `<g transform="rotate(45 26 26)"><path class="line" d="M20 4h12v32H20Z M20 13h12 M20 36l6 10 6-10 M32 7h4v17"/></g>`,
  };

  // ---------- dock (bottom centre) ----------
  // Start, Home and Notes; the work itself lives on the desktop.
  const dock = document.createElement("div");
  dock.className = "dock";

  const tip = (label) => `<span class="tip" aria-hidden="true">${label}</span>`;

  const start = document.createElement("button");
  start.type = "button";
  start.setAttribute("aria-label", "Start");
  start.setAttribute("aria-expanded", "false");
  start.setAttribute("aria-controls", "startmenu");
  start.innerHTML = svg(ICON.start, "logo") + tip("Start");

  const link = (href, icon, label, open) => {
    const a = document.createElement("a");
    a.href = href;
    a.setAttribute("aria-label", label);
    if (open) a.dataset.open = open;
    a.innerHTML = svg(ICON[icon]) + tip(label);
    return a;
  };

  dock.append(start,
    link("index.html", "home", "Home"),
    link("notes.html", "pen", "Notes"));

  // ---------- date and time, top right of the menu bar ----------
  const clock = document.createElement("span");
  clock.className = "clock";
  const tick = () => {
    const now = new Date();
    const date = now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
    const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    clock.innerHTML = `<span class="date">${date}</span> ${time}`;
  };
  tick();
  setInterval(tick, 15000);

  // ---------- Start menu ----------
  const earlier = [
    ["Introduction to Graphics Programming", "https://github.com/FinlayChristopher/Introduction-To-Graphics-Programming"],
    ["Bespoke Platform Development Framework", "https://github.com/FinlayChristopher/Bespoke-Platform-Dev-Framework"],
    ["Mechanics Prototyping", "https://github.com/FinlayChristopher/Mechanics-Prototyping"],
  ];

  const menu = document.createElement("nav");
  menu.className = "startmenu";
  menu.id = "startmenu";
  menu.hidden = true;
  menu.setAttribute("aria-label", "Start menu");
  menu.innerHTML = `
    <ul>
      <li><a href="index.html">Home</a></li>
      <li><a href="renderer.html" data-open="render">Real-Time Render</a></li>
      <li><a href="multiplayer.html" data-open="multiplayer">Multiplayer Game</a></li>
      <li><a href="notes.html">Notes</a></li>
      <li>
        <button type="button" data-action="earlier" aria-expanded="false" aria-controls="earlier-work">Prior work <span aria-hidden="true">&#9656;</span></button>
        <ul class="submenu" id="earlier-work" hidden>
          ${earlier.map(([name, url]) => `<li><a href="${url}">${name}</a></li>`).join("")}
        </ul>
      </li>
      <li><hr></li>
      <li><a href="index.html#contact" data-open="contact">Contact</a></li>
      <li><a href="Media/cv.pdf">CV</a></li>
      <li><a href="mailto:finlaych1@protonmail.com">Email</a></li>
      <li><a href="https://github.com/FinlayChristopher">GitHub</a></li>
      <li><a href="https://www.linkedin.com/in/finlay-harris-50378238a/">LinkedIn</a></li>
      ${windows.length ? '<li><hr></li><li><button type="button" data-action="tidy">Tidy windows</button></li>' : ""}
    </ul>`;

  const earlierButton = menu.querySelector('[data-action="earlier"]');
  const earlierList = menu.querySelector("#earlier-work");
  function setEarlier(open) {
    earlierList.hidden = !open;
    earlierButton.setAttribute("aria-expanded", String(open));
  }
  earlierButton.addEventListener("click", () => {
    setEarlier(earlierList.hidden);
    if (!earlierList.hidden) earlierList.querySelector("a")?.focus();
  });
  earlierButton.parentElement.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") setEarlier(true); });
  earlierButton.parentElement.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") setEarlier(false); });

  function setMenu(open) {
    menu.hidden = !open;
    start.setAttribute("aria-expanded", String(open));
    if (!open) setEarlier(false);
    if (open) { dock.classList.remove("away"); menu.querySelector("a, button")?.focus(); }
  }
  start.addEventListener("click", () => setMenu(menu.hidden));
  menu.querySelector('[data-action="tidy"]')?.addEventListener("click", () => { tidy(); setMenu(false); });
  document.addEventListener("pointerdown", (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !start.contains(e.target)) setMenu(false);
  });

  // an icon or menu item with data-open opens that window here instead of
  // following its link; on pages without that window the link works as normal
  document.addEventListener("click", (e) => {
    const opener = e.target.closest("[data-open]");
    if (!opener) return;
    const win = document.getElementById(opener.dataset.open);
    if (win && openWindow(win)) {
      e.preventDefault();
      if (!menu.hidden) setMenu(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!earlierList.hidden) { setEarlier(false); earlierButton.focus(); return; }
    if (!menu.hidden) { setMenu(false); start.focus(); return; }
    const big = windows.find(isMax);
    if (big) toggleMaximised(big);
  });

  // ---------- phones: the dock slides away while scrolling down ----------
  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 2;
    if (!phone.matches || !menu.hidden || atEnd || y < 40) dock.classList.remove("away");
    else if (y > lastY + 4) dock.classList.add("away");
    else if (y < lastY - 4) dock.classList.remove("away");
    lastY = y;
  }, { passive: true });

  document.body.append(menu, dock, tooltip);
  document.querySelector(".bar")?.append(clock);
  root.classList.add("has-dock");

  // ---------- the home page becomes a desktop ----------
  if (desk) {
    root.classList.add("desktop-home");
    for (const win of windows) win.classList.add("closed");
    // the windows named in data-open-at-start; on a phone only the ones that sit
    // inline on the home screen (about.txt), since the rest open full screen
    for (const id of (desk.dataset.openAtStart || "").split(/\s+/).filter(Boolean)) {
      const win = document.getElementById(id);
      if (!win) continue;
      if (!phone.matches) openWindow(win);
      else if (win.dataset.phone === "inline") { win.classList.remove("closed"); win.classList.add("inline"); }
    }
    // arriving from another page, e.g. index.html#contact
    const asked = location.hash && document.getElementById(location.hash.slice(1));
    if (asked && windows.includes(asked)) openWindow(asked);

    let timer;
    window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(refit, 120); });
    document.fonts?.ready.then(refit);
    // about.txt and contact.txt arrive from files after the windows are placed
    if (root.dataset.content === "loaded") refit();
    else window.addEventListener("contentloaded", refit);
  }
  }
})();
