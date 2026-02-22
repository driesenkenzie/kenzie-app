const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory data storage (will be synced from admin)
let customerData = {
    customers: [],
    customerXP: {},
    orders: [],
    levels: [
        { level: 1, name: 'STARTER', xpRequired: 0, reward: 'Welkom bij Kenzie!' },
        { level: 2, name: 'BRONZE', xpRequired: 100, reward: '-€5 korting!' },
        { level: 3, name: 'SILVER', xpRequired: 300, reward: '-10% korting!' },
        { level: 4, name: 'GOLD', xpRequired: 600, reward: 'Gratis verzending!' },
        { level: 5, name: 'PLATINUM', xpRequired: 1000, reward: '-15% korting!' },
        { level: 6, name: 'DIAMOND', xpRequired: 1500, reward: 'Gratis product!' }
    ]
};

// Admin sync endpoint (protected by simple token)
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'kenzie-admin-2024';

app.post('/api/sync', (req, res) => {
    const token = req.headers.authorization;
    if (token !== `Bearer ${ADMIN_TOKEN}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.body.customers) customerData.customers = req.body.customers;
    if (req.body.customerXP) customerData.customerXP = req.body.customerXP;
    if (req.body.orders) customerData.orders = req.body.orders;
    
    res.json({ success: true, message: 'Data synced' });
});

// Customer login (simple phone number based)
app.post('/api/login', (req, res) => {
    const { phone, name } = req.body;
    
    // Find customer by phone
    let customer = customerData.customers.find(c => c.phone === phone);
    
    if (!customer && name) {
        // Create new customer
        customer = {
            id: Date.now().toString(),
            name: name,
            phone: phone,
            email: '',
            createdAt: new Date().toISOString()
        };
        customerData.customers.push(customer);
        customerData.customerXP[customer.id] = { xp: 0, totalXP: 0 };
    }
    
    if (customer) {
        res.json({ 
            success: true, 
            customer: customer,
            xp: customerData.customerXP[customer.id] || { xp: 0, totalXP: 0 }
        });
    } else {
        res.status(404).json({ error: 'Customer not found' });
    }
});

// Get customer data
app.get('/api/customer/:id', (req, res) => {
    const customer = customerData.customers.find(c => c.id == req.params.id);
    if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
    }
    
    const xp = customerData.customerXP[req.params.id] || { xp: 0, totalXP: 0 };
    const orders = customerData.orders.filter(o => o.customerId == req.params.id);
    
    res.json({
        customer,
        xp,
        orders,
        leaderboard: getLeaderboard()
    });
});

// Get leaderboard
function getLeaderboard() {
    return Object.entries(customerData.customerXP)
        .map(([id, xpData]) => {
            const customer = customerData.customers.find(c => c.id == id);
            return {
                id,
                name: customer ? customer.name : 'Klant ' + id,
                xp: xpData.totalXP || 0,
                level: getLevelName(xpData.xp || 0)
            };
        })
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10);
}

function getLevelName(xp) {
    for (let i = customerData.levels.length - 1; i >= 0; i--) {
        if (xp >= customerData.levels[i].xpRequired) {
            return customerData.levels[i].name;
        }
    }
    return 'Starter';
}

// Get all rewards
app.get('/api/rewards', (req, res) => {
    res.json(customerData.levels);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve customer portal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Kenzie Customer Portal running on port ${PORT}`);
});
