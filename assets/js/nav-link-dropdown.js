const largeScreenSize = 927;

$('.mega-menu-nav-item').each(function() {
  $(this).on('click', function() {
    var $slabEl = $(this).next('.mega-menu__slab');
    var navElement = document.getElementById('MainNav');
    var submenuMargin = Math.ceil((window.innerWidth - navElement.offsetWidth) / 2);

    if ($slabEl.hasClass('open')) {
      $slabEl.removeClass('open');
      if (window.innerWidth > largeScreenSize) {
        $slabEl.css({
          'padding': '0',
          'left': `-${submenuMargin}px`
        });
      }
    } else {
      $slabEl.addClass('open');
      if (window.innerWidth > largeScreenSize) {
        $('.mega-menu__slab').not($slabEl).removeClass('open').css({
          'padding': '0',
          'left': `-${submenuMargin}px`
        });
        $slabEl.css({
          'padding': `1.5rem ${submenuMargin}px`,
          'left': `-${submenuMargin}px`
        });
      }
    }
  });
});

$(window).on('click', function(e) {
  if (!$(e.target).hasClass('mega-menu-nav-item')) {
    $('.mega-menu__slab').each(function() {
      if ($(this).hasClass('open')) {
        $(this).removeClass('open');
        if (window.innerWidth > largeScreenSize) {
          $(this).css({
            'padding': '0',
            'left': "0"
          });
        }
      };
    });
  };
});