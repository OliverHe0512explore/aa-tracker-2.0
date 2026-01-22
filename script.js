// Firebase配置
const firebaseConfig = {
    apiKey: "AIzaSyB0xL6oicDbHSVzSpiHb9jWQEml5-zcLT8",
    authDomain: "aa-tracker-5ed48.firebaseapp.com",
    projectId: "aa-tracker-5ed48",
    storageBucket: "aa-tracker-5ed48.firebasestorage.app",
    messagingSenderId: "987684939451",
    appId: "1:987684939451:web:0325b56952167e06136b9e"
};

// 全局变量
let currentUser = null;
let currentTrip = null;
let trips = [];
let expenses = [];
let participants = [];
let db = null;
let auth = null;

// 页面加载完成后执行
window.addEventListener('DOMContentLoaded', function() {
    // 检查Firebase是否可用
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK未加载！');
        showMessage('Firebase SDK未加载，请刷新页面重试', 'error');
        return;
    }
    
    // 初始化Firebase
    try {
        console.log('初始化Firebase...');
        firebase.initializeApp(firebaseConfig);
        
        // 配置Firestore，禁用持久化和优化连接
        db = firebase.firestore();
        db.settings({
            persistence: false, // 禁用持久化
            ignoreUndefinedProperties: true // 忽略undefined属性
        });
        
        auth = firebase.auth();
        console.log('Firebase初始化成功！');
        
        // 测试Firestore连接
        console.log('测试Firestore连接...');
        db.collection('trips')
            .limit(1)
            .get()
            .then(() => {
                console.log('Firestore连接测试成功！');
                
                // 初始化Firebase认证
                initAuth();
                
                // 初始化导航
                initNavigation();
                
                // 初始化表单提交
                initForm();
                
                // 初始化记录筛选
                initFilters();
                
                // 初始化清算功能
                initSettlement();
                
                // 初始化旅行台账管理
                initTripManagement();
                
                // 初始化参与者管理
                initParticipantsManagement();
            })
            .catch((error) => {
                console.error('Firestore连接测试失败:', error);
                showMessage('Firestore连接失败，请检查网络或Firebase配置', 'error');
            });
    } catch (error) {
        console.error('Firebase初始化失败:', error);
        showMessage('Firebase初始化失败，请刷新页面重试', 'error');
    }
});

// 初始化Firebase认证
function initAuth() {
    console.log('开始匿名登录...');
    // 使用匿名登录
    auth.signInAnonymously()
        .then((userCredential) => {
            currentUser = userCredential.user;
            console.log('登录成功:', currentUser.uid);
            // 加载旅行台账列表
            loadTrips();
        })
        .catch((error) => {
            console.error('登录失败:', error);
            showMessage('登录失败，请重试', 'error');
        });
}

// 初始化导航
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const sections = document.querySelectorAll('.section');
    
    navBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const target = this.dataset.target;
            
            // 更新导航按钮状态
            navBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 更新显示的section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === target) {
                    section.classList.add('active');
                }
            });
            
            // 如果切换到仪表盘，更新数据
            if (target === 'dashboard') {
                updateDashboard();
            }
        });
    });
}

// 初始化表单
function initForm() {
    const form = document.getElementById('expense-form');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // 检查是否选择了旅行台账
        if (!currentTrip) {
            showMessage('请先选择或新建旅行台账', 'error');
            return;
        }
        
        // 获取表单数据
        const expense = {
            id: Date.now(),
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            location: document.getElementById('location').value,
            description: document.getElementById('description').value,
            amount: parseFloat(document.getElementById('amount').value),
            payer: document.getElementById('payer').value,
            participants: document.getElementById('participants').value.split(',').map(p => p.trim()),
            category: document.getElementById('category').value,
            notes: document.getElementById('notes').value,
            tripId: currentTrip.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 添加到Firestore
        db.collection('expenses')
            .add(expense)
            .then((docRef) => {
                console.log('支出记录添加成功:', docRef.id);
                // 清空表单
                form.reset();
                // 显示成功提示
                showMessage('记录添加成功！', 'success');
            })
            .catch((error) => {
                console.error('添加支出记录失败:', error);
                showMessage('添加记录失败，请重试', 'error');
            });
    });
}

