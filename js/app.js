// State & Global Variables
const activeClasses = ["bg-emerald-50", "text-emerald-700", "font-semibold", "dark:bg-emerald-900/40", "dark:text-emerald-400"];
const inactiveClasses = ["hover:bg-gray-100", "text-gray-600", "dark:hover:bg-gray-800", "dark:text-gray-300"];

let isSplitMode = false;
let activePane = 1;
let wakeLockObj = null;
let loadTimeouts = { 1: null, 2: null };
let portalLinks = [];

const panes = {
    1: { primaryUrl: "", fallbackUrl: "", isFallback: false, btn: null, title: "", zoom: 1 },
    2: { primaryUrl: "", fallbackUrl: "", isFallback: false, btn: null, title: "", zoom: 1 }
};

let favoriteTitles = JSON.parse(localStorage.getItem("gasd_portal_favorites") || "[]");

// DOM Elements Reference
let menuContainer, sidebar, menuOverlay, currentUrlDisplay, dateDisplay, clockDisplay, 
    clockDisplayMobile, dateTimeContainer, titleContainer, titleContainerText, fallbackToggleBtn;

function initElements() {
    menuContainer = document.getElementById("menuContainer");
    sidebar = document.getElementById("sidebar");
    menuOverlay = document.getElementById("menuOverlay");
    currentUrlDisplay = document.getElementById("currentUrlDisplay");
    dateDisplay = document.getElementById("dateDisplay");
    clockDisplay = document.getElementById("clockDisplay");
    clockDisplayMobile = document.getElementById("clockDisplayMobile");
    dateTimeContainer = document.getElementById("dateTimeContainer");
    titleContainer = document.getElementById("titleContainer");
    titleContainerText = document.getElementById("titleContainerText");
    fallbackToggleBtn = document.getElementById("fallbackToggleBtn");
}

// ฟังก์ชันดึงข้อมูลผ่าน JSONP ข้ามปัญหา CORS
function fetchJSONP(url, timeout = 7000) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');
        
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('JSONP request timed out'));
        }, timeout);

        function cleanup() {
            if (window[callbackName]) delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
            clearTimeout(timer);
        }

        window[callbackName] = function(data) {
            cleanup();
            resolve(data);
        };

        script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
        script.onerror = () => {
            cleanup();
            reject(new Error('JSONP load error'));
        };

        document.body.appendChild(script);
    });
}

// อัปเดตฟังก์ชัน loadPortalData ให้เรียก fetchJSONP
async function loadPortalData() {
    try {
        const data = await fetchJSONP(API_URL);
        portalLinks = Array.isArray(data) && data.length > 0 ? data : DEFAULT_PORTAL_LINKS;
    } catch (err) {
        console.warn("API Fetch via JSONP Failed, falling back to default links:", err);
        portalLinks = DEFAULT_PORTAL_LINKS;
    }
    buildMenu();
    renderQuickDashboard();
}

function toggleFavorite(title, event) {
    if (event) event.stopPropagation();
    const index = favoriteTitles.indexOf(title);
    if (index > -1) {
        favoriteTitles.splice(index, 1);
    } else {
        favoriteTitles.push(title);
    }
    localStorage.setItem("gasd_portal_favorites", JSON.stringify(favoriteTitles));
    buildMenu();
    renderQuickDashboard();
}

function getCategoryCounts() {
    const counts = {};
    portalLinks.forEach(link => {
        counts[link.category] = (counts[link.category] || 0) + 1;
    });
    return counts;
}

