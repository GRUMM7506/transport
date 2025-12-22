/**
 * data.js
 * Модуль для работы с данными остановок и маршрутов
 */

const DataManager = {
    // Хранилища данных
    stops: [],
    routes: [],
    keyPoints: {},
    allKeyPoints: {},
    
    // Индексы для быстрого поиска
    stopById: new Map(),
    stopByName: new Map(),
    routesByStop: new Map(),

    /**
     * Загрузка всех данных
     */
    async loadAllData() {
        try {
            ConfigHelper.log('Начало загрузки данных...');
            
            // Загружаем основные данные
            const mainData = await this.loadJSON(CONFIG.DATA_FILES.MAIN);
            this.stops = (mainData.bus_stops || [])
                .map(stop => ({
                    ...stop,
                    // Гарантируем, что это числа
                    latitude: parseFloat(stop.latitude),
                    longitude: parseFloat(stop.longitude)
                }))
                .filter(stop => 
                    // Убираем NaN, null и нулевые координаты (выбросы)
                    !isNaN(stop.latitude) && 
                    !isNaN(stop.longitude) && 
                    stop.latitude > 30 && // Грубая проверка, что мы где-то в правильной широте
                    stop.longitude > 60   // И долготе
                );
            this.routes = mainData.bus_routes || [];
            
            ConfigHelper.log(`Загружено остановок: ${this.stops.length}`);
            ConfigHelper.log(`Загружено маршрутов: ${this.routes.length}`);
            
            // Загружаем ключевые точки
            try {
                const keyPointsData = await this.loadJSON(CONFIG.DATA_FILES.KEY_POINTS);
                this.keyPoints = keyPointsData.key_points || {};
                ConfigHelper.log(`Загружено ключевых точек маршрутов: ${Object.keys(this.keyPoints).length}`);
            } catch (e) {
                ConfigHelper.warn('Не удалось загрузить key points:', e.message);
            }

            // Загружаем все ключевые точки
            try {
                const allKeyPointsData = await this.loadJSON(CONFIG.DATA_FILES.ALL_KEY_POINTS);
                this.allKeyPoints = allKeyPointsData.stops || [];
                ConfigHelper.log(`Загружено базовых точек: ${this.allKeyPoints.length}`);
            } catch (e) {
                ConfigHelper.warn('Не удалось загрузить all key points:', e.message);
            }
            
            // Строим индексы
            this.buildIndexes();
            
            ConfigHelper.log('Все данные успешно загружены');
            return true;
        } catch (error) {
            ConfigHelper.error('Ошибка загрузки данных:', error);
            throw error;
        }
    },

    /**
     * Загрузка JSON файла
     */
    async loadJSON(url) {
        try {
            ConfigHelper.log('Загрузка файла:', url);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            ConfigHelper.log(`Файл загружен: ${url}`);
            return data;
            
        } catch (error) {
            ConfigHelper.error(`Ошибка загрузки ${url}:`, error);
            
            // Если не удалось загрузить, используем минимальные тестовые данные
            ConfigHelper.warn('Использование резервных данных');
            return {
                bus_stops: [
                    {id: 1000, name: "Улица Гагарина", latitude: 38.619821, longitude: 68.77741, routes: "17,b1,b17,b18,b22,m17"},
                    {id: 1001, name: "Рынок Барзоб", latitude: 38.616789, longitude: 68.781125, routes: "17,b1,b17,b18,b22,m17"},
                    {id: 1002, name: "Площадь Пограничников", latitude: 38.614719, longitude: 68.783884, routes: "b1,b17,b18,b22,b33,b3a,b41,m1,m12"},
                    {id: 1003, name: "Таможный", latitude: 38.56889686130528, longitude: 68.78567566865574, routes: "m11,m2,m25,b11"}
                ],
                bus_routes: []
            };
        }
    },

    /**
     * Построение индексов для быстрого поиска
     */
    buildIndexes() {
        ConfigHelper.log('Построение индексов...');
        
        // Индекс остановок по ID
        this.stops.forEach(stop => {
            this.stopById.set(stop.id, stop);
            
            // Нормализуем имя для поиска
            const normalizedName = this.normalizeName(stop.name);
            if (!this.stopByName.has(normalizedName)) {
                this.stopByName.set(normalizedName, []);
            }
            this.stopByName.get(normalizedName).push(stop);
            
            // Парсим маршруты
            if (stop.routes) {
                stop.routesList = typeof stop.routes === 'string' 
                    ? stop.routes.split(',').map(r => r.trim())
                    : stop.routes;
            } else {
                stop.routesList = [];
            }
        });
        
        // Индекс маршрутов и обработка путей
        this.routes.forEach((route, index) => {
            // Добавляем цвет если его нет
            if (!route.color) {
                route.color = ConfigHelper.getRouteColor(index);
            }
            
            // Определяем тип транспорта если не указан
            if (!route.transportType && route.name) {
                // Извлекаем номер маршрута из названия
                const match = route.name.match(/^(\w+)\s/);
                if (match) {
                    const routeNum = match[1];
                    route.transportType = ConfigHelper.getTransportType(routeNum);
                }
            }
            
            // Обрабатываем path если есть
            if (route.path && Array.isArray(route.path)) {
                route.processedPath = this.processRoutePath(route.path);
            }
            
            // Связываем маршрут с остановками через key_points
            if (route.name && this.keyPoints[route.name]) {
                route.keyPointsData = this.keyPoints[route.name];
                route.stopsList = this.extractStopsFromKeyPoints(route.keyPointsData);
            }
        });
        
        // Строим индекс маршрутов по остановкам
        this.buildRoutesByStopIndex();
        
        ConfigHelper.log('Индексы построены');
    },

    /**
     * Обработка пути маршрута (упрощение для производительности)
     */
    processRoutePath(path) {
        if (!path || path.length === 0) return [];
        
        // Упрощаем путь для оптимизации отрисовки
        // Используем алгоритм Douglas-Peucker через Utils
        const simplified = Utils.simplifyPath(path, 2);
        
        return simplified;
    },

    /**
     * Извлечение списка остановок из key points
     */
    extractStopsFromKeyPoints(keyPoints) {
        if (!Array.isArray(keyPoints)) return [];
        
        return keyPoints.map(kp => {
            // Ищем остановку по имени или координатам
            let stop = this.getStopsByName(kp.stopName)[0];
            
            if (!stop && kp.basePoint) {
                stop = this.findStopByCoords(
                    kp.basePoint.latitude,
                    kp.basePoint.longitude,
                    0.0005 // Допуск 50 метров
                );
            }
            
            return stop || {
                name: kp.stopName,
                latitude: kp.basePoint?.latitude,
                longitude: kp.basePoint?.longitude,
                isVirtual: true // Помечаем как виртуальную остановку
            };
        }).filter(s => s);
    },

    /**
     * Построение индекса маршрутов по остановкам
     */
    buildRoutesByStopIndex() {
        this.routes.forEach(route => {
            if (route.stopsList) {
                route.stopsList.forEach(stop => {
                    const stopId = stop.id || stop.name;
                    if (!this.routesByStop.has(stopId)) {
                        this.routesByStop.set(stopId, []);
                    }
                    this.routesByStop.get(stopId).push(route);
                });
            }
        });
    },

    /**
     * Нормализация имени для поиска
     */
    normalizeName(name) {
        return name.toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/\s+/g, ' ')
            .trim();
    },

    /**
     * Поиск остановок по запросу
     */
    searchStops(query) {
        if (!query || query.length < CONFIG.SEARCH.MIN_QUERY_LENGTH) {
            return [];
        }
        
        const normalizedQuery = this.normalizeName(query);
        const results = [];
        
        this.stops.forEach(stop => {
            const normalizedName = this.normalizeName(stop.name);
            if (normalizedName.includes(normalizedQuery)) {
                results.push({
                    ...stop,
                    relevance: this.calculateRelevance(normalizedName, normalizedQuery)
                });
            }
        });
        
        // Сортируем по релевантности
        results.sort((a, b) => b.relevance - a.relevance);
        
        return results.slice(0, CONFIG.SEARCH.MAX_RESULTS);
    },

    /**
     * Вычисление релевантности результата поиска
     */
    calculateRelevance(name, query) {
        // Точное совпадение
        if (name === query) return 1000;
        
        // Начинается с запроса
        if (name.startsWith(query)) return 500;
        
        // Содержит запрос
        const index = name.indexOf(query);
        if (index !== -1) return 100 - index;
        
        return 0;
    },

    /**
     * Получить остановку по ID
     */
    getStopById(id) {
        return this.stopById.get(id);
    },

    /**
     * Получить остановки по имени
     */
    getStopsByName(name) {
        const normalized = this.normalizeName(name);
        return this.stopByName.get(normalized) || [];
    },

    /**
     * Получить все маршруты, проходящие через остановку
     */
    getRoutesByStop(stopId) {
        const stop = this.getStopById(stopId);
        if (!stop || !stop.routesList) return [];
        
        return stop.routesList.map(routeNum => {
            return this.routes.find(r => r.name.includes(routeNum));
        }).filter(Boolean);
    },

    /**
     * Получить информацию о маршруте
     */
    getRouteInfo(routeId) {
        return this.routes.find(r => r.id === routeId);
    },

    /**
     * Получить все остановки маршрута по его названию
     */
    getRouteStops(routeName) {
        const keyPointsList = this.keyPoints[routeName];
        if (!keyPointsList) return [];
        
        return keyPointsList.map(kp => {
            // Ищем остановку по координатам или имени
            return this.findStopByCoords(kp.basePoint.latitude, kp.basePoint.longitude) ||
                   this.getStopsByName(kp.stopName)[0];
        }).filter(Boolean);
    },

    /**
     * Найти остановку по координатам (с небольшой погрешностью)
     */
    findStopByCoords(lat, lng, tolerance = 0.001) {
        return this.stops.find(stop => {
            return Math.abs(stop.latitude - lat) < tolerance &&
                   Math.abs(stop.longitude - lng) < tolerance;
        });
    },

    /**
     * Получить статистику
     */
    getStats() {
        return {
            totalStops: this.stops.length,
            totalRoutes: this.routes.length,
            avgRoutesPerStop: this.stops.reduce((sum, s) => 
                sum + (s.routesList?.length || 0), 0) / this.stops.length
        };
    },

    /**
     * Экспорт данных для отладки
     */
    exportData() {
        return {
            stops: this.stops,
            routes: this.routes,
            stats: this.getStats()
        };
    }
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}