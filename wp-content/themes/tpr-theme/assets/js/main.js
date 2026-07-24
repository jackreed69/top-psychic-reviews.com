document.addEventListener('DOMContentLoaded', function () {
    /* ---- Mobile menu toggle ---- */
    var toggle = document.getElementById('menu-toggle');
    var nav = document.getElementById('site-nav');
    if (toggle && nav) {
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open);
            toggle.querySelector('.menu-toggle__open').style.display = open ? 'none' : 'block';
            toggle.querySelector('.menu-toggle__close').style.display = open ? 'block' : 'none';
        });
    }

    /* ---- Sticky header shadow on scroll ---- */
    var header = document.getElementById('site-header');
    if (header) {
        window.addEventListener('scroll', function () {
            header.classList.toggle('scrolled', window.scrollY > 10);
        }, { passive: true });
    }

    /* ---- FAQ accordion ---- */
    document.querySelectorAll('.faq-item__q').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var item = btn.closest('.faq-item');
            var wasOpen = item.classList.contains('open');
            document.querySelectorAll('.faq-item').forEach(function (el) {
                el.classList.remove('open');
                el.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
            });
            if (!wasOpen) {
                item.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
            }
        });
    });

    /* ---- Smooth scroll for anchor links ---- */
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var target = document.querySelector(a.getAttribute('href'));
            if (target) {
                e.preventDefault();
                var offset = 80;
                var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top: top, behavior: 'smooth' });
                if (nav && nav.classList.contains('open')) {
                    nav.classList.remove('open');
                    toggle.setAttribute('aria-expanded', 'false');
                    toggle.querySelector('.menu-toggle__open').style.display = 'block';
                    toggle.querySelector('.menu-toggle__close').style.display = 'none';
                }
            }
        });
    });
});
