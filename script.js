// Up塾 YouTubeスライド生成アプリ
// 役割: 台本の段落分割、スライド分解テキスト解析、編集可能なスライドHTML生成、PNG出力を担当します。

const scriptInput = document.getElementById('scriptInput');
const slideBreakdownInput = document.getElementById('slideBreakdownInput');
const imageInput = document.getElementById('imageInput');
const generateButton = document.getElementById('generateButton');
const generateFromBreakdownButton = document.getElementById('generateFromBreakdownButton');
const downloadAllButton = document.getElementById('downloadAllButton');
const slidesContainer = document.getElementById('slidesContainer');
const slideCountText = document.getElementById('slideCountText');

let uploadedImageDataUrls = [];
let currentSlideDataList = [];

const sampleScript = `一次関数のグラフを読み取ろう

今日は、一次関数のグラフから傾きと切片を見つける練習をします。まずはグラフが右上がりか右下がりかに注目しましょう。

傾きは「右に1進んだとき、上にいくつ進むか」で考えると分かりやすいです。点を2つ選び、縦の変化と横の変化を比べます。

切片は、グラフがy軸と交わる場所です。式 y = ax + b の b にあたります。最後に、読み取った傾きと切片を式にまとめましょう。`;

const sampleSlideBreakdown = `--- slide 1
タイトル：一次関数のグラフを読み取ろう
本文：今日は、一次関数のグラフから傾きと切片を見つける練習をします。

--- slide 2
タイトル：まず見る場所
本文：グラフが右上がりか右下がりかに注目します。

--- slide 3
タイトル：傾きの考え方
本文：傾きは「右に1進んだとき、上にいくつ進むか」で考えます。`;

scriptInput.value = sampleScript;
slideBreakdownInput.value = sampleSlideBreakdown;

imageInput.addEventListener('change', async (event) => {
  uploadedImageDataUrls = await readImageFilesAsDataUrls([...event.target.files]);
});

generateButton.addEventListener('click', () => {
  const paragraphs = splitScriptIntoParagraphs(scriptInput.value);

  if (paragraphs.length === 0) {
    showEmptyState('台本を入力してからスライドを生成してください。');
    return;
  }

  currentSlideDataList = createSlideDataList(paragraphs, uploadedImageDataUrls);
  renderSlides(currentSlideDataList);
});