function buildMenu(linksToRender) {
    if (!menuContainer) initElements();
    menuContainer.innerHTML = "";
    const links = linksToRender || portalLinks;
    const categoryCounts = getCategoryCounts();
    const isSearchMode = !!linksToRender;

    if (links.length === 0) {
        menuContainer.innerHTML = '<div class="text-center py-8 text-xs text-gray-400 dark:text-gray-500"><i class="ph ph-magnifying-glass text-2xl mb-1 block"></i>ไม่พบระบบงานที่ค้นหา</div>';
        return;
    }

    if (!isSearchMode && favoriteTitles.length > 0) {
        const favHeader = document.createElement("div");
        favHeader.className = "px-2.5 pt-2 pb-1 text-[10.5px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider flex items-center justify-between border-b border-amber-200/50 dark:border-amber-900/40 mb-1";
        favHeader.innerHTML = `<span class="flex items-center gap-1"><i class="ph-fill ph-star"></i> ระบบงานโปรด</span><span class="text-[9.5px] font-medium bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded-full">${favoriteTitles.length}</span>`;
        menuContainer.appendChild(favHeader);

        portalLinks.filter(l => favoriteTitles.includes(l.title)).forEach(link => {
            renderMenuItem(link, true);
        });
    }

    let currentCat = "";
    let isFirstItem = true;

    links.forEach(link => {
        if (link.category !== currentCat) {
            currentCat = link.category;
            const catHeader = document.createElement("div");
            catHeader.className = "px-2.5 pt-3.5 pb-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 mb-1";
            const countBadge = `<span class="text-[9.5px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 rounded-full">${categoryCounts[currentCat] || 0}</span>`;
            catHeader.innerHTML = `<span>${currentCat}</span>${countBadge}`;
            menuContainer.appendChild(catHeader);
        }

        renderMenuItem(link, false);

        if (isFirstItem && !linksToRender) {
            loadPage(link, null);
            isFirstItem = false;
        }
    });
}

function renderMenuItem(link, isFavSection) {
    const btn = document.createElement("button");
    btn.className = "w-full text-left flex items-center px-2.5 py-[8px] rounded-[8px] transition-all duration-150 group border border-transparent outline-none mb-0.5 " + inactiveClasses.join(" ");
    
    const isFav = favoriteTitles.includes(link.title);
    const starClass = isFav ? "ph-fill ph-star text-amber-400" : "ph ph-star text-gray-300 dark:text-gray-600 hover:text-amber-400 opacity-0 group-hover:opacity-100";
    const iconClass = link.icon || "ph-app-window";
    
    btn.innerHTML = `
        <div class="mr-2 text-emerald-600 dark:text-emerald-500 transition-colors flex-shrink-0 flex items-center justify-center">
            <i class="ph ${iconClass} text-[18px]"></i>
        </div>
        <span class="font-medium text-[12.5px] line-clamp-2 leading-tight flex-1 mr-1">${link.title}</span>
        <div onclick="toggleFavorite('${link.title.replace(/'/g, "\\'")}', event)" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex-shrink-0" title="ติดดาวไว้เปิดด่วน">
            <i class="${starClass} text-[14px]"></i>
        </div>
    `;
    
    btn.onclick = () => { loadPage(link, btn); toggleMenu(); };
    menuContainer.appendChild(btn);
}

function renderQuickDashboard() {
    const container = document.getElementById("quickDashboardGrid");
    if (!container) return;
    container.innerHTML = "";

    let shortcuts = portalLinks.filter(l => favoriteTitles.includes(l.title));
    if (shortcuts.length === 0) shortcuts = portalLinks.slice(0, 4);
    else if (shortcuts.length > 6) shortcuts = shortcuts.slice(0, 6);

    shortcuts.forEach(link => {
        const card = document.createElement("div");
        card.className = "p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 shadow-sm cursor-pointer transition-all hover:scale-[1.02]";
        card.onclick = () => loadPage(link, null);
        
        const iconClass = link.icon || "ph-app-window";
        card.innerHTML = `
            <div class="flex items-center gap-2 mb-1">
                <i class="ph ${iconClass} text-emerald-500 text-lg"></i>
                <span class="text-xs font-semibold text-gray-700 dark:text-gray-200 line-clamp-1 flex-1">${link.title}</span>
            </div>
            <span class="text-[10px] text-gray-400 dark:text-gray-500 line-clamp-1">${link.category}</span>
        `;
        container.appendChild(card);
    });
}

function filterMenu() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    const clearBtn = document.getElementById("clearSearchBtn");
    
    if (query) {
        clearBtn.classList.remove("hidden");
        const filtered = portalLinks.filter(link => 
            link.title.toLowerCase().includes(query) || link.category.toLowerCase().includes(query)
        );
        buildMenu(filtered);
    } else {
        clearBtn.classList.add("hidden");
        buildMenu();
    }
}

function clearSearch() {
    const input = document.getElementById("searchInput");
    input.value = "";
    filterMenu();
    input.focus();
}

