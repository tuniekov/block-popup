/**
 * Block Popup - DOM Utilities Module
 * Утилиты для работы с DOM
 */

// Проверка, является ли элемент критически важным для работы сайта
window.BlockPopup.isCriticalElement = function(element) {
  try {
    // Критически важные элементы, которые нельзя блокировать
    const criticalTags = ['HTML', 'HEAD', 'BODY', 'SCRIPT', 'STYLE', 'LINK', 'META'];
    const criticalClasses = ['zen-layout', 'zen-app', 'zen-header', 'zen-footer', 'zen-navigation'];
    const criticalIds = ['root', 'app', 'main', 'header', 'footer', 'navigation'];
    
    // Проверяем тег
    if (criticalTags.includes(element.tagName)) {
      return {
        isCritical: true,
        reason: `Критический тег: ${element.tagName}`,
        ruleType: 'tag',
        value: element.tagName
      };
    }
    
    // Проверяем ID
    if (element.id) {
      const matchedId = criticalIds.find(id => element.id.toLowerCase().includes(id));
      if (matchedId) {
        return {
          isCritical: true,
          reason: `Критический ID: ${element.id} (содержит "${matchedId}")`,
          ruleType: 'id',
          value: matchedId
        };
      }
    }
    
    // Проверяем классы
    if (element.className) {
      const matchedClass = criticalClasses.find(cls => element.classList.contains(cls));
      if (matchedClass) {
        return {
          isCritical: true,
          reason: `Критический класс: ${matchedClass}`,
          ruleType: 'class',
          value: matchedClass
        };
      }
    }
    
    // Проверяем, является ли элемент частью основного контента
    const role = element.getAttribute('role');
    if (role === 'main' || role === 'navigation' || role === 'banner') {
      return {
        isCritical: true,
        reason: `Критическая роль: ${role}`,
        ruleType: 'role',
        value: role
      };
    }
    
    return {
      isCritical: false,
      reason: null,
      ruleType: null,
      value: null
    };
  } catch (error) {
    return {
      isCritical: true,
      reason: `Ошибка при проверке: ${error.message}`,
      ruleType: 'error',
      value: error.message
    };
  }
};

// Проверка, является ли элемент потенциальным попапом
window.BlockPopup.isPotentialPopup = function(element, style) {
  try {
    // Проверяем позиционирование
    const position = style.position;
    const zIndex = parseInt(style.zIndex) || 0;
    
    // Проверяем размеры
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // window.BlockPopup.debugLog('isPotentialPopup element', element);
    // window.BlockPopup.debugLog('isPotentialPopup', position, zIndex);
    // window.BlockPopup.debugLog('isPotentialPopup viewport', rect.width, viewportWidth, rect.height, viewportHeight);
    // window.BlockPopup.debugLog('isPotentialPopup', style.display, style.visibility);
    // window.BlockPopup.debugLog('isPotentialPopup opacity', style.opacity);
    
    // Критерии попапа:
    return (
      // 1. Фиксированное или абсолютное позиционирование
      (position === 'fixed' || position === 'absolute') &&
      
      // 2. Высокий z-index
      zIndex > 1 &&
      
      // 3. Значительный размер (не маленькая кнопка)
      (rect.width > viewportWidth * 0.05 || rect.height > viewportHeight * 0.05)
    );
  } catch (error) {
    window.BlockPopup.debugLog('Ошибка при проверке попапа:', error);
    return false;
  }
};

// Проверка содержимого на наличие словосочетания
window.BlockPopup.containsPhrase = function(text, phrase) {
  try {
    if (!text || !phrase) return false;
    
    // Нормализуем текст и фразу
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedPhrase = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Проверяем точное совпадение словосочетания
    return normalizedText.includes(normalizedPhrase);
  } catch (error) {
    return false;
  }
};