generateFromBreakdownButton.addEventListener('click', () => {
  const slideBreakdownItems = parseSlideBreakdownText(slideBreakdownInput.value);

  if (slideBreakdownItems.length === 0) {
    showEmptyState('スライド分解テキストを入力してから生成してください。');
    return;
  }

  currentSlideDataList = createSlideDataListFromBreakdown(slideBreakdownItems, uploadedImageDataUrls);
  renderSlides(currentSlideDataList);
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

function parseSlideBreakdownText(inputText) {
  const normalizedText = inputText.replace(/\r\n?/g, '\n').trim();
  if (!normalizedText) return [];

  const blocks = [];
  let currentBlock = null;

  normalizedText.split('\n').forEach((line) => {
    const markerMatch = line.match(/^\s*-{2,}\s*slide\s*(\d+)?\b.*$/i);

    if (markerMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        slideNumber: markerMatch[1] ? Number(markerMatch[1]) : null,
        lines: [],
        originalOrder: blocks.length,
      };
      return;
    }

    if (!currentBlock) {
      currentBlock = {
        slideNumber: null,
        lines: [],
        originalOrder: blocks.length,
      };
    }

    currentBlock.lines.push(line);
  });

  if (currentBlock) blocks.push(currentBlock);

  return blocks
    .map(parseSlideBreakdownBlock)
    .filter((slideItem) => slideItem.title || slideItem.body)
    .sort(compareSlideBreakdownItems);
}

function parseSlideBreakdownBlock(block) {
  const titleLines = [];
  const bodyLines = [];
  const looseLines = [];
  let currentField = null;

  block.lines.forEach((line) => {
    const trimmedLine = line.trim();
    const titleMatch = trimmedLine.match(/^(タイトル|title)\s*[:：]\s*(.*)$/i);
    const bodyMatch = trimmedLine.match(/^(本文|body|text)\s*[:：]\s*(.*)$/i);

    if (titleMatch) {
      currentField = 'title';
      if (titleMatch[2]) titleLines.push(titleMatch[2].trim());
      return;
    }

    if (bodyMatch) {
      currentField = 'body';
      if (bodyMatch[2]) bodyLines.push(bodyMatch[2].trim());
      return;
    }

    if (!trimmedLine) {
      if (currentField === 'body') bodyLines.push('');
      return;
    }

    if (currentField === 'title') {
      titleLines.push(trimmedLine);
    } else if (currentField === 'body') {
      bodyLines.push(trimmedLine);
    } else {
      looseLines.push(trimmedLine);
    }
  });

  let title = trimMultilineText(titleLines.join('\n'));
  let body = trimMultilineText(bodyLines.join('\n'));

  if (!title && looseLines.length > 0) {
    title = looseLines.shift();
  }

  if (!body && looseLines.length > 0) {
    body = looseLines.join('\n');
  }

  if (title && !body && titleLines.length > 1) {
    const splitTitleLines = title.split('\n');
    title = splitTitleLines.shift();
    body = splitTitleLines.join('\n');
  }

  return {
    slideNumber: block.slideNumber,
    originalOrder: block.originalOrder,
    title: title || `スライド ${block.slideNumber || block.originalOrder + 1}`,
    body: body || '本文を入力してください。',
  };
}

function compareSlideBreakdownItems(left, right) {
  const leftHasNumber = Number.isFinite(left.slideNumber);
  const rightHasNumber = Number.isFinite(right.slideNumber);

  if (leftHasNumber && rightHasNumber && left.slideNumber !== right.slideNumber) {
    return left.slideNumber - right.slideNumber;
  }

  if (leftHasNumber !== rightHasNumber) {
    return leftHasNumber ? -1 : 1;
  }

  return left.originalOrder - right.originalOrder;
}

function trimMultilineText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

function createSlideDataList(paragraphs, imageDataUrls) {
  return paragraphs.map((paragraph, index) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || `スライド ${index + 1}`;
    const remainingText = lines.slice(1).join('\n');
    const fallbackBody = index === 0 ? '今回の学習テーマ' : paragraph;
    const imageForSlide = index > 0 ? imageDataUrls[index - 1] : null;

    if (index === 0) {
      return createSlideData('title', firstLine, remainingText || fallbackBody, null);
    }

    return createSlideData(
      imageForSlide ? 'imageExplanation' : 'explanation',
      createSlideTitle(firstLine, index + 1),
      remainingText || paragraph,
      imageForSlide,
    );
  });
}

function createSlideDataListFromBreakdown(slideBreakdownItems, imageDataUrls) {
  return slideBreakdownItems.map((slideItem, index) => {
    const isTitleSlide = index === 0 || slideItem.slideNumber === 1;
    const imageForSlide = isTitleSlide ? null : imageDataUrls[index - 1] || null;

    return createSlideData(
      isTitleSlide ? 'title' : imageForSlide ? 'imageExplanation' : 'explanation',
      slideItem.title,
      slideItem.body,
      imageForSlide,
    );
  });
}

function createSlideData(type, title, body, imageDataUrl) {
  return {
    id: createSlideId(),
    type,
    title,
    body,
    imageDataUrl,
  };
}

