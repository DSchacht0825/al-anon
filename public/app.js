// Global state
let currentUser = null;
let authToken = null;
let currentStep = null;
let currentStepEntries = [];
let editingEntryId = null;

// Al-Anon 12 Steps
const ALANON_STEPS = [
    {
        number: 1,
        text: "We admitted we were powerless over alcohol—that our lives had become unmanageable.",
        description: "The first step is about admitting our powerlessness over alcohol and alcoholism, and acknowledging that our lives have become unmanageable as a result."
    },
    {
        number: 2,
        text: "Came to believe that a Power greater than ourselves could restore us to sanity.",
        description: "This step involves coming to believe in a Higher Power that can help restore balance and sanity to our lives."
    },
    {
        number: 3,
        text: "Made a decision to turn our will and our lives over to the care of God as we understood Him.",
        description: "Step 3 is about making the conscious decision to surrender our will and lives to our Higher Power's care."
    },
    {
        number: 4,
        text: "Made a searching and fearless moral inventory of ourselves.",
        description: "This step involves taking an honest, thorough look at our character defects, resentments, and behaviors."
    },
    {
        number: 5,
        text: "Admitted to God, to ourselves, and to another human being the exact nature of our wrongs.",
        description: "Step 5 is about sharing our moral inventory with our Higher Power, ourselves, and another trusted person."
    },
    {
        number: 6,
        text: "Were entirely ready to have God remove all these defects of character.",
        description: "This step involves becoming willing to let go of our character defects and allow our Higher Power to remove them."
    },
    {
        number: 7,
        text: "Humbly asked Him to remove our shortcomings.",
        description: "Step 7 is about humbly asking our Higher Power to remove our shortcomings and character defects."
    },
    {
        number: 8,
        text: "Made a list of all persons we had harmed, and became willing to make amends to them all.",
        description: "This step involves identifying all the people we have harmed and becoming willing to make amends to them."
    },
    {
        number: 9,
        text: "Made direct amends to such people wherever possible, except when to do so would injure them or others.",
        description: "Step 9 is about actually making amends to those we have harmed, unless doing so would cause more harm."
    },
    {
        number: 10,
        text: "Continued to take personal inventory and when we were wrong promptly admitted it.",
        description: "This step involves continuing to monitor our behavior and promptly admitting when we are wrong."
    },
    {
        number: 11,
        text: "Sought through prayer and meditation to improve our conscious contact with God as we understood Him, praying only for knowledge of His will for us and the power to carry that out.",
        description: "Step 11 is about developing our spiritual life through prayer and meditation, seeking to know and follow our Higher Power's will."
    },
    {
        number: 12,
        text: "Having had a spiritual awakening as the result of these steps, we tried to carry this message to others, and to practice these principles in all our affairs.",
        description: "The final step involves sharing our spiritual awakening with others and applying the principles of the program to all areas of our lives."
    }
];

// Utility functions
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function showError(message, elementId = 'auth-error') {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, 5000);
}

function showSuccess(message, elementId) {
    const successElement = document.getElementById(elementId);
    successElement.textContent = message;
    successElement.classList.remove('hidden');
    setTimeout(() => {
        successElement.classList.add('hidden');
    }, 3000);
}

