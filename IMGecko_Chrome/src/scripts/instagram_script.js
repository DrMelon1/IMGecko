const InstagramImgOverlayBypass = () => {
    const imageContainers = document.querySelectorAll('img');

    imageContainers.forEach(img => {
        const container = img.parentElement;

        if (container && container.tagName === 'DIV') {
            const overlay = container.nextElementSibling;

            // check sibling div if it's empty
            if (overlay && overlay.tagName === 'DIV' && overlay.childNodes.length === 0) {
                const style = window.getComputedStyle(overlay);

                // target only absolute overlays which block the user from saving images
                if (style.position === 'absolute') {
                    overlay.style.pointerEvents = 'none';

                    container.style.pointerEvents = 'auto';
                    img.style.pointerEvents = 'auto';
                }
            }
        }
    });    
};

InstagramImgOverlayBypass();

new MutationObserver(InstagramImgOverlayBypass)
    .observe(document.body, {
        childList: true,
        subtree: true 
    });
