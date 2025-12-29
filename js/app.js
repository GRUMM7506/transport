/**
 * app.js
 * Главный файл приложения - инициализация и координация всех модулей
 */
function autoConfigureForDevice() {
    const isMobile = window.innerWidth <= 768;
    const isLowEnd = (navigator.hardwareConcurrency || 4) <= 2;
    
    if (isMobile) {
        ConfigHelper.log('Mobile device detected, adjusting config...');
        
        // Уменьшаем детализацию
        CONFIG.MAP.RESOLUTION = Math.min(CONFIG.MAP.RESOLUTION, 600);
        CONFIG.MAP.PATH_SIMPLIFICATION_TOLERANCE *= 1.5;
        CONFIG.VISUAL.LABEL_MIN_ZOOM = Math.max(CONFIG.VISUAL.LABEL_MIN_ZOOM, 5);
        CONFIG.VISUAL.LABEL_MIN_DISTANCE *= 1.5;
        
        // Увеличиваем задержки
        CONFIG.SEARCH.DEBOUNCE_DELAY = 400;
    }
    
    if (isLowEnd) {
        ConfigHelper.log('Low-end device detected, applying aggressive optimizations...');
        
        // Еще более агрессивные настройки
        CONFIG.MAP.RESOLUTION = Math.min(CONFIG.MAP.RESOLUTION, 400);
        CONFIG.MAP.PATH_SIMPLIFICATION_TOLERANCE *= 2;
        CONFIG.VISUAL.LABEL_MIN_ZOOM = 6;
        CONFIG.SEARCH.DEBOUNCE_DELAY = 500;
    }
    
    ConfigHelper.log('Config adjusted for device:', CONFIG);
}

