/**
 * config.js
 * Конфигурация приложения и константы
 */

const CONFIG = {
    // Пути к файлам данных
    DATA_FILES: {
        MAIN: 'data/main.json',
        KEY_POINTS: 'data/key_points.json',
        ALL_KEY_POINTS: 'data/all_key_points.json'
    },

    // Настройки карты - УЛУЧШЕНО
    MAP: {
        PADDING: 100,
        MIN_ZOOM: 0.5,
        MAX_ZOOM: 15,              // УВЕЛИЧИЛ с 8 до 15!
        ZOOM_STEP: 1.3,
        DOUBLE_CLICK_ZOOM: 2,
        PATH_SIMPLIFICATION_TOLERANCE: 3, // НОВОЕ: для упрощения путей маршрутов
        ANIMATION_DURATION: 300,
        RESOLUTION: 800            // НОВОЕ: для управления детализацией отрисовки
    },

    // Визуальные настройки - УЛУЧШЕНО
    VISUAL: {
        // Размеры элементов
        STOP_RADIUS: 3,            // УМЕНЬШИЛ с 4 до 3
        STOP_RADIUS_HOVER: 5,      // УМЕНЬШИЛ с 6 до 5
        STOP_RADIUS_SELECTED: 7,   // УМЕНЬШИЛ с 8 до 7
        STOP_RADIUS_HIGHLIGHTED: 6, // НОВОЕ: для остановок выбранного маршрута
        
        // Линии маршрутов
        ROUTE_WIDTH: 3,
        ROUTE_WIDTH_HOVER: 6,
        ROUTE_WIDTH_HIGHLIGHTED: 5, // НОВОЕ: для выбранного маршрута
        ROUTE_OFFSET: 6,
        
        // Цвета типов транспорта
        TRANSPORT_COLORS: {
            bus: '#E91E63',         // Автобус - розовый
            minibus: '#2196F3',     // Маршрутка - синий
            trolleybus: '#4CAF50',  // Троллейбус - зеленый
            default: '#9C27B0'      // По умолчанию - фиолетовый
        },

        // Цветовая палитра для маршрутов
        ROUTE_COLORS: [
            '#E91E63', '#9C27B0', '#3F51B5', '#2196F3', 
            '#00BCD4', '#4CAF50', '#8BC34A', '#CDDC39',
            '#FF9800', '#FF5722', '#795548', '#607D8B'
        ],

        // Стили текста - УЛУЧШЕНО
        LABEL_SIZE: 9,             // УМЕНЬШИЛ с 11 до 9
        LABEL_OFFSET_X: 10,        // УМЕНЬШИЛ с 12 до 10
        LABEL_OFFSET_Y: -6,        // УМЕНЬШИЛ с -8 до -6
        LABEL_MIN_ZOOM: 4.0,       // УВЕЛИЧИЛ с 3.0 до 4.0
        LABEL_MIN_DISTANCE: 150,   // УВЕЛИЧИЛ с 100 до 150

        // Пешеходные переходы
        WALKING_LINE_DASH: '5,5',
        WALKING_COLOR: '#999999',
        WALKING_WIDTH: 2
    },

    // Настройки поиска
    SEARCH: {
        MIN_QUERY_LENGTH: 2,
        DEBOUNCE_DELAY: 300,
        MAX_RESULTS: 50
    },

    // Настройки маршрутизации
    ROUTING: {
        TRANSFER_PENALTY: 3,
        WALKING_SPEED: 5,
        MAX_WALKING_DISTANCE: 300,
        AVERAGE_STOP_TIME: 1
    },

    // Префиксы типов транспорта - ИСПРАВЛЕНО
    TRANSPORT_TYPE_PREFIX: {
        'b': 'bus',       // b1, b17 - автобусы
        'm': 'minibus',   // m1, m12 - маршрутки
        't': 'trolleybus' // троллейбусы
    },

    // НОВОЕ: маршруты которые являются автобусами (без префикса b)
    BUS_ROUTES_WITHOUT_PREFIX: ['17', '18', '22', '33', '41'], // Известные автобусные маршруты

    // Названия типов для UI
    TRANSPORT_TYPE_NAMES: {
        'bus': 'Автобус',
        'minibus': 'Маршрутка',
        'trolleybus': 'Троллейбус',
        'default': 'Транспорт'
    },

    // Сообщения
    MESSAGES: {
        LOADING: 'Загрузка данных...',
        ERROR_LOAD: 'Ошибка загрузки данных',
        NO_RESULTS: 'Ничего не найдено',
        NO_ROUTE: 'Маршрут не найден',
        EMPTY_SEARCH: 'Начните вводить название остановки',
        SELECT_STOPS: 'Выберите начальную и конечную остановки'
    },

    // Дебаг режим
    DEBUG: true
};

// Вспомогательные функции для работы с конфигом
const ConfigHelper = {
    /**
     * Получить цвет для маршрута по его индексу
     */
    getRouteColor(index) {
        const colors = CONFIG.VISUAL.ROUTE_COLORS;
        return colors[index % colors.length];
    },

    /**
     * ИСПРАВЛЕНО: Определить тип транспорта по номеру маршрута
     */
    getTransportType(routeNumber) {
        if (!routeNumber) return 'minibus';
        
        const routeStr = routeNumber.toString().toLowerCase();
        const firstChar = routeStr[0];
        
        // Проверяем префикс
        if (CONFIG.TRANSPORT_TYPE_PREFIX[firstChar]) {
            return CONFIG.TRANSPORT_TYPE_PREFIX[firstChar];
        }
        
        // НОВОЕ: Проверяем список известных автобусов без префикса
        const cleanNumber = routeStr.replace(/[^\d]/g, '');
        if (CONFIG.BUS_ROUTES_WITHOUT_PREFIX.includes(cleanNumber)) {
            return 'bus';
        }
        
        // По умолчанию - маршрутка
        return 'minibus';
    },

    /**
     * Получить название типа транспорта
     */
    getTransportTypeName(type) {
        return CONFIG.TRANSPORT_TYPE_NAMES[type] || CONFIG.TRANSPORT_TYPE_NAMES.default;
    },

    /**
     * Получить цвет по типу транспорта
     */
    getColorByType(type) {
        return CONFIG.VISUAL.TRANSPORT_COLORS[type] || 
               CONFIG.VISUAL.TRANSPORT_COLORS.default;
    },

    /**
     * Логирование с проверкой DEBUG режима
     */
    log(...args) {
        if (CONFIG.DEBUG) {
            console.log('[Transport App]', ...args);
        }
    },

    /**
     * Логирование ошибок
     */
    error(...args) {
        console.error('[Transport App ERROR]', ...args);
    },

    /**
     * Логирование предупреждений
     */
    warn(...args) {
        if (CONFIG.DEBUG) {
            console.warn('[Transport App WARN]', ...args);
        }
    }
};

// Экспортируем для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, ConfigHelper };
}