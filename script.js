// Up塾 YouTubeスライド生成アプリ
// 役割: 台本の段落分割、スライドHTML生成、PNG出力を担当します。

const scriptInput = document.getElementById('scriptInput');
const imageInput = document.getElementById('imageInput');
const generateButton = document.getElementById('generateButton');
const downloadAllButton = document.getElementById('downloadAllButton');
const slidesContainer = document.getElementById('slidesContainer');
const slideCountText = document.getElementById('slideCountText');

let uploadedImageDataUrls = [];

const sampleScript = `一次関数のグラフを読み取ろう

今日は、一次関数のグラフから傾きと切片を見つける練習をします。まずはグラフが右上がりか右下がりかに注目しましょう。

傾きは「右に1進んだとき、上にいくつ進むか」で考えると分かりやすいです。点を2つ選び、縦の変化と横の変化を比べます。

切片は、グラフがy軸と交わる場所です。式 y = ax + b の b にあたります。最後に、読み取った傾きと切片を式にまとめましょう。`;

scriptInput.value = sampleScript;

imageInput.addEventListener('change', async (event) => {
  uploadedImageDataUrls = await readImageFilesAsDataUrls([...event.target.files]);
});

generateButton.addEventListener('click', () => {
  const paragraphs = splitScriptIntoParagraphs(scriptInput.value);

  if (paragraphs.length === 0) {
    showEmptyState('台本を入力してからスライドを生成してください。');
    return;
  }

  const slideDataList = createSlideDataList(paragraphs, uploadedImageDataUrls);
  renderSlides(slideDataList);
});

downloadAllButton.addEventListener('click', async () => {
  const slideElements = [...document.querySelectorAll('.slide')];

  for (let index = 0; index < slideElements.length; index += 1) {
    // ブラウザの連続ダウンロード制限を避けるため、少し間隔を空けます。
    await downloadSlideAsPng(slideElements[index], index + 1);
    await wait(350);
  }
});

function splitScriptIntoParagraphs(scriptText) {
  return scriptText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function createSlideDataList(paragraphs, imageDataUrls) {
  return paragraphs.map((paragraph, index) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || `スライド ${index + 1}`;
    const remainingText = lines.slice(1).join('\n');
    const fallbackBody = index === 0 ? '今回の学習テーマ' : paragraph;
    const imageForSlide = index > 0 ? imageDataUrls[index - 1] : null;

    if (index === 0) {
      return {
        type: 'title',
        title: firstLine,
        body: remainingText || fallbackBody,
        imageDataUrl: null,
      };
    }

    return {
      type: imageForSlide ? 'imageExplanation' : 'explanation',
      title: createSlideTitle(firstLine, index + 1),
      body: remainingText || paragraph,
      imageDataUrl: imageForSlide,
    };
  });
}

function createSlideTitle(firstLine, slideNumber) {
  const shortTitle = firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine;
  return shortTitle || `ポイント ${slideNumber - 1}`;
}

function renderSlides(slideDataList) {
  slidesContainer.innerHTML = '';

  slideDataList.forEach((slideData, index) => {
    const slideCard = document.createElement('article');
    slideCard.className = 'slide-card';

    const toolbar = document.createElement('div');
    toolbar.className = 'slide-toolbar';
    toolbar.innerHTML = `<span class="slide-number-label">Slide ${String(index + 1).padStart(2, '0')}</span>`;

    const downloadButton = document.createElement('button');
    downloadButton.className = 'download-button';
    downloadButton.type = 'button';
    downloadButton.textContent = 'このスライドをPNG保存';
    downloadButton.addEventListener('click', () => {
      const slideElement = slideCard.querySelector('.slide');
      downloadSlideAsPng(slideElement, index + 1);
    });
    toolbar.appendChild(downloadButton);

    slideCard.appendChild(toolbar);
    slideCard.appendChild(createSlideElement(slideData, index));
    slidesContainer.appendChild(slideCard);
  });

  slideCountText.textContent = `${slideDataList.length}枚のスライドを生成しました。`;
  downloadAllButton.disabled = slideDataList.length === 0;
}

function createSlideElement(slideData, index) {
  const slide = document.createElement('section');
  slide.className = `slide ${getSlideClassName(slideData.type)}`;
  slide.dataset.slideNumber = String(index + 1);

  const content = document.createElement('div');
  content.className = 'slide-content';

  content.appendChild(createTextElement('div', 'slide-kicker', getSlideKicker(slideData.type, index)));
  content.appendChild(createTextElement('h2', 'slide-title', slideData.title));

  if (slideData.imageDataUrl) {
    const imageArea = document.createElement('div');
    imageArea.className = 'image-area';

    const image = document.createElement('img');
    image.src = slideData.imageDataUrl;
    image.alt = `${slideData.title}に関連するスキャン画像`;
    imageArea.appendChild(image);
    content.appendChild(imageArea);
  }

  content.appendChild(createTextElement('p', 'slide-body', slideData.body));
  slide.appendChild(content);
  slide.appendChild(createTextElement('div', 'slide-footer-mark', 'Up塾'));

  return slide;
}

function getSlideClassName(type) {
  const classNames = {
    title: 'title-slide',
    explanation: 'explanation-slide',
    imageExplanation: 'image-explanation-slide',
  };

  return classNames[type] || classNames.explanation;
}

function getSlideKicker(type, index) {
  if (type === 'title') return '今日のテーマ';
  if (type === 'imageExplanation') return `資料で確認 ${index}`;
  return `ポイント ${index}`;
}

function createTextElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
}

async function readImageFilesAsDataUrls(files) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'));
  return Promise.all(imageFiles.map(readFileAsDataUrl));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function downloadSlideAsPng(slideElement, slideNumber) {
  if (!window.html2canvas) {
    alert('PNG出力ライブラリの読み込みに失敗しました。インターネット接続を確認してください。');
    return;
  }

  const canvas = await window.html2canvas(slideElement, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `upjuku-slide-${String(slideNumber).padStart(3, '0')}.png`;
  link.click();
}

function showEmptyState(message) {
  slidesContainer.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
  slideCountText.textContent = 'まだスライドは生成されていません。';
  downloadAllButton.disabled = true;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
