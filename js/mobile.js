/**
 * mobile.js (ПОЛНАЯ РЕАЛИЗАЦИЯ)
 * Оптимизация для мобильных устройств и управление sidebar
 */

/**
 * MobileOptimizer - оптимизация производительности на мобильных
 */
const MobileOptimizer = {
    isActive: false,
    deviceInfo: null,

    init() {
        this.detectDevice();
        
        if (this.shouldOptimize()) {
            ConfigHelper.log('Применение мобильных оптимизаций...');
            this.applyOptimizations();
            this.isActive = true;
        }
    },

    detectDevice() {
        this.deviceInfo = {
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isTouch: 'ontouchstart' in window,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            isLowEnd: this.isLowEndDevice()
        };
        
        ConfigHelper.log('Device Info:', this.deviceInfo);
    },

    isLowEndDevice() {
        // Определяем слабое устройство
        const cores = navigator.hardwareConcurrency || 2;
        const memory = navigator.deviceMemory || 2;
        const connection = navigator.connection?.effectiveType;
        
        return cores <= 2 || 
               memory <= 2 || 
               connection === 'slow-2g' || 
               connection === '2g';
    },

    shouldOptimize() {
        return this.deviceInfo.isMobile || 
               this.deviceInfo.isTouch || 
               this.deviceInfo.screenWidth <= 768 ||
               this.deviceInfo.isLowEnd;
    },

    applyOptimizations() {
        // 1. Отключаем тяжелые эффекты
        this.disableHeavyEffects();
        
        // 2. Упрощаем рендеринг
        this.simplifyRendering();
        
        // 3. Оптимизируем события
        this.optimizeEvents();
        
        // 4. Управление памятью
        this.setupMemoryManagement();
        
        ConfigHelper.log('Мобильные оптимизации применены');
    },

    disableHeavyEffects() {
        // Отключаем transitions на SVG элементах
        const style = document.createElement('style');
        style.id = 'mobile-optimizations';
        style.textContent = `
            @media (max-width: 768px), (hover: none) {
                .route-line, 
                .stop-circle, 
                .stop-label {
                    transition: none !important;
                    will-change: auto !important;
                }
                
                /* Упрощенные тени */
                .control-btn,
                .legend,
                .info-panel {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
                }
                
                /* Отключаем hover эффекты */
                .route-line:hover,
                .stop-circle:hover {
                    filter: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    },

    simplifyRendering() {
        if (CONFIG.MAP && this.deviceInfo.isLowEnd) {
            // Уменьшаем детализацию
            CONFIG.MAP.PATH_SIMPLIFICATION_TOLERANCE *= 2;
            CONFIG.MAP.RESOLUTION = Math.min(CONFIG.MAP.RESOLUTION, 600);
            CONFIG.VISUAL.LABEL_MIN_ZOOM = Math.max(CONFIG.VISUAL.LABEL_MIN_ZOOM, 5);
            
            ConfigHelper.log('Упрощен рендеринг для слабого устройства');
        }
    },

    optimizeEvents() {
        // Используем passive listeners где возможно
        document.addEventListener('touchstart', () => {}, { passive: true });
        document.addEventListener('touchmove', () => {}, { passive: true });
        
        // Отключаем hover на мобильных
        if (this.deviceInfo.isTouch) {
            document.body.classList.add('no-hover');
        }
    },

    setupMemoryManagement() {
        // Очистка кэша при скрытии страницы
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && MapManager) {
                MapManager.bboxCache.clear();
                ConfigHelper.log('Кэш очищен при скрытии страницы');
            }
        });
        
        // Периодическая очистка на слабых устройствах
        if (this.deviceInfo.isLowEnd) {
            setInterval(() => {
                if (MapManager && MapManager.bboxCache.size > 100) {
                    MapManager.bboxCache.clear();
                    ConfigHelper.log('Периодическая очистка кэша');
                }
            }, 60000); // Каждую минуту
        }
    }
};

/**
 * ResourceOptimizer - оптимизация ресурсов
 */
const ResourceOptimizer = {
    isActive: false,
    
    init() {
        ConfigHelper.log('Инициализация оптимизатора ресурсов...');
        
        this.setupImageOptimization();
        this.setupNetworkOptimization();
        this.setupBatteryOptimization();
        
        this.isActive = true;
    },

    setupImageOptimization() {
        // Если есть изображения, применяем lazy loading
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.loading) {
                img.loading = 'lazy';
            }
        });
    },

    setupNetworkOptimization() {
        // Определяем тип соединения
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (connection) {
            const type = connection.effectiveType;
            
            if (type === 'slow-2g' || type === '2g') {
                ConfigHelper.log('Медленное соединение, применяем оптимизации');
                
                // Уменьшаем количество одновременных запросов
                if (CONFIG.SEARCH) {
                    CONFIG.SEARCH.DEBOUNCE_DELAY = 500; // Увеличиваем задержку
                }
            }
        }
    },

    setupBatteryOptimization() {
        // Battery API для оптимизации на низком заряде
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                const updateBatteryOptimizations = () => {
                    if (battery.level < 0.2 && !battery.charging) {
                        ConfigHelper.log('Низкий заряд батареи, снижаем активность');
                        
                        // Увеличиваем throttle
                        if (MapManager) {
                            MapManager.lastUpdateTime = performance.now();
                        }
                        
                        // Уменьшаем частоту обновлений
                        if (CONFIG.SEARCH) {
                            CONFIG.SEARCH.DEBOUNCE_DELAY = 500;
                        }
                    }
                };
                
                battery.addEventListener('levelchange', updateBatteryOptimizations);
                battery.addEventListener('chargingchange', updateBatteryOptimizations);
                
                updateBatteryOptimizations();
            });
        }
    }
};

/**
 * SidebarManager - управление боковой панелью на мобильных
 */
const SidebarManager = {
    sidebar: null,
    overlay: null,
    isOpen: false,

    init() {
        this.sidebar = document.querySelector('.sidebar');
        if (!this.sidebar) return;

        this.createOverlay();
        this.setupEventListeners();
        
        ConfigHelper.log('SidebarManager инициализирован');
    },

    createOverlay() {
        // Создаем overlay для затемнения фона
        this.overlay = document.createElement('div');
        this.overlay.className = 'sidebar-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, visibility 0.3s;
        `;
        
        this.overlay.addEventListener('click', () => this.close());
        document.body.appendChild(this.overlay);
    },

    setupEventListeners() {
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Закрытие при клике вне sidebar
        document.addEventListener('click', (e) => {
            if (this.isOpen && 
                !this.sidebar.contains(e.target) && 
                !e.target.closest('.mobile-menu-btn')) {
                this.close();
            }
        });
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    open() {
        this.isOpen = true;
        this.sidebar.classList.add('open');
        this.overlay.style.opacity = '1';
        this.overlay.style.visibility = 'visible';
        
        // Блокируем scroll body
        document.body.style.overflow = 'hidden';
        
        ConfigHelper.log('Sidebar открыт');
    },

    close() {
        this.isOpen = false;
        this.sidebar.classList.remove('open');
        this.overlay.style.opacity = '0';
        this.overlay.style.visibility = 'hidden';
        
        // Разблокируем scroll
        document.body.style.overflow = '';
        
        ConfigHelper.log('Sidebar закрыт');
    }
};

/**
 * Глобальная функция для переключения sidebar
 */
window.toggleSidebar = function() {
    // Вызываем метод менеджера
    SidebarManager.toggle();
    
    // Синхронизируем состояние body с реальным состоянием сайдбара
    if (SidebarManager.isOpen) {
        document.body.classList.add('menu-open');
    } else {
        document.body.classList.remove('menu-open');
    }
};

/**
 * Глобальная функция для переключения планировщика
 */
window.togglePlanner = function() {
    const planner = document.getElementById('routePlanner');
    if (!planner) return;

    const isHidden = planner.style.display === 'none' || planner.style.display === '';
    
    if (isHidden) {
        planner.style.display = 'flex'; // или 'block'
        document.body.classList.add('planner-open');
        // Если открыт планировщик, лучше закрыть сайдбар, чтобы не мешал
        if (SidebarManager.isOpen) SidebarManager.close();
    } else {
        planner.style.display = 'none';
        document.body.classList.remove('planner-open');
    }
};

// Добавь также функцию закрытия для кнопки "X" в планировщике
window.closePlanner = function() {
    const planner = document.getElementById('routePlanner');
    if (planner) {
        planner.style.display = 'none';
        document.body.classList.remove('planner-open');
    }
};

/**
 * Инициализация при загрузке
 */
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем только на мобильных
    if (window.innerWidth <= 768 || 'ontouchstart' in window) {
        SidebarManager.init();
    }
});

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MobileOptimizer, ResourceOptimizer, SidebarManager };
}

// Глобальный доступ
window.MobileOptimizer = MobileOptimizer;
window.ResourceOptimizer = ResourceOptimizer;
window.SidebarManager = SidebarManager;