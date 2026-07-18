const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1dBa6FDsrRJbiw2vjg5IlQW0ZQJuG_LjMOhjNgrTjG4efetZcJ1IEDGhQFPnvzzE/exec'; // YOUR LIVE WEB APP

let chartInstance = null;
let packagesData = [];
let allUsersData = [];

// ==========================================
// UI & NAVIGATION
// ==========================================
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('sidebar-hidden'); }

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => { t.classList.remove('active'); });
    const target = document.getElementById(tabId + 'Tab');
    if(target) { target.classList.add('active'); }
    
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('active', 'bg-slate-50', 'text-blue-600');
        b.querySelector('i').classList.remove('text-blue-600');
        b.querySelector('i').classList.add('text-slate-400');
    });
    
    const clickedBtn = document.getElementById('btn-' + tabId);
    if(clickedBtn) {
        clickedBtn.classList.add('active');
        clickedBtn.querySelector('i').classList.remove('text-slate-400');
    }
    if (window.innerWidth < 768) toggleSidebar();
}

function switchSettingsTab(tabId) {
    document.querySelectorAll('.settings-tab-content').forEach(t => { t.classList.remove('active'); });
    document.getElementById('set-tab-' + tabId).classList.add('active');
    
    document.querySelectorAll('.settings-tab-btn').forEach(b => { b.classList.remove('active'); });
    document.getElementById('set-btn-' + tabId).classList.add('active');
}

function toggleNotifications(event) {
    event.stopPropagation();
    document.getElementById('notificationDropdown').classList.toggle('hidden');
}

function closeDropdowns() {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown.classList.contains('hidden')) {
        dropdown.classList.add('hidden');
    }
}

function filterTable(tableId, inputId) {
    const input = document.getElementById(inputId);
    const filter = input.value.toUpperCase();
    const table = document.getElementById(tableId);
    const tr = table.getElementsByTagName("tr");
    for (let i = 0; i < tr.length; i++) {
        let textValue = tr[i].textContent || tr[i].innerText;
        if (textValue.toUpperCase().indexOf(filter) > -1) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }
}

// ==========================================
// AUTHENTICATION & DATA FETCHING
// ==========================================
async function checkLogin() {
    const passInput = document.getElementById('adminPassInput').value;
    const btn = document.getElementById('loginBtn');
    const errorText = document.getElementById('loginError');

    if (!passInput) return;

    btn.innerText = "Verifying...";
    btn.disabled = true;
    errorText.classList.add('hidden');

    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAdminData`);
        const rawText = await response.text(); 
        
        const data = JSON.parse(rawText);
        if (data.status === "error") throw new Error(data.message);

        const dbPassword = (data.settings && data.settings.adminPass) ? data.settings.adminPass.toString() : "1234";

        if (passInput === dbPassword) {
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('mainContent').classList.remove('blur-md', 'opacity-0', 'pointer-events-none');
            processFetchedData(data);
        } else {
            errorText.innerText = "Incorrect Password.";
            errorText.classList.remove('hidden');
        }
    } catch (e) {
        errorText.innerText = "Network Error. Please check connection.";
        errorText.classList.remove('hidden');
    } finally {
        btn.innerText = "Login";
        btn.disabled = false;
    }
}

function refreshDataSilently() {
    fetchAdminData();
}

async function fetchAdminData() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAdminData`);
        const rawText = await response.text(); 
        const data = JSON.parse(rawText);
        if (data.status === "error") throw new Error(data.message);
        processFetchedData(data);
    } catch (e) { 
        showStatus("Sync Error", "bg-red-500"); 
        document.getElementById('userTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500 font-bold"><i class="fas fa-exclamation-triangle text-2xl mb-2 block text-red-400"></i>Failed to load data: ${e.message}</td></tr>`;
    }
}