function setActivePane(paneNum) {
    activePane = paneNum;
    const p1 = document.getElementById("pane1");
    const p2 = document.getElementById("pane2");
    const overlay1 = document.getElementById("paneOverlay1");
    const overlay2 = document.getElementById("paneOverlay2");

    if (paneNum === 1) {
        p1.classList.remove("border-transparent");
        p1.classList.add("border-emerald-500", "active-pane-glow");
        p2.classList.remove("border-emerald-500", "active-pane-glow");
        p2.classList.add("border-transparent");
        overlay1.classList.add("hidden");
        overlay2.classList.remove("hidden");
    } else {
        p2.classList.remove("border-transparent");
        p2.classList.add("border-emerald-500", "active-pane-glow");
        p1.classList.remove("border-emerald-500", "active-pane-glow");
        p1.classList.add("border-transparent");
        overlay2.classList.add("hidden");
        overlay1.classList.remove("hidden");
    }
    updateHeaderUI();
}

function toggleSplitMode() {
    isSplitMode = !isSplitMode;
    const p1 = document.getElementById("pane1");
    const p2 = document.getElementById("pane2");
    const splitIcon = document.querySelector("#splitToggleBtn i");

    if (isSplitMode) {
        p1.classList.remove("hidden");
        p2.classList.remove("hidden");
        splitIcon.classList.remove("ph-columns");
        splitIcon.classList.add("ph-rectangle");
        renderQuickDashboard();
        setActivePane(panes[2].primaryUrl ? 2 : 1);
    } else {
        if (activePane === 1) {
            p2.classList.add("hidden");
        } else {
            p1.classList.add("hidden");
        }
        splitIcon.classList.remove("ph-rectangle");
        splitIcon.classList.add("ph-columns");
    }
}

function loadPage(linkData, activeBtn) {
    const state = panes[activePane];
    state.primaryUrl = linkData.url;
    state.fallbackUrl = linkData.fallbackUrl || "";
    state.isFallback = false;
    state.btn = activeBtn;
    state.title = linkData.title;

    if (activePane === 2) {
        document.getElementById("emptyState2").classList.add("hidden");
    }

    updateHeaderUI();
    const targetUrl = state.isFallback ? state.fallbackUrl : state.primaryUrl;
    loadIframe(targetUrl, activePane);
}

function changeZoom(step) {
    const state = panes[activePane];
    state.zoom = step === 0 ? 1 : state.zoom + step;
    if (state.zoom < 0.5) state.zoom = 0.5;
    if (state.zoom > 2.0) state.zoom = 2.0;
    applyZoom();
}

function applyZoom() {
    const state = panes[activePane];
    const iframe = document.getElementById("contentIframe" + activePane);
    if (iframe) iframe.style.zoom = state.zoom;
    
    const zoomDisplay = document.getElementById("zoomLevelDisplay");
    if (zoomDisplay) {
        zoomDisplay.innerText = Math.round(state.zoom * 100) + "%";
    }
}

function updateHeaderUI() {
    if (!menuContainer) initElements();
    const state = panes[activePane];
    const allBtns = menuContainer.querySelectorAll("button");
    
    allBtns.forEach(b => {
        b.classList.remove(...activeClasses);
        b.classList.add(...inactiveClasses);
    });
    
    if (state.btn) {
        state.btn.classList.remove(...inactiveClasses);
        state.btn.classList.add(...activeClasses);
    }

    if (state.fallbackUrl) {
        fallbackToggleBtn.classList.remove("hidden");
    } else {
        fallbackToggleBtn.classList.add("hidden");
    }
    
    if (state.isFallback) {
        fallbackToggleBtn.classList.add("text-orange-500", "bg-orange-50", "dark:text-orange-400", "dark:bg-orange-900/40");
        fallbackToggleBtn.classList.remove("text-gray-400", "dark:text-gray-500");
    } else {
        fallbackToggleBtn.classList.remove("text-orange-500", "bg-orange-50", "dark:text-orange-400", "dark:bg-orange-900/40");
        fallbackToggleBtn.classList.add("text-gray-400", "dark:text-gray-500");
    }

    if (state.title === "วันนี้") {
        dateTimeContainer.classList.replace("flex", "hidden");
        titleContainer.classList.replace("hidden", "flex");
        titleContainerText.innerText = document.title; 
    } else {
        dateTimeContainer.classList.replace("hidden", "flex");
        titleContainer.classList.replace("flex", "hidden");
    }

    const url = state.isFallback ? state.fallbackUrl : state.primaryUrl;
    let displayUrl = "เลือกเมนู";
    if (url) {
        const parts = url.split("://");
        const noProto = parts.length > 1 ? parts[1] : url;
        displayUrl = noProto.split("/macros/s/").join("/...").split("/exec").join("");
    }
    currentUrlDisplay.innerText = displayUrl;
    applyZoom();
}

