// ========== Google Drive Configuration ==========
const GOOGLE_CLIENT_ID = '151476121869-b5lbrt5t89s8d342ftd1cg1q926518pt.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyDIMiuwL-phvwI7iAUeMQmTOowWE96mP6I'; 
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = 'Vplus_Budget_Data';
const FILE_NAME = 'budget_data.json';

let gapiInited = false;
let gisInited = false;
let tokenClient;
let accessToken = null;
let driveFileId = null;
let syncTimeout = null;
let isSyncing = false;
let isConnected = false;

// ========== Original App Logic ==========
let db = JSON.parse(localStorage.getItem('BUDGET_FINAL_V27')) || { 
    currentId: 'L1', 
    selectedInSummary: [], 
    lists: { 'L1': { name: 'הרשימה שלי', items: [] } },
    lastActivePage: 'lists',
    lastSync: 0
};

let isLocked = true;
let activePage = db.lastActivePage || 'lists';
let currentEditIdx = null;
let listToDelete = null;
let sortableInstance = null;

function save() { 
    db.lastActivePage = activePage;
    db.lastSync = Date.now();
    localStorage.setItem('BUDGET_FINAL_V27', JSON.stringify(db));
    render();
    
    if (isConnected && !isSyncing) {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            syncToCloud();
        }, 1500);
    }
}

function toggleItem(idx) {
    db.lists[db.currentId].items[idx].checked = !db.lists[db.currentId].items[idx].checked;
    save();
}

function toggleSum(id) {
    const i = db.selectedInSummary.indexOf(id);
    if (i > -1) db.selectedInSummary.splice(i, 1);
    else db.selectedInSummary.push(id);
    save();
}

function toggleSelectAll(checked) {
    db.selectedInSummary = checked ? Object.keys(db.lists) : [];
    save();
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    closeModal('settingsModal');
}

function showPage(p) { 
    activePage = p; 
    save(); 
}

function openModal(id) { 
    const m = document.getElementById(id);
    if(!m) return;
    m.classList.add('active'); 
    if(id === 'inputForm') {
        document.getElementById('itemName').value = '';
        document.getElementById('itemPrice').value = '';
        setTimeout(() => document.getElementById('itemName').focus(), 150);
    }
    if(id === 'editListNameModal') {
        document.getElementById('editListNameInput').value = db.lists[db.currentId].name;
    }
    if(id === 'importModal') {
        document.getElementById('importText').value = '';
        setTimeout(() => document.getElementById('importText').focus(), 150);
    }
}

function closeModal(id) { 
    const m = document.getElementById(id); 
    if(m) m.classList.remove('active'); 
}

