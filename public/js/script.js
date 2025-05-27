// Глобальная переменная для хранения данных пользователя
let currentUser = null;

$(document).ready(function() {
    // Проверяем статус авторизации при загрузке страницы
    checkAuthStatus();

    // Обработчик кнопки меню
    $('#menu-toggle').click(function() {
        $(this).toggleClass('active');
        $('#sidebar-menu').toggleClass('active');
    });

    // Закрытие меню при клике вне его области
    $(document).click(function(event) {
        if (!$(event.target).closest('#sidebar-menu, #menu-toggle').length) {
            $('#menu-toggle').removeClass('active');
            $('#sidebar-menu').removeClass('active');
        }
    });

    // Обработчик кнопки "Опубликовать"
    $('#publish-btn').click(function() {
      if (!window.currentUser) {
            window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
            return;
        }
        window.location.href = '/publish';
    });

    // Обработчик переключения между "Найденные" и "Потерянные"
    $('.type-btn').click(function() {
        $('.type-btn').removeClass('active');
        $(this).addClass('active');
        applyFilters();
    });

    // Обработчики фильтров
    $('#city-filter, #category-filter').on('change', applyFilters);
    $('#search-input').on('input', applyFilters);

    // Обработчик кнопки "Зарегистрироваться" на странице входа
    $('#showRegister').click(function(e) {
        e.preventDefault();
        window.location.href = '/login?register=true';
    });

    // Применение фильтров при загрузке страницы
    applyFilters();
});

// Функция проверки статуса авторизации
function checkAuthStatus() {
    const userDataElement = document.getElementById('user-data');
    if (userDataElement) {
        currentUser = {
            id: userDataElement.dataset.userId,
            isAuthenticated: true
        };
    }
}

// Функция применения фильтров
function applyFilters() {
    const currentType = $('.type-btn.active').data('type') || 'all';
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
        const description = $card.data('description').toLowerCase();
        
        const typeMatch = currentType === 'all' || itemType === currentType;
        const cityMatch = cityFilter === 'all' || itemCity === cityFilter;
        const categoryMatch = categoryFilter === 'all' || itemCategory === categoryFilter;
        const searchMatch = searchText === '' || title.includes(searchText);
        
        const isVisible = typeMatch && cityMatch && categoryMatch && searchMatch;
        $card.toggle(isVisible);
        if (searchText && isVisible) {
          highlightText($card.find('h3'), searchText);
      } else {
          removeHighlights($card);
      }
      
      if (isVisible) hasVisibleItems = true;
  });
  
  $('#no-results-message').toggle(!hasVisibleItems);
    
    $('#no-results-message').toggle(!hasVisibleItems);
}

function highlightText($element, searchText) {
  const text = $element.text();
  const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const highlighted = text.replace(regex, match => `<span class="highlight">${match}</span>`);
  $element.html(highlighted);
}

function removeHighlights($card) {
  $card.find('h3 .highlight').each(function() {
      $(this).replaceWith($(this).text());
  });
}