function loadIframe(url, paneNum) {
    if (!url) return;
    const iframe = document.getElementById("contentIframe" + paneNum);
    const indicator = document.getElementById("loadingIndicator" + paneNum);
    const timeoutBox = document.getElementById("timeoutBox" + paneNum);
    const timeoutFallbackBtn = document.getElementById("timeoutFallbackBtn" + paneNum);
    const state = panes[paneNum];

    if (loadTimeouts[paneNum]) clearTimeout(loadTimeouts[paneNum]);
    if (timeoutBox) timeoutBox.classList.add("hidden");

    if (indicator) indicator.classList.remove("hidden", "opacity-0");
    if (iframe) {
        iframe.classList.add("opacity-0");
        iframe.src = url;
    }

    loadTimeouts[paneNum] = setTimeout(() => {
        if (indicator && !indicator.classList.contains("hidden")) {
            if (timeoutBox) timeoutBox.classList.remove("hidden");
            if (timeoutFallbackBtn) {
                if (state.fallbackUrl) timeoutFallbackBtn.classList.remove("hidden");
                else timeoutFallbackBtn.classList.add("hidden");
            }
        }
    }, 12000);
}

function copyToClipboard(textToCopy) {
    return new Promise((resolve, reject) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(resolve).catch(() => {
                fallbackCopyText(textToCopy, resolve, reject);
            });
        } else {
            fallbackCopyText(textToCopy, resolve, reject);
        }
    });
}

function fallbackCopyText(text, resolve, reject) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.width = "2em";
        textArea.style.height = "2em";
        textArea.style.padding = "0";
        textArea.style.border = "none";
        textArea.style.outline = "none";
        textArea.style.boxShadow = "none";
        textArea.style.background = "transparent";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) resolve();
        else reject();
    } catch (err) {
        reject(err);
    }
}

function shareUrl() {
    const state = panes[activePane];
    const url = state.isFallback ? state.fallbackUrl : state.primaryUrl;
    if (!url) return;

    copyToClipboard(url).then(() => {
        const icon = document.getElementById("shareIcon");
        if (icon) {
            icon.classList.remove("ph-export");
            icon.classList.add("ph-check-circle", "text-emerald-500", "font-bold");
            setTimeout(() => { 
                icon.classList.remove("ph-check-circle", "text-emerald-500", "font-bold"); 
                icon.classList.add("ph-export"); 
            }, 2000);
        }
    }).catch(() => {
        window.prompt("คัดลอกลิงก์นี้:", url);
    });
}

function copyEmbedCode() {
    const state = panes[activePane];
    let currentUrl = state.isFallback ? state.fallbackUrl : state.primaryUrl;
    if (!currentUrl) currentUrl = window.location.href;

    const embedCode = `<iframe src="${currentUrl}" width="100%" height="800" frameborder="0" allow="geolocation; fullscreen; clock; clipboard-write" style="border:none; width:100%; height:100vh;"></iframe>`;

    copyToClipboard(embedCode).then(() => {
        const icon = document.getElementById("embedIcon");
        if (icon) {
            icon.classList.remove("ph-code");
            icon.classList.add("ph-check-circle", "text-indigo-500", "font-bold");
            setTimeout(() => { 
                icon.classList.remove("ph-check-circle", "text-indigo-500", "font-bold"); 
                icon.classList.add("ph-code"); 
            }, 2000);
        }
    }).catch(() => {
        window.prompt("คัดลอกโค้ด iFrame นี้:", embedCode);
    });
}

