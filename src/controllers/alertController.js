const Favorite = require('../models/Favorite');
const Notification = require('../models/Notification');
const Product = require('../models/Product');
const User = require('../models/Users');
const messaging = require('../config/firebaseConfig');

const checkAndTriggerAlerts = async (productId, newPrice) => {
    try {
        const favorites = await Favorite.find({ productId, isActive: true });
        if (!favorites || favorites.length === 0) return;

        const product = await Product.findById(productId);
        if (!product || product.offers.length === 0) return;

        const offer = product.offers[product.offers.length - 1];
        const prices = offer.prices;
        if (prices.length < 2) return;

        const oldPrice = prices[prices.length - 2].value;
        const priceChange = newPrice - oldPrice;

        for (let i = 0; i < favorites.length; i++) {
            const favorite = favorites[i];
            const userId = favorite.userId;
            const alerts = favorite.alerts;

            for (let k = 0; k < alerts.length; k++) {
                const alert = alerts[k];
                let shouldTrigger = false;
                let message = '';

                if (alert.type === 'price_changed') {
                    if (newPrice !== oldPrice) {
                        shouldTrigger = true;
                        message = `${product.name} mudou de ${oldPrice}€ para ${newPrice}€`;
                    }
                }
                else if (alert.type === 'price_dropped') {
                    if (priceChange < 0) {
                        shouldTrigger = true;
                        message = `${product.name} caiu de ${oldPrice}€ para ${newPrice}€`;
                    }
                }
                else if (alert.type === 'price_increased') {
                    if (priceChange > 0) {
                        shouldTrigger = true;
                        message = `${product.name} subiu de ${oldPrice}€ para ${newPrice}€`;
                    }
                }
                else if (alert.type === 'price_dropped_percent') {
                    if (priceChange < 0 && (Math.abs(priceChange) / oldPrice * 100) >= alert.value) {
                        shouldTrigger = true;
                        message = `${product.name} caiu ${Math.abs(priceChange)}€ (${(Math.abs(priceChange) / oldPrice * 100).toFixed(2)}%)`;
                    }
                }
                else if (alert.type === 'price_increased_percent') {
                    if (priceChange > 0 && (priceChange / oldPrice * 100) >= alert.value) {
                        shouldTrigger = true;
                        message = `${product.name} subiu ${priceChange}€ (${(priceChange / oldPrice * 100).toFixed(2)}%)`;
                    }
                }
                else if (alert.type === 'price_below') {
                    if (newPrice < alert.value) {
                        shouldTrigger = true;
                        message = `${product.name} está abaixo de ${alert.value}€ (agora ${newPrice}€)`;
                    }
                }
                else if (alert.type === 'price_above') {
                    if (newPrice > alert.value) {
                        shouldTrigger = true;
                        message = `${product.name} está acima de ${alert.value}€ (agora ${newPrice}€)`;
                    }
                }
                else if (alert.type === 'price_change_absolute') {
                    if (Math.abs(priceChange) >= alert.value) {
                        shouldTrigger = true;
                        message = `${product.name} mudou ${Math.abs(priceChange)}€ (agora ${newPrice}€)`;
                    }
                }
                else if (alert.type === 'price_historic_low') {
                    let minPrice = prices[0].value;
                    for (let p = 1; p < prices.length; p++) {
                        if (prices[p].value < minPrice) minPrice = prices[p].value;
                    }
                    if (newPrice === minPrice && newPrice < oldPrice) {
                        shouldTrigger = true;
                        message = `${product.name} atingiu o menor preço histórico: ${newPrice}€`;
                    }
                }

                if (shouldTrigger) {
                    const notification = new Notification({
                        userId,
                        productId,
                        message,
                        read: false
                    });
                    await notification.save();

                    const user = await User.findById(userId);
                    if(user && user.device_tokens.length > 0){
                        const tokens = user.device_tokens.map(dt => dt.token);
                        
                        const payload = {
                            notification:{
                            title: 'Atualização de Produto',
                            body: message,
                        },
                        tokens,
                        };
                        try{
                            await messaging.sendEachForMulticast(payload);
                        }catch (fcmError) {
                            console.error('Erro ao enviar notificação push:', fcmError.message);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erro ao verificar alertas:', error.message);
    }
};

const getUserNotifications = async (req, res) => {
    const userId = req.user.id;

    try {
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 });

        if (!notifications || notifications.length === 0) {
            return res.status(200).json({ msg: 'Nenhuma notificação encontrada', notifications: [] });
        }

        res.status(200).json({ msg: 'Notificações listadas com sucesso', notifications });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

const markNotificationAsRead = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const notification = await Notification.findOne({ _id: id, userId });
        if (!notification) return res.status(404).json({ msg: 'Notificação não encontrada' });

        notification.read = true;
        await notification.save();

        res.status(200).json({ msg: 'Notificação marcada como lida', notification });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

module.exports = { checkAndTriggerAlerts, getUserNotifications, markNotificationAsRead };