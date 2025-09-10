  
        // CORRECTED: Backend Integration Configuration (NO EXPOSED API KEYS)
        const BackendConfig = {
            // Backend service will proxy all notification requests
            NOTIFICATION_ENDPOINT: '/api/send-reminder',
            TEST_ENDPOINT: '/api/test-reminder'
        };

        // App State
        let trials = [];
        let notificationPermission = 'default';
        let deferredPrompt;

        // DOM Elements
        const elements = {
            trialsContainer: document.getElementById('trialsContainer'),
            emptyState: document.getElementById('emptyState'),
            addTrialBtn: document.getElementById('addTrialBtn'),
            addTrialModal: document.getElementById('addTrialModal'),
            trialForm: document.getElementById('trialForm'),
            closeModal: document.getElementById('closeModal'),
            cancelBtn: document.getElementById('cancelBtn'),
            privacyInfo: document.getElementById('privacyInfo'),
            privacyModal: document.getElementById('privacyModal'),
            closePrivacyModal: document.getElementById('closePrivacyModal'),
            closePrivacyBtn: document.getElementById('closePrivacyBtn'),
            testReminder: document.getElementById('testReminder'),
            toast: document.getElementById('toast'),
            toastContent: document.getElementById('toastContent'),
            installPrompt: document.getElementById('installPrompt'),
            installApp: document.getElementById('installApp'),
            dismissInstall: document.getElementById('dismissInstall'),
            pushNotificationInfo: document.getElementById('pushNotificationInfo')
        };
        // IndexedDB Setup for local storage
        let db;
        const dbName = 'FreeTrialGuardDB';
        const dbVersion = 1;

        function initDB() {
            const request = indexedDB.open(dbName, dbVersion);

            request.onerror = () => {
                console.error('Database error:', request.error);
                showToast('Database initialization failed', 'warning');
            };

            request.onsuccess = () => {
                db = request.result;
                loadTrials();
            };

            request.onupgradeneeded = (event) => {
                db = event.target.result;
                const objectStore = db.createObjectStore('trials', { keyPath: 'id' });
                objectStore.createIndex('endDate', 'endDate', { unique: false });
            };
        }

        // Data Management
        function saveTrials() {
            if (!db) return;

            const transaction = db.transaction(['trials'], 'readwrite');
            const objectStore = transaction.objectStore('trials');

            // Clear existing data
            objectStore.clear();

            // Add all current trials
            trials.forEach(trial => {
                objectStore.add(trial);
            });

            transaction.oncomplete = () => {
                console.log('Trials saved successfully');
            };

            transaction.onerror = () => {
                console.error('Error saving trials');
                showToast('Failed to save trials', 'warning');
            };
        }

        function loadTrials() {
            if (!db) return;

            const transaction = db.transaction(['trials'], 'readonly');
            const objectStore = transaction.objectStore('trials');
            const request = objectStore.getAll();

            request.onsuccess = () => {
                trials = request.result || [];
                renderTrials();
                scheduleAllReminders();
            };

            request.onerror = () => {
                console.error('Error loading trials');
                showToast('Failed to load trials', 'warning');
            };
        }

        // CORRECTED: Backend Notification Service (No API keys exposed)
        class NotificationService {
            static async requestPermission() {
                if ('Notification' in window) {
                    notificationPermission = await Notification.requestPermission();
                    return notificationPermission === 'granted';
                }
                return false;
            }

            static showPushNotification(title, body) {
                if (notificationPermission === 'granted') {
                    new Notification(title, {
                        body: body,
                        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAtTzgiIGZpbGw9IiMzNzQxNTEiPjxwYXRoIGQ9Im02NCA2IEwxMjIgNiBsMCAxMTYgMTIgMCBsMTIuLWExMi1MMzYuIDI0IDI0IDI0IGIgQXoxNCAyOC44MDQyOS4wODgxNiAyOC4wODI0MiA1NC4wNDA1MiA1NC4wNDAyNTcgOTAuOTQzODAgOTAuOTM1NzcgMTI0LjUzMTY2IDEyNC41MzE2NlJMMTIuLTdnZGhDZzA4Lzh6Y2E5MDMxIi8+PC9zdmc+',
                        badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAtTzgiIGZpbGw9IiMzNzQxNTEiPjxwYXRoIGQ9Im02NCA2IEwxMjIgNiBsMCAxMTYgMTIgMCBsMTIuLWExMi1MMzYuIDI0IDI0IDI0IGIgQXoxNCAyOC44MDQyOS4wODgxNiAyOC4wODI0MiA1NC4wNDA1MiA1NC4wNDAyNTcgOTAuOTQzODAgOTAuOTM1NzcgMTI0LjUzMTY2IDEyNC41MzE2NlJMMTIuLTdnZGhDZzA4Lzh6Y2E5MDMxIi8+PC9zdmc+',
                        requireInteraction: false,
                        silent: true
                    });
                }
            }

            // Backend-proxied email sending
            static async sendEmail(trial, daysLeft) {
                try {
                    const response = await fetch(BackendConfig.NOTIFICATION_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: 'email',
                            contact: trial.contact,
                            serviceName: trial.serviceName,
                            endDate: trial.endDate,
                            daysLeft: daysLeft
                        })
                    });

                    if (response.ok) {
                        showToast(`Gentle email reminder sent for ${trial.serviceName}`, 'success');
                    } else {
                        throw new Error('Email service unavailable');
                    }
                } catch (error) {
                    console.error('Email sending failed:', error);
                    showToast('Email reminder failed - showing browser notification instead', 'warning');
                    // Graceful fallback to browser notification
                    NotificationService.showPushNotification(
                        'Gentle Reminder from FreeTrialGuard',
                        `Your ${trial.serviceName} trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Take care! ð`
                    );
                }
            }

            // Backend-proxied SMS sending
            static async sendSMS(trial, daysLeft) {
                try {
                    const response = await fetch(BackendConfig.NOTIFICATION_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: 'sms',
                            contact: trial.contact,
                            serviceName: trial.serviceName,
                            endDate: trial.endDate,
                            daysLeft: daysLeft
                        })
                    });

                    if (response.ok) {
                        showToast(`Gentle SMS reminder sent for ${trial.serviceName}`, 'success');
                    } else {
                        throw new Error('SMS service unavailable');
                    }
                } catch (error) {
                    console.error('SMS sending failed:', error);
                    showToast('SMS reminder failed - showing browser notification instead', 'warning');
                    // Graceful fallback to browser notification
                    NotificationService.showPushNotification(
                        'Gentle Reminder from FreeTrialGuard',
                        `Your ${trial.serviceName} trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Take care! ð`
                    );
                }
            }
        }
        // CORRECTED: Radio Button Event Handler with Clean State Management
        function setupReminderMethodHandlers() {
            const radioButtons = document.querySelectorAll('input[name="reminderMethod"]');
            const emailField = document.getElementById('emailField');
            const smsField = document.getElementById('smsField');
            const pushInfo = document.getElementById('pushNotificationInfo');

            // Handle radio button changes with proper state cleanup
            radioButtons.forEach(radio => {
                radio.addEventListener('change', function() {
                    // Clear all previous input values when switching methods
                    document.getElementById('emailAddress').value = '';
                    document.getElementById('phoneNumber').value = '';

                    // Hide all contact fields initially
                    emailField.classList.add('hidden');
                    smsField.classList.add('hidden');
                    pushInfo.classList.add('hidden');

                    // Update visual radio button indicators
                    radioButtons.forEach(r => {
                        const dot = r.parentElement.querySelector('.w-2.h-2');
                        if (dot) {
                            dot.classList.toggle('hidden', !r.checked);
                        }
                    });

                    // Show appropriate field and messaging based on selection
                    if (this.value === 'email') {
                        emailField.classList.remove('hidden');
                        document.getElementById('emailAddress').focus();
                    } else if (this.value === 'sms') {
                        smsField.classList.remove('hidden');
                        document.getElementById('phoneNumber').focus();
                    } else if (this.value === 'push') {
                        pushInfo.classList.remove('hidden');
                    }
                });
            });

            // Initialize the default state (push notifications)
            pushInfo.classList.remove('hidden');
        }

        // Reminder scheduling and sending functions (unchanged core logic)
        function scheduleReminder(trial) {
            const endDate = new Date(trial.endDate);
            const now = new Date();
            const reminderDays = [7, 3, 1];

            reminderDays.forEach(days => {
                const reminderDate = new Date(endDate);
                reminderDate.setDate(reminderDate.getDate() - days);

                if (reminderDate > now) {
                    const timeout = reminderDate.getTime() - now.getTime();

                    setTimeout(() => {
                        sendReminder(trial, days);
                    }, timeout);
                }
            });
        }

        function scheduleAllReminders() {
            trials.forEach(trial => {
                if (trial.status !== 'expired') {
                    scheduleReminder(trial);
                }
            });
        }

        async function sendReminder(trial, daysLeft) {
            const title = 'Gentle Reminder from FreeTrialGuard';
            const body = `Your ${trial.serviceName} trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Take care! ð`;

            switch (trial.reminderMethod) {
                case 'push':
                    NotificationService.showPushNotification(title, body);
                    break;
                case 'email':
                    await NotificationService.sendEmail(trial, daysLeft);
                    break;
                case 'sms':
                    await NotificationService.sendSMS(trial, daysLeft);
                    break;
            }

            // Update trial status
            updateTrialStatus(trial.id, daysLeft);
        }

        function updateTrialStatus(trialId, daysLeft) {
            const trial = trials.find(t => t.id === trialId);
            if (trial) {
                if (daysLeft <= 0) {
                    trial.status = 'expired';
                } else if (daysLeft <= 1) {
                    trial.status = 'ending-soon';
                } else if (daysLeft <= 3) {
                    trial.status = 'reminder-sent';
                }
                saveTrials();
                renderTrials();
            }
        }

        // UI Functions
        function showToast(message, type = 'gentle') {
            elements.toastContent.textContent = message;
            elements.toast.className = `fixed top-20 left-4 right-4 z-40 rounded-xl p-4 text-center transition-all duration-300 notification-${type}`;
            elements.toast.classList.remove('hidden');

            setTimeout(() => {
                elements.toast.classList.add('hidden');
            }, 3000);
        }
        // Trial management functions
        function getTrialStatus(trial) {
            const endDate = new Date(trial.endDate);
            const now = new Date();
            const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

            if (daysLeft < 0) return { status: 'expired', text: 'Trial has ended', class: 'text-red-500', icon: 'fas fa-times-circle' };
            if (daysLeft === 0) return { status: 'ending-today', text: 'Ends today', class: 'text-orange-500', icon: 'fas fa-exclamation-circle' };
            if (daysLeft === 1) return { status: 'ending-soon', text: 'Ends tomorrow', class: 'text-yellow-500', icon: 'fas fa-clock' };
            if (daysLeft <= 3) return { status: 'reminder-sent', text: `${daysLeft} days left`, class: 'text-blue-500', icon: 'fas fa-bell' };
            if (daysLeft <= 7) return { status: 'upcoming', text: `${daysLeft} days left`, class: 'text-green-500', icon: 'fas fa-calendar-check' };
            return { status: 'safe', text: 'Safe for now', class: 'text-gray-500', icon: 'fas fa-leaf' };
        }

        function renderTrials() {
            if (trials.length === 0) {
                elements.trialsContainer.classList.add('hidden');
                elements.emptyState.classList.remove('hidden');
                return;
            }

            elements.emptyState.classList.add('hidden');
            elements.trialsContainer.classList.remove('hidden');

            // Sort trials by end date
            const sortedTrials = [...trials].sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

            elements.trialsContainer.innerHTML = sortedTrials.map(trial => {
                const status = getTrialStatus(trial);
                const endDate = new Date(trial.endDate);

                return `
                    <div class="bg-white rounded-xl p-6 gentle-shadow fade-in hover:shadow-lg transition-all duration-200">
                        <div class="flex items-start justify-between">
                            <div class="flex-1">
                                <div class="flex items-center space-x-3 mb-2">
                                    <h3 class="text-lg font-semibold text-gray-800">${trial.serviceName}</h3>
                                    <div class="flex items-center space-x-1 ${status.class}">
                                        <i class="${status.icon} text-sm"></i>
                                        <span class="text-sm font-medium">${status.text}</span>
                                    </div>
                                </div>

                                <div class="text-gray-600 mb-2">
                                    <i class="fas fa-calendar-alt mr-2"></i>
                                    Ends ${endDate.toLocaleDateString('en-US', { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                    })}
                                </div>

                                <div class="text-sm text-gray-500 mb-3">
                                    <i class="fas fa-${trial.reminderMethod === 'push' ? 'bell' : trial.reminderMethod === 'email' ? 'envelope' : 'sms'} mr-2"></i>
                                    ${trial.reminderMethod === 'push' ? 'Browser notifications' : trial.reminderMethod === 'email' ? 'Email reminders' : 'SMS reminders'}
                                    ${trial.contact && trial.reminderMethod !== 'push' ? ` to ${trial.contact}` : ''}
                                </div>

                                ${trial.notes ? `
                                    <div class="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
                                        <i class="fas fa-sticky-note mr-2"></i>
                                        ${trial.notes}
                                    </div>
                                ` : ''}
                            </div>

                            <div class="flex items-center space-x-2 ml-4">
                                <button onclick="editTrial('${trial.id}')" class="p-2 text-gray-400 hover:text-blue-500 transition-colors" title="Edit trial">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteTrial('${trial.id}')" class="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete trial">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function addTrial(trialData) {
            const trial = {
                id: Date.now().toString(),
                ...trialData,
                createdAt: new Date().toISOString(),
                status: 'active'
            };

            trials.push(trial);
            saveTrials();
            renderTrials();
            scheduleReminder(trial);

            showToast(`${trial.serviceName} trial added with gentle reminders scheduled`, 'success');
        }

        function deleteTrial(id) {
            if (confirm('Are you sure you want to remove this trial? This action cannot be undone.')) {
                trials = trials.filter(trial => trial.id !== id);
                saveTrials();
                renderTrials();
                showToast('Trial removed peacefully', 'gentle');
            }
        }

        function editTrial(id) {
            const trial = trials.find(t => t.id === id);
            if (trial) {
                // Populate form with existing data
                document.getElementById('serviceName').value = trial.serviceName;
                document.getElementById('endDate').value = trial.endDate;
                document.getElementById('notes').value = trial.notes || '';

                // Set the correct radio button
                const radioButton = document.querySelector(`input[name="reminderMethod"][value="${trial.reminderMethod}"]`);
                if (radioButton) {
                    radioButton.checked = true;
                    radioButton.dispatchEvent(new Event('change'));
                }

                if (trial.reminderMethod === 'email') {
                    document.getElementById('emailAddress').value = trial.contact || '';
                } else if (trial.reminderMethod === 'sms') {
                    document.getElementById('phoneNumber').value = trial.contact || '';
                }

                // Store the ID for updating
                elements.trialForm.dataset.editId = id;
                elements.addTrialModal.classList.remove('hidden');
            }
        }
        // Event Listeners Setup (NO EMOTIONAL MODE TOGGLE)
        function setupEventListeners() {
            // Modal controls
            [elements.addTrialBtn, elements.emptyState.querySelector('button')].forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', () => {
                        elements.addTrialModal.classList.remove('hidden');
                        document.getElementById('serviceName').focus();
                    });
                }
            });

            [elements.closeModal, elements.cancelBtn].forEach(btn => {
                btn.addEventListener('click', closeModal);
            });

            // Privacy modal
            elements.privacyInfo.addEventListener('click', () => {
                elements.privacyModal.classList.remove('hidden');
            });

            [elements.closePrivacyModal, elements.closePrivacyBtn].forEach(btn => {
                btn.addEventListener('click', () => {
                    elements.privacyModal.classList.add('hidden');
                });
            });

            // CORRECTED: Form handling with proper radio button validation
            elements.trialForm.addEventListener('submit', (e) => {
                e.preventDefault();

                const trialData = {
                    serviceName: document.getElementById('serviceName').value.trim(),
                    endDate: document.getElementById('endDate').value,
                    reminderMethod: document.querySelector('input[name="reminderMethod"]:checked').value,
                    notes: document.getElementById('notes').value.trim()
                };

                // Add contact info based on selected method
                if (trialData.reminderMethod === 'email') {
                    trialData.contact = document.getElementById('emailAddress').value.trim();
                } else if (trialData.reminderMethod === 'sms') {
                    trialData.contact = document.getElementById('phoneNumber').value.trim();
                }

                // Enhanced validation with clear messaging
                if (!trialData.serviceName || !trialData.endDate) {
                    showToast('Please fill in the service name and end date', 'warning');
                    return;
                }

                if ((trialData.reminderMethod === 'email' && !trialData.contact) || 
                    (trialData.reminderMethod === 'sms' && !trialData.contact)) {
                    const method = trialData.reminderMethod === 'email' ? 'email address' : 'phone number';
                    showToast(`Please provide your ${method} for ${trialData.reminderMethod.toUpperCase()} reminders`, 'warning');
                    return;
                }

                const editId = elements.trialForm.dataset.editId;
                if (editId) {
                    // Update existing trial
                    const trialIndex = trials.findIndex(t => t.id === editId);
                    if (trialIndex !== -1) {
                        trials[trialIndex] = { ...trials[trialIndex], ...trialData };
                        saveTrials();
                        renderTrials();
                        showToast(`${trialData.serviceName} trial updated`, 'success');
                    }
                    delete elements.trialForm.dataset.editId;
                } else {
                    // Add new trial
                    addTrial(trialData);
                }

                closeModal();
            });

            // CORRECTED: Backend test reminder
            elements.testReminder.addEventListener('click', async () => {
                try {
                    const response = await fetch(BackendConfig.TEST_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type: 'test'
                        })
                    });

                    if (response.ok) {
                        showToast('Test reminder sent via backend service', 'success');
                    } else {
                        throw new Error('Backend test failed');
                    }
                } catch (error) {
                    // Graceful fallback to browser notification
                    console.log('Falling back to browser notification');
                    NotificationService.showPushNotification(
                        'Test Reminder - FreeTrialGuard',
                        'This is how your gentle reminders will appear. Peaceful, isn\'t it? ð'
                    );
                    showToast('Test reminder sent via browser notification', 'gentle');
                }
            });

            // PWA Install
            elements.installApp.addEventListener('click', () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            showToast('FreeTrialGuard installed! Find it on your home screen', 'success');
                        }
                        deferredPrompt = null;
                        elements.installPrompt.classList.add('hidden');
                    });
                }
            });

            elements.dismissInstall.addEventListener('click', () => {
                elements.installPrompt.classList.add('hidden');
            });

            // Close modals on backdrop click
            [elements.addTrialModal, elements.privacyModal].forEach(modal => {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.classList.add('hidden');
                    }
                });
            });
        }

        function closeModal() {
            elements.addTrialModal.classList.add('hidden');
            elements.trialForm.reset();

            // Reset radio buttons to default (push notifications)
            document.querySelector('input[name="reminderMethod"][value="push"]').checked = true;
            document.querySelector('input[name="reminderMethod"][value="push"]').dispatchEvent(new Event('change'));

            delete elements.trialForm.dataset.editId;
        }
        // PWA Installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            elements.installPrompt.classList.remove('hidden');
        });

        // Service Worker Registration (for PWA functionality)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('data:text/javascript;base64,' + btoa(`
                const CACHE_NAME = 'freetrial-guard-v3';
                const urlsToCache = [
                    '/',
                    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
                    'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
                    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap'
                ];

                self.addEventListener('install', (event) => {
                    event.waitUntil(
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.addAll(urlsToCache))
                    );
                });

                self.addEventListener('fetch', (event) => {
                    event.respondWith(
                        caches.match(event.request)
                            .then((response) => {
                                return response || fetch(event.request);
                            })
                    );
                });

                self.addEventListener('notificationclick', (event) => {
                    event.notification.close();
                    event.waitUntil(
                        clients.openWindow('/')
                    );
                });
            `))
            .then(() => {
                console.log('Service Worker registered successfully');
            })
            .catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
        }

        // Global functions for trial management
        window.deleteTrial = deleteTrial;
        window.editTrial = editTrial;

        // CORRECTED: Initialize App (No Emotional Mode)
        async function initializeApp() {
            // Request notification permission
            await NotificationService.requestPermission();

            // Initialize database
            initDB();

            // Setup event listeners
            setupEventListeners();

            // CORRECTED: Setup radio button handlers
            setupReminderMethodHandlers();

            // Set default end date to one week from now
            const defaultDate = new Date();
            defaultDate.setDate(defaultDate.getDate() + 7);
            document.getElementById('endDate').value = defaultDate.toISOString().split('T')[0];

            console.log('FreeTrialGuard initialized successfully - Plug & Play Ready! ð');
        }

        // Start the app
        document.addEventListener('DOMContentLoaded', initializeApp);
    </script>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js/vcd15cbe7772f49c399c6a5babf22c1241717689176015" integrity="sha512-ZpsOmlRQV6y907TI0dKBHq9Md29nnaEIPlkf84rnaERnq6zvWvPUqr2ft8M1aS28oN72PdrCzSjY4U6VaAw1EQ==" data-cf-beacon='{"rayId":"97c7a63f6b4016b2","serverTiming":{"name":{"cfExtPri":true,"cfEdge":true,"cfOrigin":true,"cfL4":true,"cfSpeedBrain":true,"cfCacheStatus":true}},"version":"2025.8.0","token":"4edd5f8ec12a48cfa682ab8261b80a79"}' crossorigin="anonymous"></script>
