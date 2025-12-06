let workDomains = [];

async function load() {
  const data = await chrome.storage.local.get('workDomains');
  workDomains = data.workDomains || [];
}

async function save() {
  try {
    await PopupUtils.setStorage({ workDomains: workDomains });
    return true;
  } catch (error) {
    PopupUtils.logError('Failed to save work domains:', error);
    throw error;
  }
}

export async function add(domain) {
  if (!workDomains.includes(domain)) {
    workDomains.push(domain);
    await save();
  }
}

async function remove(domain) {
  workDomains = workDomains.filter(d => d !== domain);
  await save();
}

async function clearAll() {
  workDomains = [];
  await save();
}

function validateDomainInput() {
  const input = document.getElementById('domainInput');
  const validation = document.getElementById('domainValidation');
  
  if (!input || !validation) return;

  const domain = input.value.trim().toLowerCase();
  
  if (!domain) {
    validation.textContent = '';
    validation.className = 'domain-validation';
    return;
  }

  if (PopupUtils.isValidDomain(domain)) {
    if (workDomains.includes(domain)) {
      validation.textContent = 'Domain already exists';
      validation.className = 'domain-validation invalid';
    } else {
      validation.textContent = 'Valid domain';
      validation.className = 'domain-validation valid';
    }
  } else {
    validation.textContent = 'Invalid domain format';
    validation.className = 'domain-validation invalid';
  }
}

async function addDomain(url) {
  const domain = PopupUtils.extractDomain(url);
  console.log(`Adding domain: ${domain}`);
  if (!domain) {
    PopupUtils.showError('Please enter a domain');
    return;
  }

  if (!PopupUtils.isValidDomain(domain)) {
    console.log('Please enter a valid domain format')
    PopupUtils.showError('Please enter a valid domain format');
    return;
  }

  if (workDomains.includes(domain)) {
    PopupUtils.showWarning('Domain already exists in work domains');
    return;
  }

  try {
    workDomains.push(domain);
    await save();
    
    // Notify background script
    await PopupUtils.sendMessage({
      type: 'DOMAIN_ADDED',
      domain: domain
    });

    
    PopupUtils.showSuccess(`Added "${domain}" to work domains`);
    // updateUI();
  } catch (error) {
    console.log(`'Failed to add domain: ${error}`)
    PopupUtils.logError('Failed to add domain:', error);
    PopupUtils.showError('Failed to add domain. Please try again.');
  }
}

async function addManualDomain() {
  console.log("Adding domain manually.")
  const input = document.getElementById('domainInput');
  if (!input) return;

  const url = input.value.trim().toLowerCase();
  
  await addDomain(url);

  input.value = '';
  validateDomainInput();
}

async function initUI() {
  await load();
  updateWorkDomains();
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById('workDomains').addEventListener('click', async (event) => {
    const btn = event.target.closest('.domain-remove');
    if (!btn) return;

    const item = btn.closest('.domain-item');
    const domain = item.dataset.domain;
    if (confirm(`Remove "${domain}"?`)) {
      await remove(domain);
      updateWorkDomains();
    }
  });

  document.getElementById('addCurrentDomain').addEventListener('click', async () => {
    const url = await getCurrentTabUrl();
    addDomain(url);
    updateWorkDomains();
  });

  document.getElementById('clearAll').addEventListener('click', async () => {
    clearAll();
    updateWorkDomains();
  });

  // Manual domain input
  const domainInput = document.getElementById('domainInput');
  const addBtn = document.getElementById('addDomain');
  
  if (domainInput && addBtn) {
    addBtn.addEventListener('click', () => {
      addManualDomain();
      updateWorkDomains();
    });
    domainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addManualDomain();
      }
    });
    
    // Real-time validation
    domainInput.addEventListener('input', () => validateDomainInput());
  }
}

function updateDomainsList() {
  const domainsList = document.getElementById('workDomains');
  if (!domainsList) return;

  if (workDomains.length === 0) {
    console.log(workDomains.length);
    domainsList.innerHTML = `
      <div class="empty-domains">
        <span class="empty-domains-icon">🌐</span>
        No work domains added yet. Add your work websites to get started!
      </div>
    `;
    return;
  }

  const domainsHTML = workDomains.map((domain, index) => `
    <div class="domain-item" data-domain="${domain}">
      <span class="domain-name">${domain}</span>
      <div class="domain-actions">
        <button class="domain-remove" title="Remove domain">
          🗑️
        </button>
      </div>
    </div>
  `).join('');

  domainsList.innerHTML = domainsHTML;
}

async function getCurrentTabUrl() {
  // Query the active tab in the current window
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log("Current tab URL:", tab.url);
  return tab.url;
}

async function updateCurrentTabDisplay() {
  const tabDisplay = document.getElementById('currentTab');
  if (!tabDisplay || !currentTab) return;

  const domain = PopupUtils.extractDomain(await getCurrentTabUrl());
  const isWorkDomain = domain && workDomains.includes(domain);
  
  tabDisplay.innerHTML = `
    <div class="tab-info">
      <div class="tab-domain">${domain || 'No domain'}</div>
      <div class="tab-status">
        <span class="status-indicator ${isWorkDomain ? 'work' : 'non-work'}"></span>
        ${isWorkDomain ? 'Work Domain' : 'Non-Work Domain'}
      </div>
    </div>
  `;

  // Update add current domain button
  const addCurrentBtn = document.getElementById('addCurrentDomain');
  if (addCurrentBtn) {
    if (domain && !workDomains.includes(domain)) {
      addCurrentBtn.disabled = false;
      addCurrentBtn.textContent = `Add "${domain}" as Work`;
    } else if (domain && workDomains.includes(domain)) {
      addCurrentBtn.disabled = true;
      addCurrentBtn.textContent = `"${domain}" Already Added`;
    } else {
      addCurrentBtn.disabled = true;
      addCurrentBtn.textContent = 'No Valid Domain';
    }
  }
}

function updateWorkDomains() {
  updateDomainsList();
  const container = document.getElementById('workDomains');
  console.log(workDomains);
  if (workDomains.length !== 0) {
    workDomains.forEach(domain => {
      const div = document.createElement('div');
      div.className = 'domain-item';
      div.dataset.domain = domain;
      div.innerHTML = `<span>${domain}</span><button class="domain-remove">🗑️</button>`;
      container.appendChild(div);
    });
  }
  updateCurrentTabDisplay() // is this needed or is it just required to check that the new domain is not currently active? is that even something this should be doing? ATOMICITY
}

initUI();
setupEventListeners();