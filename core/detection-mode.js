/**
 * Block Popup - Detection Mode Module
 * Режим определения попапов
 */

// Запуск режима определения попапов
window.BlockPopup.startDetectionMode = function() {
  try {
    window.BlockPopup.isDetectionMode = true;
    window.BlockPopup.detectedPopups.clear();
    
    window.BlockPopup.debugLog('Режим определения попапов включен');
    // Анализируем все элементы на странице
    const allElements = document.querySelectorAll('*');
    let analyzedCount = 0;
    
    for (const element of allElements) {

      if (element && element.nodeType === Node.ELEMENT_NODE && document.contains(element)) {

        const criticalResult = window.BlockPopup.isCriticalElement(element);
        if (criticalResult.isCritical) {
          // Пропускаем критически важные элементы
          // window.BlockPopup.debugLog('Пропущен критический элемент:', criticalResult.reason);
          continue;
        }
        
        // Анализируем элемент с задержкой
        setTimeout(() => {
          window.BlockPopup.analyzeElement(element, []);
          analyzedCount++;
        }, 10 + analyzedCount * 2); // Увеличиваем задержку для каждого элемента
      }
    }
    
    window.BlockPopup.debugLog('Запущен анализ элементов для поиска попапов');
    
  } catch (error) {
    console.error('[Block Popup] Ошибка при запуске режима определения:', error);
  }
};

// Остановка режима определения попапов
window.BlockPopup.stopDetectionMode = function() {
  try {
    window.BlockPopup.isDetectionMode = false;
    
    // Убираем все индикаторы
    window.BlockPopup.detectedPopups.forEach(element => {
      if (element && element.classList && document.contains(element)) {
        element.classList.remove('popup-blocker-detected');
      }
    });
    window.BlockPopup.detectedPopups.clear();
    
    window.BlockPopup.debugLog('Режим определения попапов отключен');
  } catch (error) {
    console.error('[Block Popup] Ошибка при остановке режима определения:', error);
  }
};

console.log('[Block Popup] Detection Mode module loaded');
