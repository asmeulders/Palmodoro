chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // =========================================================================
  // TODO:
  // Move domain checking logic here
  // =========================================================================
    if (message.action === 'showDistractionAlert') {
        showDistractionAlert(message.domain);
        sendResponse({ success: true });
    }
    return true; // Keeps message channel open
});

async function showDistractionAlert(domain) {
    console.log('showDistractionAlert called for domain:', domain);
    try {
        // Check if overlay already exists
        if (document.getElementById('study-focus-overlay')) {
            console.log('Overlay already exists, skipping');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'study-focus-overlay';
        overlay.innerHTML = `
            <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            z-index: 999999;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'RainyHearts', Arial, sans-serif;
            ">
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
                <h2 style="color: #333; margin-bottom: 15px;">⚠️ Distraction Alert</h2>
                <p style="color: #666; margin-bottom: 20px;">
                You've switched to <strong>${domain}</strong><br>
                Is this a work-related site?
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                <button id="study-focus-yes" style="
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">Yes, it's work</button>
                <button id="study-focus-no" style="
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 16px;
                ">No, it's not</button>
                </div>
            </div>
            </div>
        `;

        console.log('Adding overlay to document body');
        document.body.appendChild(overlay);

        // Add event listeners
        const yesButton = document.getElementById('study-focus-yes');
        const noButton = document.getElementById('study-focus-no');

        if (yesButton) {
            yesButton.addEventListener('click', async () => {
                console.log('Yes button clicked for domain:', domain);
                await addWorkDomain(domain);
                overlay.remove();
            });
        }

        if (noButton) {
            noButton.addEventListener('click', () => {
                console.log('No button clicked');
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({
                    action: 'closeTab'
                    });
                }
                overlay.remove();
            });

        }
        console.log('Overlay setup complete');

    } catch(e) {
        
    }
    
}  

async function addWorkDomain(domain) {

    console.log("Adding a work domain:", domain)
    const data = await chrome.storage.local.get('workDomains');
    workDomains = data.workDomains || [];

    workDomains.push(domain);

    try {
        await chrome.storage.local.set({ workDomains: workDomains });
        console.log("Successfully added domain.");
        return true;
    } catch (error) {
        console.error('Error adding domain:', error);
        throw error;
    }
}