ConfigHelper.log('Приложение подготовлено к запуску');
ConfigHelper.log('Для отладки используйте: window.debug');
ConfigHelper.log('Для информации о производительности: window.debug.performance()');
const App = {
    // Состояние приложения
    isInitialized: false,
    isLoading: false,
    
    /**
     * Точка входа в приложение
     */
    async init() {
        ConfigHelper.log('========================================');
        ConfigHelper.log('Запуск приложения Транспорт Душанбе');
        ConfigHelper.log('========================================');
        
        try {
            this.isLoading = true;
            this.showLoading(true);
            
            // 0. Инициализация темы (до загрузки данных)
            ConfigHelper.log('Шаг 0: Инициализация темы...');
            ThemeManager.init();
            
            // 0.5. НОВОЕ: Инициализация мобильных оптимизаций
            ConfigHelper.log('Шаг 0.5: Проверка устройства и оптимизации...');
            if (window.innerWidth <= 768 || 'ontouchstart' in window) {
                if (typeof MobileOptimizer !== 'undefined') {
                    MobileOptimizer.init();
                }
                if (typeof ResourceOptimizer !== 'undefined') {
                    ResourceOptimizer.init();
                }
            }
            
            // 1. Загрузка данных
            ConfigHelper.log('Шаг 1: Загрузка данных...');
            await DataManager.loadAllData();
            
            // 2. Инициализация карты
            ConfigHelper.log('Шаг 2: Инициализация карты...');
            if (!MapManager.init()) {
                throw new Error('Не удалось инициализировать карту');
            }
            
            // 3. Инициализация поиска
            ConfigHelper.log('Шаг 3: Инициализация поиска...');
            if (!SearchManager.init()) {
                throw new Error('Не удалось инициализировать поиск');
            }
            
            // 4. Инициализация роутера
            ConfigHelper.log('Шаг 4: Инициализация роутера...');
            RouterManager.init();
            
            // 5. Отрисовка схемы
            ConfigHelper.log('Шаг 5: Отрисовка схемы...');
            MapManager.drawScheme(DataManager.stops, DataManager.routes);
            MapManager.isInitialized = true;
            
            // 6. Применяем тему к карте
            ThemeManager.updateMapTheme(ThemeManager.currentTheme);
            
            // 7. Инициализация GPS
            ConfigHelper.log('Шаг 6: Инициализация GPS...');
            GeoLocationManager.init();
            
            // 8. Настройка дополнительных обработчиков
            this.setupGlobalHandlers();
            
            // 9. НОВОЕ: Инициализация sidebar на мобильных
            if (window.innerWidth <= 768 && typeof SidebarManager !== 'undefined') {
                SidebarManager.init();
            }
            
            // 10. Готово
            this.isInitialized = true;
            this.isLoading = false;
            this.showLoading(false);
            
            ConfigHelper.log('========================================');
            ConfigHelper.log('Приложение успешно запущено!');
            ConfigHelper.log('Статистика:', DataManager.getStats());
            
            // НОВОЕ: Логируем информацию об оптимизациях
            if (MobileOptimizer && MobileOptimizer.isActive) {
                ConfigHelper.log('Мобильные оптимизации:', 'АКТИВНЫ');
                ConfigHelper.log('Device Info:', MobileOptimizer.deviceInfo);
            }
            if (ResourceOptimizer && ResourceOptimizer.isActive) {
                ConfigHelper.log('Оптимизатор ресурсов:', 'АКТИВЕН');
            }
            
            ConfigHelper.log('========================================');
            
            // Фокус на поиске
            SearchManager.focus();
            
        } catch (error) {
            ConfigHelper.error('Ошибка инициализации приложения:', error);
            this.showError(error.message);
        }
    },

    /**
     * Показать/скрыть индикатор загрузки
     */
    showLoading(show) {
        const loader = document.getElementById('loading');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    },

    /**
     * Показать ошибку
     */
    showError(message) {
        this.showLoading(false);
        
        const container = document.querySelector('.map-container');
        if (!container) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            text-align: center;
            max-width: 400px;
        `;
        
        errorDiv.innerHTML = `
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style="margin-bottom: 16px;">
                <circle cx="32" cy="32" r="30" stroke="#f44336" stroke-width="2"/>
                <path d="M32 20v16M32 44v4" stroke="#f44336" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h3 style="margin-bottom: 12px; color: #f44336;">Ошибка загрузки</h3>
            <p style="color: #666; margin-bottom: 20px;">${message}</p>
            <button onclick="location.reload()" style="
                padding: 12px 24px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 15px;
                font-weight: 600;
            ">Перезагрузить</button>
        `;
        
        container.appendChild(errorDiv);
    },

    /**
     * Настройка глобальных обработчиков
     */
    setupGlobalHandlers() {
        // Мобильное меню
        this.setupMobileMenu();
        
        // Горячие клавиши
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F - фокус на поиске
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                SearchManager.focus();
            }
            
            // Escape - закрыть панели
            if (e.key === 'Escape') {
                closeInfo();
                closePlanner();
                this.closeMobileSidebar();
            }
            
            // Ctrl/Cmd + R - построить маршрут
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                togglePlanner();
            }
            
            // Ctrl/Cmd + T - переключить тему
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                toggleTheme();
            }

            // Ctrl/Cmd + L - найти мое местоположение
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                GeoLocationManager.findMe();
            }
        });
        
        // Обработка изменения размера окна
        window.addEventListener('resize', 
            Utils.throttle(() => {
                if (this.isInitialized) {
                    ConfigHelper.log('Перерисовка схемы после изменения размера');
                    MapManager.drawScheme(DataManager.stops, DataManager.routes);
                }
            }, 500)
        );
        
        // Клик вне элементов для закрытия
        document.addEventListener('click', (e) => {
            // Закрываем подсказки автодополнения
            const suggestions = document.getElementById('suggestions');
            if (suggestions && !e.target.closest('.planner-inputs')) {
                RouterManager.hideSuggestions();
            }
            
            // Закрываем мобильное меню при клике вне его
            const sidebar = document.querySelector('.sidebar');
            if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
                if (!e.target.closest('.sidebar') && !e.target.closest('.mobile-menu-btn')) {
                    this.closeMobileSidebar();
                }
            }
        });
        
        // Предотвращаем контекстное меню на SVG
        const svg = document.getElementById('transportMap');
        if (svg) {
            svg.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });
        }
    },

    /**
     * Настройка мобильного меню
     */
    setupMobileMenu() {
        const checkAndSetupMenu = () => {
            if (window.innerWidth <= 768) {
                if (!this.mobileMenuBtn) {
                    const menuBtn = document.createElement('button');
                    menuBtn.className = 'mobile-menu-btn';
                    menuBtn.innerHTML = '☰';
                    
                    menuBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleMobileSidebar();
                    });
                    
                    document.body.appendChild(menuBtn);
                    this.mobileMenuBtn = menuBtn;
                }
            } else {
                if (this.mobileMenuBtn) {
                    this.mobileMenuBtn.remove();
                    this.mobileMenuBtn = null;
                }
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.classList.remove('open');
                }
            }
        };

        checkAndSetupMenu();
        window.addEventListener('resize', Utils.throttle(checkAndSetupMenu, 250));
    },

    /**
     * Переключение мобильного sidebar
     */
    toggleMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
            if (this.mobileMenuBtn) {
                this.mobileMenuBtn.innerHTML = sidebar.classList.contains('open') ? '×' : '☰';
                this.mobileMenuBtn.style.fontSize = sidebar.classList.contains('open') ? '32px' : '24px';
            }
        }
    },

    /**
     * Закрытие мобильного sidebar
     */
    closeMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            if (this.mobileMenuBtn) {
                this.mobileMenuBtn.innerHTML = '☰';
                this.mobileMenuBtn.style.fontSize = '24px';
            }
        }
    },

    /**
     * Экспорт данных для отладки
     */
    exportDebugInfo() {
        return {
            version: '1.0.0',
            initialized: this.isInitialized,
            theme: ThemeManager.currentTheme,
            config: CONFIG,
            data: DataManager.exportData(),
            map: {
                scale: MapManager.scale,
                translateX: MapManager.translateX,
                translateY: MapManager.translateY,
                selectedStop: MapManager.selectedStop
            },
            search: {
                currentQuery: SearchManager.currentQuery,
                currentFilter: SearchManager.currentFilter
            },
            router: {
                fromStop: RouterManager.fromStop,
                toStop: RouterManager.toStop,
                currentRoute: RouterManager.currentRoute
            },
            geolocation: {
                enabled: GeoLocationManager.isAvailable,
                currentPosition: GeoLocationManager.currentPosition
            },
            hotkeys: {
                'Ctrl+F': 'Фокус на поиске',
                'Ctrl+R': 'Построить маршрут',
                'Ctrl+T': 'Сменить тему',
                'Ctrl+L': 'Найти меня',
                'Escape': 'Закрыть панели'
            }
        };
    },

    /**
     * Сохранение состояния в localStorage
     */
    saveState() {
        try {
            const state = {
                map: {
                    scale: MapManager.scale,
                    translateX: MapManager.translateX,
                    translateY: MapManager.translateY
                },
                selectedStopId: MapManager.selectedStop?.id,
                theme: ThemeManager.currentTheme
            };
            
            localStorage.setItem('transportAppState', JSON.stringify(state));
            ConfigHelper.log('Состояние сохранено');
        } catch (e) {
            ConfigHelper.warn('Не удалось сохранить состояние:', e);
        }
    },

    /**
     * Восстановление состояния из localStorage
     */
    restoreState() {
        try {
            const stateStr = localStorage.getItem('transportAppState');
            if (!stateStr) return;
            
            const state = JSON.parse(stateStr);
            
            // Восстанавливаем параметры карты
            if (state.map) {
                MapManager.scale = state.map.scale || 1;
                MapManager.translateX = state.map.translateX || 0;
                MapManager.translateY = state.map.translateY || 0;
                MapManager.updateTransform();
            }
            
            // Восстанавливаем выбранную остановку
            if (state.selectedStopId) {
                const stop = DataManager.getStopById(state.selectedStopId);
                if (stop) {
                    MapManager.selectStop(stop);
                }
            }
            
            ConfigHelper.log('Состояние восстановлено');
        } catch (e) {
            ConfigHelper.warn('Не удалось восстановить состояние:', e);
        }
    },

    /**
     * Очистка всех данных
     */
    reset() {
        ConfigHelper.log('Сброс приложения...');
        
        MapManager.clear();
        SearchManager.clear();
        
        RouterManager.fromStop = null;
        RouterManager.toStop = null;
        RouterManager.currentRoute = null;
        
        try {
            localStorage.removeItem('transportAppState');
        } catch (e) {}
        
        closeInfo();
        closePlanner();
        resetView();
        
        ConfigHelper.log('Приложение сброшено');
    },

    getPerformanceInfo() {
        const info = {
            isInitialized: this.isInitialized,
            isMobile: window.innerWidth <= 768,
            
            // Информация о карте
            map: {
                scale: MapManager.scale,
                drawnStopsCount: MapManager.drawnStops.size,
                drawnRoutesCount: MapManager.drawnRoutes.size,
                bboxCacheSize: MapManager.bboxCache?.size || 0,
                lastUpdateTime: MapManager.lastUpdateTime || 0
            },
            
            // Информация об оптимизациях
            optimizations: {
                mobileActive: MobileOptimizer?.isActive || false,
                resourceActive: ResourceOptimizer?.isActive || false,
                deviceInfo: MobileOptimizer?.deviceInfo || null
            },
            
            // Информация о памяти
            memory: performance.memory ? {
                usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
                jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
            } : 'Not available',
            
            // Тайминги
            timing: performance.timing ? {
                pageLoadTime: performance.timing.loadEventEnd - performance.timing.navigationStart + ' ms',
                domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart + ' ms',
                resourceLoadTime: performance.timing.loadEventEnd - performance.timing.domContentLoadedEventEnd + ' ms'
            } : 'Not available'
        };
        
        return info;
    }
};

// ============================================
// THEME MANAGER - Управление темой
// ============================================
const ThemeManager = {
    currentTheme: 'light',
    
    init() {
        // Проверяем сохраненную тему
        const savedTheme = localStorage.getItem('theme');
        
        // Или используем системную
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        this.currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        this.applyTheme(this.currentTheme, false);
        
        // Слушаем изменения системной темы
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.applyTheme(e.matches ? 'dark' : 'light', true);
            }
        });
        
        ConfigHelper.log('Тема инициализирована:', this.currentTheme);
    },
    
    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme, true);
    },
    
    applyTheme(theme, save = true) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Обновляем иконку
        this.updateIcon(theme);
        
        // Сохраняем выбор
        if (save) {
            localStorage.setItem('theme', theme);
        }
        
        // Обновляем SVG элементы если карта уже отрисована
        if (MapManager.isInitialized) {
            this.updateMapTheme(theme);
        }
        
        ConfigHelper.log('Тема применена:', theme);
    },
    
    updateIcon(theme) {
        const icon = document.getElementById('themeIcon');
        if (!icon) return;
        
        if (theme === 'dark') {
            // Иконка солнца для светлой темы
            icon.innerHTML = '<circle cx="10" cy="10" r="4" fill="currentColor"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
        } else {
            // Иконка луны для темной темы
            icon.innerHTML = '<path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 14V4a6 6 0 1 1 0 12z" fill="currentColor"/>';
        }
    },
    
    updateMapTheme(theme) {
        const isDark = theme === 'dark';
        
        // Обновляем цвета остановок
        document.querySelectorAll('.stop-circle').forEach(circle => {
            const isSelected = circle.parentElement?.dataset?.stopId && 
                             MapManager.selectedStop && 
                             String(MapManager.selectedStop.id) === circle.parentElement.dataset.stopId;
            
            if (!isSelected) {
                circle.setAttribute('fill', isDark ? '#2D2D2D' : '#ffffff');
                circle.setAttribute('stroke', isDark ? '#B0B0B0' : '#333');
            }
        });
        
        // Обновляем прозрачность линий
        document.querySelectorAll('.route-line').forEach(line => {
            line.style.strokeOpacity = isDark ? '0.8' : '0.6';
        });
        
        ConfigHelper.log('Тема карты обновлена');
    }
};

// ============================================
// GEOLOCATION MANAGER - Управление GPS
// ============================================
const GeoLocationManager = {
    isAvailable: false,
    isWatching: false,
    watchId: null,
    currentPosition: null,
    userMarker: null,
    
    init() {
        // Проверяем доступность Geolocation API
        if ('geolocation' in navigator) {
            this.isAvailable = true;
            ConfigHelper.log('Geolocation API доступен');
            
            // Добавляем кнопку геолокации
            this.addGeoButton();
        } else {
            ConfigHelper.warn('Geolocation API недоступен');
        }
    },
    
    addGeoButton() {
        const controls = document.querySelector('.controls');
        if (!controls) return;
        
        const geoBtn = document.createElement('button');
        geoBtn.className = 'control-btn';
        geoBtn.title = 'Найти меня';
        geoBtn.id = 'geoBtn';
        geoBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
        
        geoBtn.addEventListener('click', () => this.findMe());
        
        // Вставляем перед первой кнопкой
        controls.insertBefore(geoBtn, controls.firstChild);
    },
    
    findMe() {
        if (!this.isAvailable) {
            alert('Геолокация недоступна в вашем браузере');
            return;
        }
        
        const btn = document.getElementById('geoBtn');
        if (btn) {
            btn.style.background = 'var(--primary-color)';
            btn.style.color = 'white';
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => this.onPositionSuccess(position),
            (error) => this.onPositionError(error),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    },
    
    onPositionSuccess(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        this.currentPosition = { lat, lng, accuracy };
        ConfigHelper.log('Текущая позиция:', lat, lng, `точность: ${accuracy}м`);
        
        // Находим ближайшую остановку
        const nearestStop = this.findNearestStop(lat, lng);
        
        if (nearestStop) {
            const distance = Utils.calculateDistance(lat, lng, nearestStop.latitude, nearestStop.longitude);
            
            // Показываем маркер пользователя
            this.showUserMarker(lat, lng);
            
            // Если остановка в радиусе 500м, показываем её
            if (distance < 500) {
                MapManager.selectStop(nearestStop);
                
                // Показываем информацию
                const panel = document.getElementById('infoPanel');
                const title = document.getElementById('infoTitle');
                const content = document.getElementById('infoContent');
                
                title.textContent = '📍 Ваше местоположение';
                content.innerHTML = `
                    <div style="margin-bottom: 16px;">
                        <strong>Координаты:</strong><br>
                        ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                        <span style="font-size: 12px; color: var(--text-muted);">
                            Точность: ±${Math.round(accuracy)}м
                        </span>
                    </div>
                    <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 16px;">
                        <strong>Ближайшая остановка:</strong><br>
                        <div style="margin-top: 8px; font-size: 16px;">
                            ${nearestStop.name}
                        </div>
                        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                            Расстояние: ${Utils.formatDistance(distance)}
                        </div>
                    </div>
                    <button onclick="setRoutePoint('from', ${nearestStop.id})" 
                            style="width: 100%; padding: 10px; background: var(--primary-color); 
                                   color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                        Построить маршрут отсюда
                    </button>
                `;
                
                panel.classList.add('show');
            } else {
                alert(`Ближайшая остановка "${nearestStop.name}" находится в ${Utils.formatDistance(distance)} от вас`);
            }
        } else {
            alert('Не удалось найти ближайшую остановку');
        }
        
        // Сбрасываем цвет кнопки
        const btn = document.getElementById('geoBtn');
        if (btn) {
            btn.style.background = '';
            btn.style.color = '';
        }
    },
    
    onPositionError(error) {
        ConfigHelper.error('Ошибка геолокации:', error);
        
        const btn = document.getElementById('geoBtn');
        if (btn) {
            btn.style.background = '';
            btn.style.color = '';
        }
        
        let message = 'Не удалось определить местоположение';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = 'Доступ к геолокации запрещен. Разрешите доступ в настройках браузера.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Информация о местоположении недоступна';
                break;
            case error.TIMEOUT:
                message = 'Время ожидания истекло';
                break;
        }
        
        alert(message);
    },
    
    findNearestStop(lat, lng) {
        if (!DataManager.stops || DataManager.stops.length === 0) return null;
        
        let nearest = null;
        let minDistance = Infinity;
        
        DataManager.stops.forEach(stop => {
            const distance = Utils.calculateDistance(lat, lng, stop.latitude, stop.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = stop;
            }
        });
        
        return nearest;
    },
    
    showUserMarker(lat, lng) {
        // Удаляем предыдущий маркер
        if (this.userMarker) {
            this.userMarker.remove();
        }
        
        // Преобразуем координаты в координаты схемы
        const coords = MapManager.transformer.toScheme(lat, lng);
        
        // Создаем группу для маркера
        const markerGroup = Utils.createSVGElement('g', {
            id: 'userMarker',
            class: 'user-marker'
        });
        
        // Внешний круг (пульсация)
        const outerCircle = Utils.createSVGElement('circle', {
            cx: coords.x,
            cy: coords.y,
            r: 20,
            fill: '#2196F3',
            opacity: '0.3',
            class: 'user-marker-pulse'
        });
        
        // Добавляем CSS анимацию если её нет
        if (!document.getElementById('userMarkerAnimation')) {
            const style = document.createElement('style');
            style.id = 'userMarkerAnimation';
            style.textContent = `
                @keyframes pulse {
                    0% {
                        r: 15;
                        opacity: 0.4;
                    }
                    100% {
                        r: 25;
                        opacity: 0;
                    }
                }
                .user-marker-pulse {
                    animation: pulse 2s ease-out infinite;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Внутренний круг
        const innerCircle = Utils.createSVGElement('circle', {
            cx: coords.x,
            cy: coords.y,
            r: 8,
            fill: '#2196F3',
            stroke: 'white',
            'stroke-width': 3
        });
        
        markerGroup.appendChild(outerCircle);
        markerGroup.appendChild(innerCircle);
        
        MapManager.mapGroup.appendChild(markerGroup);
        this.userMarker = markerGroup;
        
        // Центрируем на позиции пользователя
        MapManager.centerOnStop({ x: coords.x, y: coords.y });
    },
    
    clearUserMarker() {
        if (this.userMarker) {
            this.userMarker.remove();
            this.userMarker = null;
        }
    },
};

// Глобальная функция переключения темы
window.toggleTheme = function() {
    ThemeManager.toggle();
};

// Запуск приложения при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
    ConfigHelper.log('DOM загружен, запуск приложения...');
    // Вызываем перед инициализацией
    autoConfigureForDevice();
    App.init();
});

