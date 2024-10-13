const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const token = process.env.BOT_TOKEN || '7588364835:AAEFt85rjkIcaCusD2DuLe4SSGvb2IB4zp0';
const ownerChatId = process.env.OWNER_CHAT_ID || '6892665425';
const cashAppTag = process.env.CASHAPP_TAG || 'yxrgk';
const bot = new TelegramBot(token, { polling: true });

const app = express();

// Sample Products with Flavors
const products = [
    {
        id: 1,
        name: 'Modus 2gs',
        description: 'Contains Liquid Diamonds⚠ - High Potency',
        price: 30,
        image: 'https://delta8resellers.com/wp-content/uploads/2023/10/modus-iced-out-le-2g-air-disposable-guava-sherbet.jpg',
        flavors: ['Bubblegum Zelato', 'Guava Sherbet', 'Glitter Bomb'],
    },
    {
        id: 2,
        name: 'Cali Extrax Carts 0.5gs(BOGO)',
        description: 'High Potency⚠(BOGO - Buy One Get One)',
        price: 25,
        image: 'https://delta8resellers.com/wp-content/uploads/2024/03/cali-loose-change-.5g-cartridge-pkg-w-cart.jpg',
        flavors: ['Super Strawberry Haze', 'Tangie Sunrise', 'Platinum Kush'],
    },
    {
        id: 3,
        name: 'Puff Shadow 3gs',
        description: '3 grams of High & Flavorful Potency⚠',
        price: 35,
        image: 'https://delta8resellers.com/wp-content/uploads/2023/11/puff-shadow-3g-disposable-atomic-apple.jpg',
        flavors: ['Atomic Apple', 'Blueberry Dream', 'Citrus Clouds'],
    },
    {
        id: 4,
        name: 'Exodus Mushy 2gs',
        description: 'Contains THC Diamonds⚠ with Mushroom Extract🍄',
        price: 40,
        image: 'https://delta8resellers.com/wp-content/uploads/2023/12/exodus-mushy-vapes-2.2g-disposabe-watermelon-lime.jpg',
        flavors: ['Watermelon Lime', 'Rainbow Belts',"Blueberry Blast"],
    }
];

const userCarts = {};
const orders = {};
const userStates = {};

// Start Express server
app.get('/', (req, res) => {
    res.send('Bot is running...');
});

// Start server on defined PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Your existing functions go here...
function sendInlineMessage(chatId, message, buttons) {
    return bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: buttons,
        },
    });
}

function sendProductDetails(chatId, product) {
    const flavorsList = product.flavors.join(', '); // Join flavors into a single string
    const message = `*${product.name}*\n${product.description}\nPrice: $${product.price}\nFlavors: ${flavorsList}`;
    const buttons = [
        [{ text: 'Add to Cart', callback_data: `add_to_cart_${product.id}` }],
        [{ text: 'Back to Products', callback_data: 'view_products' }]
    ];

    bot.sendPhoto(chatId, product.image, {
        caption: message,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: buttons
        }
    });
}

// Start Command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    sendInlineMessage(chatId,
        `Welcome to our shop! 😵‍💫 Good Prices💲, Discreet Packing & No ID Required🤫.\n` +
        `⚠ *Note:* All products we sell are *purchased* & *dropshipped* 📦✅\n` +
        `🌍 *International Shipping* is available!`, [
        [{ text: '🛒 View Products', callback_data: 'view_products' }],
        [{ text: '❓ Help', callback_data: 'help' }],
        [{ text: '📞 Contact Us', callback_data: 'contact' }]
    ]);
});