function render() {
    const container = document.getElementById(activePage === 'lists' ? 'itemsContainer' : 'summaryContainer');
    if (!container) return;
    container.innerHTML = '';
    let total = 0, paid = 0;

    document.getElementById('tabLists').className = `tab-btn ${activePage === 'lists' ? 'tab-active' : ''}`;
    document.getElementById('tabSummary').className = `tab-btn ${activePage === 'summary' ? 'tab-active' : ''}`;

    const btn = document.getElementById('mainLockBtn');
    const path = document.getElementById('lockIconPath');
    const tag = document.getElementById('statusTag');
    if (btn && path && tag) {
        btn.className = `bottom-circle-btn ${isLocked ? 'bg-blue-600' : 'bg-orange-400'}`;
        path.setAttribute('d', isLocked ? 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' : 'M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z');
        tag.innerText = isLocked ? "נעול" : "עריכה (גרירה פעילה)";
    }

    if (activePage === 'lists') {
        document.getElementById('pageLists').classList.remove('hidden');
        document.getElementById('pageSummary').classList.add('hidden');
        const list = db.lists[db.currentId];
        document.getElementById('listNameDisplay').innerText = list.name;
        list.items.forEach((item, idx) => {
            const sub = item.price * item.qty; 
            total += sub; 
            if (item.checked) paid += sub;
            const div = document.createElement('div'); 
            div.className = "item-card";
            div.setAttribute('data-id', idx);
            div.innerHTML = `
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-3 flex-1">
                        <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleItem(${idx})" class="w-7 h-7 accent-indigo-600">
                        <div class="flex-1 text-2xl font-bold ${item.checked ? 'line-through text-gray-300' : ''}">${item.name}</div>
                    </div>
                    <button onclick="removeItem(${idx})" class="trash-btn">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                    </button>
                </div>
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3 bg-gray-50 rounded-xl px-2 py-1 border">
                        <button onclick="changeQty(${idx}, 1)" class="text-green-500 text-2xl font-bold">+</button>
                        <span class="font-bold w-6 text-center">${item.qty}</span>
                        <button onclick="changeQty(${idx}, -1)" class="text-red-500 text-2xl font-bold">-</button>
                    </div>
                    <span onclick="openEditTotalModal(${idx})" class="text-2xl font-black text-indigo-600">₪${sub.toFixed(2)}</span>
                </div>
            `;
            container.appendChild(div);
        });
    } else {
        document.getElementById('pageLists').classList.add('hidden');
        document.getElementById('pageSummary').classList.remove('hidden');
        Object.keys(db.lists).forEach(id => {
            const l = db.lists[id];
            let lT = 0, lP = 0;
            l.items.forEach(i => { 
                const s = i.price * i.qty; 
                lT += s; 
                if(i.checked) lP += s; 
            });
            const isSel = db.selectedInSummary.includes(id); 
            if (isSel) { 
                total += lT; 
                paid += lP; 
            }
            const div = document.createElement('div'); 
            div.className = "item-card p-4"; 
            div.dataset.id = id;
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <input type="checkbox" ${isSel ? 'checked' : ''} onchange="toggleSum('${id}')" class="w-7 h-7 accent-indigo-600">
                        <span class="font-bold text-xl cursor-pointer" onclick="db.currentId='${id}'; showPage('lists')">${l.name}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-indigo-600 font-black text-xl">₪${lT.toFixed(2)}</div>
                        <button onclick="prepareDeleteList('${id}')" class="text-red-400 p-1">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke-width="2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
    }
    
    document.getElementById('displayTotal').innerText = total.toFixed(2);
    document.getElementById('displayPaid').innerText = paid.toFixed(2);
    document.getElementById('displayLeft').innerText = (total - paid).toFixed(2);
    initSortable();
}

function addItem() { 
    const n = document.getElementById('itemName').value.trim();
    const p = parseFloat(document.getElementById('itemPrice').value) || 0; 
    if (n) { 
        db.lists[db.currentId].items.push({ 
            name: n, 
            price: p, 
            qty: 1, 
            checked: false 
        }); 
        closeModal('inputForm'); 
        save(); 
    } 
}

function changeQty(idx, d) { 
    if(db.lists[db.currentId].items[idx].qty + d >= 1) { 
        db.lists[db.currentId].items[idx].qty += d; 
        save(); 
    } 
}

function removeItem(idx) { 
    db.lists[db.currentId].items.splice(idx, 1); 
    save(); 
}

function toggleLock() { 
    isLocked = !isLocked; 
    render(); 
}

function executeClear() { 
    db.lists[db.currentId].items = []; 
    closeModal('confirmModal'); 
    save(); 
}

function saveNewList() { 
    const n = document.getElementById('newListNameInput').value.trim(); 
    if(n) { 
        const id = 'L' + Date.now(); 
        db.lists[id] = {
            name: n, 
            items: []
        }; 
        db.currentId = id; 
        activePage = 'lists'; 
        closeModal('newListModal'); 
        save(); 
    } 
}

function deleteFullList() { 
    if (listToDelete) { 
        delete db.lists[listToDelete]; 
        const keys = Object.keys(db.lists); 
        if (db.currentId === listToDelete) {
            db.currentId = keys[0] || (db.lists['L1'] = {name: 'הרשימה שלי', items: []}, 'L1');
        }
        closeModal('deleteListModal'); 
        save(); 
    } 
}

function prepareDeleteList(id) { 
    listToDelete = id; 
    openModal('deleteListModal'); 
}

// ========== ייבוא טקסט ==========
function importFromText() {
    const text = document.getElementById('importText').value.trim();
    if (!text) {
        alert('אנא הדבק טקסט לייבוא');
        return;
    }

    // חילוץ שם רשימה מהשורה הראשונה
    const lines = text.split('\n').filter(line => line.trim());
    let listName = 'רשימה מיובאת';
    
    const firstLine = lines[0];
    if (firstLine.includes('*') && firstLine.includes(':')) {
        const match = firstLine.match(/\*([^*]+)\*/);
        if (match) {
            listName = match[1].trim();
        }
    }

    // בדיקה אם השם כבר קיים והוספת מספר
    let finalName = listName;
    let counter = 1;
    const existingNames = Object.values(db.lists).map(l => l.name);
    while (existingNames.includes(finalName)) {
        counter++;
        finalName = `${listName} ${counter}`;
    }

    // יצירת רשימה חדשה
    const newListId = 'L' + Date.now();
    const items = [];

    // ניתוח שורות
    lines.forEach(line => {
        // דילוג על כותרות וסיכומים
        if (line.includes('🛒') || line.includes('💰') || line.includes('סה"כ')) {
            return;
        }

        // חיפוש פורמט: ⬜ *שם* (xכמות) - ₪מחיר
        // או: ✅ *שם* (xכמות) - ₪מחיר
        const fullMatch = line.match(/[⬜✅]\s*\*([^*]+)\*\s*\(x(\d+)\)\s*-\s*₪([\d.]+)/);
        
        if (fullMatch) {
            const name = fullMatch[1].trim();
            const qty = parseInt(fullMatch[2]);
            const totalPrice = parseFloat(fullMatch[3]);
            const price = totalPrice / qty;
            const checked = line.includes('✅');
            
            items.push({ name, price, qty, checked });
            return;
        }

        // חיפוש פורמט פשוט: *שם*
        const simpleMatch = line.match(/\*([^*]+)\*/);
        if (simpleMatch) {
            const name = simpleMatch[1].trim();
            items.push({ name, price: 0, qty: 1, checked: false });
            return;
        }

        // חיפוש פורמט עם נקודה: • שם (xכמות)
        const bulletMatch = line.match(/[•-]\s*\*?([^(]+)\*?\s*\(x(\d+)\)/);
        if (bulletMatch) {
            const name = bulletMatch[1].trim().replace(/\*/g, '');
            const qty = parseInt(bulletMatch[2]);
            items.push({ name, price: 0, qty, checked: false });
            return;
        }

        // פורמט בסיסי: כל שורה שמתחילה ב-• או -
        const basicMatch = line.match(/^[•-]\s*(.+)/);
        if (basicMatch) {
            const name = basicMatch[1].trim().replace(/\*/g, '');
            if (name) {
                items.push({ name, price: 0, qty: 1, checked: false });
            }
        }
    });

    if (items.length === 0) {
        alert('לא נמצאו מוצרים בטקסט');
        return;
    }

    // הוספת הרשימה
    db.lists[newListId] = { name: finalName, items };
    db.currentId = newListId;
    activePage = 'lists';
    
    closeModal('importModal');
    save();
    
    alert(`✅ יובאו ${items.length} מוצרים לרשימה "${finalName}"`);
}

function initSortable() {
    const el = document.getElementById(activePage === 'lists' ? 'itemsContainer' : 'summaryContainer');
    if (sortableInstance) sortableInstance.destroy();
    if (el && !isLocked) {
        sortableInstance = Sortable.create(el, { 
            animation: 150, 
            onEnd: function() {
                if (activePage === 'lists') {
                    const newOrder = Array.from(el.children).map(c => parseInt(c.getAttribute('data-id')));
                    const items = db.lists[db.currentId].items;
                    db.lists[db.currentId].items = newOrder.map(oldIdx => items[oldIdx]);
                } else {
                    const newOrder = Array.from(el.children).map(c => c.getAttribute('data-id'));
                    const newLists = {};
                    newOrder.forEach(id => newLists[id] = db.lists[id]);
                    db.lists = newLists;
                }
                save(); 
            } 
        });
    }
}

function preparePrint() { 
    closeModal('settingsModal');
    let printArea = document.getElementById('printArea');
    let grandTotal = 0;
    let html = `<h1 style="text-align:center; color:#7367f0;">דוח קניות מפורט - Vplus</h1>`;
    const idsToPrint = db.selectedInSummary.length > 0 ? db.selectedInSummary : Object.keys(db.lists);
    
    idsToPrint.forEach(id => {
        const l = db.lists[id]; 
        let listTotal = 0;
        html += `
            <div style="border-bottom: 2px solid #7367f0; margin-bottom: 20px; padding-bottom: 10px;">
                <h2>${l.name}</h2>
                <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; margin-bottom:10px;">
                    <thead>
                        <tr style="background:#f9fafb;">
                            <th style="padding:8px; border:1px solid #ddd; text-align:right;">מוצר</th>
                            <th style="padding:8px; border:1px solid #ddd; text-align:center;">כמות</th>
                            <th style="padding:8px; border:1px solid #ddd; text-align:left;">סה"כ</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        l.items.forEach(i => { 
            const s = i.price * i.qty; 
            listTotal += s; 
            html += `
                <tr>
                    <td style="padding:8px; border:1px solid #ddd; text-align:right;">${i.name}</td>
                    <td style="padding:8px; border:1px solid #ddd; text-align:center;">${i.qty}</td>
                    <td style="padding:8px; border:1px solid #ddd; text-align:left;">₪${s.toFixed(2)}</td>
                </tr>
            `; 
        });
        
        html += `
                    </tbody>
                </table>
                <div style="text-align:left; font-weight:bold;">סיכום רשימה: ₪${listTotal.toFixed(2)}</div>
            </div>
        `;
        grandTotal += listTotal;
    });
    
    html += `<div style="text-align:center; margin-top:30px; padding:15px; border:3px double #7367f0; font-size:1.5em; font-weight:900;">סה"כ כולל: ₪${grandTotal.toFixed(2)}</div>`;
    printArea.innerHTML = html; 
    window.print();
}

function shareFullToWhatsApp() {
    const list = db.lists[db.currentId];
    if (list.items.length === 0) return;
    let text = `🛒 *${list.name} (רשימה מלאה):*\n\n`;
    list.items.forEach(i => {
        text += `${i.checked ? '✅' : '⬜'} *${i.name}* (x${i.qty}) - ₪${(i.price * i.qty).toFixed(2)}\n`;
    });
    text += `\n💰 *סה"כ: ₪${document.getElementById('displayTotal').innerText}*`;
    window.open("https://wa.me/?text=" + encodeURIComponent(text));
    closeModal('shareListModal');
}

function shareMissingToWhatsApp() {
    const list = db.lists[db.currentId];
    const missing = list.items.filter(i => !i.checked);
    if (missing.length === 0) { 
        alert("אין מוצרים חסרים!"); 
        return; 
    }
    let text = `⬜ *${list.name} (מוצרים חסרים):*\n\n`;
    missing.forEach(i => text += `• *${i.name}* (x${i.qty})\n`);
    window.open("https://wa.me/?text=" + encodeURIComponent(text));
    closeModal('shareListModal');
}

function shareSummaryToWhatsApp() {
    const selectedIds = db.selectedInSummary;
    if (selectedIds.length === 0) { 
        alert("בחר לפחות רשימה אחת לשיתוף!"); 
        return; 
    }
    let text = `📦 *ריכוז רשימות קנייה (חסרים בלבד):*\n\n`;
    selectedIds.forEach(id => {
        const l = db.lists[id];
        const missing = l.items.filter(i => !i.checked);
        if (missing.length > 0) {
            text += `🔹 *${l.name}:*\n`;
            missing.forEach(i => text += `  - ${i.name} (x${i.qty})\n`);
            text += `\n`;
        }
    });
    window.open("https://wa.me/?text=" + encodeURIComponent(text));
}

function saveListName() { 
    const n = document.getElementById('editListNameInput').value.trim(); 
    if(n) { 
        db.lists[db.currentId].name = n; 
        save(); 
    } 
    closeModal('editListNameModal'); 
}

function openEditTotalModal(idx) { 
    currentEditIdx = idx; 
    document.getElementById('editTotalInput').value = ''; 
    openModal('editTotalModal'); 
}

function saveTotal() { 
    const val = parseFloat(document.getElementById('editTotalInput').value); 
    if (!isNaN(val)) { 
        const item = db.lists[db.currentId].items[currentEditIdx];
        item.price = val / item.qty;
        save(); 
    }
    closeModal('editTotalModal');
}

// ========== Google Drive Integration ==========

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '',
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        document.getElementById('cloudBtn').onclick = handleCloudClick;
    }
}

function handleCloudClick() {
    if (isConnected) {
        manualSync();
    } else {
        handleAuthClick();
    }
}

function handleAuthClick() {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('שגיאת התחברות:', resp);
            return;
        }
        
        accessToken = gapi.client.getToken().access_token;
        isConnected = true;
        updateCloudIndicator('connected');
        
        await loadAndMerge();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
}

function updateCloudIndicator(status) {
    const indicator = document.getElementById('cloudIndicator');
    if (status === 'connected') {
        indicator.className = 'w-2 h-2 bg-green-500 rounded-full';
    } else if (status === 'syncing') {
        indicator.className = 'w-2 h-2 bg-yellow-500 rounded-full animate-pulse';
    } else {
        indicator.className = 'w-2 h-2 bg-gray-300 rounded-full';
    }
}

async function findOrCreateFolder() {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (response.result.files.length > 0) {
            return response.result.files[0].id;
        }

        const folderMetadata = {
            name: FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        };

        const folder = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id'
        });

        return folder.result.id;
    } catch (err) {
        console.error('שגיאה ביצירת תיקייה:', err);
        return null;
    }
}

