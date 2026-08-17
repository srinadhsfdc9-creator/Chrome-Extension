// Mock chrome APIs for local/browser testing if running outside extension context
if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
  console.log("Mocking Chrome Extension APIs for browser testing.");
  window.chrome = {
    storage: {
      local: {
        get: (keys, callback) => {
          const result = {};
          keys.forEach(k => {
            result[k] = localStorage.getItem(k);
          });
          callback(result);
        },
        set: (obj, callback) => {
          Object.keys(obj).forEach(k => {
            localStorage.setItem(k, obj[k]);
          });
          if (callback) callback();
        }
      }
    },
    tabs: {
      query: async (queryInfo) => {
        return [{ id: 1, url: 'https://leetcode.com/problems/two-sum/', title: 'LeetCode Two Sum' }];
      }
    },
    scripting: {
      executeScript: (options, callback) => {
        callback([{
          result: {
            text: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\nYou may assume that each input would have exactly one solution, and you may not use the same element twice."
          }
        }]);
      }
    },
    runtime: {
      sendMessage: (message, callback) => {
        if (message.action === 'captureTab') {
          // 1x1 red dot base64 png
          callback({ screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" });
        }
      },
      lastError: null
    }
  };
}

// DOM Elements
const settingsBtn = document.getElementById('settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiKeyInput = document.getElementById('api-key-input');
const modelSelect = document.getElementById('model-select');
const techInput = document.getElementById('tech-input');
const relayUrlInput = document.getElementById('relay-url-input');
const providerSelect = document.getElementById('provider-select');
const apiKeyLabel = document.getElementById('api-key-label');
const helpText = document.getElementById('help-text');
const speedModeToggle = document.getElementById('speed-mode-toggle');

const captureTextBtn = document.getElementById('capture-text-btn');
const captureScreenBtn = document.getElementById('capture-screen-btn');
const syncMobileBtn = document.getElementById('sync-mobile-btn');
const clearBtn = document.getElementById('clear-btn');
const solveBtn = document.getElementById('solve-btn');
const questionTextarea = document.getElementById('question-textarea');
const listeningIndicator = document.getElementById('listening-indicator');

const imagePreviewContainer = document.getElementById('image-preview-container');
const screenshotPreview = document.getElementById('screenshot-preview');
const removeImageBtn = document.getElementById('remove-image-btn');

const solutionSection = document.getElementById('solution-section');
const talkingPointsList = document.getElementById('talking-points-list');
const timeComplexityEl = document.getElementById('time-complexity');
const spaceComplexityEl = document.getElementById('space-complexity');
const solutionCodeEl = document.getElementById('solution-code');
const codeLangLabel = document.getElementById('code-lang-label');
const copyCodeBtn = document.getElementById('copy-code-btn');

const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const toast = document.getElementById('toast');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// App State
let currentScreenshotBase64 = null;
let toastTimeout = null;
let isSyncActive = false;

// Models by AI provider config
const MODELS_BY_PROVIDER = {
  gemini: [
    { value: 'gemini-3.5-flash', text: 'Gemini 3.5 Flash (Fastest)' },
    { value: 'gemini-3.6-flash', text: 'Gemini 3.6 Flash (Latest)' },
    { value: 'gemini-2.0-flash', text: 'Gemini 2.0 Flash (Fast)' }
  ],
  openai: [
    { value: 'gpt-4o-mini', text: 'GPT-4o Mini (Fast & Cheap)' },
    { value: 'gpt-4o', text: 'GPT-4o (Powerful)' }
  ],
  claude: [
    { value: 'claude-3-5-sonnet-20240620', text: 'Claude 3.5 Sonnet (Recommended)' },
    { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku (Fast)' }
  ]
};
let currentProvider = 'gemini';

// Initialize Settings
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['aiProvider', 'interviewTech', 'speedMode', 'relayUrl', 'isSyncActive'], (result) => {
    const savedProvider = result.aiProvider || 'gemini';
    providerSelect.value = savedProvider;
    
    updateSettingsUI(savedProvider);
    
    const savedTech = result.interviewTech || 'General Programming';
    if (savedTech) techInput.value = savedTech;

    const savedSpeedMode = result.speedMode;
    if (savedSpeedMode !== undefined) {
      speedModeToggle.checked = savedSpeedMode;
    }

    const savedRelayUrl = result.relayUrl || 'http://localhost:3000';
    relayUrlInput.value = savedRelayUrl;

    isSyncActive = result.isSyncActive === true;
    if (isSyncActive) {
      syncMobileBtn.classList.add('active');
    } else {
      syncMobileBtn.classList.remove('active');
    }
  });
});

