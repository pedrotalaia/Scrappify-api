    const Favorite = require('../models/Favorite');
    const Notification = require('../models/Notification');
    const Product = require('../models/Product');

    const checkAndTriggerAlerts = async (productId, newPrice) => {
        try {
            const favorites = await Favorite.find({ productId });
            if (!favorites || favorites.length === 0) return;

            const product = await Product.findById(productId);
            if (!product || product.prices.length < 2) return;

            const oldPrice = product.prices[product.prices.length - 2].value;
            const priceChange = newPrice - oldPrice;

            for (const favorite of favorites) {
                const { userId, alerts } = favorite;

                for (const alert of alerts) {
                    let shouldTrigger = false;
                    let message = '';

                    switch (alert.type) {
                        case 'price_changed':
                            if (newPrice !== oldPrice) {
                                shouldTrigger = true;
                                message = `${product.name} mudou de ${oldPrice}€ para ${newPrice}€`;
                            }
                            break;
                        case 'price_dropped':
                            if (priceChange < 0) {
                                shouldTrigger = true;
                                message = `${product.name} desceu de ${oldPrice}€ para ${newPrice}€`;
                            }
                            break;
                        case 'price_increased':
                            if (priceChange > 0) {
                                shouldTrigger = true;
                                message = `${product.name} subiu de ${oldPrice}€ para ${newPrice}€`;
                            }
                            break;
                        case 'price_dropped_percent':
                            if (priceChange < 0 && (Math.abs(priceChange) / oldPrice * 100) >= alert.value) {
                                shouldTrigger = true;
                                message = `${product.name} desceu ${Math.abs(priceChange)}€ (${(Math.abs(priceChange) / oldPrice * 100).toFixed(2)}%)`;
                            }
                            break;
                        case 'price_increased_percent':
                            if (priceChange > 0 && (priceChange / oldPrice * 100) >= alert.value) {
                                shouldTrigger = true;
                                message = `${product.name} subiu ${priceChange}€ (${(priceChange / oldPrice * 100).toFixed(2)}%)`;
                            }
                            break;
                        case 'price_below':
                            if (newPrice < alert.value) {
                                shouldTrigger = true;
                                message = `${product.name} está abaixo de ${alert.value}€ (agora ${newPrice}€)`;
                            }
                            break;
                        case 'price_above':
                            if (newPrice > alert.value) {
                                shouldTrigger = true;
                                message = `${product.name} está acima de ${alert.value}€ (agora ${newPrice}€)`;
                            }
                            break;
                        case 'price_change_absolute':
                            if (Math.abs(priceChange) >= alert.value) {
                                shouldTrigger = true;
                                message = `${product.name} mudou ${Math.abs(priceChange)}€ (agora ${newPrice}€)`;
                            }
                            break;
                        case 'price_historic_low':
                            const minPrice = Math.min(...product.prices.map(p => p.value));
                            if (newPrice === minPrice && newPrice < oldPrice) {
                                shouldTrigger = true;
                                message = `${product.name} atingiu o menor preço histórico: ${newPrice}€`;
                            }
                            break;
                        // FALTA O CASO DO STOCK, AINDA VER COMO FAZER
                    }

                    if (shouldTrigger) {
                        const notification = new Notification({
                            userId,
                            productId,
                            message,
                            read: false
                        });
                        await notification.save();
                        // FALTA ENVIAR PARA O EMAIL PARA OS PLANOS PREMIUM.
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

    const markNotificationRead = async (req, res) => {
        const userId = req.user.id;
        const { id } = req.params;

        try {
            const notification = await Notification.findOne({ _id: id, userId });
            if (!notification) {
                return res.status(404).json({ msg: 'Notificação não encontrada' });
            }

            notification.read = true;
            await notification.save();

            res.status(200).json({ msg: 'Notificação marcada como lida', notification });
        } catch (error) {
            res.status(500).json({ msg: 'Erro no servidor', error: error.message });
        }
    }

    module.exports = { 
        checkAndTriggerAlerts,
        getUserNotifications,
        markNotificationRead
    };