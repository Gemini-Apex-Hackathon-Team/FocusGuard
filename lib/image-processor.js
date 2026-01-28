function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function captureVideoFrame(videoElement) {
    const canvas = createCanvas(videoElement.videoWidth, videoElement.videoHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    return canvas;
}

function canvasToBase64(canvas, quality) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality || 0.8);
    return dataUrl.split(',')[1];
}

function imageToCanvas(imageElement) {
    const canvas = createCanvas(imageElement.naturalWidth, imageElement.naturalHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0);
    return canvas;
}

async function fileToImage(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();

        reader.onload = function(event) {
            const img = new Image();

            img.onload = function() {
                resolve(img);
            };

            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };

            img.src = event.target.result;
        };

        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

async function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();

        reader.onload = function(event) {
            const base64 = event.target.result.split(',')[1];
            resolve(base64);
        };

        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
    });
}

function resizeImage(imageElement, maxWidth, maxHeight) {
    let width = imageElement.naturalWidth;
    let height = imageElement.naturalHeight;

    if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
    }

    if (height > maxHeight) {
        width = Math.round(width * maxHeight / height);
        height = maxHeight;
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, width, height);

    return canvas;
}

export {
    createCanvas,
    captureVideoFrame,
    canvasToBase64,
    imageToCanvas,
    fileToImage,
    fileToBase64,
    resizeImage
};
