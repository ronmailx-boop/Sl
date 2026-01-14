const GOOGLE_CLIENT_ID = '151476121869-b5lbrt5t89s8d342ftd1cg1q926518pt.apps.googleusercontent.com';
let db = JSON.parse(localStorage.getItem('BUDGET_FINAL_V27')) || { 
    currentId: 'L1', selectedInSummary: [], 
    lists: { 'L1': { name: 'הרשימה שלי', items: [] } },
    lastActivePage: 'lists'
};

let isLocked = true, activePage = db.lastActivePage || 'lists', selectedCategory = 'הכל', currentEditItemIdx = null;

function save() { 
    localStorage.setItem('BUDGET_FINAL_V27', JSON.stringify(db)); 
    render(); 
}

function render() {
    const container = document.getElementById(activePage === 'lists' ? 'itemsContainer' : 'summaryContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const list = db.lists[db.currentId];
    document.getElementById('listNameDisplay').innerText = list.name;
    
    renderCategoryFilters(list.items);

    let total = 0, paid = 0;
    
    list.items.forEach((item, idx) => {
        if (selectedCategory !== 'הכל' && item.category !== selectedCategory) return;

        const sub = item.price * item.qty;
        total += sub; if (item.checked) paid += sub;
        
        const div = document.createElement('div');
        div.className = "item-card";
        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-3 flex-1" onclick="openEditItem(${idx})">
                    <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="event.stopPropagation(); toggleItem(${idx})" class="w-7 h-7 accent-indigo-600">
                    <div class="flex-1">
                        <div class="text-lg font-bold ${item.checked ? 'line-through text-gray-300' : 'text-slate-700'}">${item.name}</div>
                        <span class="text-[10px] bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full font-bold">${item.category || 'כללי'}</span>
                    </div>
                </div>
                <button onclick="removeItem(${idx})" class="trash-btn">🗑️</button>
            </div>
            <div class="flex justify-between font-black text-indigo-600 mt-1">
                <span class="text-sm">₪${item.price.toFixed(2)}</span>
                <span class="text-lg">₪${sub.toFixed(2)}</span>
            </div>`;
        container.appendChild(div);
    });

    document.getElementById('displayTotal').innerText = total.toFixed(2);
    document.getElementById('displayPaid').innerText = paid.toFixed(2);
    document.getElementById('displayLeft').innerText = (total - paid).toFixed(2);
    document.getElementById('totalLabel').innerText = selectedCategory === 'הכל' ? 'סה"כ רשימה' : `סה"כ ${selectedCategory}`;
}

function renderCategoryFilters(items) {
    const bar = document.getElementById('categoryFilterBar');
    if (!bar) return;
    const cats = ['הכל', ...new Set(items.map(i => i.category || 'כללי'))];
    bar.innerHTML = cats.map(cat => `
        <div onclick="setCategory('${cat}')" class="whitespace-nowrap px-5 py-2 rounded-full text-xs font-bold cursor-pointer transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}">
            ${cat}
        </div>
    `).join('');
}

function setCategory(cat) { selectedCategory = cat; render(); }

function addItem() {
    const n = document.getElementById('itemName').value.trim();
    const p = parseFloat(document.getElementById('itemPrice').value) || 0;
    const c = document.getElementById('itemCategoryCustom').value.trim() || "כללי";
    if (n) {
        db.lists[db.currentId].items.push({ name: n, price: p, qty: 1, checked: false, category: c });
        save();
        closeModal('inputForm');
        document.getElementById('itemCategoryCustom').value = '';
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
    if (currentEditItemIdx === null) return;
    const item = db.lists[db.currentId].items[currentEditItemIdx];
    item.name = document.getElementById('editItemName').value.trim();
    item.price = parseFloat(document.getElementById('editItemPrice').value) || 0;
    item.category = document.getElementById('editItemCategoryCustom').value.trim() || "כללי";
    save();
    closeModal('editItemModal');
}

function toggleItem(idx) { db.lists[db.currentId].items[idx].checked = !db.lists[db.currentId].items[idx].checked; save(); }
function removeItem(idx) { if(confirm('למחוק מוצר?')) { db.lists[db.currentId].items.splice(idx, 1); save(); } }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function toggleLock() { isLocked = !isLocked; render(); }
function showPage(p) { activePage = p; render(); }

window.onload = render;
