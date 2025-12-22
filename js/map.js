/**
 * map.js
 * Модуль для отрисовки и управления схемой транспорта
 */

const MapManager = {
    svg: null,
    mapGroup: null,
    scale: 1,
    translateX: 0,
    translateY: 0,
    transformer: null,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    isInitialized: false,
    drawnStops: new Map(),
    drawnRoutes: new Map(),
    selectedStop: null,
    highlightedRoute: null,  // НОВОЕ: отслеживание выделенного маршрута

    init() {
        ConfigHelper.log('Инициализация карты...');
        
        this.svg = document.getElementById('transportMap');
        if (!this.svg) {
            ConfigHelper.error('SVG элемент не найден');
            return false;
        }
        
        this.mapGroup = Utils.createSVGElement('g', {
            id: 'mainGroup'
        });
        this.svg.appendChild(this.mapGroup);
        this.initControls();
        
        ConfigHelper.log('Карта инициализирована');
        return true;
    },

    drawScheme(stops, routes) {
        ConfigHelper.log('Отрисовка схемы...');
        
        if (!stops || stops.length === 0) {
            ConfigHelper.warn('Нет остановок для отрисовки');
            return;
        }
        
        this.clear();
        
        const width = this.svg.clientWidth;
        const height = this.svg.clientHeight;
        this.transformer = Utils.createCoordinateTransformer(
            stops, width, height, CONFIG.MAP.PADDING
        );
        
        stops.forEach(stop => {
            const coords = this.transformer.toScheme(stop.latitude, stop.longitude);
            stop.x = coords.x;
            stop.y = coords.y;
        });
        
        // ИСПРАВЛЕНО: правильный порядок отрисовки
        // 1. Сначала линии маршрутов
        this.drawRoutes(stops, routes);
        
        // 2. Потом точки остановок
        this.drawStops(stops);
        
        // 3. Обновляем легенду
        this.updateLegend(routes);
        
        ConfigHelper.log('Схема отрисована');
    },

    drawRoutes(stops, routes) {
        ConfigHelper.log('Рисуем маршруты...');
        
        const routesGroup = Utils.createSVGElement('g', {
            id: 'routesGroup'
        });
        this.mapGroup.appendChild(routesGroup);
        
        routes.forEach((route, index) => {
            if (route.path && route.path.length > 0) {
                this.drawRoutePath(route, routesGroup, index);
            } else if (route.stopsList && route.stopsList.length > 1) {
                this.drawRouteByStops(route, routesGroup, index);
            }
        });
        
        ConfigHelper.log(`Отрисовано маршрутов: ${routes.length}`);
    },

    drawRoutePath(route, group, index) {
        const pathPoints = route.path.map(point => {
            return this.transformer.toScheme(point.lat, point.lng);
        });
        
        const simplifiedPath = Utils.simplifyPath(pathPoints, CONFIG.MAP.PATH_SIMPLIFICATION_TOLERANCE);
        const pathString = this.generateSmoothPath(simplifiedPath);
        const color = route.color || ConfigHelper.getRouteColor(index);
        
        const pathElement = Utils.createSVGElement('path', {
            d: pathString,
            stroke: color,
            'stroke-width': CONFIG.VISUAL.ROUTE_WIDTH,
            'data-base-width': CONFIG.VISUAL.ROUTE_WIDTH,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            fill: 'none',
            class: 'route-line',
            'data-route-id': route.id,
            'data-route-name': route.name
        });
        
        pathElement.addEventListener('mouseenter', () => {
            if (!this.highlightedRoute) {
                pathElement.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH_HOVER);
            }
        });
        
        pathElement.addEventListener('mouseleave', () => {
            if (!this.highlightedRoute) {
                pathElement.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH);
            }
        });
        
        pathElement.addEventListener('click', () => {
            this.showRouteDetails(route);
        });
        
        group.appendChild(pathElement);
        this.drawnRoutes.set(route.id, { element: pathElement, route: route });
    },

    drawRouteByStops(route, group, index) {
        const stops = route.stopsList.filter(s => s.x !== undefined && s.y !== undefined);
        
        if (stops.length < 2) return;
        
        const points = stops.map(s => ({ x: s.x, y: s.y }));
        const pathString = this.generateSmoothPath(points);
        const color = route.color || ConfigHelper.getRouteColor(index);
        
        const pathElement = Utils.createSVGElement('path', {
            d: pathString,
            stroke: color,
            'stroke-width': CONFIG.VISUAL.ROUTE_WIDTH,
            'data-base-width': CONFIG.VISUAL.ROUTE_WIDTH,
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            fill: 'none',
            class: 'route-line',
            'data-route-id': route.id
        });
        
        pathElement.addEventListener('mouseenter', () => {
            if (!this.highlightedRoute) {
                pathElement.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH_HOVER);
            }
        });
        
        pathElement.addEventListener('mouseleave', () => {
            if (!this.highlightedRoute) {
                pathElement.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH);
            }
        });
        
        pathElement.addEventListener('click', () => {
            this.showRouteDetails(route);
        });
        
        group.appendChild(pathElement);
        this.drawnRoutes.set(route.id, { element: pathElement, route: route });
    },

    generateSmoothPath(points) {
        if (points.length < 2) return '';
        
        if (points.length < 4) {
            let path = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                path += ` L ${points[i].x} ${points[i].y}`;
            }
            return path;
        }
        
        let path = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            const tension = 0.3;
            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            
            const cp1x = curr.x - dx1 * tension;
            const cp1y = curr.y - dy1 * tension;
            const cp2x = curr.x + dx2 * tension;
            const cp2y = curr.y + dy2 * tension;
            
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
        }
        
        return path;
    },

    extractRouteNumber(name) {
        if (!name) return 'N/A';
        const firstSpace = name.indexOf(' ');
        return firstSpace > 0 ? name.substring(0, firstSpace) : name.substring(0, 20);
    },

    showRouteDetails(route) {
        const panel = document.getElementById('infoPanel');
        const title = document.getElementById('infoTitle');
        const content = document.getElementById('infoContent');
        
        const routeNumber = this.extractRouteNumber(route.name);
        const routeInfo = Utils.parseRoute(routeNumber);
        
        title.innerHTML = `
            ${Utils.getRouteBadgeHTML(routeNumber)} 
            <span style="font-size: 16px">${routeInfo.name} ${routeNumber}</span>
        `;
        
        let stopsHTML = '';
        
        if (route.stopsList && route.stopsList.length > 0) {
            stopsHTML = route.stopsList.map(stop => 
                `<div class="timeline-item">${stop.name}</div>`
            ).join('');
        } else if (route.pathDescription || route.description) {
            const desc = route.pathDescription || route.description;
            const stops = desc.split(',').map(s => s.trim());
            stopsHTML = stops.map(stopName => 
                `<div class="timeline-item">${stopName}</div>`
            ).join('');
        } else {
            stopsHTML = '<div style="color: var(--text-muted)">Список остановок недоступен</div>';
        }

        content.innerHTML = `
            <div style="margin-top: 16px;">
                <strong style="display:block; margin-bottom:12px;">Маршрут следования:</strong>
                <div class="route-timeline" style="max-height: 300px; overflow-y: auto; padding-right: 8px;">
                    ${stopsHTML}
                </div>
            </div>
            <button onclick="MapManager.highlightRouteOnMap(${route.id})" 
                    style="width: 100%; padding: 10px; margin-top: 16px; background: var(--primary-color); 
                           color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Показать на карте
            </button>
        `;
        
        panel.classList.add('show');
    },

    /**
     * НОВОЕ: Подсветка маршрута на карте при выборе из легенды
     */
    highlightRouteOnMap(routeId) {
        const routeData = this.drawnRoutes.get(routeId);
        if (!routeData) {
            ConfigHelper.warn('Маршрут не найден:', routeId);
            return;
        }

        // Сбрасываем предыдущую подсветку
        this.clearRouteHighlight();
        
        this.highlightedRoute = routeId;
        const { element, route } = routeData;
        
        // Затемняем все остальные маршруты
        this.drawnRoutes.forEach((data, id) => {
            if (id !== routeId) {
                data.element.style.opacity = '0.15';
                data.element.style.strokeWidth = CONFIG.VISUAL.ROUTE_WIDTH / 2;
            }
        });
        
        // Подсвечиваем выбранный маршрут
        element.style.opacity = '1';
        element.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH_HOVER + 2);
        element.style.filter = 'drop-shadow(0 0 8px rgba(0,0,0,0.5))';
        
        // Подсвечиваем остановки этого маршрута
        if (route.stopsList) {
            route.stopsList.forEach(stop => {
                const drawnStop = this.drawnStops.get(stop.id);
                if (drawnStop) {
                    drawnStop.circle.setAttribute('r', CONFIG.VISUAL.STOP_RADIUS_SELECTED);
                    drawnStop.circle.setAttribute('fill', element.getAttribute('stroke'));
                    drawnStop.circle.style.filter = 'drop-shadow(0 0 4px rgba(0,0,0,0.5))';
                    
                    // Показываем названия остановок этого маршрута
                    drawnStop.label.style.display = 'block';
                    drawnStop.label.style.fontWeight = '700';
                    drawnStop.label.style.fill = element.getAttribute('stroke');
                }
            });
        }
        
        ConfigHelper.log('Маршрут подсвечен:', route.name);
        
        // Автоматически сбрасываем через 10 секунд
        setTimeout(() => {
            if (this.highlightedRoute === routeId) {
                this.clearRouteHighlight();
            }
        }, 10000);
    },

    /**
     * НОВОЕ: Очистка подсветки маршрута
     */
    clearRouteHighlight() {
        if (!this.highlightedRoute) return;
        
        // Восстанавливаем все маршруты
        this.drawnRoutes.forEach((data) => {
            data.element.style.opacity = '1';
            data.element.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH);
            data.element.style.filter = '';
        });
        
        // Восстанавливаем все остановки
        this.drawnStops.forEach((data) => {
            const isSelected = this.selectedStop && 
                             String(this.selectedStop.id) === String(data.circle.parentElement?.dataset?.stopId);
            
            if (!isSelected) {
                data.circle.setAttribute('r', CONFIG.VISUAL.STOP_RADIUS);
                data.circle.setAttribute('fill', 'var(--stop-fill)');
                data.circle.style.filter = '';
                data.label.style.fill = 'var(--text-primary)';
            }
        });
        
        this.highlightedRoute = null;
        this.updateLabelsVisibility();
    },

    /**
     * ИСПРАВЛЕНО: Отрисовка остановок - текст над точками
     */
    drawStops(stops) {
        ConfigHelper.log('Рисуем остановки...');
        
        const stopsGroup = Utils.createSVGElement('g', {
            id: 'stopsGroup'
        });
        this.mapGroup.appendChild(stopsGroup);
        
        stops.forEach(stop => {
            const stopGroup = Utils.createSVGElement('g', {
                'data-stop-id': stop.id,
                class: 'stop-group'
            });
            
            // Круг остановки
            const circle = Utils.createSVGElement('circle', {
                cx: stop.x,
                cy: stop.y,
                r: CONFIG.VISUAL.STOP_RADIUS,
                fill: 'white',
                stroke: '#333',
                'stroke-width': 2,
                class: 'stop-circle'
            });
            
            circle.addEventListener('mouseenter', () => {
                if (!this.highlightedRoute) {
                    circle.setAttribute('r', CONFIG.VISUAL.STOP_RADIUS_HOVER);
                }
            });
            
            circle.addEventListener('mouseleave', () => {
                if (this.selectedStop?.id !== stop.id && !this.highlightedRoute) {
                    circle.setAttribute('r', CONFIG.VISUAL.STOP_RADIUS);
                }
            });
            
            circle.addEventListener('click', () => {
                this.selectStop(stop);
            });
            
            stopGroup.appendChild(circle);
            
            // Название остановки
            const label = Utils.createSVGElement('text', {
                x: stop.x + CONFIG.VISUAL.LABEL_OFFSET_X,
                y: stop.y + CONFIG.VISUAL.LABEL_OFFSET_Y,
                class: 'stop-label',
                style: 'display: none;' // Изначально скрыто
            });
            label.textContent = stop.name;
            stopGroup.appendChild(label);
            
            stopsGroup.appendChild(stopGroup);
            this.drawnStops.set(stop.id, { group: stopGroup, circle, label });
        });
    },

    selectStop(stop) {
        ConfigHelper.log('Выбрана остановка:', stop.name);
        
        // Сбрасываем подсветку маршрута
        this.clearRouteHighlight();
        
        if (this.selectedStop) {
            const prev = this.drawnStops.get(this.selectedStop.id);
            if (prev) {
                prev.circle.setAttribute('fill', 'white');
                prev.circle.setAttribute('r', CONFIG.VISUAL.STOP_RADIUS);
            }
        }
        
        this.selectedStop = stop;
        const current = this.drawnStops.get(stop.id);
        if (current) {
            current.circle.setAttribute('fill', CONFIG.VISUAL.TRANSPORT_COLORS.default);
            current.circle.setAttribute('r', CONFIG.VISUAL.STOP_RADIUS_SELECTED);
        }
        
        this.centerOnStop(stop);
        this.showStopInfo(stop);
        
        if (window.SearchManager) {
            SearchManager.highlightStop(stop);
        }
    },

    centerOnStop(stop) {
        const centerX = this.svg.clientWidth / 2;
        const centerY = this.svg.clientHeight / 2;
        
        const targetX = centerX - stop.x * this.scale;
        const targetY = centerY - stop.y * this.scale;
        
        Utils.animate(
            this.translateX,
            targetX,
            CONFIG.MAP.ANIMATION_DURATION,
            (value) => {
                this.translateX = value;
                this.updateTransform();
            }
        );
        
        Utils.animate(
            this.translateY,
            targetY,
            CONFIG.MAP.ANIMATION_DURATION,
            (value) => {
                this.translateY = value;
                this.updateTransform();
            }
        );
    },

    showStopInfo(stop) {
        const panel = document.getElementById('infoPanel');
        const title = document.getElementById('infoTitle');
        const content = document.getElementById('infoContent');
        
        title.textContent = stop.name;
        
        const routes = stop.routesList || [];
        const badgesHtml = routes.map(r => Utils.getRouteBadgeHTML(r)).join(' ');

        content.innerHTML = `
            <div style="margin-bottom: 12px; color: #666; font-size: 13px;">
                🚏 Остановка транспорта
            </div>
            
            <div class="stop-routes" style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${badgesHtml}
            </div>

            <div class="action-buttons">
                <button class="action-btn btn-from" onclick="setRoutePoint('from', ${stop.id})">
                    <span>📍</span> Отсюда
                </button>
                <button class="action-btn btn-to" onclick="setRoutePoint('to', ${stop.id})">
                    <span>🎯</span> Сюда
                </button>
            </div>
        `;
        
        panel.classList.add('show');
    },

    showRouteInfo(routeId, stop1, stop2) {
        const panel = document.getElementById('infoPanel');
        const title = document.getElementById('infoTitle');
        const content = document.getElementById('infoContent');
        
        title.textContent = `Маршрут между остановками`;
        
        content.innerHTML = `
            <div style="margin-bottom: 8px;">
                <strong>От:</strong> ${stop1.name}
            </div>
            <div style="margin-bottom: 16px;">
                <strong>До:</strong> ${stop2.name}
            </div>
            <div style="font-size: 13px; color: #666;">
                Расстояние: ${Utils.formatDistance(
                    Utils.calculateDistance(stop1.latitude, stop1.longitude, stop2.latitude, stop2.longitude)
                )}
            </div>
        `;
        
        panel.classList.add('show');
    },

    updateLegend(routes) {
        const legendContent = document.getElementById('legendContent');
        if (!legendContent) return;
        
        legendContent.innerHTML = '';
        
        if (!routes || routes.length === 0) {
            legendContent.innerHTML = '<div style="text-align: center; color: #999; padding: 10px;">Нет маршрутов</div>';
            return;
        }
        
        const routesByType = {
            bus: [],
            minibus: [],
            trolleybus: [],
            default: []
        };
        
        routes.forEach(route => {
            const type = route.transportType || 'default';
            if (routesByType[type]) {
                routesByType[type].push(route);
            } else {
                routesByType.default.push(route);
            }
        });
        
        const typeNames = {
            bus: 'Автобусы',
            minibus: 'Маршрутки',
            trolleybus: 'Троллейбусы',
            default: 'Другой транспорт'
        };
        
        Object.entries(routesByType).forEach(([type, routesList]) => {
            if (routesList.length === 0) return;
            
            const header = document.createElement('div');
            header.style.cssText = 'font-weight: 600; margin: 12px 0 8px 0; color: #333; font-size: 13px;';
            header.textContent = typeNames[type];
            legendContent.appendChild(header);
            
            routesList.forEach(route => {
                const item = document.createElement('div');
                item.className = 'legend-item';
                
                const routeNumber = this.extractRouteNumber(route.name);
                
                item.innerHTML = `
                    <div class="legend-color" style="background: ${route.color}"></div>
                    <div class="legend-label">${routeNumber}</div>
                `;
                
                // Клик для подсветки маршрута
                item.addEventListener('click', () => {
                    this.highlightRouteOnMap(route.id);
                    this.showRouteDetails(route);
                });
                
                legendContent.appendChild(item);
            });
        });
    },

    extractRouteNumber(name) {
        if (!name) return 'N/A';
        const match = name.match(/^(\w+)\s/);
        return match ? match[1] : name.substring(0, 20);
    },

    highlightRoute(route) {
        this.drawnRoutes.forEach(routeElement => {
            routeElement.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH);
            routeElement.style.opacity = '0.5';
        });
        
        const routeElement = this.drawnRoutes.get(route.id);
        if (routeElement) {
            routeElement.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH_HOVER);
            routeElement.style.opacity = '1';
            
            setTimeout(() => {
                this.drawnRoutes.forEach(el => {
                    el.setAttribute('stroke-width', CONFIG.VISUAL.ROUTE_WIDTH);
                    el.style.opacity = '1';
                });
            }, 3000);
        }
    },

    initControls() {
        this.svg.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragStartX = e.clientX - this.translateX;
            this.dragStartY = e.clientY - this.translateY;
            this.svg.style.cursor = 'grabbing';
        });
        
        this.svg.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.translateX = e.clientX - this.dragStartX;
            this.translateY = e.clientY - this.dragStartY;
            this.updateTransform();
        });
        
        const stopDragging = () => {
            this.isDragging = false;
            this.svg.style.cursor = 'grab';
        };
        
        this.svg.addEventListener('mouseup', stopDragging);
        this.svg.addEventListener('mouseleave', stopDragging);
        
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const newScale = Math.max(
                CONFIG.MAP.MIN_ZOOM,
                Math.min(CONFIG.MAP.MAX_ZOOM, this.scale * delta)
            );
            
            if (newScale !== this.scale) {
                this.translateX = mouseX - (mouseX - this.translateX) * (newScale / this.scale);
                this.translateY = mouseY - (mouseY - this.translateY) * (newScale / this.scale);
                this.scale = newScale;
                this.updateTransform();
            }
        });
    },

    updateTransform() {
        if (this.mapGroup) {
            this.mapGroup.setAttribute(
                'transform',
                `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`
            );
        }
        this.updateLabelsVisibility();
    },

    /**
     * ИСПРАВЛЕНО: Улучшенная адаптация при zoom
     */
    updateLabelsVisibility() {
        const showLabels = this.scale > CONFIG.VISUAL.LABEL_MIN_ZOOM;
        const displayedNames = new Set();
        const labelSpacing = CONFIG.VISUAL.LABEL_MIN_DISTANCE / this.scale;

        const labels = document.querySelectorAll('.stop-label');
        const circles = document.querySelectorAll('.stop-circle');
        const routes = document.querySelectorAll('.route-line');
        
        const visibleLabels = [];
        
        // ИСПРАВЛЕНО: Адаптивный размер текста
        const baseFontSize = 11;
        const scaledFontSize = Math.max(8, Math.min(14, baseFontSize / Math.sqrt(this.scale)));
        
        labels.forEach((label, idx) => {
            const name = label.textContent;
            const stopId = label.parentElement?.dataset?.stopId;
            const isSelected = this.selectedStop && String(this.selectedStop.id) === String(stopId);
            
            // Для подсвеченного маршрута показываем все остановки
            const isInHighlightedRoute = this.highlightedRoute && 
                                        this.drawnRoutes.get(this.highlightedRoute)?.route.stopsList
                                        ?.some(s => String(s.id) === String(stopId));

            if (isSelected || isInHighlightedRoute) {
                label.style.display = 'block';
                label.style.fontWeight = 'bold';
                label.style.fontSize = `${Math.max(10, scaledFontSize + 2)}px`;
                visibleLabels.push(label);
                return;
            }

            if (!showLabels) {
                label.style.display = 'none';
            } else {
                if (displayedNames.has(name)) {
                    label.style.display = 'none';
                } else {
                    let hasCollision = false;
                    try {
                        const bbox = label.getBBox();
                        for (const existingLabel of visibleLabels) {
                            const existingBbox = existingLabel.getBBox();
                            const distance = Math.sqrt(
                                Math.pow(bbox.x - existingBbox.x, 2) + 
                                Math.pow(bbox.y - existingBbox.y, 2)
                            );
                            if (distance < labelSpacing) {
                                hasCollision = true;
                                break;
                            }
                        }
                    } catch (e) {}

                    if (hasCollision) {
                        label.style.display = 'none';
                    } else {
                        label.style.display = 'block';
                        displayedNames.add(name);
                        visibleLabels.push(label);
                        label.style.fontSize = `${scaledFontSize}px`;
                        label.style.fontWeight = '600';
                    }
                }
            }
        });

        // ИСПРАВЛЕНО: Адаптивная толщина линий
        routes.forEach(line => {
            if (this.highlightedRoute) return; // Не трогаем если маршрут подсвечен
            
            const baseWidth = parseFloat(line.getAttribute('data-base-width')) || CONFIG.VISUAL.ROUTE_WIDTH;
            const scaledWidth = Math.max(1, baseWidth / Math.pow(this.scale, 0.5));
            line.style.strokeWidth = scaledWidth;
        });
        
        // ИСПРАВЛЕНО: Адаптивный размер точек
        circles.forEach(circle => {
            const stopId = circle.parentElement?.dataset?.stopId;
            const isSelected = this.selectedStop && String(this.selectedStop.id) === String(stopId);
            const isInHighlightedRoute = this.highlightedRoute && 
                                        this.drawnRoutes.get(this.highlightedRoute)?.route.stopsList
                                        ?.some(s => String(s.id) === String(stopId));
            
            let baseRadius = CONFIG.VISUAL.STOP_RADIUS;
            if (isSelected) baseRadius = CONFIG.VISUAL.STOP_RADIUS_SELECTED;
            else if (isInHighlightedRoute) baseRadius = CONFIG.VISUAL.STOP_RADIUS_HOVER;
            
            const scaledRadius = Math.max(2, baseRadius / Math.pow(this.scale, 0.6));
            circle.setAttribute('r', scaledRadius);
            
            const scaledStroke = Math.max(1, 2 / Math.pow(this.scale, 0.5));
            circle.style.strokeWidth = scaledStroke;
        });
    },

    clear() {
        if (this.mapGroup) {
            while (this.mapGroup.firstChild) {
                this.mapGroup.removeChild(this.mapGroup.firstChild);
            }
        }
        this.drawnStops.clear();
        this.drawnRoutes.clear();
        this.selectedStop = null;
        this.highlightedRoute = null;
    },

    drawRouteOnMap(route) {
        if (!route || !route.stops || route.stops.length < 2) {
            ConfigHelper.warn('Нет маршрута для отрисовки');
            return;
        }
        
        const oldHighlight = document.getElementById('routeHighlight');
        if (oldHighlight) {
            oldHighlight.remove();
        }
        
        const highlightGroup = Utils.createSVGElement('g', {
            id: 'routeHighlight'
        });
        
        const stopsGroup = document.getElementById('stopsGroup');
        if (stopsGroup) {
            this.mapGroup.insertBefore(highlightGroup, stopsGroup);
        } else {
            this.mapGroup.appendChild(highlightGroup);
        }
        
        route.segments.forEach((segment, idx) => {
            const points = segment.stops.map(s => ({ x: s.x, y: s.y }));
            const pathString = this.generateSmoothPath(points);
            
            let color = '#4CAF50';
            if (segment.isWalking) {
                color = '#999';
            } else if (segment.routeId) {
                const routeData = DataManager.routes.find(r => r.id === segment.routeId);
                if (routeData) {
                    color = routeData.color;
                }
            }
            
            const pathBg = Utils.createSVGElement('path', {
                d: pathString,
                stroke: 'white',
                'stroke-width': CONFIG.VISUAL.ROUTE_WIDTH_HOVER + 4,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
                fill: 'none',
                opacity: '0.8'
            });
            highlightGroup.appendChild(pathBg);
            
            const path = Utils.createSVGElement('path', {
                d: pathString,
                stroke: color,
                'stroke-width': CONFIG.VISUAL.ROUTE_WIDTH_HOVER,
                'stroke-linecap': 'round',
                'stroke-linejoin': 'round',
                fill: 'none',
                'stroke-dasharray': segment.isWalking ? '10,5' : 'none'
            });
            highlightGroup.appendChild(path);
            
            const length = path.getTotalLength();
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
            path.style.animation = `drawPath 1s ease-out ${idx * 0.2}s forwards`;
        });
        
        if (!document.getElementById('pathAnimation')) {
            const style = document.createElement('style');
            style.id = 'pathAnimation';
            style.textContent = `
                @keyframes drawPath {
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        route.stops.forEach((stop, idx) => {
            const drawnStop = this.drawnStops.get(stop.id);
            if (drawnStop) {
                drawnStop.circle.setAttribute('fill', '#4CAF50');
                drawnStop.circle.setAttribute('r', CONFIG.VISUAL.STOP_RADIUS_HOVER);
                
                if (idx === 0 || idx === route.stops.length - 1) {
                    const marker = Utils.createSVGElement('text', {
                        x: stop.x,
                        y: stop.y,
                        'text-anchor': 'middle',
                        'dominant-baseline': 'middle',
                        fill: 'white',
                        'font-size': '10',
                        'font-weight': 'bold',
                        style: 'pointer-events: none;'
                    });
                    marker.textContent = idx === 0 ? 'A' : 'B';
                    highlightGroup.appendChild(marker);
                }
            }
        });
        
        this.fitRouteToBounds(route.stops);
        
        ConfigHelper.log('Маршрут отрисован на карте');
    },

    fitRouteToBounds(stops) {
        if (!stops || stops.length === 0) return;
        
        const xs = stops.map(s => s.x);
        const ys = stops.map(s => s.y);
        
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const svgWidth = this.svg.clientWidth;
        const svgHeight = this.svg.clientHeight;
        
        const scaleX = (svgWidth * 0.8) / width;
        const scaleY = (svgHeight * 0.8) / height;
        const targetScale = Math.min(scaleX, scaleY, CONFIG.MAP.MAX_ZOOM);
        
        const targetX = svgWidth / 2 - centerX * targetScale;
        const targetY = svgHeight / 2 - centerY * targetScale;
        
        Utils.animate(
            this.scale,
            targetScale,
            CONFIG.MAP.ANIMATION_DURATION * 1.5,
            (value) => {
                this.scale = value;
                this.updateTransform();
            }
        );
        
        Utils.animate(
            this.translateX,
            targetX,
            CONFIG.MAP.ANIMATION_DURATION * 1.5,
            (value) => {
                this.translateX = value;
                this.updateTransform();
            }
        );
        
        Utils.animate(
            this.translateY,
            targetY,
            CONFIG.MAP.ANIMATION_DURATION * 1.5,
            (value) => {
                this.translateY = value;
                this.updateTransform();
            }
        );
    }
};

// Глобальные функции управления для кнопок
function zoomIn() {
    const centerX = MapManager.svg.clientWidth / 2;
    const centerY = MapManager.svg.clientHeight / 2;
    
    const newScale = Math.min(CONFIG.MAP.MAX_ZOOM, MapManager.scale * CONFIG.MAP.ZOOM_STEP);
    MapManager.translateX = centerX - (centerX - MapManager.translateX) * (newScale / MapManager.scale);
    MapManager.translateY = centerY - (centerY - MapManager.translateY) * (newScale / MapManager.scale);
    MapManager.scale = newScale;
    MapManager.updateTransform();
}

function zoomOut() {
    const centerX = MapManager.svg.clientWidth / 2;
    const centerY = MapManager.svg.clientHeight / 2;
    
    const newScale = Math.max(CONFIG.MAP.MIN_ZOOM, MapManager.scale / CONFIG.MAP.ZOOM_STEP);
    MapManager.translateX = centerX - (centerX - MapManager.translateX) * (newScale / MapManager.scale);
    MapManager.translateY = centerY - (centerY - MapManager.translateY) * (newScale / MapManager.scale);
    MapManager.scale = newScale;
    MapManager.updateTransform();
}

function resetView() {
    MapManager.scale = 1;
    MapManager.translateX = 0;
    MapManager.translateY = 0;
    MapManager.clearRouteHighlight();
    MapManager.updateTransform();
}

function closeInfo() {
    const panel = document.getElementById('infoPanel');
    panel.classList.remove('show');
}

function toggleLegend() {
    const content = document.getElementById('legendContent');
    const toggle = document.querySelector('.legend-toggle');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '−';
    } else {
        content.style.display = 'none';
        toggle.textContent = '+';
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapManager;
}