function createSlideId() {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSlideTitle(firstLine, slideNumber) {
  const shortTitle = firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine;
  return shortTitle || `ポイント ${slideNumber - 1}`;
}

function renderSlides(slideDataList) {
  slidesContainer.innerHTML = '';

  if (slideDataList.length === 0) {
    showEmptyState('スライドがありません。');
    return;
  }

  slideDataList.forEach((slideData, index) => {
    const slideCard = document.createElement('article');
    slideCard.className = 'slide-card';
    slideCard.dataset.slideId = slideData.id;

    slideCard.appendChild(createSlideToolbar(slideData, index, slideDataList.length));
    slideCard.appendChild(createSlideEditor(slideData, index));
    slideCard.appendChild(createSlideElement(slideData, index));
    slidesContainer.appendChild(slideCard);
  });

  slideCountText.textContent = `${slideDataList.length}枚のスライドを生成しました。編集後の状態でPNG保存できます。`;
  downloadAllButton.disabled = slideDataList.length === 0;
}

function createSlideToolbar(slideData, index, slideCount) {
  const toolbar = document.createElement('div');
  toolbar.className = 'slide-toolbar';

  const label = document.createElement('span');
  label.className = 'slide-number-label';
  label.textContent = `Slide ${String(index + 1).padStart(2, '0')}`;
  toolbar.appendChild(label);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'slide-action-group';

  const moveUpButton = createActionButton('上へ', () => moveSlide(index, -1), index === 0);
  const moveDownButton = createActionButton('下へ', () => moveSlide(index, 1), index === slideCount - 1);
  const duplicateButton = createActionButton('複製', () => duplicateSlide(index));
  const deleteButton = createActionButton('削除', () => deleteSlide(index), slideCount <= 1, 'danger-button');
  const downloadButton = createActionButton('このスライドをPNG保存', () => {
    const slideElement = document.querySelector(`[data-slide-id="${slideData.id}"] .slide`);
    downloadSlideAsPng(slideElement, index + 1);
  }, false, 'download-button');

  [moveUpButton, moveDownButton, duplicateButton, deleteButton, downloadButton].forEach((button) => {
    buttonGroup.appendChild(button);
  });

  toolbar.appendChild(buttonGroup);
  return toolbar;
}

function createSlideEditor(slideData, index) {
  const editor = document.createElement('div');
  editor.className = 'slide-editor';

  const titleLabel = document.createElement('label');
  titleLabel.className = 'editor-field';
  titleLabel.innerHTML = '<span>タイトル編集</span>';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = slideData.title;
  titleInput.addEventListener('input', (event) => updateSlideText(index, 'title', event.target.value));
  titleLabel.appendChild(titleInput);

  const bodyLabel = document.createElement('label');
  bodyLabel.className = 'editor-field';
  bodyLabel.innerHTML = '<span>本文編集</span>';
  const bodyInput = document.createElement('textarea');
  bodyInput.rows = 4;
  bodyInput.value = slideData.body;
  bodyInput.addEventListener('input', (event) => updateSlideText(index, 'body', event.target.value));
  bodyLabel.appendChild(bodyInput);

  editor.appendChild(titleLabel);
  editor.appendChild(bodyLabel);
  return editor;
}

function createActionButton(label, onClick, disabled = false, extraClassName = '') {
  const button = document.createElement('button');
  button.className = ['small-button', extraClassName].filter(Boolean).join(' ');
  button.type = 'button';
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function updateSlideText(index, fieldName, value) {
  const slideData = currentSlideDataList[index];
  if (!slideData) return;

  slideData[fieldName] = value;

  const slideCard = slidesContainer.querySelectorAll('.slide-card')[index];
  if (!slideCard) return;

  const targetSelector = fieldName === 'title' ? '.slide-title' : '.slide-body';
  const previewText = slideCard.querySelector(targetSelector);
  if (previewText) previewText.textContent = value;

  if (fieldName === 'title') {
    const image = slideCard.querySelector('.image-area img');
    if (image) image.alt = `${value}に関連するスキャン画像`;
  }
}

function moveSlide(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= currentSlideDataList.length) return;

  [currentSlideDataList[index], currentSlideDataList[nextIndex]] = [
    currentSlideDataList[nextIndex],
    currentSlideDataList[index],
  ];
  normalizeSlideTypes();
  renderSlides(currentSlideDataList);
}

function duplicateSlide(index) {
  const sourceSlide = currentSlideDataList[index];
  if (!sourceSlide) return;

  const duplicatedSlide = {
    ...sourceSlide,
    id: createSlideId(),
    title: `${sourceSlide.title}（コピー）`,
  };

  currentSlideDataList.splice(index + 1, 0, duplicatedSlide);
  normalizeSlideTypes();
  renderSlides(currentSlideDataList);
}

function deleteSlide(index) {
  if (currentSlideDataList.length <= 1) return;

  currentSlideDataList.splice(index, 1);
  normalizeSlideTypes();
  renderSlides(currentSlideDataList);
}

function normalizeSlideTypes() {
  currentSlideDataList = currentSlideDataList.map((slideData, index) => ({
    ...slideData,
    type: index === 0 ? 'title' : slideData.imageDataUrl ? 'imageExplanation' : 'explanation',
  }));
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
  currentSlideDataList = [];
  slidesContainer.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
  slideCountText.textContent = 'まだスライドは生成されていません。';
  downloadAllButton.disabled = true;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