function toggleMenu() {
    const isClosed = sidebar.classList.contains("-translate-x-full");
    if (isClosed) {
        sidebar.classList.remove("-translate-x-full");
        menuOverlay.classList.remove("hidden");
        setTimeout(() => {
            const searchInput = document.getElementById("searchInput");
            if (searchInput) searchInput.focus();
        }, 100);
    } else {
        sidebar.classList.add("-translate-x-full");
        menuOverlay.classList.add("hidden");
    }
    
    setTimeout(() => { 
        if (isClosed) {
            menuOverlay.classList.remove("opacity-0");
        } else {
            menuOverlay.classList.add("opacity-0");
        }
    }, 10);
}

function toggleFallbackUrl() {
    const state = panes[activePane];
    if (!state.fallbackUrl) return;
    state.isFallback = !state.isFallback;
    updateHeaderUI();
    loadIframe(state.isFallback ? state.fallbackUrl : state.primaryUrl, activePane);
}

function refreshIframe() { 
    const state = panes[activePane];
    loadIframe(state.isFallback ? state.fallbackUrl : state.primaryUrl, activePane); 
}

function toggleWakeLock() {
    const btn = document.getElementById("wakeLockBtn");
    const icon = document.getElementById("wakeLockIcon");
    
    if ('wakeLock' in navigator) {
        if (!wakeLockObj) {
            navigator.wakeLock.request('screen').then(lock => {
                wakeLockObj = lock;
                icon.classList.add("text-amber-500");
                btn.classList.add("bg-amber-50", "dark:bg-amber-900/40");
                lock.addEventListener('release', () => {
                    wakeLockObj = null;
                    icon.classList.remove("text-amber-500");
                    btn.classList.remove("bg-amber-50", "dark:bg-amber-900/40");
                });
            }).catch(console.error);
        } else {
            wakeLockObj.release().then(() => {
                wakeLockObj = null;
            });
        }
    }
}

function toggleFullScreen() {
    const targetDoc = document.documentElement;
    const doc = document;
    
    if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        if (targetDoc.requestFullscreen) targetDoc.requestFullscreen().catch(() => {});
        else if (targetDoc.webkitRequestFullscreen) targetDoc.webkitRequestFullscreen();
        else if (targetDoc.msRequestFullscreen) targetDoc.msRequestFullscreen();
    } else {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
    }
}

function updateMacFullscreenUI() {
    const icons = document.querySelectorAll(".mac-fullscreen-icon");
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;

    if (isFull) {
        document.body.classList.add("fullscreen-active");
        icons.forEach(icon => {
            icon.className = "mac-fullscreen-icon ph ph-arrows-in-simple text-[7px] sm:text-[8px] text-black/60 font-bold";
        });
    } else {
        document.body.classList.remove("fullscreen-active");
        icons.forEach(icon => {
            icon.className = "mac-fullscreen-icon ph ph-arrows-out-simple text-[7px] sm:text-[8px] text-black/60 font-bold";
        });
    }
}

function updateClock() {
    const now = new Date();
    const dOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
    if (dateDisplay) dateDisplay.innerText = new Intl.DateTimeFormat("th-TH", dOptions).format(now);
    const timeStr = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now) + " น.";
    if (clockDisplay) clockDisplay.innerText = timeStr;
    if (clockDisplayMobile) clockDisplayMobile.innerText = timeStr;
}

// Initial Setup
window.onload = function() { 
    initElements();
    
    [1, 2].forEach(num => {
        const iframe = document.getElementById("contentIframe" + num);
        const indicator = document.getElementById("loadingIndicator" + num);
        if (iframe) {
            iframe.addEventListener("load", () => {
                if (iframe.src && !iframe.src.includes("about:blank")) {
                    if (loadTimeouts[num]) clearTimeout(loadTimeouts[num]);
                    if (indicator) indicator.classList.add("opacity-0");
                    setTimeout(() => { 
                        if (indicator) indicator.classList.add("hidden"); 
                        iframe.classList.remove("opacity-0"); 
                    }, 300);
                }
            });
        }
    });

    document.addEventListener("fullscreenchange", updateMacFullscreenUI);
    document.addEventListener("webkitfullscreenchange", updateMacFullscreenUI);
    document.addEventListener("msfullscreenchange", updateMacFullscreenUI);
    
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleMenu();
        }
    });

    const menuBtn = document.getElementById("menuBtn");
    if (menuBtn) menuBtn.addEventListener("click", toggleMenu);

    loadPortalData();
    updateClock(); 
    setInterval(updateClock, 1000); 
};