// Сохранение состояния перед закрытием
window.addEventListener('beforeunload', () => {
    if (App.isInitialized) {
        App.saveState();
    }
});

// Настройка глобальных переменных для отладки
const Settings = {
    debug: true,
    logLevel: 'info'
};

// Глобальный доступ к App для отладки
window.App = App;
window.DataManager = DataManager;
window.MapManager = MapManager;
window.SearchManager = SearchManager;
window.RouterManager = RouterManager;
window.ThemeManager = ThemeManager;
window.GeoLocationManager = GeoLocationManager;
window.CONFIG = CONFIG;
window.Utils = Utils;

// Дополнительные полезные команды для консоли
window.debug = {
    info: () => App.exportDebugInfo(),
    performance: () => App.getPerformanceInfo(),  // НОВОЕ
    reset: () => App.reset(),
    reload: () => location.reload(),
    stats: () => DataManager.getStats(),
    stops: () => DataManager.stops,
    routes: () => DataManager.routes,
    theme: () => ThemeManager.currentTheme,
    toggleTheme: () => ThemeManager.toggle(),
    findMe: () => GeoLocationManager.findMe(),
    
    // НОВОЕ: Утилиты для тестирования производительности
    fps: () => {
        let lastTime = performance.now();
        let frames = 0;
        let fpsDisplay = document.createElement('div');
        fpsDisplay.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:#0f0;padding:10px;font-family:monospace;z-index:10000;';
        document.body.appendChild(fpsDisplay);
        
        function measureFPS() {
            frames++;
            const now = performance.now();
            if (now >= lastTime + 1000) {
                const fps = Math.round(frames * 1000 / (now - lastTime));
                fpsDisplay.textContent = `FPS: ${fps}`;
                frames = 0;
                lastTime = now;
            }
            requestAnimationFrame(measureFPS);
        }
        measureFPS();
        
        return 'FPS counter started (top right corner)';
    },
    
    clearCache: () => {
        if (MapManager.bboxCache) {
            const size = MapManager.bboxCache.size;
            MapManager.bboxCache.clear();
            return `Cleared ${size} cached items`;
        }
        return 'No cache to clear';
    },
    
    toggleOptimizations: (enable) => {
        if (enable && MobileOptimizer) {
            MobileOptimizer.init();
            return 'Optimizations enabled';
        } else if (!enable && MobileOptimizer) {
            MobileOptimizer.isActive = false;
            return 'Optimizations disabled';
        }
        return 'MobileOptimizer not available';
    },
    
    // Simulate low-end device
    simulateLowEnd: () => {
        if (MobileOptimizer) {
            MobileOptimizer.deviceInfo = {
                isMobile: true,
                isTouch: true,
                screenWidth: 375,
                screenHeight: 667,
                pixelRatio: 2,
                isLowEnd: true
            };
            MobileOptimizer.applyOptimizations();
            return 'Low-end device simulation enabled';
        }
        return 'MobileOptimizer not available';
    }
};