// 初始化记录筛选
function initFilters() {
    const searchInput = document.getElementById('search');
    const categoryFilter = document.getElementById('category-filter');
    const clearFilterBtn = document.getElementById('clear-filter');
    
    searchInput.addEventListener('input', updateRecordsList);
    categoryFilter.addEventListener('change', updateRecordsList);
    
    clearFilterBtn.addEventListener('click', function() {
        searchInput.value = '';
        categoryFilter.value = '';
        updateRecordsList();
    });
}

// 初始化清算功能
function initSettlement() {
    const calculateBtn = document.getElementById('calculate-settlement');
    
    calculateBtn.addEventListener('click', function() {
        if (!currentTrip) {
            showMessage('请先选择旅行台账', 'error');
            return;
        }
        
        if (expenses.length === 0) {
            showMessage('没有支出记录，无法清算！', 'error');
            return;
        }
        
        const settlement = calculateSettlement();
        displaySettlement(settlement);
    });
}

// 初始化旅行台账管理
function initTripManagement() {
    const tripSelect = document.getElementById('trip-select');
    const newTripBtn = document.getElementById('new-trip-btn');
    const deleteTripBtn = document.getElementById('delete-trip-btn');
    const newTripForm = document.getElementById('new-trip-form');
    const tripNameInput = document.getElementById('trip-name-input');
    const confirmTripBtn = document.getElementById('confirm-trip-btn');
    const cancelTripBtn = document.getElementById('cancel-trip-btn');
    
    // 新建台账 - 显示表单
    newTripBtn.addEventListener('click', function() {
        newTripForm.classList.remove('hidden');
        tripNameInput.focus();
    });
    
    // 确认新建台账
    confirmTripBtn.addEventListener('click', function() {
        const tripName = tripNameInput.value;
        if (tripName && tripName.trim()) {
            createTrip(tripName.trim());
            // 清空输入并隐藏表单
            tripNameInput.value = '';
            newTripForm.classList.add('hidden');
        } else {
            showMessage('请输入旅行名称', 'error');
        }
    });
    
    // 取消新建台账
    cancelTripBtn.addEventListener('click', function() {
        tripNameInput.value = '';
        newTripForm.classList.add('hidden');
    });
    
    // 删除台账
    deleteTripBtn.addEventListener('click', function() {
        if (!currentTrip) {
            showMessage('请先选择要删除的旅行台账', 'error');
            return;
        }
        
        // 使用自定义确认对话框
        if (window.confirm && typeof window.confirm === 'function') {
            if (confirm(`确定要删除旅行台账「${currentTrip.name}」吗？此操作不可恢复！`)) {
                deleteTrip(currentTrip.id);
            }
        } else {
            // 如果confirm不可用，直接执行删除
            deleteTrip(currentTrip.id);
        }
    });
    
    // 切换台账
    tripSelect.addEventListener('change', function() {
        const tripId = this.value;
        if (tripId) {
            const trip = trips.find(t => t.id === tripId);
            if (trip) {
                currentTrip = trip;
                loadExpenses(tripId);
                showMessage(`已切换到旅行台账：${trip.name}`, 'success');
            }
        } else {
            currentTrip = null;
            expenses = [];
            updateRecordsList();
            updateDashboard();
        }
    });
}

// 加载旅行台账列表
function loadTrips() {
    console.log('加载旅行台账列表...');
    db.collection('trips')
        .get()
        .then((querySnapshot) => {
            trips = [];
            querySnapshot.forEach((doc) => {
                trips.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            // 在客户端按创建时间排序
            trips.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA; // 降序排序
            });
            console.log('旅行台账加载成功，共', trips.length, '个台账');
            updateTripSelect();
        })
        .catch((error) => {
            console.error('加载旅行台账失败:', error);
            showMessage('加载旅行台账失败，请重试', 'error');
        });
}