// Проверка энтропии строки (для определения случайно сгенерированных селекторов)
window.BlockPopup.calculateEntropy = function(str) {
  try {
    if (!str || str.length === 0) return 0;
    
    const charCounts = {};
    for (const char of str) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    
    let entropy = 0;
    const length = str.length;
    
    for (const count of Object.values(charCounts)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  } catch (error) {
    return 0;
  }
};

// Проверка, является ли строка случайно сгенерированной
window.BlockPopup.isRandomGenerated = function(str) {
  try {
    if (!str || str.length < 6) return false;
    
    // Высокая энтропия указывает на случайную генерацию
    const entropy = window.BlockPopup.calculateEntropy(str);
    const entropyThreshold = 3.5; // Порог энтропии
    
    // Проверяем паттерны случайной генерации
    const hasRandomPattern = (
      // Много цифр и букв вперемешку
      /[a-zA-Z].*\d.*[a-zA-Z]/.test(str) ||
      // Длинные последовательности случайных символов
      str.length > 12 ||
      // Высокая энтропия
      entropy > entropyThreshold
    );
    
    // Исключения для известных паттернов
    const isKnownPattern = (
      // BEM методология
      /^[a-z]+(-[a-z]+)*(__[a-z]+(-[a-z]+)*)?(--[a-z]+(-[a-z]+)*)?$/.test(str) ||
      // Обычные CSS классы
      /^[a-z-]+$/.test(str) ||
      // Короткие осмысленные названия
      str.length <= 8
    );
    
    return hasRandomPattern && !isKnownPattern;
  } catch (error) {
    return false;
  }
};

// Поиск стабильного селектора для элемента
window.BlockPopup.findStableSelector = function(element) {
  try {
    // Проверяем атрибуты в порядке приоритета
    const attributes = [
      'data-testid',
      'data-test',
      'data-cy',
      'data-automation',
      'role',
      'aria-label',
      'title',
      'alt'
    ];
    
    for (const attr of attributes) {
      const value = element.getAttribute(attr);
      if (value && !window.BlockPopup.isRandomGenerated(value)) {
        return `[${attr}="${value}"]`;
      }
    }
    
    // Проверяем текстовое содержимое
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length > 3 && textContent.length < 50) {
      // Используем частичное совпадение текста
      return null; // Вернем null, чтобы использовать content rule
    }
    
    // Проверяем родительские элементы на стабильные селекторы
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
      for (const attr of attributes) {
        const value = parent.getAttribute(attr);
        if (value && !window.BlockPopup.isRandomGenerated(value)) {
          const childSelector = element.tagName.toLowerCase();
          return `[${attr}="${value}"] ${childSelector}`;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

// Умное извлечение стабильного текста из содержимого элемента
window.BlockPopup.extractStableTextPattern = function(textContent) {
  try {
    if (!textContent || textContent.length < 3) return null;
    
    // Убираем лишние пробелы и переносы строк
    const cleanText = textContent.replace(/\s+/g, ' ').trim();
    
    // Разделяем на слова
    const words = cleanText.split(/\s+/);
    
    // Ищем текстовые части, исключая числа и смешанный контент
    const textWords = words.filter(word => {
      // Исключаем чисто числовые значения
      if (/^\d+$/.test(word)) return false;
      
      // Исключаем очень короткие слова (предлоги, союзы)
      if (word.length < 2) return false;
      
      // Исключаем слова с большим количеством цифр (более 30% символов)
      const digitCount = (word.match(/\d/g) || []).length;
      if (digitCount > word.length * 0.3) return false;
      
      // Исключаем слова, которые начинаются или заканчиваются цифрами и содержат смешанный контент
      // Например: "1,5K52", "123abc", "abc123"
      if (/^\d/.test(word) && /[a-zA-Zа-яА-Я]/.test(word)) return false;
      if (/\d$/.test(word) && /[a-zA-Zа-яА-Я]/.test(word)) return false;
      
      // Исключаем слова с символами валют, процентов и другими специальными символами вместе с цифрами
      if (/[\d.,]+[K|M|B|%|$|€|₽|£]/.test(word)) return false;
      
      // Исключаем слова, содержащие только символы и цифры без букв
      if (!/[a-zA-Zа-яА-Я]/.test(word)) return false;
      
      return true;
    });
    
    if (textWords.length === 0) return null;
    
    // Берем первые 2-3 значимых слова
    const significantWords = textWords.slice(0, 3);
    const pattern = significantWords.join(' ');
    
    // Проверяем, что паттерн достаточно длинный и содержательный
    if (pattern.length >= 4 && pattern.length <= 30) {
      return pattern;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

console.log('[Block Popup] DOM Utils module loaded');
