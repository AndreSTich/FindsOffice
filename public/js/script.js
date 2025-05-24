$('#publish-btn').click(function() {
  window.location.href = '/publish';
});

$('#menu-toggle').click(function() {
  $(this).toggleClass('active');
  $('#sidebar-menu').toggleClass('active');
});

$(document).click(function(event) {
  if (!$(event.target).closest('#sidebar-menu, #menu-toggle').length) {
    $('#menu-toggle').removeClass('active');
    $('#sidebar-menu').removeClass('active');
  }
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
  

async function showModal($card, modalId) {
  try {
    const isRequest = $card.hasClass('request-card');
    const isResponse = $card.hasClass('response-card');
    const itemId = $card.data('id');
    
    const itemData = {
      id: itemId,
      title: $card.find('h3').text(),
      city: isRequest || isResponse 
        ? $card.find('p:contains("Город")').text().replace('Город: ', '')
        : $card.data('city'),
      location: isRequest || isResponse
        ? $card.data('location')
        : $card.find('p:contains("Место:")').text().replace('Место: ', ''),
      date: isRequest || isResponse
        ? $card.find('p:contains("Дата")').text().replace('Дата: ', '')
        : $card.find('p:contains("Дата:")').text().replace('Дата: ', ''),
      description: $card.data('description') || 'Описание отсутствует',
      photo: $card.find('img').attr('src') || '',
      status: $card.find('.request-status').text().replace('Статус: ', '') || null,
      type: $card.data('type')
    };

    let additionalData = {};
    if (modalId === '#response-modal') {
      const response = await fetch(`/api/responses/${itemId}`).then(res => res.json());
      additionalData = {
        proof: response.proof || 'Информация не указана',
        proofs: response.Proofs || []
      };
    }

    const $modal = $(modalId);
    $modal.find('#modal-title').text(itemData.title);
    $modal.find('#modal-city').text(itemData.city);
    $modal.find('#modal-location').text(itemData.location);
    $modal.find('#modal-date').text(itemData.date);
    $modal.find('#modal-description').text(itemData.description);
    
    if (modalId === '#response-modal') {
      $modal.find('#modal-proof-text').text(additionalData.proof);
      
      const $filesList = $modal.find('#modal-files-list');
      $filesList.empty();
      
      if (additionalData.proofs.length > 0) {
        additionalData.proofs.forEach(proof => {
          $filesList.append(`
            <div class="file-item">
              <a href="${proof.file_path}" target="_blank" class="file-link">
                ${proof.file_path.split('/').pop()}
              </a>
            </div>
          `);
        });
      } else {
        $filesList.html('<p>Файлы не прикреплены</p>');
      }
    }

    if (modalId === '#item-modal') {
      const $respondBtn = $('#respond-btn').data('item-id', itemData.id);
      if (itemData.type === 'found') {
        $respondBtn.text('Откликнуться').removeClass('lost').addClass('found');
      } else if (itemData.type === 'lost') {
        $respondBtn.text('Сообщить о находке').removeClass('found').addClass('lost');
      }
    }

    const $modalImg = $modal.find('#modal-image');
    if (itemData.photo) {
      $modalImg.attr('src', itemData.photo).show();
    } else {
      $modalImg.hide();
    }

    $modal.fadeIn();
    
  } catch (error) {
    console.error('Ошибка при открытии модального окна:', error);
    alert('Не удалось загрузить данные');
  }
}

$(document).on('click', '.item-card', function(e) {
  if ($(e.target).closest('.request-actions').length) return;
  showModal($(this), '#item-modal');
});

$(document).on('click', '.request-card', function(e) {
  if ($(e.target).closest('.request-actions').length) return;
  showModal($(this), '#request-modal');
});

$(document).on('click', '.response-card', function(e) {
  if ($(e.target).closest('.request-actions').length) return;
  showModal($(this), '#response-modal');
});

$('.close').click(function() {
  $(this).closest('.modal').fadeOut();
});

$(window).click(function(event) {
  if ($(event.target).hasClass('modal')) {
    $(event.target).fadeOut();
  }
});

$('#respond-btn').click(function() {
  const itemId = $(this).data('item-id');
  if (!itemId) {
    alert('Ошибка: ID предмета не найден');
    return;
  }
  window.location.href = `/respond?item_id=${itemId}`;
});

$(document).ready(function() {
  $('#photo-preview').click(function() {
    $('#photo-input').trigger('click');
  });

  $('#photo-input').on('change', function() {
    const file = this.files[0];
    if (!file) return;

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