// 更新旅行台账下拉菜单
function updateTripSelect() {
    const tripSelect = document.getElementById('trip-select');
    tripSelect.innerHTML = '<option value="">选择旅行台账</option>';
    
    trips.forEach(trip => {
        const option = document.createElement('option');
        option.value = trip.id;
        option.textContent = trip.name;
        if (currentTrip && currentTrip.id === trip.id) {
            option.selected = true;
        }
        tripSelect.appendChild(option);
    });
}

// 创建新的旅行台账
function createTrip(name) {
    db.collection('trips')
        .add({
            name: name,
            creatorId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            participants: [currentUser.uid] // 默认添加创建者为参与者
        })
        .then((docRef) => {
            console.log('旅行台账创建成功:', docRef.id);
            // 重新加载台账列表
            loadTrips();
            // 切换到新创建的台账
            currentTrip = {
                id: docRef.id,
                name: name
            };
            // 更新下拉菜单
            updateTripSelect();
            // 加载该台账的支出记录
            loadExpenses(docRef.id);
            showMessage('旅行台账创建成功！', 'success');
        })
        .catch((error) => {
            console.error('创建旅行台账失败:', error);
            showMessage('创建旅行台账失败，请重试', 'error');
        });
}

// 删除旅行台账
function deleteTrip(tripId) {
    // 首先删除该台账的所有支出记录
    db.collection('expenses')
        .where('tripId', '==', tripId)
        .get()
        .then((querySnapshot) => {
            const batch = db.batch();
            querySnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            return batch.commit();
        })
        .then(() => {
            // 然后删除台账本身
            return db.collection('trips').doc(tripId).delete();
        })
        .then(() => {
            console.log('旅行台账删除成功:', tripId);
            // 重新加载台账列表
            loadTrips();
            // 清空当前台账和支出记录
            currentTrip = null;
            expenses = [];
            updateRecordsList();
            updateDashboard();
            showMessage('旅行台账删除成功！', 'success');
        })
        .catch((error) => {
            console.error('删除旅行台账失败:', error);
            showMessage('删除旅行台账失败，请重试', 'error');
        });
}

// 加载支出记录
function loadExpenses(tripId) {
    console.log('加载支出记录，tripId:', tripId);
    db.collection('expenses')
        .where('tripId', '==', tripId)
        .get()
        .then((querySnapshot) => {
            expenses = [];
            querySnapshot.forEach((doc) => {
                expenses.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            // 在客户端按创建时间排序
            expenses.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA; // 降序排序
            });
            console.log('支出记录加载成功，共', expenses.length, '条记录');
            updateRecordsList();
            updateDashboard();
        })
        .catch((error) => {
            console.error('加载支出记录失败:', error);
            showMessage('加载支出记录失败，请重试', 'error');
        });
}

