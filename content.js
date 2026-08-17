// Selector configurations for Google Meet, MS Teams, and Zoom captions
const CAPTION_SELECTORS = [
  '.a4bIc', // Google Meet caption container
  '.bhZ3Mc', // Google Meet sub-container
  'div[jsname="YS7M5c"]', // Google Meet active speaker caption text
  'div[jscontroller="D1mJTe"]', // Google Meet caption block
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

console.log("[Interview Copilot] Content script injected successfully.");

// Periodic scanner to locate captions container and auto-enable CC
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