// Глобальная функция для кнопок в попапе
window.setRoutePoint = function(type, stopId) {
    const stop = DataManager.getStopById(stopId);
    if (!stop) return;

    const planner = document.getElementById('routePlanner');
    planner.style.display = 'block';

    if (type === 'from') {
        RouterManager.selectSuggestion(stop, 'from');
        if (!RouterManager.toStop) {
            document.getElementById('toInput').focus();
        }
    } else {
        RouterManager.selectSuggestion(stop, 'to');
        if (!RouterManager.fromStop) {
            document.getElementById('fromInput').focus();
        }
    }

    if (RouterManager.fromStop && RouterManager.toStop) {
        buildRoute();
    }
};

ConfigHelper.log('Приложение подготовлено к запуску');
ConfigHelper.log('Для отладки используйте: window.debug');

window.openSettings = function() {
    document.getElementById('settingsModal').style.display = 'flex';
    // Устанавливаем текущие значения
    document.getElementById('inpRadius').value = CONFIG.VISUAL.STOP_RADIUS;
    document.getElementById('inpZoom').value = CONFIG.MAP.MAX_ZOOM;
    document.getElementById('inpResolution').value = CONFIG.MAP.RESOLUTION;
    document.getElementById('inpPathSimplification').value = CONFIG.MAP.PATH_SIMPLIFICATION;

    // Обновляем цифры
    document.getElementById('lblRadius').innerText = CONFIG.VISUAL.STOP_RADIUS;
    document.getElementById('lblZoom').innerText = CONFIG.MAP.MAX_ZOOM;
    document.getElementById('lblResolution').innerText = CONFIG.MAP.RESOLUTION;
    document.getElementById('lblPathSimplification').innerText = CONFIG.MAP.PATH_SIMPLIFICATION;
};

