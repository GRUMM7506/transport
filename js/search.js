/**
 * search.js
 * Модуль для поиска остановок
 */

const SearchManager = {
    // DOM элементы
    searchInput: null,
    searchResults: null,
    filterButtons: null,
    
    // Состояние
    currentFilter: 'all',
    currentQuery: '',
    
    /**
     * Инициализация поиска
     */
    init() {
        ConfigHelper.log('Инициализация поиска...');
        
        this.searchInput = document.getElementById('searchInput');
        this.searchResults = document.getElementById('searchResults');
        
        if (!this.searchInput || !this.searchResults) {
            ConfigHelper.error('Элементы поиска не найдены');
            return false;
        }
        
        // Настраиваем обработчики
        this.setupEventListeners();
        
        ConfigHelper.log('Поиск инициализирован');
        return true;
    },

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Поиск с debounce
        const debouncedSearch = Utils.debounce(
            (query) => this.performSearch(query),
            CONFIG.SEARCH.DEBOUNCE_DELAY
        );
        
        this.searchInput.addEventListener('input', (e) => {
            this.currentQuery = e.target.value;
            debouncedSearch(this.currentQuery);
        });
        
        // Фильтры транспорта
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setFilter(btn.dataset.type);
            });
        });
        
        // Enter для быстрого выбора первого результата
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const firstResult = this.searchResults.querySelector('.stop-item');
                if (firstResult) {
                    firstResult.click();
                }
            }
        });
    },

    /**
     * Установка фильтра типа транспорта
     */
    setFilter(type) {
        this.currentFilter = type;
        
        // Обновляем активную кнопку
        this.filterButtons.forEach(btn => {
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Перезапускаем поиск с текущим запросом
        if (this.currentQuery) {
            this.performSearch(this.currentQuery);
        }
    },

    /**
     * Выполнение поиска
     */
    performSearch(query) {
        ConfigHelper.log('Поиск:', query);
        
        // Пустой запрос
        if (!query || query.length < CONFIG.SEARCH.MIN_QUERY_LENGTH) {
            this.showEmptyState();
            return;
        }
        
        // Получаем результаты из DataManager
        let results = DataManager.searchStops(query);
        
        // Применяем фильтр по типу транспорта
        if (this.currentFilter !== 'all') {
            results = this.filterByTransportType(results, this.currentFilter);
        }
        
        // Отображаем результаты
        this.displayResults(results);
    },

    /**
     * Фильтрация по типу транспорта
     */
    filterByTransportType(stops, type) {
        return stops.filter(stop => {
            if (!stop.routesList) return false;
            
            return stop.routesList.some(route => {
                const transportType = ConfigHelper.getTransportType(route);
                
                if (type === 'bus') {
                    return transportType === 'bus';
                } else if (type === 'minibus') {
                    return transportType === 'minibus';
                }
                
                return false;
            });
        });
    },

    /**
     * ИСПРАВЛЕНО: Группировка маршрутов по типу
     */
    groupRoutesByType(routes) {
        const groups = {
            bus: [],
            minibus: [],
            trolleybus: [],
            default: []
        };
        
        routes.forEach(route => {
            const type = ConfigHelper.getTransportType(route);
            if (groups[type]) {
                groups[type].push(route);
            } else {
                groups.default.push(route);
            }
        });
        
        return groups;
    },

    /**
     * Отображение результатов поиска
     */
    displayResults(results) {
        if (results.length === 0) {
            this.showNoResults();
            return;
        }
        
        this.searchResults.innerHTML = results.map(stop => 
            this.createStopItemHTML(stop)
        ).join('');
        
        // Добавляем обработчики кликов
        this.searchResults.querySelectorAll('.stop-item').forEach((item, idx) => {
            item.addEventListener('click', () => {
                this.selectStop(results[idx]);
            });
        });
    },

    /**
     * ИСПРАВЛЕНО: Создание HTML для элемента остановки с группировкой маршрутов
     */
    createStopItemHTML(stop) {
        const routes = stop.routesList || [];
        
        // Группируем маршруты по типу
        const grouped = this.groupRoutesByType(routes);
        
        // Создаем бейджи с сортировкой: сначала автобусы, потом маршрутки
        const allBadges = [];
        
        // Автобусы (b prefix)
        if (grouped.bus.length > 0) {
            grouped.bus.sort((a, b) => {
                const numA = parseInt(a.replace(/[^\d]/g, '')) || 0;
                const numB = parseInt(b.replace(/[^\d]/g, '')) || 0;
                return numA - numB;
            });
            
            allBadges.push(...grouped.bus.map(r => Utils.getRouteBadgeHTML(r)));
        }
        
        // Маршрутки (m prefix или без префикса)
        if (grouped.minibus.length > 0) {
            grouped.minibus.sort((a, b) => {
                const numA = parseInt(a.replace(/[^\d]/g, '')) || 0;
                const numB = parseInt(b.replace(/[^\d]/g, '')) || 0;
                return numA - numB;
            });
            
            allBadges.push(...grouped.minibus.map(r => Utils.getRouteBadgeHTML(r)));
        }
        
        // Троллейбусы (t prefix)
        if (grouped.trolleybus.length > 0) {
            grouped.trolleybus.sort((a, b) => {
                const numA = parseInt(a.replace(/[^\d]/g, '')) || 0;
                const numB = parseInt(b.replace(/[^\d]/g, '')) || 0;
                return numA - numB;
            });
            
            allBadges.push(...grouped.trolleybus.map(r => Utils.getRouteBadgeHTML(r)));
        }
        
        // Остальные
        if (grouped.default.length > 0) {
            allBadges.push(...grouped.default.map(r => Utils.getRouteBadgeHTML(r)));
        }
        
        const routeBadges = allBadges.join('');
        
        return `
            <div class="stop-item" data-stop-id="${stop.id}">
                <div class="stop-name">${this.highlightQuery(stop.name)}</div>
                ${routes.length > 0 ? `
                    <div class="stop-routes">
                        ${routeBadges}
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Подсветка найденного текста
     */
    highlightQuery(text) {
        if (!this.currentQuery) return text;
        
        const regex = new RegExp(`(${this.escapeRegex(this.currentQuery)})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    },

    /**
     * Экранирование спецсимволов для регулярки
     */
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    /**
     * Пустое состояние
     */
    showEmptyState() {
        this.searchResults.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="30" stroke="#ddd" stroke-width="2"/>
                    <path d="M32 20v24M20 32h24" stroke="#ddd" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>${CONFIG.MESSAGES.EMPTY_SEARCH}</p>
            </div>
        `;
    },

    /**
     * Нет результатов
     */
    showNoResults() {
        this.searchResults.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <circle cx="32" cy="32" r="30" stroke="#ddd" stroke-width="2"/>
                    <path d="M22 22l20 20M42 22l-20 20" stroke="#ddd" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>${CONFIG.MESSAGES.NO_RESULTS}</p>
            </div>
        `;
    },

    /**
     * Выбор остановки из результатов
     */
    selectStop(stop) {
        // Скрываем клавиатуру на мобильных устройствах
        if (this.searchInput) {
            this.searchInput.blur();
        }

        // Подсвечиваем в результатах
        this.highlightStop(stop);

        if (this.searchResults) {
            this.searchResults.innerHTML = ''; 
            // Или можно добавить класс .hidden, если он прописан в CSS
        }
        
        // Передаем в MapManager
        if (window.MapManager) {
            MapManager.selectStop(stop);
        }
    },

    /**
     * Подсветка остановки в результатах
     */
    highlightStop(stop) {
        // Убираем предыдущую подсветку
        this.searchResults.querySelectorAll('.stop-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Подсвечиваем текущую
        const item = this.searchResults.querySelector(`[data-stop-id="${stop.id}"]`);
        if (item) {
            item.classList.add('selected');
            
            // Прокручиваем к элементу
            item.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    },

    /**
     * Очистка поиска
     */
    clear() {
        this.searchInput.value = '';
        this.currentQuery = '';
        this.showEmptyState();
    },

    /**
     * Фокус на поле поиска
     */
    focus() {
        this.searchInput.focus();
    }
};

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchManager;
}