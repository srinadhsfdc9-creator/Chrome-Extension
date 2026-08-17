// Selector configurations for Google Meet, MS Teams, and Zoom captions
const CAPTION_SELECTORS = [
  '.a4bIc', // Google Meet caption container
  '.bhZ3Mc', // Google Meet sub-container
  'div[jsname="YS7M5c"]', // Google Meet active speaker caption text
  'div[jscontroller="D1mJTe"]', // Google Meet caption block
  'div[class*="caption" i]', // Any class containing "caption" (Teams/Zoom dynamic classes)
  'div[class*="transcript" i]', // Any class containing "transcript" (Teams transcript panel)
  'div[class*="meeting-captions" i]',
  'div[class*="live-captions" i]',
  'div[data-tid*="caption" i]',
  'div[data-tid*="transcript" i]',
  'div[aria-label*="caption" i]',
  'div[aria-label*="transcript" i]',
  '.caption-row', // MS Teams caption row
  'div[data-tid="captions-text"]', // MS Teams text container
  '.meeting-control-caption-text', // Zoom caption text container
  '.captions-container' // Zoom caption container
];

// Auto-enable captions selector buttons
const CC_BUTTON_SELECTORS = [
  'button[aria-label*="turn on captions" i]',
  'button[aria-label*="captions (c)" i]',
  'button[aria-label*="captions" i]',
  '[jsname="r4nke"]', // Google Meet CC toggle button
  'button[data-tid="meet-cc-toggle"]', // MS Teams CC toggle
  '.meeting-control-caption-button' // Zoom Caption toggle
];

let activeObserver = null;
let lastCapturedText = "";
let ccClicked = false;

// Overlay State
let overlayVisible = true;
let currentSolutionData = null;

console.log("[Interview Copilot] Content script injected successfully.");

// Periodic scanner to locate captions container, auto-enable CC, and load overlay
const scanTimer = setInterval(() => {
  // 1. Try to auto-enable captions if not done yet
  if (!ccClicked) {
    autoEnableCaptions();
  }

  // 2. Scan for active caption blocks in the DOM to listen
  for (const selector of CAPTION_SELECTORS) {
    const container = document.querySelector(selector);
    if (container && (!activeObserver || activeObserver.target !== container)) {
      console.log(`[Interview Copilot] Found subtitle container matching: "${selector}". Attaching observer.`);
      attachObserver(container);
      break;
    }
  }
}, 2000);

// Auto-enable captions function
function autoEnableCaptions() {
  for (const selector of CC_BUTTON_SELECTORS) {
    const btn = document.querySelector(selector);
    if (btn) {
      const ariaPressed = btn.getAttribute('aria-pressed');
      const isAlreadyOn = ariaPressed === 'true' || btn.classList.contains('active') || btn.classList.contains('cc-active');
      
      if (!isAlreadyOn) {
        console.log(`[Interview Copilot] Auto-enabling captions. Clicking element: "${selector}"`);
        btn.click();
        ccClicked = true;
        showNotification("Live Captions Auto-Enabled");
        break;
      } else {
        ccClicked = true;
        break;
      }
    }
  }
}

