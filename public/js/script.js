$(document).ready(function() {
  let currentType = 'all';
  
  // Инициализация переключателя
  $('.type-btn').click(function() {
    $('.type-btn').removeClass('active');
    $(this).addClass('active');
    currentType = $(this).data('type');
    applyFilters();
  });

  // Обработчики для всех фильтров
  $('#city-filter, #category-filter').on('change', applyFilters);
  $('#search-input').on('input', applyFilters);

  // Основная функция фильтрации
  function applyFilters() {
    const cityFilter = $('#city-filter').val();
    const categoryFilter = $('#category-filter').val();
    const searchText = $('#search-input').val().toLowerCase().trim();
    
    let hasVisibleItems = false;
    
    $('.item-card').each(function() {
      const $card = $(this);
      const itemType = $card.data('type');
      const itemCity = $card.data('city');
      const itemCategory = $card.data('category');
      const title = $card.find('h3').text().toLowerCase();
      const description = $card.find('.description').text().toLowerCase();
      
      // Проверка всех условий фильтрации
      const typeMatch = currentType === 'all' || itemType === currentType;
      const cityMatch = cityFilter === 'all' || itemCity === cityFilter;
      const categoryMatch = categoryFilter === 'all' || itemCategory === categoryFilter;
      const searchMatch = searchText === '' || 
                         title.includes(searchText) || 
                         description.includes(searchText);
      
      const isVisible = typeMatch && cityMatch && categoryMatch && searchMatch;
      $card.toggle(isVisible);
      
      // Подсветка результатов поиска
      if (searchText) {
        highlightMatches($card, searchText);
      } else {
        $card.find('.highlight').contents().unwrap();
      }
      
      if (isVisible) hasVisibleItems = true;
    });
    
    // Показываем сообщение, если ничего не найдено
    $('#no-results-message').toggle(!hasVisibleItems);
  }
  
  // Функция подсветки совпадений
  function highlightMatches($element, searchText) {
    ['h3', '.description'].forEach(selector => {
      $element.find(selector).each(function() {
        const $el = $(this);
        const text = $el.text();
        const highlighted = text.replace(
          new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
          match => `<span class="highlight">${match}</span>`
        );
        $el.html(highlighted);
      });
    });
  }
  
  // Применяем фильтры при загрузке страницы
  applyFilters();
});