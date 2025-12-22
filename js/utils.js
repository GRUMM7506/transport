/**
 * utils.js
 * Вспомогательные функции и утилиты
 */

const Utils = {
    /**
     * Debounce функция для оптимизации поиска
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle функция для ограничения частоты вызовов
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Вычисление расстояния между двумя точками (формула гаверсинуса)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Радиус Земли в км
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c * 1000; // Возвращаем в метрах
    },

    /**
     * Преобразование градусов в радианы
     */
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    },

    /**
     * Преобразование географических координат в координаты схемы
     */
    createCoordinateTransformer(stops, width, height, padding) {
        // Находим границы
        const lats = stops.map(s => s.latitude);
        const lngs = stops.map(s => s.longitude);
        
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        if (maxLat - minLat < 0.0001) {
            maxLat += 0.005;
            minLat -= 0.005;
        }
        if (maxLng - minLng < 0.0001) {
            maxLng += 0.005;
            minLng -= 0.005;
        }
        
        const schemeWidth = width - padding * 2;
        const schemeHeight = height - padding * 2;
        
        // Возвращаем функцию преобразования
        return {
            toScheme: (lat, lng) => {
                const x = ((lng - minLng) / (maxLng - minLng)) * schemeWidth + padding;
                const y = ((maxLat - lat) / (maxLat - minLat)) * schemeHeight + padding;
                return { x, y };
            },
            toGeo: (x, y) => {
                const lng = ((x - padding) / schemeWidth) * (maxLng - minLng) + minLng;
                const lat = maxLat - ((y - padding) / schemeHeight) * (maxLat - minLat);
                return { lat, lng };
            },
            bounds: { minLat, maxLat, minLng, maxLng }
        };
    },

    /**
     * Создание SVG элемента
     */
    createSVGElement(tag, attributes = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        return element;
    },

    /**
     * Генерация кривой Безье для плавных линий
     */
    generateBezierPath(points) {
        if (points.length < 2) return '';
        
        let path = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            
            // Для прямых отрезков используем просто L
            if (points.length < 4) {
                path += ` L ${curr.x} ${curr.y}`;
            } else {
                // Для сложных путей делаем сглаживание
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const tension = 0.3; // Коэффициент сглаживания
                
                if (i === 1) {
                    // Первая точка
                    path += ` Q ${prev.x + dx * tension} ${prev.y + dy * tension}, ${curr.x} ${curr.y}`;
                } else if (i === points.length - 1) {
                    // Последняя точка
                    path += ` Q ${prev.x + dx * (1 - tension)} ${prev.y + dy * (1 - tension)}, ${curr.x} ${curr.y}`;
                } else {
                    // Промежуточные точки
                    const next = points[i + 1];
                    const dx2 = next.x - curr.x;
                    const dy2 = next.y - curr.y;
                    
                    const cp1x = curr.x - dx * tension;
                    const cp1y = curr.y - dy * tension;
                    const cp2x = curr.x + dx2 * tension;
                    const cp2y = curr.y + dy2 * tension;
                    
                    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
                }
            }
        }
        
        return path;
    },

    /**
     * Упрощение пути (алгоритм Дугласа-Пекера)
     */
    simplifyPath(points, tolerance = 1) {
        if (points.length <= 2) return points;
        
        const sqTolerance = tolerance * tolerance;
        
        // Находим точку с максимальным расстоянием от линии
        let maxDist = 0;
        let maxIndex = 0;
        const first = points[0];
        const last = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.getPointToLineDistance(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }
        
        // Если максимальное расстояние больше допуска, рекурсивно упрощаем
        if (maxDist > sqTolerance) {
            const left = this.simplifyPath(points.slice(0, maxIndex + 1), tolerance);
            const right = this.simplifyPath(points.slice(maxIndex), tolerance);
            return left.slice(0, -1).concat(right);
        }
        
        return [first, last];
    },

    /**
     * Расстояние от точки до линии (квадрат расстояния)
     */
    getPointToLineDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        if (dx === 0 && dy === 0) {
            const pdx = point.x - lineStart.x;
            const pdy = point.y - lineStart.y;
            return pdx * pdx + pdy * pdy;
        }
        
        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
        
        if (t < 0) {
            const pdx = point.x - lineStart.x;
            const pdy = point.y - lineStart.y;
            return pdx * pdx + pdy * pdy;
        }
        
        if (t > 1) {
            const pdx = point.x - lineEnd.x;
            const pdy = point.y - lineEnd.y;
            return pdx * pdx + pdy * pdy;
        }
        
        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;
        const pdx = point.x - projX;
        const pdy = point.y - projY;
        
        return pdx * pdx + pdy * pdy;
    },

    /**
     * Анимация значения с easing
     */
    animate(from, to, duration, callback, easing = 'easeInOutQuad') {
        const start = performance.now();
        const delta = to - from;
        
        const easingFunctions = {
            linear: t => t,
            easeInQuad: t => t * t,
            easeOutQuad: t => t * (2 - t),
            easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
            easeInCubic: t => t * t * t,
            easeOutCubic: t => (--t) * t * t + 1
        };
        
        const easingFunc = easingFunctions[easing] || easingFunctions.linear;
        
        function step(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easingFunc(progress);
            
            callback(from + delta * easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(step);
            }
        }
        
        requestAnimationFrame(step);
    },

    /**
     * Форматирование времени в минутах в читаемый формат
     */
    formatTime(minutes) {
        if (minutes < 1) return 'менее минуты';
        if (minutes < 60) return `${Math.round(minutes)} мин`;
        
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        
        if (mins === 0) return `${hours} ч`;
        return `${hours} ч ${mins} мин`;
    },

    /**
     * Форматирование расстояния
     */
    formatDistance(meters) {
        if (meters < 1000) return `${Math.round(meters)} м`;
        return `${(meters / 1000).toFixed(1)} км`;
    },

    /**
     * Генерация уникального ID
     */
    generateId() {
        return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Проверка пересечения двух прямоугольников
     */
    rectsIntersect(rect1, rect2) {
        return !(rect1.right < rect2.left || 
                rect1.left > rect2.right || 
                rect1.bottom < rect2.top || 
                rect1.top > rect2.bottom);
    },

    /**
     * Получение границ элемента в SVG
     */
    getSVGBounds(element) {
        try {
            const bbox = element.getBBox();
            return {
                left: bbox.x,
                top: bbox.y,
                right: bbox.x + bbox.width,
                bottom: bbox.y + bbox.height,
                width: bbox.width,
                height: bbox.height
            };
        } catch (e) {
            return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        }
    },

    /**
     * Клонирование объекта
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Безопасное получение вложенного свойства
     */
    getNestedProperty(obj, path, defaultValue = null) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current?.[key] === undefined) {
                return defaultValue;
            }
            current = current[key];
        }
        
        return current;
    },

    parseRoute(routeStr) {
        if (!routeStr) return { type: 'default', num: '', full: '' };
        
        const prefix = routeStr.charAt(0).toLowerCase();
        const num = routeStr.slice(1);
        
        let type = 'default';
        let typeName = 'Транспорт';
        
        // Определяем тип по первой букве
        if (prefix === 'b') { type = 'bus'; typeName = 'Автобус'; }
        else if (prefix === 'm') { type = 'minibus'; typeName = 'Маршрутка'; }
        else if (prefix === 't') { type = 'trolleybus'; typeName = 'Троллейбус'; }
        else { 
            // Если буквы нет (просто "11"), считаем маршруткой
            return { type: 'minibus', num: routeStr, full: routeStr, name: 'Маршрутка' };
        }

        return { type, num, full: routeStr, name: typeName };
    },

    /**
     * Получение HTML бейджика для маршрута
     */
    getRouteBadgeHTML(routeStr) {
        const info = this.parseRoute(routeStr);
        // Цвета для разных типов
        const colors = {
            bus: '#E91E63',        // Розовый/Красный
            minibus: '#2196F3',    // Синий
            trolleybus: '#4CAF50', // Зеленый
            default: '#9E9E9E'     // Серый
        };
        
        const color = colors[info.type] || colors.default;
        
        return `
            <span class="route-badge" style="background-color: ${color}" title="${info.name}">
                <span style="opacity: 0.7; font-size: 0.8em; margin-right: 2px;">${info.type === 'default' ? '' : info.full.charAt(0).toUpperCase()}</span>${info.num}
            </span>
        `;
    }
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}