// Injected toast indicator on the meeting screen
function showNotification(message) {
  const toast = document.createElement('div');
  toast.innerText = `🤖 ${message}`;
  toast.style.position = 'fixed';
  toast.style.bottom = '80px';
  toast.style.left = '20px';
  toast.style.backgroundColor = '#1e1b4b';
  toast.style.color = '#c084fc';
  toast.style.padding = '12px 18px';
  toast.style.borderRadius = '8px';
  toast.style.border = '1px solid #4338ca';
  toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
  toast.style.zIndex = '99999';
  toast.style.fontFamily = 'sans-serif';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = 'bold';
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.5s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// Attach MutationObserver to the found subtitle container
function attachObserver(target) {
  if (activeObserver) {
    activeObserver.disconnect();
  }

  const observer = new MutationObserver((mutations) => {
    let freshText = "";

    // Collect all text from target container children
    freshText = target.innerText || target.textContent;
    if (!freshText) return;

    const cleanText = freshText.trim().replace(/\s+/g, ' ');
    if (cleanText === lastCapturedText) return;

    // Filter noise or extremely short inputs
    if (cleanText.length > 2 && !cleanText.startsWith(":") && cleanText !== lastCapturedText) {
      chrome.runtime.sendMessage({ 
        action: 'subtitleCaptured', 
        text: cleanText 
      });
      lastCapturedText = cleanText;
      updateStealthLiveText(cleanText);
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true
  });

  activeObserver = observer;
  activeObserver.target = target;
}

// ==========================================
// STEALTH FLOATING OVERLAY LOGIC & DESIGN
// ==========================================

const STEALTH_CSS = `
  :root {
    --copilot-opacity: 0.15;
    --copilot-hover-opacity: 0.85;
  }
  
  #copilot-stealth-widget {
    position: fixed;
    top: 80px;
    right: 25px;
    width: 320px;
    height: 400px;
    background-color: rgba(11, 15, 25, var(--copilot-opacity));
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(1.5px);
    z-index: 2147483645;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: rgba(243, 244, 246, 0.6);
    user-select: none;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  #copilot-stealth-widget:hover {
    background-color: rgba(11, 15, 25, var(--copilot-hover-opacity));
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(243, 244, 246, 0.95);
    backdrop-filter: blur(6px);
  }

  #copilot-widget-header {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: rgba(96, 165, 250, 0.6);
  }

  #copilot-stealth-widget:hover #copilot-widget-header {
    color: rgba(96, 165, 250, 0.95);
  }

  .copilot-header-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .copilot-control-btn {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 12px;
    padding: 2px 4px;
    opacity: 0.6;
  }
  .copilot-control-btn:hover {
    opacity: 1;
  }

  #copilot-widget-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13px;
  }

  .copilot-live-preview {
    font-style: italic;
    color: rgba(148, 163, 184, 0.5);
    border-left: 2px solid rgba(59, 130, 246, 0.3);
    padding-left: 8px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  #copilot-stealth-widget:hover .copilot-live-preview {
    color: rgba(148, 163, 184, 0.85);
  }

  .copilot-tabs {
    display: flex;
    gap: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 6px;
  }

  .copilot-tab-btn {
    background: none;
    border: none;
    color: rgba(148, 163, 184, 0.5);
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 4px;
  }

  .copilot-tab-btn.active {
    color: rgba(59, 130, 246, 0.8);
    background-color: rgba(59, 130, 246, 0.08);
  }

  #copilot-stealth-widget:hover .copilot-tab-btn {
    color: rgba(148, 163, 184, 0.7);
  }
  #copilot-stealth-widget:hover .copilot-tab-btn.active {
    color: rgba(59, 130, 246, 1);
  }

  .copilot-tab-content {
    display: none;
    font-size: 12.5px;
    line-height: 1.45;
  }
  .copilot-tab-content.active {
    display: block;
  }

  /* Styling for fainted highlights in injected widget */
  .copilot-tab-content strong {
    color: rgba(96, 165, 250, 0.7);
    background-color: rgba(96, 165, 250, 0.05);
    padding: 1px 3px;
    border-radius: 3px;
  }
  #copilot-stealth-widget:hover .copilot-tab-content strong {
    color: rgba(96, 165, 250, 1);
    background-color: rgba(96, 165, 250, 0.1);
  }

  .copilot-config-tag {
    font-family: monospace;
    background-color: rgba(52, 211, 153, 0.05);
    color: rgba(52, 211, 153, 0.6);
    padding: 1px 4px;
    border-radius: 3px;
  }
  #copilot-stealth-widget:hover .copilot-config-tag {
    background-color: rgba(52, 211, 153, 0.1);
    color: rgba(52, 211, 153, 1);
  }

  .copilot-bullets {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .copilot-bullets li {
    position: relative;
    padding-left: 14px;
  }
  .copilot-bullets li::before {
    content: '✦';
    position: absolute;
    left: 0;
    color: rgba(59, 130, 246, 0.5);
    font-size: 9px;
  }
  #copilot-stealth-widget:hover .copilot-bullets li::before {
    color: rgba(59, 130, 246, 0.9);
  }

  .copilot-code-block {
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.15);
    padding: 8px;
    border-radius: 6px;
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 11px;
    color: rgba(226, 232, 240, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.03);
    max-height: 250px;
    overflow-y: auto;
  }
  #copilot-stealth-widget:hover .copilot-code-block {
    background-color: rgba(0, 0, 0, 0.4);
    color: rgba(226, 232, 240, 0.95);
  }

  .copilot-slider-container {
    padding: 6px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(148, 163, 184, 0.4);
  }
  #copilot-stealth-widget:hover .copilot-slider-container {
    color: rgba(148, 163, 184, 0.8);
  }

  .copilot-opacity-slider {
    flex: 1;
    accent-color: #3b82f6;
    cursor: pointer;
    height: 3px;
    opacity: 0.5;
  }
  .copilot-opacity-slider:hover {
    opacity: 0.9;
  }

  /* Minimized State */
  #copilot-stealth-widget.minimized {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background-color: rgba(59, 130, 246, var(--copilot-opacity));
    border-color: rgba(59, 130, 246, 0.3);
  }
  #copilot-stealth-widget.minimized:hover {
    background-color: rgba(59, 130, 246, var(--copilot-hover-opacity));
    border-color: rgba(59, 130, 246, 0.8);
  }
  #copilot-stealth-widget.minimized #copilot-widget-header {
    border-bottom: none;
    padding: 6px;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  #copilot-stealth-widget.minimized #copilot-widget-header span {
    display: none;
  }
  #copilot-stealth-widget.minimized #copilot-widget-body,
  #copilot-stealth-widget.minimized .copilot-slider-container {
    display: none !important;
  }
`;

// Inject Stealth Overlay HTML elements
function injectStealthOverlay() {
  if (document.getElementById('copilot-stealth-widget')) return;

  // Insert styles
  const styleEl = document.createElement('style');
  styleEl.textContent = STEALTH_CSS;
  document.head.appendChild(styleEl);

  // Insert widget DOM
  const widget = document.createElement('div');
  widget.id = 'copilot-stealth-widget';
  
  widget.innerHTML = `
    <div id="copilot-widget-header">
      <span>Copilot Overlay</span>
      <div class="copilot-header-controls">
        <button id="copilot-minimize-btn" class="copilot-control-btn" title="Toggle collapse">&#9776;</button>
      </div>
    </div>
    <div id="copilot-widget-body">
      <div id="copilot-stealth-live-preview" class="copilot-live-preview">Waiting for question subtitles...</div>
      <div class="copilot-tabs">
        <button class="copilot-tab-btn active" data-stealth-tab="stealth-approach-tab">Approach</button>
        <button class="copilot-tab-btn" data-stealth-tab="stealth-code-tab">Code / Config</button>
        <button class="copilot-tab-btn" data-stealth-tab="stealth-usecase-tab">Use Case</button>
      </div>
      
      <!-- Tab Contents -->
      <div id="stealth-approach-tab" class="copilot-tab-content active">
        <ul id="stealth-bullets-list" class="copilot-bullets">
          <li>No solution generated yet. Turn on sync and feed in a question.</li>
        </ul>
      </div>
      <div id="stealth-code-tab" class="copilot-tab-content">
        <pre id="stealth-code-box" class="copilot-code-block">N/A</pre>
      </div>
      <div id="stealth-usecase-tab" class="copilot-tab-content">
        <div id="stealth-usecase-box" style="margin-bottom: 10px;">N/A</div>
        <div id="stealth-script-box" style="font-style: italic; color: rgba(148, 163, 184, 0.6); padding-left: 6px; border-left: 2px solid rgba(59, 130, 246, 0.4);">N/A</div>
      </div>
    </div>
    <div class="copilot-slider-container">
      <span>Stealth</span>
      <input type="range" id="copilot-opacity-range" class="copilot-opacity-slider" min="0.03" max="0.75" step="0.01" value="0.15">
      <span id="copilot-opacity-val">15%</span>
    </div>
  `;

  document.body.appendChild(widget);
  setupOverlayInteractions(widget);
}

// Register event listeners for dragging, minimizing, sliding opacity, and tab switching
function setupOverlayInteractions(widget) {
  const header = document.getElementById('copilot-widget-header');
  const minimizeBtn = document.getElementById('copilot-minimize-btn');
  const opacityRange = document.getElementById('copilot-opacity-range');
  const opacityValText = document.getElementById('copilot-opacity-val');
  const tabButtons = widget.querySelectorAll('.copilot-tab-btn');

  // Load saved opacity settings
  chrome.storage.local.get(['stealthOpacity', 'stealthMinimized'], (result) => {
    const savedOpacity = result.stealthOpacity !== undefined ? result.stealthOpacity : 0.15;
    opacityRange.value = savedOpacity;
    opacityValText.textContent = `${Math.round(savedOpacity * 100)}%`;
    document.documentElement.style.setProperty('--copilot-opacity', savedOpacity);
    document.documentElement.style.setProperty('--copilot-hover-opacity', Math.min(savedOpacity + 0.65, 0.95));

    if (result.stealthMinimized === true) {
      widget.classList.add('minimized');
    }
  });

  // Opacity Slider Change Listener
  opacityRange.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    opacityValText.textContent = `${Math.round(val * 100)}%`;
    document.documentElement.style.setProperty('--copilot-opacity', val);
    
    // Set hover opacity slightly higher to keep it readable but stealthy
    const hoverVal = Math.min(val + 0.65, 0.95);
    document.documentElement.style.setProperty('--copilot-hover-opacity', hoverVal);
    
    chrome.storage.local.set({ stealthOpacity: val });
  });

  // Minimize Toggle Listener
  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isMin = widget.classList.toggle('minimized');
    chrome.storage.local.set({ stealthMinimized: isMin });
  });

  // Allow double-click header to minimize
  header.addEventListener('dblclick', () => {
    const isMin = widget.classList.toggle('minimized');
    chrome.storage.local.set({ stealthMinimized: isMin });
  });

  // Tab switching click handlers
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = btn.getAttribute('data-stealth-tab');
      
      widget.querySelectorAll('.copilot-tab-btn').forEach(b => b.classList.remove('active'));
      widget.querySelectorAll('.copilot-tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Drag and Drop implementation
  let activeDrag = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mousemove', drag);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    if (e.target === header || header.contains(e.target)) {
      activeDrag = true;
    }
  }

  function dragEnd() {
    initialX = currentX;
    initialY = currentY;
    activeDrag = false;
  }

  function drag(e) {
    if (!activeDrag) return;
    
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    xOffset = currentX;
    yOffset = currentY;

    widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
  }
}