function processFetchedData(data) {
    if(data.settings) {
        document.getElementById('set_adminPass').value = data.settings.adminPass || "1234";
        document.getElementById('set_ispName').value = data.settings.ispName || "Veltrix ISP";
        document.getElementById('set_supportPhone').value = data.settings.supportPhone || "";
        document.getElementById('set_phChannel').value = data.settings.phChannelId || "";
        document.getElementById('set_phAuth').value = data.settings.phAuth || "";
        
        document.getElementById('sidebarBrandName').innerHTML = data.settings.ispName ? data.settings.ispName.replace("ISP", '<span class="text-blue-600">ISP</span>') : 'Veltrix<span class="text-blue-600">ISP</span>';
        document.getElementById('mobileBrandName').innerText = data.settings.ispName || "SNOOKUMTECH";
    }

    if(data.routerDns) document.getElementById('mt_dns').value = data.routerDns;
    packagesData = data.packages || [];
    
    // Strict Hotspot mapping (PPPoE logic removed)
    allUsersData = data.allTransactions || [];
    
    renderPackages();
    updateUI(data);
    renderAlerts(data.alerts || []);
    
    const select = document.getElementById('mPkg');
    select.innerHTML = data.packages.map(pkg => `<option value="${pkg.name}">${pkg.name} (KES ${pkg.price})</option>`).join('');
}

// ==========================================
// RENDERING & UI UPDATES
// ==========================================
function renderAlerts(alertsArray) {
    const bellBadge = document.getElementById('bellBadge');
    const alertList = document.getElementById('alertList');
    
    if (alertsArray.length === 0) {
        bellBadge.classList.add('hidden');
        alertList.innerHTML = `<div class="p-8 text-center text-slate-400 text-sm"><i class="fas fa-check-circle text-green-400 text-2xl mb-2 block"></i>All systems operational.</div>`;
        return;
    }

    bellBadge.classList.remove('hidden');
    
    alertList.innerHTML = alertsArray.map(a => {
        const isCritical = a.type && a.type.toLowerCase() === 'critical';
        const iconColor = isCritical ? 'text-red-500' : 'text-orange-400';
        const borderClass = isCritical ? 'border-l-red-500' : 'border-l-orange-400';
        
        return `
        <div class="p-4 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer border-l-4 ${borderClass}">
            <div class="flex items-center gap-2 mb-1">
                <i class="fas fa-exclamation-circle ${iconColor} text-xs"></i>
                <span class="text-xs font-bold text-slate-800">${a.type || 'System'} Alert</span>
            </div>
            <p class="text-[10px] text-slate-500">${a.message}</p>
            <p class="text-[8px] text-slate-400 mt-1 uppercase font-bold tracking-wider">${a.date}</p>
        </div>`;
    }).join('');
}

