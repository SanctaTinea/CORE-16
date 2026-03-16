function syncHeightToFourthColumn() {
    const ref = document.querySelector('.ref-column');
    const cols = document.querySelectorAll('.sync-column');

    if (!ref) return;

    const h = ref.getBoundingClientRect().height;

    cols.forEach(col => {
        col.style.height = `${h}px`;
    });
}

window.addEventListener('load', syncHeightToFourthColumn);
window.addEventListener('resize', syncHeightToFourthColumn);