// Обновление цифр при перетаскивании
document.getElementById('inpRadius').oninput = function() {
    document.getElementById('lblRadius').innerText = this.value;
};
document.getElementById('inpZoom').oninput = function() {
    document.getElementById('lblZoom').innerText = this.value;
};
document.getElementById('inpResolution').oninput = function() {
    document.getElementById('lblResolution').innerText = this.value;
};
document.getElementById('inpPathSimplification').oninput = function() {
    document.getElementById('lblPathSimplification').innerText = this.value;
}

window.refreshMap = function() {
    ConfigHelper.log('Принудительная перерисовка карты пользователем...');
    
    // Показываем индикатор загрузки
    App.showLoading(true);
    
    // Небольшая задержка, чтобы браузер успел отрисовать лоадер
    setTimeout(() => {
        try {
            if (MapManager && DataManager.stops.length > 0) {
                // Вызываем основную функцию отрисовки
                MapManager.drawScheme(DataManager.stops, DataManager.routes);
                
                // Если есть активная тема, применяем её повторно
                if (typeof ThemeManager !== 'undefined') {
                    ThemeManager.updateMapTheme(ThemeManager.currentTheme);
                }
                
                ConfigHelper.log('Карта успешно перерисована');
            }
        } catch (error) {
            ConfigHelper.error('Ошибка при перерисовке карты:', error);
        } finally {
            // Скрываем индикатор загрузки
            App.showLoading(false);
        }
    }, 100);
};