// Update settings drawer when provider changes
function updateSettingsUI(provider) {
  const labels = {
    gemini: 'Gemini API Key',
    openai: 'OpenAI API Key',
    claude: 'Claude API Key'
  };
  const helpTexts = {
    gemini: 'Get an API key from Google AI Studio.',
    openai: 'Get an API key from OpenAI Platform.',
    claude: 'Get an API key from Anthropic Console.'
  };

  apiKeyLabel.textContent = labels[provider] || 'API Key';
  apiKeyInput.placeholder = `Enter ${labels[provider] || 'API Key'}`;
  if (helpText) {
    helpText.textContent = helpTexts[provider] || '';
  }

  modelSelect.innerHTML = '';
  const models = MODELS_BY_PROVIDER[provider] || [];
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.text;
    modelSelect.appendChild(opt);
  });

  chrome.storage.local.get([`${provider}ApiKey`, `${provider}Model`], (result) => {
    apiKeyInput.value = result[`${provider}ApiKey`] || '';
    if (result[`${provider}Model`]) {
      modelSelect.value = result[`${provider}Model`];
    }
  });

  currentProvider = provider;
}

providerSelect.addEventListener('change', (e) => {
  const oldProvider = currentProvider;
  const newProvider = e.target.value;
  
  // Save current input key to previous provider before switching
  const updateObj = {};
  updateObj[`${oldProvider}ApiKey`] = apiKeyInput.value.trim();
  
  chrome.storage.local.set(updateObj, () => {
    updateSettingsUI(newProvider);
  });
});

// Modal Logic
settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
  if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

// Save Settings
saveSettingsBtn.addEventListener('click', () => {
  const provider = providerSelect.value;
  const key = apiKeyInput.value.trim();
  const model = modelSelect.value;
  const tech = techInput.value.trim();
  const relayUrl = relayUrlInput.value.trim() || 'http://localhost:3000';

  const saveObj = {
    aiProvider: provider,
    interviewTech: tech,
    speedMode: speedModeToggle.checked,
    relayUrl: relayUrl
  };
  saveObj[`${provider}ApiKey`] = key;
  saveObj[`${provider}Model`] = model;

  chrome.storage.local.set(saveObj, () => {
    settingsModal.classList.add('hidden');
    showToast("Settings saved!");
  });
});

// Toast Utility
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2000);
}

// Loading Utility
function showLoading(msg) {
  loadingMessage.textContent = msg;
  loadingOverlay.classList.remove('hidden');
}

// Hide Loading Utility
function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Tab Switching Logic
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.getAttribute('data-tab');
    switchTab(tabId);
  });
});

function switchTab(tabId) {
  tabButtons.forEach(b => {
    if (b.getAttribute('data-tab') === tabId) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  tabContents.forEach(c => {
    if (c.id === tabId) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}

// Scrape Page Text Dynamically
captureTextBtn.addEventListener('click', async () => {
  showLoading("Reading webpage text...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      hideLoading();
      showToast("No active tab found.");
      return;
    }

    // Check if it is a system/extensions tab
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      hideLoading();
      alert("Browser policy restricts reading text from browser system pages. Please try on a standard website.");
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Try getting active selection first
        const selected = window.getSelection().toString().trim();
        if (selected) return { text: selected };

        // Commonly known selectors for coding problem statements
        const selectors = [
          '[data-track-load="description_content"]', // Leetcode
          '.problem-question', // GFG
          '.challenge-description', // HackerRank
          'main article',
          'main',
          'body'
        ];

        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el && el.innerText.trim().length > 100) {
            return { text: el.innerText.trim().substring(0, 8000) };
          }
        }
        return { text: document.body.innerText.trim().substring(0, 5000) };
      }
    }, (results) => {
      hideLoading();
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        alert("Permission denied or script injection failed. Ensure the extension has permission to run on this site.");
        return;
      }

      if (results && results[0] && results[0].result) {
        const text = results[0].result.text;
        questionTextarea.innerText = text;
        showToast("Text read successfully!");
      } else {
        showToast("Failed to read webpage text.");
      }
    });
  } catch (err) {
    hideLoading();
    console.error(err);
    showToast("Error capturing text.");
  }
});

