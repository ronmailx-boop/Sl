const CLIENT_ID = '151476121869-b5lbrt5t89s8d342ftd1cg1q926518pt.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

let db = JSON.parse(localStorage.getItem('BUDGET_FINAL_V27')) || { 
    currentId: 'L1', selectedInSummary: [], 
    lists: { 'L1': { name: 'הרשימה שלי', items: [] } },
    lastActivePage: 'lists'
};

let isLocked = true, activePage = db.lastActivePage || 'lists', selectedCategory = 'הכל', currentEditItemIdx = null, tokenClient;

function save() { 
    db.lastActivePage = activePage;
    localStorage.setItem('BUDGET_FINAL_V27', JSON.stringify(db)); 
    render(); 
    if (localStorage.getItem('G_TOKEN')) uploadToCloud();
}

function render() {
    const container = document.getElementById(activePage === 'lists' ? 'itemsContainer' : 'summaryContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const list = db.lists[db.currentId] || { name: 'רשימה', items: [] };
    document.getElementById('listNameDisplay').innerText = list.name;
    
    // ניהול טאבים
    document.getElementById('tabLists').className = `tab-btn ${activePage === 'lists' ? 'tab-active' : ''}`;
    document.getElementById('tabSummary').className = `tab-btn ${activePage === 'summary' ? 'tab-active' : ''}`;
    document.getElementById('pageLists').classList.toggle('hidden', activePage !== 'lists');
    document.getElementById('pageSummary').classList.toggle('hidden', activePage !== 'summary');

    // נעילה
    document.getElementById('mainLockBtn').innerText = isLocked ? '🔒' : '🔓';

    renderCategoryFilters(list.items);

    let total = 0, paid = 0;
    list.items.forEach((item, idx) => {
        if (selectedCategory !== 'הכל' && item.category !== selectedCategory) return;
        
        const sub = item.price * item.qty;
        total += sub; if (item.checked) paid += sub;
        
        const div = document.createElement('div');
        div.className = "item-card";
        div.onclick = () => { if(!isLocked) openEditItem(idx); };
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="event.stopPropagation(); toggleItem(${idx})" class="w-7 h-7" ${isLocked ? 'disabled' : ''}>
                    <div>
                        <div class="text-lg font-bold ${item.checked ? 'line-through text-gray-300' : ''}">${item.name}</div>
                        <span class="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-bold">${item.category || 'כללי'}</span>
                    </div>
                </div>
                ${!isLocked ? `<button onclick="event.stopPropagation(); removeItem(${idx})" class="trash-btn">🗑️</button>` : ''}
            </div>
            <div class="flex justify-between font-black text-indigo-600">
                <span>₪${item.price.toFixed(2)}</span>
                <span>₪${sub.toFixed(2)}</span>
            </div>`;
        container.appendChild(div);
    });

    document.getElementById('displayTotal').innerText = total.toFixed(2);
    document.getElementById('displayPaid').innerText = paid.toFixed(2);
    document.getElementById('displayLeft').innerText = (total - paid).toFixed(2);
}

function renderCategoryFilters(items) {
    const bar = document.getElementById('categoryFilterBar');
    if (!bar) return;
    const cats = ['הכל', ...new Set(items.map(i => i.category || 'כללי'))];
    bar.innerHTML = cats.map(cat => `
        <div onclick="setCategory('${cat}')" class="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400 border'}">
            ${cat}
        </div>
    `).join('');
}

function setCategory(cat) { selectedCategory = cat; render(); }

function addItem() {
    const n = document.getElementById('itemName').value;
    const p = parseFloat(document.getElementById('itemPrice').value) || 0;
    const c = document.getElementById('itemCategoryCustom').value || "כללי";
    if (n) {
        db.lists[db.currentId].items.push({ name: n, price: p, qty: 1, checked: false, category: c });
        save();
        closeModal('inputForm');
    }
}

function openEditItem(idx) {
    currentEditItemIdx = idx;
    const item = db.lists[db.currentId].items[idx];
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemCategoryCustom').value = item.category || 'כללי';
    openModal('editItemModal');
}

function saveItemEdit() {
    const item = db.lists[db.currentId].items[currentEditItemIdx];
    item.name = document.getElementById('editItemName').value;
    item.price = parseFloat(document.getElementById('editItemPrice').value) || 0;
    item.category = document.getElementById('editItemCategoryCustom').value || 'כללי';
    save();
    closeModal('editItemModal');
}

function toggleItem(idx) { db.lists[db.currentId].items[idx].checked = !db.lists[db.currentId].items[idx].checked; save(); }
function removeItem(idx) { db.lists[db.currentId].items.splice(idx, 1); save(); }
function toggleLock() { isLocked = !isLocked; render(); }
function showPage(p) { activePage = p; save(); }
function executeClear() { db.lists[db.currentId].items = []; save(); closeModal('confirmModal'); }

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// Google Drive
function handleAuthClick() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES,
        callback: (resp) => {
            localStorage.setItem('G_TOKEN', resp.access_token);
            document.getElementById('cloudIndicator').style.backgroundColor = '#22c55e';
            uploadToCloud();
        },
    });
    tokenClient.requestAccessToken({prompt: 'consent'});
}

async function uploadToCloud() {
    const token = localStorage.getItem('G_TOKEN');
    if (!token) return;
    const metadata = { name: 'vplus_backup.json', parents: ['appDataFolder'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', new Blob([JSON.stringify(db)], {type: 'application/json'}));
    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form
    });
}

function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const a = document.createElement('a');
    a.href = dataStr; a.download = "vplus_backup.json"; a.click();
}

document.addEventListener('DOMContentLoaded', render);