async function findFileInFolder(folderId) {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        return response.result.files.length > 0 ? response.result.files[0].id : null;
    } catch (err) {
        console.error('שגיאה באיתור קובץ:', err);
        return null;
    }
}

async function syncToCloud() {
    if (!accessToken || isSyncing) return;
    
    isSyncing = true;
    updateCloudIndicator('syncing');

    try {
        const folderId = await findOrCreateFolder();
        if (!folderId) {
            isSyncing = false;
            updateCloudIndicator('connected');
            return;
        }

        const fileId = await findFileInFolder(folderId);
        const dataToSave = JSON.stringify(db);

        if (fileId) {
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: dataToSave
            });
            driveFileId = fileId;
        } else {
            const metadata = {
                name: FILE_NAME,
                parents: [folderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([dataToSave], { type: 'application/json' }));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: form
            });

            const result = await response.json();
            driveFileId = result.id;
        }

        console.log('✅ סונכרן לענן');
    } catch (err) {
        console.error('❌ שגיאה בסינכרון:', err);
    } finally {
        isSyncing = false;
        updateCloudIndicator('connected');
    }
}

async function loadAndMerge() {
    if (!accessToken || isSyncing) return;
    
    isSyncing = true;
    updateCloudIndicator('syncing');

    try {
        const folderId = await findOrCreateFolder();
        if (!folderId) {
            isSyncing = false;
            updateCloudIndicator('connected');
            return;
        }

        const fileId = await findFileInFolder(folderId);
        
        if (!fileId) {
            console.log('📁 אין קובץ בענן - שומר נתונים מקומיים');
            isSyncing = false;
            updateCloudIndicator('connected');
            await syncToCloud();
            return;
        }

        driveFileId = fileId;

        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const cloudData = await response.json();
        
        const localItems = db.lists[db.currentId] ? [...db.lists[db.currentId].items] : [];
        
        db = cloudData;
        
        if (localItems.length > 0) {
            const currentListId = db.currentId || 'L1';
            if (!db.lists[currentListId]) {
                db.lists[currentListId] = { name: 'הרשימה שלי', items: [] };
            }
            
            const cloudItemNames = db.lists[currentListId].items.map(i => i.name);
            const newItems = localItems.filter(localItem => 
                !cloudItemNames.includes(localItem.name)
            );
            
            if (newItems.length > 0) {
                db.lists[currentListId].items.push(...newItems);
                console.log(`✅ צורפו ${newItems.length} מוצרים חדשים`);
            }
        }
        
        localStorage.setItem('BUDGET_FINAL_V27', JSON.stringify(db));
        render();
        
        if (localItems.length > 0) {
            isSyncing = false;
            updateCloudIndicator('connected');
            await syncToCloud();
        }
        
        console.log('✅ טעינה מהענן הושלמה');
    } catch (err) {
        console.error('❌ שגיאה בטעינה:', err);
    } finally {
        isSyncing = false;
        updateCloudIndicator('connected');
    }
}

async function manualSync() {
    await loadAndMerge();
}

// טעינת Google API
const script1 = document.createElement('script');
script1.src = 'https://apis.google.com/js/api.js';
script1.onload = gapiLoaded;
document.head.appendChild(script1);

const script2 = document.createElement('script');
script2.src = 'https://accounts.google.com/gsi/client';
script2.onload = gisLoaded;
document.head.appendChild(script2);

// אתחול ראשוני
render();