// 更新记录列表
function updateRecordsList() {
    const recordsList = document.getElementById('records-list');
    const searchInput = document.getElementById('search').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;
    
    // 筛选记录
    const filteredExpenses = expenses.filter(expense => {
        const matchesSearch = expense.description.toLowerCase().includes(searchInput) ||
                             expense.location.toLowerCase().includes(searchInput) ||
                             expense.payer.toLowerCase().includes(searchInput) ||
                             expense.participants.some(p => p.toLowerCase().includes(searchInput));
        const matchesCategory = !categoryFilter || expense.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });
    
    // 按日期排序（最新的在前）
    filteredExpenses.sort((a, b) => {
        const dateA = new Date(a.date + ' ' + a.time);
        const dateB = new Date(b.date + ' ' + b.time);
        return dateB - dateA;
    });
    
    // 渲染记录
    if (filteredExpenses.length === 0) {
        recordsList.innerHTML = '<p style="text-align: center; color: #666;">没有找到记录</p>';
        return;
    }
    
    recordsList.innerHTML = filteredExpenses.map(expense => `
        <div class="record-item">
            <h3>${expense.description}</h3>
            <p><strong>时间：</strong>${expense.date} ${expense.time}</p>
            <p><strong>地点：</strong>${expense.location}</p>
            <p><strong>分类：</strong>${expense.category}</p>
            <p><strong>金额：</strong><span class="amount">¥${expense.amount.toFixed(2)}</span></p>
            <p><strong>支出人：</strong>${expense.payer}</p>
            <p><strong>参与人：</strong>${expense.participants.join('、')}</p>
            ${expense.notes ? `<p><strong>备注：</strong>${expense.notes}</p>` : ''}
            <div class="record-actions">
                <button class="delete-record-btn" data-id="${expense.id}">删除</button>
            </div>
        </div>
    `).join('');
    
    // 添加删除按钮事件监听
    console.log('添加删除按钮事件监听...');
    const deleteButtons = document.querySelectorAll('.delete-record-btn');
    console.log('找到删除按钮数量:', deleteButtons.length);
    deleteButtons.forEach(btn => {
        console.log('为删除按钮添加事件监听，data-id:', btn.dataset.id);
        btn.addEventListener('click', function() {
            console.log('删除按钮被点击，data-id:', this.dataset.id);
            const expenseId = this.dataset.id;
            console.log('确认删除支出记录，ID:', expenseId);
            if (confirm('确定要删除这条支出记录吗？此操作不可恢复！')) {
                console.log('用户确认删除，调用deleteExpense函数');
                deleteExpense(expenseId);
            } else {
                console.log('用户取消删除');
            }
        });
    });
}

// 更新仪表盘
function updateDashboard() {
    // 计算总支出
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    document.getElementById('total-amount').textContent = `¥${totalAmount.toFixed(2)}`;
    
    // 计算支出笔数
    document.getElementById('total-count').textContent = expenses.length;
    
    // 计算平均每笔支出
    const avgAmount = expenses.length > 0 ? totalAmount / expenses.length : 0;
    document.getElementById('avg-amount').textContent = `¥${avgAmount.toFixed(2)}`;
    
    // 更新分类图表
    updateCategoryChart();
    
    // 更新支出人图表
    updatePayerChart();
    
    // 更新详细统计
    updateDetailsTable();
}