// Handling Callbacks
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    try {
        if (query.data.startsWith('select_product_')) {
            const productId = parseInt(query.data.split('_')[2]);
            const product = products.find(p => p.id === productId);
            if (product) {
                sendProductDetails(chatId, product);
            }
        } else if (query.data.startsWith('add_to_cart_')) {
            const productId = parseInt(query.data.split('_')[3]);
            const product = products.find(p => p.id === productId);
            if (product) {
                userStates[chatId] = { action: 'add_to_cart', productId: productId };
                await bot.sendMessage(chatId, `✏️ Please enter the quantity for *${product.name}* (Price: $${product.price}):`, { parse_mode: 'Markdown' });
            }
        } else if (query.data.startsWith('clear_cart')) {
            await clearCart(chatId); // Call clear cart function when button pressed
        } else if (query.data.startsWith('payment_complete_')) {
            const orderId = query.data.split('_')[2];
            await handlePaymentCompletion(orderId, chatId);
        } else {
            switch (query.data) {
                case 'view_products':
                    displayProducts(chatId);
                    break;
                case 'help':
                    sendHelpMessage(chatId);
                    break;
                case 'contact':
                    sendContactInfo(chatId);
                    break;
                case 'checkout':
                    await initiateCheckout(chatId);
                    break;
                case 'view_cart':
                    await viewCart(chatId);
                    break;
                default:
                    await bot.answerCallbackQuery(query.id, { text: 'Unknown action', show_alert: true });
            }
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
        await bot.sendMessage(chatId, '⚠️ An error occurred. Please try again later.');
    }
});

// Handling Text Messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (userStates[chatId]) {
        const { action, step, productId } = userStates[chatId];
        if (action === 'add_to_cart') {
            const quantity = parseInt(text);
            if (!isNaN(quantity) && quantity > 0) {
                const product = products.find(p => p.id === productId);
                await addToCart(chatId, product, quantity);
            } else {
                await bot.sendMessage(chatId, '⚠️ Invalid quantity. Please enter a valid number.');
            }
            delete userStates[chatId]; // Reset user state after processing
        } else if (action === 'collect_shipping') {
            await handleShippingDetails(chatId, text, step);
        }
    }
});

// Function to Display Products
function displayProducts(chatId) {
    const productButtons = products.map(product => ([
        { text: `${product.name} - $${product.price}`, callback_data: `select_product_${product.id}` },
    ]));

    sendInlineMessage(chatId, '🛒 Here are our products:', productButtons);
}

// Function to Send Help Message
function sendHelpMessage(chatId) {
    const helpMessage = `Here are the commands you can use:\n` +
        `/start - Start the bot and see the main menu\n` +
        `/products - View all available products\n` +
        `/viewcart - View your shopping cart\n` +
        `/checkout - Proceed to checkout\n` +
        `/contact - Get owner's contact info\n` +
        `❓ For Bulk inquiries, Contact Us!`;

    bot.sendMessage(chatId, helpMessage);
}

// Function to Send Contact Info
function sendContactInfo(chatId) {
    const contactMessage = `📞 You can reach the owner at:\n` +
        `*Owner's Account:* [Owner's Telegram](tg://user?id=${ownerChatId})`;

    bot.sendMessage(chatId, contactMessage, { parse_mode: 'Markdown' });
}

// Function to Add Products to Cart
async function addToCart(chatId, product, quantity) {
    if (!userCarts[chatId]) {
        userCarts[chatId] = [];
    }

    const existingProductIndex = userCarts[chatId].findIndex(p => p.id === product.id);
    if (existingProductIndex > -1) {
        userCarts[chatId][existingProductIndex].quantity += quantity;
    } else {
        userCarts[chatId].push({ ...product, quantity });
    }

    let bogoMessage = '';
    if (product.id === 2) { // Check for BOGO product
        const bogoQuantity = Math.floor(quantity / 2);
        if (bogoQuantity > 0) {
            const freeProduct = { ...products[1], quantity: bogoQuantity, price: 0 };
            userCarts[chatId].push(freeProduct);
            bogoMessage = `🎉 *Bonus!* You've received *${bogoQuantity}* extra *${products[1].name}* because of our BOGO deal!`;
        }
    }

    await notifyOwner(`🛒 *${product.name}* x${quantity} was added to the cart by user ${chatId}`);
    await bot.sendMessage(chatId, `✅ *${product.name}* x${quantity} has been added to your cart. ${bogoMessage}\nTotal items in cart: ${userCarts[chatId].reduce((acc, item) => acc + item.quantity, 0)}`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🛒 View Cart', callback_data: 'view_cart' }],
                [{ text: '🛍️ Continue Shopping', callback_data: 'view_products' }]
            ]
        }
    });
}

// Function to Notify Owner
async function notifyOwner(message, options = {}) {
    try {
        await bot.sendMessage(ownerChatId, message, { parse_mode: 'Markdown', ...options });
    } catch (error) {
        console.error('Error notifying owner:', error);
    }
}

