/**
 * router.js
 * Модуль для построения маршрутов между остановками
 */

const RouterManager = {
    // DOM элементы планировщика
    planner: null,
    fromInput: null,
    toInput: null,
    
    // Выбранные точки
    fromStop: null,
    toStop: null,
    
    // Построенный маршрут
    currentRoute: null,

    /**
     * Инициализация роутера
     */
    init() {
        ConfigHelper.log('Инициализация роутера...');
        
        this.planner = document.getElementById('routePlanner');
        this.fromInput = document.getElementById('fromInput');
        this.toInput = document.getElementById('toInput');
        
        if (!this.planner) {
            ConfigHelper.warn('Планировщик маршрутов не найден');
            return false;
        }
        
        this.setupAutocomplete();
        
        ConfigHelper.log('Роутер инициализирован');
        return true;
    },

    /**
     * Настройка автодополнения для инпутов
     */
    setupAutocomplete() {
        // Автодополнение для "Откуда"
        this.fromInput.addEventListener('input', 
            Utils.debounce((e) => {
                this.showSuggestions(e.target, 'from');
            }, 300)
        );
        
        // Автодополнение для "Куда"
        this.toInput.addEventListener('input',
            Utils.debounce((e) => {
                this.showSuggestions(e.target, 'to');
            }, 300)
        );
    },

    /**
     * Показ подсказок для автодополнения
     */
    showSuggestions(input, type) {
        const query = input.value;
        if (!query || query.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        const results = DataManager.searchStops(query).slice(0, 5);
        
        // Создаем список подсказок
        let suggestionsDiv = document.getElementById('suggestions');
        if (!suggestionsDiv) {
            suggestionsDiv = document.createElement('div');
            suggestionsDiv.id = 'suggestions';
            suggestionsDiv.style.cssText = `
                position: absolute;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
                width: ${input.offsetWidth}px;
            `;
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(suggestionsDiv);
        }
        
        suggestionsDiv.style.top = (input.offsetTop + input.offsetHeight + 5) + 'px';
        suggestionsDiv.style.left = input.offsetLeft + 'px';
        
        if (results.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        suggestionsDiv.innerHTML = results.map(stop => `
            <div class="suggestion-item" style="
                padding: 10px;
                cursor: pointer;
                transition: background 0.2s;
            " data-stop-id="${stop.id}">
                <div style="font-weight: 500;">${stop.name}</div>
                <div style="font-size: 12px; color: #666;">
                    ${stop.routesList?.slice(0, 3).join(', ') || ''}
                </div>
            </div>
        `).join('');
        
        // Добавляем ховер эффект
        suggestionsDiv.querySelectorAll('.suggestion-item').forEach((item, idx) => {
            item.addEventListener('mouseenter', () => {
                item.style.background = '#f5f5f5';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'white';
            });
            item.addEventListener('click', () => {
                this.selectSuggestion(results[idx], type);
            });
        });
    },

    /**
     * Скрытие подсказок
     */
    hideSuggestions() {
        const suggestions = document.getElementById('suggestions');
        if (suggestions) {
            suggestions.remove();
        }
    },

    /**
     * Выбор подсказки
     */
    selectSuggestion(stop, type) {
        if (type === 'from') {
            this.fromStop = stop;
            this.fromInput.value = stop.name;
        } else {
            this.toStop = stop;
            this.toInput.value = stop.name;
        }
        
        this.hideSuggestions();
        
        // Если обе точки выбраны, можем построить маршрут
        if (this.fromStop && this.toStop) {
            ConfigHelper.log('Обе точки выбраны, готовы построить маршрут');
        }
    },

    /**
     * Построение маршрута (алгоритм Дейкстры)
     */
    findRoute(fromStop, toStop) {
        ConfigHelper.log('Поиск маршрута:', fromStop.name, '→', toStop.name);
        
        // Создаем граф связей между остановками
        const graph = this.buildGraph();
        
        // Применяем алгоритм Дейкстры
        const path = this.dijkstra(graph, fromStop.id, toStop.id);
        
        if (!path) {
            return null;
        }
        
        // Преобразуем путь в маршрут с деталями
        return this.buildRouteDetails(path);
    },

    /**
     * Построение графа транспортной сети
     */
    buildGraph() {
        const graph = new Map();
        
        // Инициализируем узлы
        DataManager.stops.forEach(stop => {
            graph.set(stop.id, []);
        });
        
        // Строим связи через реальные маршруты
        DataManager.routes.forEach(route => {
            if (!route.stopsList || route.stopsList.length < 2) return;
            
            // Для каждой пары последовательных остановок в маршруте
            for (let i = 0; i < route.stopsList.length - 1; i++) {
                const fromStop = route.stopsList[i];
                const toStop = route.stopsList[i + 1];
                
                // Пропускаем виртуальные остановки без ID
                if (!fromStop.id || !toStop.id) continue;
                
                const distance = Utils.calculateDistance(
                    fromStop.latitude, fromStop.longitude,
                    toStop.latitude, toStop.longitude
                );
                
                // Добавляем связь в обе стороны
                const fromConnections = graph.get(fromStop.id);
                if (fromConnections) {
                    // Проверяем, нет ли уже такой связи
                    const existing = fromConnections.find(c => c.stopId === toStop.id);
                    if (!existing) {
                        fromConnections.push({
                            stopId: toStop.id,
                            distance: distance,
                            routes: [route.name],
                            routeId: route.id
                        });
                    } else {
                        // Добавляем альтернативный маршрут
                        if (!existing.routes.includes(route.name)) {
                            existing.routes.push(route.name);
                        }
                    }
                }
                
                // Обратная связь
                const toConnections = graph.get(toStop.id);
                if (toConnections) {
                    const existing = toConnections.find(c => c.stopId === fromStop.id);
                    if (!existing) {
                        toConnections.push({
                            stopId: fromStop.id,
                            distance: distance,
                            routes: [route.name],
                            routeId: route.id
                        });
                    } else {
                        if (!existing.routes.includes(route.name)) {
                            existing.routes.push(route.name);
                        }
                    }
                }
            }
        });
        
        // Добавляем пешеходные переходы для близких остановок
        this.addWalkingConnections(graph);
        
        return graph;
    },

    /**
     * Добавление пешеходных переходов между близкими остановками
     */
    addWalkingConnections(graph) {
        const stops = DataManager.stops;
        const maxWalkingDistance = CONFIG.ROUTING.MAX_WALKING_DISTANCE;
        
        for (let i = 0; i < stops.length; i++) {
            for (let j = i + 1; j < stops.length; j++) {
                const stop1 = stops[i];
                const stop2 = stops[j];
                
                const distance = Utils.calculateDistance(
                    stop1.latitude, stop1.longitude,
                    stop2.latitude, stop2.longitude
                );
                
                // Если остановки достаточно близко и не связаны маршрутом
                if (distance <= maxWalkingDistance) {
                    const connections1 = graph.get(stop1.id);
                    const connections2 = graph.get(stop2.id);
                    
                    if (connections1 && !connections1.find(c => c.stopId === stop2.id)) {
                        connections1.push({
                            stopId: stop2.id,
                            distance: distance,
                            isWalking: true,
                            routes: ['пешком']
                        });
                    }
                    
                    if (connections2 && !connections2.find(c => c.stopId === stop1.id)) {
                        connections2.push({
                            stopId: stop1.id,
                            distance: distance,
                            isWalking: true,
                            routes: ['пешком']
                        });
                    }
                }
            }
        }
    },

    /**
     * Алгоритм Дейкстры для поиска кратчайшего пути с учетом пересадок
     */
    dijkstra(graph, startId, endId) {
        const distances = new Map();
        const previous = new Map();
        const previousRoute = new Map(); // Запоминаем маршрут на каждом шаге
        const unvisited = new Set();
        
        // Инициализация
        graph.forEach((_, stopId) => {
            distances.set(stopId, Infinity);
            unvisited.add(stopId);
        });
        distances.set(startId, 0);
        previousRoute.set(startId, null);
        
        while (unvisited.size > 0) {
            // Находим непосещенную вершину с минимальным расстоянием
            let currentId = null;
            let minDistance = Infinity;
            
            unvisited.forEach(stopId => {
                const dist = distances.get(stopId);
                if (dist < minDistance) {
                    minDistance = dist;
                    currentId = stopId;
                }
            });
            
            if (currentId === null || currentId === endId) break;
            if (minDistance === Infinity) break; // Нет доступных путей
            
            unvisited.delete(currentId);
            
            // Обновляем расстояния до соседей
            const neighbors = graph.get(currentId) || [];
            const currentRoute = previousRoute.get(currentId);
            
            neighbors.forEach(neighbor => {
                if (!unvisited.has(neighbor.stopId)) return;
                
                let edgeCost = neighbor.distance;
                
                // Добавляем штраф за пересадку
                if (currentRoute && neighbor.routeId && currentRoute !== neighbor.routeId && !neighbor.isWalking) {
                    // Штраф за пересадку (в метрах эквивалента времени)
                    edgeCost += CONFIG.ROUTING.TRANSFER_PENALTY * 1000;
                }
                
                // Штраф за пешеходный переход (меньше чем пересадка)
                if (neighbor.isWalking) {
                    edgeCost += 200; // Небольшой штраф
                }
                
                const newDistance = distances.get(currentId) + edgeCost;
                
                if (newDistance < distances.get(neighbor.stopId)) {
                    distances.set(neighbor.stopId, newDistance);
                    previous.set(neighbor.stopId, currentId);
                    previousRoute.set(neighbor.stopId, neighbor.routeId || currentRoute);
                }
            });
        }
        
        // Восстанавливаем путь
        if (!previous.has(endId)) return null;
        
        const path = [];
        let current = endId;
        
        while (current !== undefined) {
            path.unshift(current);
            current = previous.get(current);
        }
        
        return path;
    },

    /**
     * Построение деталей маршрута с информацией о пересадках
     */
    buildRouteDetails(path) {
        const stops = path.map(id => DataManager.getStopById(id));
        const graph = this.buildGraph();
        
        let totalDistance = 0;
        const segments = [];
        let currentRouteId = null;
        let currentSegmentStops = [stops[0]];
        
        for (let i = 0; i < stops.length - 1; i++) {
            const from = stops[i];
            const to = stops[i + 1];
            
            // Находим информацию о связи между остановками
            const connections = graph.get(from.id) || [];
            const connection = connections.find(c => c.stopId === to.id);
            
            if (!connection) continue;
            
            const distance = connection.distance;
            totalDistance += distance;
            
            // Проверяем, нужна ли пересадка
            const needsTransfer = currentRouteId && 
                                 connection.routeId && 
                                 currentRouteId !== connection.routeId;
            
            if (needsTransfer || connection.isWalking) {
                // Завершаем текущий сегмент
                if (currentSegmentStops.length > 1) {
                    segments.push({
                        stops: currentSegmentStops,
                        routeId: currentRouteId,
                        routeName: this.getRouteName(currentRouteId),
                        isWalking: false
                    });
                }
                
                // Начинаем новый сегмент
                currentSegmentStops = [from, to];
                currentRouteId = connection.routeId;
                
                // Добавляем пешеходный сегмент если нужно
                if (connection.isWalking) {
                    segments.push({
                        stops: [from, to],
                        routeId: null,
                        routeName: 'Пешком',
                        isWalking: true,
                        distance: distance
                    });
                    currentSegmentStops = [to];
                    currentRouteId = null;
                }
            } else {
                // Продолжаем текущий сегмент
                currentSegmentStops.push(to);
                if (!currentRouteId && connection.routeId) {
                    currentRouteId = connection.routeId;
                }
            }
        }
        
        // Добавляем последний сегмент
        if (currentSegmentStops.length > 1) {
            segments.push({
                stops: currentSegmentStops,
                routeId: currentRouteId,
                routeName: this.getRouteName(currentRouteId),
                isWalking: false
            });
        }
        
        // Подсчитываем пересадки
        const transfers = segments.filter(s => !s.isWalking).length - 1;
        
        // Примерное время в пути
        const avgSpeed = 20; // км/ч
        const timeMinutes = (totalDistance / 1000) / avgSpeed * 60;
        const timeWithTransfers = timeMinutes + (transfers * CONFIG.ROUTING.TRANSFER_PENALTY);
        
        return {
            stops: stops,
            segments: segments,
            totalDistance: totalDistance,
            estimatedTime: timeWithTransfers,
            transfers: transfers
        };
    },

    /**
     * Получение названия маршрута по ID
     */
    getRouteName(routeId) {
        if (!routeId) return 'Неизвестно';
        const route = DataManager.routes.find(r => r.id === routeId);
        if (!route) return `Маршрут #${routeId}`;
        
        // Извлекаем номер из названия
        const match = route.name.match(/^(\w+)\s/);
        return match ? match[1] : route.name.substring(0, 20);
    },

    /**
     * Отображение маршрута на карте
     */
    displayRoute(route) {
        if (!route) {
            alert(CONFIG.MESSAGES.NO_ROUTE);
            return;
        }
        
        this.currentRoute = route;
        
        // Показываем информацию о маршруте
        const panel = document.getElementById('infoPanel');
        const title = document.getElementById('infoTitle');
        const content = document.getElementById('infoContent');
        
        title.textContent = 'Маршрут построен';
        
        // Формируем HTML для сегментов
        let segmentsHTML = '';
        if (route.segments && route.segments.length > 0) {
            segmentsHTML = `
                <div style="margin-top: 16px;">
                    <strong>Как добраться:</strong>
                    <div style="margin-top: 12px;">
                        ${route.segments.map((segment, idx) => {
                            const color = segment.isWalking ? '#999' : 
                                         (DataManager.routes.find(r => r.id === segment.routeId)?.color || '#4CAF50');
                            
                            return `
                                <div style="margin-bottom: 16px; padding: 12px; background: #f9f9f9; border-radius: 8px;
                                           border-left: 4px solid ${color};">
                                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                                        ${segment.isWalking ? 
                                            '<span style="font-size: 20px; margin-right: 8px;">🚶</span>' :
                                            '<span style="font-size: 20px; margin-right: 8px;">🚌</span>'
                                        }
                                        <strong style="color: ${color};">${segment.routeName}</strong>
                                        ${idx > 0 && !segment.isWalking ? 
                                            '<span style="margin-left: 8px; font-size: 12px; color: #f44336;">⟲ Пересадка</span>' : 
                                            ''
                                        }
                                    </div>
                                    <div style="font-size: 13px; color: #666;">
                                        ${segment.stops[0].name} → ${segment.stops[segment.stops.length - 1].name}
                                    </div>
                                    <div style="font-size: 12px; color: #999; margin-top: 4px;">
                                        ${segment.stops.length} остановок
                                        ${segment.isWalking ? ` • ${Utils.formatDistance(segment.distance)}` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="margin-bottom: 8px;">
                    <strong>От:</strong> ${route.stops[0].name}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>До:</strong> ${route.stops[route.stops.length - 1].name}
                </div>
            </div>
            
            <div style="margin-bottom: 16px; padding: 12px; background: #e8f5e9; border-radius: 8px;">
                <div style="margin-bottom: 4px;">
                    <strong>⏱️ Время в пути:</strong> ~${Utils.formatTime(route.estimatedTime)}
                </div>
                <div style="margin-bottom: 4px;">
                    <strong>📏 Расстояние:</strong> ${Utils.formatDistance(route.totalDistance)}
                </div>
                <div>
                    <strong>🔄 Пересадок:</strong> ${route.transfers}
                </div>
            </div>
            
            ${segmentsHTML}
            
            <button onclick="MapManager.drawRouteOnMap(RouterManager.currentRoute)" 
                    style="width: 100%; padding: 10px; margin-top: 16px; background: #4CAF50; 
                           color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Показать на карте
            </button>
        `;
        
        panel.classList.add('show');
    }
};

// Глобальные функции для UI
function togglePlanner() {
    const planner = document.getElementById('routePlanner');
    const isHidden = planner.style.display === 'none' || !planner.style.display;
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    if (isHidden) {
        planner.style.display = 'block';
        if (mobileMenuBtn) mobileMenuBtn.style.display = 'none';
        // На мобилках скрываем боковую панель поиска, если она открыта
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        }
    } else {
        planner.style.display = 'none';
        if (mobileMenuBtn) mobileMenuBtn.style.display = 'flex';
    }
}

function closePlanner() {
    const planner = document.getElementById('routePlanner');
    planner.style.display = 'none';
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) mobileMenuBtn.style.display = 'flex';
}

function swapPoints() {
    const temp = RouterManager.fromStop;
    RouterManager.fromStop = RouterManager.toStop;
    RouterManager.toStop = temp;
    
    const tempValue = RouterManager.fromInput.value;
    RouterManager.fromInput.value = RouterManager.toInput.value;
    RouterManager.toInput.value = tempValue;
}

function buildRoute() {
    if (!RouterManager.fromStop || !RouterManager.toStop) {
        alert(CONFIG.MESSAGES.SELECT_STOPS);
        return;
    }
    
    const route = RouterManager.findRoute(
        RouterManager.fromStop,
        RouterManager.toStop
    );
    
    RouterManager.displayRoute(route);
}

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouterManager;
}