// Capture Screen / Video Frame
captureScreenBtn.addEventListener('click', () => {
  showLoading("Reading active screen...");
  chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
    hideLoading();
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      alert("Failed to capture tab. Make sure the extension is active on a standard tab.");
      return;
    }

    if (response && response.screenshot) {
      currentScreenshotBase64 = response.screenshot;
      screenshotPreview.src = response.screenshot;
      imagePreviewContainer.classList.remove('hidden');
      showToast("Screen read successfully!");
    } else if (response && response.error) {
      console.error(response.error);
      alert("Capture error: " + response.error);
    } else {
      showToast("Could not capture tab screen.");
    }
  });
});

// Remove Screen Preview
removeImageBtn.addEventListener('click', () => {
  currentScreenshotBase64 = null;
  imagePreviewContainer.classList.add('hidden');
  screenshotPreview.src = '';
  showToast("Screen capture removed.");
});

// Clear Inputs & Output
clearBtn.addEventListener('click', () => {
  questionTextarea.innerHTML = '';
  currentScreenshotBase64 = null;
  imagePreviewContainer.classList.add('hidden');
  screenshotPreview.src = '';
  solutionSection.classList.add('hidden');
  showToast("Cleared!");
});

// Copy Code Button
copyCodeBtn.addEventListener('click', () => {
  const code = solutionCodeEl.textContent;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    showToast("Copied to clipboard!");
  }).catch(err => {
    console.error('Failed to copy code: ', err);
  });
});