// 更新分类图表
function updateCategoryChart() {
    const categoryChart = document.getElementById('category-chart');
    
    // 按分类分组
    const categoryMap = {};
    expenses.forEach(expense => {
        if (!categoryMap[expense.category]) {
            categoryMap[expense.category] = 0;
        }
        categoryMap[expense.category] += expense.amount;
    });
    
    // 生成图表HTML
    if (Object.keys(categoryMap).length === 0) {
        categoryChart.innerHTML = '<p style="text-align: center; color: #666;">暂无数据</p>';
        return;
    }
    
    const total = Object.values(categoryMap).reduce((sum, amount) => sum + amount, 0);
    const chartHTML = Object.entries(categoryMap).map(([category, amount]) => {
        const percentage = (amount / total * 100).toFixed(1);
        const width = percentage + '%';
        return `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>${category}</span>
                    <span>¥${amount.toFixed(2)} (${percentage}%)</span>
                </div>
                <div style="height: 10px; background-color: #f1f1f1; border-radius: 5px;">
                    <div style="height: 100%; background-color: #4CAF50; width: ${width}; border-radius: 5px; transition: width 0.3s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
    
    categoryChart.innerHTML = chartHTML;
}

// 更新支出人图表
function updatePayerChart() {
    const payerChart = document.getElementById('payer-chart');
    
    // 按支出人分组
    const payerMap = {};
    expenses.forEach(expense => {
        if (!payerMap[expense.payer]) {
            payerMap[expense.payer] = 0;
        }
        payerMap[expense.payer] += expense.amount;
    });
    
    // 生成图表HTML
    if (Object.keys(payerMap).length === 0) {
        payerChart.innerHTML = '<p style="text-align: center; color: #666;">暂无数据</p>';
        return;
    }
    
    const total = Object.values(payerMap).reduce((sum, amount) => sum + amount, 0);
    const chartHTML = Object.entries(payerMap).map(([payer, amount]) => {
        const percentage = (amount / total * 100).toFixed(1);
        const width = percentage + '%';
        return `
            <div style="margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>${payer}</span>
                    <span>¥${amount.toFixed(2)} (${percentage}%)</span>
                </div>
                <div style="height: 10px; background-color: #f1f1f1; border-radius: 5px;">
                    <div style="height: 100%; background-color: #2196F3; width: ${width}; border-radius: 5px; transition: width 0.3s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
    
    payerChart.innerHTML = chartHTML;
}

// 更新详细统计表格
function updateDetailsTable() {
    const detailsTable = document.getElementById('details-table');
    
    // 获取所有唯一的参与人
    const allParticipants = new Set();
    expenses.forEach(expense => {
        expense.participants.forEach(p => allParticipants.add(p));
    });
    
    // 计算每个人的支出和应付款
    const participantStats = {};
    allParticipants.forEach(person => {
        // 计算该人支付的总金额
        const paid = expenses
            .filter(expense => expense.payer === person)
            .reduce((sum, expense) => sum + expense.amount, 0);
        
        // 计算该人应支付的总金额
        let shouldPay = 0;
        expenses.forEach(expense => {
            if (expense.participants.includes(person)) {
                shouldPay += expense.amount / expense.participants.length;
            }
        });
        
        participantStats[person] = {
            paid,
            shouldPay,
            balance: paid - shouldPay // 正数表示应收到的钱，负数表示应支付的钱
        };
    });
    
    // 生成表格HTML
    if (Object.keys(participantStats).length === 0) {
        detailsTable.innerHTML = '<p style="text-align: center; color: #666;">暂无数据</p>';
        return;
    }
    
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>姓名</th>
                    <th>已支付</th>
                    <th>应支付</th>
                    <th>余额</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(participantStats).map(([person, stats]) => `
                    <tr>
                        <td>${person}</td>
                        <td>¥${stats.paid.toFixed(2)}</td>
                        <td>¥${stats.shouldPay.toFixed(2)}</td>
                        <td style="color: ${stats.balance >= 0 ? '#4CAF50' : '#f44336'};">
                            ${stats.balance >= 0 ? '+' : ''}¥${stats.balance.toFixed(2)}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    detailsTable.innerHTML = tableHTML;
}

// 计算清算方案
function calculateSettlement() {
    // 获取所有唯一的参与人
    const allParticipants = new Set();
    expenses.forEach(expense => {
        expense.participants.forEach(p => allParticipants.add(p));
    });
    
    // 计算每个人的余额
    const balances = {};
    allParticipants.forEach(person => {
        // 计算该人支付的总金额
        const paid = expenses
            .filter(expense => expense.payer === person)
            .reduce((sum, expense) => sum + expense.amount, 0);
        
        // 计算该人应支付的总金额
        let shouldPay = 0;
        expenses.forEach(expense => {
            if (expense.participants.includes(person)) {
                shouldPay += expense.amount / expense.participants.length;
            }
        });
        
        balances[person] = paid - shouldPay;
    });
    
    // 分离出需要付款的人和需要收款的人
    const payers = Object.entries(balances)
        .filter(([_, balance]) => balance < 0)
        .map(([person, balance]) => ({ person, amount: Math.abs(balance) }))
        .sort((a, b) => b.amount - a.amount); // 金额大的在前
    
    const receivers = Object.entries(balances)
        .filter(([_, balance]) => balance > 0)
        .map(([person, balance]) => ({ person, amount: balance }))
        .sort((a, b) => b.amount - a.amount); // 金额大的在前
    
    // 生成转账方案
    const transactions = [];
    let i = 0; // 付款人索引
    let j = 0; // 收款人索引
    
    while (i < payers.length && j < receivers.length) {
        const payer = payers[i];
        const receiver = receivers[j];
        
        // 计算转账金额
        const amount = Math.min(payer.amount, receiver.amount);
        
        // 添加转账记录
        transactions.push({
            from: payer.person,
            to: receiver.person,
            amount
        });
        
        // 更新余额
        payer.amount -= amount;
        receiver.amount -= amount;
        
        // 如果付款人已还清，移动到下一个
        if (payer.amount <= 0.01) { // 考虑浮点数精度问题
            i++;
        }
        
        // 如果收款人已收完，移动到下一个
        if (receiver.amount <= 0.01) { // 考虑浮点数精度问题
            j++;
        }
    }
    
    return transactions;
}

// 显示清算结果
function displaySettlement(transactions) {
    const resultContainer = document.getElementById('settlement-result');
    
    if (transactions.length === 0) {
        resultContainer.innerHTML = '<p style="text-align: center; color: #666;">无需转账，所有账目已平衡</p>';
        return;
    }
    
    const resultHTML = `
        <h3>转账方案</h3>
        <div style="margin-top: 15px;">
            ${transactions.map((transaction, index) => `
                <div class="settlement-item">
                    <p><strong>${index + 1}. ${transaction.from}</strong> 转给 <strong>${transaction.to}</strong></p>
                    <p class="amount">金额：¥${transaction.amount.toFixed(2)}</p>
                </div>
            `).join('')}
        </div>
        <div style="margin-top: 20px; padding: 15px; background-color: #f1f1f1; border-radius: 4px;">
            <h4>清算说明</h4>
            <p>按照上述方案转账后，所有账目将完全平衡。</p>
            <p>建议使用支付宝、微信等即时到账方式进行转账。</p>
        </div>
    `;
    
    resultContainer.innerHTML = resultHTML;
}

// 显示消息
function showMessage(text, type) {
    // 创建消息元素
    const message = document.createElement('div');
    message.className = type === 'success' ? 'success-message' : 'error-message';
    message.textContent = text;
    
    // 添加到表单下方
    const form = document.getElementById('expense-form');
    form.parentNode.insertBefore(message, form.nextSibling);
    
    // 3秒后移除消息
    setTimeout(() => {
        message.remove();
    }, 3000);
}

// 获取当前日期和时间，设置为表单默认值
function setDefaultDateTime() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    
    document.getElementById('date').value = dateStr;
    document.getElementById('time').value = timeStr;
}

// 初始化参与者管理
function initParticipantsManagement() {
    console.log('初始化参与者管理...');
    const participantNameInput = document.getElementById('participant-name-input');
    const addParticipantBtn = document.getElementById('add-participant-btn');
    const participantsList = document.getElementById('participants-list');
    const payerSelect = document.getElementById('payer');
    const participantsCheckboxes = document.getElementById('participants-checkboxes');
    const participantsHidden = document.getElementById('participants');
    
    // 加载参与者列表
    loadParticipants();
    
    // 添加参与者
    addParticipantBtn.addEventListener('click', function() {
        const name = participantNameInput.value.trim();
        if (name) {
            if (!participants.includes(name)) {
                participants.push(name);
                saveParticipants();
                updateParticipantsList();
                updatePayerSelect();
                updateParticipantsCheckboxes();
                participantNameInput.value = '';
                showMessage('参与者添加成功！', 'success');
            } else {
                showMessage('该参与者已存在', 'error');
            }
        } else {
            showMessage('请输入参与者姓名', 'error');
        }
    });
    
    // 处理参与人复选框变化
    participantsCheckboxes.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            updateParticipantsHidden();
        }
    });
}

// 加载参与者列表
function loadParticipants() {
    const savedParticipants = localStorage.getItem('participants');
    if (savedParticipants) {
        participants = JSON.parse(savedParticipants);
    }
    updateParticipantsList();
    updatePayerSelect();
    updateParticipantsCheckboxes();
}

// 保存参与者列表
function saveParticipants() {
    localStorage.setItem('participants', JSON.stringify(participants));
}

// 更新参与者列表
function updateParticipantsList() {
    const participantsList = document.getElementById('participants-list');
    participantsList.innerHTML = '';
    
    participants.forEach((participant, index) => {
        const participantItem = document.createElement('div');
        participantItem.className = 'participant-item';
        participantItem.innerHTML = `
            <span>${participant}</span>
            <button class="remove-participant-btn" data-index="${index}">删除</button>
        `;
        participantsList.appendChild(participantItem);
    });
    
    // 添加删除参与者事件
    document.querySelectorAll('.remove-participant-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            participants.splice(index, 1);
            saveParticipants();
            updateParticipantsList();
            updatePayerSelect();
            updateParticipantsCheckboxes();
            showMessage('参与者删除成功！', 'success');
        });
    });
}

// 更新支出人选择框
function updatePayerSelect() {
    const payerSelect = document.getElementById('payer');
    payerSelect.innerHTML = '<option value="">请选择支出人</option>';
    
    participants.forEach(participant => {
        const option = document.createElement('option');
        option.value = participant;
        option.textContent = participant;
        payerSelect.appendChild(option);
    });
}

// 更新参与人复选框
function updateParticipantsCheckboxes() {
    const participantsCheckboxes = document.getElementById('participants-checkboxes');
    participantsCheckboxes.innerHTML = '';
    
    participants.forEach(participant => {
        const checkboxItem = document.createElement('div');
        checkboxItem.className = 'checkbox-item';
        checkboxItem.innerHTML = `
            <input type="checkbox" id="participant-${participant}" value="${participant}">
            <label for="participant-${participant}">${participant}</label>
        `;
        participantsCheckboxes.appendChild(checkboxItem);
    });
}

// 更新参与人隐藏字段
function updateParticipantsHidden() {
    const checkboxes = document.querySelectorAll('#participants-checkboxes input[type="checkbox"]');
    const selectedParticipants = Array.from(checkboxes)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);
    document.getElementById('participants').value = selectedParticipants.join(',');
}

// 删除支出记录
function deleteExpense(expenseId) {
    console.log('删除支出记录，ID:', expenseId);
    
    // 检查expenseId是否有效
    if (!expenseId) {
        console.error('删除支出记录失败：expenseId无效');
        showMessage('删除支出记录失败：记录ID无效', 'error');
        return;
    }
    
    // 检查db是否初始化
    if (!db) {
        console.error('删除支出记录失败：Firebase未初始化');
        showMessage('删除支出记录失败：Firebase未初始化', 'error');
        return;
    }
    
    try {
        // 从Firebase中删除记录
        console.log('开始从Firebase中删除记录...');
        db.collection('expenses')
            .doc(expenseId)
            .delete()
            .then(() => {
                console.log('支出记录删除成功');
                
                // 从本地数组中移除记录
                const initialLength = expenses.length;
                expenses = expenses.filter(expense => expense.id !== expenseId);
                console.log('从本地数组中移除记录，初始长度:', initialLength, '新长度:', expenses.length);
                
                // 更新UI
                console.log('更新UI...');
                updateRecordsList();
                updateDashboard();
                
                // 显示成功消息
                showMessage('支出记录删除成功！', 'success');
            })
            .catch((error) => {
                console.error('删除支出记录失败:', error);
                console.error('错误详情:', JSON.stringify(error));
                showMessage('删除支出记录失败：' + error.message, 'error');
            });
    } catch (error) {
        console.error('删除支出记录时发生异常:', error);
        showMessage('删除支出记录时发生异常，请重试', 'error');
    }
}

// 设置表单默认值
setDefaultDateTime();

// 注意：请在使用前替换Firebase配置信息
// 如何获取Firebase配置信息：
// 1. 访问 https://console.firebase.google.com/
// 2. 创建新项目
// 3. 在项目设置中获取配置信息
// 4. 将配置信息复制到上面的firebaseConfig对象中
// 5. 启用Firestore数据库
// 6. 启用匿名认证（在Authentication > Sign-in method中）
// 7. 设置Firestore安全规则，允许所有用户读写数据（仅用于测试，生产环境需要更严格的规则）

/*
Firestore安全规则示例（测试环境）：
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
*/