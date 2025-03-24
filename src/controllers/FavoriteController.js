const Favorite = require('../models/Favorite');
const User = require('../models/Users');

const ALERT_TYPES = [
    'price_changed', 'price_dropped', 'price_increased',
    'price_dropped_percent', 'price_increased_percent',
    'price_below', 'price_above', 'price_change_absolute',
    'stock_available', 'price_historic_low'
];

const FREEMIUM_ALERTS = ['price_changed', 'price_dropped', 'price_increased'];

const countFavorite = async (req, res) => {
    const userId = req.user.id;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

        const favoriteCount = await Favorite.countDocuments({ userId });
        res.json({ count: favoriteCount });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

const addFavorite = async (req, res) => {
    const userId = req.user.id;
    const { productId, alerts } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

        const favoriteCount = await Favorite.countDocuments({ userId });
        if (user.plan === 'freemium' && favoriteCount >= 5) {
            return res.status(403).json({ msg: 'Limite de 5 favoritos atingido. Atualize para premium!' });
        }

        if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
            return res.status(400).json({ msg: 'Pelo menos um alerta é necessário' });
        }

        if (user.plan === 'freemium' && alerts.length > 1) {
            return res.status(403).json({ msg: 'Plano freemium permite apenas 1 alerta por favorito' });
        }

        for (const alert of alerts) {
            if (!ALERT_TYPES.includes(alert.type)) {
                return res.status(400).json({ msg: `Tipo de alerta inválido: ${alert.type}` });
            }
            if (user.plan === 'freemium' && !FREEMIUM_ALERTS.includes(alert.type)) {
                return res.status(403).json({ msg: 'Apenas alertas básicos são permitidos no plano freemium' });
            }
            if (['price_dropped_percent', 'price_increased_percent', 'price_below', 'price_above', 'price_change_absolute'].includes(alert.type) && !alert.value) {
                return res.status(400).json({ msg: `O alerta ${alert.type} requer um valor` });
            }
        }

        const existingFavorite = await Favorite.findOne({ userId, productId });
        if (existingFavorite) {
            return res.status(400).json({ msg: 'Este produto já está nos seus favoritos' });
        }

        const favorite = new Favorite({
            userId,
            productId,
            alerts
        });
        await favorite.save();

        res.status(201).json({ msg: 'Produto adicionado aos favoritos', favorite });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

const listFavorites = async (req, res) => {
    const userId = req.user.id;

    try {
        const favorites = await Favorite.find({ userId })
            .populate('productId', 'name source url prices');

        if (!favorites || favorites.length === 0) {
            return res.status(200).json({ msg: 'Nenhum favorito encontrado', favorites: [] });
        }

        res.status(200).json({ msg: 'Favoritos listados com sucesso', favorites });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

const removeFavorite = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const favorite = await Favorite.findOne({ _id: id, userId });
        if (!favorite) {
            return res.status(404).json({ msg: 'Favorito não encontrado' });
        }

        await Favorite.deleteOne({ _id: id, userId });
        res.status(200).json({ msg: 'Favorito removido com sucesso' });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

const updateFavorite = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { alerts } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'Utilizador não encontrado' });

        const favorite = await Favorite.findOne({ _id: id, userId });
        if (!favorite) {
            return res.status(404).json({ msg: 'Favorito não encontrado' });
        }

        if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
            return res.status(400).json({ msg: 'Pelo menos um alerta é necessário' });
        }

        if (user.plan === 'freemium' && alerts.length > 1) {
            return res.status(403).json({ msg: 'Plano freemium permite apenas 1 alerta por favorito' });
        }

        for (const alert of alerts) {
            if (!ALERT_TYPES.includes(alert.type)) {
                return res.status(400).json({ msg: `Tipo de alerta inválido: ${alert.type}` });
            }
            if (user.plan === 'freemium' && !FREEMIUM_ALERTS.includes(alert.type)) {
                return res.status(403).json({ msg: 'Apenas alertas básicos são permitidos no plano freemium' });
            }
            if (['price_dropped_percent', 'price_increased_percent', 'price_below', 'price_above', 'price_change_absolute'].includes(alert.type) && !alert.value) {
                return res.status(400).json({ msg: `O alerta ${alert.type} requer um valor` });
            }
        }

        favorite.alerts = alerts;
        await favorite.save();

        res.status(200).json({ msg: 'Favorito atualizado com sucesso', favorite });
    } catch (error) {
        res.status(500).json({ msg: 'Erro no servidor', error: error.message });
    }
};

module.exports = {
    countFavorite,
    addFavorite,
    listFavorites,
    removeFavorite,
    updateFavorite
};