// View Cart Command
bot.onText(/\/viewcart/, async (msg) => {
    const chatId = msg.chat.id;
    await viewCart(chatId);
});

// Products Command
bot.onText(/\/products/, async (msg) => {
    const chatId = msg.chat.id;
    displayProducts(chatId);
});

// Checkout Command
bot.onText(/\/checkout/, async (msg) => {
    const chatId = msg.chat.id;
    await initiateCheckout(chatId);
});

// Contact Command
bot.onText(/\/contact/, async (msg) => {
    const chatId = msg.chat.id;
    sendContactInfo(chatId);
});

// Function to View Cart
async function viewCart(chatId) {
    const cart = userCarts[chatId] || [];

    if (cart.length === 0) {
        await bot.sendMessage(chatId, '🛒 Your cart is empty.');
    } else {
        const cartMessage = cart.map((item) => `*${item.name}* x${item.quantity} - $${item.price * item.quantity}`).join('\n');
        const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

        await bot.sendMessage(chatId, `🛒 Your Cart:\n${cartMessage}\n\n*Total Price:* $${totalPrice}`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🛍️ Checkout', callback_data: 'checkout' }],
                    [{ text: '🔄 Continue Shopping', callback_data: 'view_products' }],
                    [{ text: '🗑️ Clear Cart', callback_data: 'clear_cart' }]
                ]
            }
        });
    }
}

// Function to Clear Cart
async function clearCart(chatId) {
    if (userCarts[chatId]) {
        delete userCarts[chatId];
        await bot.sendMessage(chatId, '🧹 Your cart has been cleared.');
    } else {
        await bot.sendMessage(chatId, '⚠️ Your cart is already empty.');
    }
}

// Function to Initiate Checkout
async function initiateCheckout(chatId) {
    const cart = userCarts[chatId];
    if (!cart || cart.length === 0) {
        await bot.sendMessage(chatId, '⚠️ Your cart is empty. Add some products before checking out.');
        return;
    }

    userStates[chatId] = { action: 'collect_shipping', step: 'full_name' };
    await bot.sendMessage(chatId, '📦 Let\'s collect your shipping details. Please enter your full name:');
}

// Function to Handle Shipping Details
async function handleShippingDetails(chatId, text, step) {
    const order = orders[chatId] || { shipping: {}, cart: userCarts[chatId] };
    orders[chatId] = order;

    switch (step) {
        case 'full_name':
            order.shipping.fullName = text;
            userStates[chatId].step = 'email';
            await bot.sendMessage(chatId, 'Please enter your email address:');
            break;
        case 'email':
            order.shipping.email = text;
            userStates[chatId].step = 'address';
            await bot.sendMessage(chatId, 'Please enter your address:');
            break;
        case 'address':
            order.shipping.address = text;
            userStates[chatId].step = 'phone';
            await bot.sendMessage(chatId, 'Please enter your phone number:');
            break;
        case 'phone':
            order.shipping.phone = text;
            userStates[chatId].step = 'state';
            await bot.sendMessage(chatId, 'Please enter your state:');
            break;
        case 'state':
            order.shipping.state = text;
            userStates[chatId].step = 'city';
            await bot.sendMessage(chatId, 'Please enter your city:');
            break;
        case 'city':
            order.shipping.city = text;
            userStates[chatId].step = 'zipcode';
            await bot.sendMessage(chatId, 'Please enter your zipcode:');
            break;
        case 'zipcode':
            order.shipping.zipcode = text;
            delete userStates[chatId];
            await processPayment(chatId);
            break;
    }
}

// Function to Process Payment
async function processPayment(chatId) {
    const order = orders[chatId];
    const cart = order.cart;
    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

    const orderId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    order.id = orderId;
    order.totalPrice = totalPrice;
    order.status = 'pending_payment';
    order.chatId = chatId;
    order.timestamp = new Date().toISOString();

    const paymentLink = `https://cash.app/$${cashAppTag}/${totalPrice}`;
    const qrCodeUrl = `https://cash.app/qr/$${cashAppTag}?size=288&margin=0`;

    try {
        await bot.sendPhoto(chatId, qrCodeUrl, {
            caption: `📱 Scan this QR code to pay $${totalPrice} With Cashapp\n` +
                     `Or use this link: ${paymentLink}\n\n` +
                     `🔑 *Important:* Please include the order ID *${orderId}* in your payment note.\n\n` +
                     `Once payment is complete, click the button below.`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ I\'ve Completed Payment', callback_data: `payment_complete_${orderId}` }
                ]]
            }
        });

        await notifyOwner(`🆕 New order pending payment!\nOrder ID: ${orderId}\nUser: ${chatId}\nTotal: $${totalPrice}`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Confirm Order', callback_data: `confirm_order_${orderId}` },
                        { text: '❌ Reject Order', callback_data: `reject_order_${orderId}` }
                    ]
                ]
            }
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        await bot.sendMessage(chatId, '⚠️ An error occurred while processing your payment. Please try again later.');
    }
}

