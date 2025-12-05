function enterMuseum() {
    // Add a smooth transition effect
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        window.location.href = 'gallery.html';
    }, 500);
}

// Add keyboard support for entrance page
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        enterMuseum();
    }
});



