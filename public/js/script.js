$('#publish-btn').click(function() {
  window.location.href = '/publish';
});

$(document).ready(function() {
  let currentType = 'all';
  
  $('.type-btn').click(function() {
    $('.type-btn').removeClass('active');
    $(this).addClass('active');
    currentType = $(this).data('type');
    applyFilters();
  });

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
      
      const typeMatch = currentType === 'all' || itemType === currentType;
      const cityMatch = cityFilter === 'all' || itemCity === cityFilter;
      const categoryMatch = categoryFilter === 'all' || itemCategory === categoryFilter;
      const searchMatch = searchText === '' || 
                         title.includes(searchText) || 
                         description.includes(searchText);
      
      const isVisible = typeMatch && cityMatch && categoryMatch && searchMatch;
      $card.toggle(isVisible);
      
      if (searchText) {
        highlightMatches($card, searchText);
      } else {
        $card.find('.highlight').contents().unwrap();
      }
      
      if (isVisible) hasVisibleItems = true;
    });
    
    $('#no-results-message').toggle(!hasVisibleItems);
  }
  
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
  
  applyFilters();
});

$(document).on('click', '.item-card', function() {
  const $card = $(this);
  
  const itemData = {
    title: $card.find('h3').text(),
    city: $card.data('city'),
    category: $card.data('category'),
    location: $card.find('p:contains("Место:")').text().replace('Место: ', ''),
    date: $card.find('p:contains("Дата:")').text().replace('Дата: ', ''),
    storage: $card.find('p:contains("Срок хранения до:")').text().replace('Срок хранения до: ', ''),
    description: $card.data('description'),
    photo: $card.find('img').attr('src') || '',
    type: $card.data('type')
  };

  // Заполняем модальное окно
  $('#modal-title').text(itemData.title);
  $('#modal-city').text(itemData.city);
  $('#modal-location').text(itemData.location || 'Не указано');
  $('#modal-date').text(itemData.date);
  $('#modal-description').text(itemData.description || 'Описание отсутствует');
  
  const respondBtn = $('#respond-btn');
  if (itemData.type === 'found') {
    respondBtn.text('Откликнуться').removeClass('lost').addClass('found');
  } else if (itemData.type === 'lost') {
    respondBtn.text('Сообщить о находке').removeClass('found').addClass('lost');
  }

  // Обработка изображения
  if (itemData.photo) {
    $('#modal-image').attr('src', itemData.photo).show();
  } else {
    $('#modal-image').hide();
  }

  $('#item-modal').fadeIn();
});


$('.close').click(function() {
  $('#item-modal').fadeOut();
});

$(window).click(function(event) {
  if ($(event.target).is('#item-modal')) {
    $('#item-modal').fadeOut();
  }
});

$('#respond-btn').click(function() {
  const itemTitle = $('#modal-title').text();
  const btnText = $(this).text();
  
  if (btnText === 'Откликнуться') {
    alert(`Вы откликнулись на найденный предмет: ${itemTitle}`);
  } else if (btnText === 'Сообщить о находке') {
    alert(`Вы сообщили о находке потерянного предмета: ${itemTitle}`);
  }
});

$(document).ready(function() {
  $('#photo-preview').click(function() {
    $('#photo-input').trigger('click');
  });

  $('#photo-input').on('change', function() {
    const file = this.files[0];
    if (!file) return;

    // Проверяем, является ли файл изображением
    if (!file.type.match('image.*')) {
      alert('Пожалуйста, выберите файл изображения');
      return;
    }

    const reader = new FileReader();

    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        const scaleMode = this.width > this.height ? 'cover' : 'contain';
        
        $('#photo-preview').css({
          'background-image': 'url(' + e.target.result + ')',
          'background-size': scaleMode,
          'background-repeat': 'no-repeat',
          'background-position': 'center center'
        });
        $('#photo-placeholder').hide();
      };
      img.onerror = function() {
        alert('Ошибка загрузки изображения');
      };
      img.src = e.target.result;
    };

    reader.onerror = function() {
      alert('Ошибка при чтении файла');
    };

    reader.readAsDataURL(file);
  });
});