window.applySettings = function() {
    // 1. Сохраняем в конфиг
    CONFIG.VISUAL.STOP_RADIUS = parseFloat(document.getElementById('inpRadius').value);
    CONFIG.MAP.MAX_ZOOM = parseFloat(document.getElementById('inpZoom').value);
    CONFIG.MAP.RESOLUTION = parseFloat(document.getElementById('inpResolution').value);
    CONFIG.MAP.PATH_SIMPLIFICATION = parseFloat(document.getElementById('inpPathSimplification').value);

    // 2. Перерисовываем карту (вызываем твой метод отрисовки)
    // Предполагаю, что DataManager доступен глобально
    if (window.MapManager && window.DataManager) {
        MapManager.drawScheme(DataManager.stops, DataManager.routes);
    }

    window.refreshMap(); // Перерисовываем с новыми параметрами
    // 3. Закрываем
    document.getElementById('settingsModal').style.display = 'none';
};

if (CONFIG.DEBUG) {
    // Long task detection
    if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration > 50) { // Задачи длиннее 50ms
                    ConfigHelper.warn('Long task detected:', {
                        duration: Math.round(entry.duration) + 'ms',
                        startTime: Math.round(entry.startTime) + 'ms'
                    });
                }
            }
        });
        
        try {
            observer.observe({ entryTypes: ['longtask'] });
        } catch (e) {
            // Long task API not supported
        }
    }
    
    // Memory leak detection
    setInterval(() => {
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize / 1024 / 1024;
            if (used > 100) { // Больше 100 MB
                ConfigHelper.warn('High memory usage:', Math.round(used) + ' MB');
            }
        }
    }, 30000); // Каждые 30 секунд
}