// Function to Handle Payment Completion
async function handlePaymentCompletion(orderId, chatId) {
    const order = Object.values(orders).find(o => o.id === orderId);
    if (order) {
        await bot.sendMessage(chatId, '✅ Thank you for confirming your payment! Your order is being verified.');

        await notifyOwner(`💰 Payment confirmation received for Order ${orderId} from user ${chatId}. Please confirm or reject the payment with buttons below.`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Confirm Order', callback_data: `confirm_order_${orderId}` },
                        { text: '❌ Reject Order', callback_data: `reject_order_${orderId}` }
                    ]
                ]
            }
        });

        const orderDetails = `
        🛒 Order Details (ID: ${orderId}):
        User: ${chatId}
        Total: $${order.totalPrice}
        Timestamp: ${order.timestamp}

        📦 Shipping Information:
        Name: ${order.shipping.fullName}
        Email: ${order.shipping.email}
        Address: ${order.shipping.address}
        Phone: ${order.shipping.phone}
        State: ${order.shipping.state}
        City: ${order.shipping.city}
        Zipcode: ${order.shipping.zipcode}

        🛍️ Items:
        ${order.cart.map(item => `- ${item.name} x${item.quantity} - $${item.price * item.quantity}`).join('\n')}
        `;

        await notifyOwner(orderDetails);
    } else {
        await bot.sendMessage(chatId, '⚠️ Order not found. Please contact support.');
    }
}

// Handle Owner's Callback Queries for Orders Confirmation or Rejection
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;

    if (query.data.startsWith('confirm_order_')) {
        const orderId = query.data.split('_')[2];
        await handleOrderConfirmation(orderId, chatId);
        await bot.answerCallbackQuery(query.id, { text: 'Order has been confirmed!', show_alert: true });
    } else if (query.data.startsWith('reject_order_')) {
        const orderId = query.data.split('_')[2];
        await handleOrderRejection(orderId, chatId);
        await bot.answerCallbackQuery(query.id, { text: 'Order has been rejected!', show_alert: true });
    } else {
        // Other existing callback query handling logic
    }
});

// Function to Handle Order Confirmation
async function handleOrderConfirmation(orderId, chatId) {
    const order = Object.values(orders).find(o => o.id === orderId);
    if (order) {
        order.status = 'confirmed';  // Update order status to confirmed
        await bot.sendMessage(order.chatId, `✅ Your order has been confirmed! Thank you for your purchase! 🎉\n` +
            `📦 You will be provided tracking/order information shortly.\n` +
            `*Order Summary:*\n${order.cart.map(item => `*${item.name}* x${item.quantity} - $${item.price * item.quantity}`).join('\n')}\n` +
            `Total Price: $${order.totalPrice}`, { parse_mode: 'Markdown' });

        await bot.sendMessage(ownerChatId, `📦 Order ${orderId} has been confirmed for user ${order.chatId}.`);
        delete userCarts[order.chatId];
        delete orders[orderId];
    } else {
        await bot.sendMessage(chatId, '⚠️ Order not found.');
    }
}

// Function to Handle Order Rejection
async function handleOrderRejection(orderId, chatId) {
    const order = Object.values(orders).find(o => o.id === orderId);
    if (order) {
        await bot.sendMessage(order.chatId, `❌ Your order has been cancelled. If you have any questions, please contact us.`);
        await bot.sendMessage(ownerChatId, `📦 Order ${orderId} has been cancelled for user ${order.chatId}.`);
        delete orders[orderId];
    } else {
        await bot.sendMessage(chatId, '⚠️ Order not found.');
    }
}

// Start the Bot
console.log('Bot is running...');
