document.addEventListener('DOMContentLoaded', function() {
  const images = document.querySelectorAll('.zoomable');
  images.forEach(img => {
    img.addEventListener('click', function() {
      this.classList.toggle('zoomed');
    });
  });
});