// Функция показа модального окна
async function showModal($card, modalId) {
  try {
    const isRequest = $card.hasClass('request-card');
    const isResponse = $card.hasClass('response-card');
    const itemId = $card.data('id');
    const userId = $card.data('userId') || $('#current-user-id').data('userId');
    
    const itemData = {
      id: itemId,
      title: $card.find('h3').text(),
      city: isRequest || isResponse 
        ? $card.find('p:contains("Город")').text().replace('Город: ', '')
        : $card.data('city'),
      location: isRequest || isResponse
        ? $card.data('location') || 'не указано'
        : $card.find('p:contains("Место:")').text().replace('Место: ', '') || 'не указано',
      date: isRequest || isResponse
        ? $card.find('p:contains("Дата")').text().replace('Дата: ', '')
        : $card.find('p:contains("Дата:")').text().replace('Дата: ', ''),
      description: $card.data('description') || 'Описание отсутствует',
      photo: $card.find('img').attr('src') || '',
      status: $card.find('.request-status').text().replace('Статус: ', '') || null,
      type: $card.data('type'),
      category: $card.data('category') || $card.find('p:contains("Категория")').text().replace('Категория: ', '') || 'не указана'
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
    $modal.find('#modal-category').text(itemData.category);
    
    if (modalId === '#response-modal') {
      $modal.find('#modal-proof-text').text(additionalData.proof);
      
      const $filesList = $modal.find('#modal-files-list');
      $filesList.empty();
      
      if (additionalData.proofs.length > 0) {
        additionalData.proofs.forEach(proof => {
          $filesList.append(`
            <div class="file-item">
              <a href="/uploads/${proof.file_path}" target="_blank" class="file-link">
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
      
      const hasResponded = await checkUserResponse(itemId, userId);
      
      if (hasResponded) {
        $respondBtn.text(itemData.type === 'found' ? 'Уже откликнулись' : 'Спасибо, что сообщили')
                  .removeClass('found lost')
                  .addClass('responded')
                  .off('click')
                  .click(function() {
                    window.location.href = '/responses';
                  });
      } else {
        if (itemData.type === 'found') {
          $respondBtn.text('Откликнуться').removeClass('lost responded').addClass('found');
        } else if (itemData.type === 'lost') {
          $respondBtn.text('Сообщить о находке').removeClass('found responded').addClass('lost');
        }
        $respondBtn.off('click').click(function() {
          const itemId = $(this).data('item-id');
          window.location.href = `/respond?item_id=${itemId}`;
        });
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

// Проверка, откликался ли пользователь на объявление
async function checkUserResponse(itemId, userId) {
    try {
        const response = await fetch(`/api/check-response?item_id=${itemId}&user_id=${userId}`);
        const data = await response.json();
        return data.hasResponded;
    } catch (error) {
        console.error('Ошибка при проверке отклика:', error);
        return false;
    }
}

// Обработчики событий для модальных окон
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

// Обработчики форм входа и регистрации
$(document).ready(function() {
    $('#loginForm').submit(function(e) {
        e.preventDefault();
        $.post('/login', $(this).serialize())
            .done(() => window.location.reload())
            .fail(response => alert(response.responseText));
    });

    $('#registerForm').submit(function(e) {
        e.preventDefault();
        $.post('/register', $(this).serialize())
            .done(() => window.location.reload())
            .fail(response => alert(response.responseText));
    });
});

// Обработчик загрузки фото
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
            $('#photo-preview').css({
                'background-image': 'url(' + e.target.result + ')',
                'background-size': 'cover',
                'background-repeat': 'no-repeat',
                'background-position': 'center center'
            });
            $('#photo-placeholder').hide();
        };
        reader.readAsDataURL(file);
    });
});

// Обработчики удаления заявок и откликов
$(document).on('click', '.delete-request-btn', async function() {
  const id = $(this).data('id');
  if (!confirm('Вы уверены, что хотите удалить эту заявку?')) return;
  
  try {
      const response = await fetch(`/api/requests/${id}`, {
          method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
          $(this).closest('.request-card').fadeOut(300, function() {
              $(this).remove();
          });
      } else {
          alert(result.error || 'Не удалось удалить заявку');
      }
  } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при удалении заявки');
  }
});

$(document).on('click', '.delete-response-btn', async function() {
  const id = $(this).data('id');
  if (!confirm('Вы уверены, что хотите отозвать этот отклик?')) return;
  
  try {
      const response = await fetch(`/api/responses/${id}`, {
          method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
          $(this).closest('.response-card').fadeOut(300, function() {
              $(this).remove();
          });
      } else {
          alert(result.error || 'Не удалось отозвать отклик');
      }
  } catch (error) {
      console.error('Ошибка:', error);
      alert('Ошибка при отзыве отклика');
  }
});

// Обработчики редактирования
$(document).on('click', '.edit-request-btn', function() {
  const id = $(this).data('id');
  window.location.href = `/edit-request/${id}`;
});

$(document).on('click', '.edit-response-btn', function() {
  const id = $(this).data('id');
  window.location.href = `/edit-response/${id}`;
});

// Валидация формы добавления доказательств
document.getElementById('proof_type')?.addEventListener('change', function() {
    const helpText = document.getElementById('file-help');
    if (this.value === 'photo') {
        helpText.textContent = 'Допустимые форматы: jpg, png, jpeg';
    } else if (this.value === 'document') {
        helpText.textContent = 'Допустимые форматы: pdf, doc, docx';
    }
});

document.getElementById('proof_file')?.addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;

    const proofType = document.getElementById('proof_type').value;
    const fileName = file.name.toLowerCase();
    const allowedPhotoExtensions = ['.jpg', '.jpeg', '.png'];
    const allowedDocExtensions = ['.pdf', '.doc', '.docx'];
    let isValid = false;

    if (proofType === 'photo') {
        isValid = allowedPhotoExtensions.some(ext => fileName.endsWith(ext));
    } else if (proofType === 'document') {
        isValid = allowedDocExtensions.some(ext => fileName.endsWith(ext));
    }

    if (!isValid) {
        alert(`Недопустимый формат файла для выбранного типа`);
        this.value = '';
    }
});

// Установка максимальной даты для поля ввода даты
document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const today = new Date();
        const maxDate = today.toISOString().split('T')[0];
        dateInput.setAttribute('max', maxDate);
    }
});

function logout() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    fetch('/logout', {
      method: 'GET',
      credentials: 'same-origin'
    })
    .then(response => {
      if (response.redirected) {
        window.location.href = response.url;
      }
    })
    .catch(error => {
      console.error('Ошибка при выходе:', error);
      window.location.href = '/';
    });
  }
}