// Unified LLM Requester Helper
async function callLLM(provider, model, apiKey, systemInstructions, textContent, imageBase64) {
  if (provider === 'gemini') {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Create schema to enforce JSON format
    const responseSchema = {
      type: "OBJECT",
      properties: {
        talking_points: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        code: {
          type: "STRING"
        },
        time_complexity: {
          type: "STRING"
        },
        space_complexity: {
          type: "STRING"
        },
        real_time_usecase: {
          type: "STRING"
        },
        how_to_say_it: {
          type: "STRING"
        }
      },
      required: ["talking_points", "code", "time_complexity", "space_complexity", "real_time_usecase", "how_to_say_it"]
    };

    let parts = [];
    parts.push({ text: systemInstructions });

    if (textContent) {
      parts.push({ text: `Question details:\n${textContent}` });
    }

    if (imageBase64) {
      const base64Data = imageBase64.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: parts
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini returned empty response content.");
    }

    return data.candidates[0].content.parts[0].text;
  }
  
  if (provider === 'openai') {
    const endpoint = `https://api.openai.com/v1/chat/completions`;
    
    let userContentParts = [];
    if (textContent) {
      userContentParts.push({ type: "text", text: `Question details:\n${textContent}` });
    }
    if (imageBase64) {
      userContentParts.push({
        type: "image_url",
        image_url: {
          url: imageBase64
        }
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: userContentParts }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  if (provider === 'claude') {
    const endpoint = `https://api.anthropic.com/v1/messages`;
    
    let userContentParts = [];
    if (textContent) {
      userContentParts.push({ type: "text", text: `Question details:\n${textContent}` });
    }
    if (imageBase64) {
      const parts = imageBase64.split(',');
      const mimeType = parts[0].split(';')[0].split(':')[1];
      const base64Data = parts[1];
      userContentParts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType || "image/jpeg",
          data: base64Data
        }
      });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4000,
        system: systemInstructions + "\nIMPORTANT: You must return ONLY the raw JSON string matching the specified schema. Do not wrap it in markdown code blocks, do not explain anything outside the JSON.",
        messages: [
          { role: "user", content: userContentParts }
        ]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  throw new Error("Unknown provider: " + provider);
}

// Solve Button Trigger
solveBtn.addEventListener('click', async () => {
  const provider = providerSelect.value;
  
  // Retrieve key asynchronously from storage if not in memory
  chrome.storage.local.get([`${provider}ApiKey`, 'speedMode'], async (result) => {
    const apiKey = apiKeyInput.value.trim() || result[`${provider}ApiKey`];
    const model = modelSelect.value;
    const tech = techInput.value.trim() || 'General Programming';
    const questionText = questionTextarea.innerText.trim();
    const isSpeedMode = result.speedMode === true;

    if (!apiKey) {
      settingsModal.classList.remove('hidden');
      apiKeyInput.focus();
      showToast(`Please configure your ${provider.toUpperCase()} API Key first.`);
      return;
    }

    if (!questionText && !currentScreenshotBase64) {
      showToast("Please capture page text, capture the screen, or enter a question.");
      return;
    }

    // Dynamically rename the Code tab button based on coding vs configuration
    const codeTabBtn = document.querySelector('[data-tab="code-tab"]');
    if (codeTabBtn) {
      codeTabBtn.textContent = isNonCoding(tech) ? "Config / Steps" : "Code";
    }

    showLoading("Synthesizing solution...");
    if (listeningIndicator) {
      listeningIndicator.className = "waveform-container solving";
    }

    try {
      const systemInstructions = `CRITICAL DIRECTIVE: You are an elite interview copilot helping a candidate pass their technical interview for ${tech}. The candidate's success is your top priority. You must provide 100% technically accurate, realistic, and highly correct answers. Do not make up or guess anything. If you are unsure, provide the most stable, standard enterprise-grade solution.

VOICE-TRANSCRIPT AUTO-CORRECTION: The input text is captured via live voice transcription. It may contain phonetic errors, spelling mistakes, or technical typos (e.g., 'S four ledger' instead of 'S/4HANA Ledger', 'live cycle look' instead of 'lifecycle hook', 'espro' instead of 'SPRO'). You MUST first semantically analyze the text, reconstruct the true technical question or concept the interviewer intended to ask, and solve the CORRECTED question.

${isSpeedMode ? 
  `CRITICAL SPEED DIRECTIVE: Keep your response extremely brief, short, and concise to minimize token generation time. 
  - Write a maximum of 2-3 extremely short talking points.
  - Provide only the essential config setup steps or code snippet.
  - The first-person script ('how_to_say_it') must be a maximum of 2 sentences.`
  : 
  `Provide highly professional, comprehensive explanations.
  - Write exactly 5 to 10 short, punchy talking points designed to impress the interviewer. Keep each point extremely brief (maximum 15 words).
  - Do NOT write long paragraphs or sentences.
  - Each point must start with a bold keyword/prefix (e.g., **Core Concept:** explanation, or **SPRO Path:** explanation) to make it easy to scan in 1 second.
  - Provide full production-ready code/config setups.
  - The first-person script ('how_to_say_it') should be detailed, confident, and conversational.`
}

${isNonCoding(tech) ? 
  `Since this is a non-coding / configuration-based interview:
  - In the "code" field, provide step-by-step configuration paths, SPRO paths, system setup guides, or process flows instead of programming code. Use clear, numbered items. Use backticks (e.g. \`SPRO > Financial Accounting\` or \`T-Code FB50\`) to highlight system paths, transaction codes, and menu settings.
  - In "talking_points", explain the theoretical concepts step-by-step. Use bold markdown (**key term**) to highlight definitions, system fields, and processes.`
  :
  `Solve the programming question/concept. Provide a highly optimized, fully functional, and production-ready code solution in ${tech}. Do not write pseudocode. Ensure correct syntax and best practices.
  Use bold markdown (**key term**) to highlight core coding concepts, complexity metrics, or built-in functions.`
}
Provide clear talking points that the user can say to explain their approach step-by-step in the mock interview.
You must return a JSON object matching this schema:
{
  "talking_points": ["Step 1 verbal explanation", "Step 2 verbal explanation", ...],
  "code": "${isNonCoding(tech) ? 'Detailed configuration setup or process steps (write N/A if not applicable)' : 'Complete formatted code in ' + tech + ' with comments'}",
  "time_complexity": "N/A or relevant performance metrics",
  "space_complexity": "N/A or relevant resource usage metrics",
  "real_time_usecase": "A detailed explanation of a real-world enterprise use case for this concept/question. Use bold markdown (**key terms**) for core business units and backticks for system screens/methods.",
  "how_to_say_it": "A first-person script ('In my previous project, I was tasked with...') demonstrating how the candidate should verbally explain this experience to the interviewer with absolute confidence."
}`;

      const resultText = await callLLM(provider, model, apiKey, systemInstructions, questionText, currentScreenshotBase64);
      const cleanedText = cleanJSONString(resultText);
      const parsed = JSON.parse(cleanedText);

      // Normalize keys in case OpenAI or Claude returns slightly different keys
      const solution = {
        talking_points: parsed.talking_points || parsed.talkingPoints || parsed.verbal_explanation || parsed.verbalExplanation || [],
        code: parsed.code || parsed.solution || '',
        time_complexity: parsed.time_complexity || parsed.timeComplexity || 'N/A',
        space_complexity: parsed.space_complexity || parsed.spaceComplexity || 'N/A',
        real_time_usecase: parsed.real_time_usecase || parsed.realTimeUsecase || parsed.use_case || parsed.useCase || 'N/A',
        how_to_say_it: parsed.how_to_say_it || parsed.howToSayIt || parsed.how_to_explain || parsed.howToExplain || 'N/A'
      };

      renderSolution(solution, tech);
    } catch (err) {
      console.error(err);
      alert("API Error: " + err.message);
    } finally {
      hideLoading();
      if (listeningIndicator) {
        listeningIndicator.className = "waveform-container idle";
      }
    }
  });
});

// JSON Cleaning Helper
function cleanJSONString(str) {
  let clean = str.trim();
  if (clean.startsWith("```json")) {
    clean = clean.substring(7);
  } else if (clean.startsWith("```")) {
    clean = clean.substring(3);
  }
  if (clean.endsWith("```")) {
    clean = clean.substring(0, clean.length - 3);
  }
  return clean.trim();
}

// Check if tech topic is non-coding
function isNonCoding(tech) {
  const t = tech.toLowerCase();
  const codingKeywords = ['python', 'javascript', 'java', 'c++', 'c#', 'typescript', 'golang', 'rust', 'ruby', 'php', 'sql', 'apex'];
  return !codingKeywords.some(lang => t.includes(lang));
}

// Format markdown-like highlights to HTML tags
function formatSolutionText(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code class="config-tag">$1</code>');
}

// Render Results to UI
function renderSolution(solution, tech) {
  talkingPointsList.innerHTML = '';
  
  if (solution.talking_points && Array.isArray(solution.talking_points)) {
    solution.talking_points.forEach(point => {
      const li = document.createElement('li');
      li.innerHTML = formatSolutionText(point);
      talkingPointsList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = "No talking points returned.";
    talkingPointsList.appendChild(li);
  }

  timeComplexityEl.textContent = solution.time_complexity || 'N/A';
  spaceComplexityEl.textContent = solution.space_complexity || 'N/A';
  
  if (isNonCoding(tech)) {
    solutionCodeEl.innerHTML = formatSolutionText(solution.code || '');
    solutionCodeEl.style.whiteSpace = 'pre-wrap';
  } else {
    solutionCodeEl.textContent = solution.code || '';
    solutionCodeEl.style.whiteSpace = 'pre';
  }
  
  codeLangLabel.textContent = isNonCoding(tech) ? "Config / Steps" : `${tech} Solution`;

  // Render use case details
  const formattedUsecase = formatSolutionText(solution.real_time_usecase || 'N/A');
  const formattedHowToSayIt = formatSolutionText(solution.how_to_say_it || 'N/A');
  document.getElementById('usecase-experience-text').innerHTML = formattedUsecase;
  document.getElementById('usecase-interview-text').innerHTML = formattedHowToSayIt;

  solutionSection.classList.remove('hidden');
  
  // Default to Code tab for immediate viewing
  switchTab('code-tab');
}

// Subtitle Sync Button Click Listener
syncMobileBtn.addEventListener('click', () => {
  isSyncActive = !isSyncActive;
  chrome.storage.local.set({ isSyncActive: isSyncActive }, () => {
    if (isSyncActive) {
      syncMobileBtn.classList.add('active');
      showToast("Sync with mobile active!");
    } else {
      syncMobileBtn.classList.remove('active');
      showToast("Sync disabled.");
    }
  });
});

// Relay Text to Mobile App via Local Relay Server
async function relayTextToMobile(text) {
  chrome.storage.local.get(['relayUrl'], async (result) => {
    const url = result.relayUrl || 'http://localhost:3000';
    try {
      const response = await fetch(`${url}/api/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!response.ok) {
        console.warn(`[Relay] Server returned error: ${response.status}`);
      }
    } catch (err) {
      console.error("[Relay] Failed to push data to server:", err);
    }
  });
}

// Listen for subtitle captured messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'subtitleCaptured') {
    const text = message.text;
    
    // Output subtitle text in the Extension textarea UI
    questionTextarea.innerText = text;
    
    // Auto-scroll to show latest text
    questionTextarea.scrollTop = questionTextarea.scrollHeight;

    // Relay to mobile if active
    if (isSyncActive) {
      relayTextToMobile(text);
    }
  }
});