function updateChart(stats) {
    const ctx = document.getElementById('pkgChart').getContext('2d');
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: Object.keys(stats), datasets: [{ label: 'Sales', data: Object.values(stats), backgroundColor: '#3b82f6', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function renderPackages() {
    const grid = document.getElementById('packageGrid');
    grid.innerHTML = packagesData.map(pkg => `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition group">
            <div>
                <div class="flex justify-between items-start mb-2">
                    <h4 class="text-lg font-bold text-slate-900">${pkg.name}</h4>
                    <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold uppercase">${pkg.duration} Mins</span>
                </div>
                <p class="text-xl font-black text-blue-600">KES ${pkg.price}</p>
            </div>
            <button onclick="deletePackage('${pkg.name}')" class="mt-6 text-slate-400 hover:text-red-500 text-xs font-bold uppercase tracking-widest text-left transition flex items-center gap-2">
                <i class="fas fa-trash-alt"></i> Delete Plan
            </button>
        </div>`).join('');
}

function getTimeLeftStr(rawExpiryStr) {
    if (!rawExpiryStr || rawExpiryStr === "---") return '<span class="text-slate-400">No Expiry</span>';
    
    // Safely parse the ISO format provided by code.gs
    const exp = new Date(rawExpiryStr);
    const now = new Date();
    const diff = exp - now;
    
    if (diff < 0) return '<span class="text-red-500 font-bold uppercase text-[10px] tracking-wide">Expired</span>';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    
    if (days > 0) return `<span class="text-emerald-600 font-bold text-xs">${days}d ${hours}h left</span>`;
    return `<span class="text-orange-500 font-bold text-xs">${hours}h left</span>`;
}

function updateUI(data) {
    document.getElementById('totalSales').innerText = `KES ${data.totalRevenue}`;
    document.getElementById('netProfit').innerText = `KES ${data.totalRevenue}`; // Simplified mapping
    document.getElementById('activeUsers').innerText = data.activeCount;
    document.getElementById('popularPkg').innerText = data.popularPlan;
    document.getElementById('totalCount').innerText = data.totalTransactions;

    const totalRecords = allUsersData.length;
    const hotspotRecords = allUsersData.filter(t => t.type === 'Hotspot').length;
    const disabledRecords = allUsersData.filter(t => t.status === 'Disabled' || t.status === 'Expired' || t.status === 'Paused').length;
    
    document.getElementById('count-all').innerText = totalRecords;
    document.getElementById('count-hotspot').innerText = hotspotRecords; 
    document.getElementById('count-paused').innerText = disabledRecords;

    renderUserTable(allUsersData);

    let activeUsersWithExpiry = allUsersData.filter(u => u.rawExpiry && u.status !== 'Disabled');
    activeUsersWithExpiry.sort((a, b) => new Date(a.rawExpiry) - new Date(b.rawExpiry));

    if(activeUsersWithExpiry.length === 0) {
        document.getElementById('expiryTableBody').innerHTML = `<tr><td colspan="4" class="text-center py-10 text-slate-400">No active users with expiry dates found.</td></tr>`;
    } else {
        document.getElementById('expiryTableBody').innerHTML = activeUsersWithExpiry.map(t => {
            const initial = t.phone.toString().substring(0, 2).toUpperCase();
            const isManual = t.ref && t.ref.startsWith('ADMIN-MANUAL');
            const avatarColor = isManual ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600';
            const timeLeft = getTimeLeftStr(t.rawExpiry);

            return `
            <tr class="hover:bg-slate-50 transition group">
                <td class="py-3 px-4">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center font-black text-[10px] shrink-0">${initial}</div>
                        <p class="text-sm font-bold text-slate-900 leading-tight truncate max-w-[150px]">${t.phone}</p>
                    </div>
                </td>
                <td class="py-3 px-4">
                    <p class="text-sm font-bold text-slate-700">${t.package}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase mt-0.5">${t.type}</p>
                </td>
                <td class="py-3 px-4 text-xs font-medium text-slate-600">${t.expiry}</td>
                <td class="py-3 px-4">${timeLeft}</td>
            </tr>`;
        }).join('');
    }

    if(!data.ipBindings || data.ipBindings.length === 0) {
        document.getElementById('bindingsTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-10 text-slate-400">No IP bindings found. Click 'Add Binding' to create one.</td></tr>`;
    } else {
        document.getElementById('bindingsTableBody').innerHTML = data.ipBindings.map(b => {
            const badgeClass = b.type.toLowerCase() === 'bypassed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
            const statusDot = b.status === 'Active' ? 'bg-green-500' : 'bg-slate-300';
            
            return `
            <tr class="hover:bg-slate-50 transition group">
                <td class="py-3 px-4">
                    <p class="text-sm font-bold text-slate-900">${b.owner || 'Unknown Device'}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Added: ${b.dateAdded}</p>
                </td>
                <td class="py-3 px-4"><p class="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block uppercase tracking-wider">${b.mac}</p></td>
                <td class="py-3 px-4 text-xs font-mono text-slate-600">${b.ip || 'Dynamic'}</td>
                <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full ${statusDot}"></div>
                        <span class="${badgeClass} font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide border border-white">${b.type}</span>
                    </div>
                </td>
                <td class="py-3 px-4 text-right">
                    <button onclick="deleteBinding('${b.mac}')" class="text-slate-400 hover:text-red-500 p-2 transition rounded hover:bg-red-50" title="Delete Binding"><i class="fas fa-trash text-sm"></i></button>
                </td>
            </tr>`;
        }).join('');
    }

    document.getElementById('txnTableBody').innerHTML = data.allTransactions.map(t => `
        <tr class="hover:bg-slate-50 transition text-sm">
            <td class="py-3 px-4 text-slate-500 text-[11px]">${t.timestamp}</td>
            <td class="py-3 px-4 font-bold text-slate-800">${t.phone}</td>
            <td class="py-3 px-4 text-slate-600">${t.package}</td>
            <td class="py-3 px-4 font-bold text-green-600">KES ${t.amount || 0}</td>
            <td class="py-3 px-4 font-mono text-slate-400 text-[10px] tracking-wider">${t.ref}</td>
        </tr>`).join('');

    document.getElementById('activityFeed').innerHTML = data.recentTransactions.slice(0, 5).map(t => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2 border border-slate-100">
            <div class="flex items-center gap-3">
                <div class="w-2 h-2 rounded-full ${t.amount > 0 ? 'bg-green-500' : 'bg-orange-500'}"></div>
                <div class="text-xs font-bold text-slate-700">${t.phone}</div>
            </div>
            <div class="text-green-600 font-bold text-xs">+ KES ${t.amount || 0}</div>
        </div>`).join('');
    
    updateChart(data.packageStats);
}

function filterUserView(type) {
    document.querySelectorAll('#usersTab .table-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${type.toLowerCase()}`).classList.add('active');

    let filteredData = allUsersData;
    if (type === 'Hotspot') filteredData = allUsersData.filter(user => user.type === 'Hotspot');
    else if (type === 'Paused') filteredData = allUsersData.filter(user => user.status === 'Paused' || user.status === 'Disabled' || user.status === 'Expired');

    renderUserTable(filteredData);
}

function renderUserTable(dataArray) {
    if (dataArray.length === 0) {
        document.getElementById('userTableBody').innerHTML = `<tr><td colspan="5" class="text-center py-10 text-slate-400">No users found in this category.</td></tr>`;
        return;
    }

    document.getElementById('userTableBody').innerHTML = dataArray.map(t => {
        const initial = t.phone.toString().substring(0, 2).toUpperCase();
        
        const isManual = t.ref && t.ref.startsWith('ADMIN-MANUAL');
        const avatarColor = isManual ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600';
        const networkMain = isManual ? 'Walk-in / Manual' : `Ref: ${t.ref}`;

        let statusBadge = '';
        if (t.status === 'Active') {
            statusBadge = `<span class="bg-green-100 text-green-700 border border-green-200 font-bold px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wide">Active</span>`;
        } else if (t.status === 'Expired') {
            statusBadge = `<span class="bg-red-50 text-red-600 border border-red-200 font-bold px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wide">Expired</span>`;
        } else {
            statusBadge = `<span class="bg-slate-100 text-slate-600 border border-slate-200 font-bold px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wide">${t.status}</span>`;
        }

        return `
        <tr class="hover:bg-slate-50 transition group">
            <td class="py-3 px-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center font-black text-[10px] shrink-0">${initial}</div>
                    <div>
                        <p class="text-sm font-bold text-slate-900 leading-tight truncate max-w-[150px]">${t.phone}</p>
                        <p class="text-[10px] font-mono text-slate-400 mt-0.5"><span class="font-bold text-slate-600 tracking-wider">Code: ${t.code}</span></p>
                    </div>
                </div>
            </td>
            <td class="py-3 px-4">
                <p class="text-sm font-bold text-slate-700">${t.package}</p>
                <p class="text-[10px] font-bold text-slate-400 uppercase mt-0.5">${t.type}</p>
            </td>
            <td class="py-3 px-4">
                <p class="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[120px]">${networkMain}</p>
                <p class="text-[9px] text-slate-400 mt-1">${t.timestamp}</p>
            </td>
            <td class="py-3 px-4">${statusBadge}</td>
            <td class="py-3 px-4 text-right space-x-1">
                <button onclick="adminAction('${t.code}', 'activate')" class="text-slate-400 hover:text-green-600 p-2 transition rounded hover:bg-green-50" title="Force Active"><i class="fas fa-play text-sm"></i></button>
                <button onclick="adminAction('${t.code}', 'deactivate')" class="text-slate-400 hover:text-red-600 p-2 transition rounded hover:bg-red-50" title="Disconnect"><i class="fas fa-stop text-sm"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// ==========================================
// CRUD OPERATIONS & API CALLS
// ==========================================
async function clearAlerts() {
    try {
        document.getElementById('alertList').innerHTML = `<div class="p-8 text-center text-slate-400 text-sm"><i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Clearing...</div>`;
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "markAlertsRead" }) });
        if((await res.json()).status === "success") fetchAdminData();
    } catch(e) { showStatus("Error clearing alerts", "bg-red-500"); }
}

async function saveAllSettings() {
    const settingsObj = {
        ISP_Name: document.getElementById('set_ispName').value,
        Support_Phone: document.getElementById('set_supportPhone').value,
        Admin_Password: document.getElementById('set_adminPass').value,
        PH_CHANNEL_ID: document.getElementById('set_phChannel').value,
        PH_BASIC_AUTH: document.getElementById('set_phAuth').value
    };
    
    showStatus("Saving Configurations...", "bg-blue-600");
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "saveSettings", settings: settingsObj }) });
        if((await res.json()).status === "success") { 
            hideSettingsModal(); 
            showStatus("Settings Updated Successfully!", "bg-green-600");
            fetchAdminData();
        }
    } catch(e) { showStatus("Error saving settings", "bg-red-500"); }
}

async function addBinding() {
    const owner = document.getElementById('bindOwner').value;
    const mac = document.getElementById('bindMac').value.toUpperCase();
    const ip = document.getElementById('bindIp').value;
    const type = document.getElementById('bindType').value;
    
    if(!owner || !mac) return showStatus("Owner and MAC required", "bg-red-500");
    
    showStatus("Saving Binding...", "bg-blue-600");
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "addBinding", owner, mac, ip, type }) });
        if((await res.json()).status === "success") { hideBindingModal(); fetchAdminData(); showStatus("Binding Saved!", "bg-green-600"); }
    } catch(e) { showStatus("Error saving", "bg-red-500"); }
}

async function deleteBinding(mac) {
    showStatus("Deleting...", "bg-slate-700");
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "deleteBinding", mac }) });
        if((await res.json()).status === "success") { fetchAdminData(); showStatus("Binding Deleted", "bg-slate-700"); }
    } catch(e) { showStatus("Delete Failed", "bg-red-500"); }
}

async function addPackage() {
    const name = document.getElementById('newPkgName').value;
    const price = document.getElementById('newPkgPrice').value;
    const duration = document.getElementById('newPkgDuration').value;
    if(!name || !price || !duration) return showStatus("All fields required", "bg-red-500"); 
    
    showStatus("Saving Package...", "bg-blue-600");
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "addPackage", name, price, duration }) });
        if((await res.json()).status === "success") { 
            hidePackageModal(); fetchAdminData(); showStatus("Package Added!", "bg-green-600"); 
        }
    } catch (e) { showStatus("Connection Error", "bg-red-500"); }
}

async function deletePackage(name) {
    showStatus("Deleting...", "bg-slate-700");
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "deletePackage", name }) });
        if((await res.json()).status === "success") { fetchAdminData(); showStatus("Package Deleted", "bg-slate-700"); }
    } catch (e) { showStatus("Delete Failed", "bg-red-500"); }
}

async function adminAction(id, type) {
    showStatus(type.toUpperCase(), "bg-slate-800");
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: type, code: id }) });
        if((await res.json()).status === "success") fetchAdminData();
    } catch (e) { showStatus("Failed", "bg-red-500"); }
}

async function generateManual() {
    const pkg = document.getElementById('mPkg').value;
    const phone = document.getElementById('mPhone').value || "WALK-IN";
    showStatus("GENERATING...", "bg-blue-600"); hideManualModal();
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "generateManualVoucher", package: pkg, phone: phone }) });
        const result = await res.json();
        if(result.status === "success") {
            document.getElementById('displayCode').innerText = result.code;
            document.getElementById('displayExpiry').innerText = "Expires: " + result.expiry;
            document.getElementById('successModal').classList.remove('hidden');
            fetchAdminData();
        }
    } catch (e) { showStatus("ERROR", "bg-red-500"); }
}

async function saveAndGenerateScript() {
    const dns = document.getElementById('mt_dns').value;
    const user = document.getElementById('mt_user').value;
    const pass = document.getElementById('mt_pass').value;
    if(!dns) return showStatus("DNS Required", "bg-red-500");
    showStatus("Saving Config...", "bg-blue-600");
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "saveRouterConfig", dns, user, pass }) });
        if((await res.json()).status === "success") { generateMTScript(user, pass, dns); showStatus("Config Saved!", "bg-green-600"); }
    } catch (e) { showStatus("Save Failed", "bg-red-500"); }
}

async function testConnection() {
    const statusDiv = document.getElementById('conn_status');
    statusDiv.classList.remove('hidden', 'text-green-600', 'text-red-600');
    statusDiv.innerText = "Testing... ⏳"; statusDiv.classList.add('block');
    try {
        const res = await fetch(APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "testMTConnection" }) });
        const result = await res.json();
        if (result.status === "success") { statusDiv.innerText = "✅ Router is Reachable!"; statusDiv.classList.add('text-green-600'); } 
        else { statusDiv.innerText = "❌ Error: " + result.message; statusDiv.classList.add('text-red-600'); }
    } catch (e) { statusDiv.innerText = "❌ Network Error"; statusDiv.classList.add('text-red-600'); }
}

function generateMTScript(user, pass, dns) {
    const script = `# ==========================================
# MIKROTIK AUTO-CONFIG FOR ISP PORTAL
# Generated for Cloud DNS: ${dns}
# ==========================================
/user add name="${user}" group=full password="${pass}" comment="Billing API User"
/ip service set api disabled=no port=8728
/ip service set api-ssl disabled=no port=8729
/ip service set www disabled=no port=80
/ip service set www-ssl disabled=no port=443
/ip cloud set ddns-enabled=yes
/ip cloud force-update
/ip firewall filter add chain=input protocol=tcp dst-port=443 action=accept comment="Allow WebFig" place-before=0
/ip firewall filter add chain=input protocol=tcp dst-port=8291 action=accept comment="Allow WinBox" place-before=0
/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept comment="Allow Billing API" place-before=0
/ip firewall mangle add chain=postrouting action=change-ttl new-ttl=set:1 passthrough=yes comment="Prevent Sharing"
/ip hotspot walled-garden
add dst-host="mrsnookum.github.io" action=allow
add dst-host="*.github.io" action=allow
add dst-host="script.google.com" action=allow
add dst-host="*.google.com" action=allow
add dst-host="backend.payhero.co.ke" action=allow
/ip hotspot profile set [find default=yes] login-by=http-pap,mac dns-name="snookum.wifi"`;
    document.getElementById('mt_script_output').innerText = script;
}

// ==========================================
// UTILITIES & MODAL CONTROLS
// ==========================================
function showStatus(msg, color) {
    const el = document.getElementById('statusAlert');
    el.innerText = msg; el.className = `fixed top-20 right-4 z-[150] px-4 py-2 rounded-lg text-sm font-bold block ${color} shadow-lg`;
    setTimeout(() => el.style.display = 'none', 3000);
}

function openWinBox() { const dns = document.getElementById('mt_dns').value; if(dns) window.location.href = `telnet://${dns}:8291`; }
function openWebFig() { const dns = document.getElementById('mt_dns').value; if(dns) window.open(`http://${dns}`, '_blank'); }
function copyMTCode() { navigator.clipboard.writeText(document.getElementById('mt_script_output').innerText); showStatus("Copied", "bg-blue-600"); }
function showPackageModal() { document.getElementById('pkgModal').classList.remove('hidden'); }
function hidePackageModal() { document.getElementById('pkgModal').classList.add('hidden'); }
function showManualModal() { document.getElementById('manualModal').classList.remove('hidden'); }
function hideManualModal() { document.getElementById('manualModal').classList.add('hidden'); }
function showBindingModal() { document.getElementById('bindingModal').classList.remove('hidden'); }
function hideBindingModal() { document.getElementById('bindingModal').classList.add('hidden'); }
function showSettingsModal() { document.getElementById('settingsModal').classList.remove('hidden'); }
function hideSettingsModal() { document.getElementById('settingsModal').classList.add('hidden'); }
function closeSuccessModal() { document.getElementById('successModal').classList.add('hidden'); }

// ==========================================
// BACKGROUND POLLING
// ==========================================
setInterval(() => {
    // Only refresh data if the dashboard is actively visible/unlocked
    if (!document.getElementById('mainContent').classList.contains('pointer-events-none')) {
        refreshDataSilently();
    }
}, 30000);