// Update the live subtitle preview box on the floating widget
function updateStealthLiveText(text) {
  const preview = document.getElementById('copilot-stealth-live-preview');
  if (preview) {
    preview.innerHTML = `<strong>Speaking:</strong> ${text}`;
  }
}

// Render generated solution inside the floating widget
function renderStealthSolution(solution, tech) {
  // 1. Render talking points bullets
  const bulletsList = document.getElementById('stealth-bullets-list');
  if (bulletsList) {
    bulletsList.innerHTML = '';
    if (solution.talking_points && Array.isArray(solution.talking_points)) {
      solution.talking_points.forEach(point => {
        const li = document.createElement('li');
        li.innerHTML = formatStealthText(point);
        bulletsList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = "No talking points returned.";
      bulletsList.appendChild(li);
    }
  }

  // 2. Render code block
  const codeBox = document.getElementById('stealth-code-box');
  if (codeBox) {
    if (isNonCoding(tech)) {
      codeBox.innerHTML = formatStealthText(solution.code || '');
      codeBox.style.whiteSpace = 'pre-wrap';
    } else {
      codeBox.textContent = solution.code || '';
      codeBox.style.whiteSpace = 'pre';
    }
  }

  // 3. Render use case details
  const usecaseBox = document.getElementById('stealth-usecase-box');
  const scriptBox = document.getElementById('stealth-script-box');
  if (usecaseBox) {
    usecaseBox.innerHTML = formatStealthText(solution.real_time_usecase || 'N/A');
  }
  if (scriptBox) {
    scriptBox.innerHTML = formatStealthText(solution.how_to_say_it || 'N/A');
  }

  // Trigger brief highlight animations on headers
  const widget = document.getElementById('copilot-stealth-widget');
  if (widget) {
    widget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    setTimeout(() => {
      widget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
    }, 1500);
  }
}

// Format markdown highlights in injected elements
function formatStealthText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="copilot-config-tag">$1</code>');
}

// Check non-coding helper in content script
function isNonCoding(tech) {
  const t = tech.toLowerCase();
  const codingKeywords = ['python', 'javascript', 'java', 'c++', 'c#', 'typescript', 'golang', 'rust', 'ruby', 'php', 'sql', 'apex'];
  return !codingKeywords.some(lang => t.includes(lang));
}

// Listen for messages from background/sidepanel script to sync solution rendering
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateStealthSolution') {
    renderStealthSolution(message.solution, message.tech);
    sendResponse({ success: true });
  }
});

// Initialize the overlay when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectStealthOverlay);
} else {
  injectStealthOverlay();
}