function formatDate(date) {
    // Handle the date string properly to avoid timezone issues
    // Split the date and create a date object in local timezone
    const [year, month, day] = date.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// API functions
async function apiCall(endpoint, options = {}) {
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        ...options
    };

    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(`/api${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Authentication functions
function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelector('.tab-btn').classList.add('active');
    document.querySelectorAll('.tab-btn')[1].classList.remove('active');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.querySelector('.tab-btn').classList.remove('active');
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
}

async function login(email, password) {
    try {
        const response = await apiCall('/login', {
            method: 'POST',
            body: { email, password }
        });

        authToken = response.token;
        currentUser = { id: response.userId, firstName: response.firstName, email };
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        showMainApp();
    } catch (error) {
        showError(error.message);
    }
}

async function register(firstName, email, password) {
    try {
        const response = await apiCall('/register', {
            method: 'POST',
            body: { firstName, email, password }
        });

        authToken = response.token;
        currentUser = { id: response.userId, firstName, email };
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        showMainApp();
    } catch (error) {
        showError(error.message);
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    showScreen('auth-screen');
}

// Main app functions
function showMainApp() {
    showScreen('main-app');
    document.getElementById('user-greeting').textContent =
        `Welcome back, ${currentUser.firstName || 'Friend'}!`;

    loadDailyReading();
    loadJournalEntry();
    loadStepProgress();
    showTab('daily');
}

function showTab(tabName, event = null) {
    // Update tab buttons
    document.querySelectorAll('.main-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Find and activate the correct tab
    const activeTab = event ? event.target : document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');

    // Load tab-specific data
    if (tabName === 'journal') {
        loadJournalEntry();
    } else if (tabName === 'steps') {
        loadStepProgress();
    }
}

// Daily reading functions
async function loadDailyReading() {
    try {
        const reading = await apiCall('/daily-reading');

        document.getElementById('reading-title').textContent = reading.title;
        document.getElementById('reading-date').textContent = formatDate(reading.date);
        document.getElementById('reading-book').textContent = reading.book;
        document.getElementById('reading-text').textContent = reading.content;
    } catch (error) {
        console.error('Error loading daily reading:', error);
        document.getElementById('reading-text').textContent =
            'Unable to load today\'s reading. Please try again later.';
    }
}

// Journal functions
async function loadJournalEntry() {
    try {
        const entry = await apiCall('/journal/today');
        const today = new Date();

        document.getElementById('journal-date').textContent = formatDate(today);
        document.getElementById('morning-intention').value = entry.morning_intention || '';
        document.getElementById('evening-reflection').value = entry.evening_reflection || '';
        document.getElementById('gratitude').value = entry.gratitude || '';
    } catch (error) {
        console.error('Error loading journal entry:', error);
    }
}

// Journal History functions
async function showJournalHistory() {
    try {
        const entries = await apiCall('/journal/history');
        renderJournalHistory(entries);
        document.getElementById('journal-history-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error loading journal history:', error);
        showError('Failed to load journal history. Please try again.');
    }
}

function renderJournalHistory(entries) {
    const container = document.getElementById('journal-history-list');

    if (entries.length === 0) {
        container.innerHTML = '<p class="no-entries">No previous journal entries found.</p>';
        return;
    }

    container.innerHTML = entries.map(entry => `
        <div class="journal-history-entry">
            <div class="journal-history-date">${formatDate(entry.date)}</div>
            <div class="journal-history-content">
                ${entry.morning_intention ? `
                    <div class="journal-history-section">
                        <h5>🌅 Morning Intention</h5>
                        <p>${entry.morning_intention}</p>
                    </div>
                ` : ''}
                ${entry.evening_reflection ? `
                    <div class="journal-history-section">
                        <h5>🌙 Evening Reflection</h5>
                        <p>${entry.evening_reflection}</p>
                    </div>
                ` : ''}
                ${entry.gratitude ? `
                    <div class="journal-history-section">
                        <h5>🙏 Gratitude</h5>
                        <p>${entry.gratitude}</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function closeJournalHistory() {
    document.getElementById('journal-history-modal').classList.add('hidden');
}

async function saveJournal() {
    try {
        const journalData = {
            morningIntention: document.getElementById('morning-intention').value,
            eveningReflection: document.getElementById('evening-reflection').value,
            gratitude: document.getElementById('gratitude').value
        };

        await apiCall('/journal', {
            method: 'POST',
            body: journalData
        });

        showSuccess('Journal entry saved successfully!', 'journal-message');
    } catch (error) {
        console.error('Error saving journal:', error);
        showError('Failed to save journal entry. Please try again.');
    }
}

// Steps functions
async function loadStepProgress() {
    try {
        const progress = await apiCall('/steps');
        const progressMap = {};

        progress.forEach(step => {
            progressMap[step.step_number] = step;
        });

        const stepsContainer = document.getElementById('steps-list');
        stepsContainer.innerHTML = '';

        ALANON_STEPS.forEach(step => {
            const userProgress = progressMap[step.number];
            const isCompleted = userProgress && userProgress.completed;

            const stepElement = document.createElement('div');
            stepElement.className = `step-item ${isCompleted ? 'completed' : ''}`;
            stepElement.onclick = () => openStepModal(step, userProgress);

            stepElement.innerHTML = `
                <div class="step-status">
                    ${isCompleted ? '✓' : step.number}
                </div>
                <div class="step-number">Step ${step.number}</div>
                <div class="step-text">${step.text}</div>
            `;

            stepsContainer.appendChild(stepElement);
        });
    } catch (error) {
        console.error('Error loading step progress:', error);
    }
}

async function openStepModal(step, userProgress) {
    currentStep = step;

    document.getElementById('modal-step-title').textContent = `Step ${step.number}`;
    document.getElementById('modal-step-text').innerHTML = `
        <strong>"${step.text}"</strong><br><br>
        ${step.description}
    `;

    document.getElementById('step-notes').value = userProgress?.notes || '';
    document.getElementById('step-completed').checked = userProgress?.completed || false;

    // Load step work entries
    await loadStepEntries(step.number);

    document.getElementById('step-modal').classList.remove('hidden');
}

function closeStepModal() {
    document.getElementById('step-modal').classList.add('hidden');
    currentStep = null;
    currentStepEntries = [];
    editingEntryId = null;
    document.getElementById('new-step-entry').value = '';
}

async function saveStepProgress() {
    if (!currentStep) return;

    try {
        const stepData = {
            completed: document.getElementById('step-completed').checked,
            notes: document.getElementById('step-notes').value
        };

        await apiCall(`/steps/${currentStep.number}`, {
            method: 'POST',
            body: stepData
        });

        closeStepModal();
        loadStepProgress();
        showSuccess('Step progress saved successfully!', 'journal-message');
    } catch (error) {
        console.error('Error saving step progress:', error);
        showError('Failed to save step progress. Please try again.');
    }
}

// Load step work entries
async function loadStepEntries(stepNumber) {
    try {
        const entries = await apiCall(`/steps/${stepNumber}/entries`);
        currentStepEntries = entries;
        renderStepEntries();
    } catch (error) {
        console.error('Error loading step entries:', error);
        currentStepEntries = [];
        renderStepEntries();
    }
}

// Render step work entries
function renderStepEntries() {
    const container = document.getElementById('step-entries-list');
    if (!container) return;

    if (currentStepEntries.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">No entries yet. Add your first reflection below.</p>';
        return;
    }

    container.innerHTML = currentStepEntries.map(entry => `
        <div class="step-entry" data-entry-id="${entry.id}">
            <div class="step-entry-date">${formatDate(entry.work_date)}</div>
            <div class="step-entry-text">${entry.entry_text}</div>
            <div class="step-entry-actions">
                <button type="button" onclick="editStepEntry(${entry.id})" class="edit-btn">Edit</button>
                <button type="button" onclick="deleteStepEntry(${entry.id})" class="delete-btn">Delete</button>
            </div>
        </div>
    `).join('');
}

// Add new step work entry
async function addStepEntry() {
    const entryText = document.getElementById('new-step-entry').value.trim();
    if (!entryText || !currentStep) return;

    try {
        if (editingEntryId) {
            // Update existing entry
            await apiCall(`/steps/${currentStep.number}/entries/${editingEntryId}`, {
                method: 'PUT',
                body: { entryText }
            });
            editingEntryId = null;
            document.getElementById('add-entry-btn').textContent = 'Add Entry';
        } else {
            // Add new entry
            await apiCall(`/steps/${currentStep.number}/entries`, {
                method: 'POST',
                body: { entryText }
            });
        }

        document.getElementById('new-step-entry').value = '';
        await loadStepEntries(currentStep.number);
        showSuccess('Entry saved successfully!', 'journal-message');
    } catch (error) {
        console.error('Error saving step entry:', error);
        showError('Failed to save entry. Please try again.');
    }
}

// Edit step work entry
function editStepEntry(entryId) {
    const entry = currentStepEntries.find(e => e.id === entryId);
    if (!entry) return;

    document.getElementById('new-step-entry').value = entry.entry_text;
    editingEntryId = entryId;
    document.getElementById('add-entry-btn').textContent = 'Update Entry';
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
    document.getElementById('new-step-entry').focus();
}

// Delete step work entry
async function deleteStepEntry(entryId) {
    if (!confirm('Are you sure you want to delete this entry?')) return;

    try {
        await apiCall(`/steps/${currentStep.number}/entries/${entryId}`, {
            method: 'DELETE'
        });

        await loadStepEntries(currentStep.number);
        showSuccess('Entry deleted successfully!', 'journal-message');
    } catch (error) {
        console.error('Error deleting step entry:', error);
        showError('Failed to delete entry. Please try again.');
    }
}

// Cancel editing
function cancelEdit() {
    editingEntryId = null;
    document.getElementById('new-step-entry').value = '';
    document.getElementById('add-entry-btn').textContent = 'Add Entry';
    document.getElementById('cancel-edit-btn').style.display = 'none';
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check for existing auth
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (savedToken && savedUser) {
        authToken = savedToken;
        currentUser = JSON.parse(savedUser);
        showMainApp();
    } else {
        showScreen('auth-screen');
    }

    // Auth form handlers
    document.getElementById('login-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        login(email, password);
    });

    document.getElementById('register-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const firstName = document.getElementById('register-first-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        register(firstName, email, password);
    });

    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
    }, 1000);
});

// Handle clicks outside modals
document.getElementById('step-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeStepModal();
    }
});

document.getElementById('journal-history-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeJournalHistory();
    }
});

// Auto-save journal entries
let journalTimeout;
['morning-intention', 'evening-reflection', 'gratitude'].forEach(id => {
    document.addEventListener('DOMContentLoaded', function() {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', function() {
                clearTimeout(journalTimeout);
                journalTimeout = setTimeout(saveJournal, 2000); // Auto-save after 2 seconds of no typing
            });
        }
    });
});