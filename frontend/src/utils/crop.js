export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // set canvas to correct size to fit rotated image
  canvas.width = safeArea;
  canvas.height = safeArea;

  ctx.fillStyle = '#0000';
  ctx.fillRect(0, 0, safeArea, safeArea);

  ctx.save();
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();

  const data = ctx.getImageData(0, 0, safeArea, safeArea);

  // set canvas to final desired crop size
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // draw the cropped image
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width / 2 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height / 2 - pixelCrop.y)
  );

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg');
  });
}

function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (err) => reject(err));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid CORS issues on some sources
    image.src = url;
  });
}
